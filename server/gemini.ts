import crypto from 'crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AiErrorCode,
  ResponseLanguageCode,
  SocialContentResult,
  VideoPromptResult,
} from '../src/types';
import { getLanguageOption, normalizeLanguageCode } from '../src/constants/languages';
import {
  AVAILABLE_GEMINI_MODELS,
  getActiveAiModel,
  getAppSettings,
} from './store';

export class GeminiServiceError extends Error {
  status: number;
  retryable: boolean;
  errorCode: AiErrorCode;
  retryAfterSec?: number;

  constructor(
    message: string,
    status = 500,
    retryable = false,
    errorCode: AiErrorCode = 'unknown',
    retryAfterSec?: number
  ) {
    super(message);
    this.name = 'GeminiServiceError';
    this.status = status;
    this.retryable = retryable;
    this.errorCode = errorCode;
    this.retryAfterSec = retryAfterSec;
  }
}

interface ParsedErrorDetails {
  code?: number;
  status?: string;
  rawMessage: string;
  retryAfterSec?: number;
  quotaReasonText: string;
}

function parseRetrySeconds(text: string): number | undefined {
  const secMatch = text.match(/(?:retry\s*(?:in|after)\s*[:=]?\s*|retryDelay["']?\s*[:=]\s*["']?)(\d+(?:\.\d+)?)\s*s/i);
  if (secMatch) {
    const val = Math.ceil(Number(secMatch[1]));
    if (Number.isFinite(val) && val > 0) {
      return Math.min(60, Math.max(2, val));
    }
  }
  return undefined;
}

function extractRawErrorDetails(err: unknown): ParsedErrorDetails {
  if (err instanceof GeminiServiceError) {
    return {
      code: err.status,
      rawMessage: err.message,
      retryAfterSec: err.retryAfterSec,
      quotaReasonText: err.message,
    };
  }

  const anyErr = err as Record<string, unknown> | undefined;
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof anyErr?.message === 'string'
        ? anyErr.message
        : String(err ?? '');
  let code =
    typeof anyErr?.status === 'number'
      ? anyErr.status
      : typeof anyErr?.code === 'number'
        ? anyErr.code
        : undefined;
  let status = typeof anyErr?.statusText === 'string' ? anyErr.statusText : undefined;
  let nestedText = rawMessage;
  let retryAfterSec = parseRetrySeconds(rawMessage);

  const jsonStart = rawMessage.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(rawMessage.slice(jsonStart)) as {
        error?: {
          code?: number;
          status?: string;
          message?: string;
          details?: Array<Record<string, unknown>>;
        };
        code?: number;
        status?: string;
        message?: string;
      };
      if (parsed?.error) {
        code = parsed.error.code ?? code;
        status = parsed.error.status ?? status;
        if (parsed.error.message) {
          nestedText += ' ' + parsed.error.message;
        }
        if (Array.isArray(parsed.error.details)) {
          const detailsStr = JSON.stringify(parsed.error.details);
          nestedText += ' ' + detailsStr;
          retryAfterSec = retryAfterSec ?? parseRetrySeconds(detailsStr);
        }
      } else {
        code = parsed?.code ?? code;
        status = parsed?.status ?? status;
        if (parsed?.message) {
          nestedText += ' ' + parsed.message;
        }
      }
    } catch {
      // Ignore malformed JSON
    }
  }

  return {
    code,
    status,
    rawMessage,
    retryAfterSec,
    quotaReasonText: nestedText,
  };
}

function isQuotaExhaustedSignature(
  textLower: string,
  activeModel: string,
  retryAfterSec?: number
): boolean {
  // Definite hard exhaustion (daily limit, limit: 0, or paid-only model on free key)
  const hardExhaustedMarkers = [
    'limit: 0',
    'requestsperday',
    'generaterequestsperday',
    'perday',
    'daily limit',
    'quota exhausted',
  ];
  if (hardExhaustedMarkers.some((marker) => textLower.includes(marker))) {
    return true;
  }

  // If user selected a paid-only model and gets 429, do not auto-retry or auto-switch
  const modelMeta = AVAILABLE_GEMINI_MODELS.find((m) => m.id === activeModel);
  if (modelMeta && !modelMeta.isFreeTier) {
    return true;
  }

  // Temporary rate-limit signatures (RPM / TPM / explicit retry window)
  const tempRateLimitMarkers = [
    'perminute',
    'requests per minute',
    'tokens per minute',
    'rate limit',
    'rate_limit',
    'too many requests',
    'try again in',
    'retry in',
  ];
  if (retryAfterSec !== undefined || tempRateLimitMarkers.some((marker) => textLower.includes(marker))) {
    return false;
  }

  // Fallback for generic "exceeded your current quota" / billing messages with no retry window
  if (
    textLower.includes('exceeded your current quota') ||
    textLower.includes('check your plan and billing') ||
    textLower.includes('billing account')
  ) {
    return true;
  }

  return false;
}

export function normalizeGeminiError(err: unknown, attemptedModel?: string): GeminiServiceError {
  if (err instanceof GeminiServiceError) return err;

  const { code, status, rawMessage, retryAfterSec, quotaReasonText } = extractRawErrorDetails(err);
  const lower = `${rawMessage} ${quotaReasonText}`.toLowerCase();
  const activeModel = attemptedModel || getActiveAiModel();

  if (
    code === 429 ||
    status === 'RESOURCE_EXHAUSTED' ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('quota')
  ) {
    const exhausted = isQuotaExhaustedSignature(lower, activeModel, retryAfterSec);
    if (exhausted) {
      return new GeminiServiceError(
        'Gemini API-এর নির্ধারিত কোটা শেষ হয়ে গেছে (৪২৯ Resource Exhausted)। অযথা ডুপ্লিকেট অনুরোধ বন্ধ রাখা হয়েছে। অনুগ্রহ করে কোটা রিসেট হওয়া পর্যন্ত অপেক্ষা করুন অথবা মডেল অপশন থেকে ফ্রি টিয়ারের অন্য একটি মডেল (যেমন Gemini 2.5 Flash Lite) বেছে নিয়ে আবার চেষ্টা করুন।',
        429,
        false,
        'quota_exhausted',
        retryAfterSec
      );
    }

    return new GeminiServiceError(
      'সাময়িকভাবে Gemini API-এর অনুরোধ সীমা (৪২৯) পূর্ণ হয়েছে। স্বয়ংক্রিয়ভাবে বিরতি দিয়ে পুনরায় চেষ্টা করা হয়েছে—অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন অথবা অন্য একটি ফ্রি মডেল নির্বাচন করুন।',
      429,
      true,
      'rate_limit',
      retryAfterSec ?? 5
    );
  }

  if (
    code === 503 ||
    status === 'UNAVAILABLE' ||
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  ) {
    return new GeminiServiceError(
      `নির্বাচিত Gemini মডেলটি (${activeModel}) সাময়িকভাবে অনুপলব্ধ রয়েছে বা সার্ভারে অতিরিক্ত চাপ আছে (৫০৩)। সর্বোচ্চ ৩ বার স্বয়ংক্রিয় চেষ্টা করা হয়েছে—অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা নিচ থেকে অন্য একটি ফ্রি-টিয়ার Gemini মডেল (যেমন Gemini 2.5 Flash বা Gemini 2.5 Flash Lite) নির্বাচন করুন।`,
      503,
      true,
      'overloaded'
    );
  }

  if (
    code === 401 ||
    code === 403 ||
    status === 'PERMISSION_DENIED' ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('api key')
  ) {
    return new GeminiServiceError(
      'এআই সার্ভার সংযোগ অনুমোদিত নয়। অনুগ্রহ করে সার্ভার এনভায়রনমেন্ট থেকে GEMINI_API_KEY যাচাই করুন।',
      403,
      false,
      'auth'
    );
  }

  if (
    code === 404 ||
    status === 'NOT_FOUND' ||
    lower.includes('not_found') ||
    lower.includes('not found')
  ) {
    return new GeminiServiceError(
      `নির্বাচিত Gemini মডেলটি (${activeModel}) বর্তমানে Gemini API (v1beta)-তে পাওয়া যায়নি (Error 404)। অনুগ্রহ করে মডেল অপশন থেকে সমর্থিত একটি ফ্রি মডেল (যেমন Gemini 2.5 Flash বা Gemini 2.5 Flash Lite) নির্বাচন করে আবার চেষ্টা করুন।`,
      404,
      false,
      'not_found'
    );
  }

  if (
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    code === 500 ||
    code === 502 ||
    code === 504
  ) {
    return new GeminiServiceError(
      'এআই সার্ভারের সাথে সংযোগে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।',
      502,
      true,
      'network'
    );
  }

  return new GeminiServiceError(
    'এই মুহূর্তে এআই থেকে উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
    500,
    true,
    'unknown'
  );
}

function isRetryableTemporaryError(normalized: GeminiServiceError): boolean {
  if (!normalized.retryable) return false;
  return (
    normalized.errorCode === 'rate_limit' ||
    normalized.errorCode === 'overloaded' ||
    normalized.errorCode === 'network'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_GEMINI_TIMEOUT_MS = 28_000;
const MAX_TOTAL_RETRY_ELAPSED_MS = 45_000;
const MODEL_DISCOVERY_TTL_MS = 10 * 60 * 1000;

let cachedDiscoveredModels: { models: string[]; fetchedAt: number } | null = null;
let discoveryInFlight: Promise<string[]> | null = null;

function resolveTargetModel(modelOverride?: string): string {
  if (modelOverride && modelOverride.trim()) {
    return modelOverride.trim();
  }
  return getActiveAiModel();
}

export async function discoverSupportedModels(forceRefresh = false): Promise<string[]> {
  if (
    !forceRefresh &&
    cachedDiscoveredModels &&
    Date.now() - cachedDiscoveredModels.fetchedAt < MODEL_DISCOVERY_TTL_MS
  ) {
    return cachedDiscoveredModels.models;
  }

  if (discoveryInFlight) {
    return discoveryInFlight;
  }

  discoveryInFlight = (async () => {
    try {
      if (!process.env.GEMINI_API_KEY) return [];
      const ai = getAiClient(10_000);
      const pager = await ai.models.list();
      const found: string[] = [];
      for await (const m of pager) {
        const cleanName = (m.name || '').replace(/^models\//, '').trim();
        if (!cleanName) continue;
        const actions = (m as { supportedActions?: string[] }).supportedActions;
        if (!actions || actions.includes('generateContent')) {
          found.push(cleanName);
        }
      }
      cachedDiscoveredModels = { models: found, fetchedAt: Date.now() };
      return found;
    } catch {
      return cachedDiscoveredModels?.models ?? [];
    } finally {
      discoveryInFlight = null;
    }
  })();

  return discoveryInFlight;
}

const FREE_TEXT_FALLBACK_PRIORITY = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

async function pickFreeFallbackCandidates(
  failedModel: string,
  customFallbacks?: string[]
): Promise<string[]> {
  const discovered = await discoverSupportedModels();
  const baseList =
    customFallbacks && customFallbacks.length > 0
      ? customFallbacks
      : FREE_TEXT_FALLBACK_PRIORITY;

  const candidates: string[] = [];
  if (discovered.length > 0) {
    for (const id of baseList) {
      if (id !== failedModel && discovered.includes(id) && !candidates.includes(id)) {
        candidates.push(id);
      }
    }
    // Also consider any live discovered 2.5/3.x flash/flash-lite models (never pro/paid/deprecated)
    for (const id of discovered) {
      if (
        id !== failedModel &&
        !candidates.includes(id) &&
        (id.startsWith('gemini-2.5-flash') || id.startsWith('gemini-3.1-flash-lite')) &&
        !id.includes('-image') &&
        !id.includes('-tts') &&
        !id.includes('-live')
      ) {
        candidates.push(id);
      }
    }
  }

  for (const id of baseList) {
    if (id !== failedModel && !candidates.includes(id)) {
      candidates.push(id);
    }
  }

  return candidates.slice(0, 4);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new GeminiServiceError(
          'নির্বাচিত Gemini মডেল থেকে উত্তর আসতে নির্ধারিত সময় শেষ হয়ে গেছে (Timeout)। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা অন্য একটি ফ্রি-টিয়ার Gemini মডেল বেছে নিন।',
          504,
          true,
          'network'
        )
      );
    }, timeoutMs);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export interface RetryOptions {
  modelId?: string;
  allowNotFoundFallback?: boolean;
  fallbackModels?: string[];
}

export async function withGeminiRetry<T>(
  operation: (model: string) => Promise<T>,
  shouldAllowRetry: () => boolean = () => true,
  timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
  options?: RetryOptions
): Promise<T> {
  // Always respect user-configured active model; never auto-switch to paid models
  let currentModel = resolveTargetModel(options?.modelId);
  const startedAt = Date.now();
  const triedModels = new Set<string>();
  let notFoundFallbackQueue: string[] | null = null;
  let tempRetryCount = 0;

  while (true) {
    triedModels.add(currentModel);
    try {
      return await withTimeout(operation(currentModel), timeoutMs);
    } catch (err) {
      const normalized = normalizeGeminiError(err, currentModel);

      const withinRetryBudget =
        timeoutMs > DEFAULT_GEMINI_TIMEOUT_MS ||
        Date.now() - startedAt < MAX_TOTAL_RETRY_ELAPSED_MS;

      // On 404 NOT_FOUND (and before streaming output begins), switch cleanly to verified free-tier alternatives
      if (
        normalized.errorCode === 'not_found' &&
        options?.allowNotFoundFallback !== false &&
        withinRetryBudget &&
        shouldAllowRetry()
      ) {
        if (!notFoundFallbackQueue) {
          notFoundFallbackQueue = (
            await pickFreeFallbackCandidates(currentModel, options?.fallbackModels)
          ).filter((m) => !triedModels.has(m));
        }
        const nextModel = notFoundFallbackQueue.shift();
        if (nextModel) {
          currentModel = nextModel;
          continue;
        }
      }

      if (
        tempRetryCount < MAX_RETRY_ATTEMPTS &&
        withinRetryBudget &&
        isRetryableTemporaryError(normalized) &&
        shouldAllowRetry()
      ) {
        const attempt = tempRetryCount;
        tempRetryCount += 1;
        if (normalized.errorCode === 'rate_limit') {
          // If Gemini demands a long cooldown (>20s), avoid firing guaranteed-to-fail rapid retries
          if (normalized.retryAfterSec && normalized.retryAfterSec > 20) {
            throw normalized;
          }
          const expDelay = 1500 * Math.pow(2, attempt); // 1.5s, 3s, 6s
          const hintedMs = normalized.retryAfterSec ? normalized.retryAfterSec * 1000 : 0;
          const waitMs =
            Math.min(18000, Math.max(expDelay, hintedMs)) + Math.floor(Math.random() * 400);
          await sleep(waitMs);
        } else {
          // Exponential backoff for temporary 503 & transient network errors: ~1s, ~2s, ~4s
          const waitMs = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 350);
          await sleep(waitMs);
        }
        continue;
      }

      throw normalized;
    }
  }
}

// ============================================================
// API Quota Optimization: LRU Response Cache + In-Flight Coalescing
// ============================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 120;
const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function buildRequestKey(op: string, model: string, payload: unknown): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ op, model, payload }))
    .digest('hex');
  return `${op}:${model}:${hash}`;
}

