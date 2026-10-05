# 1xc 立绘差分 Prompt

网站改成 Galgame 式 2D 立绘：一张底图 + 若干表情 / 姿势差分，按互动切换，再叠上呼吸、弹跳、眨眼、说话口型这些轻量动画。

## 一、出图规格（所有图都必须一致）

| 项目 | 要求 |
|---|---|
| 尺寸 | **1024 × 1536**（竖版 2:3），PNG |
| 背景 | **透明**（不支持透明的工具就用纯白 `#FFFFFF`，我来抠） |
| 构图 | **膝上立绘**（头顶猫耳到大腿中部），正面略带 3/4 侧，人物水平居中 |
| 位置 | 猫耳尖距顶部约 4%，头顶位置、身体大小、站位在所有差分里**完全不变** |
| 光照 | 柔和正面光，左上方主光，无投影、无地面 |
| 画风 | 和设定图一致：日系赛璐璐 + 柔和厚涂，淡色线稿 |

**最重要的一条：先生成一张满意的底图，之后所有差分都用「图生图 / 编辑」模式，把底图作为输入，只改表情或姿势。** 每张都从零生成的话，脸和衣服细节每次都会变，切换差分时就会「换了个人」。

推荐流程：
1. 把三视图和面部设定图作为参考图，生成底图 `idle_smile`，挑到满意为止
2. 表情差分：上传底图，用编辑 / 局部重绘只改脸部区域
3. 姿势差分：上传底图，改手臂姿势，要求脸、头发、衣服保持一致
4. 每张导出后检查：叠在底图上来回切换，人物不能跳位

## 二、角色描述（每条 Prompt 都要带上）

```
1xc, an original catgirl character, adult young woman (18+), petite, soft and gentle.
Hair: short fluffy messy bob, silky white at the roots fading into soft lilac / lavender at the tips, one curly ahoge on top, a thin lock of bangs falling between the eyes, side locks framing the cheeks.
Ears: large fluffy white cat ears with pink inner ears and white fur tufts.
Eyes: warm amber-gold eyes with dark brown upper lashes, gentle and slightly droopy, natural anime proportions (not oversized).
Face: soft round face, small nose shown only as a tiny highlight, small mouth, rosy blush on the cheeks.
Accessories: white paw-print hair clip with pink pads on her left side of the bangs; black leather choker with a small gold buckle and a gold cat bell.
Outfit: oversized cream cable-knit cardigan worn slightly off the shoulders, long sleeves covering her hands like sweater paws, pink paw prints on the sleeves, lavender ribbon lacing on the sides; lilac camisole dress with a frilly hem underneath; white knit leg warmers with lilac bows.
Tail: long fluffy white cat tail curving up behind her, with a lilac ribbon bow and a small gold bell near the tip.
```

**画风后缀**（也每条都带）：

```
Japanese visual novel character sprite, galgame tachie, knee-up shot, centered, facing the viewer at a slight three-quarter angle, clean soft cel shading with gentle painterly highlights, light pastel palette (cream, white, lilac, soft pink, gold accents), thin warm-colored lineart, soft frontal lighting from the upper left, transparent background, no shadow, no floor, no text, no watermark, consistent character design, high detail on face and hair.
```

**反向提示词**（支持的工具填进去）：

```
oversized eyes, chibi, deformed hands, extra fingers, extra ears, human ears, cropped head, cropped ears, background scenery, floor, cast shadow, text, watermark, signature, blurry, inconsistent outfit, revealing clothing
```

## 三、底图（先做这一张）

### `idle_smile` 待机 · 微笑

```
[角色描述]
Pose: standing relaxed, both hands tucked inside her long sweater sleeves and held together in front of her chest, shoulders slightly raised in a shy, cosy way, tail curving up to her right.
Expression: gentle closed-mouth smile, eyes softly open looking at the viewer, light blush.
[画风后缀]
```

## 四、表情差分（基于底图编辑，只改脸）

每条都用这个开头，后面接具体表情：

```
Edit this image. Keep the character, hair, ears, outfit, pose, framing, colors and lighting exactly identical. Change only the facial expression (eyes, eyebrows, mouth, blush) to:
```

