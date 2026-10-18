async (page) => {
  // Fully mocked check for the floating comment composer (task-15 contract):
  // S0 = normal flow at the end of the list, S1 = `.reply-form.is-docked` sticky to the
  // bottom of the scroll viewport. No real network; no comment or like is ever sent.
  const ORIGIN = 'http://127.0.0.1:5173';
  const EMOJIS = [
    { token: '[cube_惊讶]', name: '惊讶', url: `${ORIGIN}/cme-1.svg`, group: 'cube', groupName: 'CUBE表情' },
    { token: '[cube_哭泣]', name: '哭泣', url: `${ORIGIN}/cme-2.svg`, group: 'cube', groupName: 'CUBE表情' },
  ];
  const preferences = { theme: 'light', zoom: 100, windowWidth: 720, exit: 'close', shortcuts: true, animations: false, showSidebar: false };
  const states = { 'heybox.preferences': preferences, 'heybox.community-filter': { mode: 'all', included: [], excluded: [], unknown: true }, 'heybox.bookmarks': [], 'heybox.history': [] };

  const post = { id: 1, userId: '12345', author: '测试作者', avatar: '测', avatarUrl: '', color: '#ddd', time: '刚刚', title: '评论框帖子', excerpt: '悬浮态', body: ['正文段落'], topicIds: [], topics: [], likes: 0, comments: 21, images: [], kind: '讨论', level: 21, medalUrl: '', medalName: '', liked: false, createdAt: 0, videoUrl: '', isCy: false, ipLocation: '江苏' };
  const shortPost = { ...post, id: 2, title: '短帖子', comments: 1 };
  const postB = { ...post, id: 3, title: '第二个帖子' };
  const mk = (id, author, text, extra = {}) => ({ id, userId: String(id), author, avatar: author.slice(0, 1), avatarUrl: '', text, images: [], likes: 12, supported: false, time: '刚刚', rootId: id, level: 5, medalUrl: '', medalName: '', pinned: false, isAuthor: false, createdAt: 0, replyTo: '', replyCount: 0, hasMoreReplies: false, replies: [], ipLocation: '江苏', ...extra });
  const page1Comments = Array.from({ length: 21 }, (_, i) => mk(400 + i, `评论者${i}`, `评论内容 ${i}`));
  const page2Comments = Array.from({ length: 5 }, (_, i) => mk(500 + i, `第二批${i}`, `第二页评论 ${i}`));
  const oneComment = [mk(200, '独苗', '唯一的评论')];

  const commentCalls = [];
  const likeCalls = [];
  const detailCalls = [];
  const unexpected = [];
  let hasMorePages = false;
  let slowComment = false;
  let failComment = false;

  await page.route('**/cme-*.svg', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#5cb85c"/></svg>' }));
  await page.route('**/api/command', async route => {
    const r = route.request().postDataJSON();
    let data;
    switch (r.type) {
      case 'bootstrap': data = { account: { id: '99999', name: '测试账号', avatarUrl: '' }, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[r.payload.key] ?? null; break;
      case 'stateSet': data = states[r.payload.key] = r.payload.value, true; break;
      case 'communities': data = []; break;
      case 'emojis': data = { version: 'synthetic', emojis: EMOJIS }; break;
      case 'feed': data = { posts: [post, shortPost, postB], cursor: { offset: 30, topics: {}, exhausted: [], rotation: 0 }, hasMore: false }; break;
      case 'detail': {
        detailCalls.push({ id: r.payload.id, page: r.payload.page });
        const target = r.payload.id === 2 ? shortPost : r.payload.id === 3 ? postB : post;
        let comments = r.payload.id === 2 ? oneComment : page1Comments;
        if (hasMorePages && r.payload.id === 1 && r.payload.page > 1) comments = [...page1Comments, ...page2Comments];
        // Only the main post paginates; the short post must genuinely have nothing more.
        data = { post: target, comments, page: r.payload.page, hasMore: hasMorePages && r.payload.id === 1 && r.payload.page === 1, isCy: false };
        break;
      }
      case 'comment':
        commentCalls.push(r.payload);
        if (slowComment) await new Promise(resolve => setTimeout(resolve, 150));
        if (failComment) { await route.fulfill({ json: { ok: false, error: { code: 'upstream', message: '模拟发送失败' } } }); return; }
        data = true;
        break;
      case 'likeComment': likeCalls.push(r.payload); data = { liked: r.payload.liked }; break;
      default: unexpected.push(r.type); data = null;
    }
    await route.fulfill({ json: { ok: true, data } });
  });

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  const intersects = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const snapshot = () => page.evaluate(() => {
    const px = v => Math.round(v * 100) / 100;
    const rect = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: px(b.top), bottom: px(b.bottom), left: px(b.left), right: px(b.right), width: px(b.width), height: px(b.height) }; };
    const form = document.querySelector('.reply-form');
    const scroll = document.querySelector('.content-scroll');
    const input = document.getElementById('reply-input');
    const comments = [...document.querySelectorAll('.comment')];
    const last = comments[comments.length - 1];
    const style = form ? getComputedStyle(form) : null;
    const active = document.activeElement;
    const inner = document.querySelector('.window-inner');
    const scale = inner && inner.offsetWidth ? inner.getBoundingClientRect().width / inner.offsetWidth : 1;
    return {
      scale,
      docked: !!form && form.classList.contains('is-docked'),
      form: rect(form),
      scroll: rect(scroll),
      lastComment: rect(last),
      position: style?.position ?? null,
      bottom: style?.bottom ?? null,
      borderBottomWidth: style?.borderBottomWidth ?? null,
      background: style?.backgroundColor ?? null,
      scrollTop: scroll ? px(scroll.scrollTop) : null,
      formFlushToBottom: !!(form && scroll) && Math.abs(form.getBoundingClientRect().bottom - scroll.getBoundingClientRect().bottom) <= 2,
      lift: document.documentElement.style.getPropertyValue('--reply-dock-lift'),
      navBottom: document.querySelector('.detail-navigation') ? getComputedStyle(document.querySelector('.detail-navigation')).bottom : null,
      zoomBottom: document.querySelector('.zoom-control') ? getComputedStyle(document.querySelector('.zoom-control')).bottom : null,
      nav: [...document.querySelectorAll('.detail-navigation > button')].map(rect),
      zoom: rect(document.querySelector('.zoom-control')),
      active: active ? (active.id || active.getAttribute?.('aria-label') || active.tagName) : null,
      replyTarget: document.querySelector('.reply-target')?.textContent.replace(/\s+/g, '') ?? null,
      commentCount: comments.length,
      inputHeight: input ? px(input.getBoundingClientRect().height) : null,
      inputValue: input ? input.value : null,
      collapseButton: !!document.querySelector('.composer-collapse'),
      scrollOverflow: scroll ? scroll.scrollWidth - scroll.clientWidth : null,
      detailOverflow: (() => { const d = document.querySelector('.post-detail'); return d ? d.scrollWidth - d.clientWidth : null; })(),
      inDetail: !!document.querySelector('.post-detail'),
    };
  });
  const scrollTo = async where => {
    await page.locator('.content-scroll').evaluate((node, position) => {
      node.scrollTop = position === 'top' ? 0 : position === 'middle' ? node.scrollHeight / 2 : node.scrollHeight;
    }, where);
    await page.waitForTimeout(250);
  };
  const load = async ({ windowWidth = 720, zoom = 100, theme = 'light', open = 0 }) => {
    preferences.windowWidth = windowWidth; preferences.zoom = zoom; preferences.theme = theme;
    states['heybox.preferences'] = { ...preferences };
    await page.addInitScript(saved => { for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, JSON.stringify(v)); }, { 'heybox.preferences': { ...preferences } });
    await page.goto(`${ORIGIN}/`);
    await page.locator('.post-list').waitFor();
    if (open === null) return;
    await page.locator('.post-card').nth(open).locator('.post-content').click();
    await page.getByText(open === 1 ? '唯一的评论' : '评论内容 0', { exact: true }).waitFor();
    await page.waitForTimeout(250);
  };
  const submit = () => page.getByRole('button', { name: '评论', exact: true });
  const postButton = () => page.getByRole('button', { name: '回复 评论框帖子' });
  const commentWith = text => page.locator('.comment').filter({ has: page.getByText(text, { exact: true }) });
  const replyButtonOf = text => commentWith(text).locator('.comment-content > small').getByRole('button', { name: '回复', exact: true });
  const waitDocked = (timeout = 5000) => page.waitForFunction(() => document.querySelector('.reply-form')?.classList.contains('is-docked'), null, { timeout });

  // ---------------------------------------------------------------------------
  // (a) multi-comment post: the composer docks, sticks to the bottom, never scrolls.
  // ---------------------------------------------------------------------------
  hasMorePages = true;
  await load({ open: 0 });
  const beforeDock = await snapshot();
  if (beforeDock.docked) throw new Error('composer must start undocked');
  if (beforeDock.lift !== '0px') throw new Error(`lift should start at 0px, got ${beforeDock.lift}`);
  const scrollTopBeforeDock = beforeDock.scrollTop;
  const commentsBeforeDock = commentCalls.length;
  await postButton().click({ timeout: 5000 });
  await waitDocked();
  await page.waitForFunction(() => document.activeElement?.id === 'reply-input', null, { timeout: 5000 });
  const docked = await snapshot();
  if (docked.position !== 'sticky') throw new Error(`docked position should be sticky, got ${docked.position}`);
  if (docked.bottom !== '0px') throw new Error(`docked bottom should be 0px, got ${docked.bottom}`);
  if (!docked.formFlushToBottom) throw new Error(`docked composer is not flush with the viewport bottom: ${JSON.stringify({ form: docked.form, scroll: docked.scroll })}`);
  if (docked.scrollTop !== scrollTopBeforeDock) throw new Error(`docking scrolled the page: ${scrollTopBeforeDock} -> ${docked.scrollTop}`);
  if (docked.active !== 'reply-input') throw new Error(`composer was not focused: ${docked.active}`);
  if (docked.replyTarget) throw new Error(`post comment button left a reply target: ${docked.replyTarget}`);
  if (commentCalls.length !== commentsBeforeDock) throw new Error('comment button sent a comment');
  if (!docked.collapseButton) throw new Error('collapse button missing while docked');

  const dockSamples = [];
  const sampleDock = async label => { const s = await snapshot(); dockSamples.push({ label, docked: s.docked, flush: s.formFlushToBottom, scrollTop: s.scrollTop, formBottom: s.form?.bottom ?? null, scrollBottom: s.scroll?.bottom ?? null, lastCommentBottom: s.lastComment?.bottom ?? null, lift: s.lift, inputHeight: s.inputHeight }); };
  await sampleDock('docked');
  await page.waitForTimeout(3000);
  await sampleDock('after-3s-idle');
  await page.locator('#reply-input').fill('悬浮态草稿');
  await page.waitForTimeout(400);
  await sampleDock('after-typing');
  await page.locator('.emoji-toggle').click();
  await page.locator('.emoji-picker').waitFor();
  await page.waitForTimeout(400);
  await sampleDock('emoji-open');
  await page.locator('.emoji-toggle').click();
  await page.waitForTimeout(200);
  await scrollTo('middle');
  await sampleDock('scrolled-middle');
  await scrollTo('top');
  await sampleDock('scrolled-top');
  await scrollTo('bottom');
  await sampleDock('scrolled-bottom');
  for (const sample of dockSamples) {
    if (!sample.docked) throw new Error(`composer undocked unexpectedly at ${sample.label}: ${JSON.stringify(sample)}`);
    // At the very end of the list the sticky form comes to rest at its natural position
    // (the container has trailing padding), so it is only "flush" while pinned.
    if (sample.label === 'scrolled-bottom') {
      if (sample.formBottom > sample.scrollBottom + 2) throw new Error(`composer extends past the viewport bottom at ${sample.label}: ${JSON.stringify(sample)}`);
      if (sample.lastCommentBottom !== null && sample.lastCommentBottom > sample.formBottom + 1) throw new Error(`composer covers the last comment at ${sample.label}: ${JSON.stringify(sample)}`);
    } else if (!sample.flush) {
      throw new Error(`composer stopped sticking to the bottom at ${sample.label}: ${JSON.stringify(sample)}`);
    }
  }
  if (dockSamples.some(s => s.lift === '0px')) throw new Error(`lift stayed 0 while docked and visible: ${JSON.stringify(dockSamples)}`);
  // Park at the top so the form is genuinely pinned for the geometry checks below.
  await scrollTo('top');

  // ---------------------------------------------------------------------------
  // (f) geometry while docked
  // ---------------------------------------------------------------------------
  const geometry = await snapshot();
  // Everything below is expressed in CSS px: `.window-inner` applies a transform scale.
  const cssInputHeight = geometry.inputHeight / geometry.scale;
  if (cssInputHeight < 43 || cssInputHeight > 60) throw new Error(`docked textarea height should be the compact min-height (~44-47px), got ${cssInputHeight} CSS px (rect ${geometry.inputHeight}, scale ${geometry.scale})`);
  if (geometry.nav.some(box => intersects(geometry.form, box))) throw new Error('docked composer overlaps .detail-navigation');
  if (intersects(geometry.form, geometry.zoom)) throw new Error('docked composer overlaps .zoom-control');
  // `trial: true` runs the actionability checks (including "receives pointer events")
  // without actually clicking, so this cannot send the draft.
  await submit().click({ trial: true, timeout: 5000 });
  await page.locator('#reply-input').fill('很长的评论。'.repeat(80));
  await page.waitForTimeout(400);
  const longText = await page.evaluate(() => {
    const input = document.getElementById('reply-input');
    const viewport = document.querySelector('.content-scroll').getBoundingClientRect().height;
    return { height: input.getBoundingClientRect().height, viewport, scrollable: input.scrollHeight > input.clientHeight + 1 };
  });
  if (longText.height > longText.viewport * 0.30 + 2) throw new Error(`textarea exceeded 30vh: ${JSON.stringify(longText)}`);
  if (!longText.scrollable) throw new Error(`long text did not scroll internally: ${JSON.stringify(longText)}`);
  const afterLongText = await snapshot();
  if (!afterLongText.formFlushToBottom) throw new Error('long text broke the bottom stickiness');
  await page.locator('#reply-input').fill('');
  await page.waitForTimeout(200);
  await page.locator('.emoji-toggle').click();
  await page.locator('.emoji-picker').waitFor();
  await page.waitForTimeout(400);
  const picker = await page.evaluate(() => {
    const el = document.querySelector('.emoji-picker'), pane = document.querySelector('.content-scroll');
    const b = el.getBoundingClientRect(), p = pane.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, paneTop: p.top, paneBottom: p.bottom, paneLeft: p.left, paneRight: p.right };
  });
  if (picker.bottom > picker.paneBottom + 1) throw new Error(`emoji picker clipped below: ${JSON.stringify(picker)}`);
  if (picker.top < picker.paneTop - 1) throw new Error(`emoji picker clipped above: ${JSON.stringify(picker)}`);
  if (picker.right > picker.paneRight + 1 || picker.left < picker.paneLeft - 1) throw new Error(`emoji picker clipped horizontally: ${JSON.stringify(picker)}`);
  await page.getByRole('button', { name: '插入 惊讶 表情' }).click({ timeout: 5000 });
  if (!(await page.locator('#reply-input').inputValue()).includes('[cube_惊讶]')) throw new Error('emoji button did not insert its token');
  await page.locator('.emoji-toggle').click();
  await page.waitForTimeout(200);
  const afterEmoji = await snapshot();
  if (!afterEmoji.formFlushToBottom) throw new Error('emoji panel broke the bottom stickiness');
  await page.locator('#reply-input').fill('');

  // ---------------------------------------------------------------------------
  // (g) while docked, replying to another comment only updates the badge
  // ---------------------------------------------------------------------------
  const scrollTopBeforeSecondReply = (await snapshot()).scrollTop;
  // Pick a comment that is already fully inside the viewport, otherwise Playwright's
  // scroll-into-view (not the app) would change scrollTop and invalidate the assertion.
  const target = await page.evaluate(() => {
    const scroll = document.querySelector('.content-scroll');
    const b = scroll.getBoundingClientRect();
    for (const c of document.querySelectorAll('.comment')) {
      const r = c.getBoundingClientRect();
      if (r.top >= b.top + 2 && r.bottom <= b.bottom - 2) {
        const text = c.querySelector('p')?.textContent;
        const author = c.querySelector('.comment-author button')?.textContent;
        if (text && author) return { text, author };
      }
    }
    return null;
  });
  if (!target) throw new Error('no fully visible comment to reply to');
  await replyButtonOf(target.text).click();
  await page.waitForTimeout(400);
  const secondReply = await snapshot();
  if (!secondReply.docked) throw new Error('composer undocked after a second reply');
  if (secondReply.replyTarget !== `回复@${target.author}`) throw new Error(`badge did not update: ${JSON.stringify(secondReply.replyTarget)} expected 回复@${target.author}`);
  if (secondReply.scrollTop !== scrollTopBeforeSecondReply) throw new Error(`a second reply scrolled the page: ${scrollTopBeforeSecondReply} -> ${secondReply.scrollTop}`);
  if (!secondReply.formFlushToBottom) throw new Error('a second reply broke the bottom stickiness');

  // ---------------------------------------------------------------------------
  // (d) collapse button
  // ---------------------------------------------------------------------------
  // Re-arm with an identifiable trigger element (the post comment button has an
  // aria-label; a comment's 回复 button only has text) so the focus hand-back is checkable.
  await postButton().click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.locator('#reply-input').fill('收起后应保留的草稿');
  await page.locator('.composer-collapse').click({ timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector('.reply-form')?.classList.contains('is-docked'), null, { timeout: 5000 });
  const collapsed = await snapshot();
  if (collapsed.docked) throw new Error('collapse button did not undock the composer');
  if (collapsed.collapseButton) throw new Error('collapse button still rendered after undocking');
  if (collapsed.inputValue !== '收起后应保留的草稿') throw new Error(`collapse cleared the draft: ${JSON.stringify(collapsed.inputValue)}`);
  if (collapsed.active !== '回复 评论框帖子') throw new Error(`focus did not return to the trigger element: ${JSON.stringify(collapsed.active)}`);
  if (collapsed.lift !== '0px') throw new Error(`lift did not return to 0 after undocking: ${collapsed.lift}`);
  if (collapsed.navBottom !== '46px' || collapsed.zoomBottom !== '10px') throw new Error(`floating controls did not return to base offsets: ${JSON.stringify({ nav: collapsed.navBottom, zoom: collapsed.zoomBottom })}`);
  await postButton().click({ timeout: 5000 });
  await waitDocked();

  // ---------------------------------------------------------------------------
  // (e) Esc semantics
  // ---------------------------------------------------------------------------
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.reply-form')?.classList.contains('is-docked'), null, { timeout: 5000 });
  const afterEsc = await snapshot();
  if (!afterEsc.inDetail) throw new Error('Esc while docked navigated back to the list');
  await postButton().click({ timeout: 5000 });
  await waitDocked();
  await page.locator('.zoom-control').click();
  await page.locator('[role="dialog"]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
  const afterOverlayEsc = await snapshot();
  if (!afterOverlayEsc.docked) throw new Error('Esc with an overlay open undocked the composer');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.reply-form')?.classList.contains('is-docked'), null, { timeout: 5000 });
  await page.keyboard.press('Escape');
  await page.locator('.post-list').waitFor({ timeout: 5000 });

  // ---------------------------------------------------------------------------
  // (b) few comments: already fully visible, so only focus
  // ---------------------------------------------------------------------------
  await load({ open: 1 });
  const fewBefore = await snapshot();
  const fewScrollTop = fewBefore.scrollTop;
  await page.getByRole('button', { name: '回复 短帖子' }).click({ timeout: 5000 });
  await page.waitForFunction(() => document.activeElement?.id === 'reply-input', null, { timeout: 5000 });
  const fewAfter = await snapshot();
  if (fewAfter.docked) throw new Error(`composer docked although it was already visible: ${JSON.stringify({ form: fewAfter.form, scroll: fewAfter.scroll })}`);
  if (fewAfter.position === 'sticky') throw new Error('already-visible composer changed position');
  if (fewAfter.scrollTop !== fewScrollTop) throw new Error('already-visible path scrolled the page');
  if (fewAfter.replyTarget) throw new Error('post comment button left a reply target');
  await replyButtonOf('唯一的评论').click();
  await page.waitForTimeout(300);
  const fewReply = await snapshot();
  if (fewReply.docked) throw new Error('comment reply docked an already-visible composer');
  if (fewReply.replyTarget !== '回复@独苗') throw new Error(`badge missing in the visible path: ${JSON.stringify(fewReply.replyTarget)}`);
  if (fewReply.active !== 'reply-input') throw new Error('comment reply did not focus the composer');
  const fewLift = fewReply.lift;

  // ---------------------------------------------------------------------------
  // (c) send success undocks; send failure stays docked
  // ---------------------------------------------------------------------------
  await load({ open: 0 });
  await postButton().click({ timeout: 5000 });
  await waitDocked();
  await page.locator('#reply-input').fill('发送后应取消悬浮');
  slowComment = true;
  await submit().click({ timeout: 5000 });
  await page.locator('.toast').waitFor({ timeout: 5000 });
  const sentToast = await page.locator('.toast').innerText();
  if (!sentToast.includes('评论已发送')) throw new Error(`send toast wrong: ${JSON.stringify(sentToast)}`);
  slowComment = false;
  await page.waitForFunction(() => !document.querySelector('.reply-form')?.classList.contains('is-docked'), null, { timeout: 5000 });
  const afterSend = await snapshot();
  if (afterSend.position === 'sticky') throw new Error('composer stayed sticky after a successful send');
  if (afterSend.inputValue !== '') throw new Error(`draft was not cleared after a successful send: ${JSON.stringify(afterSend.inputValue)}`);
  if (afterSend.replyTarget) throw new Error('reply target survived a successful send');
  const pagesBeforeResume = detailCalls.filter(c => c.page > 1).length;
  await scrollTo('bottom');
  await page.waitForFunction(() => document.querySelectorAll('.comment').length > 21, null, { timeout: 8000 });
  if (detailCalls.filter(c => c.page > 1).length <= pagesBeforeResume) throw new Error('pagination did not resume after a successful send');
  await load({ open: 0 });
  await postButton().click({ timeout: 5000 });
  await waitDocked();
  await page.locator('#reply-input').fill('这次发送会失败');
  failComment = true;
  await submit().click({ timeout: 5000 });
  await page.locator('.toast').waitFor({ timeout: 5000 });
  if (!(await page.locator('.toast').innerText()).includes('模拟发送失败')) throw new Error('failure toast missing');
  await page.waitForFunction(() => document.activeElement?.id === 'reply-input', null, { timeout: 5000 });
  const failureSamples = [];
  for (let second = 1; second <= 3; second += 1) {
    await page.waitForTimeout(1000);
    const s = await snapshot();
    failureSamples.push({ t: `${second}s`, docked: s.docked, flush: s.formFlushToBottom, input: s.inputValue, active: s.active });
  }
  if (failureSamples.some(s => !s.docked)) throw new Error(`failed send undocked the composer: ${JSON.stringify(failureSamples)}`);
  if (failureSamples.some(s => s.input !== '这次发送会失败')) throw new Error(`failed send lost the draft: ${JSON.stringify(failureSamples)}`);
  if (failureSamples.some(s => s.active !== 'reply-input')) throw new Error(`failed send lost focus: ${JSON.stringify(failureSamples)}`);
  failComment = false;

  // ---------------------------------------------------------------------------
  // (h) permanent guards
  // ---------------------------------------------------------------------------
  await load({ open: 0 });
  await postButton().click({ timeout: 5000 });
  await waitDocked();
  const centres = await page.evaluate(() => {
    const scroll = document.querySelector('.content-scroll');
    const bounds = scroll.getBoundingClientRect();
    const rows = [];
    for (const comment of document.querySelectorAll('.comment')) {
      const button = comment.querySelector('.comment-like');
      if (!button) continue;
      const r = button.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0 && r.bottom > bounds.top && r.top < bounds.bottom)) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      rows.push({ text: comment.querySelector('p')?.textContent ?? '', self: !!hit && (hit === button || button.contains(hit)), zoom: !!hit && !!hit.closest('.zoom-control'), nav: !!hit && !!hit.closest('.detail-navigation'), hit: hit ? `${hit.tagName}.${String(hit.className || '')}` : null });
    }
    return rows;
  });
  if (!centres.length) throw new Error('no visible like button to hit-test');
  if (centres.some(r => r.zoom)) throw new Error(`like centres covered by .zoom-control: ${JSON.stringify(centres.filter(r => r.zoom))}`);
  if (centres.some(r => r.nav)) throw new Error(`like centres covered by .detail-navigation: ${JSON.stringify(centres.filter(r => r.nav))}`);
  const pagesBeforeIdle = detailCalls.filter(c => c.page > 1).length;
  await page.waitForTimeout(2000);
  if (detailCalls.filter(c => c.page > 1).length !== pagesBeforeIdle) throw new Error('pagination ran while the composer was docked and focused');

  const overflow = [];
  for (const config of [{ windowWidth: 360 }, { windowWidth: 720 }, { windowWidth: 720, zoom: 50 }]) {
    await load({ ...config, open: 0 });
    await postButton().click({ timeout: 5000 });
    await waitDocked();
    const s = await snapshot();
    if (s.scrollOverflow > 1) throw new Error(`horizontal overflow at ${JSON.stringify(config)}: ${s.scrollOverflow}px`);
    if (s.detailOverflow > 1) throw new Error(`.post-detail overflow at ${JSON.stringify(config)}: ${s.detailOverflow}px`);
    overflow.push({ ...config, scrollOverflow: s.scrollOverflow, docked: s.docked, flush: s.formFlushToBottom });
  }

  await load({ open: 0 });
  await postButton().click({ timeout: 5000 });
  await waitDocked();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.locator('.post-list').waitFor();
  const afterBack = await snapshot();
  if (afterBack.docked) throw new Error('composer stayed docked after returning to the list');
  await page.locator('.post-card').nth(2).locator('.post-content').click();
  await page.getByText('评论内容 0', { exact: true }).waitFor();
  await page.waitForTimeout(250);
  const onPostB = await snapshot();
  if (onPostB.docked) throw new Error('dock state leaked into another post');
  if (onPostB.lift !== '0px') throw new Error(`lift leaked into another post: ${onPostB.lift}`);

  await page.screenshot({ path: 'output/playwright/comment-composer.png' });
  if (unexpected.length) throw new Error(`Unexpected commands: ${unexpected.join(',')}`);
  if (errors.length) throw new Error(errors.join(';'));
  return {
    docksOnRequestWithoutScrolling: true,
    staysDockedAcrossIdleTypingEmojiAndScroll: true,
    dockedGeometryWithinLimits: true,
    longTextCappedAndScrollable: true,
    secondReplyOnlyUpdatesBadge: true,
    collapseUndocksKeepsDraftAndRefocusesTrigger: true,
    liftAndControlsRestoredOnUndock: true,
    escUndocksWithoutNavigatingBack: true,
    escClosesOverlayFirstAndStaysDocked: true,
    escStillNavigatesBackWhenUndocked: true,
    alreadyVisibleOnlyFocuses: true,
    sendSuccessUndocksAndResumes: true,
    sendFailureStaysDockedWithDraft: true,
    likeCentresClearOfFloatingLayers: true,
    noPaginationWhileDockedAndFocused: true,
    noHorizontalOverflow: true,
    dockResetOnPostSwitch: true,
    dockSamples,
    failureSamples,
    fewCommentLift: fewLift,
    overflow,
    likeCentreDiagnostics: centres,
  };
}
