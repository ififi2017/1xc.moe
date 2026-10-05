# 1xc.moe

一小撮软乎乎的萌物 —— 「1」「x」「c」三只 3D 果冻小家伙。纯静态页面（Three.js via CDN），无需构建。

- 本地预览：`python3 -m http.server 5173 -d public`
- 部署（Cloudflare Workers 静态资源）：`npx wrangler deploy`

## 发布流程

从 `main` 开新分支 → 提 PR（CI 会跑一次 `wrangler deploy --dry-run` 检查）→ 合并到 `main` 后 GitHub Actions 自动部署到 1xc.moe。

需要的仓库 Secrets：`CLOUDFLARE_API_TOKEN`（模板「Edit Cloudflare Workers」）、`CLOUDFLARE_ACCOUNT_ID`。
