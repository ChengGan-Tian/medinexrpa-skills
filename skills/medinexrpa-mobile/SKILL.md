---
name: medinexrpa-mobile
description: MedinexRPA Mobile 是独立的 Android RPA 桌面应用。本技能用于介绍产品、从零编写或修改手机脚本、设计参数和选择器、处理等待与滚动列表、图像/OCR 兜底、多设备任务，以及分析 run.log 与失败现场。用户提到 MedinexRPA Mobile、手机 RPA、Android 自动化、adb 设备、scrcpy 镜像、界面树、脚本、selector、任务或镜像时使用；只要在问手机脚本、滚动列表、找不到控件、run.log 报错、多设备并发，即使没有点名技能，也应使用。浏览器版 MedinexRPA 请改用 medinex-rpa；客户端已连接 medinexrpa MCP 时，优先用 MCP 工具操作设备。
---

# MedinexRPA Mobile

## 产品是什么

MedinexRPA Mobile 是一个独立的 Windows 桌面应用，用 adb 控制 Android 真机和模拟器执行 RPA 脚本。

```text
独立于浏览器版：不同安装包、数据目录、脚本格式和任务模型
直接走 adb：不用 Appium，不需要 Android SDK，启动即时
脚本即文件：改完放进数据目录就能跑，不需要重新打包
```

主要能力：

```text
设备      USB / 无线 adb；真机与常见模拟器；型号、系统、分辨率、电量
脚本      meta + params + run；按设备执行；可多选设备
任务      同一设备互斥；超出并发排队；协作式停止
镜像      scrcpy + WebCodecs；单机全高、多设备宫格、断流自愈
元素      text / id / desc / class / xpath；界面树和快照
视觉      模板匹配 + OCR，界面树拿不到时兜底
调试      每次运行独立目录：run.log、截图、失败界面树
AI CLI    读取界面、验证 selector、点击、滑动、输入、等待
```

默认源码目录：`E:\project\medinexrpa-mobile`。先确认 `package.json`，不要假设路径。

## 这个技能怎么用

- 面向**脚本作者**：写脚本、改脚本、定位元素、排查失败、部署脚本。
- 产品内部实现和事故记录在项目文档里，不塞进技能主线。
- 浏览器版 MedinexRPA（Playwright、kit、trace.zip）用 `medinex-rpa`。
- 不重新打包、不覆盖安装、不删除用户数据，除非用户明确同意。

详细资料：

| 需要什么 | 读 |
|---|---|
| 产品能力、数据目录、任务模型 | `references/product.md` |
| device / kit / 选择器 / 视觉 API | `references/script-api.md` |
| 列表、分页、等待、重试、守卫 | `references/patterns.md` |
| 模板匹配、OCR、视觉兜底 | `references/vision.md` |
| 排查失败、日志、已知陷阱 | `references/troubleshooting.md` |
| 新脚本骨架 | `assets/script-template.js` |

## 通过 MCP 操作（推荐）

手机版自带 MCP（18 个工具），客户端里服务名是 `medinexrpa`。

| 类别 | 工具 |
|---|---|
| 设备 | `list_devices` / `device_status` / `screenshot` |
| 界面 | `ui_dump` / `ui_find` / `wait_for` |
| 操作 | `tap` / `swipe` / `type_text` / `press_key` / `app_action` |
| 脚本 | `list_scripts` / `read_script` / `run_script` / `run_status` / `run_log` / `list_runs` / `stop_run` |

权限：`read` / `gesture` / `script`，跑脚本需要 `script`。

注意：

- MCP 不开 GUI 也能用，脚本和运行记录与 GUI 共用数据目录
- 同一台设备同时只能被 GUI 或 MCP 一方跑脚本（设备锁）
- 坐标点击默认关闭，优先用 `snapshotId + nodeId` 或界面树定位

## 写脚本的工作流

