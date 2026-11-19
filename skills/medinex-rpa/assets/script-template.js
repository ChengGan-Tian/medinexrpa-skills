// 浏览器版 MedinexRPA 脚本模板
// 复制后修改 CONFIG、meta 和业务动作。
const CONFIG = {
  readySelector: '#ready',
  searchInput: { placeholder: '请输入关键词' },
  searchButton: { role: 'button', name: '查询' },
  rowSelector: '.result-row',
  emptySelector: '.empty',
  nextButtonName: '下一页',
  maxPages: 3,
};

export const meta = {
  name: '新脚本',
  description: '说明用途、前置条件和结果',
  useCurrentPage: true,
  params: [
    { key: 'keyword', label: '关键词', type: 'text', default: '', required: true },
    { key: 'maxItems', label: '最多处理', type: 'number', default: 20 },
    { key: 'dryRun', label: '只预览', type: 'checkbox', default: false },
  ],
  metrics: [
    { key: 'done', label: '完成', tone: 'ok', primary: true },
    { key: 'failed', label: '失败', tone: 'danger' },
  ],
};

export async function run(ctx) {
  const {
    page,
    params,
    kit,
    log,
    screenshot,
    progress,
    checkpoint,
    instanceDir,
  } = ctx;

  const keyword = String(params.keyword || '').trim();
  if (!keyword) throw new Error('关键词不能为空');
  if (!page.url().includes('/search')) throw new Error('请先进入搜索页');

  const maxItems = Math.max(1, Number(params.maxItems) || 20);
  const dryRun = Boolean(params.dryRun);
  const summary = { done: 0, failed: 0, pages: 0 };

  await kit.step('搜索', async () => {
    await kit.waitElement(CONFIG.readySelector);
    await kit.fill(CONFIG.searchInput, keyword);
    await kit.click(CONFIG.searchButton);
    await kit.waitForListReady({
      rowSelector: CONFIG.rowSelector,
      emptySelector: CONFIG.emptySelector,
    });
  });

  for (let pageIndex = 0; pageIndex < CONFIG.maxPages; pageIndex += 1) {
    await checkpoint();

    const rows = page.locator(CONFIG.rowSelector);
    const count = await rows.count();
    if (!count) {
      log(`第 ${pageIndex + 1} 页没有结果，停止`, 'warn');
      break;
    }

    const limit = Math.min(count, maxItems - summary.done - summary.failed);
    for (let i = 0; i < limit; i += 1) {
      await checkpoint();
      const row = rows.nth(i);
      const title = (await row.innerText().catch(() => '')).trim().slice(0, 60);

      if (dryRun) {
        log(`预览 ${pageIndex + 1}-${i + 1}：${title}`);
        continue;
      }

      try {
        await kit.step(`处理 ${title || `${pageIndex + 1}-${i + 1}`}`, async () => {
          await kit.click(row);
          await kit.waitStable(() => page.locator(CONFIG.rowSelector).count());
          // TODO: 业务动作
        });
        summary.done += 1;
      } catch (err) {
        summary.failed += 1;
        await screenshot(`失败_${pageIndex + 1}_${i + 1}`).catch(() => {});
        log(
          `失败：${title}（${String(err?.message || err).split('\n')[0]}）`,
          'warn',
        );
      }
      progress({ ...summary });
    }

    if (summary.done + summary.failed >= maxItems) break;
    if (dryRun) break;

    const next = page.getByRole('button', { name: CONFIG.nextButtonName });
    if (!(await next.count()) || !(await next.first().isEnabled().catch(() => false))) {
      log('没有下一页，停止', 'info');
      break;
    }

    await next.first().click();
    // TODO: 如果旧行还在，等待列表内容变化，而不是只等 ready。
    await kit.waitForListReady({
      rowSelector: CONFIG.rowSelector,
      emptySelector: CONFIG.emptySelector,
    });
    summary.pages += 1;
    progress({ ...summary });
  }

  return { keyword, ...summary, instanceDir };
}
