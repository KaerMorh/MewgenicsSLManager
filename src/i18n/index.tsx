import React, { createContext, useContext, useState, useCallback } from "react";
import zh from "./zh";
import en from "./en";

export type Lang = "zh" | "en";

const dictionaries: Record<Lang, Record<string, string>> = { zh, en };

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>(null!);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem("meowloader-lang") as Lang) || "zh";
  });

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem("meowloader-lang", l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let text = dictionaries[lang]?.[key] ?? dictionaries["zh"]?.[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.split(`{${k}}`).join(String(v));
        }
      }
      return text;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