1. **明确边界**：前置页面、输入、完成条件、失败条件、是否有真实副作用（关注、发送、支付）。缺少业务规则时先问。
2. **看现场**：用 `npm run ai -- ui dump --json` 或设备详情抓树，确认真实控件，不靠猜。
3. **选定位策略**：`text/id/desc` → `xpath` → 模板匹配 → OCR。
4. **写最小版本**：先跑通一条，再加循环、分页、并发。
5. **小样本验证**：`maxItems=1` 或 `dryRun`，确认选择器和页面判断正确。
6. **扩大并回归**：3 条、10 条，观察失败率和日志。
7. **交付**：说明改动、验证结果、是否触碰真实设备、脚本是否已放进数据目录。

## 脚本结构

```js
export const meta = {
  name: '脚本名称',
  description: '一句话说明',
  params: [
    { key: 'keyword', label: '关键字', type: 'text', default: '', required: true },
    { key: 'maxItems', label: '最多处理', type: 'number', default: 20 },
    { key: 'dryRun', label: '只预览', type: 'checkbox', default: false },
  ],
  metrics: [
    { key: 'done', label: '完成', primary: true, tone: 'ok' },
    { key: 'failed', label: '失败', tone: 'danger' },
  ],
};

export async function run({ device, kit, params, log, progress, checkpoint, screenshot }) {
  let done = 0;
  let failed = 0;

  await kit.step('确认页面', async () => {
    await device.wake();
    await kit.waitFor({ text: '目标页面标题' }, { timeout: 15000 });
  });

  for (const item of await collectItems()) {
    await checkpoint();
    await kit.step(`处理 ${item}`, async () => {
      // 业务动作
    });
    done += 1;
    progress({ done, failed });
  }

  return { done, failed };
}
```

参数设计原则：

```text
只暴露业务需要的参数，不要把内部实现细节做成参数
默认值要能直接跑；高风险操作给 dryRun 或确认项
数量、上限、停留时间用 number；模式用 select；开关用 checkbox
progress 传累计绝对值；run 返回可序列化的小对象
```

## 常用设备 API

| 方法 | 说明 |
|---|---|
| `device.wake()` / `home()` / `back()` / `press(key)` | 系统动作 |
| `device.launch(pkg)` / `forceStop(pkg)` / `currentApp()` | 应用管理 |
| `device.find(selector, { timeout })` | 找控件，找不到抛错 |
| `device.findAll(selector)` | 找全部 |
| `device.exists(selector)` | 布尔 |
| `device.waitFor(selector, { timeout })` / `waitGone` | 等出现 / 消失 |
| `device.tap(selector)` / `tap(x, y)` | 点击 |
| `device.setText(selector, text)` / `clearText` / `type` | 输入 |
| `device.swipe(direction, { distance, duration })` | 滑动；也支持 `"x1,y1,x2,y2"` |
| `device.scrollTo(selector, { max })` | 滚动查找 |
| `device.screen()` / `screenshot(path)` | 屏幕与截图 |
| `device.findImage(template, opts)` / `findOcr(text, opts)` | 图像 / OCR |

完整列表见 `references/script-api.md`。元素对象有 `text / desc / id / bounds / center`，可直接 `tap()`。

## 定位策略

```text
优先：text / id / desc / className
其次：xpath（层级变动敏感，别写超长绝对路径）
最后：模板匹配 / OCR（自绘、游戏、WebView 文字拿不到时）
```

- `{ text: '登录' }` 是完全相等；文案可能带数字或前后缀时用 `textContains`。
- 能用 `id` 就不用文本；能用文本就不用坐标。
- 不要用 `findAll` 的下标当业务主键，顺序会变。
- 选择器写完用 AI CLI 确认 `matches: 1`，多命中就加条件收敛。
- 点击优先用元素对象，不要存旧坐标跨页面复用。

## 等待与停止

```js
await kit.waitFor({ text: '首页' }, { timeout: 15000 });
await kit.waitGone({ text: '加载中' }, { timeout: 10000 });
await checkpoint();          // 每轮循环检查停止
await kit.sleep(300);        // 只做动画沉降
```

