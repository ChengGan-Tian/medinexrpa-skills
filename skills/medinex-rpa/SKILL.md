---
name: medinex-rpa
description: 浏览器版 MedinexRPA（Electron + Playwright）的脚本开发、审查和调试指南；使用通用 kit、分析 run.log/截图/trace、设计回归、修复 RPA bug 和部署脚本。用户提到浏览器版 MedinexRPA、Playwright 浏览器脚本、浏览器实例、kit、元素定位、批量抓取、trace.zip 时使用。手机/Android 版请改用 medinexrpa-mobile。
---

# 浏览器版 MedinexRPA 工作规范

## 这是什么

MedinexRPA 浏览器版是一个 Electron + Playwright 的桌面 RPA 应用。

```text
实例        一个持久化浏览器 profile + 登录态，可复用
脚本        外置 ESM 文件，导出 meta 和 run()
任务        脚本 + 实例 + 参数 = 一次运行；可多实例并行
平台负责    浏览器启动、实例、登录态、并行、停止、日志、失败现场
脚本负责    前置校验、页面交互、结果核实、进度和返回摘要
```

和手机/Android 版完全独立：不同安装包、数据目录和脚本 API。手机版用 `medinexrpa-mobile`。

目标：在现有架构上完成可维护、可测试的 RPA 工作，而不是另起一套自动化框架。

## 先读什么

| 要做什么 | 读 |
|---|---|
| 写/改脚本、查参数和上下文 | `references/script-guide.md` |
| 查 kit 能力 | `references/kit-reference.md` |
| 查 Web kit（新页面、下载、请求） | `references/kit-web.md` |
| 确认真实业务副作用边界 | `references/safety.md` |
| 排查失败、看日志和 trace | `references/debugging.md` |
| 新脚本骨架 | `assets/script-template.js` |

文档是 API 的主要事实来源；只有文档解释不了实际行为时才读源码，不要靠记忆猜参数。

## 工作流

### 新建脚本

1. 明确输入、前置页面、完成条件、失败条件、是否有真实副作用；缺业务规则时先问。
2. 用 `node tools/new-script.mjs <file.js> "<名称>"` 生成骨架，或复制 `assets/script-template.js`。
3. 用户参数保持最少；站点常量和选择器集中在文件顶部 `CONFIG`。
4. 先写前置安全检查（URL、账号、筛选、最大数量），再写业务循环。
5. 每轮 `checkpoint()`，关键阶段 `kit.step()`；等待用条件，不用固定长延迟。
6. 多实例产物写 `instanceDir`；返回小型 JSON 摘要。
7. 加模拟/HAR 回归，执行语法检查和相关测试。

### 修改现有脚本

1. 先读目标脚本和测试，保留业务语义和安全断言。
2. 用日志或复现确定根因，做最小修改，不顺手重构稳定逻辑。
3. 站点问题改脚本/站点配置；通用问题才改 kit。
4. 改 kit 必须同步更新 API 文档和通用测试，保持已有调用兼容。
5. 不为通过测试删除前置条件、弱化成功判断或改变业务预期。

### 分析日志和修 bug

按 `references/debugging.md`：确定运行目录 → 读 run.log → 看截图/trace → 分类根因 → 最小复现 → 修复 → 回归。

### 部署

```bash
node tools/deploy-scripts.mjs <script.js>
```

部署会写入本机安装版和测试环境并打防回滚指纹，执行前确认目标环境。源码通过测试不等于已部署，分别报告。

## 脚本结构

```js
const CONFIG = {
  readySelector: '#ready',
  rowSelector: '.result-row',
  timeoutMs: 30000,
};

export const meta = {
  name: '示例任务',
  description: '用途、前置条件和结果',
  useCurrentPage: true,
  params: [
    { key: 'keyword', label: '关键词', type: 'text', default: '', required: true },
    { key: 'maxItems', label: '最多处理', type: 'number', default: 20 },
  ],
  metrics: [
    { key: 'done', label: '完成', tone: 'ok', primary: true },
    { key: 'failed', label: '失败', tone: 'danger' },
  ],
};

export async function run(ctx) {
  const { page, params, kit, progress, checkpoint, instanceDir } = ctx;
  if (!page.url().includes('/required-page')) throw new Error('请先进入指定页面');
  if (!params.keyword?.trim()) throw new Error('关键词不能为空');

  const summary = { done: 0, failed: 0 };
  await kit.step('初始化', async () => {
    await kit.waitElement(CONFIG.readySelector);
  });

  for (const item of items) {
    await checkpoint();
    await kit.step(`处理 ${item}`, async () => {
      // 业务动作
    });
    summary.done += 1;
    progress({ ...summary });
  }

  return { ...summary, instanceDir };
}
```

关键点：

