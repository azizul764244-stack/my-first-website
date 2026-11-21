import express from 'express';
import dotenv from 'dotenv';
import {
  clearAdminSessionCookie,
  checkLoginRateLimit,
  getAdminSessionFromRequest,
  getClientIp,
  issueAdminSessionCookie,
  recordFailedLoginAttempt,
  requireAdmin,
  resetLoginRateLimit,
  verifyAdminCredentials,
  type AuthenticatedAdminRequest,
} from './adminAuth';
import {
  addHistoryItem,
  adminCreateUser,
  adminUpdateAppSettings,
  adminUpdatePlanConfig,
  adminUpdateUserPlan,
  adminUpdateUserQuota,
  adminUpdateUserStatus,
  appendConversationTurn,
  checkFeatureAvailable,
  checkQuotaAvailable,
  clearAllConversations,
  clearApiLogs,
  clearHistoryItems,
  consumeQuota,
  createConversation,
  deleteConversationById,
  deleteHistoryItem,
  getActiveAiModel,
  getAdminDashboardData,
  getAppSettings,
  getConversationById,
  getConversations,
  getFullState,
  isValidGeminiModelId,
  recordAdminLog,
  recordApiLog,
  rejectPaymentRequest,
  submitPaymentRequest,
  trackAdEvent,
  updateActiveAiModel,
  updateAdSystem,
  updateConversationMeta,
  updateProfile,
  updateQuotaLimits,
  verifyPaymentAndActivate,
} from './store';
import {
  advisePhotoThumbnail,
  clearResponseCache,
  discoverSupportedModels,
  generateFlowAiVideo,
  generateOrEditImage,
  generateSocialContent,
  generateVideoPromptAndStoryboard,
  normalizeGeminiError,
  streamAssistantChat,
  streamEducationQuestion,
  streamHealthGuidance,
  streamInternationalJobs,
  synthesizeSpeechAudio,
  transcribeVoiceAudio,
  verifyGeminiConnection,
} from './gemini';
import { normalizeLanguageCode } from '../src/constants/languages';
import type { PaymentMethod, ResponseLanguageCode, SubscriptionPlanId } from '../src/types';

dotenv.config();

export function createApiApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '15mb' }));

function logAiOutcome(params: {
  endpoint: string;
  tool: string;
  language: ResponseLanguageCode;
  startedAt: number;
  model?: string;
  cached?: boolean;
  err?: unknown;
}): void {
  const latencyMs = Date.now() - params.startedAt;
  const model = params.model || getActiveAiModel();
  if (!params.err) {
    recordApiLog({
      endpoint: params.endpoint,
      tool: params.tool,
      model,
      language: params.language,
      status: 'success',
      httpStatus: 200,
      latencyMs,
      cached: Boolean(params.cached),
    });
    return;
  }

  const normalized = normalizeGeminiError(params.err, model);
  const status =
    normalized.errorCode === 'rate_limit'
      ? 'rate_limit_429'
      : normalized.errorCode === 'quota_exhausted'
        ? 'quota_429'
        : 'error';

  recordApiLog({
    endpoint: params.endpoint,
    tool: params.tool,
    model,
    language: params.language,
    status,
    httpStatus: normalized.status,
    latencyMs,
    cached: false,
    errorCode: normalized.errorCode,
    errorMessage: normalized.message,
  });
}

function sendAccessDeniedOrQuota(
  res: express.Response,
  check: ReturnType<typeof checkQuotaAvailable>,
  endpoint: string,
  tool: string,
  language: ResponseLanguageCode
): void {
  const httpStatus = check.status ?? 429;
  const errorCode = check.errorCode ?? 'quota_exhausted';
  recordApiLog({
    endpoint,
    tool,
    model: getActiveAiModel(),
    language,
    status: errorCode === 'quota_exhausted' ? 'quota_429' : 'error',
    httpStatus,
    latencyMs: 1,
    cached: false,
    errorCode,
    errorMessage: check.message,
  });
  res.status(httpStatus).json({
    error: check.message,
    errorCode,
    quota: check.quota,
    retryable: false,
  });
}

function sendAiError(res: express.Response, err: unknown, attemptedModel?: string): void {
  const normalized = normalizeGeminiError(err, attemptedModel);
  res.status(normalized.status).json({
    error: normalized.message,
    errorCode: normalized.errorCode,
    retryable: normalized.retryable,
    retryAfterSec: normalized.retryAfterSec,
  });
}

function initSse(res: express.Response): (payload: unknown) => void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  return (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
}

function resolveRequestedLanguage(bodyLang: unknown): ResponseLanguageCode {
  if (typeof bodyLang === 'string' && bodyLang.trim()) {
    return normalizeLanguageCode(bodyLang);
  }
  return getFullState().user.preferredLanguage;
}

function resolveRequestedModel(bodyModelId: unknown): string {
  const settings = getAppSettings();
  if (
    settings.aiSettings.allowUserModelSwitch &&
    typeof bodyModelId === 'string' &&
    isValidGeminiModelId(bodyModelId.trim())
  ) {
    return bodyModelId.trim();
  }
  return getActiveAiModel();
}

// ============================================================
// Public Application State & Language Routes
// ============================================================

app.get('/api/state', (_req, res) => {
  res.json(getFullState());
});

app.get('/api/gemini/health', async (_req, res) => {
  const discoveredModels = await discoverSupportedModels(false);
  res.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
    apiVersion: 'v1beta',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    activeModel: getActiveAiModel(),
    discoveredModels,
  });
});

app.post('/api/gemini/test', async (req, res) => {
  const { modelId, exactOnly } = req.body ?? {};
  const adminSession = getAdminSessionFromRequest(req);
  const targetModel =
    adminSession.authenticated && typeof modelId === 'string' && isValidGeminiModelId(modelId.trim())
      ? modelId.trim()
      : resolveRequestedModel(modelId);
  const result = await verifyGeminiConnection(targetModel, Boolean(exactOnly));
  res.status(result.ok ? 200 : result.configured ? 502 : 503).json(result);
});

