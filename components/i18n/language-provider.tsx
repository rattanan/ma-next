"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  isLocale,
  LANGUAGE_CHANGE_EVENT,
  LANGUAGE_STORAGE_KEY,
  translateUiText,
  type Locale,
} from "@/lib/i18n/translations";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (thai: string, english: string) => string;
};

type TranslationRecord = { source: string; rendered: string };

const LanguageContext = createContext<LanguageContextValue | null>(null);
const textRecords = new WeakMap<Text, TranslationRecord>();
const attributeRecords = new WeakMap<Element, Map<string, TranslationRecord>>();
const translatedAttributes = ["aria-label", "alt", "placeholder", "title"] as const;
const ignoredSelector = "[data-no-translate], script, style, code, pre, svg";

function getClientLocale(): Locale {
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

function shouldIgnore(element: Element | null) {
  return Boolean(element?.closest(ignoredSelector));
}

function translateTextNode(node: Text, locale: Locale) {
  if (shouldIgnore(node.parentElement)) return;
  const current = node.nodeValue ?? "";
  const previous = textRecords.get(node);
  const source = previous && current === previous.rendered ? previous.source : current;
  const rendered = translateUiText(source, locale);
  if (current !== rendered) node.nodeValue = rendered;
  textRecords.set(node, { source, rendered });
}

function translateElementAttributes(element: Element, locale: Locale) {
  if (shouldIgnore(element)) return;
  let records = attributeRecords.get(element);
  if (!records) {
    records = new Map();
    attributeRecords.set(element, records);
  }

  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    const previous = records.get(attribute);
    const source = previous && current === previous.rendered ? previous.source : current;
    const rendered = translateUiText(source, locale);
    if (current !== rendered) element.setAttribute(attribute, rendered);
    records.set(attribute, { source, rendered });
  }
}

function translateSubtree(root: Node, locale: Locale) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale);
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) translateElementAttributes(root as Element, locale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, locale);
    else translateElementAttributes(node as Element, locale);
    node = walker.nextNode();
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale);
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  }, []);

  const t = useCallback((thai: string, english: string) => locale === "th" ? thai : english, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  useEffect(() => {
    let frame = 0;
    const finishHydration = () => {
      frame = window.requestAnimationFrame(() => {
        setLocaleState(getClientLocale());
        setHydrated(true);
      });
    };
    if (document.readyState === "complete") finishHydration();
    else window.addEventListener("load", finishHydration, { once: true });

    const syncLocale = () => setLocaleState(getClientLocale());
    window.addEventListener("storage", syncLocale);
    window.addEventListener(LANGUAGE_CHANGE_EVENT, syncLocale);
    return () => {
      window.removeEventListener("load", finishHydration);
      window.removeEventListener("storage", syncLocale);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, syncLocale);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = locale;
    translateSubtree(document.documentElement, locale);

    let frame = 0;
    const observer = new MutationObserver((mutations) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        for (const mutation of mutations) {
          if (mutation.type === "characterData") translateSubtree(mutation.target, locale);
          else if (mutation.type === "attributes") translateElementAttributes(mutation.target as Element, locale);
          else mutation.addedNodes.forEach((node) => translateSubtree(node, locale));
        }
      });
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [hydrated, locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