| 文件名 | 表情 | 网站里什么时候用 | 接在开头后面的描述 |
|---|---|---|---|
| `idle_blink` | 闭眼（眨眼帧） | 每隔几秒自动眨眼 | `eyes gently closed mid-blink, relaxed neutral smile, nothing else changed.` |
| `idle_talk` | 说话口型 | 说话气泡出现时和 `idle_smile` 来回切 | `same gentle smile but mouth slightly open as if speaking softly.` |
| `idle_happy` | 开心 | 戳身体、戳铃铛 | `bright happy smile with eyes closed into upward arcs (^ ^), mouth open in a cheerful laugh, rosy blush.` |
| `idle_wink` | 眨眼 wink | 彩蛋、偶尔卖萌 | `playful wink with her left eye closed, cheeky smile, small sparkle near the open eye.` |
| `idle_shy` | 害羞 | 被夸、刚开始摸头 | `shy flustered look, eyes glancing aside, strong blush across cheeks and nose, small wavy embarrassed mouth.` |
| `idle_content` | 眯眼享受 | 摸头、挠下巴（呼噜） | `blissful content expression, eyes closed in relaxed curves, soft smile, deep blush, as if purring while being petted.` |
| `idle_pout` | 生气（鼓腮） | 戳脑壳 | `cute pouty anger, puffed cheeks, eyebrows slightly furrowed, eyes half-lidded glaring, small anger mark (💢) near her head.` |
| `idle_surprised` | 惊讶 | 碰耳朵、碰尾巴 | `startled surprise, eyes wide open, small round open mouth, ears perked up straight, a tiny exclamation mark near her head.` |
| `idle_confused` | 疑惑 | 点空白处、切换方言 | `puzzled curious look, head tilted slightly, one eyebrow raised, small question mark near her head.` |
| `idle_sulky` | 委屈 | 寂寞小猫第 3–4 段 | `teary aggrieved look, eyebrows raised in the middle, eyes glossy with small tears at the corners, wobbly downturned mouth, ears drooping.` |
| `idle_coax` | 撒娇 | 寂寞小猫第 1–2 段 | `pleading clingy look, big glossy upturned eyes looking up at the viewer, small hopeful smile, blush.` |
| `idle_thinking` | 沉思 | 长时间待机 | `thoughtful dreamy look, eyes half-lidded gazing off to the side, lips softly closed.` |
| `idle_sleep` | 睡着 | 寂寞小猫第 5 段 | `sleeping peacefully, eyes closed, mouth slightly open, head tilted to one side, small "zzz" is NOT drawn (added by the website).` |

## 五、姿势差分（基于底图编辑，换手臂姿势）

开头：

```
Using this image as the reference, keep the same character, face, hair, outfit, colors, framing and size exactly. Change only her arm pose to:
```

| 文件名 | 姿势 | 什么时候用 | 描述 |
|---|---|---|---|
| `wave_happy` | 挥手 | 打招呼、主人回来 | `her right hand raised beside her head, waving with the sweater sleeve slipping down a little, left hand still in its sleeve at her chest. Expression: bright happy smile, eyes open.` |
| `paws_coax` | 双手托腮 | 撒娇、被摸头 | `both sweater-paw hands raised to her cheeks, cupping her face cutely. Expression: pleading clingy look with big glossy eyes and blush.` |
| `paws_content` | 双手托腮 · 享受 | 被摸头、挠下巴 | `both sweater-paw hands raised to her cheeks. Expression: blissful, eyes closed in relaxed curves, deep blush.` |
| `cheer_happy` | 举手欢呼 | 彩蛋 `1xc` | `both arms raised up in a cheerful "yay" pose, sleeves slipping down to her forearms, tail swishing. Expression: very happy, eyes closed (^ ^), open-mouth smile.` |

## 六、交付清单

最少 **6 张**就能上线，越多越生动：

- **必需**：`idle_smile`、`idle_blink`、`idle_talk`、`idle_happy`、`idle_content`、`idle_sleep`
- **推荐**：`idle_pout`、`idle_surprised`、`idle_sulky`、`idle_coax`、`wave_happy`
- **锦上添花**：其余表情和姿势

放到 `public/sprites/` 下，文件名按上表即可，例如 `public/sprites/idle_smile.png`。
