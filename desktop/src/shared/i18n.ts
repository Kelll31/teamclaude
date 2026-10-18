// Translation for both processes. The renderer and the main process (tray,
// notifications, action results) read the same catalogues, so a language
// switch changes every string the user sees.

import { en, type MessageKey } from './locales/en';
import { ja } from './locales/ja';
import { ru } from './locales/ru';

export type { MessageKey };
export type Language = 'en' | 'ru' | 'ja';
export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;

export const LANGUAGES: Array<{ code: Language; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
];

const CATALOGUES: Record<Language, Record<MessageKey, string>> = { en, ru, ja };

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ru' || value === 'ja';
}

/** The supported language closest to a system locale ("ru-RU" → "ru"), English otherwise. */
export function languageForLocale(locale: string | null | undefined): Language {
  const base = (locale ?? '').toLowerCase().split(/[-_]/)[0];
  return isLanguage(base) ? base : 'en';
}

export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function translator(language: string): Translate {
  const catalogue = CATALOGUES[isLanguage(language) ? language : 'en'];
  return (key, vars) => format(catalogue[key] ?? en[key], vars);
}
