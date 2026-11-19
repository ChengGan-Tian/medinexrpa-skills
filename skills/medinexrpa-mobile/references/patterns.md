# 脚本模式

## 1. 虚拟列表遍历（RecyclerView / LazyColumn）

适用：关注列表、粉丝列表、搜索结果、消息列表。
不适用：一次就能读全的短列表。

### 原则

```text
1. 每次只读当前屏幕，不试图一次拿全量
2. 全局 seen 去重，不和上一屏比较
3. 只处理完整露出的 item，露一半的等下一屏
4. 步长小于一张卡片，保留 20% 重叠
5. 用锚点测实际滚动距离，按比例修正
6. 连续 2 次实测滚不动才判定到底；不要只看“有没有新卡片”
   返回列表后位置可能被重置，滚一屏可能全是已处理的人
   这时按“新卡片数”判到底会漏掉后面所有人
```

### 代码骨架

```js
const CARD = { id: 'card_container' };      // TODO: 卡片容器
const NAME_TEXT = { className: 'android.widget.TextView' }; // TODO: 名字文本

async function readRows(device) {
  const screen = device.screen();
  const cards = await device.findAll(CARD);
  const texts = await device.findAll(NAME_TEXT);

  return cards
    .map((card) => {
      const b = card.bounds;
      const nameEl = texts
        .filter((t) => t.text && t.bounds.y1 >= b.y1 && t.bounds.y1 <= b.y1 + 140)
        .sort((a, z) => a.bounds.y1 - z.bounds.y1)[0];
      return {
        key: nameEl?.text || `card-${b.y1}`,
        name: nameEl?.text || '',
        card,
        nameEl,
        fullyVisible: b.height > 160 && b.y1 >= 80 && b.y2 <= screen.height - 80,
      };
    })
    .filter((row) => row.name && row.fullyVisible);
}

export async function run({ device, kit, params, log, progress, checkpoint }) {
  const maxItems = Math.max(1, Number(params.maxItems) || 50);
  const maxScrolls = Math.max(0, Number(params.maxScrolls) || 20);
  const seen = new Set();
  let done = 0;
  let failed = 0;
  let scrolls = 0;
  let emptyRounds = 0;
  let stepScale = 1;

  while (done + failed < maxItems && scrolls <= maxScrolls) {
    await checkpoint();
    const rows = await readRows(device);
    const pending = rows.filter((row) => !seen.has(row.key));

    if (!pending.length) {
      const screen = device.screen();
      const cardH = Math.min(...rows.map((r) => r.card.bounds.height).filter(Boolean));
      const overlap = Math.max(40, Math.round(cardH * 0.2));
      const target = Math.max(120, Math.round((cardH - overlap) * stepScale));
      const x = Math.round(screen.width / 2);
      const fromY = Math.round(screen.height * 0.78);
      const toY = Math.max(120, fromY - target);

      const beforeTop = new Map(rows.map((r) => [r.key, r.card.bounds.y1]));
      await device.swipe(`${x},${fromY},${x},${toY}`, { duration: 700 });
      await kit.sleep(700);
      scrolls += 1;

      const after = await readRows(device);
      const anchor = after.find((r) => beforeTop.has(r.key));
      const actual = anchor ? beforeTop.get(anchor.key) - anchor.card.bounds.y1 : null;
      if (actual && actual > 0) {
        if (actual > target * 1.3) stepScale = Math.max(0.4, stepScale * (target / actual));
        else if (actual < target * 0.7) stepScale = Math.min(1.3, stepScale * 1.15);
      }

      const moved = actual !== null && actual >= 30;
      if (actual !== null && actual < -60) {
        log('列表回跳到上方（返回后位置被重置），继续向下扫描', 'warn');
        emptyRounds = 0;
        continue;
      }
      emptyRounds = moved ? 0 : emptyRounds + 1;
      log(`滚动 ${scrolls}：目标 ${target}px，实际 ${actual ?? '未测到'}px，可见 ${after.length}`);
      if (emptyRounds >= 2) break;
      continue;
    }

    for (const row of pending) {
      if (done + failed >= maxItems) break;
      if (seen.has(row.key)) continue;
      seen.add(row.key);

      try {
        if (row.nameEl) await row.nameEl.tap();
        else await device.tap(row.card.bounds.x1 + 80, row.card.bounds.y1 + 60);
        await kit.sleep(900);
        await device.back();
        await kit.sleep(800);
        done += 1;
      } catch (err) {
        failed += 1;
        log(`处理失败：${row.name}（${String(err?.message || err).split('\n')[0]}）`, 'warn');
      }
      progress({ done, failed });
    }
  }

  log(`完成：${done}，失败：${failed}，滚动：${scrolls}`, 'success');
  return { done, failed, scrolls };
}
```

### 调参

```text
卡片高度      从 card.bounds.height 取，不要写死
重叠          卡片高度 20%，最少 40px
起点 y        屏幕高度 78%，避开底部导航
步长上限      屏幕高度 25%~35%
settle        400~900ms，取决于列表惯性
结束          连续 2 次无新增，或达到 maxScrolls
```

