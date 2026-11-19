# MedinexRPA kit 参数与边界参考

本文面向脚本开发者和 AI。使用 API 时无需阅读 `src/engine/kit.js` 源码。

统一 Web 定位、等待、元素/页面、抓取、网络监听、Cookie 和对话框见 [kit-web.md](kit-web.md)。

## 1. 全局约定

### 1.1 单位与默认值

- 所有时间和间隔均以**毫秒**为单位，除非名称明确包含 `Minutes`。
- `waitTimeoutMs` 默认 30000；创建 kit 时最小会被提升为 5000。
- `click / fill / select / choose` 默认动作超时 8000。
- `timeout: 0` 在多数 kit 选项中不表示无限等待；需要长等待时应显式给足毫秒数。
- `attempts` 始终表示**总尝试次数**，不是“失败后再追加几次”。从 1 开始传给回调。

### 1.2 元素目标 Target

支持字符串、Playwright Locator 和声明式对象。字符串按 Playwright selector 解析，**普通字符串不会自动按文本查找**；文本定位使用 `{ text: '提交' }`。

多个元素同时匹配时，Playwright 单元素动作可能触发 strict mode 错误。应使用 `{ css, index }`、`.first()` 或更精确的定位条件。

### 1.3 取消与错误

- `checkpoint()` 和 kit 的等待/动作在检测到停止后抛出 `err.cancelled === true` 的错误。
- 手动停止属于正常取消，不应按任务失败发送告警。
- `withTimeout` 和等待超时通常带 `err.code === 'KIT_TIMEOUT'`。
- 超时只停止当前等待，**不保证底层点击、请求或页面 JavaScript 已停止**。
- 删除、提交、支付、上报等非幂等操作超时后，必须先核实结果，不得直接重试。

### 1.4 副作用与重试

- `step()`、`request()` 默认只执行一次。
- `retry()` 默认总次数为 3，但只应由调用方明确用于可重试逻辑。
- 查询、读取、加载通常可重试；产生业务写入的操作必须先定义去重或结果核实策略。
- kit 的 DOM 兜底点击/输入只代表 DOM 动作完成，不代表业务请求成功。

## 2. 执行控制

### `kit.step(name, fn, options?)`

执行一个步骤，记录开始、完成、耗时和失败日志；失败时默认截图。返回 `fn` 的返回值。

| 参数 | 默认值 | 说明 |
|---|---:|---|
| `name` | 必填 | 用于日志、错误和截图名称 |
| `fn(attempt)` | 必填 | 异步业务函数，attempt 从 1 开始 |
| `attempts` | 1 | 总尝试次数；危险操作保持 1 |
| `timeoutMs` | 0 | 0 表示不额外包一层超时；单次尝试的超时 |
| `retryDelayMs` | 300 | 第一次重试前等待 |
| `backoff` | 2 | 重试间隔倍数，最小按 1 处理 |
| `maxDelayMs` | 5000 | 重试间隔上限 |
| `shouldRetry(err, attempt)` | 始终 true | 返回 false 可立即停止重试 |
| `screenshotOnError` | true | 最终失败时是否截图；取消不截图 |

```js
const rows = await kit.step('查询列表', async () => {
  await kit.click('#query');
  return kit.waitForListReady({ rowSelector: '.row', emptySelector: '.empty' });
}, { attempts: 2, timeoutMs: 15000 });
```

### `kit.retry(fn, options?)`

| 参数 | 默认值 | 说明 |
|---|---:|---|
| `attempts` | 3 | 总尝试次数 |
| `delayMs` | 300 | 初始重试间隔 |
| `backoff` | 2 | 间隔增长倍数 |
| `maxDelayMs` | 5000 | 最大间隔 |
| `timeoutMs` | 0 | 单次尝试超时；0 不额外限制 |
| `shouldRetry(err, attempt)` | 始终 true | 是否允许下一次尝试 |
| `onRetry(err, attempt)` | 空函数 | 仅在下一次尝试前调用 |
| `label` | `'操作'` | 超时错误中的名称 |

成功时返回 `fn` 结果；最终失败抛出原始错误。`onRetry` 不会在最后一次失败后调用。

