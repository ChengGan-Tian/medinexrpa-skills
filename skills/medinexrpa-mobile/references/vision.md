# 视觉兜底：模板匹配与 OCR

界面树拿不到信息时（Flutter 自绘、游戏、Canvas、WebView 文字），再用视觉。

## 定位顺序

```text
界面树（desc / clickable / bounds 几何）
  → 模板匹配（图标、固定按钮、状态标记）
  → OCR（纯文字按钮）
  → 锚点 + 相对偏移（画布式布局）
```

先确认界面树是不是“真的空”：

- Flutter 的 `Semantics(label:)` 会落到 `content-desc`，不是 `text`。
- `MergeSemantics` / `ExcludeSemantics` 会合并节点，文字消失但 `bounds` 还在。
- 首帧可能还没建语义树，隔几百毫秒再 dump 一次。

能停在界面树就不要上视觉：界面树 100~200ms，模板匹配和 OCR 都更慢。

## 模板匹配

```js
const hit = await kit.findImage('assets/btn_confirm.png', { threshold: 0.9 });
if (hit) await device.tap(Math.round(hit.center.x), Math.round(hit.center.y));
```

模板图要求：

```text
同一设备、同一分辨率、同一主题、同一字体缩放、同一语言
只框控件本体，避开动态内容、半透明边缘、圆角阴影、渐变描边
优先选小而稳的特征：图标、角标、logo 一角
多分辨率/多主题分目录：assets/<宽>x<高>/<主题>/
```

阈值与区域：

```text
threshold 0.85 ~ 0.92，先 0.9
太高会漏检，太低会误检
命中多个且分数接近 = 模板不唯一，用 region 或与卡片的相对位置消歧
region 既提速又消歧义
```

## OCR

```js
const hit = await kit.findOcr('确定', { region: { x: 0, y: 600, width: 1200, height: 400 } });
await kit.tapOcr('确定');
```

```text
适合纯文字按钮，不适合数字、时间、昵称等易变内容
整屏 OCR 慢，一定给 region，同一屏复用结果
命中的是文字包围盒中心，带图标/内边距的按钮可能偏
语言包、字号、斜体、描边都会影响识别率
```

## 锚点 + 相对偏移

页面有一个稳定标识（顶栏 logo、固定图标）时，用一个锚点 + 比例偏移定位其他控件：

```js
const anchor = await kit.findImage('assets/anchor_toolbar.png', { threshold: 0.9 });
if (!anchor) throw new Error('锚点丢失，不盲点');
const screen = device.screen();
await device.tap(
  Math.round(anchor.center.x + 0.34 * screen.width),
  Math.round(anchor.center.y),
);
```

偏移用屏幕宽高比例，不要存绝对像素；锚点丢失就抛错，不降级成硬坐标。

## 点击后校验

`tap` 成功只代表事件注入成功，不代表业务生效。视觉页面用图片轮询做回执：

```js
async function waitImage(kit, file, { timeout = 8000, interval = 400, threshold = 0.9 } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const hit = await kit.findImage(file, { threshold });
    if (hit) return hit;
    await kit.sleep(interval);
  }
  return null;
}
```

Flutter 通常只有一个 Activity，`currentApp()` 在页面切换时不变，页面守卫只能看画面特征。

## 坐标场景的补充

```text
长按         device.longPress 需要选择器；纯坐标用 device.shell('input','swipe',x,y,x,y,'800')
输入         先点坐标，再 device.type / clearFocused；中文需要 ADBKeyboard
状态变体     未选中/已选中、可用/置灰、未关注/已关注各准备模板
同名元素     用 region 限定到行/栏，或用 maxResults 后按 bounds 与锚点筛
遮挡         弹窗、透明遮罩、软键盘都会吃掉点击，点击前先清障
```

## 验证

```text
dryRun = true    只输出命中文件名、confidence、center，不点击
maxItems = 1     验证一次完整点击和回执
maxItems = 3     验证滚动、返回、状态判定
```

有真实副作用的动作（发送、支付、关注）不要自动重试，也不要“点了就算成功”。