function getCachedValue<T>(key: string): T | null {
  if (!getAppSettings().aiSettings.cacheEnabled) return null;
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  // Refresh LRU recency
  responseCache.delete(key);
  responseCache.set(key, hit);
  return hit.value as T;
}

function setCachedValue<T>(key: string, value: T): void {
  if (!getAppSettings().aiSettings.cacheEnabled) return;
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearResponseCache(): number {
  const count = responseCache.size;
  responseCache.clear();
  return count;
}

async function runCachedAndCoalesced<T>(
  op: string,
  payload: unknown,
  runner: () => Promise<T>,
  modelOverride?: string
): Promise<T> {
  const activeModel = resolveTargetModel(modelOverride);
  const key = buildRequestKey(op, activeModel, payload);

  const cached = getCachedValue<T>(key);
  if (cached) {
    return cached;
  }

  const existing = inFlightRequests.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const result = await runner();
      setCachedValue(key, result);
      return result;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

function getAiClient(timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiServiceError(
      'GEMINI_API_KEY সার্ভার এনভায়রনমেন্টে কনফিগার করা নেই। Vercel / সার্ভার Settings থেকে API কী সেট করুন।',
      503,
      false,
      'auth'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1beta',
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getThinkingConfigForSpeed(model: string) {
  if (model.startsWith('gemini-4-') || model.startsWith('gemini-3')) {
    return { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };
  }
  if (model.startsWith('gemini-2.5-pro')) {
    return { thinkingConfig: { thinkingBudget: 1024 } };
  }
  if (model.startsWith('gemini-2.5-flash')) {
    return { thinkingConfig: { thinkingBudget: 0 } };
  }
  return {};
}

function buildLanguageAndSpeedRules(languageCode?: ResponseLanguageCode): string {
  const code = normalizeLanguageCode(languageCode);
  let langRule: string;

  if (code === 'auto') {
    langRule =
      'LANGUAGE RULE: Automatically detect the language of the user input and write your entire response naturally in that exact detected language. If the input has no text (e.g. image only), respond in Bengali.';
  } else if (code === 'bn') {
    langRule =
      'CRITICAL LANGUAGE REQUIREMENT (STRICT BN MODE): The user selected Bengali (বাংলা / BN). You MUST write your ENTIRE response—all headings, explanations, step-by-step solutions, summaries, bullet points, and conclusions—in natural, fluent Bengali (বাংলা script). NEVER reply in English even if the user prompt, subject label, or earlier conversation messages are in English (keep only exact formulas, code, or quoted English grammar examples in English, and explain everything in Bengali). Only write primarily in English if the user explicitly asks you in this message to answer in English.';
  } else if (code === 'en') {
    langRule =
      'CRITICAL LANGUAGE REQUIREMENT (STRICT EN MODE): The user selected English (EN). You MUST write your ENTIRE response—all headings, explanations, step-by-step solutions, summaries, bullet points, and conclusions—in clear, natural English. NEVER reply in Bengali even if earlier conversation messages or prompt terms are in Bengali, unless the user explicitly asks you in this message to reply in Bengali.';
  } else {
    const opt = getLanguageOption(code);
    langRule = `CRITICAL LANGUAGE REQUIREMENT: You MUST write your entire response clearly and naturally in ${opt.englishName} (${opt.nativeName}), regardless of the language of prior messages, unless the user explicitly asks for another language in this message.`;
  }

  const speedAndBrevityRule =
    'STYLE & BREVITY RULE: Be fast, accurate, concise, and direct. Never start with unnecessary greetings, filler, or preambles. Jump straight to the answer.';

  return `${langRule}\n${speedAndBrevityRule}`;
}

function buildPromptLanguageFooter(languageCode?: ResponseLanguageCode): string {
  const code = normalizeLanguageCode(languageCode);
  if (code === 'bn') {
    return '[Selected Response Language: BN — Respond completely in natural Bengali (বাংলা), unless explicitly asked for English in this message.]';
  }
  if (code === 'en') {
    return '[Selected Response Language: EN — Respond completely in natural English, unless explicitly asked for Bengali in this message.]';
  }
  if (code === 'auto') {
    return '[Selected Response Language: Auto Detect — Match the user message language.]';
  }
  const opt = getLanguageOption(code);
  return `[Selected Response Language: ${opt.englishName} (${opt.nativeName})]`;
}

export async function streamEducationQuestion(
  params: {
    subject: string;
    level: string;
    question: string;
    imageBase64?: string;
    imageMimeType?: string;
    responseLanguage?: ResponseLanguageCode;
    modelId?: string;
  },
  onDelta: (chunkText: string) => void
): Promise<{ answer: string; modelUsed: string; cached?: boolean }> {
  const cachePayload = {
    subject: params.subject,
    level: params.level,
    question: params.question.trim(),
    imageHash: params.imageBase64
      ? crypto.createHash('sha256').update(params.imageBase64).digest('hex')
      : '',
    responseLanguage: normalizeLanguageCode(params.responseLanguage),
  };

  const activeModel = resolveTargetModel(params.modelId);
  const key = buildRequestKey('education', activeModel, cachePayload);
  const cached = getCachedValue<{ answer: string; modelUsed: string }>(key);
  if (cached) {
    onDelta(cached.answer);
    return { ...cached, cached: true };
  }

  // Coalesce identical concurrent requests even when called back-to-back
  const inFlight = inFlightRequests.get(key) as
    | Promise<{ answer: string; modelUsed: string }>
    | undefined;
  if (inFlight) {
    const shared = await inFlight;
    onDelta(shared.answer);
    return { ...shared, cached: true };
  }

  const ai = getAiClient();
  const systemInstruction =
    'You are Sathi AI Education Mode — an expert SSC / HSC & academic tutor covering Mathematics (algebra, geometry, trigonometry, calculus), Physics, Chemistry, Biology, ICT, Bengali Grammar & Literature, and English Grammar (tense, voice, narration, transformation, composition).\n' +
    buildLanguageAndSpeedRules(params.responseLanguage) +
    '\nFor math or science problems, always provide clear, numbered step-by-step explanations and highlight the final answer. For grammar questions, state the rule and give clear examples.';

  const promptText = `Subject: ${params.subject}\nLevel: ${params.level}\nQuestion: ${
    params.question || 'Solve and explain the question shown in the image step by step.'
  }\n\n${buildPromptLanguageFooter(params.responseLanguage)}`;

  const contents =
    params.imageBase64 && params.imageMimeType
      ? {
          parts: [
            {
              inlineData: {
                mimeType: params.imageMimeType,
                data: params.imageBase64,
              },
            },
            { text: promptText },
          ],
        }
      : promptText;

  let emittedAnyChunk = false;
  const runPromise = (async () => {
    try {
      const result = await withGeminiRetry(
        async (model) => {
          const stream = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction,
              ...getThinkingConfigForSpeed(model),
            },
          });

          let fullText = '';
          for await (const chunk of stream) {
            const piece = chunk.text;
            if (piece) {
              emittedAnyChunk = true;
              fullText += piece;
              onDelta(piece);
            }
          }

          const finalAnswer = fullText.trim();
          if (!finalAnswer) {
            throw new GeminiServiceError(
              'শিক্ষা AI থেকে উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
              502,
              true,
              'network'
            );
          }
          return { answer: finalAnswer, modelUsed: model };
        },
        () => !emittedAnyChunk,
        DEFAULT_GEMINI_TIMEOUT_MS,
        { modelId: activeModel }
      );
      setCachedValue(key, result);
      return result;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, runPromise);
  return runPromise;
}

export async function streamInternationalJobs(
  params: {
    country: string;
    category: string;
    skills: string;
    responseLanguage?: ResponseLanguageCode;
    modelId?: string;
  },
  onDelta: (chunkText: string) => void
): Promise<{
  answer: string;
  sources: { title: string; uri: string }[];
  modelUsed: string;
  cached?: boolean;
}> {
  const cachePayload = {
    country: params.country,
    category: params.category,
    skills: params.skills.trim(),
    responseLanguage: normalizeLanguageCode(params.responseLanguage),
  };

  const activeModel = resolveTargetModel(params.modelId);
  const key = buildRequestKey('jobs', activeModel, cachePayload);
  const cached = getCachedValue<{
    answer: string;
    sources: { title: string; uri: string }[];
    modelUsed: string;
  }>(key);
  if (cached) {
    onDelta(cached.answer);
    return { ...cached, cached: true };
  }

  const inFlight = inFlightRequests.get(key) as
    | Promise<{ answer: string; sources: { title: string; uri: string }[]; modelUsed: string }>
    | undefined;
  if (inFlight) {
    const shared = await inFlight;
    onDelta(shared.answer);
    return { ...shared, cached: true };
  }

  const ai = getAiClient();
  const systemInstruction =
    'You are Sathi AI International Jobs Advisor for migrant and skilled workers.\n' +
    buildLanguageAndSpeedRules(params.responseLanguage) +
    '\nProvide concise, accurate job overview, qualifications, official/legal application guidance (e.g., BMET / official portals where relevant), and a brief fraud-safety note. Never guarantee fake visas or unverified agencies.';

  const query = `Country: ${params.country}\nJob Category: ${params.category}\nSkills/Experience: ${
    params.skills || 'General skilled worker'
  }\nProvide current job outlook, qualifications, estimated salary range, and verified application steps.\n\n${buildPromptLanguageFooter(params.responseLanguage)}`;

  let emittedAnyChunk = false;
  const runPromise = (async () => {
    try {
      const result = await withGeminiRetry(
        async (model) => {
          const stream = await ai.models.generateContentStream({
            model,
            contents: query,
            config: {
              systemInstruction,
              tools: [{ googleSearch: {} }],
              ...getThinkingConfigForSpeed(model),
            },
          });

          let fullText = '';
          const sourcesMap = new Map<string, { title: string; uri: string }>();

          for await (const chunk of stream) {
            const piece = chunk.text;
            if (piece) {
              emittedAnyChunk = true;
              fullText += piece;
              onDelta(piece);
            }
            const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
            for (const gChunk of chunks) {
              if (gChunk.web?.uri) {
                sourcesMap.set(gChunk.web.uri, {
                  title: gChunk.web.title || gChunk.web.uri,
                  uri: gChunk.web.uri,
                });
              }
            }
          }

          const finalAnswer = fullText.trim();
          if (!finalAnswer) {
            throw new GeminiServiceError(
              'চাকরির তথ্য পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
              502,
              true,
              'network'
            );
          }

          return {
            answer: finalAnswer,
            sources: Array.from(sourcesMap.values()).slice(0, 6),
            modelUsed: model,
          };
        },
        () => !emittedAnyChunk,
        DEFAULT_GEMINI_TIMEOUT_MS,
        { modelId: activeModel }
      );
      setCachedValue(key, result);
      return result;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, runPromise);
  return runPromise;
}

export async function streamHealthGuidance(
  params: {
    mode: 'general' | 'symptom' | 'medicine';
    query: string;
    responseLanguage?: ResponseLanguageCode;
    modelId?: string;
  },
  onDelta: (chunkText: string) => void
): Promise<{ answer: string; isUrgent: boolean; modelUsed: string; cached?: boolean }> {
  const urgentKeywords = [
    'বুক ব্যথা',
    'বুকে ব্যথা',
    'শ্বাসকষ্ট',
    'অজ্ঞান',
    'রক্তপাত',
    'স্ট্রোক',
    'হার্ট অ্যাটাক',
    'chest pain',
    'shortness of breath',
    'difficulty breathing',
    'unconscious',
    'heavy bleeding',
    'stroke',
    'heart attack',
    'suicide',
    'poison',
    'বিষ',
  ];
  const lowered = params.query.toLowerCase();
  const isUrgent = urgentKeywords.some((k) => lowered.includes(k));

  const cachePayload = {
    mode: params.mode,
    query: params.query.trim(),
    responseLanguage: normalizeLanguageCode(params.responseLanguage),
  };

  const activeModel = resolveTargetModel(params.modelId);
  const key = buildRequestKey('health', activeModel, cachePayload);
  const cached = getCachedValue<{ answer: string; isUrgent: boolean; modelUsed: string }>(key);
  if (cached) {
    onDelta(cached.answer);
    return { ...cached, cached: true };
  }

  const inFlight = inFlightRequests.get(key) as
    | Promise<{ answer: string; isUrgent: boolean; modelUsed: string }>
    | undefined;
  if (inFlight) {
    const shared = await inFlight;
    onDelta(shared.answer);
    return { ...shared, cached: true };
  }

  const ai = getAiClient();
  const systemInstruction =
    'You are Sathi AI General Health Information Assistant.\n' +
    buildLanguageAndSpeedRules(params.responseLanguage) +
    '\nMEDICAL SAFETY RULES:\n' +
    '1. NEVER diagnose diseases or claim to know what illness the user has.\n' +
    '2. NEVER prescribe medications or replace a doctor.\n' +
    '3. Explain general health concepts, common symptoms, medical terms, or general medicine info with clear safety warnings concisely.\n' +
    '4. Briefly encourage consulting a qualified physician (MBBS/specialist).\n' +
    '5. If emergency symptoms appear (severe chest pain, breathing trouble, fainting, severe bleeding), advise immediate emergency hospital care.';

  const modeLabel =
    params.mode === 'medicine'
      ? 'General medicine info & safety warnings'
      : params.mode === 'symptom'
        ? 'Common symptom & medical term explanation'
        : 'General health & wellness info';

  let emittedAnyChunk = false;
  const runPromise = (async () => {
    try {
      const result = await withGeminiRetry(
        async (model) => {
          const stream = await ai.models.generateContentStream({
            model,
            contents: `Category: ${modeLabel}\nUser question: ${params.query}\n\n${buildPromptLanguageFooter(params.responseLanguage)}`,
            config: {
              systemInstruction,
              ...getThinkingConfigForSpeed(model),
            },
          });

          let fullText = '';
          for await (const chunk of stream) {
            const piece = chunk.text;
            if (piece) {
              emittedAnyChunk = true;
              fullText += piece;
              onDelta(piece);
            }
          }

          const finalAnswer = fullText.trim();
          if (!finalAnswer) {
            throw new GeminiServiceError(
              'স্বাস্থ্য তথ্য পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
              502,
              true,
              'network'
            );
          }

          return { answer: finalAnswer, isUrgent, modelUsed: model };
        },
        () => !emittedAnyChunk,
        DEFAULT_GEMINI_TIMEOUT_MS,
        { modelId: activeModel }
      );
      setCachedValue(key, result);
      return result;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, runPromise);
  return runPromise;
}

export async function generateSocialContent(params: {
  platform: 'Facebook' | 'TikTok' | 'YouTube';
  topic: string;
  tone: string;
  responseLanguage?: ResponseLanguageCode;
  modelId?: string;
}): Promise<SocialContentResult> {
  const payload = {
    platform: params.platform,
    topic: params.topic.trim(),
    tone: params.tone,
    responseLanguage: normalizeLanguageCode(params.responseLanguage),
  };

  return runCachedAndCoalesced(
    'social',
    payload,
    async () => {
      const ai = getAiClient();

      return withGeminiRetry(
        async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: `Platform: ${params.platform}\nTopic: ${params.topic}\nTone: ${params.tone}\nCreate 3 viral video ideas, catchy titles, a complete concise script (Hook, Body, CTA), post caption, hashtags, and an English AI Video Generation Prompt.\n\n${buildPromptLanguageFooter(params.responseLanguage)}`,
        config: {
          systemInstruction:
            'You are an expert Social Media Content Strategist.\n' +
            buildLanguageAndSpeedRules(params.responseLanguage) +
            '\nWrite ideas, titles, script, caption, and hashtags in the target response language, while keeping aiVideoPrompt in detailed cinematic English.',
          responseMimeType: 'application/json',
          ...getThinkingConfigForSpeed(model),
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              platform: { type: Type.STRING },
              ideas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    angle: { type: Type.STRING },
                  },
                },
              },
              titles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              script: {
                type: Type.OBJECT,
                properties: {
                  hook: { type: Type.STRING },
                  body: { type: Type.STRING },
                  cta: { type: Type.STRING },
                },
              },
              caption: { type: Type.STRING },
              hashtags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              aiVideoPrompt: { type: Type.STRING },
            },
          },
        },
      });

      const jsonStr = (response.text ?? '{}').trim();
      const parsed = JSON.parse(jsonStr) as SocialContentResult;
      return {
        ...parsed,
        platform: parsed.platform || params.platform,
      };
        },
        () => true,
        DEFAULT_GEMINI_TIMEOUT_MS,
        { modelId: params.modelId }
      );
    },
    params.modelId
  );
}

