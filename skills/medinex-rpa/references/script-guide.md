# MedinexRPA 标准脚本开发指南

本文定义脚本结构、参数、运行上下文、产物、错误处理和测试约定。AI 按本文与 kit 参考即可开发，不需要先阅读引擎源码。

## 1. 架构边界

- 一个脚本是一个外置 `.js` 或 `.mjs` 文件，使用 ESM。
- 脚本导出 `meta` 和 `run()`；浏览器、实例、登录态、并行、停止和日志由平台管理。
- 脚本只负责业务编排：前置校验、页面交互、结果核实、进度和返回摘要。
- 站点 URL、选择器、业务成功码放在脚本或站点配置中，**不要写入通用 kit**。
- 用户只填写必要业务参数；稳定常量写在脚本顶部 `CONFIG`。
- 不要在脚本里 `chromium.launch()`，不要启动第二个浏览器，不要读写其他实例的 profile。

## 2. 最小结构

```js
const CONFIG = {
  timeoutMs: 30000,
};

export const meta = {
  name: '示例任务',
  description: '说明用途、前置条件和结果',
  useCurrentPage: true,
  params: [
    { key: 'keyword', label: '关键词', type: 'text', default: '', required: true },
  ],
};

export async function run(ctx) {
  const { page, params, kit, instanceDir } = ctx;
  if (!params.keyword?.trim()) throw new Error('关键词不能为空');

  return kit.step('处理关键词', async () => {
    await kit.fill({ placeholder: '请输入关键词' }, params.keyword);
    await kit.click({ role: 'button', name: '查询' });
    await kit.waitForListReady({ rowSelector: '.result-row', emptySelector: '.empty' });
    return { keyword: params.keyword, instanceDir };
  });
}
```

使用脚手架生成完整骨架：

```bash
node tools/new-script.mjs my_task.js "我的任务"
node --check scripts/my_task.js
```

文件名以 `_` 开头时不会显示在脚本列表中。修改外置脚本后，在界面刷新脚本即可重新加载。

## 3. meta 参数

```js
export const meta = {
  name: '界面显示名称',
  description: '用途和前置条件',
  useCurrentPage: true,
  params: [],
};
```

### `meta.metrics`

可选。声明运行卡片和日志弹框要显示的业务指标；未声明时只显示耗时，出现错误日志时补一个「异常」。

```js
metrics: [
  { key: 'published', label: '发布', tone: 'ok', primary: true },
  { key: 'skipped', label: '跳过', tone: 'muted' },
  { key: 'failed', label: '失败', tone: 'danger', primary: true },
]
```

| 字段 | 说明 |
|---|---|
| `key` | 对应 `progress()` 数据里的字段 |
| `label` | 显示名称 |
| `tone` | `ok / danger / warn / signal / muted` |
| `primary` | 运行卡片是否展示该指标；最多展示前两个 |
| `unit` | 可选单位文本 |

脚本在循环中使用累计值调用：

```js
progress({ published: summary.published, skipped: summary.skipped, failed: summary.failed });
```

指标的权威来源是 `progress()`，不要依赖日志文本正则计数。

### `useCurrentPage`

- `true`：优先使用实例当前非空白页，脚本结束后不关闭它。适合要求用户先登录、筛选或进入指定页面的任务。
- `false` 或省略：平台新建页面，脚本结束后关闭。

即使 `useCurrentPage: true`，脚本也必须检查 `page.url()` 和关键前置元素，不能假设用户一定准备好了页面。

### `params` 字段

| 字段 | 说明 |
|---|---|
| `key` | run 中 `params.key` 的字段名，必填且保持唯一 |
| `label` | 界面标签 |
| `type` | text / password / number / textarea / select / checkbox / file / folder |
| `default` | 默认值；checkbox 会转为 Boolean |
| `placeholder` | 输入提示 |
| `required` | true 时界面阻止空字符串/null/undefined 提交，脚本仍需校验 |
| `options` | select 使用；字符串数组或 `{value,label}` 数组 |
| `filters` | file 使用，如 `{name:'Excel',extensions:['xlsx']}` |

参数边界：

- `password` 只负责界面遮挡和历史记录打码；脚本自己打印 params 仍可能泄密。
- `number` 可能得到数字、空值或非法外部输入，脚本需 `Number()` 转换并检查范围。
- `checkbox` 用 `!!params.key`。
- `file` 是本地文件路径字符串，不是 File 对象；运行前检查存在性、扩展名和占用情况。
- `folder` 是本地目录路径字符串；界面用目录选择器，脚本必须校验它确实是目录。
- 界面参数缓存不代表值永远有效，脚本必须处理文件被移动、账号变化等情况。

## 4. run 上下文

```js
export async function run(ctx) {
  const {
    page, context, params,
    log, screenshot, progress, checkpoint, signal,
    dataDir, instanceId, instanceDir,
    kit, loadDep,
  } = ctx;
}
```

