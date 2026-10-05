// Every language version of the site. Each gets its own pre-rendered page at
// `path` (see scripts/i18n-pages.mjs); zh-CN additionally has the dialects in
// src/lines.js.
export const SITE = 'https://1xc.moe';

export const LOCALES = [
  { code: 'zh-CN', path: '/', label: '简体中文', short: '简', og: 'zh_CN' },
  { code: 'zh-TW', path: '/zh-TW/', label: '繁體中文（台灣）', short: '台', og: 'zh_TW' },
  { code: 'zh-HK', path: '/zh-HK/', label: '繁體中文（香港）', short: '港', og: 'zh_HK' },
  { code: 'ja', path: '/ja/', label: '日本語', short: '日', og: 'ja_JP' },
  { code: 'en', path: '/en/', label: 'English', short: 'EN', og: 'en_US' },
  { code: 'ko', path: '/ko/', label: '한국어', short: '한', og: 'ko_KR' },
];
export const DEFAULT_LOCALE = 'zh-CN';

export const localeByCode = (code) => LOCALES.find((l) => l.code === code) ?? LOCALES[0];

// best match for the browser's preferred languages, or null
export function preferredLocale(languages = []) {
  for (const raw of languages) {
    const lang = raw.toLowerCase();
    if (/^zh-(tw|hant-tw)/.test(lang)) return 'zh-TW';
    if (/^zh-(hk|mo|hant)/.test(lang)) return 'zh-HK';
    if (lang.startsWith('zh')) return 'zh-CN';
    for (const code of ['ja', 'en', 'ko']) if (lang.startsWith(code)) return code;
  }
  return null;
}