### 去重 key

```text
优先：resource-id / 用户 id / 稳定 desc
其次：name + 副标题
最后：name（可能重名，接受少量漏项）
不要用：出现顺序、坐标、findAll 下标
```

## 2. 进入详情再返回

```js
async function openAndBack(device, kit, row) {
  if (row.nameEl) await row.nameEl.tap();
  else await device.tap(row.card.bounds.x1 + 80, row.card.bounds.y1 + 60);

  await kit.sleep(900);
  if (await device.exists({ text: '详情页标题' })) {
    // 业务动作
    await device.back();
    await kit.sleep(800);
    return true;
  }

  // 第一下可能只触发按压态
  await device.tap(row.card.bounds.x1 + 80, row.card.bounds.y1 + 60).catch(() => {});
  await kit.sleep(800);
  await device.back().catch(() => {});
  await kit.sleep(800);
  return device.exists({ text: '列表标题' });
}
```

返回后列表位置可能被重置；`seen` 保证不会重复点击，但可能多滚几屏。

## 3. 等待

```js
await kit.waitFor({ text: '首页' }, { timeout: 15000 });
await kit.waitGone({ text: '加载中' }, { timeout: 10000 });
await kit.sleep(300); // 只做动画沉降
```

- 不要用 `sleep(5000)` 代替等待。
- 点击后先等目标出现，再判断业务结果。
- 加载慢的列表可以 `waitFor` 骨架屏消失，而不是固定等待。

## 4. 重试

```js
await kit.retry(async () => {
  await kit.tap('提交');
  await kit.waitFor({ text: '提交成功' }, { timeout: 5000 });
}, { times: 3, delay: 800, label: '提交' });
```

- 只对幂等或可安全重复的动作重试。
- 支付、发送、删除等副作用操作不要盲目重试。
- 重试失败要保留最后一次现场。

## 5. 断点与落盘

```js
const file = `${instanceDir}/seen.jsonl`;
const seen = new Set((await kit.readJsonl(file)).map((x) => x.key));

await kit.appendJsonl(file, { key: row.key, name: row.name, at: Date.now() });
```

适合长列表、可能中途失败的脚本。下次运行先读回 seen。

## 6. 失败处理

```js
try {
  await kit.step('处理详情', async () => { /* ... */ });
} catch (err) {
  failed += 1;
  await screenshot('处理失败');
  log(`失败：${String(err?.message || err).split('\n')[0]}`, 'warn');
}
```

- 单条失败不要中断整批，除非列表已经丢失。
- 返回列表失败时立即停止，避免在错误页面继续点击。
- 失败后跑 `device.currentApp()`，确认是否被其他应用抢焦点。

## 7. 性能

```text
界面树单次 100~200ms，不要在高频循环里反复 force dump
device.dump 有 400ms 缓存，同一轮读取会复用
能用一次 findAll 拿到的，不要每个元素 find 一次
模板匹配 / OCR 比界面树慢，只在必要时用
```

## 8. 多设备脚本

- 脚本里不要假设只有一台设备；每个 task 有自己的 `device`。
- 不要跨设备共享可变状态；每个 task 独立。
- 产物写到 `instanceDir`，避免多台设备互相覆盖。
- 失败摘要返回给 `progress`，不要写大对象。

## 9. 页面守卫、开关按钮、入口路径

### 9.1 进入详情先做页面守卫

页面没跳过去时，首页上也可能有同名控件（例如底栏「关注」Tab）。
先确认页面身份，再找业务控件：

```js
const PKG = 'com.example.app';
const DETAIL_ANCHOR = { textContains: '粉丝' }; // TODO: 详情页独有

async function assertOnDetail(device) {
  const { package: pkg } = await device.currentApp();
  if (pkg !== PKG) throw new Error(`应用被切走：${pkg}`);
  if (await device.exists(DETAIL_ANCHOR)) return;
  throw new Error('不在详情页，本条不点击');
}
```

守卫失败时直接抛错并保留现场，不要硬找控件、不要连续 `back()` 试探。

### 9.2 开关类按钮不要盲目重试

关注 / 订阅 / 收藏是开关态，误点会改变真实状态，且通常不可逆。

```js
if (await device.exists({ text: '已关注' })) return 'skipped';
```

- 点击前先判断状态；
- 不要把开关操作塞进 `kit.retry`；
- 点击点固定在左侧头像/标题区域，避开右侧按钮。

### 9.3 入口路径不要猜

“搜索 → 用户 → 详情”这类入口各版本不同。
两条稳妥做法：

```text
1. 脚本要求先手动进入目标列表，再开始执行
2. 用 ui dump 记录一次真实入口，再把路径写死到脚本里
```

不要在入口未知时用连续 `back()` 试探，容易退出应用或进入无关页面。

### 9.4 先预览再真跑

```text
maxItems = 1 或 dryRun = true   验证选择器和页面
maxItems = 3                    验证滚动和返回
再跑正式数量
```

