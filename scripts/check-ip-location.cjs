async (page) => {
  // Fully mocked end-to-end check for IP-location display on the detail page.
  // No real network: every /api/command call is fulfilled by Playwright.
  const ORIGIN = 'http://127.0.0.1:5173';
  const IP_POST = '福建', IP_MAIN = '江苏', IP_PREVIEW = '广东', IP_PAGED = '浙江';

  const preferences = { theme: 'light', zoom: 100, exit: 'close', shortcuts: true, animations: false, showSidebar: false };
  const states = { 'heybox.preferences': preferences, 'heybox.community-filter': { mode: 'all', included: [], excluded: [], unknown: true }, 'heybox.bookmarks': [], 'heybox.history': [] };

  const mkPost = (id, title, ipLocation, kind) => ({ id, userId: '12345', author: '测试作者', avatar: '测', avatarUrl: '', color: '#ddd', time: '刚刚', title, excerpt: '摘要', body: ['测试正文'], topicIds: [], topics: [], likes: 0, comments: 4, images: [], kind, level: 21, medalUrl: '', medalName: '', liked: false, createdAt: 0, videoUrl: '', isCy: false, ipLocation });
  const mkComment = (id, author, text, ipLocation, extra = {}) => ({ id, userId: String(id), author, avatar: author.slice(0, 1), avatarUrl: '', text, images: [], likes: 0, time: '刚刚', rootId: id, level: 12, medalUrl: '', medalName: '', pinned: false, isAuthor: false, createdAt: 0, replyTo: '', replyCount: 0, hasMoreReplies: false, replies: [], ipLocation, ...extra });

  const postWithIp = mkPost(1, '属地测试帖子', IP_POST, '讨论');
  const postNoIp = mkPost(2, '属地缺失帖子', '', undefined); // kind undefined => card shows no meta dot

  const previewIp = mkComment(301, '预览回复者', '预览子回复有属地', IP_PREVIEW, { replyTo: '主评论有属地' });
  const pagedIp = mkComment(302, '分页回复者', '分页子回复有属地', IP_PAGED, { replyTo: '主评论有属地' });
  const subNoIp = mkComment(401, '子回复无属地者', '子回复无属地', '', { replyTo: '主评论无属地' });
  // Raw whitespace on a SUB reply: exercises the render guard at CommentThread.tsx:75.
  const subRawBlankIp = mkComment(402, '子回复原始空白属地者', '子回复原始空白属地', ' ', { replyTo: '主评论无属地' });
  const rootIp = mkComment(300, '有属地主评论者', '主评论有属地', IP_MAIN, { replyCount: 3, hasMoreReplies: true, replies: [previewIp] });
  const rootNoIp = mkComment(400, '无属地主评论者', '主评论无属地', '', { replyCount: 2, replies: [subNoIp, subRawBlankIp] });
  const rootMissingIp = mkComment(500, '缺字段主评论者', '主评论缺字段', undefined);
  delete rootMissingIp.ipLocation; // key absent, not empty string
  // Raw whitespace handed straight to the UI: unreachable end-to-end because model.rs
  // trims, but the frontend guards are now `?.trim() &&` too, so the render layer must
  // also render nothing. Asserted (render-layer hardening), not merely diagnosed.
  const rootRawBlankIp = mkComment(600, '原始空白属地主评论者', '主评论原始空白属地', ' ');
  // What the backend now actually delivers for whitespace-only upstream input.
  const rootTrimmedBlankIp = mkComment(800, '修剪后空白属地主评论者', '主评论修剪后空白属地', '');
  // Longest value observed in the real upstream samples (raw-detail-193651081-p2.json),
  // so the zoom/overflow assertions are exercised with worst-case real data.
  const IP_LONG = '巴布亚新几内亚';
  const rootLongIp = mkComment(700, '长属地主评论者', '主评论最长属地', IP_LONG);

  let unexpected = [];
  const subRequests = [];

  await page.addInitScript(saved => { for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, JSON.stringify(value)); }, states);
  await page.route('**/api/command', async route => {
    const request = route.request().postDataJSON();
    let data;
    switch (request.type) {
      case 'bootstrap': data = { account: { id: '12345', name: '测试账号', avatarUrl: '' }, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[request.payload.key] ?? null; break;
      case 'stateSet': states[request.payload.key] = request.payload.value; data = true; break;
      case 'communities': data = []; break;
      case 'emojis': data = { version: 'synthetic', emojis: [] }; break;
      case 'feed': data = { posts: [postWithIp, postNoIp], cursor: { offset: 30, topics: {}, exhausted: [], rotation: 0 }, hasMore: false }; break;
      case 'detail':
        data = request.payload.id === 2
          ? { post: postNoIp, comments: [], page: 1, hasMore: false, isCy: false }
          : { post: postWithIp, comments: [rootIp, rootNoIp, rootMissingIp, rootRawBlankIp, rootTrimmedBlankIp, rootLongIp], page: 1, hasMore: false, isCy: false };
        break;
      case 'subComments':
        subRequests.push(request.payload);
        if (request.payload.root !== 300) throw new Error(`Wrong root requested: ${request.payload.root}`);
        data = { comments: [pagedIp], lastval: '302', hasMore: false };
        break;
      default: unexpected.push(request.type); data = null;
    }
    await route.fulfill({ json: { ok: true, data } });
  });

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  const commentOf = text => page.locator('.comment').filter({ hasText: text });
  const subOf = text => page.locator('.sub-comment').filter({ hasText: text });
  const ownSmall = scope => scope.locator('.comment-content > small');
  const openPost = async title => {
    await page.getByRole('heading', { name: title, exact: true }).click();
    await page.locator('.detail-author').waitFor();
  };
  const back = async () => {
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.locator('.post-list').waitFor();
  };
  const setZoom = async zoom => {
    await page.getByRole('button', { name: '调整窗口缩放', exact: true }).click();
    await page.getByRole('slider', { name: '窗口缩放', exact: true }).fill(String(zoom));
    await page.getByRole('button', { name: '关闭弹窗' }).click();
    await page.waitForFunction(value => document.querySelector('.zoom-control')?.textContent.includes(`${value}%`), zoom);
    await page.waitForTimeout(250);
  };

  await page.goto(`${ORIGIN}/`);
  await page.locator('.post-list').waitFor();

  // (f) the feed list must NOT show IP (scope of this change is the detail page only).
  if (await page.locator('.post-card .ip-location').count() !== 0) throw new Error('Feed post cards rendered an .ip-location');
  if (await page.locator('.post-card').count() !== 2) throw new Error('Expected two mocked feed cards');
  const cardSmall = await page.locator('.post-card .post-author small').first().innerText();
  if (cardSmall !== '刚刚·讨论') throw new Error(`Feed card meta line changed unexpectedly: ${JSON.stringify(cardSmall)}`);

  // (e) a post without an IP renders no IP and no stray separator.
  await openPost('属地缺失帖子');
  if (await page.locator('.detail-author .ip-location').count() !== 0) throw new Error('Post without ipLocation still rendered .ip-location');
  if (await page.locator('.detail-author small .meta-dot').count() !== 0) throw new Error('Post without ipLocation rendered a stray separator dot');
  const noIpAuthor = await page.locator('.detail-author small').innerText();
  if (noIpAuthor !== '刚刚') throw new Error(`Post without ipLocation author line wrong: ${JSON.stringify(noIpAuthor)}`);
  await back();

  // (a) detail author line: time, dot, IP in that order.
  await openPost('属地测试帖子');
  const authorSmall = page.locator('.detail-author small');
  if (await authorSmall.locator('.ip-location').innerText() !== IP_POST) throw new Error(`Detail author IP wrong: ${await authorSmall.locator('.ip-location').innerText()}`);
  if (await authorSmall.innerText() !== `刚刚·${IP_POST}`) throw new Error(`Detail author line wrong: ${JSON.stringify(await authorSmall.innerText())}`);
  if (await authorSmall.locator('.ip-location').evaluate(el => el.previousElementSibling?.className) !== 'meta-dot') throw new Error('Detail author IP is not preceded by the separator dot');
  if (await authorSmall.locator('.meta-dot').count() !== 1) throw new Error('Detail author line has an unexpected number of separator dots');

  // (b) main comment with IP: order is time, dot, IP, then the reply button.
  const mainWithIp = commentOf('主评论有属地');
  const mainSmall = ownSmall(mainWithIp);
  if (await mainSmall.locator('.ip-location').innerText() !== IP_MAIN) throw new Error(`Main comment IP wrong: ${await mainSmall.locator('.ip-location').innerText()}`);
  if (await mainSmall.innerText() !== `刚刚·${IP_MAIN}回复`) throw new Error(`Main comment meta line wrong: ${JSON.stringify(await mainSmall.innerText())}`);
  if (await mainSmall.locator('.ip-location').evaluate(el => el.previousElementSibling?.className) !== 'meta-dot') throw new Error('Main comment IP is not preceded by the separator dot');
  if (await mainSmall.locator('.meta-dot').count() !== 1) throw new Error('Main comment line has an unexpected number of separator dots');

  // (c) reply preview carries its own IP.
  const previewSub = subOf('预览子回复有属地');
  if (await previewSub.locator('small .ip-location').innerText() !== IP_PREVIEW) throw new Error(`Reply preview IP wrong: ${await previewSub.locator('small .ip-location').innerText()}`);
  if (await previewSub.locator('small .meta-dot').count() !== 1) throw new Error('Reply preview line has an unexpected number of separator dots');

  // (g) the reply button still targets the right comment.
  await mainSmall.getByRole('button', { name: '回复', exact: true }).click();
  await page.locator('.reply-target').waitFor();
  if (await page.locator('.reply-target').innerText() !== '回复 @有属地主评论者') throw new Error(`Reply target wrong: ${JSON.stringify(await page.locator('.reply-target').innerText())}`);
  await page.locator('.reply-target button').click();
  await page.locator('.reply-target').waitFor({ state: 'detached' });

  // (c+g) paginated replies keep their IP, and the merge does not drop the preview's.
  await mainWithIp.getByRole('button', { name: '全部 3 条回复' }).click();
  await mainWithIp.getByText('分页子回复有属地', { exact: true }).waitFor();
  if (subRequests.length !== 1 || subRequests[0].root !== 300 || subRequests[0].lastval !== '301') throw new Error(`Unexpected subComments request: ${JSON.stringify(subRequests)}`);
  const pagedSub = subOf('分页子回复有属地');
  if (await pagedSub.locator('small .ip-location').innerText() !== IP_PAGED) throw new Error(`Paginated reply IP wrong: ${await pagedSub.locator('small .ip-location').innerText()}`);
  if (await previewSub.locator('small .ip-location').innerText() !== IP_PREVIEW) throw new Error('Preview IP was lost after merging paginated replies');

  // (d) empty and missing ipLocation must leave no element and no stray dot.
  for (const label of ['无属地主评论者', '缺字段主评论者']) {
    const scope = commentOf(label === '无属地主评论者' ? '主评论无属地' : '主评论缺字段');
    if (await ownSmall(scope).locator('.ip-location').count() !== 0) throw new Error(`${label}: rendered .ip-location for an empty/missing value`);
    if (await ownSmall(scope).locator('.meta-dot').count() !== 0) throw new Error(`${label}: rendered a stray separator dot`);
    const text = await ownSmall(scope).innerText();
    if (text !== '刚刚回复') throw new Error(`${label}: meta line should be exactly 刚刚回复, got ${JSON.stringify(text)}`);
  }
  const subWithoutIp = subOf('子回复无属地');
  if (await subWithoutIp.locator('small .ip-location').count() !== 0) throw new Error('Sub reply with empty ipLocation rendered .ip-location');
  if (await subWithoutIp.locator('small .meta-dot').count() !== 0) throw new Error('Sub reply with empty ipLocation rendered a stray separator dot');
  const subText = await subWithoutIp.locator('small').innerText();
  if (!subText.startsWith('刚刚回复')) throw new Error(`Sub reply meta line wrong: ${JSON.stringify(subText)}`);

  // The longest value observed in the real upstream samples must render verbatim.
  const longComment = commentOf('主评论最长属地');
  if (await ownSmall(longComment).locator('.ip-location').innerText() !== IP_LONG) throw new Error(`Long IP value wrong: ${await ownSmall(longComment).locator('.ip-location').innerText()}`);

  // Upstream whitespace-only input arrives as "" once the backend has trimmed it, so the
  // UI must render exactly 刚刚回复 with no span and no stray dot. This is the hard
  // regression guard for the whitespace case; the trim itself is guarded by the Rust
  // unit test `post_and_comment_ip_location_are_kept` (a mock cannot see the backend).
  const trimmedBlank = commentOf('主评论修剪后空白属地');
  if (await ownSmall(trimmedBlank).locator('.ip-location').count() !== 0) throw new Error('Trimmed whitespace value still rendered .ip-location');
  if (await ownSmall(trimmedBlank).locator('.meta-dot').count() !== 0) throw new Error('Trimmed whitespace value still rendered a stray separator dot');
  const trimmedBlankText = await ownSmall(trimmedBlank).innerText();
  if (trimmedBlankText !== '刚刚回复') throw new Error(`Trimmed whitespace meta line should be exactly 刚刚回复, got ${JSON.stringify(trimmedBlankText)}`);

  // Render-layer hardening: the frontend guards are now `?.trim() &&`, so a raw
  // whitespace value handed straight to the UI (bypassing the backend trim) must render
  // nothing either. This input is still unreachable end-to-end, so this assertion covers
  // the RENDER LAYER only; the backend trim is guarded by the Rust unit test.
  const rawBlank = commentOf('主评论原始空白属地');
  const rawSpans = await ownSmall(rawBlank).locator('.ip-location').count();
  const rawDots = await ownSmall(rawBlank).locator('.meta-dot').count();
  const rawText = await ownSmall(rawBlank).innerText();
  if (rawSpans !== 0 || rawDots !== 0) throw new Error(`MAIN comment render guard not trimmed: spans=${rawSpans} dots=${rawDots} line=${JSON.stringify(rawText)}`);
  if (rawText !== '刚刚回复') throw new Error(`Raw whitespace main-comment meta line should be exactly 刚刚回复, got ${JSON.stringify(rawText)}`);

  // Same input on a SUB reply, which uses a separate guard (CommentThread.tsx:75).
  const rawBlankSub = subOf('子回复原始空白属地');
  const rawSubSpans = await rawBlankSub.locator('small .ip-location').count();
  const rawSubDots = await rawBlankSub.locator('small .meta-dot').count();
  const rawSubText = await rawBlankSub.locator('small').innerText();
  if (rawSubSpans !== 0 || rawSubDots !== 0) throw new Error(`SUB reply render guard not trimmed: spans=${rawSubSpans} dots=${rawSubDots} line=${JSON.stringify(rawSubText)} (CommentThread.tsx:75 still uses c.ipLocation &&)`);

  const diagnostics = {
    rawWhitespaceValue: ' ',
    rawWhitespaceRenderedSpans: rawSpans,
    rawWhitespaceRenderedDots: rawDots,
    rawWhitespaceLineText: JSON.stringify(rawText),
    rawWhitespaceSubRenderedSpans: rawSubSpans,
    rawWhitespaceSubRenderedDots: rawSubDots,
    rawWhitespaceSubLineText: JSON.stringify(rawSubText),
    trimmedWhitespaceRenderedSpans: await ownSmall(trimmedBlank).locator('.ip-location').count(),
    trimmedWhitespaceRenderedDots: await ownSmall(trimmedBlank).locator('.meta-dot').count(),
    trimmedWhitespaceLineText: JSON.stringify(trimmedBlankText),
  };

  // Adversarial: the meta line must not overflow at the extreme zoom levels.
  const zoomOverflow = [];
  for (const zoom of [50, 300, 100]) {
    await setZoom(zoom);
    const measured = await page.evaluate(() => {
      const frame = document.querySelector('.window-inner')?.getBoundingClientRect();
      return [...document.querySelectorAll('.ip-location')].map(el => {
        const rect = el.getBoundingClientRect();
        const small = el.closest('small')?.getBoundingClientRect();
        return {
          text: el.textContent,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          beyondSmall: small ? Math.round(Math.max(0, rect.right - small.right, small.left - rect.left)) : null,
          beyondFrame: frame ? Math.round(Math.max(0, rect.right - frame.right, frame.left - rect.left)) : null,
        };
      });
    });
    zoomOverflow.push({ zoom, count: measured.length, worstBeyondSmall: Math.max(...measured.map(m => m.beyondSmall ?? 0)), worstBeyondFrame: Math.max(...measured.map(m => m.beyondFrame ?? 0)), collapsed: measured.filter(m => m.width < 1 || m.height < 1).length });
    if (!measured.length) throw new Error(`No .ip-location rendered at ${zoom}% zoom`);
    if (measured.some(m => m.width < 1 || m.height < 1)) throw new Error(`An .ip-location collapsed at ${zoom}% zoom: ${JSON.stringify(measured)}`);
    if (measured.some(m => (m.beyondSmall ?? 0) > 1)) throw new Error(`An .ip-location overflowed its line at ${zoom}% zoom: ${JSON.stringify(measured)}`);
    if (measured.some(m => (m.beyondFrame ?? 0) > 1)) throw new Error(`An .ip-location overflowed the app frame at ${zoom}% zoom: ${JSON.stringify(measured)}`);
  }
  if (await authorSmall.locator('.ip-location').innerText() !== IP_POST) throw new Error('Detail author IP changed after the zoom cycle');

  // (h) evidence screenshot (post 1, IPs visible), then a strict drift check.
  await page.screenshot({ path: 'output/playwright/ip-location.png' });
  if (unexpected.length) throw new Error(`Unexpected commands: ${unexpected.join(',')}`);
  if (errors.length) throw new Error(errors.join(';'));
  return {
    detailAuthorIpOrder: true,
    mainCommentIpOrder: true,
    replyPreviewIp: true,
    paginatedReplyIp: true,
    mergeKeptIp: true,
    emptyIpNoStrayDot: true,
    missingIpNoStrayDot: true,
    subReplyEmptyIpNoStrayDot: true,
    blankAfterTrimNoStrayDot: true,
    rawWhitespaceNoStrayDot: true,
    postWithoutIpNoStrayDot: true,
    feedCardsHaveNoIp: true,
    replyTargetStillWorks: true,
    noOverflowAt50And300Zoom: true,
    noUnexpectedCommands: true,
    diagnostics,
    zoomOverflow,
  };
}
