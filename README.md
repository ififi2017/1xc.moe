# 1xc.moe

河南猫娘「猫猫」的小窝 —— 以角色三视图为参考，用 Three.js 程序化构建的 3D 猫娘。角色设定来自 [hybrid-catgirl-skill](https://github.com/ififi2017/hybrid-catgirl-skill)。

- **rua 系统**：摸头、挠下巴、碰耳朵、甩尾巴、戳铃铛，各有不同反应（全部限于 L1–L3）
- **七种方言**：河南（默认）、北京、四川、东北、天津、中日双语、普通话
- **寂寞小猫**：一段时间不理她，会递进地喊你，最后睡着冒 Zzz
- **彩蛋**：键盘敲 `1xc` / `moe` / `nya`
- **造型预览**：切换正面、侧面、背面，以及近景／全身；分层白紫渐变短发、琥珀眼睛、针织外套、猫爪袖口、蝴蝶结和连续曲面尾巴

## 开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 输出到 dist/
npm test         # 几何、命中区域、转身、尾巴形变与表情回归检查
```

技术栈：Vite + 原生 JS + Three.js，所有音效都是 Web Audio 实时合成的，没有音频文件。

| 文件 | 内容 |
|---|---|
| `src/catgirl.js` | 猫猫的表情、物理、转身和动画 |
| `src/character-model.js` | 全身模型、服装配饰、互动区域和静态网格合并 |
| `src/character-assets.js` | 曲面几何、发束、脸部贴图和针织材质 |
| `src/lines.js` | 七种方言的台词 |
| `src/stage.js` | 渲染器、灯光、漂浮物、粒子 |
| `src/audio.js` | 合成音效（喵、铃铛、呼噜） |
| `src/main.js` | 交互、寂寞小猫计时、方言切换、彩蛋 |

开发模式下控制台里有 `window.__1xc` 调试接口（生产构建会去掉）。

## 发布流程

从 `main` 开新分支 → 提 PR（CI 会构建并跑一次 `wrangler deploy --dry-run`）→ 合并到 `main` 后 GitHub Actions 自动部署到 1xc.moe（Cloudflare Workers 静态资源）。

需要的仓库 Secrets：`CLOUDFLARE_API_TOKEN`（模板「Edit Cloudflare Workers」）、`CLOUDFLARE_ACCOUNT_ID`。
