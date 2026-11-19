// MedinexRPA Mobile 脚本模板
// 复制后修改 meta、ANCHOR、CARD、NAME_TEXT 和 handleDetail。
export const meta = {
  name: '新脚本',
  description: '说明这个脚本做什么',
  params: [
    { key: 'maxItems', label: '最多处理', type: 'number', default: 20 },
    { key: 'maxScrolls', label: '最多滚动', type: 'number', default: 20 },
    { key: 'pauseMs', label: '详情页停留(ms)', type: 'number', default: 800 },
  ],
  metrics: [
    { key: 'done', label: '完成', primary: true, tone: 'ok' },
    { key: 'failed', label: '失败', tone: 'danger' },
  ],
};

// TODO: 改成目标页面的标题
const ANCHOR = { text: '目标页面标题' };
// TODO: 改成列表卡片容器
const CARD = { id: 'card_container' };
// TODO: 改成卡片里的名字文本
const NAME_TEXT = { className: 'android.widget.TextView' };

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

async function handleDetail(device, kit, row, params) {
  // TODO: 进入详情页后的业务动作
  await kit.sleep(Math.max(0, Number(params.pauseMs) || 800));
}

export async function run({ device, kit, params, log, progress, checkpoint, screenshot }) {
  const maxItems = Math.max(1, Number(params.maxItems) || 20);
  const maxScrolls = Math.max(0, Number(params.maxScrolls) || 20);
  const seen = new Set();
  let done = 0;
  let failed = 0;
  let scrolls = 0;
  let emptyRounds = 0;
  let stepScale = 1;

  await kit.step('确认页面', async () => {
    await device.wake();
    await kit.waitFor(ANCHOR, { timeout: 15000 });
  });

  while (done + failed < maxItems && scrolls <= maxScrolls) {
    await checkpoint();
    const rows = await readRows(device);
    const pending = rows.filter((row) => !seen.has(row.key));

    if (!pending.length) {
      const screen = device.screen();
      const heights = rows.map((row) => row.card.bounds.height).filter((value) => value > 0);
      const cardHeight = heights.length ? Math.min(...heights) : Math.round(screen.height * 0.2);
      const overlap = Math.max(40, Math.round(cardHeight * 0.2));
      const target = Math.max(120, Math.round((cardHeight - overlap) * stepScale));
      const x = Math.round(screen.width / 2);
      const fromY = Math.round(screen.height * 0.78);
      const toY = Math.max(120, fromY - target);

      const beforeTop = new Map(rows.map((row) => [row.key, row.card.bounds.y1]));
      await device.swipe(`${x},${fromY},${x},${toY}`, { duration: 700 });
      await kit.sleep(700);
      scrolls += 1;

      const after = await readRows(device);
      const anchor = after.find((row) => beforeTop.has(row.key));
      const actual = anchor ? beforeTop.get(anchor.key) - anchor.card.bounds.y1 : null;
      if (actual && actual > 0) {
        if (actual > target * 1.3) stepScale = Math.max(0.4, stepScale * (target / actual));
        else if (actual < target * 0.7) stepScale = Math.min(1.3, stepScale * 1.15);
      }

      const grew = after.some((row) => !seen.has(row.key));
      emptyRounds = grew ? 0 : emptyRounds + 1;
      log(`滚动 ${scrolls}：目标 ${target}px，实际 ${actual ?? '未测到'}px`);
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

        await kit.step(`处理 ${row.name}`, async () => {
          await handleDetail(device, kit, row, params);
        });

        await device.back();
        await kit.sleep(800);
        if (!(await device.exists(ANCHOR))) throw new Error('返回列表失败');
        done += 1;
      } catch (err) {
        failed += 1;
        await screenshot(`失败_${row.name}`);
        log(`处理失败：${row.name}（${String(err?.message || err).split('\n')[0]}）`, 'warn');
        await device.back().catch(() => {});
        await kit.sleep(800);
      }
      progress({ done, failed });
    }
  }

  log(`完成：${done}，失败：${failed}，滚动：${scrolls}`, 'success');
  return { done, failed, scrolls };
}
