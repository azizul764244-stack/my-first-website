import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Edit3,
  ImagePlus,
  Loader2,
  Lock,
  MessageSquarePlus,
  MessageSquareText,
  PanelLeftOpen,
  Pin,
  PinOff,
  Search,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { RichAnswer } from '../components/RichAnswer';
import { VoiceInputButton } from '../components/VoiceControls';
import { getLanguageOption } from '../constants/languages';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { AiClientError, streamAiSse } from '../utils/api';
import type {
  AiErrorCode,
  ChatConversation,
  ChatMessage,
  GeminiModelId,
  GeminiModelOption,
  QuotaState,
  ResponseLanguageCode,
} from '../types';

interface AssistantPageProps {
  enabled?: boolean;
  isOnline?: boolean;
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  onConversationsChange: (conversations: ChatConversation[]) => void;
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
  onQuotaUpdate: (quota: QuotaState) => void;
}

const STARTER_PROMPTS: {
  labelEn: string;
  labelBn: string;
  promptEn: string;
  promptBn: string;
  langHint: string;
}[] = [
  {
    labelEn: 'Professional CV / Resume',
    labelBn: 'পেশাদার CV / বায়োডাটা',
    promptEn: 'Write a modern professional CV template for a fresh graduate applying for a Junior Software / Office Executive role.',
    promptBn: 'একজন ফ্রেশ গ্র্যাজুয়েটের জন্য আধুনিক ও প্রফেশনাল CV ফরম্যাট লিখে দাও।',
    langHint: 'CV & Career',
  },
  {
    labelEn: 'Short Story (গল্প)',
    labelBn: 'ছোট গল্প লিখুন',
    promptEn: 'Write a heartwarming short story about a student from a small town achieving their dream through determination.',
    promptBn: 'গ্রামের এক মেধাবী শিক্ষার্থীর স্বপ্নজয়ের একটি অনুপ্রেরণামূলক ছোট গল্প লিখে দাও।',
    langHint: 'Creative Story',
  },
  {
    labelEn: 'Poem Writing (কবিতা)',
    labelBn: 'সুন্দর কবিতা লিখুন',
    promptEn: 'Write a gentle 12-line poem about monsoon rain and hope.',
    promptBn: 'বর্ষার সন্ধ্যা ও নতুন আশার আলো নিয়ে ১২ লাইনের একটি সুন্দর বাংলা কবিতা লিখে দাও।',
    langHint: 'Poetry',
  },
  {
    labelEn: 'Job Exam & Interview Q&A',
    labelBn: 'চাকরির পরীক্ষা ও ভাইভা প্রশ্ন',
    promptEn: 'Give me the 5 most common job interview questions with strong sample answers and tips.',
    promptBn: 'চাকরির ভাইভা ও নিয়োগ পরীক্ষায় সবচেয়ে বেশি আসা ৫টি প্রশ্নের আদর্শ উত্তর লিখে দাও।',
    langHint: 'Job Prep',
  },
];

async function prepareImagePayload(file: File): Promise<{
  base64: string;
  mimeType: string;
  thumbDataUrl: string;
}> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const renderScaled = (maxDim: number, quality: number): string => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return rawDataUrl;
        ctx.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL('image/jpeg', quality);
      };

      const aiDataUrl = renderScaled(1024, 0.86);
      const thumbDataUrl = renderScaled(360, 0.72);
      const commaIdx = aiDataUrl.indexOf(',');
      resolve({
        base64: commaIdx >= 0 ? aiDataUrl.slice(commaIdx + 1) : aiDataUrl,
        mimeType: 'image/jpeg',
        thumbDataUrl,
      });
    };
    img.onerror = () => {
      const commaIdx = rawDataUrl.indexOf(',');
      resolve({
        base64: commaIdx >= 0 ? rawDataUrl.slice(commaIdx + 1) : rawDataUrl,
        mimeType: file.type || 'image/jpeg',
        thumbDataUrl: rawDataUrl.length < 220000 ? rawDataUrl : '',
      });
    };
    img.src = rawDataUrl;
  });
}

