import type { LanguageOption, ResponseLanguageCode } from '../types';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'auto',
    nativeName: 'Auto Detect',
    bengaliName: 'স্বয়ংক্রিয় ভাষা শনাক্ত',
    englishName: 'Auto Detect',
  },
  {
    code: 'bn',
    nativeName: 'বাংলা',
    bengaliName: 'বাংলা',
    englishName: 'Bengali',
  },
  {
    code: 'en',
    nativeName: 'English',
    bengaliName: 'ইংরেজি',
    englishName: 'English',
  },
  {
    code: 'ar',
    nativeName: 'العربية',
    bengaliName: 'আরবি',
    englishName: 'Arabic',
    rtl: true,
  },
  {
    code: 'hi',
    nativeName: 'हिन्दी',
    bengaliName: 'হিন্দি',
    englishName: 'Hindi',
  },
  {
    code: 'ur',
    nativeName: 'اردو',
    bengaliName: 'উর্দু',
    englishName: 'Urdu',
    rtl: true,
  },
  {
    code: 'zh',
    nativeName: '中文',
    bengaliName: 'চীনা',
    englishName: 'Chinese (Simplified)',
  },
  {
    code: 'ja',
    nativeName: '日本語',
    bengaliName: 'জাপানি',
    englishName: 'Japanese',
  },
  {
    code: 'fr',
    nativeName: 'Français',
    bengaliName: 'ফরাসি',
    englishName: 'French',
  },
  {
    code: 'es',
    nativeName: 'Español',
    bengaliName: 'স্প্যানিশ',
    englishName: 'Spanish',
  },
  {
    code: 'de',
    nativeName: 'Deutsch',
    bengaliName: 'জার্মান',
    englishName: 'German',
  },
  {
    code: 'pt',
    nativeName: 'Português',
    bengaliName: 'পর্তুগিজ',
    englishName: 'Portuguese',
  },
  {
    code: 'ru',
    nativeName: 'Русский',
    bengaliName: 'রুশ',
    englishName: 'Russian',
  },
  {
    code: 'ko',
    nativeName: '한국어',
    bengaliName: 'কোরীয়',
    englishName: 'Korean',
  },
  {
    code: 'tr',
    nativeName: 'Türkçe',
    bengaliName: 'তুর্কি',
    englishName: 'Turkish',
  },
  {
    code: 'id',
    nativeName: 'Bahasa Indonesia',
    bengaliName: 'ইন্দোনেশীয়',
    englishName: 'Indonesian',
  },
  {
    code: 'ms',
    nativeName: 'Bahasa Melayu',
    bengaliName: 'মালয়',
    englishName: 'Malay',
  },
  {
    code: 'it',
    nativeName: 'Italiano',
    bengaliName: 'ইতালীয়',
    englishName: 'Italian',
  },
  {
    code: 'th',
    nativeName: 'ไทย',
    bengaliName: 'থাই',
    englishName: 'Thai',
  },
  {
    code: 'vi',
    nativeName: 'Tiếng Việt',
    bengaliName: 'ভিয়েতনামী',
    englishName: 'Vietnamese',
  },
  {
    code: 'ta',
    nativeName: 'தமிழ்',
    bengaliName: 'তামিল',
    englishName: 'Tamil',
  },
  {
    code: 'ne',
    nativeName: 'नेपाली',
    bengaliName: 'নেপালি',
    englishName: 'Nepali',
  },
];

export const VALID_LANGUAGE_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));

export function getLanguageOption(code?: string): LanguageOption {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return found || SUPPORTED_LANGUAGES[1]; // default Bengali
}

export function normalizeLanguageCode(code?: string): ResponseLanguageCode {
  if (code && VALID_LANGUAGE_CODES.has(code)) {
    return code as ResponseLanguageCode;
  }
  return 'bn';
}

const BCP47_MAP: Record<ResponseLanguageCode, string> = {
  auto: 'bn-BD',
  bn: 'bn-BD',
  en: 'en-US',
  ar: 'ar-SA',
  hi: 'hi-IN',
  ur: 'ur-PK',
  zh: 'zh-CN',
  ja: 'ja-JP',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  pt: 'pt-BR',
  ru: 'ru-RU',
  ko: 'ko-KR',
  tr: 'tr-TR',
  id: 'id-ID',
  ms: 'ms-MY',
  it: 'it-IT',
  th: 'th-TH',
  vi: 'vi-VN',
  ta: 'ta-IN',
  ne: 'ne-NP',
};

export function getBcp47Locale(code?: ResponseLanguageCode): string {
  const norm = normalizeLanguageCode(code);
  return BCP47_MAP[norm] || 'bn-BD';
}