export async function generateVideoPromptAndStoryboard(params: {
  idea: string;
  mode: 'text-to-video' | 'image-to-video' | 'prompt-only';
  style: string;
  aspectRatio: string;
  responseLanguage?: ResponseLanguageCode;
  modelId?: string;
}): Promise<VideoPromptResult> {
  const payload = {
    idea: params.idea.trim(),
    mode: params.mode,
    style: params.style,
    aspectRatio: params.aspectRatio,
    responseLanguage: normalizeLanguageCode(params.responseLanguage),
  };

  return runCachedAndCoalesced(
    'video-prompt',
    payload,
    async () => {
      const ai = getAiClient();

      return withGeminiRetry(
        async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: `Video idea: ${params.idea}\nMode: ${params.mode}\nVisual style: ${params.style}\nAspect ratio: ${params.aspectRatio}\nGenerate a production English AI video prompt, negative prompt, concise notes, and a 4-scene storyboard.\n\n${buildPromptLanguageFooter(params.responseLanguage)}`,
        config: {
          systemInstruction:
            'You are a professional AI Video Director.\n' +
            buildLanguageAndSpeedRules(params.responseLanguage) +
            '\nKeep englishPrompt and negativePrompt in technical English for video models, and write titleBn, styleNotesBn, and storyboard visualBn/captionBn in the target response language.',
          responseMimeType: 'application/json',
          ...getThinkingConfigForSpeed(model),
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titleBn: { type: Type.STRING },
              englishPrompt: { type: Type.STRING },
              negativePrompt: { type: Type.STRING },
              styleNotesBn: { type: Type.STRING },
              aspectRatio: { type: Type.STRING },
              storyboard: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    durationSec: { type: Type.INTEGER },
                    visualBn: { type: Type.STRING },
                    cameraMovement: { type: Type.STRING },
                    captionBn: { type: Type.STRING },
                    accentHex: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const jsonStr = (response.text ?? '{}').trim();
      return JSON.parse(jsonStr) as VideoPromptResult;
        },
        () => true,
        DEFAULT_GEMINI_TIMEOUT_MS,
        { modelId: params.modelId }
      );
    },
    params.modelId
  );
}

