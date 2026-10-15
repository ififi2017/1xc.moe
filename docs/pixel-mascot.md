# 安装卡片像素猫

`src/adoption-cat.js` 在「领养一只猫猫」卡片中播放一次比心：点击猫猫，或安装提示词复制成功时触发。3.6 秒后回到待机；再次点击从头播放。复制失败时保留手动复制提示，不触发成功动画。

桌面端放在卡片右侧，700px 以下放在复制区域下方居中。支持键盘按钮操作；减少动态效果时只短暂展示比心静帧。页面进入后台时终止播放。

## 资源

`public/pixel-cat/{idle,raise,near,heart}.webp` 均为 1024×1536，保留透明通道，WebP 质量 90。来自已完成的 Aseprite 合成帧 `assets/pixel-cat/heart-animation/check-{01,02,03,04}.png`，沿用固定头发、脸和脚部的版本。原画与姿势的生成记录归档于 `docs/pixel-mascot-generation.json`。原始试作文件保留在本地 `assets/pixel-cat/`，网页不依赖该目录。

可以用 `cwebp -q 90 -alpha_q 100 输入.png -o 输出.webp` 重新编码，不缩放分辨率。

待机图使用原生延迟加载，另外三张图在卡片即将进入视口时预加载。网页通过 Canvas 合成关键帧和像素爱心、闪光，无需下载完整 GIF/APNG。爱心与闪光的像素图案和轨迹沿用比心动画脚本。
