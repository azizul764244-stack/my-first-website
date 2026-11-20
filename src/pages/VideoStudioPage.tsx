import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Film,
  Info,
  Loader2,
  Lock,
  Pause,
  Play,
  Sparkles,
  Upload,
} from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { AiClientError, postAiJson } from '../utils/api';
import type {
  AiErrorCode,
  ApiIntegrationStatus,
  GeminiModelId,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
  VideoPromptResult,
} from '../types';

interface VideoStudioPageProps {
  videoGenEnabled?: boolean;
  initialPrompt?: string;
  responseLanguage: ResponseLanguageCode;
  onClearInitialPrompt: () => void;
  integrations: ApiIntegrationStatus;
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
  onResultSuccess: (item: HistoryItem | undefined, quota: QuotaState) => void;
}

const STYLES = [
  { id: 'Cinematic Documentary', en: 'Cinematic Documentary', bn: 'সিনেম্যাটিক ডকুমেন্টারি' },
  { id: 'Modern Tech Reels', en: 'Modern Tech Reels', bn: 'মডার্ন টেক রিলস' },
  { id: 'Dreamy 3D Animation', en: 'Dreamy 3D Animation', bn: 'স্বপ্নময় অ্যানিমেশন' },
  { id: 'Business Commercial', en: 'Business Commercial', bn: 'বিজনেস প্রোমো' },
];

const ASPECTS: { value: '16:9' | '9:16'; labelEn: string; labelBn: string }[] = [
  { value: '16:9', labelEn: '16:9 (YouTube Landscape)', labelBn: '16:9 (ইউটিউব ওয়াইড)' },
  { value: '9:16', labelEn: '9:16 (TikTok / Reels)', labelBn: '9:16 (টিকটক / রিলস)' },
];

