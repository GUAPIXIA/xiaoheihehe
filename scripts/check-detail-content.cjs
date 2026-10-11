async (page) => {
  const preferences = { theme: 'light', zoom: 100, exit: 'close', shortcuts: true, animations: false, showSidebar: false };
  const states = { 'heybox.preferences': preferences, 'heybox.community-filter': { mode: 'all', included: [], excluded: [], unknown: true }, 'heybox.bookmarks': [], 'heybox.history': [] };
  const post = { id: 1, userId: '12345', author: '测试盒友', avatar: '测', avatarUrl: '', color: '#ddd', time: '刚刚', title: '详情图片和评论测试', excerpt: '测试摘要', body: Array.from({length: 30}, (_, i) => `正文段落 ${i + 1}`), topicIds: [], topics: [], likes: 0, comments: 3, images: ['/branding/heybox-icon.png?first', '/branding/heybox-icon.png?second'], level: 0, medalUrl: '', medalName: '', liked: false, createdAt: 0, videoUrl: '', isCy: false };
  const comment = id => ({ id, rootId: id, author: `评论者 ${id}`, avatar: '评', avatarUrl: '', text: `根评论 ${id}`, likes: 0, time: '刚刚' });
  const requestedPages = [];
  await page.addInitScript(saved => { for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, JSON.stringify(value)); }, states);
  await page.route('**/api/command', async route => {
    const request = route.request().postDataJSON(); let data;
    switch (request.type) {
      case 'bootstrap': data = { account: { id: '12345', name: '测试账号', avatarUrl: '' }, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[request.payload.key] ?? null; break;
      case 'stateSet': states[request.payload.key] = request.payload.value; data = true; break;
      case 'communities': data = []; break;
      case 'emojis': data = {version:'synthetic',emojis:[]}; break;
      case 'feed': data = { posts: [{...post, body: []}], cursor: { offset: 30, topics: {}, exhausted: [], rotation: 0 }, hasMore: false }; break;
      case 'detail': {
        const current = request.payload.page; requestedPages.push(current);
        data = { post, comments: current === 1 ? [comment(101), comment(102)] : [comment(103)], page: current, hasMore: current === 1, isCy: false }; break;
      }
      default: throw new Error(`Unexpected command ${request.type}`);
    }
    await route.fulfill({ json: { ok: true, data } });
  });
  try {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('heading', { name: post.title, exact: true }).waitFor();
    if (await page.locator('.detail-navigation').count()) throw new Error('Detail controls shown in feed');
    await page.locator('.post-content').click();
    await page.getByText('根评论 101', {exact: true}).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.detail-image img')].length === 2 && [...document.querySelectorAll('.detail-image img')].every(img => img.naturalWidth > 0));
    for (const zoom of [50, 100, 150, 300]) {
      await page.getByRole('button', {name: '调整窗口缩放', exact:true}).click();
      await page.getByRole('slider', {name:'窗口缩放',exact:true}).fill(String(zoom));
      await page.getByRole('button', {name: '关闭弹窗'}).click();
      await page.waitForFunction(value => document.querySelector('.zoom-control').textContent.includes(`${value}%`), zoom);
      await page.getByRole('button', {name: '跳到评论区', exact:true}).click();
      const scroll = await page.locator('.content-scroll').evaluate(root => {
        const scale = root.getBoundingClientRect().height / root.offsetHeight;
        const toolbar = document.querySelector('.detail-toolbar').getBoundingClientRect();
        const back = document.querySelector('.back-button').getBoundingClientRect();
        if (Math.abs(toolbar.top - root.getBoundingClientRect().top) > 2 || back.top < toolbar.top || back.bottom > toolbar.bottom) throw new Error('Back button is not pinned inside the scroll viewport');
        return {top:root.scrollTop, delta:document.querySelector('.comments-heading').getBoundingClientRect().top - toolbar.bottom - 8 * scale, bottom:root.scrollHeight - root.clientHeight - root.scrollTop};
      });
      if (scroll.top <= 0 || (Math.abs(scroll.delta) > 2 && scroll.bottom > 2)) throw new Error(`Comment jump failed at ${zoom}%: ${JSON.stringify(scroll)}`);
      const nav = await page.locator('.detail-navigation').boundingBox();
      const control = await page.locator('.zoom-control').boundingBox();
      if (nav.y + nav.height >= control.y) throw new Error('Navigation overlaps zoom control');
      await page.getByRole('button', {name:'回到顶部', exact:true}).click();
      if (await page.locator('.content-scroll').evaluate(root => root.scrollTop) !== 0) throw new Error('Top jump failed');
    }
    await page.getByRole('button', {name:'查看正文图片 1', exact:true}).click();
    await page.getByRole('heading', {name:'查看图片'}).waitFor();
    await page.waitForFunction(() => document.querySelector('.lightbox-image')?.naturalWidth > 0);
    if (await page.locator('.lightbox-image').getAttribute('referrerpolicy') !== 'no-referrer') throw new Error('Preview referrer policy missing');
    await page.getByRole('button', {name:'关闭弹窗'}).click();
    await page.getByRole('button', {name:'跳到评论区', exact:true}).click();
    await page.locator('.content-scroll').evaluate(root => { root.scrollTop = root.scrollHeight; });
    await page.getByText('根评论 103', {exact:true}).waitFor();
    if (await page.locator('.comment').count() !== 3 || requestedPages.join() !== '1,2') throw new Error('Comment pagination failed');
    if (await page.getByRole('button', {name:'加载更多评论', exact:true}).count()) throw new Error('Exhausted comments still offer pagination');
    await page.screenshot({path:'output/playwright/detail-navigation.png'});
    await page.getByRole('button', {name:'返回', exact:true}).click();
    if (await page.locator('.detail-navigation').count()) throw new Error('Controls remain after leaving post');
    return {imagesLoaded:true, previewLoaded:true, commentsPaginated:true, navigationZooms:[50,100,150,300], stickyBackButton:true, controlsOnlyInDetail:true};
  } finally { await page.unrouteAll({behavior:'wait'}); }
}