### `kit.sleep(ms)`

可取消等待。`ms <= 0` 时仍会执行一次停止检查。不要在长循环中用原生 `setTimeout` 替代它，否则停止响应会变慢。

### `kit.withTimeout(fn, timeoutMs?, label?)`

- `timeoutMs` 默认 `waitTimeout`。
- `fn` 必须是函数，返回其执行结果。
- 超时错误：`code = KIT_TIMEOUT`。
- 只停止等待，不强制中断底层操作。

### `kit.waitStable(reader, options?)`

反复调用 `reader()`，连续得到相同 JSON 表示后返回最后一次值。

| 参数 | 默认值 | 说明 |
|---|---:|---|
| `timeoutMs` | `waitTimeout` | 总等待上限；不保证能中断一个自身永不返回的 reader |
| `intervalMs` | 200 | 两次读取间隔 |
| `stableTimes` | 2 | 连续相同次数，最小 1 |
| `label` | `'页面状态'` | 超时错误名称 |

reader 应选择业务关键字段；如果返回值包含时间戳等持续变化字段，可能永远不稳定。

## 3. 基础交互

### `kit.click(target, timeout = 8000)`

滚动到元素 → 点击左上角附近 → 失败后 DOM `el.click()` 兜底。

边界：DOM 兜底会绕过部分 Playwright actionability 检查，因此调用方必须验证后续页面状态、请求或业务结果。

### `kit.fill(target, value, options?)`

| 参数 | 默认值 | 说明 |
|---|---:|---|
| `timeout` | 8000 | 输入动作超时 |
| `verify` | true | 读取 value/textContent 与目标字符串比较 |

- `value` 会转为字符串；`null/undefined` 转为空字符串。
- Playwright fill 失败时，通过原生 setter 和 input/change 事件兜底。
- 校验通过不代表前端框架一定完成后续异步处理。

`fillSecret` 与 `fill` 行为相同，语义上用于密码；不要把密码写入自己的日志。

### `kit.select(target, option, options?)`

用于原生 `<select>`。`option` 使用 Playwright 规则：value 字符串、`{value}`、`{label}`、`{index}` 或其数组。返回已选 value 数组，`verify` 默认 true。

自定义下拉不能使用此方法，应打开下拉后调用 `choose`。

### `kit.choose(optionsTarget, targetText, options?)`

| 参数 | 默认值 | 说明 |
|---|---:|---|
| `allowContains` | true | 是否允许“候选项包含目标文本” |
| `timeout` | 8000 | 点击候选项的超时 |

匹配优先级：完全一致 → 忽略空白一致 → 包含；同分选择长度最接近项。返回原始候选文本。找不到时抛错。调用方应验证选择后的输入框或选中状态。

### `kit.upload(target, files)`

调用 `setInputFiles`，返回浏览器接收到的文件名数组。`files` 可为路径、路径数组或 Playwright 文件 payload。

> 扩展模式（`connectOverCDP`）下 Playwright 的文件传输单文件上限 50MB。检测到这个错误后，`upload` / `handleFileChooser` 会自动改用 CDP `DOM.setFileInputFiles` 直接传文件路径（浏览器与工具需在同一台机器），脚本无需特殊处理。
>
> 部分站点（如萌视创作平台）在弹完文件选择框后会立刻把 `<input type="file">` 移出 DOM，甚至从不插入 DOM。kit 会在触发前植入钩子记录 input 引用，因此即使输入框已游离也能设置文件。

### `kit.type(target, text, options?)`

| 参数 | 默认值 | 说明 |
|---|---:|---|
| `click` | true | 输入前是否点击目标；false 时只 focus，适合已定位的富文本编辑器 |
| `delay` | 0 | 逐字输入间隔，毫秒 |
| `timeout` | 8000 | 点击/聚焦超时 |

用于 input 和 contenteditable；不会自动清空已有内容，清空仍用 `kit.fill`。

### `kit.press(key, options?)`

向当前焦点或指定 `target` 发送按键；支持 `Space`、`Enter`、`Escape`、组合键如 `Control+A`。

