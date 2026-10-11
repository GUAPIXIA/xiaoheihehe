async page => {
  const states = {
    'heybox.preferences': { theme: 'light', zoom: 100, exit: 'close', shortcuts: true, animations: false, showSidebar: true },
    'heybox.community-filter': { mode: 'all', included: [], excluded: [], unknown: true },
    'heybox.bookmarks': [], 'heybox.history': [],
  };
  const community = (id, name, file = '') => ({ id, name, short: name[0], color: '#5c6c85', members: '社区', icon: file ? `https://icons.example.test/${file}` : '' });
  const catalog = [community(1, '官方图标', 'logo.svg'), community(2, '补全图标'), community(3, '失效图标', 'broken.png'), community(4, '空图标'), community(5, '搜索补全'), community(6, '重复补全')];
  const topics = [community(1, '官方图标', 'cover.svg'), community(2, '补全图标', 'extra.svg'), community(6, '重复补全'), community(6, '重复补全', 'duplicate.svg')];
  const post = { id: 1, userId: '12345', author: '测试盒友', avatar: '测', avatarUrl: '', color: '#ddd', time: '刚刚', title: '社区图标测试', excerpt: '测试目录与帖子数据合并', body: [], topicIds: [1, 2, 6], topics, likes: 0, comments: 0, images: [], level: 14, medalUrl: '', medalName: '', liked: false, createdAt: 0, videoUrl: '', isCy: false };
  let releaseCatalog;
  const catalogReady = new Promise(resolve => { releaseCatalog = resolve; });
  await page.addInitScript(saved => { for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, JSON.stringify(value)); }, states);
  await page.route('https://icons.example.test/**', async route => {
    if (route.request().url().endsWith('broken.png')) { await route.fulfill({ status: 404, body: '' }); return; }
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="6" fill="#438ac9"/><circle cx="16" cy="16" r="8" fill="white"/></svg>' });
  });
  await page.route('**/api/command', async route => {
    const request = route.request().postDataJSON(); let data;
    switch (request.type) {
      case 'bootstrap': data = { account: null, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[request.payload.key] ?? null; break;
      case 'stateSet': states[request.payload.key] = request.payload.value; data = true; break;
      case 'emojis': data = { version: 'synthetic', emojis: [] }; break;
      case 'feed': data = { posts: [post], cursor: { offset: 30, topics: {}, exhausted: [], rotation: 0 }, hasMore: false }; break;
      case 'communities':
        if (request.payload.query) data = [community(5, '搜索补全', 'search.svg')];
        else { await catalogReady; data = catalog; }
        break;
      default: throw new Error(`Unexpected command ${request.type}`);
    }
    await route.fulfill({ json: { ok: true, data } });
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.community-ribbon img[src$="cover.svg"]').waitFor();
  releaseCatalog();
  const ribbon = page.locator('.community-ribbon');
  await ribbon.locator('img[src$="logo.svg"]').waitFor();
  await ribbon.locator('img[src$="duplicate.svg"]').waitFor();
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('.community-ribbon button:not(.home-community-manage)')];
    return buttons.length === 6 && buttons.filter(button => button.querySelector('img')).length === 3 && [...document.querySelectorAll('.community-ribbon img')].every(img => img.naturalWidth > 0);
  });
  if (await ribbon.locator('img[src$="cover.svg"]').count()) throw new Error('Post cover overwrote official logo');
  if (await ribbon.locator('img[src$="extra.svg"]').count() !== 1) throw new Error('Missing directory icon not completed from posts');
  for (const name of ['失效图标', '空图标']) {
    const icon = ribbon.locator('button').filter({ hasText: name }).locator('.community-icon');
    if (await icon.textContent() !== name[0]) throw new Error('Missing image fallback');
  }
  await page.getByRole('button', { name: '管理屏蔽社区', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索屏蔽社区' }).fill('搜索补全');
  await page.locator('.filter-community img[src$="search.svg"]').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.blocked-community-choices img[src$="search.svg"]')].length === 1 && [...document.querySelectorAll('img[src$="search.svg"]')].every(img => img.naturalWidth > 0));
  await page.getByRole('textbox', { name: '搜索屏蔽社区' }).fill('');
  await page.waitForFunction(() => document.querySelectorAll('.filter-community').length === 6 && !document.querySelector('.filter-community img[src$="broken.png"]'));
  await page.screenshot({ path: 'output/playwright/community-icons.png' });
  return { officialLogoPriority: true, delayedDirectoryPreservesExtras: true, duplicateCompletion: true, missingAndFailedFallback: true, searchCompletionInSettings: true };
}
