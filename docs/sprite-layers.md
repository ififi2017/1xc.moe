# 2D 姿势立绘分层

主站使用 Canvas 2D。每个姿势拥有独立的底图、表情图集、刘海原稿、脸部坐标和命中区域；不跨姿势借用面部资源。

## 资源与表情

资源位于 `public/sprites/<pose>/`。所有 WebP 保留透明通道；底图和原稿都是 1024 × 1536。大小使用十进制 KB（1 KB = 1000 bytes）。

| 姿势 | base | face_atlas | hair_front | 合计 | 图集网格 / 尺寸 | 表情，按格子顺序 |
|---|---:|---:|---:|---:|---|---|
| idle | 238.8 KB | 218.3 KB | 251.3 KB | 708.4 KB | 3×4 / 1254×1254 | smile、blink、talk、happy、content、sleep、pout、surprised、sulky、coax、wink、shy |
| wave | 240.5 KB | 39.6 KB | 240.5 KB | 520.5 KB | 3×2 / 1020×540 | smile、happy、talk、blink、wink；末格空白 |
| paws | 239.0 KB | 50.4 KB | 238.9 KB | 528.3 KB | 3×2 / 1050×560 | content、coax、shy、happy、talk、blink |
| cheer | 244.0 KB | 33.8 KB | 262.1 KB | 539.9 KB | 2×2 / 650×520 | happy、talk、surprised、blink |
| tail | 211.2 KB | 32.7 KB | 219.7 KB | 463.6 KB | 2×2 / 650×530 | sulky、coax、talk、blink |

`base.webp` 是无五官、去掉中央刘海的底图。`hair_front.webp` 保存完整原稿，绘制时只通过该姿势的刘海路径采样，因此也可用于原稿对照。合成顺序：底图 → 眉毛 / 双眼 / 嘴 → 刘海。

`src/sprite-art.js` 导出 `POSES`，四个新姿势的数据在 `src/sprite-pose-data.js` 中。每项包含 `layers`、`faceRect`、`parts`、`hair`、`grid`、`frames`、`fallback`、`zones` 和 `headTop`。`resolveExpression(pose, expression)` 只沿当前姿势的回退表查找；未知表情落到该姿势的默认表情。

眉毛、眼睛和嘴分别组合。说话仅替换嘴，眨眼仅替换双眼；当前表情的眉毛保留。新姿势的源图集经过逐部位配准，所有格子使用固定的五官锚点。idle 沿用原有分区和表情逻辑；额外修正了用户指出的 talk 口型偏左和倾斜问题：将源嘴角中心 `(230.5, 256.5)` 对齐到微笑的 `(246, 260.5)`，顺时针校正 `0.12 rad`，保留原先 58% 的口型比例。

## 姿势状态

| 触发 | 姿势 / 时长 |
|---|---|
| 打招呼、主人回来、切换方言 | wave，1.6 秒 |
| 抚摸、挠下巴 | paws，最后一次抚摸后 1.5 秒 |
| 撒娇、害羞反应 | paws，随反应计时 |
| 寂寞 1–2 段 | paws，持续 |
| 寂寞 3–4 段 | tail，持续到叫醒 / 状态改变 |
| `1xc`、心雨 | cheer，2.6 秒 |
| 寂寞 5 段 | idle + sleep |

优先级：睡眠 > 欢呼 > 触摸反应 > 挥手 > 持续寂寞状态。临时动作结束后回到持续状态，通常为 idle；如果尚未叫醒寂寞状态，则恢复 paws / tail。新姿势停留期间仍能眨眼和说话。减少动态效果时保留表情切换，禁用身体微动、刘海摆动、粒子和姿势淡入淡出。

## 加载与合成

`src/sprite-loader.js` 合并重复加载请求。三张图全部解码成功才发布整套姿势；失败不会发布部分图片，可在下一次触发时重试。

首屏只等待 idle。首帧之后经过两次 requestAnimationFrame，再在空闲回调中依次预载其他姿势。资源未就绪时显示 idle，动作计时从实际呈现后开始；请求被睡眠、叫醒或更高优先级动作替换后，迟到的资源不会切回旧姿势。

每帧先在离屏 Canvas 中合成完整人物，再用 180 ms 交叉淡入淡出切换。使用预乘透明度相加，避免两张半透明人物重叠时中间变淡。快速连续切换会保存当时已经合成的画面作为淡出源。静态五官组合被缓存，呼吸和轻晃仍作用于整张人物。

