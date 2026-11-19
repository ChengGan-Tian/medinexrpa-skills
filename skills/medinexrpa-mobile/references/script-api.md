# 脚本 API 速查

## meta

```js
export const meta = {
  name: '脚本名称',
  description: '一句话说明',
  params: [
    { key: 'text', label: '关键字', type: 'text', default: '', required: true },
    { key: 'count', label: '数量', type: 'number', default: 10 },
    { key: 'mode', label: '模式', type: 'select', default: 'a', options: [
      { label: '模式 A', value: 'a' },
      { label: '模式 B', value: 'b' },
    ] },
    { key: 'dryRun', label: '只预览', type: 'checkbox', default: false },
  ],
  metrics: [
    { key: 'done', label: '完成', primary: true, tone: 'ok' },
    { key: 'failed', label: '失败', tone: 'danger' },
  ],
};
```

参数类型：`text`、`number`、`password`、`checkbox`、`select`。

## run 参数

```js
export async function run({
  device,       // AndroidDevice
  kit,          // 脚本工具箱
  params,       // 用户参数
  log,          // (message, level?) => void
  screenshot,   // (label) => Promise<path>
  progress,     // (metrics) => void，传累计值
  checkpoint,   // () => Promise<void>，检查停止信号
  signal,       // { aborted }
  instanceDir,  // 当前设备运行目录
  dataDir,      // 本次 run 目录
}) {}
```

## device

| 方法 | 说明 |
|---|---|
| `device.serial` / `device.name` | 序列号 / 显示名 |
| `device.info` | 型号、系统、分辨率、电量等 |
| `device.wake()` | 亮屏 + 尝试上滑解锁 |
| `device.home()` / `back()` / `recents()` | 系统键 |
| `device.press(key)` | `enter`、`delete`、`volumeUp` 或 `KEYCODE_*` |
| `device.enter()` | 回车 |
| `device.launch(pkg)` | 启动应用 |
| `device.forceStop(pkg)` | 强制停止 |
| `device.currentApp()` | `{ package, activity }` |
| `device.find(selector, { timeout })` | 找控件，找不到抛错 |
| `device.findAll(selector)` | 找全部，返回数组 |
| `device.exists(selector)` | 布尔 |
| `device.waitFor(selector, { timeout, interval })` | 等出现，默认 15s / 500ms |
| `device.waitGone(selector, { timeout, interval })` | 等消失 |
| `device.text(selector)` / `textOf(selector)` | 读文本 |
| `device.tap(selector)` / `tap(x, y)` | 点击 |
| `device.tapText(text, { timeout })` | 按文本点击 |
| `device.longPress(selector, ms)` | 长按，默认 800ms |
| `device.type(text)` | 往当前焦点输入 |
| `device.setText(selector, text)` | 点击 + 清空 + 输入 |
| `device.clearText(selector)` | 清空 |
| `device.clearFocused(length)` | 清空当前焦点 |
| `device.swipe(direction, { distance, duration })` | `up/down/left/right` |
| `device.scrollTo(selector, { max, direction, duration })` | 反复滑动直到出现 |
| `device.screen()` | `{ width, height }` |
| `device.screenshot(path)` / `screenshotBuffer()` | 截图 |
| `device.findImage(template, { threshold, region, maxResults })` | 模板匹配 |
| `device.ocr({ lang, region })` | 整屏 OCR |
| `device.findOcr(text, { lang, region })` | OCR 找字 |
| `device.shell(...args)` | adb shell（高级） |
| `device.dumpToFile(file)` | 保存当前界面树 |

## 元素对象

```js
const el = await device.find({ text: '搜索' });
el.text;      // 文本
el.desc;      // content-desc
el.id;        // resource-id
el.bounds;    // { x1, y1, x2, y2, width, height }
el.center;    // { x, y }
await el.tap();
await el.longPress(800);
await el.type('火锅');
```

## 选择器

字符串等价于文本包含：

```js
await device.find('搜索');
```

对象条件：

```js
{ text, textContains, textRegex, id, desc, descContains, className,
  package, clickable, enabled, checked, selected, scrollable,
  index, visible }
```

示例：

```js
await device.find({ text: '登录' });
await device.find({ textContains: '关注' });
await device.find({ textRegex: '^\\d+$' });
await device.find({ id: 'et_search' });
await device.find({ desc: '返回' });
await device.find({ className: 'android.widget.Button' });
await device.find({ clickable: true, enabled: true });
await device.find({ textContains: '关注', index: 1 });
```

XPath：

```js
await device.find({ xpath: '//node[@text="搜索"]' });
await device.findAll({ xpath: '//node[contains(@text,"关注")]' });
```

XPath 每次重新解析 XML，能用文本/id 时优先普通选择器。

## kit

```js
await kit.step('打开搜索页', async () => {
  await kit.tap('搜索');
  await kit.waitFor({ id: 'et_search' });
});
```

| 方法 | 说明 |
|---|---|
| `kit.step(name, fn)` | 步骤日志 + 失败时带上步骤名 |
| `kit.retry(fn, { times, delay, label })` | 重试（p-retry） |
| `kit.assert(condition, message)` | 断言 |
| `kit.sleep(ms)` | 可被停止信号中断 |
| `kit.withTimeout(fn, ms, label)` | 超时保护 |
| `kit.waitFor` / `waitGone` / `exists` | 透传 device |
| `kit.tap` / `longPress` / `setText` / `type` / `clearText` | 透传 device |
| `kit.swipe` / `press` / `back` / `home` | 透传 device |
| `kit.launch` / `forceStop` / `currentApp` | 透传 device |
| `kit.text(selector)` / `texts(selector)` | 读文本 |
| `kit.scrollTo(selector)` | 滚动查找 |
| `kit.screenshot(label)` | 截图到本次运行目录 |
| `kit.appendJsonl(file, value)` | 逐条落盘 |
| `kit.readJsonl(file)` | 读回 JSONL |
| `kit.saveJson` / `readJson` | 读写 JSON |
| `kit.httpJson(url, options)` | 带超时的 JSON 请求 |
| `kit.findImage(file, opts)` / `tapImage` | 模板匹配 |
| `kit.findOcr(text, opts)` / `tapOcr` | OCR 找字 |
| `kit.ocr(opts)` | 整屏 OCR |

## 视觉兜底

```js
const match = await kit.findImage('assets/wechat.png', { threshold: 0.9 });
log(`命中 ${match.confidence} @ ${match.center}`);

const hit = await kit.findOcr('设置');
await kit.tapOcr('设置');
```

优先级：`text/id/desc` → 模板匹配 → OCR。

## 运行控制

```js
for (const item of items) {
  await checkpoint();
  await kit.step(`处理 ${item}`, async () => { /* ... */ });
  progress({ done: ++count, failed });
}
```

`progress` 传累计绝对值。`run()` 返回可序列化的 JSON 摘要。

## 失败现场

```text
<runDir>/<设备>/<时间>_<错误>.png   失败截图
<runDir>/<设备>/fail-ui.xml         失败时的界面树
<runDir>/run.log                    完整日志
```

## 中文输入

- 镜像页手动输入不需要输入法，直接点画面里的输入框。
- 脚本 `setText` / `type` 走 adb：ASCII 直接输入；中文需要先安装 ADBKeyboard。
- 或者在数据目录设备页安装一次，后续复用。