### `kit.wheel(target, options?)`

在目标元素中心发送滚轮；`deltaY`/`deltaX` 控制方向，`steps` 控制次数，`intervalMs` 控制间隔。用于虚拟列表、内部滚动容器。

`waitFileChooser({timeout})` 只等待文件选择器，不触发动作；`handleFileChooser` 才会注册等待并执行 trigger。调用方拿到 FileChooser 后自行 `setFiles`。

## 4. 弹窗与列表

### `kit.modal`

创建 kit 时可传 `modalSelector`；默认是 `dialog,[role="dialog"]`。

| 方法 | 返回值与边界 |
|---|---|
| `modal.anyOpen()` | Boolean；页面读取失败时返回 false；使用布局盒判断，隐藏祖先内的 dialog 不算打开 |
| `modal.waitGone(timeout?)` | 已关闭 true，超时仍打开 false |
| `modal.confirm(text = '确认', timeout?)` | 等确认按钮出现并可靠点击，不保证业务已生效 |
| `modal.dismissStuck(cancelText?)` | Esc → 取消/关闭类按钮；返回是否已关闭 |

`confirm` 的 `text` 可以是字符串或 RegExp。默认选择器 `dialog,[role="dialog"]` 会同时覆盖原生 `<dialog>` 和 ARIA dialog，按钮在 dialog 作用域内查找。`dismissStuck` 的 `cancelText` 默认匹配中文和常见英文取消文案，可按站点语言传入字符串或 RegExp。

不同组件库应在创建 kit 时配置选择器，不要修改核心默认选择器。

### `kit.waitForListReady(options)`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `rowSelector` | 必填 | 列表行 CSS |
| `emptySelector` | 空 | 空状态元素 CSS |
| `loadingText` | `''` | 加载文案，按 RegExp 使用；需要时显式传入 |
| `timeout` | `waitTimeout` | 总等待时间 |

返回 `'rows'`、`'empty'` 或 `'timeout'`。空状态元素必须存在且有文本才算 empty。`'timeout'` 不是异常，调用方必须决定停止、重试或核实。

### 其他列表工具

- `isListEmpty({emptySelector})`：只判断元素存在且有文本，不额外判断可见性。
- `readRows({rowSelector, fieldSelectors})`：返回数组；字段值会合并空白并 trim，缺失字段为空字符串。

## 5. 结果核实台账

### `kit.createLedger({onCredit})`

适用于“操作已发出，但结果暂时不确定”的场景。

- `mark(item)`：按 `item.key` 去重后加入待核实队列。
- `reconcile(isPresent)`：逐项调用 `isPresent(item)`；返回 false 表示已不在原位置/已生效，调用 `onCredit(item)` 补记。返回本次补记数。
- `resolve(key)`：确认完成后移除。
- `size`：当前待核实数。

**边界**：台账仅在内存中，进程崩溃会丢失。需要崩溃恢复时，应配合 `openState` 或 `createJsonl` 持久化。`isPresent` 的业务含义完全由调用方定义。

## 6. 通用 HTTP

### `kit.request(options)`

返回：

```js
{
  ok: true,
  status: 200,
  statusText: 'OK',
  url: 'http://...',
  headers: { 'content-type': 'application/json' },
  data: {},
  attempt: 1,
}
```

| 参数 | 默认值 | 说明 |
|---|---:|---|
| `url` | 必填 | 绝对 URL |
| `method` | GET | HTTP 方法 |
| `query` | 空 | 对象；数组值会重复追加同名参数，null/undefined 跳过 |
| `headers` | 空 | Headers 初始化值 |
| `json` | undefined | 自动 JSON.stringify，并补 content-type |
| `body` | undefined | 原始请求体；json 优先于 body |
| `responseType` | auto | auto / json / text / arrayBuffer / response |
| `timeoutMs` | 10000 | 单次请求超时，会 abort fetch |
| `attempts` | 1 | 总请求次数；写操作保持 1 |
| `retryDelayMs` | 300 | 初始重试间隔 |
| `backoff` | 2 | 间隔倍数 |
| `maxRetryDelayMs` | 5000 | 最大重试间隔 |
| `validate(context)` | 空 | 自定义业务校验；返回 false 抛 `KIT_HTTP_VALIDATION` |
| `shouldRetry(err, attempt)` | 见下 | 自定义是否重试 |