export async function advisePhotoThumbnail(params: {
  topic: string;
  imageBase64?: string;
  imageMimeType?: string;
  responseLanguage?: ResponseLanguageCode;
  modelId?: string;
}): Promise<{
  headlineSuggestions: string[];
  subheadline: string;
  colorTipBn: string;
  enhancementTipBn: string;
}> {
  const payload = {
    topic: params.topic.trim(),
    imageHash: params.imageBase64
      ? crypto.createHash('sha256').update(params.imageBase64).digest('hex')
      : '',
    responseLanguage: normalizeLanguageCode(params.responseLanguage),
  };

  return runCachedAndCoalesced(
    'photo-advisor',
    payload,
    async () => {
      const ai = getAiClient();

    const promptText = `Thumbnail/Photo topic: ${
      params.topic || 'Engaging YouTube video thumbnail'
    }. Provide 3 short punchy headlines, 1 subheadline, color contrast advice, and photo enhancement advice.\n\n${buildPromptLanguageFooter(params.responseLanguage)}`;

    const contents =
      params.imageBase64 && params.imageMimeType
        ? {
            parts: [
              {
                inlineData: {
                  mimeType: params.imageMimeType,
                  data: params.imageBase64,
                },
              },
              { text: promptText },
            ],
          }
        : promptText;

    return withGeminiRetry(
      async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction:
            'You are a YouTube Thumbnail & Photo Editing Design Consultant.\n' +
            buildLanguageAndSpeedRules(params.responseLanguage),
          responseMimeType: 'application/json',
          ...getThinkingConfigForSpeed(model),
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headlineSuggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              subheadline: { type: Type.STRING },
              colorTipBn: { type: Type.STRING },
              enhancementTipBn: { type: Type.STRING },
            },
          },
        },
      });

      const jsonStr = (response.text ?? '{}').trim();
      return JSON.parse(jsonStr);
        },
        () => true,
        DEFAULT_GEMINI_TIMEOUT_MS,
        { modelId: params.modelId }
      );
    },
    params.modelId
  );
}