- 等的是**条件**，不是时间；不要用长 `sleep` 掩盖状态问题。
- 停止是协作式的，`checkpoint()` 抛错后退出。
- 只对幂等操作重试；关注、发送、删除、支付不要盲目重试。
- 进入详情后先做页面守卫，确认页面再找业务控件。

## 列表与分页

虚拟列表（RecyclerView / LazyColumn）只创建屏幕附近的 item，没有“一次读全量”的接口。

```text
seen = 已处理集合
loop:
  current = 当前屏幕完整露出的 item
  pending = current - seen
  if pending 非空: 处理 pending, 加入 seen, continue
  scroll 一小步（小于一张卡片，保留重叠）
  用锚点测实际滚动距离，按比例修正步长
  连续 2 次实测滚不动才结束
```

要点：全局 seen、稳定去重 key、只处理完整露出的 item、保留重叠、锚点校正惯性、**用“滚不动”而不是“有没有新卡片”判到底**。

完整算法、代码骨架和变体见 `references/patterns.md`。

## 图像与 OCR

界面树拿不到时再用：

```js
const match = await kit.findImage('assets/button.png', { threshold: 0.9 });
await kit.tapImage('assets/button.png', { threshold: 0.9 });

const hit = await kit.findOcr('设置');
await kit.tapOcr('设置');
```

- 模板图要来自同一分辨率、同一主题，否则命中率会掉。
- OCR 适合纯文字和自绘界面，慢于界面树，不要放在高频循环里。
- 优先级始终是：界面树 → 模板匹配 → OCR。
- 模板要求、阈值、region、视觉回执见 `references/vision.md`。

## 多设备与任务

- 一次任务可选多台设备：一个 runId 下每台设备一个 task。
- 同一台设备同一时间只跑一个任务；超出并发进入 `queued`。
- `params` 是所有设备共用的一份；需要分片时按 `device.serial` 认领，或拆成多次提交。
- 脚本里不要假设只有一台设备，不要跨设备共享可变状态。
- 产物写到 `instanceDir`，避免多台设备互相覆盖。
- 镜像和脚本同时操作同一台设备会抢焦点，尽量错开。

## 调试

按顺序：

```text
1. data/runs/<runId>/run.log 最后 20~50 行，找到失败步骤
2. data/runs/<runId>/<设备>/ 下的失败截图
3. 同一目录的 fail-ui.xml，搜关键字确认当时界面
4. device.currentApp() / AI CLI 确认当前应用和页面
5. 再决定改选择器、加等待还是修导航
```

```powershell
npm run ai -- devices --json
npm run ai -- doctor --json
npm run ai -- ui dump --json --max-nodes 80
npm run ai -- ui find --text "搜索" --json
npm run ai -- ui shot --out shot.png
```

不要把“报错最后一行”当成根因；先确认页面和应用，再怀疑选择器。

## 部署

```text
开发版   %APPDATA%\MedinexRPA-Mobile
安装版   <安装目录>\data
便携版   <exe 所在目录>\data
覆盖     RPA_DATA_DIR 环境变量
```

- 只改脚本：复制到数据目录的 `scripts/`，刷新脚本列表，不需要重打包。
- 改 UI：`npm run build:ui` 后重启。
- 改主进程、依赖、resources：重启应用；安装版要重新打包。
- 打包或安装前先征得用户同意。

## 已知陷阱

这些是使用中容易误判的点，详细排查见 `references/troubleshooting.md`：

```text
手动 uiautomator dump 返回 Killed     常驻界面树服务占用 UiAutomation，属正常
和 Appium 同时用失败                  同一时刻只能一个 UiAutomation 持有者
中文输入没反应                        脚本需要先安装 ADBKeyboard
模拟器镜像帧率低                      先切「极速」，再减少同时镜像的设备
任务一直 queued                       设备被占用或并发已满
返回列表后位置变了                    用 seen 去重，不要按索引续跑
```

## 交付说明

最终说明：改了什么、为什么、涉及哪些文件、跑了哪些验证、是否触碰真实设备、脚本是否已复制到数据目录。
没有执行的验证不要写成已通过。