interface PendingPayload {
  conversationId: string | null;
  message: string;
  imageBase64?: string;
  imageMimeType?: string;
  imageDataUrl?: string;
  responseLanguage: ResponseLanguageCode;
  modelId?: GeminiModelId;
}

export const AssistantPage: React.FC<AssistantPageProps> = ({
  enabled = true,
  isOnline = true,
  conversations,
  activeConversationId,
  onSelectConversation,
  onConversationsChange,
  responseLanguage,
  activeModel,
  availableModels,
  onSwitchModel,
  onBusyChange,
  onQuotaUpdate,
}) => {
  const { uiLang, t, formatDate } = useUiLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const [inputText, setInputText] = useState('');
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);

  const [autoSpeak, setAutoSpeak] = useState(false);
  const [autoSpeakMsgId, setAutoSpeakMsgId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [optimisticUserMsg, setOptimisticUserMsg] = useState<ChatMessage | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const lastFailedPayloadRef = useRef<PendingPayload | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  const currentLangOption = getLanguageOption(responseLanguage);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeConversation?.messages.length, streamingText, optimisticUserMsg]);

  if (!enabled) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('General Chat Mode is Currently Disabled', 'জেনারেল চ্যাট মোড বর্তমানে বন্ধ রয়েছে')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {t(
            'General Chat Mode has been turned off by the Administrator from the Admin Panel.',
            'অ্যাডমিন প্যানেল থেকে জেনারেল এআই চ্যাট মোড সাময়িকভাবে বন্ধ করা হয়েছে।'
          )}
        </p>
      </div>
    );
  }

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const prepared = await prepareImagePayload(file);
      setImageBase64(prepared.base64);
      setImageMimeType(prepared.mimeType);
      setImagePreview(prepared.thumbDataUrl);
      setError(null);
      setVoiceError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('Failed to process image.', 'ছবি প্রক্রিয়াকরণে সমস্যা হয়েছে।')
      );
    }
  };

  const clearAttachedImage = () => {
    setImageBase64(undefined);
    setImageMimeType(undefined);
    setImagePreview(undefined);
  };

  const handleNewChat = async () => {
    if (sending) return;
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: responseLanguage }),
      });
      const data = (await res.json()) as {
        conversation?: ChatConversation;
        conversations?: ChatConversation[];
      };
      if (res.ok && data.conversations) {
        onConversationsChange(data.conversations);
        onSelectConversation(data.conversation?.id ?? null);
        setDrawerOpen(false);
        setError(null);
        setVoiceError(null);
      }
    } catch {
      onSelectConversation(null);
      setDrawerOpen(false);
    }
  };

  const handleTogglePin = async (conv: ChatConversation) => {
    try {
      const res = await fetch(`/api/conversations/${conv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: !conv.pinned }),
      });
      const data = (await res.json()) as { conversations?: ChatConversation[] };
      if (res.ok && data.conversations) {
        onConversationsChange(data.conversations);
      }
    } catch {
      // ignore
    }
  };

  const handleSaveRename = async (id: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = (await res.json()) as { conversations?: ChatConversation[] };
      if (res.ok && data.conversations) {
        onConversationsChange(data.conversations);
      }
    } finally {
      setEditingId(null);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as { conversations?: ChatConversation[] };
      if (res.ok && data.conversations) {
        onConversationsChange(data.conversations);
        if (activeConversationId === id) {
          onSelectConversation(data.conversations[0]?.id ?? null);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleClearAllConversations = async () => {
    try {
      const res = await fetch('/api/conversations/clear', { method: 'POST' });
      const data = (await res.json()) as { conversations?: ChatConversation[] };
      if (res.ok && data.conversations) {
        onConversationsChange(data.conversations);
        onSelectConversation(null);
        setConfirmClearAll(false);
      }
    } catch {
      // ignore
    }
  };

  const sendPayload = async (payload: PendingPayload) => {
    if (inFlightRef.current) return;
    if (!isOnline) {
      setError(
        t(
          'You are offline — reading saved chats from local storage. Reconnect to Mobile Data or Wi-Fi to send new messages.',
          'আপনি অফলাইনে আছেন — লোকাল স্টোরেজে সংরক্ষিত চ্যাট পড়ছেন। নতুন প্রশ্ন করতে ডাটা বা Wi-Fi চালু করুন।'
        )
      );
      return;
    }

    inFlightRef.current = true;
    setSending(true);
    onBusyChange(true);
    setError(null);
    setErrorCode(undefined);
    setRetryAfterSec(undefined);
    setVoiceError(null);
    lastFailedPayloadRef.current = payload;

    setOptimisticUserMsg({
      id: `TEMP-${Date.now()}`,
      role: 'user',
      text: payload.message || t('Analyze this image', 'ছবিটি বিশ্লেষণ করুন'),
      imageDataUrl: payload.imageDataUrl,
      language: payload.responseLanguage,
      createdAt: new Date().toISOString(),
    });
    setStreamingText('');

    let completed = false;
    try {
      await streamAiSse<{
        answer: string;
        modelUsed?: string;
        cached?: boolean;
        conversation: ChatConversation;
        conversations: ChatConversation[];
        quota: QuotaState;
      }>('/api/ai/chat', { ...payload, modelId: activeModel }, {
        onDelta: (chunk) => {
          setStreamingText((prev) => prev + chunk);
        },
        onDone: (data) => {
          completed = true;
          lastFailedPayloadRef.current = null;
          onConversationsChange(data.conversations);
          onSelectConversation(data.conversation.id);
          onQuotaUpdate(data.quota);
          setOptimisticUserMsg(null);
          setStreamingText('');
          if (autoSpeak) {
            const latestAssistant = [...data.conversation.messages]
              .reverse()
              .find((m) => m.role === 'assistant');
            if (latestAssistant) {
              setAutoSpeakMsgId(latestAssistant.id);
            }
          }
        },
      });
    } catch (err) {
      setOptimisticUserMsg(null);
      setStreamingText('');
      if (err instanceof AiClientError) {
        setError(err.message);
        setErrorCode(err.errorCode);
        setRetryAfterSec(err.retryAfterSec);
      } else {
        setError(err instanceof Error ? err.message : t('Unexpected error occurred.', 'অপ্রত্যাশিত ত্রুটি হয়েছে।'));
        setErrorCode('unknown');
      }
    } finally {
      if (completed) {
        setInputText('');
        clearAttachedImage();
      }
      inFlightRef.current = false;
      setSending(false);
      onBusyChange(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed && !imageBase64) {
      setError(
        t(
          'Type a question, use voice input, or upload an image.',
          'প্রশ্ন লিখুন, ভয়েস দিন অথবা একটি ছবি আপলোড করুন।'
        )
      );
      setErrorCode(undefined);
      return;
    }

    await sendPayload({
      conversationId: activeConversation?.id ?? null,
      message: trimmed,
      imageBase64,
      imageMimeType,
      imageDataUrl: imagePreview,
      responseLanguage,
      modelId: activeModel,
    });
  };

  const handleRetryFailed = async () => {
    if (lastFailedPayloadRef.current) {
      await sendPayload({
        ...lastFailedPayloadRef.current,
        responseLanguage,
        modelId: activeModel,
      });
    }
  };

  const handleVoiceTranscript = (transcript: string) => {
    setVoiceError(null);
    setInputText((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
  };

  const handleVoiceError = (err: AiClientError | string) => {
    if (typeof err === 'string') {
      setVoiceError(err);
      return;
    }
    setError(err.message);
    setErrorCode(err.errorCode);
    setRetryAfterSec(err.retryAfterSec);
  };

  const messages = activeConversation?.messages ?? [];

  const ConversationListContent = (
    <div className="flex flex-col h-full">
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={sending}
            className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>{t('New Chat', 'নতুন চ্যাট')}</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label={t('Close conversation drawer', 'কথোপকথন তালিকা বন্ধ করুন')}
            className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Search chats...', 'কথোপকথন খুঁজুন...')}
            className="w-full min-h-[38px] pl-8 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6 px-3">
            {t('No conversations found.', 'কোনো কথোপকথন পাওয়া যায়নি।')}
          </p>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = activeConversation?.id === conv.id;
            const isEditing = editingId === conv.id;
            return (
              <div
                key={conv.id}
                className={`group rounded-xl p-2.5 transition-colors border ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700'
                    : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveRename(conv.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-blue-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRename(conv.id)}
                      aria-label={t('Save name', 'নাম সংরক্ষণ করুন')}
                      className="min-w-[30px] min-h-[30px] flex items-center justify-center rounded-lg bg-blue-700 text-white"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectConversation(conv.id);
                        setDrawerOpen(false);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        {conv.pinned && (
                          <Pin className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                        )}
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {conv.title}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {conv.messages.length} {t('msgs', 'বার্তা')} · {formatDate(conv.updatedAt)}
                      </p>
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(conv)}
                        aria-label={conv.pinned ? t('Unpin', 'পিন সরান') : t('Pin', 'পিন করুন')}
                        className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800"
                      >
                        {conv.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(conv.id);
                          setEditingTitle(conv.title);
                        }}
                        aria-label={t('Rename', 'নাম পরিবর্তন করুন')}
                        className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteConversation(conv.id)}
                        aria-label={t('Delete chat', 'কথোপকথন মুছুন')}
                        className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {conversations.length > 0 && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          {confirmClearAll ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearAllConversations}
                className="flex-1 min-h-[36px] rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                {t('Confirm Delete All', 'হ্যাঁ, সব মুছুন')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="flex-1 min-h-[36px] rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                {t('Cancel', 'বাতিল')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="w-full min-h-[38px] rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('Clear All Chats', 'সব চ্যাট মুছুন')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'General Chat Mode (ChatGPT-Style) · Stories, Poems, CVs, Job Prep, Voice & Vision',
              'জেনারেল চ্যাট মোড (ChatGPT-স্টাইল) · গল্প, কবিতা, CV, চাকরির প্রশ্ন, ভয়েস ও ছবি'
            )}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('Sathi General AI Chat', 'সাথী জেনারেল এআই চ্যাট')} (
            {uiLang === 'bn' ? currentLangOption.bengaliName : currentLangOption.englishName})
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoSpeak((v) => !v)}
            className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              autoSpeak
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>
              {autoSpeak ? t('Auto-Voice ON', 'অটো-ভয়েস চালু') : t('Auto-Voice OFF', 'অটো-ভয়েস বন্ধ')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden min-h-[40px] px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <PanelLeftOpen className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>
              {t('Chats', 'চ্যাট')} ({conversations.length})
            </span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <aside className="hidden lg:flex lg:col-span-4 xl:col-span-3 flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-[660px] overflow-hidden">
          {ConversationListContent}
        </aside>

        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="relative z-10 w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl">
              {ConversationListContent}
            </div>
          </div>
        )}

        <section className="lg:col-span-8 xl:col-span-9 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col min-h-[560px] lg:h-[660px] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-900">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquareText className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {activeConversation?.title || t('New Conversation', 'নতুন বহুভাষিক কথোপকথন')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleNewChat}
              disabled={sending}
              className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>{t('New', 'নতুন')}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {messages.length === 0 && !optimisticUserMsg && (
              <div className="py-8 max-w-2xl mx-auto text-center space-y-5">
                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {t(
                      'Ask Anything — Stories, Poems, CVs, Job Prep & Everyday Help',
                      'যেকোনো বিষয়ে জিজ্ঞাসা করুন — গল্প, কবিতা, CV, চাকরির প্রশ্ন ও সাধারণ সমাধান'
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    {t(
                      'Works just like ChatGPT in English, Bengali, Hindi, Arabic, and 20+ languages with voice & photo upload.',
                      'ChatGPT-এর মতো বাংলা, ইংরেজি, হিন্দি ও বহু ভাষায় টাইপ, ভয়েস বা ছবি দিয়ে যেকোনো প্রশ্নের উত্তর পান।'
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                  {STARTER_PROMPTS.map((item) => (
                    <button
                      key={item.labelEn}
                      type="button"
                      onClick={() => setInputText(uiLang === 'bn' ? item.promptBn : item.promptEn)}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                          {t(item.labelEn, item.labelBn)}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.langHint}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                        {uiLang === 'bn' ? item.promptBn : item.promptEn}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[92%] sm:max-w-[82%] rounded-2xl p-4 ${
                      isUser
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {msg.imageDataUrl && (
                      <img
                        src={msg.imageDataUrl}
                        alt={t('Uploaded image', 'আপলোড করা ছবি')}
                        className="max-h-52 rounded-xl object-contain mb-2.5 border border-white/20"
                      />
                    )}
                    {isUser ? (
                      <p dir="auto" className="text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <RichAnswer
                          content={msg.text}
                          language={msg.language || responseLanguage}
                          autoSpeakKey={autoSpeakMsgId === msg.id ? msg.id : undefined}
                        />
                        {(msg.modelUsed || msg.cached) && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {msg.modelUsed ? `${t('Model:', 'মডেল:')} ${msg.modelUsed}` : ''}
                            {msg.cached ? ` · ${t('Cached', 'ক্যাশড উত্তর')}` : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {optimisticUserMsg && (
              <div className="flex justify-end">
                <div className="max-w-[92%] sm:max-w-[82%] rounded-2xl p-4 bg-blue-700 text-white">
                  {optimisticUserMsg.imageDataUrl && (
                    <img
                      src={optimisticUserMsg.imageDataUrl}
                      alt={t('Uploaded image', 'আপলোড করা ছবি')}
                      className="max-h-52 rounded-xl object-contain mb-2.5 border border-white/20"
                    />
                  )}
                  <p dir="auto" className="text-sm whitespace-pre-wrap leading-relaxed">
                    {optimisticUserMsg.text}
                  </p>
                </div>
              </div>
            )}

            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[92%] sm:max-w-[82%] rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  {streamingText ? (
                    <RichAnswer content={streamingText} isStreaming language={responseLanguage} />
                  ) : (
                    <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-400" />
                      <span>{t('Preparing answer...', 'উত্তর প্রস্তুত হচ্ছে...')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {(error || voiceError) && (
            <div className="px-4 pb-3 space-y-2">
              <AiErrorBanner
                error={error}
                errorCode={errorCode}
                retryAfterSec={retryAfterSec}
                onRetry={lastFailedPayloadRef.current ? handleRetryFailed : undefined}
                retrying={sending}
                activeModel={activeModel}
                availableModels={availableModels}
                onSwitchModel={onSwitchModel}
              />
              {voiceError && (
                <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                  <span>{voiceError}</span>
                  <button
                    type="button"
                    onClick={() => setVoiceError(null)}
                    aria-label={t('Dismiss notice', 'বার্তা বন্ধ করুন')}
                    className="p-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {!isOnline && (
            <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                {t(
                  'Offline Mode — Viewing saved AI chat history from local storage.',
                  'অফলাইন মোড — ইন্টারনেট ছাড়াই সংরক্ষিত চ্যাট দেখছেন।'
                )}
              </span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 space-y-3"
          >
            {imagePreview && (
              <div className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-fit">
                <img
                  src={imagePreview}
                  alt={t('Selected image', 'নির্বাচিত ছবি')}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div className="text-xs">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {t('Image Attached', 'ছবি সংযুক্ত হয়েছে')}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('Ask anything about this image', 'ছবি সম্পর্কে প্রশ্ন লিখুন বা পাঠান')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearAttachedImage}
                  aria-label={t('Remove image', 'ছবি সরান')}
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit(e);
                  }
                }}
                placeholder={t(
                  'Ask anything — write stories, poems, CVs, job Q&A, or upload a photo...',
                  'গল্প, কবিতা, CV, চাকরির প্রশ্ন বা যেকোনো বিষয় লিখুন — অথবা ভয়েস ও ছবি দিন...'
                )}
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <VoiceInputButton
                    language={responseLanguage}
                    onTranscript={handleVoiceTranscript}
                    onError={handleVoiceError}
                    disabled={sending}
                    compact
                  />

                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors">
                    <ImagePlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>{t('Photo', 'ছবি')}</span>
                    <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                  </label>

                  <label className="cursor-pointer sm:hidden inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200">
                    <Camera className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    <span>{t('Camera', 'ক্যামেরা')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImagePick}
                      className="hidden"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={sending || !isOnline}
                  className="min-h-[40px] px-5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{sending ? t('Sending...', 'পাঠানো হচ্ছে...') : t('Send', 'পাঠান')}</span>
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
