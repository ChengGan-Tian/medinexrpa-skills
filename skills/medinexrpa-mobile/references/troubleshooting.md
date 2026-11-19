# 排障

## 先定位

```text
1. 哪个 runId、哪台设备、哪个步骤
2. data/runs/<runId>/run.log 的最后 20~50 行
3. data/runs/<runId>/<设备>/ 下的失败截图
4. fail-ui.xml 里搜关键字，确认当时真实界面
5. 设备当前应用、屏幕状态、是否被其他工具占用
```

不要只看报错最后一行就猜选择器。

先分类，再决定查什么：

| 类别 | 典型现象 | 先查 |
|---|---|---|
| 页面 | 找不到控件、点错入口 | `currentApp()`、页面锚点、是否被弹窗盖住 |
| 定位 | 多命中、文案变化 | `ui find`、`textContains`、`id`、`desc` |
| 时序 | 偶发、动画/加载中 | `waitFor` / `waitGone`、少量 settle |
| 环境 | 离线、抢焦点、UiAutomation | `adb devices`、任务状态、冲突服务 |
| 业务 | 登录态、风控、权限 | 换账号/换设备复现、看业务提示 |

## AI CLI

在项目目录运行：

```powershell
npm run ai -- devices --json
npm run ai -- doctor --json
npm run ai -- ui dump --json --max-nodes 80
npm run ai -- ui tree
npm run ai -- ui find --text "搜索" --json
npm run ai -- ui find --id et_search --json
npm run ai -- ui find --ocr 设置 --json
npm run ai -- ui shot --out shot.png
npm run ai -- app current --json
```

输出固定为 `ok / schemaVersion / command / device / snapshotId / data / error`。
`ui dump` / `ui find` 返回 `snapshotId`；点击用 `--snapshot <id> --node n12`，不要复用旧坐标。

退出码：

```text
0 成功   1 没找到/过期   2 没有 adb/设备离线   3 超时   4 参数错误
```

## 常见问题

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 找不到控件 | 页面还没到、控件在屏幕外、选择器太严 | `ui dump` 看真实节点；`waitFor`；`scrollTo` |
| `find` 返回多个 | 条件太宽 | 加 `index` / `id` / 父级范围；确认 `matches: 1` |
| 点击没反应 | 被遮挡、父节点才可点、坐标漂移 | 用元素 `tap()`；点父节点；重新 dump 取中心 |
| 输入中文无效 | 没装 ADBKeyboard | 设备页安装一次，或改用镜像手动输入 |
| 输入框没清空 | 掩码/提示文字 | 先 `clearText`，再 `setText` |
| `uiautomator dump` 返回 `Killed` | 常驻 u2 服务占用 UiAutomation | 正常现象；先停服务再手动 dump |
| dump 一直 3~5 秒 | FastInspector 启动失败，已回退 | 看 `app.log` 的 fast-inspector 警告 |
| 和 Appium 同时失败 | 同一时刻只能一个 UiAutomation | 设备详情「停止 Appium 服务」 |
| 任务一直 queued | 设备被其他任务占用或并发已满 | 等前一个任务结束；检查并发设置 |
| 设备离线/未授权 | USB、授权弹窗、adb 掉线 | 重新插拔；手机上允许调试；`adb devices` |
| 镜像黑屏/低帧 | 画质过高、scrcpy 被系统杀 | 切「极速」；等自愈；重新打开镜像 |
| 脚本跑一半失败 | 页面跳转、列表重置、抢焦点 | 看截图和 `currentApp()`；加返回列表校验 |

## 产品已知问题：UiAutomation 冲突

如果确实要手动抓一次系统界面树：

```powershell
adb shell ps -A | findstr wetest
adb shell pkill -f com.wetest.uia2.Main
adb shell uiautomator dump
```

规则：

- 常驻界面树服务运行期间，系统 `uiautomator dump` 会 `Killed`，这是独占导致的，不是脚本错误。
- 应用会自动回退系统 dump，回退前会先停服务。
- Appium 的 `io.appium.uiautomator2.server` 不能同时运行，先用设备详情「停止 Appium 服务」。

## 日志位置

```text
data/app.log                 应用日志、设备变化、fast-inspector 提示
data/runs/<runId>/run.log    本次运行完整日志
data/runs/<runId>/<设备>/    截图、fail-ui.xml
```

## 部署相关

| 改了什么 | 是否需要重启/重打包 |
|---|---|
| 只改脚本 | 不需要；复制到 `data/scripts` 后刷新 |
| 改 UI | `npm run build:ui` 后重启 |
| 改主进程 / 依赖 | 重启应用 |
| 改 resources（adb、jar、语言包） | 重启应用；安装版要重新打包 |
| 安装版 | 必须重新打包并安装 |

脚本源码目录里的文件不等于应用正在运行的副本；确认数据目录里的版本。

## 不要做

```text
不要为了绕过问题删除用户脚本或 data/
不要把未执行的验证说成已通过
不要在没有确认的情况下重新打包或覆盖安装
不要用固定长 sleep 掩盖状态问题
不要在日志里记录密码、Token、Cookie
```