app.post('/api/language', (req, res) => {
  const rawLang = req.body?.language ?? req.body?.preferredLanguage;
  const lang = normalizeLanguageCode(typeof rawLang === 'string' ? rawLang : undefined);
  const user = updateProfile({ preferredLanguage: lang });
  res.json({ user, state: getFullState() });
});

// ============================================================
// Hidden Admin Authentication Routes (Server-Side Authoritative)
// ============================================================

app.get('/api/auth/session', (req, res) => {
  res.json(getAdminSessionFromRequest(req));
});

app.post('/api/auth/admin-login', (req, res) => {
  const ip = getClientIp(req);
  const rateCheck = checkLoginRateLimit(ip);
  if (!rateCheck.allowed) {
    res.status(429).json({
      error: `অতিরিক্ত ভুল চেষ্টার কারণে লগইন সাময়িকভাবে সীমাবদ্ধ করা হয়েছে। অনুগ্রহ করে ${rateCheck.retryAfterSec} সেকেন্ড পর চেষ্টা করুন।`,
      retryAfterSec: rateCheck.retryAfterSec,
    });
    return;
  }

  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const verification = verifyAdminCredentials(email, password);

  if (!verification.ok || !verification.email) {
    recordFailedLoginAttempt(ip);
    recordAdminLog(
      'admin_login_failed',
      `অবৈধ অ্যাডমিন লগইন প্রচেষ্টা (${email.trim().slice(0, 60) || 'অজানা ইমেইল'})`,
      email.trim() || 'anonymous',
      ip
    );
    res.status(401).json({
      error: verification.reason || 'অ্যাডমিন অনুমোদন ব্যর্থ হয়েছে।',
    });
    return;
  }

  resetLoginRateLimit(ip);
  const token = issueAdminSessionCookie(req, res, verification.email);
  recordAdminLog('admin_login', 'অ্যাডমিন প্যানেলে সফলভাবে লগইন করেছেন', verification.email, ip);
  res.json({
    session: {
      authenticated: true,
      role: 'admin',
      email: verification.email,
      configured: true,
      missingVars: [],
    },
    token,
  });
});

app.post('/api/auth/admin-logout', (req, res) => {
  const existing = getAdminSessionFromRequest(req);
  const ip = getClientIp(req);
  if (existing.authenticated && existing.email) {
    recordAdminLog('admin_logout', 'অ্যাডমিন প্যানেল থেকে লগআউট করেছেন', existing.email, ip);
  }
  clearAdminSessionCookie(req, res);
  res.json({ ok: true });
});

// ============================================================
// AI Feature Routes (Guarded by Maintenance, Account Status & Quota + Real API Logs)
// ============================================================