export const VideoStudioPage: React.FC<VideoStudioPageProps> = ({
  videoGenEnabled = true,
  initialPrompt,
  responseLanguage,
  onClearInitialPrompt,
  integrations,
  onSwitchModel,
  onBusyChange,
  onResultSuccess,
}) => {
  const { uiLang, t } = useUiLanguage();
  const [tab, setTab] = useState<'text-to-video' | 'image-to-video' | 'prompt-only'>('text-to-video');
  const [idea, setIdea] = useState(initialPrompt || '');
  const [style, setStyle] = useState(STYLES[0].id);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [durationSec, setDurationSec] = useState<'6' | '10'>('6');
  const [sourceImage, setSourceImage] = useState<string>(
    '/src/assets/images/video_scene_sample_1795095212055.jpg'
  );
  const [sourceBase64, setSourceBase64] = useState<string | undefined>(undefined);
  const [sourceMimeType, setSourceMimeType] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [retryAfterSec, setRetryAfterSec] = useState<number | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  const [videoOutputUrl, setVideoOutputUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VideoPromptResult | null>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [copied, setCopied] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (initialPrompt) {
      setIdea(initialPrompt);
      setTab('text-to-video');
      onClearInitialPrompt();
    }
  }, [initialPrompt, onClearInitialPrompt]);

  useEffect(() => {
    if (!result || !isPlaying || !result.storyboard?.length) return;
    const timer = setInterval(() => {
      setActiveScene((prev) => (prev + 1) % result.storyboard.length);
    }, 2600);
    return () => clearInterval(timer);
  }, [result, isPlaying]);

  if (!videoGenEnabled) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('Flow AI Video Generation is Disabled', 'ভিডিও জেনারেশন মোড বর্তমানে বন্ধ রয়েছে')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {t(
            'Enable Video Generation inside Admin Panel > Settings to create short AI videos.',
            'অ্যাডমিন প্যানেল থেকে Video Generation চালু করলে আবার ব্যবহার করতে পারবেন।'
          )}
        </p>
      </div>
    );
  }

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setSourceImage(dataUrl);
      const [meta, base64] = dataUrl.split(',');
      const mimeMatch = meta.match(/data:(.*);base64/);
      setSourceMimeType(mimeMatch ? mimeMatch[1] : file.type);
      setSourceBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const executeGenerate = async () => {
    if (inFlightRef.current) return;
    if (!idea.trim()) {
      setError(t('Please describe the video scene or concept.', 'অনুগ্রহ করে ভিডিওর দৃশ্য বা ধারণা লিখুন।'));
      setErrorCode(undefined);
      setRetryAfterSec(undefined);
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    onBusyChange(true);
    setError(null);
    setErrorCode(undefined);
    setRetryAfterSec(undefined);
    setNotice(null);

    try {
      if (tab === 'prompt-only') {
        const data = await postAiJson<{
          result: VideoPromptResult;
          historyItem?: HistoryItem;
          quota: QuotaState;
        }>('/api/ai/video-prompt', {
          idea,
          mode: 'storyboard',
          style,
          aspectRatio,
          responseLanguage,
        });
        setResult(data.result);
        setVideoOutputUrl(null);
        setActiveScene(0);
        setIsPlaying(true);
        onResultSuccess(data.historyItem, data.quota);
      } else {
        const data = await postAiJson<{
          videoDataUrl?: string | null;
          videoUri?: string | null;
          result?: VideoPromptResult | null;
          promptUsed?: string;
          notice?: string;
          historyItem?: HistoryItem;
          quota: QuotaState;
        }>('/api/video/generate', {
          idea,
          mode: tab,
          style,
          aspectRatio,
          duration: durationSec,
          imageBase64: tab === 'image-to-video' ? sourceBase64 : undefined,
          imageMimeType: tab === 'image-to-video' ? sourceMimeType : undefined,
          responseLanguage,
        });

        const mediaUrl = data.videoDataUrl || data.videoUri || null;
        setVideoOutputUrl(mediaUrl);
        if (data.result) {
          setResult(data.result);
        } else if (data.promptUsed) {
          setResult({
            titleBn: idea.trim().slice(0, 60),
            englishPrompt: data.promptUsed,
            negativePrompt: 'blurry, low quality, distorted faces, watermark',
            styleNotesBn: `${style} · ${aspectRatio} · ${durationSec}s`,
            aspectRatio,
            storyboard: [],
          });
        }
        if (data.notice) setNotice(data.notice);
        onResultSuccess(data.historyItem, data.quota);
      }
    } catch (err) {
      if (err instanceof AiClientError) {
        setError(err.message);
        setErrorCode(err.errorCode);
        setRetryAfterSec(err.retryAfterSec);
      } else {
        setError(err instanceof Error ? err.message : t('Video generation failed.', 'ভিডিও তৈরিতে সমস্যা হয়েছে।'));
      }
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      onBusyChange(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeGenerate();
  };

  const copyPrompt = async () => {
    if (!result?.englishPrompt) return;
    try {
      await navigator.clipboard.writeText(result.englishPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const currentScene = result?.storyboard?.[activeScene];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('Flow AI Style Video Studio', 'Flow AI ভিডিও স্টুডিও')} · {integrations.videoApiLabel}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('Flow AI Short Video Generator', 'Flow AI শর্ট ভিডিও জেনারেটর')}
        </h1>
      </div>

      {/* Engine Status Banner */}
      <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          <p className="font-semibold text-slate-900 dark:text-white">
            {integrations.videoApiConnected
              ? t('Flow AI Live Video Rendering Active', 'লাইভ Flow AI ভিডিও জেনারেশন সক্রিয়')
              : t('Video Prompt & Storyboard Mode', 'ভিডিও প্রম্পট ও স্টোরিবোর্ড মোড')}
          </p>
          <p className="mt-0.5">
            {integrations.videoApiConnected
              ? t(
                  'Generate short 720p AI videos directly from text descriptions or photos (6s / 10s), or craft a 4-scene storyboard prompt.',
                  'সরাসরি টেক্সট লিখে বা ছবি আপলোড করে ৬–১০ সেকেন্ডের ছোট এআই ভিডিও তৈরি করুন, অথবা ৪-দৃশ্যের স্টোরিবোর্ড বানান।'
                )
              : t(
                  'Generates production English prompts & 4-scene storyboards via Gemini AI.',
                  'Gemini AI দিয়ে প্রোডাকশন ভিডিও প্রম্পট ও ৪-দৃশ্যের স্টোরিবোর্ড তৈরি হয়।'
                )}
          </p>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl w-full sm:w-fit overflow-x-auto">
        {(
          [
            { id: 'text-to-video', en: 'Text to Video (Flow AI)', bn: 'টেক্সট থেকে ভিডিও (Flow AI)' },
            { id: 'image-to-video', en: 'Image to Video (Flow AI)', bn: 'ছবি থেকে ভিডিও (Flow AI)' },
            { id: 'prompt-only', en: 'Prompt & Storyboard', bn: 'প্রম্পট ও স্টোরিবোর্ড' },
          ] as { id: 'text-to-video' | 'image-to-video' | 'prompt-only'; en: string; bn: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              tab === item.id
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t(item.en, item.bn)}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleGenerate}
        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      >
        {tab === 'image-to-video' && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <img
              src={sourceImage}
              alt={t('Reference frame', 'রেফারেন্স ছবি')}
              className="w-32 h-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <div className="flex-1 space-y-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {t('Image-to-Video Starting Frame', 'ইমেজ-টু-ভিডিও রেফারেন্স ছবি')}
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium">
                  <Upload className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                  <span>{t('Upload Your Image', 'নিজের ছবি আপলোড করুন')}</span>
                  <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSourceImage('/src/assets/images/video_scene_sample_1795095212055.jpg');
                    setSourceBase64(undefined);
                    setSourceMimeType(undefined);
                  }}
                  className="px-3 py-2 min-h-[38px] rounded-lg bg-slate-200/70 dark:bg-slate-700 text-xs font-medium"
                >
                  {t('Use Sample Photo', 'নমুনা ছবি ব্যবহার করুন')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Visual Style', 'ভিডিওর ভিজ্যুয়াল স্টাইল')}
            </label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {uiLang === 'bn' ? s.bn : s.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('Aspect Ratio', 'অ্যাসপেক্ট রেশিও')}
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              {ASPECTS.map((a) => (
                <option key={a.value} value={a.value}>
                  {uiLang === 'bn' ? a.labelBn : a.labelEn}
                </option>
              ))}
            </select>
          </div>
          {tab !== 'prompt-only' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('Clip Duration', 'ভিডিও দৈর্ঘ্য')}
              </label>
              <select
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value as '6' | '10')}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              >
                <option value="6">{t('6 Seconds (Fast)', '৬ সেকেন্ড (দ্রুত)')}</option>
                <option value="10">{t('10 Seconds (Extended)', '১০ সেকেন্ড (দীর্ঘ)')}</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t('Describe Your Video Scene or Action', 'আপনার ভিডিওর দৃশ্য বা গল্প বর্ণনা করুন')}
          </label>
          <textarea
            rows={3}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={t(
              'e.g., Golden sunset drone shot gliding over boats on the Padma river with glowing bridge lights...',
              'যেমন: গোধূলি বেলায় পদ্মা নদীর ওপর দিয়ে নৌকা ভেসে যাচ্ছে, পেছনে আধুনিক সেতুর আলো জ্বলছে...'
            )}
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] px-6 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
            <span>
              {loading
                ? t('Generating Video...', 'ভিডিও তৈরি হচ্ছে...')
                : tab === 'prompt-only'
                  ? t('Generate Storyboard & Prompt', 'ভিডিও প্রম্পট তৈরি করুন')
                  : t('Generate Flow AI Video', 'Flow AI ভিডিও তৈরি করুন')}
            </span>
          </button>
        </div>
      </form>

      <AiErrorBanner
        error={error}
        errorCode={errorCode}
        retryAfterSec={retryAfterSec}
        onRetry={executeGenerate}
        retrying={loading}
        activeModel={integrations.geminiModel}
        availableModels={integrations.availableModels}
        onSwitchModel={onSwitchModel}
      />

      {notice && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          {notice}
        </div>
      )}

      {videoOutputUrl && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>{t('Generated Flow AI Short Video', 'তৈরিকৃত Flow AI শর্ট ভিডিও')}</span>
            </h2>
            <a
              href={videoOutputUrl}
              download={`sathi-flow-video-${Date.now()}.mp4`}
              className="min-h-[40px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('Download Video', 'ভিডিও ডাউনলোড')}</span>
            </a>
          </div>
          <video
            src={videoOutputUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full max-h-[460px] rounded-xl bg-black"
          />
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {currentScene && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 text-white">
              <div className="relative h-64 sm:h-80 overflow-hidden flex items-end">
                <img
                  src={
                    tab === 'image-to-video'
                      ? sourceImage
                      : '/src/assets/images/video_scene_sample_1795095212055.jpg'
                  }
                  alt={t('Storyboard preview', 'স্টোরিবোর্ড প্রিভিউ')}
                  className={`absolute inset-0 w-full h-full object-cover opacity-55 transition-transform duration-[2500ms] ease-out ${
                    activeScene % 2 === 0 ? 'scale-105 translate-x-1' : 'scale-110 -translate-x-1'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />

                <div className="relative z-10 w-full p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="space-y-1.5 max-w-xl">
                    <p className="text-xs text-blue-300 font-mono tabular-nums">
                      {t('Scene', 'দৃশ্য')} {currentScene.sceneNumber}/4 · {currentScene.durationSec}s ·{' '}
                      {currentScene.cameraMovement}
                    </p>
                    <h3 className="text-lg sm:text-xl font-bold">{currentScene.captionBn}</h3>
                    <p className="text-xs sm:text-sm text-slate-200">{currentScene.visualBn}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="min-h-[44px] px-4 rounded-xl bg-white text-slate-900 text-xs font-semibold inline-flex items-center gap-2 shrink-0"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlaying ? t('Pause', 'বিরতি') : t('Play Preview', 'প্রিভিউ চালান')}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 border-t border-slate-800 bg-slate-900">
                {result.storyboard.map((scene, idx) => (
                  <button
                    key={scene.sceneNumber}
                    type="button"
                    onClick={() => {
                      setActiveScene(idx);
                      setIsPlaying(false);
                    }}
                    className={`p-3 text-left border-r last:border-r-0 border-slate-800 transition-colors min-h-[56px] ${
                      activeScene === idx ? 'bg-blue-900/50 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="text-[11px] font-mono tabular-nums">
                      {t('Scene', 'দৃশ্য')} {scene.sceneNumber}
                    </p>
                    <p className="text-xs font-medium truncate mt-0.5">{scene.captionBn}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {result.titleBn || t('Video Prompt Details', 'প্রোডাকশন ভিডিও প্রম্পট')}
                </h2>
              </div>
              <button
                type="button"
                onClick={copyPrompt}
                className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('Copied!', 'প্রম্পট কপি হয়েছে') : t('Copy Prompt', 'ইংরেজি প্রম্পট কপি করুন')}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
              {result.englishPrompt}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white mb-1">
                  {t('Negative Prompt', 'নেগেটিভ প্রম্পট')}
                </p>
                <p className="font-mono">{result.negativePrompt}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white mb-1">
                  {t('Style Notes', 'নির্দেশনা ও স্টাইল')}
                </p>
                <p>{result.styleNotesBn}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
