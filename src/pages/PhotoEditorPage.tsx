import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  Eraser,
  ImagePlus,
  Layers,
  Loader2,
  Lock,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { AiErrorBanner } from '../components/AiErrorBanner';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { AiClientError, postAiJson } from '../utils/api';
import type {
  AiErrorCode,
  GeminiModelId,
  GeminiModelOption,
  HistoryItem,
  QuotaState,
  ResponseLanguageCode,
} from '../types';

interface PhotoEditorPageProps {
  imageGenEnabled?: boolean;
  responseLanguage: ResponseLanguageCode;
  activeModel: GeminiModelId;
  availableModels: GeminiModelOption[];
  onSwitchModel: (modelId: GeminiModelId) => Promise<void> | void;
  onBusyChange: (busy: boolean) => void;
  onQuotaUpdate: (quota: QuotaState) => void;
  onResultSuccess?: (item: HistoryItem | undefined, quota: QuotaState) => void;
}

type EditorTab = 'ai-generate' | 'enhance' | 'background' | 'thumbnail';

const BACKDROP_OPTIONS = [
  { id: 'transparent', labelEn: 'Transparent (PNG)', labelBn: 'স্বচ্ছ (PNG)', color: 'transparent' },
  { id: 'studio-blue', labelEn: 'Studio Blue', labelBn: 'স্টুডিও নীল', color: '#1d4ed8' },
  { id: 'clean-white', labelEn: 'Clean White', labelBn: 'পরিচ্ছন্ন সাদা', color: '#f8fafc' },
  { id: 'midnight-gradient', labelEn: 'Dark Gradient', labelBn: 'ডার্ক গ্রেডিয়েন্ট', color: 'gradient-dark' },
  { id: 'sunset-padma', labelEn: 'Padma Sunset Scene', labelBn: 'পদ্মা গোধূলি দৃশ্য', color: 'image-padma' },
];

const THUMB_THEMES = [
  { id: 'sapphire', labelEn: 'Sapphire Blue', labelBn: 'সাফায়ার নীল', bg: '#0f172a', accent: '#2563eb', badgeBg: '#facc15', badgeText: '#0f172a' },
  { id: 'breaking', labelEn: 'Red & Dark Focus', labelBn: 'লাল-কালো ফোকাস', bg: '#18181b', accent: '#dc2626', badgeBg: '#ffffff', badgeText: '#b91c1c' },
  { id: 'emerald', labelEn: 'Deep Emerald', labelBn: 'গভীর সবুজ', bg: '#064e3b', accent: '#10b981', badgeBg: '#fef08a', badgeText: '#064e3b' },
];

const IMAGE_STYLES = [
  { id: 'realistic', en: 'Photorealistic', bn: 'বাস্তবসম্মত ফটো' },
  { id: 'portrait', en: 'Studio Portrait', bn: 'স্টুডিও পোর্ট্রেট' },
  { id: '3d-render', en: '3D Digital Art', bn: '৩ডি ডিজিটাল আর্ট' },
  { id: 'anime', en: 'Anime Illustration', bn: 'অ্যানিমে ইলাস্ট্রেশন' },
  { id: 'poster', en: 'Marketing Poster', bn: 'মার্কেটিং পোস্টার' },
];

