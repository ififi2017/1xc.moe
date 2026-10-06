import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { localizeHtml, LOCALES, DEFAULT_LOCALE } from './scripts/i18n-pages.mjs';

const localeForPath = (path) => LOCALES.find((l) => l.path !== '/' && path.startsWith(l.path));

// One template, one pre-rendered page per language: /, /zh-TW/, /zh-HK/, /ja/, /en/, /ko/
function i18nPages() {
  return {
    name: 'i18n-pages',
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split('?')[0];
        const bare = LOCALES.find((l) => l.path !== '/' && path === l.path.slice(0, -1));
        if (bare) { res.writeHead(301, { Location: bare.path }); return res.end(); }
        const locale = LOCALES.find((l) => l.path !== '/' && (path === l.path || path === `${l.path}index.html`));
        if (!locale) return next();
        const html = await server.transformIndexHtml(locale.path, readFileSync('index.html', 'utf8'));
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (ctx.path?.startsWith('/genshin/')) return html; // standalone page, not part of the i18n set
        return localizeHtml(html, localeForPath(ctx.path ?? '/')?.code ?? DEFAULT_LOCALE);
      },
    },
    generateBundle(_, bundle) {
      const page = bundle['index.html'];
      if (!page) return;
      for (const locale of LOCALES.filter((l) => l.path !== '/')) {
        this.emitFile({ type: 'asset', fileName: `${locale.path.slice(1)}index.html`, source: localizeHtml(String(page.source), locale.code) });
      }
    },
  };
}

export default defineConfig({
  plugins: [i18nPages()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', genshin: 'genshin/index.html' },
    },
  },
});
