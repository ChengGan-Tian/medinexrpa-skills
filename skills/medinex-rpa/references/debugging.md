# 日志驱动调试流程

原则：先确定事实，再改代码。不要从一条 timeout 直接推断“选择器失效”。

## 1. 确定运行实例和目录

向用户确认或从运行记录定位：脚本、实例、runId、开始时间、参数摘要、最终状态。

典型目录：

```text
<data>/runs/<runId>/run.log
<data>/runs/<runId>/<instanceId>/*.png
<data>/runs/<runId>/<instanceId>/trace.zip
```

开发/测试环境通常是 `%APPDATA%/rpa-desktop`；安装版/便携版数据通常在程序同级 `data`。不要默认扫描整台电脑，也不要把测试环境路径当成用户生产路径。

PowerShell 定位最近运行（仅在用户指定数据根目录后使用）：

```powershell
Get-ChildItem "<data>\runs" -Directory |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 5 FullName, LastWriteTime
```

## 2. 读 run.log

优先读最后 100–250 行，再按上下文向前追溯：

```powershell
Get-Content "<runDir>\run.log" -Tail 250
Select-String -Path "<runDir>\run.log" -Pattern "执行失败|失败详情|失败：|KIT_|Error|超时|任务已停止"
```

提取：

1. 最后一个 `开始：<步骤>` 是否有关闭的 `完成：<步骤>`。
2. 错误首行、完整堆栈、脚本路径和行号。
3. 当前实例 ID、URL、筛选条件和累计进度。
4. 是用户取消、预期业务结束、环境错误还是代码异常。
5. 同一操作是否已发生，防止调试时重复执行。

`任务已停止（当前步骤完成后退出）` 通常是协作式取消，不是 bug。

## 3. 看失败现场

- 截图：确认实际页面、遮挡、空状态、弹窗、账号和列表内容。
- `trace.zip`：需要动作时间线和 DOM 快照时使用。

```bash
npx playwright show-trace "<runDir>\<instanceId>\trace.zip"
```

成功和手动停止通常不保存 trace；没有 trace 不代表任务没有运行。截图/trace 可能含业务敏感信息，外发前先脱敏。

## 4. 根因分类

| 类型 | 常见证据 | 处理方向 |
|---|---|---|
| 定位错误 | 匹配 0 个、多个 strict 冲突、定位到隐藏模板 | 用真实 DOM 验证；改为语义定位或限定容器/index |
| 页面未就绪 | 元素后续才出现、列表 loading、DOM 抖动 | 加明确等待/稳定条件，不盲目加固定长延迟 |
| 事件竞态 | alert/下载/新页面偶发丢失 | 先注册等待，再触发；并发等待 trigger 与事件 |
| 遮挡/交互失败 | click 超时、元素被浮层覆盖 | 检查 point/截图；使用可靠点击并核实后续结果 |
| 非幂等重试 | 重复提交、重复删除、重复上报 | 停止盲目重试，改为结果核实和去重 |
| 业务状态误判 | 把行数 0 当完成、把 DOM click 当成功 | 使用空状态、响应或业务字段判定 |
| 网络错误 | HTTP 状态、超时、业务 validate 失败 | 区分网络/HTTP/业务码；只对可重试错误重试 |
| 多实例冲突 | 文件互相覆盖、日志/状态串实例 | 使用 instanceDir 和实例级状态 |
| 文件问题 | EPERM、路径不存在、Excel 被占用 | 明确提示占用，重试有边界，不删除用户文件 |
| 引擎/运行器 | 无 checkpoint、截图/trace 失败、脚本加载失败 | 修引擎并跑 test-trace 与业务回归 |

## 5. 真实 DOM 验证

需要真实页面时，优先使用用户已授权的实例，仅做只读采集：

```bash
node tools/dom-spy.mjs sel "<CSS>"
node tools/dom-spy.mjs find "<可见文本>"
node tools/dom-spy.mjs point <x> <y>
node tools/dom-spy.mjs snapshot "debug-label"
```

先设置 `RPA_DATA_DIR / RPA_INSTANCE / RPA_URL`，不要依赖工具里的历史默认值。不要未经许可使用 `dom-spy click`。

也可以用 Playwright 只读评估验证：

- `locator.count()`：是否 0 个或多个。
- `isVisible() / isEnabled()`：状态是否符合预期。
- `getElementInfo()`：标签、属性、位置和可见性。
- `point`：点击坐标实际被哪个元素覆盖。

## 6. 最小复现与修复

1. 把失败条件固化到模拟页面或 HAR，不依赖生产反复试错。
2. 至少复现一次原始失败，再修改。
3. 站点问题改业务脚本；通用问题改 kit，并写通用回归。
4. 保持既有成功断言和安全检查，不通过“忽略错误”让流程走完。
5. 验证正常路径和失败路径，特别是超时后实际已生效的情况。

## 7. 回归选择

```bash
node --check <changed-file>
node tools/test-kit.mjs
node tools/test-kit-web.mjs
node tools/test-trace.mjs
node tools/test-mock-delete.mjs
node tools/test-mock-delete-by-author.mjs
```

按修改范围运行。所有报告中的“PASS”必须来自实际工具结果。源码通过测试不代表已经部署；部署、覆盖安装和真实业务验证分别报告。
