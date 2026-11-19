# 通用 Web 能力层

这些 API 由 `run({ kit })` 提供，面向任意网站。核心不包含具体站点 URL、业务字段、业务成功码或专属组件选择器。

## 1. 统一元素定位

所有元素动作均接受以下三种目标：

```js
await kit.click('#submit');                         // CSS / XPath 字符串
await kit.click(page.getByRole('button'));          // Playwright Locator
await kit.click({ role: 'button', name: '提交' }); // 声明式定位
```

声明式定位支持：

| 字段 | 说明 |
|---|---|
| `css` / `selector` | CSS 选择器 |
| `xpath` | XPath |
| `text` | 文本，`exact` 控制是否精确匹配 |
| `role` + `name` | ARIA role 和可访问名称 |
| `label` | 关联 label |
| `placeholder` | 输入框 placeholder |
| `testId` | 测试 ID |
| `hasText` | 对结果继续按文本过滤 |
| `index` / `nth` | 第几个匹配项，从 0 开始 |
| `frame` | iframe 选择器、Frame 或 FrameLocator |

也可直接调用 `kit.locate(target)` 获取 Locator，`kit.isLocator(value)` 判断对象类型。

## 2. 等待体系

| API | 用途 |
|---|---|
| `waitElement(target, {state, timeout})` | 等元素 attached / visible / hidden / detached |
| `waitText(text, {target, exact, timeout})` | 等页面或指定容器出现文本 |
| `waitFunction(fn, arg, options)` | 等自定义页面条件成立 |
| `waitLoad({state, timeout})` | 等 load / domcontentloaded / networkidle |
| `waitUrl(url, {timeout})` | 等 URL 匹配 |
| `waitRequest(urlOrPredicate, {method, timeout})` | 等请求发出 |
| `waitResponse(urlOrPredicate, {method, timeout})` | 等响应返回 |
| `waitDownload({timeout})` | 等下载事件 |
| `waitPage({predicate, timeout})` | 等新标签页 |
| `waitFile(file, {stableMs, timeout})` | 等文件出现且大小、mtime 稳定 |
| `waitStable(reader, options)` | 等任意读取结果连续稳定 |

等待均接入任务停止信号和超时控制。取消或超时会移除底层事件监听；网络、下载、新页面、文件选择器应先注册，再触发操作。`urlOrPredicate` 可以是字符串、RegExp 或返回布尔值的同步/异步函数。等待 URL 的 RegExp 每次判断都会重置 `lastIndex`，带 `g` / `y` 的正则可以重复使用。

```js
const pending = kit.waitResponse('/api/list');
await kit.click('#query');
const response = await pending;
```

## 3. 元素操作

除已有的 `click / fill / fillSecret / select / choose / upload` 外，还提供：

| API | 用途 |
|---|---|
| `hover(target)` | 鼠标悬停 |
| `dragTo(source, destination)` | 拖拽元素 |
| `check(target)` / `uncheck(target)` | 设置并校验复选状态 |
| `type(target, text, {click, delay, timeout})` | 聚焦/点击目标后逐字键盘输入；支持 input 与 contenteditable |
| `press(key, {target, delay, timeout})` | 发送单个按键；`target` 省略时作用于当前焦点 |
| `wheel(target, {deltaX, deltaY, steps, intervalMs})` | 在目标元素中心发送鼠标滚轮，适合虚拟列表/内部滚动容器 |
| `getAttribute(target, name)` | 读属性 |
| `setAttribute(target, name, value)` | 设置属性 |
| `getElementInfo(target)` | 标签、文本、值、属性、可见性和位置 |
| `getOptions(target)` | 读取原生 select 的全部选项 |
| `related(target, {relation, selector})` | parent / children / next / previous / descendant |
| `scrollIntoView(target)` | 滚动到元素 |

`getElementInfo().visible` 使用布局盒判断，元素自身不隐藏但祖先 `display:none` 时同样返回 false。

`related` 的 `parent / children / descendant` 中 `selector` 按页面选择器（CSS / XPath）使用；`next / previous` 的 `selector` 是相对当前元素同级节点的过滤条件，默认 `*` 表示紧邻的下一个/上一个元素，传 `#next`、`.item` 等选择器时只取符合该条件的紧邻节点。

## 4. 网页和标签页

| API | 用途 |
|---|---|
| `openPage(url)` | 新建标签页并返回 Page；导航失败会关闭新页面并抛原错误 |
| `listPages()` | 当前浏览器上下文的所有页面 |
| `waitPage()` | 等待新页面 |
| `activatePage(page)` | 将页面切到前台并返回 Page |
| `closePage(page)` | 关闭页面 |
| `navigate(url)` / `reload()` / `goBack()` | 导航 |
| `stopLoad()` | 停止当前页面加载 |
| `getPageInfo()` | URL、标题、readyState |
| `scrollPage({x, y})` | 相对滚动 |
| `scrollPage({to: {x, y}})` | 滚动到指定位置 |
| `getScrollPosition()` | 当前和最大滚动位置 |
| `evaluate(fn, arg)` | 在当前页面执行 JavaScript |

