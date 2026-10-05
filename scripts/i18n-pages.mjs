// Renders index.html for one locale: fills every [data-i18n] / [data-i18n-attr]
// from src/i18n, sets <html lang>, canonical + hreflang links, Open Graph tags
// and the locale's font preload. Used by the Vite plugin (dev + build) and tests.
import { parse } from 'node-html-parser';
import { LOCALES, SITE, DEFAULT_LOCALE, MESSAGES } from '../src/i18n/index.js';

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escape(s).replace(/"/g, '&quot;');

export function localizeHtml(html, code) {
  const locale = LOCALES.find((l) => l.code === code);
  if (!locale) throw new Error(`unknown locale ${code}`);
  const ui = MESSAGES[code].ui;
  const root = parse(html, { comment: true });
  const need = (key) => {
    if (ui[key] === undefined) throw new Error(`${code}: missing ui.${key}`);
    return ui[key];
  };

  root.querySelector('html').setAttribute('lang', code);
  for (const el of root.querySelectorAll('[data-i18n]')) el.set_content(escape(need(el.getAttribute('data-i18n'))));
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.getAttribute('data-i18n-attr').split(',')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      el.setAttribute(attr, need(key));
    }
  }

  const head = root.querySelector('head');
  head.querySelectorAll('link[rel="canonical"], link[rel="alternate"], meta[property^="og:url"], meta[property^="og:locale"]')
    .forEach((el) => el.remove());
  const tags = [
    `<link rel="canonical" href="${SITE}${locale.path}" />`,
    ...LOCALES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${SITE}${l.path}" />`),
    `<link rel="alternate" hreflang="x-default" href="${SITE}${LOCALES.find((l) => l.code === DEFAULT_LOCALE).path}" />`,
    `<meta property="og:url" content="${SITE}${locale.path}" />`,
    `<meta property="og:locale" content="${locale.og}" />`,
    ...LOCALES.filter((l) => l !== locale).map((l) => `<meta property="og:locale:alternate" content="${l.og}" />`),
  ];
  head.insertAdjacentHTML('beforeend', `\n  ${tags.join('\n  ')}\n`);

  const preload = root.querySelector('#fontPreload');
  if (preload) preload.setAttribute('href', `/fonts/1xc-rounded-${code}-700.woff2`);
  return root.toString();
}

// every visible string a locale's page can show, for font subsetting
export function localeText(html, code) {
  const root = parse(localizeHtml(html, code));
  root.querySelectorAll('script, style').forEach((el) => el.remove());
  const attrs = root.querySelectorAll('[data-i18n-attr]').map((el) =>
    el.getAttribute('data-i18n-attr').split(',').map((p) => el.getAttribute(p.split(':')[0].trim())).join(''));
  return root.text + attrs.join('');
}

export { LOCALES, DEFAULT_LOCALE, escapeAttr };
