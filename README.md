# 1xc.moe

河南猫娘「猫猫」的小窝 —— 以三视图和面部设定图为参考的 Galgame 式 2D 互动立绘。角色设定来自 [hybrid-catgirl-skill](https://github.com/ififi2017/hybrid-catgirl-skill)。

- **rua 系统**：摸头、挠下巴、碰耳朵、甩尾巴、戳铃铛，各有不同反应（全部限于 L1–L3）
- **七种方言**：河南（默认）、北京、四川、东北、天津、中日双语、普通话
- **寂寞小猫**：一段时间不理她，会递进地喊你，最后睡着冒 Zzz
- **彩蛋**：键盘敲 `1xc` / `moe` / `nya`
- **分层立绘**：三张贴图合成身体、12 种五官表情和前景刘海；独立眨眼、说话口型、呼吸、轻蹭和弹跳

## 开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 输出到 dist/
npm test         # 立绘资源、表情状态和命中坐标的回归检查
```

技术栈：Vite + 原生 JS + Canvas 2D，所有音效都是 Web Audio 实时合成的，没有音频文件。

| 文件 | 内容 |
|---|---|
| `src/sprite-art.js` | 五官图集、脸部坐标、刘海遮罩和分层绘制 |
| `src/sprite-character.js` | 表情优先级、眨眼、动作和命中坐标 |
| `src/sprite-stage.js` | 图片加载、Canvas 渲染、透明区域命中和粒子 |
| `src/lines.js` | 七种方言的台词 |
| `src/audio.js` | 合成音效（喵、铃铛、呼噜） |
| `src/main.js` | 交互、寂寞小猫计时、方言切换、彩蛋 |

开发模式下控制台里有 `window.__1xc` 调试接口（生产构建会去掉）。

分层方案与资源说明见 [docs/sprite-layers.md](docs/sprite-layers.md)。本地 `/sprite-preview.html` 可并排校准原图和全部表情。

## 发布流程

从 `main` 开新分支 → 提 PR（CI 会构建并跑一次 `wrangler deploy --dry-run`）→ 合并到 `main` 后 GitHub Actions 自动部署到 1xc.moe（Cloudflare Workers 静态资源）。

需要的仓库 Secrets：`CLOUDFLARE_API_TOKEN`（模板「Edit Cloudflare Workers」）、`CLOUDFLARE_ACCOUNT_ID`。