```text
meta.useCurrentPage   true：优先用实例当前页，结束后不关闭；仍要检查 URL 和前置元素
params                只放业务参数；password 只遮挡界面，脚本自己打印仍会泄密
run 上下文             page / context / kit / params / log / screenshot / progress /
                       checkpoint / signal / dataDir / instanceId / instanceDir / loadDep
progress               传累计绝对值
返回                   小型、JSON 可序列化摘要，不返回 Page / Locator / Response
```

完整字段和参数类型见 `references/script-guide.md`。

## 工程约定

```text
时间参数均为毫秒；attempts 是总次数
step 和 request 默认一次；非幂等操作不得盲目重试
withTimeout 不会回滚或强制中断底层操作
网络/下载/新页面等待先注册，再触发
新标签页用 kit.forPage(page)，不要以为 activatePage 会改变原 kit 的 Page
err.cancelled 是用户停止，不是失败
不在脚本里启动新浏览器，不操作其他实例 profile
不在 kit 中写站点 URL、业务成功码或专属选择器
不记录密码、Cookie、Token、完整 Webhook 或不必要的响应体
```

## 等待与重试

```text
优先：waitElement / waitText / waitResponse / waitForListReady / waitStable
先注册：waitRequest / waitResponse / waitDownload / waitPage，再执行触发动作
sleep 只用于已知节奏或退避，不代替结果等待
幂等：查询、读取、可重复的导航可以重试
非幂等：提交、删除、支付、发送，超时后先核实结果，不要“失败就再点一次”
```

超时读数：

```text
约 8000ms    kit.click / fill / select / choose 的默认动作超时
约 30000ms   waitElement / waitStable / 步骤级等待（waitTimeout 默认 30s）
err.code === 'KIT_TIMEOUT'   超时
err.cancelled === true       用户停止，不是失败
```

## 日志、进度与产物

```text
<data>/runs/<runId>/
├── run.log                时间线、参数摘要、错误堆栈
├── <instanceId>/
│   ├── *.png              步骤/失败截图
│   └── ...                实例专属产物
└── shared-output.json     确需共享时再写，注意多实例冲突
```

- 关键步骤用 `kit.step`，不要靠大量重复日志猜位置。
- 单项失败可捕获后继续，但不要空 catch；业务失败直接 `throw new Error('可读原因')`。
- 多实例默认写 `instanceDir`，不要在 `dataDir` 根目录用固定文件名。
- 部署目录：开发环境通常是 `%APPDATA%/rpa-desktop`；安装版/便携版通常在程序同级 `data`。

## 常见陷阱

| 现象 | 常见原因 | 处理 |
|---|---|---|
| 点击偶发 timeout | 元素被遮挡、动画中、strict 多命中 | 看截图和 `point`；用可靠点击并核实后续结果 |
| 元素 0 命中 | 页面未就绪、iframe、隐藏模板 | 加明确等待；限定容器；确认真实 DOM |
| 新标签页/下载丢失 | 先点后等 | 先注册 `waitPage` / `waitDownload`，再触发 |
| 重复提交 | 非幂等操作被重试 | 停止重试，改为结果核实和去重 |
| 多实例文件互相覆盖 | 写 `dataDir` 固定文件名 | 写 `instanceDir` |
| 把 DOM 点击当成功 | 只验证了动作，没有验证业务结果 | 用空状态、响应或业务字段判定 |
| 用户停止被报成失败 | 没区分 `err.cancelled` | 取消不算失败，不发失败告警 |
| 部署后没生效 | 只改了源码没部署 | 确认部署目标和指纹，重新部署 |

## 验证

按改动范围选择，不为凑数量跑无关测试：

```bash
node --check <script>.js
node tools/test-kit.mjs          # 修改 kit 时
node tools/test-kit-web.mjs      # 修改 Web kit 时
node tools/test-trace.mjs        # 修改运行器/失败现场时
node tools/test-mock-delete.mjs
node tools/test-mock-delete-by-author.mjs
```

业务改动必须跑对应业务回归；通用 kit 改动至少跑两个 kit 套件和受影响的业务回归。
测试失败先读实际错误，不得通过删测试或放宽断言来“修复”。

## 安全边界

- 真实删除、提交、支付、修改资料、批量写入、真实 Webhook 通知，必须得到明确许可。
- 许可要具体到动作和环境：“只读查看”不等于“可以点击”，“测试一条”不等于“可以批量”。
- 不执行 git commit/push/reset/rebase，除非用户明确要求并再次确认。
- 不把真实 profile、运行产物、用户 Excel 或 HAR 中的敏感数据复制进源码包。
- 详细边界见 `references/safety.md`。

## 交付说明

最终简要说明：根因或新增能力、修改文件、测试命令与结果、是否触碰真实环境、是否已部署/安装。
不要把未执行的验证说成已通过，不要默认源码修改等同于已部署。
