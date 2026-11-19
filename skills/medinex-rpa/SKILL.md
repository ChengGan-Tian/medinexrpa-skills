---
name: MedinexRPA
description: 浏览器版 MedinexRPA（Electron + Playwright）的脚本开发、审查和调试指南；使用通用 kit、分析 run.log/截图/trace、设计回归、修复 RPA bug 和部署脚本。用户提到浏览器版 MedinexRPA、Playwright 浏览器脚本、浏览器实例、kit、元素定位、批量抓取、trace.zip 时使用。手机/Android 版请改用 medinexrpa-mobile。
---

# 浏览器版 MedinexRPA 工作规范

目标：在现有 Electron + Playwright 浏览器架构上完成可维护、可测试的 RPA 工作，而不是另起一套自动化框架。

## 必须先读

1. 读取 `references/safety.md`，遵守真实业务副作用和数据保护边界。
2. 写或改脚本时读取：
   - `references/script-guide.md`
   - `references/kit-reference.md`
   - `references/kit-web.md`
3. 排查失败时读取 `references/debugging.md`。
4. 只有文档无法解释实际行为时才读实现源码；不要靠记忆猜 API 参数。

上述路径相对于本 SKILL.md 所在目录。文档是 API 的主要事实来源，kit 源码用于核对实现，不要求先通读源码才能写脚本。

## 任务分流

### 新建脚本

1. 明确输入、前置页面、完成条件、失败条件、是否有真实副作用；缺少关键业务规则时先问。
2. 用 `node tools/new-script.mjs <file.js> "<名称>"` 生成骨架，或严格按 script-guide 的结构创建。
3. 用户参数保持最少；站点常量放脚本顶部 CONFIG，定位器集中管理。
4. 先写前置安全检查，再写业务循环；每轮有 `checkpoint()`，关键阶段用 `kit.step()`。
5. 使用明确等待和结果核实，不用固定延迟掩盖状态问题。
6. 多实例产物写 `instanceDir`；返回小型 JSON 摘要。
7. 添加模拟/HAR 回归，执行语法检查和相关测试。

### 修改现有脚本

1. 先读目标脚本及其测试，保留现有业务语义和安全断言。
2. 用日志或复现确定根因，做最小修改，不顺手迁移整个脚本或重写稳定逻辑。
3. 站点专属问题改脚本/站点配置；多业务共享的通用问题才改 kit。
4. 修改 kit 必须同步更新 API 文档和通用测试，保持已有调用兼容。
5. 不为了通过测试而删除前置条件、弱化成功判断或修改正常业务预期。

### 分析日志和修 bug

按 `references/debugging.md` 的顺序：确定运行目录 → 读 run.log → 看截图/trace → 分类根因 → 最小复现 → 修复 → 回归。不得只看报错最后一行就猜选择器或业务原因。

## 强制工程约定

- 时间参数均为毫秒；`attempts` 是总次数。
- `step` 和 `request` 默认一次；非幂等操作不得盲目重试。
- `withTimeout` 不会回滚或强制中断底层操作。
- 网络/下载/新页面等待先注册，再触发。
- 新标签页使用 `kit.forPage(page)`，不要误以为 `activatePage` 会改变原 kit 的 Page。
- `err.cancelled` 是用户停止，不是失败；取消不发送失败告警。
- `progress()` 传累计绝对值；`run()` 返回 JSON 可序列化摘要。
- 不记录密码、Cookie、Token、完整 Webhook 或不必要的响应体。
- 不在 kit 中写站点 URL、业务成功码或专属选择器。
- 不在脚本里启动新浏览器，不直接操作其他实例 profile。

## 验证要求

按改动范围选择，不为了凑数量运行无关测试：

```bash
node --check scripts/<script>.js
node tools/test-kit.mjs          # 修改 kit 时
node tools/test-kit-web.mjs      # 修改 Web kit 时
node tools/test-trace.mjs        # 修改运行器/失败现场时
node tools/test-mock-delete.mjs
node tools/test-mock-delete-by-author.mjs
```

业务改动必须跑对应业务回归；通用 kit 改动至少跑两个 kit 套件和受影响的业务回归。测试失败先读实际错误，不得通过删测试或放宽松断言来“修复”。

## 交付说明

最终简要说明：根因或新增能力、修改文件、测试命令与结果、是否触碰真实环境、是否已部署/安装。不要把未执行的验证说成已通过，不要默认把源码修改等同于已部署。