| 字段 | 类型与用途 | 重要边界 |
|---|---|---|
| `page` | 当前 Playwright Page | 已绑定实例登录态；新标签页用 `kit.forPage()` |
| `context` | BrowserContext | 新建页面、Cookie 等底层操作 |
| `params` | 界面参数对象 | 不信任外部输入，先校验 |
| `log(message, level)` | info / warn / error / success | 同时写 run.log 和界面；不要记录秘密 |
| `screenshot(label)` | 保存当前页截图 | 返回文件路径；新页 kit 会截图对应页面 |
| `progress(object)` | 上报绝对进度 | 传累计值，不传增量，如 `{done: 10}` |
| `checkpoint()` | 协作式停止点 | 每轮循环和关键步骤前调用；取消时抛 `cancelled` |
| `signal` | `{aborted:boolean}` | 不是 AbortSignal，不要直接传给 fetch |
| `dataDir` | 本次运行共享目录 | 多实例固定文件名可能冲突 |
| `instanceId` | 当前实例 ID | 可用于文件名和实例级去重 |
| `instanceDir` | 当前实例专属目录 | **多实例产物推荐目录** |
| `kit` | 全部通用能力 | 见 kit-reference.md / kit-web.md |
| `loadDep(name)` | 加载内置依赖 | 例如 `await loadDep('exceljs')`，不要假设任意 npm 包都存在 |

`run()` 返回值会保存到运行结果，应返回小型、JSON 可序列化摘要，不要返回 Page、Locator、Response 或超大列表。

## 5. 标准业务结构

推荐顺序：

1. **校验运行环境**：页面 URL、必要文件、参数范围、实例能力。
2. **安全检查**：筛选条件、当前账号、模式、最大处理数等防误操作条件。
3. **读取初始状态**：用于后续结果核实，不要只依赖点击成功。
4. **分步骤执行**：用 `kit.step()` 标记关键阶段。
5. **循环停止点**：每轮开头 `await checkpoint()`。
6. **等待与核实**：等待元素/响应/列表稳定，核实业务结果。
7. **记录进度和产物**：累计进度、实例专属文件、失败明细。
8. **返回摘要**：处理数、成功数、失败数、产物路径。

```js
export async function run(ctx) {
  const { page, params, kit, checkpoint, progress } = ctx;
  if (!page.url().includes('/required-page')) throw new Error('请先进入指定页面');

  const summary = { done: 0, failed: 0 };
  await kit.step('初始化', async () => {
    await kit.waitElement('#ready');
  });

  for (const item of params.items) {
    await checkpoint();
    await kit.step(`处理 ${item.id}`, async () => {
      // 查询等幂等步骤可重试；提交类步骤不要盲目重试
    });
    summary.done++;
    progress({ done: summary.done, failed: summary.failed });
  }
  return summary;
}
```

## 6. 等待与重试规范

- 优先使用明确条件：`waitElement / waitText / waitResponse / waitForListReady / waitStable`。
- `waitRequest / waitResponse / waitDownload / waitPage` 必须先注册等待，再执行触发动作。
- 固定 `sleep` 只用于已知节奏或退避，不用它代替结果等待。
- `step` 和 `request` 默认一次；只有明确幂等才增加 attempts。
- 非幂等操作超时后进入核实流程，不得“失败就再点一次”。
- `withTimeout` 不会强制停止底层动作，不能把它当作事务回滚。

## 7. 日志、进度与产物

推荐目录：

```text
<data>/runs/<runId>/
├── run.log                 # 时间线、参数摘要、错误堆栈
├── <instanceId>/
│   ├── *.png               # 步骤/失败截图
│   └── ...                 # 推荐写实例专属产物
└── shared-output.json      # 确需共享时再写，注意多实例冲突
```

- 关键步骤用 `kit.step`，不要只依赖大量重复日志猜测位置。
- `progress({done: 10})` 传累计绝对值。
- 业务失败直接 `throw new Error('可读原因')`，平台会记录堆栈和失败截图。
- 预期可恢复的单项失败，可捕获后记录并继续；不要空 catch。
- `err.cancelled` 是用户停止，不是失败。
- 不记录密码、Cookie、Token、完整 Webhook、隐私数据或完整响应体。

## 8. 测试与调试

语法检查：

```bash
node --check scripts/my_task.js
```

通用能力回归：

```bash
node tools/test-kit.mjs
node tools/test-kit-web.mjs
```

业务脚本应提供独立模拟装置或 HAR 回放测试，至少覆盖：

- 正常路径
- 空列表/零结果
- 慢加载与接口超时
- 元素被遮挡或文案变化
- 重复数据与翻页边界
- 用户停止
- 写文件失败
- 操作超时但实际已生效的核实路径

真实删除、提交、支付、上报、企微通知等有副作用的验证，必须得到用户明确许可；默认只做模拟或只读验证。

调试入口：

- 先看 `run.log` 最后的步骤名、错误首行和脚本行号。
- 再看同实例目录的失败截图。
- 真实 DOM 只读采集可使用 `tools/dom-spy.mjs` 的 `snapshot/find/sel/point/text`；通过 `RPA_DATA_DIR / RPA_INSTANCE / RPA_URL` 指定环境，不要依赖其默认站点。
- `dom-spy click` 会改变真实页面状态，未经明确许可不要执行。

## 9. 修改与部署纪律

- 最小修改，不顺手重构稳定业务脚本。
- 不为通过测试而删除前置安全检查、降低成功断言或改变预期业务语义。
- 通用问题修在 kit；站点问题修在对应脚本/站点配置，避免互相污染。
- 新增或修改 kit 时同步更新本说明、kit 参考和通用回归。
- 部署脚本：

```bash
node tools/deploy-scripts.mjs my_task.js
```

该命令会写入本机安装版和测试环境，并打防回滚指纹；部署前确认目标环境。不要把真实实例数据、Cookie、运行产物或用户 Excel 复制进源码目录。