// 1. Education AI
app.post('/api/ai/education', async (req, res) => {
  const startedAt = Date.now();
  const { subject, level, question, imageBase64, imageMimeType, responseLanguage, modelId, stream } = req.body ?? {};
  const settings = getAppSettings();
  const wantsStream =
    settings.aiSettings.streamEnabled &&
    (Boolean(stream) || req.headers.accept?.includes('text/event-stream'));

  if (!question && !imageBase64) {
    res.status(400).json({ error: 'অনুগ্রহ করে একটি প্রশ্ন লিখুন বা ছবি আপলোড করুন।' });
    return;
  }

  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);
  const quotaCheck = checkFeatureAvailable('educationEnabled');
  if (!quotaCheck.ok) {
    sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/education', 'education', lang);
    return;
  }

  if (wantsStream) {
    const writeSse = initSse(res);
    try {
      const result = await streamEducationQuestion(
        {
          subject: subject || 'সাধারণ',
          level: level || 'এসএসসি / এইচএসসি',
          question: question || '',
          imageBase64,
          imageMimeType,
          responseLanguage: lang,
          modelId: requestedModel,
        },
        (text) => writeSse({ type: 'delta', text })
      );

      const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
      const historyItem = addHistoryItem({
        tool: 'education',
        toolLabelBn: 'শিক্ষা AI',
        title: `${subject || 'শিক্ষা'}: ${(question || 'ছবি থেকে প্রশ্ন সমাধান').slice(0, 56)}`,
        prompt: question || 'ছবি আপলোড করে প্রশ্ন সমাধান',
        response: result.answer,
      });

      logAiOutcome({
        endpoint: '/api/ai/education',
        tool: 'education',
        language: lang,
        startedAt,
        model: result.modelUsed,
        cached: result.cached,
      });

      writeSse({
        type: 'done',
        answer: result.answer,
        modelUsed: result.modelUsed,
        historyItem,
        quota: updatedQuota,
      });
      res.end();
    } catch (err) {
      logAiOutcome({ endpoint: '/api/ai/education', tool: 'education', language: lang, startedAt, model: requestedModel, err });
      const normalized = normalizeGeminiError(err, requestedModel);
      writeSse({
        type: 'error',
        error: normalized.message,
        errorCode: normalized.errorCode,
        retryable: normalized.retryable,
        retryAfterSec: normalized.retryAfterSec,
      });
      res.end();
    }
    return;
  }

  try {
    const result = await streamEducationQuestion(
      {
        subject: subject || 'সাধারণ',
        level: level || 'এসএসসি / এইচএসসি',
        question: question || '',
        imageBase64,
        imageMimeType,
        responseLanguage: lang,
        modelId: requestedModel,
      },
      () => {}
    );
    const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
    const historyItem = addHistoryItem({
      tool: 'education',
      toolLabelBn: 'শিক্ষা AI',
      title: `${subject || 'শিক্ষা'}: ${(question || 'ছবি থেকে প্রশ্ন সমাধান').slice(0, 56)}`,
      prompt: question || 'ছবি আপলোড করে প্রশ্ন সমাধান',
      response: result.answer,
    });
    logAiOutcome({
      endpoint: '/api/ai/education',
      tool: 'education',
      language: lang,
      startedAt,
      model: result.modelUsed,
      cached: result.cached,
    });
    res.json({
      answer: result.answer,
      modelUsed: result.modelUsed,
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/education', tool: 'education', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

// 2. International Jobs (Google Search Grounded + SSE streaming)
app.post('/api/ai/jobs', async (req, res) => {
  const startedAt = Date.now();
  const { country, category, skills, responseLanguage, modelId, stream } = req.body ?? {};
  const settings = getAppSettings();
  const wantsStream =
    settings.aiSettings.streamEnabled &&
    (Boolean(stream) || req.headers.accept?.includes('text/event-stream'));

  if (!country || !category) {
    res.status(400).json({ error: 'অনুগ্রহ করে দেশ এবং কাজের ধরন নির্বাচন করুন।' });
    return;
  }

  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);
  const quotaCheck = checkQuotaAvailable();
  if (!quotaCheck.ok) {
    sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/jobs', 'jobs', lang);
    return;
  }

  if (wantsStream) {
    const writeSse = initSse(res);
    try {
      const result = await streamInternationalJobs(
        {
          country,
          category,
          skills: skills || '',
          responseLanguage: lang,
          modelId: requestedModel,
        },
        (text) => writeSse({ type: 'delta', text })
      );

      const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
      const historyItem = addHistoryItem({
        tool: 'jobs',
        toolLabelBn: 'বিদেশে চাকরি',
        title: `${country} — ${category}`,
        prompt: `${country} | ${category}${skills ? ` | ${skills}` : ''}`,
        response: result.answer,
        sources: result.sources,
      });

      logAiOutcome({
        endpoint: '/api/ai/jobs',
        tool: 'jobs',
        language: lang,
        startedAt,
        model: result.modelUsed,
        cached: result.cached,
      });

      writeSse({
        type: 'done',
        answer: result.answer,
        sources: result.sources,
        modelUsed: result.modelUsed,
        historyItem,
        quota: updatedQuota,
      });
      res.end();
    } catch (err) {
      logAiOutcome({ endpoint: '/api/ai/jobs', tool: 'jobs', language: lang, startedAt, model: requestedModel, err });
      const normalized = normalizeGeminiError(err, requestedModel);
      writeSse({
        type: 'error',
        error: normalized.message,
        errorCode: normalized.errorCode,
        retryable: normalized.retryable,
        retryAfterSec: normalized.retryAfterSec,
      });
      res.end();
    }
    return;
  }

  try {
    const result = await streamInternationalJobs(
      {
        country,
        category,
        skills: skills || '',
        responseLanguage: lang,
        modelId: requestedModel,
      },
      () => {}
    );
    const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
    const historyItem = addHistoryItem({
      tool: 'jobs',
      toolLabelBn: 'বিদেশে চাকরি',
      title: `${country} — ${category}`,
      prompt: `${country} | ${category}${skills ? ` | ${skills}` : ''}`,
      response: result.answer,
      sources: result.sources,
    });
    logAiOutcome({
      endpoint: '/api/ai/jobs',
      tool: 'jobs',
      language: lang,
      startedAt,
      model: result.modelUsed,
      cached: result.cached,
    });
    res.json({
      answer: result.answer,
      sources: result.sources,
      modelUsed: result.modelUsed,
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/jobs', tool: 'jobs', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

// 3. Health Assistant
app.post('/api/ai/health', async (req, res) => {
  const startedAt = Date.now();
  const { mode, query, responseLanguage, modelId, stream } = req.body ?? {};
  const settings = getAppSettings();
  const wantsStream =
    settings.aiSettings.streamEnabled &&
    (Boolean(stream) || req.headers.accept?.includes('text/event-stream'));

  if (!query || !String(query).trim()) {
    res.status(400).json({ error: 'অনুগ্রহ করে আপনার স্বাস্থ্য বিষয়ক প্রশ্নটি লিখুন।' });
    return;
  }

  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);
  const quotaCheck = checkQuotaAvailable();
  if (!quotaCheck.ok) {
    sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/health', 'health', lang);
    return;
  }

  if (wantsStream) {
    const writeSse = initSse(res);
    try {
      const result = await streamHealthGuidance(
        {
          mode: mode || 'general',
          query: String(query),
          responseLanguage: lang,
          modelId: requestedModel,
        },
        (text) => writeSse({ type: 'delta', text })
      );

      const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
      const historyItem = addHistoryItem({
        tool: 'health',
        toolLabelBn: 'স্বাস্থ্য সহকারী',
        title: String(query).slice(0, 60),
        prompt: String(query),
        response: result.answer,
      });

      logAiOutcome({
        endpoint: '/api/ai/health',
        tool: 'health',
        language: lang,
        startedAt,
        model: result.modelUsed,
        cached: result.cached,
      });

      writeSse({
        type: 'done',
        answer: result.answer,
        isUrgent: result.isUrgent,
        modelUsed: result.modelUsed,
        historyItem,
        quota: updatedQuota,
      });
      res.end();
    } catch (err) {
      logAiOutcome({ endpoint: '/api/ai/health', tool: 'health', language: lang, startedAt, model: requestedModel, err });
      const normalized = normalizeGeminiError(err, requestedModel);
      writeSse({
        type: 'error',
        error: normalized.message,
        errorCode: normalized.errorCode,
        retryable: normalized.retryable,
        retryAfterSec: normalized.retryAfterSec,
      });
      res.end();
    }
    return;
  }

  try {
    const result = await streamHealthGuidance(
      {
        mode: mode || 'general',
        query: String(query),
        responseLanguage: lang,
        modelId: requestedModel,
      },
      () => {}
    );
    const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
    const historyItem = addHistoryItem({
      tool: 'health',
      toolLabelBn: 'স্বাস্থ্য সহকারী',
      title: String(query).slice(0, 60),
      prompt: String(query),
      response: result.answer,
    });
    logAiOutcome({
      endpoint: '/api/ai/health',
      tool: 'health',
      language: lang,
      startedAt,
      model: result.modelUsed,
      cached: result.cached,
    });
    res.json({
      answer: result.answer,
      isUrgent: result.isUrgent,
      modelUsed: result.modelUsed,
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/health', tool: 'health', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

// 4. Social Media AI
app.post('/api/ai/social', async (req, res) => {
  const startedAt = Date.now();
  const { platform, topic, tone, responseLanguage, modelId } = req.body ?? {};
  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);

  try {
    if (!topic || !String(topic).trim()) {
      res.status(400).json({ error: 'অনুগ্রহ করে ভিডিও বা পোস্টের বিষয় লিখুন।' });
      return;
    }

    const quotaCheck = checkQuotaAvailable();
    if (!quotaCheck.ok) {
      sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/social', 'social', lang);
      return;
    }

    const result = await generateSocialContent({
      platform: platform || 'YouTube',
      topic: String(topic),
      tone: tone || 'তথ্যবহুল ও আকর্ষণীয়',
      responseLanguage: lang,
      modelId: requestedModel,
    });

    const updatedQuota = consumeQuota();

    const formattedResponse =
      lang === 'en'
        ? `### ${result.platform} Content Package\n\n` +
          `**Title:** ${result.titles?.[0] || ''}\n\n` +
          `**Script (Hook):** ${result.script?.hook || ''}\n\n` +
          `**Script (Body):** ${result.script?.body || ''}\n\n` +
          `**Caption:** ${result.caption || ''}\n\n` +
          `**Hashtags:** ${(result.hashtags || []).join(' ')}\n\n` +
          `**AI Video Prompt:** \`${result.aiVideoPrompt || ''}\``
        : `### ${result.platform} কনটেন্ট প্যাকেজ\n\n` +
          `**শিরোনাম:** ${result.titles?.[0] || ''}\n\n` +
          `**স্ক্রিপ্ট (Hook):** ${result.script?.hook || ''}\n\n` +
          `**স্ক্রিপ্ট (মূল অংশ):** ${result.script?.body || ''}\n\n` +
          `**ক্যাপশন:** ${result.caption || ''}\n\n` +
          `**হ্যাশট্যাগ:** ${(result.hashtags || []).join(' ')}\n\n` +
          `**AI ভিডিও প্রম্পট:** \`${result.aiVideoPrompt || ''}\``;

    const historyItem = addHistoryItem({
      tool: 'social',
      toolLabelBn: 'সোশ্যাল মিডিয়া AI',
      title: `${result.platform}: ${String(topic).slice(0, 48)}`,
      prompt: String(topic),
      response: formattedResponse,
    });

    logAiOutcome({
      endpoint: '/api/ai/social',
      tool: 'social',
      language: lang,
      startedAt,
      model: requestedModel,
    });

    res.json({
      result,
      modelUsed: requestedModel,
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/social', tool: 'social', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

// 5. Video Prompt & Storyboard + Video API Adapter
app.post('/api/ai/video-prompt', async (req, res) => {
  const startedAt = Date.now();
  const { idea, mode, style, aspectRatio, responseLanguage, modelId } = req.body ?? {};
  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);

  try {
    if (!idea || !String(idea).trim()) {
      res.status(400).json({ error: 'অনুগ্রহ করে ভিডিওর দৃশ্য বা ধারণা লিখুন।' });
      return;
    }

    const quotaCheck = checkFeatureAvailable('videoGenerationEnabled');
    if (!quotaCheck.ok) {
      sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/video-prompt', 'video', lang);
      return;
    }

    const result = await generateVideoPromptAndStoryboard({
      idea: String(idea),
      mode: mode || 'text-to-video',
      style: style || 'সিনেম্যাটিক ডকুমেন্টারি',
      aspectRatio: aspectRatio || '16:9',
      responseLanguage: lang,
      modelId: requestedModel,
    });

    const updatedQuota = consumeQuota();

    const historyItem = addHistoryItem({
      tool: 'video',
      toolLabelBn: 'ভিডিও স্টুডিও',
      title: result.titleBn || String(idea).slice(0, 56),
      prompt: String(idea),
      response: `**ইংরেজি প্রম্পট:**\n${result.englishPrompt}\n\n**নেগেটিভ প্রম্পট:** ${result.negativePrompt}\n\n**স্টাইল নোট:** ${result.styleNotesBn}`,
    });

    logAiOutcome({
      endpoint: '/api/ai/video-prompt',
      tool: 'video',
      language: lang,
      startedAt,
      model: requestedModel,
    });

    res.json({
      result,
      modelUsed: requestedModel,
      apiConnected: Boolean(process.env.GEMINI_API_KEY || process.env.VIDEO_API_KEY),
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/video-prompt', tool: 'video', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

app.post('/api/video/generate', async (req, res) => {
  const startedAt = Date.now();
  const {
    idea,
    mode,
    style,
    aspectRatio,
    durationSec,
    duration,
    imageBase64,
    imageMimeType,
    responseLanguage,
    modelId,
  } = req.body ?? {};
  const resolvedDurationSec =
    typeof durationSec === 'number'
      ? durationSec
      : duration !== undefined
        ? Number(duration)
        : 6;
  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);

  try {
    if (!idea || !String(idea).trim()) {
      res.status(400).json({ error: 'ভিডিও তৈরি করতে একটি প্রম্পট বা ধারণা লিখুন।' });
      return;
    }

    const quotaCheck = checkFeatureAvailable('videoGenerationEnabled');
    if (!quotaCheck.ok) {
      sendAccessDeniedOrQuota(res, quotaCheck, '/api/video/generate', 'video', lang);
      return;
    }

    // Storyboard-only mode explicitly uses storyboard generator
    if (mode === 'storyboard') {
      const result = await generateVideoPromptAndStoryboard({
        idea: String(idea),
        mode: 'text-to-video',
        style: style || 'সিনেম্যাটিক ডকুমেন্টারি',
        aspectRatio: aspectRatio || '16:9',
        responseLanguage: lang,
        modelId: requestedModel,
      });
      const updatedQuota = consumeQuota();
      logAiOutcome({
        endpoint: '/api/video/generate',
        tool: 'video',
        language: lang,
        startedAt,
        model: requestedModel,
      });
      res.json({
        mode: 'storyboard',
        modelUsed: requestedModel,
        apiConnected: Boolean(process.env.GEMINI_API_KEY),
        result,
        quota: updatedQuota,
      });
      return;
    }

    // Live Flow AI short video generation via Gemini Omni
    const videoPrompt = style
      ? `${String(idea).trim()}. Visual style: ${String(style).trim()}.`
      : String(idea).trim();

    const generated = await generateFlowAiVideo({
      prompt: videoPrompt,
      aspectRatio: aspectRatio || '16:9',
      durationSec: Number.isFinite(resolvedDurationSec) ? resolvedDurationSec : 6,
      imageBase64: typeof imageBase64 === 'string' ? imageBase64 : undefined,
      imageMimeType: typeof imageMimeType === 'string' ? imageMimeType : undefined,
    });

    const updatedQuota = consumeQuota();
    const historyItem = addHistoryItem({
      tool: 'video',
      toolLabelBn: 'ভিডিও স্টুডিও (Flow AI)',
      title: String(idea).trim().slice(0, 56),
      prompt: String(idea).trim(),
      response: `Flow AI (${generated.modelUsed}) ভিডিও তৈরি সম্পন্ন হয়েছে (${aspectRatio || '16:9'})।`,
    });

    logAiOutcome({
      endpoint: '/api/video/generate',
      tool: 'video',
      language: lang,
      startedAt,
      model: generated.modelUsed,
    });

    res.json({
      mode: 'live',
      apiConnected: true,
      videoDataUrl: generated.videoDataUrl,
      videoUri: generated.videoUri,
      mimeType: generated.mimeType,
      modelUsed: generated.modelUsed,
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({
      endpoint: '/api/video/generate',
      tool: 'video',
      language: lang,
      startedAt,
      model: 'gemini-omni-1.2-flash',
      err,
    });
    sendAiError(res, err);
  }
});

// 5b. AI Image Generation & Editing (ChatGPT-style text/image-to-image)
app.post('/api/ai/image-generate', async (req, res) => {
  const startedAt = Date.now();
  const {
    prompt,
    aspectRatio,
    quality,
    imageBase64,
    imageMimeType,
    referenceImageBase64,
    referenceMimeType,
    responseLanguage,
  } = req.body ?? {};
  const lang = resolveRequestedLanguage(responseLanguage);
  const resolvedQuality = quality === 'hd' || quality === 'high' ? 'hd' : 'standard';
  const resolvedImageBase64 =
    typeof imageBase64 === 'string'
      ? imageBase64
      : typeof referenceImageBase64 === 'string'
        ? referenceImageBase64
        : undefined;
  const resolvedImageMime =
    typeof imageMimeType === 'string'
      ? imageMimeType
      : typeof referenceMimeType === 'string'
        ? referenceMimeType
        : undefined;

  try {
    const quotaCheck = checkFeatureAvailable('imageGenerationEnabled');
    if (!quotaCheck.ok) {
      sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/image-generate', 'photo', lang);
      return;
    }

    const generated = await generateOrEditImage({
      prompt: typeof prompt === 'string' ? prompt : '',
      aspectRatio,
      quality: resolvedQuality,
      imageBase64: resolvedImageBase64,
      imageMimeType: resolvedImageMime,
      responseLanguage: lang,
    });

    const updatedQuota = generated.cached ? getFullState().quota : consumeQuota();
    const historyItem = addHistoryItem({
      tool: 'photo',
      toolLabelBn: 'AI ইমেজ স্টুডিও',
      title: (typeof prompt === 'string' && prompt.trim() ? prompt.trim() : 'AI ইমেজ এডিট').slice(0, 56),
      prompt: typeof prompt === 'string' ? prompt : 'ইমেজ এডিট',
      response: generated.description || `ছবি তৈরি সম্পন্ন হয়েছে (${generated.modelUsed})।`,
    });

    logAiOutcome({
      endpoint: '/api/ai/image-generate',
      tool: 'photo',
      language: lang,
      startedAt,
      model: generated.modelUsed,
      cached: generated.cached,
    });

    res.json({
      imageDataUrl: generated.imageDataUrl,
      description: generated.description,
      descriptionText: generated.description,
      modelUsed: generated.modelUsed,
      cached: Boolean(generated.cached),
      historyItem,
      quota: updatedQuota,
    });
  } catch (err) {
    const imgModel = quality === 'hd' ? 'gemini-nano-banana-2.1' : 'gemini-2.5-flash-image';
    logAiOutcome({
      endpoint: '/api/ai/image-generate',
      tool: 'photo',
      language: lang,
      startedAt,
      model: imgModel,
      err,
    });
    sendAiError(res, err, imgModel);
  }
});

// 6. AI Photo & Thumbnail Advisor
app.post('/api/ai/photo-advisor', async (req, res) => {
  const startedAt = Date.now();
  const { topic, imageBase64, imageMimeType, responseLanguage, modelId } = req.body ?? {};
  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);

  try {
    const quotaCheck = checkQuotaAvailable();
    if (!quotaCheck.ok) {
      sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/photo-advisor', 'photo', lang);
      return;
    }

    const advice = await advisePhotoThumbnail({
      topic: topic || 'বাংলা টেক ও এডুকেশন ইউটিউব ভিডিও',
      imageBase64,
      imageMimeType,
      responseLanguage: lang,
      modelId: requestedModel,
    });

    const updatedQuota = consumeQuota();
    logAiOutcome({
      endpoint: '/api/ai/photo-advisor',
      tool: 'photo',
      language: lang,
      startedAt,
      model: requestedModel,
    });

    res.json({
      advice,
      modelUsed: requestedModel,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/photo-advisor', tool: 'photo', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

// ============================================================
// Subscriptions, Payments, User Profile & Model Switch
// ============================================================

app.post('/api/subscription/submit-payment', (req, res) => {
  const { planId, method, senderNumber, transactionId } = req.body ?? {};
  if (planId !== '1_month' && planId !== '3_months') {
    res.status(400).json({ error: 'সঠিক সাবস্ক্রিপশন প্ল্যান নির্বাচন করুন।' });
    return;
  }

  const paymentCfg = getAppSettings().paymentConfig;
  const normalizedMethod = String(method || '') as PaymentMethod;
  const methodAllowed =
    (normalizedMethod === 'bKash' && paymentCfg.bkashEnabled) ||
    (normalizedMethod === 'Nagad' && paymentCfg.nagadEnabled) ||
    (normalizedMethod === 'Rocket' && paymentCfg.rocketEnabled) ||
    (normalizedMethod === 'Card' && paymentCfg.cardEnabled);

  if (!methodAllowed) {
    res.status(400).json({
      error: 'নির্বাচিত পেমেন্ট মাধ্যমটি বর্তমানে সক্রিয় নয়। অনুগ্রহ করে সক্রিয় বিকাশ বা নগদ ব্যবহার করুন।',
    });
    return;
  }

  if (!senderNumber || String(senderNumber).trim().length < 6) {
    res.status(400).json({ error: 'সঠিক পেমেন্ট নম্বর বা অ্যাকাউন্ট তথ্য দিন।' });
    return;
  }
  if (!transactionId || String(transactionId).trim().length < 5) {
    res.status(400).json({ error: 'বৈধ ট্রানজেকশন আইডি (TrxID) প্রদান করুন।' });
    return;
  }

  const payment = submitPaymentRequest({
    planId,
    method: normalizedMethod,
    senderNumber: String(senderNumber),
    transactionId: String(transactionId),
  });

  res.json({
    payment,
    state: getFullState(),
    message:
      'আপনার পেমেন্ট তথ্য জমা হয়েছে। অ্যাডমিন যাচাই না করা পর্যন্ত পেইড সাবস্ক্রিপশন সক্রিয় হবে না।',
  });
});

app.post('/api/ads/track', (req, res) => {
  const event = req.body?.event;
  if (
    event === 'banner_impression' ||
    event === 'interstitial_impression' ||
    event === 'click'
  ) {
    const stats = trackAdEvent(event);
    res.json({ stats });
    return;
  }
  res.status(400).json({ error: 'Invalid ad event' });
});

// User manual model switch (if permitted in App Settings)
app.post('/api/model', (req, res) => {
  const settings = getAppSettings();
  const adminSession = getAdminSessionFromRequest(req);
  if (!settings.aiSettings.allowUserModelSwitch && !adminSession.authenticated) {
    res.status(403).json({
      error: 'অ্যাডমিন কর্তৃক মডেল পরিবর্তন লক করা আছে।',
    });
    return;
  }
  const { modelId } = req.body ?? {};
  const updated = updateActiveAiModel(String(modelId || ''));
  if (!updated) {
    res.status(400).json({ error: 'অকার্যকর বা অসমর্থিত এআই মডেল নির্বাচিত হয়েছে।' });
    return;
  }
  res.json({ modelId: updated, state: getFullState() });
});

app.post('/api/profile', (req, res) => {
  const user = updateProfile(req.body ?? {});
  res.json({ user, state: getFullState() });
});

app.delete('/api/history/:id', (req, res) => {
  const history = deleteHistoryItem(req.params.id);
  res.json({ history });
});

app.post('/api/history/clear', (_req, res) => {
  const history = clearHistoryItems();
  res.json({ history });
});

// ============================================================
// Protected Admin APIs (STRICT requireAdmin RBAC Verification)
// ============================================================

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  res.json(getAdminDashboardData());
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const data = getAdminDashboardData();
  const users = q
    ? data.users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      )
    : data.users;
  res.json({ users });
});

app.post('/api/admin/users', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const { name, email, phone, location, planId } = req.body ?? {};
  if (!name || !String(name).trim() || !email || !String(email).trim()) {
    res.status(400).json({ error: 'ব্যবহারকারীর নাম এবং ইমেইল প্রদান করুন।' });
    return;
  }
  const validPlan: SubscriptionPlanId =
    planId === 'pro' || planId === '1_month' || planId === '3_months' ? planId : 'free';
  const created = adminCreateUser({
    name: String(name),
    email: String(email),
    phone: typeof phone === 'string' ? phone : undefined,
    location: typeof location === 'string' ? location : undefined,
    planId: validPlan,
  });
  recordAdminLog(
    'user_create',
    `নতুন ব্যবহারকারী যোগ করেছেন: ${created.name} (${created.email})`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ user: created, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/users/:id/status', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const status = req.body?.status === 'suspended' ? 'suspended' : 'active';
  const updated = adminUpdateUserStatus(req.params.id, status);
  if (!updated) {
    res.status(404).json({ error: 'ব্যবহারকারী পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    status === 'suspended' ? 'user_suspend' : 'user_activate',
    `${updated.name}-এর অ্যাকাউন্ট ${status === 'suspended' ? 'স্থগিত' : 'সক্রিয়'} করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ user: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/users/:id/plan', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const planId = String(req.body?.planId || '') as SubscriptionPlanId;
  const expiresAt = typeof req.body?.expiresAt === 'string' ? req.body.expiresAt : undefined;
  const updated = adminUpdateUserPlan(req.params.id, planId, expiresAt);
  if (!updated) {
    res.status(404).json({ error: 'ব্যবহারকারী বা প্ল্যান পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    'user_plan_update',
    `${updated.name}-এর প্ল্যান "${updated.subscription.planNameBn}"-এ পরিবর্তন করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ user: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/users/:id/quota', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const { dailyLimit, monthlyLimit, resetUsage } = req.body ?? {};
  const updated = adminUpdateUserQuota(req.params.id, {
    dailyLimit: dailyLimit !== undefined ? Number(dailyLimit) : undefined,
    monthlyLimit: monthlyLimit !== undefined ? Number(monthlyLimit) : undefined,
    resetUsage: Boolean(resetUsage),
  });
  if (!updated) {
    res.status(404).json({ error: 'ব্যবহারকারী পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    'user_quota_update',
    `${updated.name}-এর কোটা (দৈনিক ${updated.quota.dailyLimit}, মাসিক ${updated.quota.monthlyLimit}) হালনাগাদ হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ user: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/plans/:id', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const planId = req.params.id as SubscriptionPlanId;
  const { nameBn, descriptionBn, priceBdt, durationDays, dailyLimit, monthlyLimit, enabled } =
    req.body ?? {};
  const updated = adminUpdatePlanConfig(planId, {
    nameBn: typeof nameBn === 'string' ? nameBn : undefined,
    descriptionBn: typeof descriptionBn === 'string' ? descriptionBn : undefined,
    priceBdt: priceBdt !== undefined ? Number(priceBdt) : undefined,
    durationDays: durationDays !== undefined ? Number(durationDays) : undefined,
    dailyLimit: dailyLimit !== undefined ? Number(dailyLimit) : undefined,
    monthlyLimit: monthlyLimit !== undefined ? Number(monthlyLimit) : undefined,
    enabled: typeof enabled === 'boolean' ? enabled : undefined,
  });
  if (!updated) {
    res.status(404).json({ error: 'সাবস্ক্রিপশন প্ল্যান পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    'plan_update',
    `প্ল্যান "${updated.nameBn}"-এর মূল্য (৳${updated.priceBdt}) ও কোটা সীমা হালনাগাদ করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ plan: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/payments/:id/verify', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const outcome = verifyPaymentAndActivate(req.params.id);
  if (!outcome) {
    res.status(404).json({ error: 'পেমেন্ট অনুরোধ পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    'payment_verify',
    `${outcome.payment.userName}-এর পেমেন্ট (${outcome.payment.transactionId}) যাচাই ও প্রো সক্রিয় করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ ...outcome, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/payments/:id/reject', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const payment = rejectPaymentRequest(req.params.id, req.body?.reason);
  if (!payment) {
    res.status(404).json({ error: 'পেমেন্ট অনুরোধ পাওয়া যায়নি।' });
    return;
  }
  recordAdminLog(
    'payment_reject',
    `${payment.userName}-এর পেমেন্ট (${payment.transactionId}) বাতিল করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ payment, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/ads', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const ads = updateAdSystem(req.body ?? {});
  recordAdminLog(
    'ads_update',
    'বিজ্ঞাপন নেটওয়ার্ক ও প্রদর্শনী সেটিংস পরিবর্তন করা হয়েছে',
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ ads, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/quota', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const { dailyLimit, monthlyLimit } = req.body ?? {};
  const quota = updateQuotaLimits(Number(dailyLimit || 12), Number(monthlyLimit || 150));
  recordAdminLog(
    'quota_update',
    `ডিফল্ট ব্যবহার কোটা (দৈনিক ${quota.dailyLimit}, মাসিক ${quota.monthlyLimit}) আপডেট করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ quota, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/model', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const { modelId } = req.body ?? {};
  const updated = updateActiveAiModel(String(modelId || ''));
  if (!updated) {
    res.status(400).json({ error: 'অকার্যকর বা অসমর্থিত এআই মডেল নির্বাচিত হয়েছে।' });
    return;
  }
  recordAdminLog(
    'model_update',
    `গ্লোবাল Gemini মডেল "${updated}"-এ পরিবর্তন করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ modelId: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/settings', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const updated = adminUpdateAppSettings(req.body ?? {});
  recordAdminLog(
    'app_settings_update',
    `অ্যাপ সেটিংস হালনাগাদ (রক্ষণাবেক্ষণ: ${updated.maintenanceMode.enabled ? 'চালু' : 'বন্ধ'}, ভাষা: ${updated.defaultLanguage})`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ appSettings: updated, dashboard: getAdminDashboardData(), state: getFullState() });
});

app.post('/api/admin/api-logs/clear', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  clearApiLogs();
  recordAdminLog(
    'api_logs_clear',
    'সিস্টেমের API ও ৪২৯ ত্রুটি লগ পরিষ্কার করা হয়েছে',
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ dashboard: getAdminDashboardData() });
});

app.post('/api/admin/cache/clear', requireAdmin, (req: AuthenticatedAdminRequest, res) => {
  const cleared = clearResponseCache();
  recordAdminLog(
    'cache_clear',
    `সার্ভারের এআই রেসপন্স ক্যাশ (${cleared}টি এন্ট্রি) পরিষ্কার করা হয়েছে`,
    req.adminUser!.email,
    getClientIp(req)
  );
  res.json({ cleared, dashboard: getAdminDashboardData() });
});

// ============================================================
// Multilingual AI Assistant Chat, Conversations & Voice Routes
// ============================================================

app.get('/api/conversations', (_req, res) => {
  res.json({ conversations: getConversations() });
});

app.post('/api/conversations', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
  const language = resolveRequestedLanguage(req.body?.language);
  const conversation = createConversation(title, language);
  res.json({ conversation, conversations: getConversations() });
});

app.patch('/api/conversations/:id', (req, res) => {
  const updated = updateConversationMeta(req.params.id, {
    title: req.body?.title,
    pinned: req.body?.pinned,
    language: req.body?.language ? resolveRequestedLanguage(req.body.language) : undefined,
  });
  if (!updated) {
    res.status(404).json({ error: 'কথোপকথনটি পাওয়া যায়নি।' });
    return;
  }
  res.json({ conversations: updated });
});

app.delete('/api/conversations/:id', (req, res) => {
  const conversations = deleteConversationById(req.params.id);
  res.json({ conversations });
});

app.post('/api/conversations/clear', (_req, res) => {
  const conversations = clearAllConversations();
  res.json({ conversations });
});

app.post('/api/ai/chat', async (req, res) => {
  const startedAt = Date.now();
  const {
    conversationId,
    message,
    imageBase64,
    imageMimeType,
    imageDataUrl,
    responseLanguage,
    modelId,
    stream,
  } = req.body ?? {};
  const settings = getAppSettings();
  const wantsStream =
    settings.aiSettings.streamEnabled &&
    (Boolean(stream) || req.headers.accept?.includes('text/event-stream'));
  const trimmedMsg = typeof message === 'string' ? message.trim() : '';

  if (!trimmedMsg && !imageBase64) {
    res.status(400).json({ error: 'অনুগ্রহ করে কিছু লিখুন, ভয়েস দিন অথবা একটি ছবি আপলোড করুন।' });
    return;
  }

  const lang = resolveRequestedLanguage(responseLanguage);
  const requestedModel = resolveRequestedModel(modelId);
  const quotaCheck = checkFeatureAvailable('generalChatEnabled');
  if (!quotaCheck.ok) {
    sendAccessDeniedOrQuota(res, quotaCheck, '/api/ai/chat', 'assistant', lang);
    return;
  }

  const existingConv =
    typeof conversationId === 'string' ? getConversationById(conversationId) : undefined;
  const priorHistory = (existingConv?.messages ?? []).map((m) => ({
    role: m.role,
    text: m.text,
  }));

  if (wantsStream) {
    const writeSse = initSse(res);
    try {
      const result = await streamAssistantChat(
        {
          history: priorHistory,
          message: trimmedMsg,
          imageBase64,
          imageMimeType,
          responseLanguage: lang,
          modelId: requestedModel,
        },
        (text) => writeSse({ type: 'delta', text })
      );

      const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
      const { conversation, conversations } = appendConversationTurn({
        conversationId: existingConv?.id,
        userText: trimmedMsg || 'ছবি বিশ্লেষণ',
        assistantText: result.answer,
        imageDataUrl: typeof imageDataUrl === 'string' ? imageDataUrl : undefined,
        language: lang,
        modelUsed: result.modelUsed,
        cached: result.cached,
      });

      logAiOutcome({
        endpoint: '/api/ai/chat',
        tool: 'assistant',
        language: lang,
        startedAt,
        model: result.modelUsed,
        cached: result.cached,
      });

      writeSse({
        type: 'done',
        answer: result.answer,
        modelUsed: result.modelUsed,
        cached: Boolean(result.cached),
        conversation,
        conversations,
        quota: updatedQuota,
      });
      res.end();
    } catch (err) {
      logAiOutcome({ endpoint: '/api/ai/chat', tool: 'assistant', language: lang, startedAt, model: requestedModel, err });
      const normalized = normalizeGeminiError(err, requestedModel);
      writeSse({
        type: 'error',
        error: normalized.message,
        errorCode: normalized.errorCode,
        retryable: normalized.retryable,
        retryAfterSec: normalized.retryAfterSec,
      });
      res.end();
    }
    return;
  }

  try {
    const result = await streamAssistantChat(
      {
        history: priorHistory,
        message: trimmedMsg,
        imageBase64,
        imageMimeType,
        responseLanguage: lang,
        modelId: requestedModel,
      },
      () => {}
    );

    const updatedQuota = result.cached ? getFullState().quota : consumeQuota();
    const { conversation, conversations } = appendConversationTurn({
      conversationId: existingConv?.id,
      userText: trimmedMsg || 'ছবি বিশ্লেষণ',
      assistantText: result.answer,
      imageDataUrl: typeof imageDataUrl === 'string' ? imageDataUrl : undefined,
      language: lang,
      modelUsed: result.modelUsed,
      cached: result.cached,
    });

    logAiOutcome({
      endpoint: '/api/ai/chat',
      tool: 'assistant',
      language: lang,
      startedAt,
      model: result.modelUsed,
      cached: result.cached,
    });

    res.json({
      answer: result.answer,
      modelUsed: result.modelUsed,
      cached: Boolean(result.cached),
      conversation,
      conversations,
      quota: updatedQuota,
    });
  } catch (err) {
    logAiOutcome({ endpoint: '/api/ai/chat', tool: 'assistant', language: lang, startedAt, model: requestedModel, err });
    sendAiError(res, err, requestedModel);
  }
});

app.post('/api/ai/transcribe', async (req, res) => {
  const startedAt = Date.now();
  const lang = resolveRequestedLanguage(req.body?.responseLanguage);
  try {
    const { audioBase64, mimeType } = req.body ?? {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'ভয়েস অডিও পাওয়া যায়নি। আবার রেকর্ড করুন।' });
      return;
    }
    const result = await transcribeVoiceAudio({
      audioBase64,
      mimeType: typeof mimeType === 'string' ? mimeType : 'audio/webm',
      responseLanguage: lang,
    });
    logAiOutcome({
      endpoint: '/api/ai/transcribe',
      tool: 'voice-input',
      language: lang,
      startedAt,
      model: 'gemini-3.5-transcribe',
    });
    res.json(result);
  } catch (err) {
    logAiOutcome({
      endpoint: '/api/ai/transcribe',
      tool: 'voice-input',
      language: lang,
      startedAt,
      model: 'gemini-3.5-transcribe',
      err,
    });
    sendAiError(res, err);
  }
});

app.post('/api/ai/tts', async (req, res) => {
  const startedAt = Date.now();
  const lang = resolveRequestedLanguage(req.body?.responseLanguage);
  try {
    const { text } = req.body ?? {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'শোনার জন্য টেক্সট পাওয়া যায়নি।' });
      return;
    }
    const result = await synthesizeSpeechAudio({
      text,
      responseLanguage: lang,
    });
    logAiOutcome({
      endpoint: '/api/ai/tts',
      tool: 'voice-output',
      language: lang,
      startedAt,
      model: 'gemini-3.8-flash-lite-tts',
      cached: result.cached,
    });
    res.json(result);
  } catch (err) {
    logAiOutcome({
      endpoint: '/api/ai/tts',
      tool: 'voice-output',
      language: lang,
      startedAt,
      model: 'gemini-3.8-flash-lite-tts',
      err,
    });
    sendAiError(res, err);
  }
});

  return app;
}
