import type { AiErrorCode } from '../types';

export class AiClientError extends Error {
  status?: number;
  errorCode: AiErrorCode;
  retryAfterSec?: number;

  constructor(
    message: string,
    options?: { status?: number; errorCode?: AiErrorCode; retryAfterSec?: number }
  ) {
    super(message);
    this.name = 'AiClientError';
    this.status = options?.status;
    this.errorCode = options?.errorCode ?? 'unknown';
    this.retryAfterSec = options?.retryAfterSec;
  }
}

function buildErrorFromPayload(
  status: number | undefined,
  data: Record<string, unknown> | null
): AiClientError {
  const serverMessage = typeof data?.error === 'string' ? data.error : '';
  const errorCode =
    typeof data?.errorCode === 'string' ? (data.errorCode as AiErrorCode) : undefined;
  const retryAfterSec =
    typeof data?.retryAfterSec === 'number' ? data.retryAfterSec : undefined;

  if (serverMessage && !serverMessage.trim().startsWith('{')) {
    return new AiClientError(serverMessage, {
      status,
      errorCode: errorCode ?? (status === 429 ? 'quota_exhausted' : status === 503 ? 'overloaded' : 'unknown'),
      retryAfterSec,
    });
  }

  if (status === 429) {
    return new AiClientError(
      'Gemini API-এর অনুরোধ সীমা বা কোটা পূর্ণ হয়েছে (৪২৯)। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন অথবা অন্য একটি ফ্রি মডেল নির্বাচন করুন।',
      { status: 429, errorCode: errorCode ?? 'quota_exhausted', retryAfterSec }
    );
  }

  if (status === 503) {
    return new AiClientError(
      'এআই সার্ভারে এখন অতিরিক্ত চাপ রয়েছে (৫০৩)। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
      { status: 503, errorCode: 'overloaded' }
    );
  }

  return new AiClientError('এআই সার্ভার থেকে উত্তর আনতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', {
    status,
    errorCode: errorCode ?? 'unknown',
  });
}

// Client-side deduplication maps prevent duplicate API requests on double-clicks or re-renders
const inFlightJsonRequests = new Map<string, Promise<unknown>>();
const activeStreamUrls = new Set<string>();

export async function postAiJson<T>(url: string, body: unknown): Promise<T> {
  const dedupeKey = `${url}:${JSON.stringify(body)}`;
  const existing = inFlightJsonRequests.get(dedupeKey) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const requestPromise = (async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AiClientError(
        'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।',
        { errorCode: 'network' }
      );
    }

    let data: Record<string, unknown> | null = null;
    const rawText = await response.text();
    try {
      data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw buildErrorFromPayload(response.status, data);
    }

    if (!data) {
      throw new AiClientError('সার্ভার থেকে সঠিক তথ্য পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।', {
        errorCode: 'unknown',
      });
    }

    return data as T;
  })();

  inFlightJsonRequests.set(dedupeKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inFlightJsonRequests.delete(dedupeKey);
  }
}

export interface StreamCallbacks<TDone> {
  onDelta: (text: string) => void;
  onDone: (payload: TDone) => void;
}

export async function streamAiSse<TDone>(
  url: string,
  body: unknown,
  callbacks: StreamCallbacks<TDone>
): Promise<void> {
  if (activeStreamUrls.has(url)) {
    // Prevent duplicate concurrent stream requests for the same tool
    return;
  }

  activeStreamUrls.add(url);
  try {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ ...(body as Record<string, unknown>), stream: true }),
      });
    } catch {
      throw new AiClientError(
        'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।',
        { errorCode: 'network' }
      );
    }

    // Non-streaming JSON response or pre-stream error (e.g., 400 / 429 / 503)
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.includes('application/json')) {
      const rawText = await response.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw buildErrorFromPayload(response.status, data);
      }

      if (data) {
        callbacks.onDone(data as TDone);
        return;
      }
    }

    if (!response.body) {
      throw new AiClientError('স্ট্রিমিং সংযোগ পাওয়া যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।', {
        errorCode: 'network',
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let receivedDone = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const rawEvent of events) {
        const dataLines = rawEvent
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim());

        if (dataLines.length === 0) continue;
        const jsonText = dataLines.join('\n');

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(jsonText) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (parsed.type === 'delta' && typeof parsed.text === 'string') {
          callbacks.onDelta(parsed.text);
        } else if (parsed.type === 'error') {
          throw buildErrorFromPayload(undefined, parsed);
        } else if (parsed.type === 'done') {
          receivedDone = true;
          callbacks.onDone(parsed as unknown as TDone);
        }
      }
    }

    if (!receivedDone) {
      throw new AiClientError('উত্তর অসম্পূর্ণ অবস্থায় সংযোগ বিচ্ছিন্ন হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', {
        errorCode: 'network',
      });
    }
  } finally {
    activeStreamUrls.delete(url);
  }
}
