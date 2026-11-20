import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UiLang = 'en' | 'bn';

const STORAGE_KEY = 'sathi_ui_lang';

interface UiLanguageContextValue {
  uiLang: UiLang;
  setUiLang: (lang: UiLang) => void;
  t: (en: string, bn: string) => string;
  formatDate: (iso: string, withTime?: boolean) => string;
}

const UiLanguageContext = createContext<UiLanguageContextValue>({
  uiLang: 'en',
  setUiLang: () => {},
  t: (en) => en,
  formatDate: (iso) => new Date(iso).toLocaleDateString('en-US'),
});

export const UiLanguageProvider: React.FC<{
  defaultLanguage?: UiLang;
  children: React.ReactNode;
}> = ({ defaultLanguage = 'en', children }) => {
  const [uiLang, setUiLangState] = useState<UiLang>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'bn') {
        return saved;
      }
    }
    return defaultLanguage === 'bn' ? 'bn' : 'en';
  });

  // Sync with server defaultLanguage if user hasn't manually overridden in this browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setUiLangState(defaultLanguage === 'bn' ? 'bn' : 'en');
      }
    }
  }, [defaultLanguage]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = uiLang;
    }
  }, [uiLang]);

  const setUiLang = useCallback((lang: UiLang) => {
    setUiLangState(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, lang);
    }
  }, []);

  const t = useCallback(
    (en: string, bn: string) => (uiLang === 'bn' ? bn : en),
    [uiLang]
  );

  const formatDate = useCallback(
    (iso: string, withTime = false) => {
      const locale = uiLang === 'bn' ? 'bn-BD' : 'en-US';
      const d = new Date(iso);
      return withTime ? d.toLocaleString(locale) : d.toLocaleDateString(locale);
    },
    [uiLang]
  );

  return (
    <UiLanguageContext.Provider value={{ uiLang, setUiLang, t, formatDate }}>
      {children}
    </UiLanguageContext.Provider>
  );
};

export function useUiLanguage(): UiLanguageContextValue {
  return useContext(UiLanguageContext);
}
