# 1xc.moe

河南猫娘「猫猫」的小窝 —— 以三视图和面部设定图为参考的 Galgame 式 2D 互动立绘。角色设定来自 [hybrid-catgirl-skill](https://github.com/ififi2017/hybrid-catgirl-skill)。

- **rua 系统**：摸头、挠下巴、碰耳朵、甩尾巴、戳铃铛，各有不同反应（全部限于 L1–L3）
- **多语言**：简体中文（河南、北京、四川、东北、天津、普通话六种方言）、繁體中文（台灣口語）、繁體中文（香港粵語）、日本語、English、한국어，每种语言一个独立网址
- **寂寞小猫**：一段时间不理她，会递进地喊你，最后睡着冒 Zzz
- **说话**：气泡里的字像打字机一样逐个出现，每个字配一声短短的「哔」，标点停顿、颜文字不出声
- **标签页标题**：切到别的标签页后，标题会换成寂寞小猫的台词，每 20 秒换一句，最后睡着
- **彩蛋**：键盘敲 `1xc` / `moe` / `nya`
- **分层立绘**：待机、挥手、托腮、欢呼、抱尾巴五套独立分层；每套有专属五官与刘海，支持眨眼、说话、180ms 姿势切换和按需预载（详见 [分层说明](docs/sprite-layers.md)）

## 开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 输出到 dist/，每种语言一个页面
npm run fonts    # 改了文案或台词后重新生成各语言的字体子集
npm test         # 立绘资源、表情状态和命中坐标的回归检查
```

技术栈：Vite + 原生 JS + Canvas 2D，所有音效都是 Web Audio 实时合成的，没有音频文件。

| 文件 | 内容 |
|---|---|
| `src/sprite-art.js` | 五官图集、脸部坐标、刘海遮罩和分层绘制 |
| `src/sprite-character.js` | 表情优先级、眨眼、动作和命中坐标 |
| `src/sprite-stage.js` | 图片加载、Canvas 渲染、透明区域命中和粒子 |
| `src/lines.js` | 简体中文页的方言台词 |
| `src/i18n/` | 各语言的界面文案和台词，`locales.js` 是语言清单 |
| `scripts/i18n-pages.mjs` | 把 `index.html` 渲染成各语言页面（Vite 插件在开发和构建时调用） |
| `scripts/build-fonts.mjs` | 按语言生成寒蝉圆黑体子集和 `src/fonts.css` |
| `src/audio.js` | 合成音效（喵、铃铛、呼噜） |
| `src/main.js` | 交互、寂寞小猫计时、方言切换、彩蛋 |

开发模式下控制台里有 `window.__1xc` 调试接口（生产构建会去掉）。

分层方案与资源说明见 [docs/sprite-layers.md](docs/sprite-layers.md)。本地 `/sprite-preview.html` 可并排校准原图和全部表情。

## 发布流程

从 `main` 开新分支 → 提 PR（CI 会构建并跑一次 `wrangler deploy --dry-run`）→ 合并到 `main` 后 GitHub Actions 自动部署到 1xc.moe（Cloudflare Workers 静态资源）。

需要的仓库 Secrets：`CLOUDFLARE_API_TOKEN`（模板「Edit Cloudflare Workers」）、`CLOUDFLARE_ACCOUNT_ID`。

## 多语言

| 语言 | 网址 |
|---|---|
| 简体中文（含方言） | `/` |
| 繁體中文（台灣） | `/zh-TW/` |
| 繁體中文（香港，粵語） | `/zh-HK/` |
| 日本語 | `/ja/` |
| English | `/en/` |
| 한국어 | `/ko/` |

- `index.html` 是唯一的模板：需要翻译的地方写 `data-i18n="键名"`（文字）或 `data-i18n-attr="属性:键名"`（属性），构建时按语言生成各自的页面，带 `lang`、canonical、hreflang 和 Open Graph
- 新增一种语言：在 `src/i18n/locales.js` 加一行，新建 `src/i18n/<语言>.js`（`ui` 和 `lines` 两部分），然后跑 `npm run fonts`；`npm test` 会检查文案和台词有没有漏项
- 浏览器语言和当前页面不一致时，只显示一个可关闭的提示，不自动跳转