命中判定先反变换到当前姿势坐标，再采样该姿势底图的透明通道，最后查它自己的区域。托腮手掌使用多边形，袖子和手掌算 body，狭窄的项圈铃铛不作为点击目标；欢呼举起的手也算 body。区域优先级按配置顺序。

## 原稿与重打包

- `assets/sprite-sources/<pose>/original.png`：新姿势完整原稿。
- 同目录 `base.png`、`atlas.png`：从该原稿通过图片编辑模式派生的源图。
- `paws/original-sleeved.png`：最初袖子包手版本；用户要求露手后再次编辑，最终版为 `paws/original.png`。
- `assets/sprite-sources/idle/*.webp`：迁移前的压缩母版。
- `docs/sprite-generation.json`：每张实际使用的 prompt、输入图和源图记录。
- `scripts/pack-sprite-poses.py`：Pillow 配准 / WebP 打包脚本。不是生成工具。

安装 Pillow 后运行 `python3 scripts/pack-sprite-poses.py`。压缩质量 90、method 6；alpha < 8 清零，并清除透明像素的 RGB。原稿 PNG 不进入 public。写入使用临时文件和原子替换，防止开发服务器读到编码中的空文件。每套资源超出 800,000 bytes 时脚本报错。

## 开发验收

- `/sprite-preview.html`：五个姿势分组显示原稿、全部表情，可切换面部放大 / 完整人物 / 底图；下方有动作与说话测试。
- `/sprite-responsive.html`：嵌入实际 1280×800 或 375×812 主站视口；支持减少动态效果、原尺寸查看。外层缩放不改变被测视口。
- `/?sprite-test=1`：仅开发环境显示验收控件。生产构建没有测试面板。
- 「固定姿势」用于查看静态画面，同时暂停自动寂寞递进；取消后重新触发动作可测试正常时长。
- 「校验命中区域」逐点调用真实 stage.zoneAt，包含当前底图 alpha 检查和透明角落检查。

2026-10-06 验证：`npm test` 17 项通过；`npm run build` 通过。四套新姿势的所有表情已逐张对照。桌面和手机均检查了姿势显示、切换、命中区域；wave 9/9、paws 10/10、cheer 11/11、tail 10/10。减少动态效果、睡眠→叫醒及真实键盘 `1xc` 彩蛋也已检查。截图位于 `docs/qa/sprite-poses/`。

仍可精修：新表情的眼睛比原稿略饱满；tail 的委屈与撒娇差异较细；欢呼的头部后仰比较克制。动作以姿势差分、整套淡入淡出和小幅身体微动呈现，手臂没有逐帧摆动动画。发丝微动幅度保持很小，以限制刘海边缘露缝。

## 工作区交接（Claude 验收）

分支 `feat/sprite-poses`，在 PR #5 的分层立绘基础上实现并同步最新 `main`，通过 PR 交给 Claude 验收。

修改文件：

- `src/sprite-art.js`、`src/sprite-character.js`、`src/sprite-stage.js`、`src/main.js`
- `tests/sprite.test.js`、`sprite-preview.html`
- `README.md`、`docs/sprite-layers.md`、`docs/sprite-generation.json`

新增文件：

- `src/sprite-pose-data.js`、`src/sprite-loader.js`、`src/sprite-debug.js`
- `sprite-responsive.html`、`scripts/pack-sprite-poses.py`
- `public/sprites/{idle,wave,paws,cheer,tail}/{base,face_atlas,hair_front}.webp`，共 15 张；旧 `public/sprites/layers/` 三张资源迁移到 idle。
- `assets/sprite-sources/{wave,paws,cheer,tail}/{original,base,atlas}.png`；另有 `paws/original-sleeved.png` 与 `idle/{base,face_atlas,hair_front}.webp`。
- `assets/sprite-sources/{generation,layers-generation,registration}.json`，保留生成阶段记录和配准参数。
- `docs/qa/sprite-poses/{desktop,mobile}-{wave,paws,cheer,tail}.png`、`idle-mouth-alignment.png`。

建议 Claude 先看分组预览中的原稿 / 表情对照，再打开尺寸验收页。取消「固定姿势」后重新触发动作，确认正常恢复；保持勾选时可逐个核对细节。美术可继续打磨的点见上一节。
