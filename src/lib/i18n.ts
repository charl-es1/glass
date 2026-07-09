export interface Language {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English (en)' },
  { code: 'fr', name: 'French (fr)' },
  { code: 'es', name: 'Spanish (es)' },
  { code: 'de', name: 'German (de)' },
];

export const DEFAULT_LANGUAGE = 'en';
