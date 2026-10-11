// Playwright CLI: run-code --filename=scripts/check-feed-navigation.cjs
async (page) => {
  const preferences = { theme: 'light', zoom: 100, exit: 'close', shortcuts: true, animations: false, showSidebar: false };
  const filter = { mode: 'exclude', included: [], excluded: [999], unknown: true };
  const states = { 'heybox.preferences': preferences, 'heybox.community-filter': filter, 'heybox.bookmarks': [], 'heybox.history': [] };
  await page.addInitScript(saved => {
    for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, JSON.stringify(value));
  }, states);
  const topic = { id: 10, name: '测试社区', short: '测', color: '#ddd', members: '社区', icon: '' };
  const requests = [];
  const generatedPosts = new Map();
  let round = 0, failNext = false, emptyNext = false;
  const makePosts = (offset, count) => Array.from({ length: count }, (_, index) => ({
    id: round * 1000 + offset + index + 1, userId: '12345', author: '测试盒友', avatar: '测', avatarUrl: '', color: '#ddd', time: '刚刚',
    title: `第 ${round} 轮推荐 ${offset + index + 1}`, excerpt: '用于验证滚动分页，刷新后应从第一页开始，保留社区筛选。'.repeat(3),
    body: [], topicIds: [10], topics: [topic], likes: 0, comments: 0, images: [], level: 0, medalUrl: '', medalName: '', liked: false, createdAt: 0, videoUrl: '', isCy: false,
  }));
  const waitUntil = async predicate => {
    const deadline = Date.now() + 10000;
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error('Timed out waiting for feed request');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  };
  await page.route('**/api/command', async route => {
    const request = route.request().postDataJSON();
    let data;
    switch (request.type) {
      case 'bootstrap': data = { account: null, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[request.payload.key] ?? null; break;
      case 'stateSet': states[request.payload.key] = request.payload.value; data = true; break;
      case 'communities': data = [topic]; break;
      case 'emojis': data = {version:'synthetic',emojis:[]}; break;
      case 'detail': data = {post:{...generatedPosts.get(request.payload.id),body:Array.from({length:30},(_,i)=>`正文 ${i}`)},comments:[],page:1,hasMore:false,isCy:false}; break;
      case 'feed': {
        const offset = request.payload.cursor?.offset ?? 0;
        const empty = offset === 0 && emptyNext;
        if (empty) emptyNext = false;
        requests.push(request.payload);
        if (offset === 0) round++;
        else {
          await new Promise(resolve => setTimeout(resolve, 250));
          if (failNext) {
            failNext = false;
            await route.fulfill({ json: { ok: false, error: { code: 'network', message: '分页测试：连接暂时失败' } } });
            return;
          }
        }
        data = { posts: empty ? [] : makePosts(offset, 8), hasMore: offset === 0, cursor: { offset: offset + 30, topics: {}, exhausted: [], rotation: 0 } };
        for (const post of data.posts) generatedPosts.set(post.id, post);
        break;
      }
      default: throw new Error(`Unexpected command ${request.type}`);
    }
    await route.fulfill({ json: { ok: true, data } });
  });
  try {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('heading', { name: '第 1 轮推荐 1', exact: true }).waitFor();
    const barHeight = await page.locator('.titlebar').evaluate(el => parseFloat(getComputedStyle(el).height));
    if (barHeight !== 42) throw new Error(`Header height is ${barHeight}`);
    if (await page.getByRole('button', { name: '加载更多', exact: true }).count()) throw new Error('Manual load button still exists');
    const scrollBottom = () => page.locator('.content-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await scrollBottom();
    await waitUntil(() => requests.length === 2);
    await scrollBottom(); await scrollBottom();
    await page.getByRole('heading', { name: '第 1 轮推荐 38', exact: true }).waitFor();
    if (await page.locator('.post-card').count() !== 16) throw new Error('Pagination did not append posts');
    await scrollBottom();
    await new Promise(resolve => setTimeout(resolve, 300));
    if (requests.length !== 2) throw new Error('Duplicate or exhausted pagination request');
    for (const method of ['button','Escape']) {
      const root = page.locator('.content-scroll');
      await root.evaluate(el => { el.scrollTop = 1100; });
      const before = await root.evaluate(el => el.scrollTop);
      const card = page.locator('.post-card').filter({hasText:'第 1 轮推荐 33'});
      await card.locator('.post-content').click();
      const detail = page.locator('.post-detail');
      await detail.waitFor();
      if (await root.evaluate(el => el.scrollTop) !== 0) throw new Error('Detail did not start at top');
      await page.getByRole('button',{name:'跳到评论区',exact:true}).click();
      if (method === 'button') await page.getByRole('button',{name:'返回',exact:true}).click();
      else await page.keyboard.press('Escape');
      await page.locator('.post-list').waitFor();
      const restored = await root.evaluate(el => el.scrollTop);
      if (Math.abs(restored-before)>2) throw new Error(`List scroll not restored via ${method}: ${before} -> ${restored}`);
      if (await page.locator('.post-card').count() !== 16 || requests.length !== 2) throw new Error('Return reloaded or lost paginated posts');
    }
    await page.getByRole('button', { name: '刷新推荐内容' }).click();
    await page.getByRole('heading', { name: '第 2 轮推荐 1', exact: true }).waitFor();
    if (await page.locator('.post-card').count() !== 8) throw new Error('Refresh kept old posts');
    if (await page.locator('.content-scroll').evaluate(el => el.scrollTop) !== 0) throw new Error('Refresh did not return to top');
    if (JSON.stringify(requests.at(-1).filter) !== JSON.stringify(filter)) throw new Error('Refresh changed the community filter');
    failNext = true;
    await scrollBottom();
    await page.getByRole('alert').filter({ hasText: '分页测试：连接暂时失败' }).waitFor();
    const failedCount = requests.length;
    await new Promise(resolve => setTimeout(resolve, 400));
    if (requests.length !== failedCount) throw new Error('Failed page retried automatically');
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await page.getByRole('heading', { name: '第 2 轮推荐 38', exact: true }).waitFor();
    if (requests.at(-1).cursor.offset !== 30) throw new Error('Retry restarted the list instead of the failed page');
    await page.getByRole('navigation', { name: '社区分区' }).getByRole('button', { name: '测试社区' }).click();
    await page.getByRole('heading', { name: '第 3 轮推荐 1', exact: true }).waitFor();
    await page.getByRole('button', { name: '刷新推荐内容' }).click();
    await page.getByRole('heading', { name: '第 4 轮推荐 1', exact: true }).waitFor();
    const refreshed = requests.at(-1);
    if (refreshed.topic !== null || refreshed.tab !== '推荐' || refreshed.query !== '') throw new Error('Refresh did not return to recommendations');
    const bounds = await page.evaluate(() => {
      const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
      return { refresh: rect('.refresh-control'), zoom: rect('.zoom-control'), frame: rect('.desktop-window') };
    });
    if (bounds.refresh.bottom > bounds.zoom.top || bounds.refresh.right > bounds.frame.right || bounds.refresh.bottom > bounds.frame.bottom) throw new Error('Floating controls overlap or leave the window');
    await page.screenshot({ path: 'output/playwright/feed-navigation.png' });
    emptyNext = true;
    await page.getByRole('button', { name: '刷新推荐内容' }).click();
    await page.getByRole('heading', { name: '第 5 轮推荐 38', exact: true }).waitFor();
    if (await page.locator('.post-card').count() !== 8) throw new Error('Empty page did not advance to the next cursor automatically');
    return { automaticPagination: true, duplicateGuard: true, exhaustedStops: true, errorRetryPreservesCursor: true, refreshResetsList: true, filterPreserved: true, emptyPageAdvances: true, returnRestoresScroll:true, escapeRestoresScroll:true, paginatedPostsPreserved:true, barHeight, bounds };
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
  }
}