export const PhotoEditorPage: React.FC<PhotoEditorPageProps> = ({
  imageGenEnabled = true,
  responseLanguage,
  activeModel,
  availableModels,
  onSwitchModel,
  onBusyChange,
  onQuotaUpdate,
  onResultSuccess,
}) => {
  const { uiLang, t } = useUiLanguage();
  const [tab, setTab] = useState<EditorTab>(imageGenEnabled ? 'ai-generate' : 'enhance');
  const [sourceUrl, setSourceUrl] = useState('/src/assets/images/photo_editor_sample_1795095211997.jpg');

  // ChatGPT-style AI Image Generation / Photo Editing State
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgAspectRatio, setImgAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [imgQuality, setImgQuality] = useState<'standard' | 'high'>('standard');
  const [imgStyle, setImgStyle] = useState('realistic');
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [refBase64, setRefBase64] = useState<string | undefined>(undefined);
  const [refMimeType, setRefMimeType] = useState<string | undefined>(undefined);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genErrorCode, setGenErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [genRetryAfterSec, setGenRetryAfterSec] = useState<number | undefined>(undefined);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedNote, setGeneratedNote] = useState<string | null>(null);
  const genInFlightRef = useRef(false);

  // Enhance settings
  const [brightness, setBrightness] = useState(104);
  const [contrast, setContrast] = useState(106);
  const [saturation, setSaturation] = useState(105);
  const [warmth, setWarmth] = useState(0);

  // Background removal settings
  const [tolerance, setTolerance] = useState(46);
  const [backdropId, setBackdropId] = useState('studio-blue');

  // Thumbnail Maker settings
  const [thumbTopic, setThumbTopic] = useState('5 Easy AI Tools to Earn Online');
  const [thumbTitle, setThumbTitle] = useState('5 Easy AI Tools!');
  const [thumbSub, setThumbSub] = useState('Start today right from mobile');
  const [thumbBadge, setThumbBadge] = useState('NEW GUIDE');
  const [thumbThemeId, setThumbThemeId] = useState('sapphire');

  // Gemini Advisor state
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorResult, setAdvisorResult] = useState<{
    headlineSuggestions: string[];
    subheadline: string;
    colorTipBn: string;
    enhancementTipBn: string;
  } | null>(null);
  const [advisorError, setAdvisorError] = useState<string | null>(null);
  const [advisorErrorCode, setAdvisorErrorCode] = useState<AiErrorCode | undefined>(undefined);
  const [advisorRetryAfterSec, setAdvisorRetryAfterSec] = useState<number | undefined>(undefined);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);
  const padmaImgRef = useRef<HTMLImageElement | null>(null);
  const advisorInFlightRef = useRef(false);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = loadedImgRef.current;
    if (!canvas || !img || tab === 'ai-generate') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (tab === 'thumbnail') {
      const W = 1280;
      const H = 720;
      canvas.width = W;
      canvas.height = H;
      const theme = THUMB_THEMES.find((th) => th.id === thumbThemeId) || THUMB_THEMES[0];

      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, theme.bg);
      grad.addColorStop(1, theme.accent);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const imgAspect = img.width / img.height;
      const drawH = H;
      const drawW = drawH * imgAspect;
      const drawX = W - drawW * 0.92;
      ctx.save();
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(img, drawX, 0, drawW, drawH);
      ctx.restore();

      const scrim = ctx.createLinearGradient(0, 0, W * 0.78, 0);
      scrim.addColorStop(0, 'rgba(15, 23, 42, 0.96)');
      scrim.addColorStop(0.65, 'rgba(15, 23, 42, 0.78)');
      scrim.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, W, H);

      if (thumbBadge.trim()) {
        ctx.fillStyle = theme.badgeBg;
        ctx.beginPath();
        ctx.roundRect(64, 72, Math.max(180, thumbBadge.length * 22 + 48), 54, 14);
        ctx.fill();

        ctx.fillStyle = theme.badgeText;
        ctx.font = 'bold 28px "Hind Siliguri", sans-serif';
        ctx.fillText(thumbBadge, 88, 108);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 74px "Hind Siliguri", sans-serif';
      const words = thumbTitle.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > 640 && current) {
          lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);

      lines.slice(0, 3).forEach((line, i) => {
        ctx.fillText(line, 64, 240 + i * 94);
      });

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 34px "Hind Siliguri", sans-serif';
      ctx.fillText(thumbSub, 64, 240 + Math.min(3, lines.length) * 94 + 28);
      return;
    }

    const maxW = 960;
    const scale = Math.min(1, maxW / img.width);
    const W = Math.round(img.width * scale);
    const H = Math.round(img.height * scale);
    canvas.width = W;
    canvas.height = H;

    if (tab === 'enhance') {
      ctx.clearRect(0, 0, W, H);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${Math.max(0, warmth)}%)`;
      ctx.drawImage(img, 0, 0, W, H);
      ctx.filter = 'none';
      return;
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = W;
    offscreen.height = H;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.drawImage(img, 0, 0, W, H);
    const imgData = offCtx.getImageData(0, 0, W, H);
    const data = imgData.data;

    const sampleIndices = [0, (W - 2) * 4, (Math.floor(H * 0.1) * W + 2) * 4];
    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    for (const idx of sampleIndices) {
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
    }
    bgR /= sampleIndices.length;
    bgG /= sampleIndices.length;
    bgB /= sampleIndices.length;

    const thresh = tolerance * 2.1;
    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - bgR;
      const dg = data[i + 1] - bgG;
      const db = data[i + 2] - bgB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < thresh) {
        data[i + 3] = 0;
      } else if (dist < thresh + 24) {
        const alphaFactor = (dist - thresh) / 24;
        data[i + 3] = Math.round(data[i + 3] * alphaFactor);
      }
    }
    offCtx.putImageData(imgData, 0, 0);

    ctx.clearRect(0, 0, W, H);
    const chosen = BACKDROP_OPTIONS.find((b) => b.id === backdropId);
    if (chosen?.color === 'gradient-dark') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0f172a');
      g.addColorStop(1, '#1e3a8a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else if (chosen?.color === 'image-padma' && padmaImgRef.current) {
      ctx.drawImage(padmaImgRef.current, 0, 0, W, H);
    } else if (chosen && chosen.color !== 'transparent') {
      ctx.fillStyle = chosen.color;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.drawImage(offscreen, 0, 0);
  }, [tab, brightness, contrast, saturation, warmth, tolerance, backdropId, thumbTitle, thumbSub, thumbBadge, thumbThemeId]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImgRef.current = img;
      renderCanvas();
    };
    img.src = sourceUrl;

    const padma = new Image();
    padma.crossOrigin = 'anonymous';
    padma.onload = () => {
      padmaImgRef.current = padma;
      renderCanvas();
    };
    padma.src = '/src/assets/images/video_scene_sample_1795095212055.jpg';
  }, [sourceUrl, renderCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSourceUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setRefPreview(dataUrl);
      const [meta, base64] = dataUrl.split(',');
      const mimeMatch = meta.match(/data:(.*);base64/);
      setRefMimeType(mimeMatch ? mimeMatch[1] : file.type);
      setRefBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const executeAiImageGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (genInFlightRef.current) return;
    if (!imgPrompt.trim()) {
      setGenError(
        t(
          'Please describe the image you want to create or edit.',
          'আপনি কেমন ছবি তৈরি বা এডিট করতে চান তা লিখে দিন।'
        )
      );
      setGenErrorCode(undefined);
      setGenRetryAfterSec(undefined);
      return;
    }

    genInFlightRef.current = true;
    setGenLoading(true);
    onBusyChange(true);
    setGenError(null);
    setGenErrorCode(undefined);
    setGenRetryAfterSec(undefined);

    const styleObj = IMAGE_STYLES.find((s) => s.id === imgStyle);
    const fullPrompt = styleObj ? `${imgPrompt.trim()} (Style: ${styleObj.en})` : imgPrompt.trim();

    try {
      const res = await postAiJson<{
        imageDataUrl: string;
        descriptionText?: string;
        modelUsed?: string;
        historyItem?: HistoryItem;
        quota: QuotaState;
      }>('/api/ai/image-generate', {
        prompt: fullPrompt,
        aspectRatio: imgAspectRatio,
        quality: imgQuality,
        referenceImageBase64: refBase64,
        referenceMimeType: refMimeType,
        responseLanguage,
      });

      setGeneratedImageUrl(res.imageDataUrl);
      setGeneratedNote(res.descriptionText || null);
      if (onResultSuccess) {
        onResultSuccess(res.historyItem, res.quota);
      } else {
        onQuotaUpdate(res.quota);
      }
    } catch (err) {
      if (err instanceof AiClientError) {
        setGenError(err.message);
        setGenErrorCode(err.errorCode);
        setGenRetryAfterSec(err.retryAfterSec);
      } else {
        setGenError(err instanceof Error ? err.message : t('Image generation failed.', 'ছবি তৈরিতে সমস্যা হয়েছে।'));
      }
    } finally {
      genInFlightRef.current = false;
      setGenLoading(false);
      onBusyChange(false);
    }
  };

  const handleDownloadGenerated = () => {
    if (!generatedImageUrl) return;
    const link = document.createElement('a');
    link.download = `sathi-ai-image-${Date.now()}.png`;
    link.href = generatedImageUrl;
    link.click();
  };

  const handleDownloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `sathi-ai-${tab}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleResetEnhance = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setWarmth(0);
  };

  const handleAskAiAdvisor = async () => {
    if (advisorInFlightRef.current) return;
    advisorInFlightRef.current = true;
    setAdvisorLoading(true);
    onBusyChange(true);
    setAdvisorError(null);
    setAdvisorErrorCode(undefined);
    setAdvisorRetryAfterSec(undefined);
    try {
      const data = await postAiJson<{
        advice: {
          headlineSuggestions: string[];
          subheadline: string;
          colorTipBn: string;
          enhancementTipBn: string;
        };
        quota: QuotaState;
      }>('/api/ai/photo-advisor', { topic: thumbTopic, responseLanguage });
      setAdvisorResult(data.advice);
      if (data.advice?.headlineSuggestions?.[0]) {
        setThumbTitle(data.advice.headlineSuggestions[0]);
      }
      if (data.advice?.subheadline) {
        setThumbSub(data.advice.subheadline);
      }
      onQuotaUpdate(data.quota);
    } catch (err) {
      if (err instanceof AiClientError) {
        setAdvisorError(err.message);
        setAdvisorErrorCode(err.errorCode);
        setAdvisorRetryAfterSec(err.retryAfterSec);
      } else {
        setAdvisorError(err instanceof Error ? err.message : t('Unexpected error.', 'অপ্রত্যাশিত ত্রুটি হয়েছে।'));
      }
    } finally {
      advisorInFlightRef.current = false;
      setAdvisorLoading(false);
      onBusyChange(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'ChatGPT-Style AI Image Generator & Canvas Studio',
              'ChatGPT-স্টাইল এআই ছবি জেনারেটর ও ক্যানভাস ফটো এডিটর'
            )}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('AI Image Generator & Photo Studio', 'এআই ইমেজ ও ফটো স্টুডিও')}
          </h1>
        </div>

        {tab !== 'ai-generate' && (
          <div className="flex items-center gap-2">
            <label className="cursor-pointer min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold inline-flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <Upload className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>{t('Upload Photo', 'ছবি আপলোড')}</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              type="button"
              onClick={handleDownloadCanvas}
              className="min-h-[44px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{t('Download PNG', 'PNG ডাউনলোড')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl w-full sm:w-fit overflow-x-auto">
        {(
          [
            { id: 'ai-generate', en: 'AI Image Generator', bn: 'এআই ছবি তৈরি', icon: Wand2 },
            { id: 'enhance', en: 'Photo Enhance', bn: 'ফটো এনহ্যান্সমেন্ট', icon: Sliders },
            { id: 'background', en: 'Remove Background', bn: 'ব্যাকগ্রাউন্ড রিমুভ', icon: Eraser },
            { id: 'thumbnail', en: 'YouTube Thumbnail', bn: 'ইউটিউব থাম্বনেইল', icon: Layers },
          ] as { id: EditorTab; en: string; bn: string; icon: React.FC<{ className?: string }> }[]
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                tab === item.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t(item.en, item.bn)}</span>
            </button>
          );
        })}
      </div>

      {tab === 'ai-generate' ? (
        !imageGenEnabled ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('AI Image Generation is Disabled', 'এআই ছবি তৈরি বর্তমানে বন্ধ রয়েছে')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              {t(
                'Enable Image Generation inside Admin Panel > Settings to use ChatGPT-style image creation.',
                'অ্যাডমিন প্যানেল থেকে Image Generation চালু করলে আবার ব্যবহার করতে পারবেন।'
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={executeAiImageGenerate}
              className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
            >
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('Generate or Edit Any Image', 'লিখে বা ছবি দিয়ে নতুন ছবি তৈরি করুন')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t(
                    'Describe your idea in Bengali or English — or attach a reference photo to transform it.',
                    'বাংলা বা ইংরেজিতে বর্ণনা দিন, অথবা নিজের একটি ছবি যুক্ত করে এডিট বা রূপান্তর করুন।'
                  )}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  {t('Image Prompt', 'ছবির বর্ণনা লিখুন')}
                </label>
                <textarea
                  rows={4}
                  value={imgPrompt}
                  onChange={(e) => setImgPrompt(e.target.value)}
                  placeholder={t(
                    'e.g., A cozy Dhaka rooftop cafe at sunset with warm fairy lights, cinematic ultra-detailed photo...',
                    'যেমন: গোধূলি বেলায় ঢাকার ছাদে সুন্দর আলোকসজ্জা সহ আধুনিক কফি শপ, বাস্তবসম্মত হাই-কোয়ালিটি ফটো...'
                  )}
                  className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    {t('Art Style', 'স্টাইল')}
                  </label>
                  <select
                    value={imgStyle}
                    onChange={(e) => setImgStyle(e.target.value)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    {IMAGE_STYLES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {uiLang === 'bn' ? s.bn : s.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">
                    {t('Aspect Ratio', 'সাইজ / অনুপাত')}
                  </label>
                  <select
                    value={imgAspectRatio}
                    onChange={(e) => setImgAspectRatio(e.target.value as typeof imgAspectRatio)}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <option value="1:1">1:1 ({t('Square', 'স্কয়ার')})</option>
                    <option value="16:9">16:9 (YouTube)</option>
                    <option value="9:16">9:16 (Reels / TikTok)</option>
                    <option value="4:3">4:3 ({t('Landscape', 'ল্যান্ডস্কেপ')})</option>
                    <option value="3:4">3:4 ({t('Portrait', 'পোর্ট্রেট')})</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  {t('Quality Mode', 'কোয়ালিটি')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImgQuality('standard')}
                    className={`min-h-[40px] rounded-xl border text-xs font-semibold ${
                      imgQuality === 'standard'
                        ? 'border-blue-700 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {t('Standard Fast', 'দ্রুত স্ট্যান্ডার্ড')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgQuality('high')}
                    className={`min-h-[40px] rounded-xl border text-xs font-semibold ${
                      imgQuality === 'high'
                        ? 'border-blue-700 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {t('High Detail (Pro)', 'হাই ডিটেইল (প্রো)')}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800">
                  <ImagePlus className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                  <span>{t('Attach Photo (Optional)', 'রেফারেন্স ছবি (ঐচ্ছিক)')}</span>
                  <input type="file" accept="image/*" onChange={handleRefImageUpload} className="hidden" />
                </label>

                {refPreview && (
                  <div className="flex items-center gap-2">
                    <img
                      src={refPreview}
                      alt={t('Reference', 'রেফারেন্স')}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setRefPreview(null);
                        setRefBase64(undefined);
                        setRefMimeType(undefined);
                      }}
                      aria-label={t('Remove photo', 'ছবি সরান')}
                      className="min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={genLoading}
                className="w-full min-h-[46px] rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                <span>{genLoading ? t('Generating Image...', 'ছবি তৈরি হচ্ছে...') : t('Generate Image', 'ছবি তৈরি করুন')}</span>
              </button>

              <AiErrorBanner
                error={genError}
                errorCode={genErrorCode}
                retryAfterSec={genRetryAfterSec}
                onRetry={() => executeAiImageGenerate()}
                retrying={genLoading}
                activeModel={activeModel}
                availableModels={availableModels}
                onSwitchModel={onSwitchModel}
              />
            </form>

            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="w-full min-h-[340px] rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden p-3">
                {genLoading ? (
                  <div className="text-center space-y-2 py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-700 dark:text-blue-400 mx-auto" />
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t('Creating your AI image...', 'এআই দিয়ে আপনার ছবিটি তৈরি হচ্ছে...')}
                    </p>
                  </div>
                ) : generatedImageUrl ? (
                  <img
                    src={generatedImageUrl}
                    alt={imgPrompt}
                    className="max-w-full max-h-[460px] rounded-xl object-contain shadow-md"
                  />
                ) : (
                  <div className="text-center max-w-sm space-y-2 py-12 px-4">
                    <Sparkles className="w-8 h-8 text-blue-600 mx-auto opacity-80" />
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {t('Your Generated Image Will Appear Here', 'আপনার তৈরি করা ছবি এখানে দেখাবে')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        'Try prompts like "Futuristic skyline of Dhaka at night, neon reflections" or attach a portrait and ask for studio lighting.',
                        'যেমন: "রাতের ঢাকার আধুনিক আকাশচুম্বী দৃশ্য" লিখে দেখুন অথবা নিজের ছবি দিয়ে স্টুডিও ব্যাকগ্রাউন্ড চান।'
                      )}
                    </p>
                  </div>
                )}
              </div>

              {generatedNote && (
                <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl">
                  {generatedNote}
                </p>
              )}

              {generatedImageUrl && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceUrl(generatedImageUrl);
                      setTab('enhance');
                    }}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span>{t('Open in Canvas Editor', 'ক্যানভাস এডিটরে খুলুন')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadGenerated}
                    className="min-h-[42px] px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('Download Image', 'ছবি ডাউনলোড করুন')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Live Canvas Viewport */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
            <div
              className="w-full rounded-xl overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-950 min-h-[260px]"
              style={{
                backgroundImage:
                  tab === 'background' && backdropId === 'transparent'
                    ? 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)'
                    : undefined,
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              }}
            >
              <canvas ref={canvasRef} className="max-w-full max-h-[440px] object-contain" />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{t('Switch sample photo:', 'নমুনা ছবি পরিবর্তন:')}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSourceUrl('/src/assets/images/photo_editor_sample_1795095211997.jpg')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  {t('Studio Portrait', 'স্টুডিও পোর্ট্রেট')}
                </button>
                <button
                  type="button"
                  onClick={() => setSourceUrl('/src/assets/images/video_scene_sample_1795095212055.jpg')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  {t('River & Bridge Scene', 'নদী ও সেতু দৃশ্য')}
                </button>
              </div>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
            {tab === 'enhance' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('Light & Color Adjustments', 'আলো ও রঙ সমন্বয়')}
                  </h2>
                  <button
                    type="button"
                    onClick={handleResetEnhance}
                    className="text-xs text-blue-700 dark:text-blue-400 inline-flex items-center gap-1 min-h-[36px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('Reset', 'রিসেট')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBrightness(108);
                      setContrast(112);
                      setSaturation(114);
                      setWarmth(6);
                    }}
                    className="min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium"
                  >
                    {t('Auto Enhance', 'অটো এনহ্যান্স')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBrightness(104);
                      setContrast(118);
                      setSaturation(92);
                      setWarmth(12);
                    }}
                    className="min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium"
                  >
                    {t('Golden Portrait', 'গোল্ডেন পোর্ট্রেট')}
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>{t('Brightness', 'উজ্জ্বলতা (Brightness)')}</span>
                      <span className="font-mono tabular-nums">{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={150}
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-blue-700"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>{t('Contrast', 'কনট্রাস্ট (Contrast)')}</span>
                      <span className="font-mono tabular-nums">{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={160}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-blue-700"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>{t('Saturation', 'রঙের উজ্জ্বলতা (Saturation)')}</span>
                      <span className="font-mono tabular-nums">{saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={180}
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full accent-blue-700"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>{t('Warmth', 'উষ্ণতা (Warmth)')}</span>
                      <span className="font-mono tabular-nums">{warmth}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={warmth}
                      onChange={(e) => setWarmth(Number(e.target.value))}
                      className="w-full accent-blue-700"
                    />
                  </div>
                </div>
              </>
            )}

            {tab === 'background' && (
              <>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                    {t('Remove & Replace Background', 'ব্যাকগ্রাউন্ড রিমুভ ও পরিবর্তন')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t(
                      'Remove solid studio backdrop behind portraits and apply a new background.',
                      'স্টুডিও পোর্ট্রেট বা একরঙা ব্যাকড্রপ ছবির পেছনের অংশ সরিয়ে নতুন ব্যাকগ্রাউন্ড বসান।'
                    )}
                  </p>
                </div>

                <div className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span>{t('Cutout Tolerance', 'কাটআউট সংবেদনশীলতা')}</span>
                    <span className="font-mono tabular-nums">{tolerance}</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={105}
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-full accent-blue-700"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('Choose Replacement Background', 'নতুন ব্যাকগ্রাউন্ড নির্বাচন করুন')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {BACKDROP_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBackdropId(opt.id)}
                        className={`min-h-[42px] px-3 rounded-xl border text-xs font-medium text-left transition-colors ${
                          backdropId === opt.id
                            ? 'border-blue-700 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {uiLang === 'bn' ? opt.labelBn : opt.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'thumbnail' && (
              <>
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('YouTube Thumbnail Maker (1280×720)', 'ইউটিউব থাম্বনেইল মেকার (1280×720)')}
                  </h2>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      {t('Main Headline (EN/BN)', 'মূল শিরোনাম (বাংলা/ইংরেজি)')}
                    </label>
                    <input
                      type="text"
                      value={thumbTitle}
                      onChange={(e) => setThumbTitle(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        {t('Subheadline', 'সাব-শিরোনাম')}
                      </label>
                      <input
                        type="text"
                        value={thumbSub}
                        onChange={(e) => setThumbSub(e.target.value)}
                        className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">
                        {t('Badge Label', 'ব্রেকিং লেবেল')}
                      </label>
                      <input
                        type="text"
                        value={thumbBadge}
                        onChange={(e) => setThumbBadge(e.target.value)}
                        className="w-full min-h-[42px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold mb-1.5">{t('Color Theme', 'রঙের থিম')}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {THUMB_THEMES.map((th) => (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => setThumbThemeId(th.id)}
                          className={`min-h-[38px] px-2 rounded-xl border text-xs font-medium ${
                            thumbThemeId === th.id
                              ? 'border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {uiLang === 'bn' ? th.labelBn : th.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <label className="block text-xs font-semibold">
                      {t('AI Thumbnail Headline Suggestions', 'AI থাম্বনেইল শিরোনাম পরামর্শ')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={thumbTopic}
                        onChange={(e) => setThumbTopic(e.target.value)}
                        placeholder={t('Enter video topic...', 'ভিডিওর বিষয় লিখুন...')}
                        className="flex-1 min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAskAiAdvisor}
                        disabled={advisorLoading}
                        className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 dark:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                      >
                        {advisorLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{t('Get Ideas', 'আইডিয়া নিন')}</span>
                      </button>
                    </div>

                    <AiErrorBanner
                      error={advisorError}
                      errorCode={advisorErrorCode}
                      retryAfterSec={advisorRetryAfterSec}
                      onRetry={handleAskAiAdvisor}
                      retrying={advisorLoading}
                      activeModel={activeModel}
                      availableModels={availableModels}
                      onSwitchModel={onSwitchModel}
                    />

                    {advisorResult && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 space-y-2 text-xs">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {t('Suggested Headlines (tap to apply):', 'প্রস্তাবিত হেডলাইন (ট্যাপ করে বসান):')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {advisorResult.headlineSuggestions.map((h) => (
                            <button
                              key={h}
                              type="button"
                              onClick={() => setThumbTitle(h)}
                              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-600 text-left"
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{advisorResult.colorTipBn}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
