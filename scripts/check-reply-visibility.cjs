async (page) => {
  // Fully mocked check for "clicking reply must not let auto-pagination push the reply
  // box out of view". No real network. Reproduces the failure signature recorded by
  // output/scratch/probe-reply-pagination.cjs (inputTop 1467 / inputVisible false).
  const ORIGIN = 'http://127.0.0.1:5173';
  const preferences = { theme: 'light', zoom: 100, exit: 'close', shortcuts: true, animations: false, showSidebar: false };
  const states = { 'heybox.preferences': preferences, 'heybox.community-filter': { mode: 'all', included: [], excluded: [], unknown: true }, 'heybox.bookmarks': [], 'heybox.history': [] };

  const post = { id: 1, userId: '12345', author: '测试作者', avatar: '测', avatarUrl: '', color: '#ddd', time: '刚刚', title: '回复可见性测试', excerpt: '分页顶走回复框', body: ['正文'], topicIds: [], topics: [], likes: 0, comments: 20, images: [], kind: '讨论', level: 21, medalUrl: '', medalName: '', liked: false, createdAt: 0, videoUrl: '', isCy: false, ipLocation: '江苏' };
  const mk = (id, author, text, extra = {}) => ({ id, userId: String(id), author, avatar: author.slice(0, 1), avatarUrl: '', text, images: [], likes: 1, supported: false, time: '刚刚', rootId: id, level: 5, medalUrl: '', medalName: '', pinned: false, isAuthor: false, createdAt: 0, replyTo: '', replyCount: 0, hasMoreReplies: false, replies: [], ipLocation: '江苏', ...extra });

  const previews = [mk(91, '预览回复者甲', '预览子回复甲', { replyTo: '主评论内容' }), mk(92, '预览回复者乙', '预览子回复乙', { replyTo: '主评论内容' })];
  const page1 = [mk(100, '主评论者', '主评论内容', { replyCount: 2, replies: previews }), ...Array.from({ length: 9 }, (_, i) => mk(200 + i, `评论区${i}`, `填充评论 ${i}`))];
  const page2 = Array.from({ length: 10 }, (_, i) => mk(300 + i, `第二批${i}`, `第二页评论 ${i}`));

  const detailCalls = [];
  await page.addInitScript(saved => { for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, JSON.stringify(value)); }, states);
  await page.route('**/api/command', async route => {
    const request = route.request().postDataJSON();
    let data;
    switch (request.type) {
      case 'bootstrap': data = { account: { id: '1', name: '验证账号', avatarUrl: '' }, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[request.payload.key] ?? null; break;
      case 'stateSet': data = states[request.payload.key] = request.payload.value, true; break;
      case 'communities': data = []; break;
      case 'emojis': data = { version: 'synthetic', emojis: [] }; break;
      case 'feed': data = { posts: [post], cursor: { offset: 30, topics: {}, exhausted: [], rotation: 0 }, hasMore: false }; break;
      case 'detail': {
        detailCalls.push(request.payload.page);
        const second = request.payload.page > 1;
        data = { post, comments: second ? [...page1, ...page2] : page1, page: request.payload.page, hasMore: !second, isCy: false };
        break;
      }
      case 'subComments': data = { comments: [], lastval: '', hasMore: false }; break;
      default: data = null;
    }
    await route.fulfill({ json: { ok: true, data } });
  });

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  const commentOf = text => page.locator('.comment').filter({ hasText: text });
  const sample = () => page.evaluate(() => {
    const input = document.getElementById('reply-input');
    const root = document.querySelector('.content-scroll');
    const target = document.querySelector('.reply-target');
    const box = input ? input.getBoundingClientRect() : null;
    const bounds = root ? root.getBoundingClientRect() : null;
    const intersects = (a, b) => !!a && !!b && a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right;
    return {
      replyTarget: target ? target.textContent.replace(/\s+/g, '') : null,
      inputTop: box ? Math.round(box.top) : -1,
      inputInScrollView: intersects(box, bounds),
      inputInWindow: !!box && box.top < window.innerHeight && box.bottom > 0,
      activeElement: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null,
      comments: document.querySelectorAll('.comment').length,
      detailPages: 0,
    };
  });

  await page.goto(`${ORIGIN}/`);
  await page.locator('.post-content').click();
  await page.getByText('主评论内容', { exact: true }).waitFor();
  await page.locator('.content-scroll').evaluate(node => { node.scrollTop = 0; });

  // (a) clicking reply on a main comment keeps the focused box on screen, right away.
  await commentOf('主评论内容').locator('.comment-content > small').getByRole('button', { name: '回复', exact: true }).click();
  await page.locator('.reply-target').waitFor();
  const afterClick = await sample();
  if (afterClick.replyTarget !== '回复@主评论者') throw new Error(`Reply target wrong: ${JSON.stringify(afterClick.replyTarget)}`);
  if (!afterClick.inputInScrollView) throw new Error(`Reply box left the scroll viewport right after clicking reply: ${JSON.stringify(afterClick)}`);
  if (!afterClick.inputInWindow) throw new Error(`Reply box is outside the window viewport: ${JSON.stringify(afterClick)}`);
  if (afterClick.activeElement !== 'reply-input') throw new Error(`Reply box is not focused: ${JSON.stringify(afterClick.activeElement)}`);

  // (b) while replying, driving the sentinel into view must NOT auto-paginate.
  await page.locator('.content-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await page.waitForTimeout(2000);
  const duringReply = await sample();
  if (detailCalls.filter(page => page > 1).length !== 0) throw new Error(`Auto-pagination ran while replying: ${JSON.stringify(detailCalls)}`);
  if (duringReply.comments !== 10) throw new Error(`Comment list grew while replying: ${duringReply.comments}`);

  // (d) a sub reply keeps the focused box on screen too.
  await page.locator('.sub-comment').filter({ hasText: '预览子回复甲' }).getByRole('button', { name: '回复', exact: true }).click();
  await page.locator('.reply-target').waitFor();
  const afterSub = await sample();
  if (afterSub.replyTarget !== '回复@预览回复者甲') throw new Error(`Sub reply target wrong: ${JSON.stringify(afterSub.replyTarget)}`);
  if (!afterSub.inputInScrollView) throw new Error(`Reply box left the viewport after a sub-reply click: ${JSON.stringify(afterSub)}`);
  if (afterSub.activeElement !== 'reply-input') throw new Error(`Reply box is not focused after a sub-reply click: ${JSON.stringify(afterSub.activeElement)}`);

  // (c) clearing the target resumes pagination: paused, not disabled.
  // The composer is now docked (always visible), so focusing it no longer scrolls the
  // list to the bottom; scroll there explicitly to bring the sentinel back into view.
  await page.locator('.reply-target button').click();
  await page.locator('.reply-target').waitFor({ state: 'detached' });
  await page.locator('.content-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await page.getByText('第二页评论 0', { exact: true }).waitFor({ timeout: 15000 });
  if (!detailCalls.includes(2)) throw new Error(`Page 2 was never requested after clearing the reply target: ${JSON.stringify(detailCalls)}`);
  const afterResume = await sample();
  if (afterResume.comments !== 20) throw new Error(`Expected 20 comments after resuming, got ${afterResume.comments}`);

  await page.screenshot({ path: 'output/playwright/reply-visibility.png' });
  if (errors.length) throw new Error(errors.join(';'));
  return {
    replyBoxVisibleAfterMainReply: true,
    replyBoxNotFocusedAway: true,
    noAutoPaginationWhileReplying: true,
    replyBoxVisibleAfterSubReply: true,
    paginationResumesAfterClearingTarget: true,
    detailPagesRequested: detailCalls.join(','),
  };
}