export async function streamAssistantChat(
  params: {
    history: { role: 'user' | 'assistant'; text: string }[];
    message: string;
    imageBase64?: string;
    imageMimeType?: string;
    responseLanguage?: ResponseLanguageCode;
    modelId?: string;
  },
  onDelta: (chunkText: string) => void
): Promise<{ answer: string; modelUsed: string; cached?: boolean }> {
  const recentHistory = (params.history || [])
    .slice(-10)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 1200) }));

  const cachePayload = {
    history: recentHistory,
    message: params.message.trim(),
    imageHash: params.imageBase64
      ? crypto.createHash('sha256').update(params.imageBase64).digest('hex')
      : '',
    responseLanguage: normalizeLanguageCode(params.responseLanguage),
  };

  const activeModel = resolveTargetModel(params.modelId);
  const key = buildRequestKey('assistant-chat', activeModel, cachePayload);
  const cached = getCachedValue<{ answer: string; modelUsed: string }>(key);
  if (cached) {
    onDelta(cached.answer);
    return { ...cached, cached: true };
  }

  const inFlight = inFlightRequests.get(key) as
    | Promise<{ answer: string; modelUsed: string }>
    | undefined;
  if (inFlight) {
    const shared = await inFlight;
    onDelta(shared.answer);
    return { ...shared, cached: true };
  }

  const ai = getAiClient();
  const systemInstruction =
    'You are Sathi AI (সাথী AI) in General Chat Mode — a ChatGPT-style versatile, creative, and helpful multilingual assistant for everything beyond textbooks: writing stories (গল্প), poems (কবিতা), professional CVs & resumes, cover letters, job interview/BCS/bank exam Q&A, essays, coding, business ideas, translations, image understanding, and any everyday question.\n' +
    buildLanguageAndSpeedRules(params.responseLanguage) +
    '\nWhen writing stories, poems, CVs, or job answers, format them cleanly and attractively. When an image is provided, analyze its contents accurately and answer clearly.';

  const contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  }> = recentHistory
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

  const currentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (params.imageBase64 && params.imageMimeType) {
    currentParts.push({
      inlineData: {
        mimeType: params.imageMimeType,
        data: params.imageBase64,
      },
    });
  }
  const userMsgText =
    params.message.trim() ||
    'Analyze this image clearly and explain what is shown or solve any question inside it.';
  currentParts.push({
    text: `${userMsgText}\n\n${buildPromptLanguageFooter(params.responseLanguage)}`,
  });
  contents.push({ role: 'user', parts: currentParts });

  let emittedAnyChunk = false;
  const runPromise = (async () => {
    try {
      const result = await withGeminiRetry(
        async (model) => {
          const stream = await ai.models.generateContentStream({
            model,
            contents,
            config: {
              systemInstruction,
              ...getThinkingConfigForSpeed(model),
            },
          });

          let fullText = '';
          for await (const chunk of stream) {
            const piece = chunk.text;
            if (piece) {
              emittedAnyChunk = true;
              fullText += piece;
              onDelta(piece);
            }
          }

          const finalAnswer = fullText.trim();
          if (!finalAnswer) {
            throw new GeminiServiceError(
              'এআই সহকারী থেকে উত্তর পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
              502,
              true,
              'network'
            );
          }

          return { answer: finalAnswer, modelUsed: model };
        },
        () => !emittedAnyChunk,
        DEFAULT_GEMINI_TIMEOUT_MS,
        { modelId: activeModel }
      );
      setCachedValue(key, result);
      return result;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, runPromise);
  return runPromise;
}

export async function transcribeVoiceAudio(params: {
  audioBase64: string;
  mimeType: string;
  responseLanguage?: ResponseLanguageCode;
}): Promise<{ text: string }> {
  const ai = getAiClient();
  const code = normalizeLanguageCode(params.responseLanguage);
  const hintLang =
    code === 'auto'
      ? 'any spoken language (such as Bengali, English, Hindi, Arabic, or Urdu)'
      : `${getLanguageOption(code).englishName} (${getLanguageOption(code).nativeName})`;

  return withGeminiRetry(
    async (model) => {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: params.mimeType || 'audio/webm',
                data: params.audioBase64,
              },
            },
            {
              text: `Transcribe the spoken words accurately in ${hintLang}. Output ONLY the exact transcribed text with proper punctuation, no explanations.`,
            },
          ],
        },
      });

      const text = (response.text ?? '').trim();
      if (!text) {
        throw new GeminiServiceError(
          'অডিও থেকে কথা স্পষ্টভাবে শনাক্ত করা যায়নি। অনুগ্রহ করে আবার বলুন।',
          422,
          false,
          'unknown'
        );
      }
      return { text };
    },
    () => true,
    DEFAULT_GEMINI_TIMEOUT_MS,
    {
      modelId: undefined,
      allowNotFoundFallback: true,
      fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.5-transcribe'],
    }
  );
}

