"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  translateDocumentTitle,
  translateText,
  type Locale,
} from "@/lib/i18n";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  locales: typeof LOCALES;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const ATTRS = [
  "placeholder",
  "title",
  "aria-label",
  "alt",
  "aria-description",
  "data-tooltip",
  "content",
];
const SKIP_SELECTOR = [
  "script",
  "style",
  "noscript",
  "head title",
  "textarea",
  "code",
  "pre",
  "[contenteditable='true']",
  ".ProseMirror",
  ".prose",
  "[data-no-translate]",
].join(",");

const textOriginal = new WeakMap<Text, string>();
const textTranslated = new WeakMap<Text, string>();
const attrOriginal = new WeakMap<Element, Record<string, string>>();
const attrTranslated = new WeakMap<Element, Record<string, string>>();

let lastTitle = "";
let originalTitle = "";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function skipped(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return Boolean(element?.closest(SKIP_SELECTOR));
}

function translateTextNode(node: Text, locale: Locale) {
  if (skipped(node)) return;

  const current = node.nodeValue ?? "";
  if (!current) return;

  const previous = textTranslated.get(node);
  const original =
    previous !== undefined && current === previous ? (textOriginal.get(node) ?? current) : current;
  textOriginal.set(node, original);

  const translated = translateText(original, locale);
  if (translated !== null && translated !== original) {
    if (node.nodeValue !== translated) node.nodeValue = translated;
    textTranslated.set(node, translated);
  } else {
    if (node.nodeValue !== original) node.nodeValue = original;
    textTranslated.delete(node);
  }
}

function translateAttribute(element: Element, attribute: string, locale: Locale) {
  const current = element.getAttribute(attribute);
  if (current === null) return;

  const originals = attrOriginal.get(element) ?? {};
  const translatedMap = attrTranslated.get(element) ?? {};
  const previous = translatedMap[attribute];
  const original =
    previous !== undefined && current === previous ? (originals[attribute] ?? current) : current;
  originals[attribute] = original;
  attrOriginal.set(element, originals);

  const translated = translateText(original, locale);
  if (translated !== null && translated !== original) {
    if (current !== translated) element.setAttribute(attribute, translated);
    translatedMap[attribute] = translated;
  } else {
    if (current !== original) element.setAttribute(attribute, original);
    delete translatedMap[attribute];
  }
  attrTranslated.set(element, translatedMap);
}

function translateAttributes(element: Element, locale: Locale) {
  const isTextarea = element instanceof HTMLTextAreaElement;
  if (!isTextarea && skipped(element)) return;
  if (element.closest("[data-no-translate]")) return;

  const attributes =
    element instanceof HTMLInputElement && ["submit", "button", "reset"].includes(element.type)
      ? [...ATTRS, "value"]
      : isTextarea
        ? ["placeholder", "aria-label", "title"]
        : ATTRS;

  for (const attribute of attributes) translateAttribute(element, attribute, locale);
}

function translateSubtree(root: Node, locale: Locale) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale);
    return;
  }

  if (
    root.nodeType !== Node.ELEMENT_NODE &&
    root.nodeType !== Node.DOCUMENT_NODE &&
    root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
  ) {
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    translateAttributes(root as Element, locale);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text, locale);
    } else {
      translateAttributes(node as Element, locale);
    }
    node = walker.nextNode();
  }
}

function translatePageTitle(locale: Locale) {
  const current = document.title;
  if (current !== lastTitle) originalTitle = current;

  const translated = translateDocumentTitle(originalTitle, locale);
  const next = translated ?? originalTitle;
  if (document.title !== next) document.title = next;
  lastTitle = next;
}

function observe(observer: MutationObserver) {
  const options: MutationObserverInit = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS, "value"],
  };
  observer.observe(document.body, options);
  observer.observe(document.head, options);
}

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const localeRef = useRef(locale);
  const observerRef = useRef<MutationObserver | null>(null);

  const apply = useCallback((next: Locale) => {
    const observer = observerRef.current;
    observer?.disconnect();
    try {
      document.documentElement.lang = next;
      document.documentElement.dataset.locale = next;
      translateSubtree(document.body, next);
      translateSubtree(document.head, next);
      translatePageTitle(next);
    } finally {
      if (observer) observe(observer);
    }
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      localeRef.current = next;
      setLocaleState(next);
      apply(next);
    },
    [apply],
  );

  useIsomorphicLayoutEffect(() => {
    localeRef.current = locale;
    apply(locale);
  }, [apply, locale]);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      const current = localeRef.current;
      if (current === DEFAULT_LOCALE) return;

      observer.disconnect();
      try {
        for (const mutation of mutations) {
          if (mutation.type === "characterData") {
            if (mutation.target.nodeType === Node.TEXT_NODE) {
              translateTextNode(mutation.target as Text, current);
            }
          } else if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => translateSubtree(node, current));
          } else if (
            mutation.type === "attributes" &&
            mutation.target.nodeType === Node.ELEMENT_NODE
          ) {
            translateAttributes(mutation.target as Element, current);
          }
        }
        translatePageTitle(current);
      } finally {
        observe(observer);
      }
    });

    observerRef.current = observer;
    observe(observer);
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({ locale, setLocale, locales: LOCALES }), [locale, setLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLocale() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLocale must be used within LanguageProvider");
  return context;
}
