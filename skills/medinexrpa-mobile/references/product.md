# 产品与架构

## 定位

MedinexRPA Mobile 是一个独立的 Windows 桌面应用，用 adb 连接 Android 真机和模拟器，在设备上执行 RPA 脚本。

```text
和浏览器版 MedinexRPA 完全独立
  独立安装包
  独立数据目录
  独立脚本格式（device / kit，不是 Playwright Page）
  独立任务模型（按设备实例）
```

不引入 Appium 的原因：Appium 是服务不是库，安装体积大、启动慢、和用户机器上已有的 Appium 抢 UiAutomation。当前方案直接走 adb，安装包只多 5 MB 左右。

## 能力

```text
设备        USB / 无线 adb；真机、MuMu、LDPlayer、BlueStacks
            显示型号、系统版本、分辨率、电量、当前应用
脚本        meta + params + run；按设备执行；支持多选设备
任务        同一设备互斥；全局并发上限；超出排队（queued）
            协作式停止，不强制杀进程
镜像        scrcpy H.264 + WebCodecs；单机全高、多设备宫格
            每格独立会话、独立解码、断流重连
            画质自动：1~2 台模拟器 480/30、真机 1024/30
                      3 台以上模拟器 360/24、真机 720/24
            手动「极速」：360/30（模拟器实测接近 30fps）
元素        界面树、text/id/desc/class/xpath、快照点击
视觉        模板匹配（@techstark/opencv-js）
            文字识别（tesseract.js，中英文语言包随包）
AI CLI      devices / doctor / ui dump / ui tree / ui find / ui shot
            snapshot / tap / swipe / input / key / wait / app
```

## 进程结构

```text
Electron 主进程
  ├─ DeviceManager     设备发现、状态、adb 封装
  │    ├─ Adb          @devicefarmer/adbkit
  │    ├─ FastInspector 设备端常驻 u2.jar（快速界面树）
  │    └─ AndroidDevice 设备动作、选择器、找图、OCR
  ├─ TaskManager       设备互斥、并发、queued、停止
  ├─ RunLifecycle      runId 聚合、多设备提交
  ├─ ScriptRunner      加载脚本、执行、失败现场
  └─ MirrorManager     scrcpy 会话、帧批量下发、自愈

渲染进程（React）
  ├─ 设备 / 脚本 / 任务 / 历史 / 设置
  ├─ 镜像页：宫格、设备多选、画质
  └─ 通过 IPC 调用主进程
```

## 数据目录

```text
开发模式   %APPDATA%\MedinexRPA-Mobile
安装版     <安装目录>\data
便携版     <exe 所在目录>\data
覆盖       RPA_DATA_DIR 环境变量
```

目录结构：

```text
data/
  scripts/              用户脚本（应用里可直接编辑）
  runs/<runId>/         每次运行一个目录
    run.log             完整日志
    <设备>/             该设备的截图和失败现场
      *_<错误>.png
      fail-ui.xml
  config.json           设置、任务配置
  history.json          运行历史
  app.log               应用日志
```

脚本源码目录 `scripts/` 只是内置示例；应用运行的是数据目录里的副本。改完要复制过去。

## 多设备任务模型

```text
用户提交：scriptPath + params + deviceIds[]
  → 一个 runId
  → 每台设备一个 task
  → 未超过并发：running；超过：queued
  → 全部结束：lastRun 聚合结果
```

同一台设备同一时间只允许一个任务，避免镜像和脚本、脚本和脚本互相抢焦点。

## 界面树

```text
默认使用设备端常驻服务读取界面树，单次约 100~200ms
不可用时自动回退系统 uiautomator dump，单次约 3~5s
服务占用 UiAutomation；期间手动 uiautomator dump 会 Killed
和 Appium 不能同时运行
```

脚本作者只需要知道：界面树读取通常很快；如果突然变慢或手动 dump 返回 Killed，
先看是否回退或冲突，不要先改选择器。

实现原理、参数和维护说明见项目文档 `docs/fast-inspector.md`。

## 技术栈

| 用途 | 选型 |
|---|---|
| 桌面端 | Electron |
| UI | React + Ant Design + Hugeicons + Motion |
| 代码编辑器 | CodeMirror 6 |
| 构建 | Vite + esbuild + electron-builder |
| 日志 | electron-log |
| ADB | @devicefarmer/adbkit |
| 界面树 | fast-xml-parser + xpath + @xmldom/xmldom |
| 语法检查 | acorn |
| 重试 / 并发 | p-retry / p-limit |
| 镜像 | @yume-chan/adb + adb-scrcpy + scrcpy-decoder-webcodecs |
| 视觉 | @techstark/opencv-js + tesseract.js + sharp |
| 设备端 | platform-tools/adb.exe、scrcpy-server、ADBKeyboard、u2.jar |

## 部署

```text
只改脚本          复制到 data/scripts，刷新脚本列表
改 UI              npm run build:ui
改主进程 / 依赖     重启应用
改 resources       重启应用
安装版             重新打包（先征得同意）
```

打包命令：`npm run dist`。开发启动：`npm start`。

## 安全与边界

- 只操作用户指定的设备和应用；不主动扫描无关数据。
- 不记录密码、Token、Cookie、完整隐私内容。
- 不删除用户数据目录；清理只按规则删除 runs。
- 不重新打包或覆盖安装，除非用户明确同意。
