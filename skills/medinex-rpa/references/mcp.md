# 浏览器版 MCP

MedinexRPA 0.2.40+ 自带 MCP，入口在「设置 → AI 接入」。客户端里服务名是 `medinexrpa-web`。

## 先确认可用

```text
设置 → AI 接入 → 测试连接
  成功：显示 20 个工具
  失败：看提示（server 不存在 / 进程退出 / 权限）
```

客户端侧确认：

```text
Claude Code / OpenCode / Cursor 的 MCP 列表里能看到 medinexrpa-web
```

不可用时退回文件和命令行流程，不要假装 MCP 可用。

## 权限

```text
read    实例列表、页面快照、DOM、截图、读脚本
act     启动/停止实例、打开 URL、点击、输入、按键
script  写脚本、跑脚本、停脚本
```

默认 `read,act`。写脚本和跑脚本必须显式开启 `script`，否则返回 `POLICY_DENIED`。

## 工具

| 类别 | 工具 | 说明 |
|---|---|---|
| 实例 | `list_instances` | id、名称、浏览器、状态、lockOwner |
| 实例 | `create_instance` | chrome / msedge，不启动 |
| 实例 | `start_instance` | 启动；扩展模式需要 Bridge 扩展 |
| 实例 | `stop_instance` | 关闭窗口 |
| 页面 | `open_url` | 打开地址，等 DOM 就绪 |
| 结构 | `dom_dump` | `tree` / `html` / `aria`，可用 selector 缩小范围 |
| 元素 | `snapshot` | 可见交互元素 + `ref` + `snapshotId` |
| 动作 | `click` / `fill` / `press_key` | ref 或 Playwright selector |
| 截图 | `screenshot` | PNG，可存文件 |
| 文档 | `script_guide` | web / kit / script / all |
| 脚本 | `list_scripts` / `read_script` | 读现有脚本 |
| 脚本 | `validate_script` / `write_script` | 先校验再写；默认不覆盖 |
| 运行 | `run_script` / `run_status` / `run_log` / `stop_run` | 运行与失败现场 |

## 推荐顺序

```text
1. list_instances / create_instance
2. start_instance
3. open_url
4. dom_dump（先 tree 看结构，必要时 selector 缩小）
5. snapshot（拿 ref）
6. click / fill
7. script_guide（只读需要的 topic）
8. write_script（overwrite 默认 false）
9. run_script（wait=true 便于直接拿结果）
10. run_log / run_status（失败时）
```

写脚本时不要凭记忆猜 kit API：先 `script_guide` 或读 `references/kit-reference.md`、`references/kit-web.md`。

## 常见错误

| 错误码 | 含义 | 处理 |
|---|---|---|
| `INSTANCE_NOT_FOUND` | 实例 id / 名称不存在 | 先 `list_instances` |
| `INSTANCE_NOT_RUNNING` | 实例没启动 | 先 `start_instance` |
| `START_FAILED` | profile 被占用、浏览器没装 | 关掉 GUI 里同一个实例；或换实例 |
| `REF_NOT_FOUND` | ref 失效（页面变了） | 重新 `snapshot` |
| `SNAPSHOT_EXPIRED` | snapshotId 和当前页不一致 | 重新 `snapshot`，不要复用旧 id |
| `POLICY_DENIED` | 权限不足 | 开启 `act` 或 `script` |
| `EXTENSION_UNAVAILABLE` | 8765 被 GUI 占用 | 扩展模式同一时间只能一方使用 |
| `EXTENSION_NOT_CONNECTED` | 扩展没连上 | 安装并启用 Bridge 扩展，确认端口 |
| `RUN_REJECTED` | 实例忙 / 任务提交失败 | 等当前任务结束 |
| `TIMEOUT` | wait 超时 | 用 `run_status` 继续查，不要重复提交 |

## 数据与并发

```text
数据目录    与 GUI 完全相同：安装版 <安装目录>/data，开发版 %APPDATA%/rpa-desktop
同步        实例增删改、脚本、历史都会双向同步
实例锁      同一实例同时只能被 GUI 或 MCP 一方启动
任务        运行中的进度不跨进程，结束后才进历史
```

设置页生成的配置会显式带 `RPA_DATA_DIR`，避免便携版路径差异。

## 和文件流程的关系

MCP 只是入口，脚本仍然是外置 ESM 文件：

```text
MCP 写脚本 → 落到 <data>/scripts/<file>.js，GUI 脚本页也能看到
MCP 跑脚本 → 和 GUI 跑的是同一套 runner、runs/、history.json
```

所以「MCP 写的脚本」和「手写的脚本」没有区别，都可以在 GUI 里继续编辑和运行。
