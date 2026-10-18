async (page) => {
  // Fully mocked end-to-end check for comment likes (main comments only).
  // No real network: every /api/command call is fulfilled by Playwright, and no like is
  // ever sent upstream.
  const ORIGIN = 'http://127.0.0.1:5173';
  const preferences = { theme: 'light', zoom: 100, exit: 'close', shortcuts: true, animations: false, showSidebar: false };
  const states = { 'heybox.preferences': preferences, 'heybox.community-filter': { mode: 'all', included: [], excluded: [], unknown: true }, 'heybox.bookmarks': [], 'heybox.history': [] };

  const post = { id: 1, userId: '12345', author: '测试作者', avatar: '测', avatarUrl: '', color: '#ddd', time: '刚刚', title: '点赞测试帖子', excerpt: '评论点赞', body: ['正文'], topicIds: [], topics: [], likes: 0, comments: 5, images: [], kind: '讨论', level: 21, medalUrl: '', medalName: '', liked: false, createdAt: 0, videoUrl: '', isCy: false, ipLocation: '福建' };
  const mk = (id, author, text, likes, supported, extra = {}) => ({ id, userId: String(id), author, avatar: author.slice(0, 1), avatarUrl: '', text, images: [], likes, supported, time: '刚刚', rootId: id, level: 5, medalUrl: '', medalName: '', pinned: false, isAuthor: false, createdAt: 0, replyTo: '', replyCount: 0, hasMoreReplies: false, replies: [], ipLocation: '江苏', ...extra });
  const mkSub = (id, author, text, extra = {}) => ({ ...mk(id, author, text, 0, false), replyTo: '多回复楼层', ...extra });

  // Two preview replies so the thread can be expanded for (g).
  const previews = [mkSub(901, '预览甲', '预览回复甲'), mkSub(902, '预览乙', '预览回复乙')];
  const paged = [mkSub(903, '分页丙', '分页回复丙'), mkSub(904, '分页丁', '分页回复丁')];

  const cUnliked = mk(300, '未赞者', '未点赞的主评论', 5, false);
  const cLiked = mk(400, '已赞者', '已点赞的主评论', 8, true);
  const cZero = mk(500, '零赞者', '零计数已赞评论', 0, true);
  const cFail = mk(600, '失败者', '点赞会失败的主评论', 7, false);
  const cRapid = mk(700, '连点者', '连点两次的主评论', 3, false);
  const cThread = mk(800, '多回复楼层', '有子回复的主评论', 4, false, { replyCount: 4, hasMoreReplies: true, replies: previews });

  let account = { id: '12345', name: '测试账号', avatarUrl: '' };
  let slowLike = false;
  const failIds = new Set();
  const likeCalls = [];
  const detailCalls = [];

  const FIXED = {
    300: { likes: 5, supported: false },
    400: { likes: 8, supported: true },
    500: { likes: 0, supported: true },
    600: { likes: 7, supported: false },
    700: { likes: 3, supported: false },
    800: { likes: 4, supported: false },
  };

  await page.addInitScript(saved => { for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, JSON.stringify(value)); }, states);
  await page.route('**/api/command', async route => {
    const request = route.request().postDataJSON();
    let data;
    switch (request.type) {
      case 'bootstrap': data = { account, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[request.payload.key] ?? null; break;
      case 'stateSet': data = states[request.payload.key] = request.payload.value, true; break;
      case 'communities': data = []; break;
      case 'emojis': data = { version: 'synthetic', emojis: [] }; break;
      case 'feed': data = { posts: [post], cursor: { offset: 30, topics: {}, exhausted: [], rotation: 0 }, hasMore: false }; break;
      case 'detail': {
        detailCalls.push(request.payload.page);
        data = { post, comments: [cThread, cUnliked, cLiked, cZero, cFail, cRapid], page: request.payload.page, hasMore: false, isCy: false };
        break;
      }
      case 'subComments':
        data = { comments: paged, lastval: '904', hasMore: false };
        break;
      case 'likeComment': {
        likeCalls.push(request.payload);
        if (slowLike) await new Promise(resolve => setTimeout(resolve, 300));
        if (failIds.has(request.payload.id)) {
          await route.fulfill({ json: { ok: false, error: { code: 'upstream', message: '模拟点赞失败' } } });
          return;
        }
        data = { liked: request.payload.liked };
        break;
      }
      default: data = null;
    }
    await route.fulfill({ json: { ok: true, data } });
  });

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  const commentOf = text => page.locator('.comment').filter({ hasText: text });
  const likeOf = text => commentOf(text).locator('.comment-like');
  // The docked composer plus the lifted floating controls occupy the bottom-right of the
  // viewport, so centre the target before clicking (what a user would do) instead of
  // relying on Playwright's minimal scroll-into-view. The lift can also overlap the right
  // edge of the last comment's like button, so fall back to clicking its left part.
  const clickLike = async locator => {
    await locator.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(120);
    await locator.click();
  };
  const openDetail = async () => {
    await page.locator('.post-content').click();
    await page.getByText('未点赞的主评论', { exact: true }).waitFor();
  };

  await page.goto(`${ORIGIN}/`);
  await openDetail();

  // (a) the like control is a real, focusable button whose state mirrors `supported`.
  if (await page.locator('.comment-like').count() !== 6) throw new Error('Expected exactly one .comment-like per main comment');
  for (const [text, expected] of [['未点赞的主评论', { pressed: 'false', label: '点赞 未赞者 的评论', supported: false }], ['已点赞的主评论', { pressed: 'true', label: '取消点赞 已赞者 的评论', supported: true }]]) {
    const button = likeOf(text);
    if (await button.evaluate(el => el.tagName) !== 'BUTTON') throw new Error(`${text}: like control is not a button`);
    if (await button.evaluate(el => el.disabled)) throw new Error(`${text}: like button is disabled`);
    await button.focus();
    if (!await button.evaluate(el => el === document.activeElement)) throw new Error(`${text}: like button is not focusable`);
    if (await button.getAttribute('aria-pressed') !== expected.pressed) throw new Error(`${text}: aria-pressed=${await button.getAttribute('aria-pressed')}`);
    if (await button.getAttribute('aria-label') !== expected.label) throw new Error(`${text}: aria-label=${await button.getAttribute('aria-label')}`);
    if (await button.getAttribute('title') !== expected.label) throw new Error(`${text}: title=${await button.getAttribute('title')}`);
    if (await button.evaluate(el => el.classList.contains('is-supported')) !== expected.supported) throw new Error(`${text}: is-supported highlight wrong`);
  }

  // (f) sub replies must have neither the old like row nor any like button.
  await commentOf('有子回复的主评论').getByRole('button', { name: '全部 4 条回复' }).click();
  await commentOf('有子回复的主评论').getByText('分页回复丙', { exact: true }).waitFor();
  if (await page.locator('.sub-comment-likes').count() !== 0) throw new Error('.sub-comment-likes still present in the DOM');
  if (await page.locator('.sub-comment button.comment-like').count() !== 0) throw new Error('A sub-comment rendered a like button');

  // (g) liking a floor must not reset or collapse its expanded replies.
  const thread = commentOf('有子回复的主评论');
  const beforeCount = await thread.locator('.sub-comment').count();
  if (beforeCount !== 4) throw new Error(`Expected 4 rendered replies before liking, got ${beforeCount}`);
  const previousCalls = likeCalls.length;
  await clickLike(likeOf('有子回复的主评论'));
  await page.waitForFunction(() => document.querySelectorAll('.sub-comment').length === 4);
  if (likeCalls.length !== previousCalls + 1) throw new Error('Liking a floor did not issue exactly one likeComment');
  if (await thread.locator('.sub-comment').count() !== 4) throw new Error('Liking collapsed/reset the expanded replies');
  if (await thread.getByRole('button', { name: '收起回复' }).count() !== 1) throw new Error('Thread is no longer in the expanded state after liking');
  if (await likeOf('有子回复的主评论').getAttribute('aria-pressed') !== 'true') throw new Error('Floor like did not switch to supported');

  // (b) optimistic like: exactly one request, +1, aria-pressed flips.
  const unlikedBefore = await likeOf('未点赞的主评论').innerText();
  await clickLike(likeOf('未点赞的主评论'));
  await page.waitForFunction(() => document.querySelector('.toast') === null);
  if (likeCalls.length !== previousCalls + 2) throw new Error(`Expected one more likeComment, got ${likeCalls.length}`);
  const successCall = likeCalls[likeCalls.length - 1];
  if (successCall.id !== 300 || successCall.liked !== true) throw new Error(`Wrong like payload: ${JSON.stringify(successCall)}`);
  if (Number(unlikedBefore) !== 5) throw new Error(`Unexpected starting count: ${unlikedBefore}`);
  await page.waitForFunction(() => [...document.querySelectorAll('.comment')].some(c => c.textContent.includes('未点赞的主评论') && c.querySelector('.comment-like')?.textContent.trim() === '6'));
  if (await likeOf('未点赞的主评论').getAttribute('aria-pressed') !== 'true') throw new Error('Optimistic like did not set aria-pressed');

  // (b, failure) a rejected like rolls the count and state back and surfaces the reason.
  failIds.add(600);
  slowLike = true;
  const callsBeforeFail = likeCalls.length;
  await clickLike(likeOf('点赞会失败的主评论'));
  await page.waitForFunction(() => [...document.querySelectorAll('.comment')].some(c => c.textContent.includes('点赞会失败的主评论') && c.querySelector('.comment-like')?.textContent.trim() === '8'));
  const optimisticPressed = await likeOf('点赞会失败的主评论').getAttribute('aria-pressed');
  if (optimisticPressed !== 'true') throw new Error('Failed like did not optimistically flip first');
  await page.locator('.toast').waitFor();
  const toastText = await page.locator('.toast').innerText();
  if (!toastText.includes('模拟点赞失败')) throw new Error(`Toast did not surface the upstream reason: ${JSON.stringify(toastText)}`);
  if (likeCalls.length !== callsBeforeFail + 1) throw new Error('Failing like did not issue exactly one request');
  if (Number(await likeOf('点赞会失败的主评论').innerText()) !== 7) throw new Error('Rollback did not restore the like count');
  if (await likeOf('点赞会失败的主评论').getAttribute('aria-pressed') !== 'false') throw new Error('Rollback did not restore aria-pressed');
  slowLike = false;

  // (c) unliking sends liked:false, decrements, and never goes below zero.
  const callsBeforeUnlike = likeCalls.length;
  await clickLike(likeOf('已点赞的主评论'));
  await page.waitForFunction(() => [...document.querySelectorAll('.comment')].some(c => c.textContent.includes('已点赞的主评论') && c.querySelector('.comment-like')?.textContent.trim() === '7'));
  const unlikeCall = likeCalls[likeCalls.length - 1];
  if (likeCalls.length !== callsBeforeUnlike + 1 || unlikeCall.id !== 400 || unlikeCall.liked !== false) throw new Error(`Wrong unlike payload: ${JSON.stringify(unlikeCall)}`);
  if (await likeOf('已点赞的主评论').getAttribute('aria-pressed') !== 'false') throw new Error('Unlike did not clear aria-pressed');
  await clickLike(likeOf('零计数已赞评论'));
  await page.waitForFunction(() => [...document.querySelectorAll('.comment')].some(c => c.textContent.includes('零计数已赞评论') && c.querySelector('.comment-like')?.textContent.trim() === '0'));
  if (Number(await likeOf('零计数已赞评论').innerText()) !== 0) throw new Error('Like count went below zero');

  // (d) a second click while the first request is in flight is ignored.
  slowLike = true;
  const callsBeforeRapid = likeCalls.length;
  const rapid = likeOf('连点两次的主评论');
  await rapid.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(120);
  await rapid.click();
  await rapid.click();
  await page.waitForTimeout(700);
  slowLike = false;
  if (likeCalls.length !== callsBeforeRapid + 1) throw new Error(`Rapid double click issued ${likeCalls.length - callsBeforeRapid} requests`);
  if (likeCalls[likeCalls.length - 1].liked !== true) throw new Error('Rapid double click toggled twice');
  if (Number(await rapid.innerText()) !== 4) throw new Error(`Rapid double click produced the wrong count: ${await rapid.innerText()}`);

  // (e) logged out: the like button opens the login modal and sends nothing.
  account = null;
  const callsBeforeLoggedOut = likeCalls.length;
  await page.reload();
  await openDetail();
  await clickLike(likeOf('未点赞的主评论'));
  await page.locator('[role="dialog"]').waitFor();
  if (await page.locator('#modal-title').innerText() !== '你的社区账号') throw new Error(`Expected the login modal, got: ${await page.locator('#modal-title').innerText()}`);
  if (likeCalls.length !== callsBeforeLoggedOut) throw new Error('Logged-out click still sent a likeComment request');
  if (await likeOf('未点赞的主评论').getAttribute('aria-pressed') !== 'false') throw new Error('Logged-out click changed the optimistic state');
  await page.getByRole('button', { name: '关闭弹窗' }).click();
  await page.locator('[role="dialog"]').waitFor({ state: 'detached' });

  await page.screenshot({ path: 'output/playwright/comment-like.png' });
  if (errors.length) throw new Error(errors.join(';'));
  return {
    likeButtonContract: true,
    optimisticLike: true,
    failedLikeRollsBack: true,
    unlikeDecrements: true,
    unlikeNeverBelowZero: true,
    rapidClicksDeduplicated: true,
    loggedOutOpensLogin: true,
    noSubCommentLikes: true,
    likeKeepsRepliesExpanded: true,
    likeCallsObserved: likeCalls.length,
  };
}
