/**
 * Languages the church preaches and sings in.
 *
 * Stored as a BCP-47-style code on sermons and songs so the same filter works for both.
 * South Africa's official languages come first because that is where most of the church is;
 * the rest are here because the overseer travels and the convocation recordings do not stay
 * in one country.
 */

export interface LanguageInfo {
  code: string;
  /** English name, for the filter. */
  name: string;
  /** The language's own name, shown alongside so speakers recognise it. */
  endonym?: string;
}

export const LANGUAGES = {
  en: { code: 'en', name: 'English' },
  af: { code: 'af', name: 'Afrikaans', endonym: 'Afrikaans' },
  zu: { code: 'zu', name: 'Zulu', endonym: 'isiZulu' },
  xh: { code: 'xh', name: 'Xhosa', endonym: 'isiXhosa' },
  nso: { code: 'nso', name: 'Northern Sotho', endonym: 'Sepedi' },
  st: { code: 'st', name: 'Southern Sotho', endonym: 'Sesotho' },
  tn: { code: 'tn', name: 'Tswana', endonym: 'Setswana' },
  ts: { code: 'ts', name: 'Tsonga', endonym: 'Xitsonga' },
  ss: { code: 'ss', name: 'Swati', endonym: 'siSwati' },
  ve: { code: 've', name: 'Venda', endonym: 'Tshivenḓa' },
  nr: { code: 'nr', name: 'Southern Ndebele', endonym: 'isiNdebele' },
  pt: { code: 'pt', name: 'Portuguese', endonym: 'Português' },
  fr: { code: 'fr', name: 'French', endonym: 'Français' },
  es: { code: 'es', name: 'Spanish', endonym: 'Español' },
  sw: { code: 'sw', name: 'Swahili', endonym: 'Kiswahili' },
} as const satisfies Record<string, LanguageInfo>;

export type LanguageCode = keyof typeof LANGUAGES;

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];

export function isKnownLanguage(code: string): code is LanguageCode {
  return Object.hasOwn(LANGUAGES, code.toLowerCase());
}

/** The language's details, or a stand-in built from the code so nothing renders blank. */
export function languageInfo(code: string): LanguageInfo {
  const lower = code.toLowerCase();
  if (isKnownLanguage(lower)) return LANGUAGES[lower];
  return { code: lower, name: lower.toUpperCase() };
}

export function languageName(code: string): string {
  return languageInfo(code).name;
}