kit 与创建它的 Page 绑定。操作新标签页时派生一个 kit，日志、停止信号和截图目录保持一致：

```js
const pending = kit.waitPage();
await kit.click('#open-detail');
const detailPage = await pending;
const detail = kit.forPage(detailPage);
await detail.waitLoad();
const info = await detail.getPageInfo();
```

## 5. 相似元素与批量抓取

### 元素列表和循环

```js
const elements = await kit.listElements('.list-item');
const summary = await kit.forEachElement('.list-item', async (item, index) => {
  // item 是 Locator，可继续定位、点击或读取
}, { continueOnError: true });
```

`forEachElement` 返回 `{total, processed, failed, errors}`，支持 `start`、`limit` 和单项异常隔离。`continueOnError: true` 只隔离普通业务错误；`err.cancelled === true`（用户停止）始终向上抛出，不会被计入失败项。

### 声明式抓取

```js
const result = await kit.scrape({
  items: '.list-item',
  fields: {
    title: '.title',
    link: { selector: 'a', attribute: 'href' },
    id: { attribute: 'data-id' },       // 不填 selector 表示读取当前行
    raw: { selector: '.payload', type: 'html' },
    custom: async (item) => item.count(),
  },
  dedupeBy: 'id',
  maxItems: 1000,
  nextPage: '#next-page',
  maxPages: 20,
  afterPage: async () => kit.waitLoad(),
});
// result = { rows, pages }
```

字段支持 `selector / attribute / property / type / default / normalize`，也支持自定义函数。`nextPage` 可改为异步函数，返回 `false` 表示结束；`beforePage` 可接入滚动加载等自定义逻辑。

## 6. 网络监听

```js
const capture = kit.startCapture({
  url: '/api/',
  method: ['GET', 'POST'],
  resourceType: ['xhr', 'fetch'],
  includeBodies: true,   // 默认 false；同时控制请求体和响应体
  includeHeaders: false, // Header 可能包含 Cookie/Token
  maxBodyBytes: 200000,  // 请求体、响应体各自的截断上限
  bodyTimeoutMs: 5000,   // 单个响应体读取上限，超时记录 bodyError
});
await kit.click('#query');
const records = await capture.stop();
```

筛选条件的字符串采用包含匹配，也支持 RegExp 和函数。`capture.results()` 读取当前结果，`capture.clear()` 清空，`stop()` 移除监听并等待响应体采集结束。

默认 `includeBodies: false` 时**不记录 POST 请求体**，也不读取响应体。显式开启后，请求体与响应体都受 `maxBodyBytes` 截断，请求体超长时 `postDataTruncated` 为 true。流式或长时间不结束的响应体由 `bodyTimeoutMs` 限制，失败信息写入 `bodyError`，不会让 `stop()` 永久阻塞。采集可能包含密码、Token 和个人信息，默认不要写入日志或产物。

## 7. Cookie

```js
await kit.setCookie({ name: 'locale', value: 'zh-CN', url: 'https://example.com' });
const one = await kit.getCookie('locale', 'https://example.com');
const all = await kit.getCookies({ urls: ['https://example.com'] });
await kit.removeCookies({ name: 'locale' });
```

`removeCookies()` 不传筛选条件会清空当前浏览器上下文的全部 Cookie，调用时必须明确确认。

## 8. 网页对话框、文件选择与下载

| API | 用途 |
|---|---|
| `waitDialog({trigger, action, promptText})` | 等待并处理 alert / confirm / prompt，返回内容 |
| `autoHandleDialogs(options)` | 持续自动处理，返回异步停止函数 |
| `waitFileChooser({timeout})` | 只等待文件选择器，不解发触发；返回 Playwright FileChooser |
| `handleFileChooser({trigger, files})` | 等待文件选择器并设置文件 |
| `handleDownload({trigger, directory})` | 等待下载并保存到目录 |
| `saveDownload(download, options)` | 保存已有 Download 对象 |

`trigger` 可以是元素定位目标或异步函数。监听会在触发前注册，避免事件竞态。`timeout` 覆盖整个流程（事件等待、dialog 处理、触发操作和下载保存），不会出现事件已到但 trigger 永不返回导致的永久挂起；`trigger` 立即失败时抛出原始错误，而不是等到超时。

```js
const message = await kit.waitDialog({ trigger: '#delete', action: 'accept' });
const file = await kit.handleDownload({ trigger: '#export', directory: dataDir });
```

任务停止后，事件监听会移除。`waitDialog` 对已经注册、且在停止后才到达的网页 dialog 仍会按 `action` 处理完再退出，避免页面被未处理的 alert 永久阻塞。

`autoHandleDialogs()` 返回 `async stop()`：

- 立即移除监听，并等待正在处理的 dialog 结束。
- 自动处理失败会写 error 日志、兜底 `dismiss()`，并在 `stop()` 时抛出第一个错误；也可以用 `stop.errors()` 读取全部错误。
- 自定义 `onDialog(dialog)` 抛错时不会再被静默吞掉。

这些 API 只处理 Web 事件，不处理 Windows 原生窗口；Windows 自动化属于后续独立适配器。
