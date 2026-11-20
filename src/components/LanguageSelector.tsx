import React from 'react';
import { Languages } from 'lucide-react';
import { getLanguageOption, SUPPORTED_LANGUAGES } from '../constants/languages';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import type { ResponseLanguageCode } from '../types';

interface LanguageSelectorProps {
  value: ResponseLanguageCode;
  onChange: (lang: ResponseLanguageCode) => void;
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const { uiLang, t } = useUiLanguage();
  const current = getLanguageOption(value);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2.5 ${
        compact
          ? 'py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          : 'p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Languages className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
            {t('AI Response Language', 'এআই উত্তরের ভাষা')}
          </p>
          {!compact && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {t('Current:', 'বর্তমান:')} {current.nativeName} (
              {uiLang === 'bn' ? current.bengaliName : current.englishName}) ·{' '}
              {t('Changeable anytime', 'যেকোনো সময় পরিবর্তনযোগ্য')}
            </p>
          )}
        </div>
      </div>

      <select
        aria-label={t('Select AI response language', 'উত্তরের ভাষা নির্বাচন করুন')}
        value={value}
        onChange={(e) => onChange(e.target.value as ResponseLanguageCode)}
        className="min-h-[40px] max-w-full px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName} — {uiLang === 'bn' ? lang.bengaliName : lang.englishName}
          </option>
        ))}
      </select>
    </div>
  );
};