export async function synthesizeSpeechAudio(params: {
  text: string;
  responseLanguage?: ResponseLanguageCode;
}): Promise<{ audioBase64: string; mimeType: 'audio/wav'; cached?: boolean }> {
  // Strip basic markdown symbols and cap length to save API quota
  const cleanedText = params.text
    .replace(/[*_`#>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);

  if (!cleanedText) {
    throw new GeminiServiceError('শোনার জন্য কোনো টেক্সট পাওয়া যায়নি।', 400, false, 'unknown');
  }

  const lang = normalizeLanguageCode(params.responseLanguage);
  const payload = { text: cleanedText, lang };
  const key = buildRequestKey('tts', 'gemini-3.8-flash-lite-tts', payload);
  const cached = getCachedValue<{ audioBase64: string; mimeType: 'audio/wav' }>(key);
  if (cached) {
    return { ...cached, cached: true };
  }

  const existing = inFlightRequests.get(key) as
    | Promise<{ audioBase64: string; mimeType: 'audio/wav' }>
    | undefined;
  if (existing) {
    return existing;
  }

  const ai = getAiClient();
  const runPromise = (async () => {
    try {
      const result = await withGeminiRetry(
        async (ttsModel) => {
          const response = await ai.models.generateContent({
            model: ttsModel,
            contents: [
              {
                role: 'user',
                parts: [{ text: cleanedText }],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
            },
          });

          const base64Audio =
            response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (!base64Audio) {
            throw new GeminiServiceError(
              'ভয়েস অডিও তৈরি করা যায়নি। ব্রাউজার স্পিচ দিয়ে শোনা যাবে।',
              502,
              true,
              'network'
            );
          }
          return { audioBase64: base64Audio, mimeType: 'audio/wav' as const };
        },
        () => true,
        DEFAULT_GEMINI_TIMEOUT_MS,
        {
          modelId: 'gemini-3.8-flash-lite-tts',
          allowNotFoundFallback: true,
          fallbackModels: ['gemini-2.5-flash-preview-tts'],
        }
      );
      setCachedValue(key, result);
      return result;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, runPromise);
  return runPromise;
}

export async function generateOrEditImage(params: {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  quality?: 'standard' | 'hd';
  imageBase64?: string;
  imageMimeType?: string;
  responseLanguage?: ResponseLanguageCode;
}): Promise<{
  imageDataUrl: string;
  description: string;
  modelUsed: string;
  cached?: boolean;
}> {
  const cleanPrompt = params.prompt.trim();
  if (!cleanPrompt && !params.imageBase64) {
    throw new GeminiServiceError(
      'অনুগ্রহ করে ছবির বর্ণনা লিখুন অথবা একটি রেফারেন্স ছবি আপলোড করুন। (Please describe the image to create or edit.)',
      400,
      false,
      'unknown'
    );
  }

  const allowedRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const;
  const aspectRatio = allowedRatios.includes(params.aspectRatio as (typeof allowedRatios)[number])
    ? (params.aspectRatio as (typeof allowedRatios)[number])
    : '1:1';

  const primaryImageModel =
    params.quality === 'hd' ? 'gemini-nano-banana-2.1' : 'gemini-2.5-flash-image';
  const langCode = normalizeLanguageCode(params.responseLanguage);
  const payload = {
    prompt: cleanPrompt,
    aspectRatio,
    modelId: primaryImageModel,
    responseLanguage: langCode,
    imageHash: params.imageBase64
      ? crypto.createHash('sha256').update(params.imageBase64).digest('hex')
      : '',
  };

  return runCachedAndCoalesced('image-generate', payload, async () => {
    const ai = getAiClient(55_000);
    const effectivePrompt =
      cleanPrompt ||
      'Enhance and stylize this image cleanly with vibrant lighting and crisp detail.';
    const langInstruction =
      langCode === 'bn'
        ? 'Write any accompanying image description in Bengali (বাংলা).'
        : langCode === 'en'
          ? 'Write any accompanying image description in English.'
          : '';

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (params.imageBase64 && params.imageMimeType) {
      parts.push({
        inlineData: {
          mimeType: params.imageMimeType,
          data: params.imageBase64,
        },
      });
    }
    parts.push({ text: langInstruction ? `${effectivePrompt}\n${langInstruction}` : effectivePrompt });

    return withGeminiRetry(
      async (modelToUse) => {
        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio,
              ...(modelToUse === 'gemini-nano-banana-2.1' ? { imageSize: '2K' } : {}),
            },
          },
        });

        let imageDataUrl = '';
        let description = '';
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
          } else if (part.text) {
            description = part.text.trim();
          }
        }

        if (!imageDataUrl) {
          throw new GeminiServiceError(
            'এই মুহূর্তে ছবি তৈরি করা যায়নি। অনুগ্রহ করে প্রম্পট একটু পরিবর্তন করে আবার চেষ্টা করুন।',
            502,
            true,
            'network'
          );
        }

        return {
          imageDataUrl,
          description,
          modelUsed: modelToUse,
        };
      },
      () => true,
      55_000,
      {
        modelId: primaryImageModel,
        allowNotFoundFallback: true,
        fallbackModels:
          params.quality === 'hd'
            ? ['gemini-2.5-flash-image', 'gemini-3.1-flash-lite-image']
            : ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image-preview'],
      }
    );
  });
}

export async function generateFlowAiVideo(params: {
  prompt: string;
  aspectRatio?: string;
  durationSec?: number;
  imageBase64?: string;
  imageMimeType?: string;
}): Promise<{
  videoDataUrl?: string;
  videoUri?: string;
  mimeType: string;
  modelUsed: string;
}> {
  const cleanPrompt = params.prompt.trim();
  if (!cleanPrompt) {
    throw new GeminiServiceError(
      'ভিডিও তৈরি করতে একটি দৃশ্য বা প্রম্পট লিখুন। (Please enter a video prompt.)',
      400,
      false,
      'unknown'
    );
  }

  const normalizedAspect =
    params.aspectRatio?.startsWith('9:16') ? '9:16' : '16:9';
  const durationStr = params.durationSec && params.durationSec >= 8 ? '10s' : '6s';
  const modelId = 'gemini-omni-1.2-flash';
  const ai = getAiClient(300_000);

  const inputPayload =
    params.imageBase64 && params.imageMimeType
      ? [
          {
            type: 'image' as const,
            mime_type: params.imageMimeType,
            data: params.imageBase64,
          },
          {
            type: 'text' as const,
            text: cleanPrompt,
          },
        ]
      : cleanPrompt;

  return withGeminiRetry(
    async () => {
      const interaction = await ai.interactions.create(
        {
          model: modelId,
          input: inputPayload,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: normalizedAspect,
            duration: durationStr,
            resolution: '720p',
          },
        },
        { timeout: 300_000 }
      );

      const anyInteraction = interaction as unknown as {
        output_video?: { data?: string; uri?: string; mime_type?: string };
        outputs?: Array<{ type?: string; data?: string; uri?: string; mime_type?: string }>;
      };

      const outputVideo =
        anyInteraction.output_video ||
        anyInteraction.outputs?.find((o) => o.type === 'video');

      if (outputVideo?.data) {
        const mimeType = outputVideo.mime_type || 'video/mp4';
        return {
          videoDataUrl: `data:${mimeType};base64,${outputVideo.data}`,
          mimeType,
          modelUsed: modelId,
        };
      }

      if (outputVideo?.uri) {
        return {
          videoUri: outputVideo.uri,
          mimeType: outputVideo.mime_type || 'video/mp4',
          modelUsed: modelId,
        };
      }

      throw new GeminiServiceError(
        'ভিডিও আউটপুট পাওয়া যায়নি। অনুগ্রহ করে প্রম্পট পরিবর্তন করে আবার চেষ্টা করুন।',
        502,
        true,
        'network'
      );
    },
    () => true,
    300_000,
    {
      modelId,
      allowNotFoundFallback: false,
    }
  );
}

export interface GeminiConnectionTestResult {
  ok: boolean;
  configured: boolean;
  apiVersion: 'v1beta';
  endpoint: string;
  requestedModel: string;
  modelUsed?: string;
  fallbackUsed: boolean;
  latencyMs: number;
  sampleReply?: string;
  discoveredModels: string[];
  error?: string;
  errorCode?: AiErrorCode;
}

export async function verifyGeminiConnection(
  requestedModel?: string,
  exactOnly = false
): Promise<GeminiConnectionTestResult> {
  const startedAt = Date.now();
  const targetModel = resolveTargetModel(requestedModel);
  const configured = Boolean(process.env.GEMINI_API_KEY);
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta';

  if (!configured) {
    return {
      ok: false,
      configured: false,
      apiVersion: 'v1beta',
      endpoint,
      requestedModel: targetModel,
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
      discoveredModels: [],
      error:
        'GEMINI_API_KEY সার্ভার এনভায়রনমেন্টে কনফিগার করা নেই। Vercel / সার্ভার Settings থেকে API কী সেট করুন।',
      errorCode: 'auth',
    };
  }

  const discoveredModels = await discoverSupportedModels(true);
  const ai = getAiClient(15_000);

  try {
    const result = await withGeminiRetry(
      async (modelToUse) => {
        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: 'Reply with exactly: OK',
          config: {
            ...getThinkingConfigForSpeed(modelToUse),
          },
        });
        const replyText = (response.text ?? '').trim();
        if (!replyText) {
          throw new GeminiServiceError(
            'Gemini API থেকে খালি উত্তর এসেছে।',
            502,
            true,
            'network'
          );
        }
        return {
          modelUsed: modelToUse,
          sampleReply: replyText.slice(0, 60),
        };
      },
      () => true,
      15_000,
      {
        modelId: targetModel,
        allowNotFoundFallback: !exactOnly,
      }
    );

    return {
      ok: true,
      configured: true,
      apiVersion: 'v1beta',
      endpoint,
      requestedModel: targetModel,
      modelUsed: result.modelUsed,
      fallbackUsed: result.modelUsed !== targetModel,
      latencyMs: Date.now() - startedAt,
      sampleReply: result.sampleReply,
      discoveredModels,
    };
  } catch (err) {
    const normalized = normalizeGeminiError(err, targetModel);
    return {
      ok: false,
      configured: true,
      apiVersion: 'v1beta',
      endpoint,
      requestedModel: targetModel,
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
      discoveredModels,
      error: normalized.message,
      errorCode: normalized.errorCode,
    };
  }
}


