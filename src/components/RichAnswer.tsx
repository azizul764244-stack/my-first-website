import React, { useState } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { VoiceOutputButton } from './VoiceControls';
import type { ResponseLanguageCode } from '../types';

interface RichAnswerProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
  language?: ResponseLanguageCode;
  autoSpeakKey?: string;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[13px] text-blue-700 dark:text-blue-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const RichAnswer: React.FC<RichAnswerProps> = ({
  content,
  className = '',
  isStreaming = false,
  language = 'en',
  autoSpeakKey,
}) => {
  const { t } = useUiLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked silently
    }
  };

  const lines = content.split('\n');

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          {isStreaming && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t('Generating fast response...', 'দ্রুত উত্তর আসছে...')}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isStreaming && content && (
            <VoiceOutputButton
              text={content}
              language={language}
              autoSpeakKey={autoSpeakKey}
              compact
            />
          )}
          <button
            type="button"
            onClick={handleCopy}
            disabled={!content}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? t('Copied', 'কপি হয়েছে') : t('Copy', 'কপি')}</span>
          </button>
        </div>
      </div>

      <div
        dir="auto"
        className="space-y-2.5 text-[15px] leading-relaxed text-slate-700 dark:text-slate-200"
      >
        {lines.map((rawLine, index) => {
          const line = rawLine.trim();
          if (!line) return <div key={index} className="h-1" />;

          if (line.startsWith('### ')) {
            return (
              <h4
                key={index}
                className="text-base font-semibold text-slate-900 dark:text-white pt-2"
              >
                {renderInlineFormatting(line.slice(4))}
              </h4>
            );
          }

          if (line.startsWith('## ')) {
            return (
              <h3
                key={index}
                className="text-lg font-bold text-slate-900 dark:text-white pt-3"
              >
                {renderInlineFormatting(line.slice(3))}
              </h3>
            );
          }

          if (line.startsWith('# ')) {
            return (
              <h2
                key={index}
                className="text-xl font-bold text-slate-900 dark:text-white pt-3"
              >
                {renderInlineFormatting(line.slice(2))}
              </h2>
            );
          }

          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={index} className="flex items-start gap-2.5 pl-1">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                <p className="flex-1">{renderInlineFormatting(line.slice(2))}</p>
              </div>
            );
          }

          const numberedMatch = line.match(/^(\d+|[০-৯]+)[.)]\s+(.*)$/);
          if (numberedMatch) {
            return (
              <div key={index} className="flex items-start gap-2.5 pl-1">
                <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400 mt-1 shrink-0 tabular-nums">
                  {numberedMatch[1]}.
                </span>
                <p className="flex-1">{renderInlineFormatting(numberedMatch[2])}</p>
              </div>
            );
          }

          return <p key={index}>{renderInlineFormatting(line)}</p>;
        })}
      </div>
    </div>
  );
};