`validate` 收到 `{status, headers, data, response, attempt}`。HTTP 2xx 不代表业务成功时，必须在这里判断，不要在 kit 核心写死成功码。

默认重试范围：网络错误 `KIT_HTTP`、请求超时 `KIT_TIMEOUT`、HTTP 5xx `KIT_HTTP_STATUS`。HTTP 4xx、响应解析错误、业务校验失败默认不重试；即使属于这些类型，也只有在 `attempts > 1` 时才会重试。

错误码：

- `KIT_TIMEOUT`：请求超时
- `KIT_HTTP`：网络层失败
- `KIT_HTTP_STATUS`：非 2xx，附 `status` 和已解析 `data`
- `KIT_HTTP_PARSE`：JSON 解析失败
- `KIT_HTTP_VALIDATION`：validate 返回 false，附 `status` 和 `data`

## 7. 状态与 JSONL

### `kit.openState({file, defaults = {}})`

异步打开或创建 JSON 状态文件（需要 `await`）。只存 JSON 可序列化数据；Date、Map、undefined、函数等不要直接作为状态值。

返回对象：

| 成员 | 行为 |
|---|---|
| `data` | 当前内存状态 |
| `get(key, fallback)` | 读取字段 |
| `set(key, value)` | 修改并原子落盘，返回 value |
| `update(mutator)` | 修改并落盘；mutator 可原地修改，也可返回新状态对象 |
| `save()` | 将直接修改过的 data 落盘 |
| `reload()` | 从文件重新读取并替换内存状态 |
| `flush()` | 等待当前写入队列结束 |

`set/update/save/reload` 串行执行。写文件采用同目录临时文件 + rename，避免半截 JSON。直接修改 `state.data` 后必须调用 `save()`。

### `kit.createJsonl(file, {append = true})`

- 默认追加；`append:false` 会先清空文件。
- `append(record)`：一行一个 JSON，多个并发调用按调用顺序写入。
- `read()`：等待写入完成后读取全部记录；某行损坏会报对应行号。
- `flush()`：等待当前写入队列。

JSONL 适合事件和明细，不适合需要随机修改的大状态。

## 8. CSV、Excel、下载与通知

### `kit.csvLog(file, header)`

- 创建时**覆盖原文件**，写入 UTF-8 BOM 和 header。
- `append(cols)` 同步追加一行，自动处理引号、逗号等 CSV 转义。
- 断点续跑需要保留旧文件时不要再次用同一文件初始化；多实例不要共享固定路径。

### `kit.excel.open({path, loadDep, sheetIndex = 0})`

返回：

- `rows()`：`[{n, values}]`，n 是 Excel 实际行号。
- `cellText(rowNum, col)`：读取文本，兼容富文本、公式结果等常见单元格值。
- `writeCell(rowNum, col, value, {retries = 3})`：修改并立即保存整个工作簿；最终失败抛错。

Excel/WPS 占用可能导致写入失败。写入期间不要由其他进程同时修改同一工作簿。

### `kit.saveDownload(download, options)`

| 参数 | 默认值 | 说明 |
|---|---:|---|
| `directory` | 必填 | 保存目录 |
| `fileName` | 下载建议名 | 会清理不安全字符和路径分隔符 |
| `overwrite` | true | false 时自动追加 `_1`、`_2` 等序号 |

返回保存后的完整路径。`safeFileName(name)` 可单独用于文件名清理。

### `kit.notify(cfg, title, fields)`

企微 Markdown 群机器人辅助通知：

```js
await kit.notify({ enable: true, url: webhook }, '任务完成', ['完成 10 项']);
```

- enable 为 false 或 URL 为空时不发送。
- 网络异常返回 false，不阻断主任务。
- 通知不能作为业务成功凭证，也不要把密码、Cookie、完整 Webhook key 写入日志。
- 需要可靠检查 HTTP/业务结果的请求使用 `kit.request()`。
