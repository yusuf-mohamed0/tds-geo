// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// ──────────────────────────────────────────────
// Locale Utilities — Multi-Language Support
// ──────────────────────────────────────────────

export interface LocaleConfig {
  code: string;
  name: string;
  nativeName: string;
  languageCode: string;       // For AI prompt language instruction
  serpLocale: string;         // For SerpAPI gl parameter
  serpHl: string;             // For SerpAPI hl parameter
  dataforseoLanguage: string; // For DataForSEO language_code
  dataforseoLocation: number; // For DataForSEO location_code
}

export const SUPPORTED_LOCALES: LocaleConfig[] = [
  { code: 'en', name: 'English', nativeName: 'English', languageCode: 'English', serpLocale: 'us', serpHl: 'en', dataforseoLanguage: 'en', dataforseoLocation: 2840 },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', languageCode: 'Arabic', serpLocale: 'ae', serpHl: 'ar', dataforseoLanguage: 'ar', dataforseoLocation: 302395 },
  { code: 'fr', name: 'French', nativeName: 'Français', languageCode: 'French', serpLocale: 'fr', serpHl: 'fr', dataforseoLanguage: 'fr', dataforseoLocation: 2256 },
  { code: 'de', name: 'German', nativeName: 'Deutsch', languageCode: 'German', serpLocale: 'de', serpHl: 'de', dataforseoLanguage: 'de', dataforseoLocation: 2826 },
  { code: 'es', name: 'Spanish', nativeName: 'Español', languageCode: 'Spanish', serpLocale: 'es', serpHl: 'es', dataforseoLanguage: 'es', dataforseoLocation: 2824 },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', languageCode: 'Portuguese', serpLocale: 'br', serpHl: 'pt', dataforseoLanguage: 'pt', dataforseoLocation: 2076 },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', languageCode: 'Italian', serpLocale: 'it', serpHl: 'it', dataforseoLanguage: 'it', dataforseoLocation: 2828 },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', languageCode: 'Dutch', serpLocale: 'nl', serpHl: 'nl', dataforseoLanguage: 'nl', dataforseoLocation: 2528 },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', languageCode: 'Turkish', serpLocale: 'tr', serpHl: 'tr', dataforseoLanguage: 'tr', dataforseoLocation: 2792 },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', languageCode: 'Russian', serpLocale: 'ru', serpHl: 'ru', dataforseoLanguage: 'ru', dataforseoLocation: 2648 },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', languageCode: 'Japanese', serpLocale: 'jp', serpHl: 'ja', dataforseoLanguage: 'ja', dataforseoLocation: 2392 },
  { code: 'zh', name: 'Chinese', nativeName: '中文', languageCode: 'Chinese', serpLocale: 'cn', serpHl: 'zh', dataforseoLanguage: 'zh', dataforseoLocation: 2156 },
  { code: 'ko', name: 'Korean', nativeName: '한국어', languageCode: 'Korean', serpLocale: 'kr', serpHl: 'ko', dataforseoLanguage: 'ko', dataforseoLocation: 2410 },
];

export function getLocaleConfig(code: string): LocaleConfig {
  return SUPPORTED_LOCALES.find(l => l.code === code) || SUPPORTED_LOCALES[0];
}

export function getLanguageName(code: string): string {
  const locale = getLocaleConfig(code);
  return `${locale.nativeName} (${locale.name})`;
}
