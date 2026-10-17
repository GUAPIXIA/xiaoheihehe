async (page) => {
  // Fully mocked end-to-end check for comment images. No real network: every
  // /api/command call and every probe image is fulfilled by Playwright.
  const ORIGIN = 'http://127.0.0.1:5173';
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#3b82f6"/></svg>';
  const A = `${ORIGIN}/probe-a.jpg`, B = `${ORIGIN}/probe-b.jpg`, C = `${ORIGIN}/probe-c.jpg`, D = `${ORIGIN}/probe-d.jpg`;
  const BROKEN = `${ORIGIN}/probe-broken.jpg`, EMOJI = `${ORIGIN}/probe-emoji.png`;
  const POST_A = `${ORIGIN}/probe-post-a.jpg`, POST_B = `${ORIGIN}/probe-post-b.jpg`;
  const EMOJI_TOKEN = '[cube_惊讶]';

  const preferences = { theme: 'light', zoom: 100, exit: 'close', shortcuts: true, animations: false, showSidebar: false };
  const states = { 'heybox.preferences': preferences, 'heybox.community-filter': { mode: 'all', included: [], excluded: [], unknown: true }, 'heybox.bookmarks': [], 'heybox.history': [] };
  const emojiCatalog = { version: 'synthetic', emojis: [{ token: EMOJI_TOKEN, name: '惊讶', url: EMOJI, group: 'cube', groupName: 'CUBE表情' }] };

  const post = { id: 1, userId: '12345', author: '测试作者', avatar: '测', avatarUrl: '', color: '#ddd', time: '刚刚', title: '评论图片测试', excerpt: '评论图片端到端', body: ['测试正文'], topicIds: [], topics: [], likes: 0, comments: 3, images: [POST_A, POST_B], kind: '图文', level: 21, medalUrl: '', medalName: '', liked: false, createdAt: 0, videoUrl: '', isCy: false };
  const mk = (id, author, text, images, extra = {}) => ({ id, userId: String(id), author, avatar: author.slice(0, 1), avatarUrl: '', text, images, likes: 3, time: '刚刚', rootId: id, level: 12, medalUrl: '', medalName: '', pinned: false, isAuthor: false, createdAt: 0, replyTo: '', replyCount: 0, hasMoreReplies: false, replies: [], ...extra });

  const previewSub = mk(301, '预览回复者', '预览子回复带图', [C]);
  const pageSub = mk(302, '分页回复者', '分页子回复带图', [D]);
  const rootWithImages = mk(300, '图主', `带图主评论 ${EMOJI_TOKEN}`, [A, B], { replyCount: 3, hasMoreReplies: true, replies: [previewSub] });
  const rootWithoutImages = mk(400, '无图者', '无图主评论', []);
  const rootBroken = mk(500, '坏图者', '坏图主评论', [BROKEN]);

  let brokenFixed = false;
  const unexpected = [];
  const subRequests = [];

  await page.addInitScript(saved => { for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, JSON.stringify(value)); }, states);
  await page.route('**/probe-*', route => {
    const url = route.request().url();
    if (url.includes('probe-broken') && !brokenFixed) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' });
    return route.fulfill({ status: 200, contentType: url.endsWith('.png') ? 'image/svg+xml' : 'image/svg+xml', body: SVG });
  });
  await page.route('**/api/command', async route => {
    const request = route.request().postDataJSON();
    let data;
    switch (request.type) {
      case 'bootstrap': data = { account: { id: '12345', name: '测试账号', avatarUrl: '' }, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[request.payload.key] ?? null; break;
      case 'stateSet': states[request.payload.key] = request.payload.value; data = true; break;
      case 'communities': data = []; break;
      case 'emojis': data = emojiCatalog; break;
      case 'feed': data = { posts: [post], cursor: { offset: 30, topics: {}, exhausted: [], rotation: 0 }, hasMore: false }; break;
      case 'detail': data = { post, comments: [rootWithImages, rootWithoutImages, rootBroken], page: 1, hasMore: false, isCy: false }; break;
      case 'subComments': {
        subRequests.push(request.payload);
        if (request.payload.root !== 300) throw new Error(`Wrong root requested: ${request.payload.root}`);
        data = { comments: [pageSub], lastval: '302', hasMore: false };
        break;
      }
      default: unexpected.push(request.type); data = null;
    }
    await route.fulfill({ json: { ok: true, data } });
  });

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  const commentOf = text => page.locator('.comment').filter({ hasText: text });
  const subCommentOf = text => page.locator('.sub-comment').filter({ hasText: text });
  const postGalleryCount = () => page.locator('.image-gallery:not(.image-gallery-expanded) .gallery-count');
  const viewerCount = () => page.locator('[role="dialog"] .gallery-count');
  const loaded = async locator => locator.evaluateAll(nodes => nodes.every(node => node.naturalWidth > 0));

  await page.goto(`${ORIGIN}/`);
  await page.locator('.post-content').click();
  await page.getByText('带图主评论', { exact: false }).first().waitFor();

  // (a) main comment with images renders a container with both correctly-sourced images.
  // Scoped with `>` because a root `.comment` also contains its nested `.sub-comment`,
  // whose own `.comment-images` would otherwise be counted a second time.
  const withImages = commentOf('带图主评论');
  const ownImages = withImages.locator('.comment-content > .comment-images');
  await withImages.scrollIntoViewIfNeeded();
  if (await ownImages.count() !== 1) throw new Error(`Main comment with two images did not render exactly one own .comment-images container (found ${await ownImages.count()})`);
  if (await ownImages.locator('img').count() !== 2) throw new Error('Main comment did not render exactly two images');
  if (await ownImages.evaluate(node => node.classList.contains('comment-images-single'))) throw new Error('Two-image comment was styled as a single-image container');
  const mainSrcs = await ownImages.locator('img').evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
  if (mainSrcs.join() !== [A, B].join()) throw new Error(`Main comment image srcs wrong: ${JSON.stringify(mainSrcs)}`);
  await page.waitForFunction(src => [...document.querySelectorAll('.comment-images img')].some(node => node.getAttribute('src') === src && node.naturalWidth > 0), A);
  if (!await loaded(ownImages.locator('img'))) throw new Error('Main comment images did not actually load');

  // (f) a comment without images renders no container at all (no empty box / border).
  const withoutImages = commentOf('无图主评论');
  if (await withoutImages.locator('.comment-images').count() !== 0) throw new Error('Comment without images still rendered a .comment-images container');
  if (await withoutImages.locator('img').count() !== 0) throw new Error('Comment without images rendered an img element');

  // (g) comment text and official emoji rendering are unaffected.
  const emojiImgs = withImages.locator('.comment-content > p img.inline-emoji');
  if (await emojiImgs.count() !== 1) throw new Error('Official emoji inside comment text did not render as an image');
  if (await emojiImgs.first().getAttribute('alt') !== EMOJI_TOKEN) throw new Error(`Emoji img alt wrong: ${await emojiImgs.first().getAttribute('alt')}`);
  const commentText = await withImages.locator('.comment-content > p').first().innerText();
  if (commentText.includes(EMOJI_TOKEN)) throw new Error('Emoji token was left as raw text instead of being replaced');

  // (b1) reply preview carrying an image renders that image.
  if (await subCommentOf('预览子回复带图').locator('.comment-images img').count() !== 1) throw new Error('Reply preview image did not render');
  const previewSrc = await subCommentOf('预览子回复带图').locator('.comment-images img').first().getAttribute('src');
  if (previewSrc !== C) throw new Error(`Reply preview image src wrong: ${previewSrc}`);

  // (b2) paginated replies carrying an image keep it after the merge.
  await withImages.getByRole('button', { name: '全部 3 条回复' }).click();
  await withImages.getByText('分页子回复带图', { exact: true }).waitFor();
  if (subRequests.length !== 1 || subRequests[0].root !== 300 || subRequests[0].lastval !== '301') throw new Error(`Unexpected subComments request: ${JSON.stringify(subRequests)}`);
  const pagedSrc = await subCommentOf('分页子回复带图').locator('.comment-images img').first().getAttribute('src');
  if (pagedSrc !== D) throw new Error(`Paginated reply image src wrong: ${pagedSrc}`);
  if (await subCommentOf('预览子回复带图').locator('.comment-images img').count() !== 1) throw new Error('Preview image was lost after merging paginated replies');

  // (d, pre) move the post's own photo gallery to 2/2 so a later comment-image
  // viewer session can prove it does not drag the post gallery index along.
  if (await postGalleryCount().innerText() !== '1/2') throw new Error('Post gallery did not start at 1/2');
  await page.locator('.image-gallery:not(.image-gallery-expanded) .gallery-next').click();
  if (await postGalleryCount().innerText() !== '2/2') throw new Error('Post gallery did not advance to 2/2');

  // (c) clicking a thumbnail opens the expanded viewer with the right title, label and page.
  await withImages.getByRole('button', { name: '查看 图主 的评论图片 1' }).click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor();
  if (await page.locator('#modal-title').innerText() !== '图主 的评论图片') throw new Error(`Viewer title wrong: ${await page.locator('#modal-title').innerText()}`);
  const region = dialog.locator('.image-gallery-expanded[role="region"]');
  if (await region.count() !== 1) throw new Error('Expanded comment gallery region missing');
  if (await region.getAttribute('aria-label') !== '评论图片') throw new Error(`Comment viewer region label wrong: ${await region.getAttribute('aria-label')}`);
  if (await viewerCount().innerText() !== '1/2') throw new Error(`Viewer did not open on page 1/2: ${await viewerCount().innerText()}`);

  // (d) arrow keys switch comment images only, never the post gallery index.
  await page.keyboard.press('ArrowRight');
  if (await viewerCount().innerText() !== '2/2') throw new Error(`Viewer did not advance to 2/2: ${await viewerCount().innerText()}`);
  const viewerSrc = await dialog.locator('.gallery-image-surface img').getAttribute('src');
  if (viewerSrc !== B) throw new Error(`Viewer showed the wrong second image: ${viewerSrc}`);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  if (await postGalleryCount().innerText() !== '2/2') throw new Error('Viewing comment images changed the post gallery index');

  // (e) a failing comment image shows a fallback instead of a broken image, and retry recovers.
  const brokenComment = commentOf('坏图主评论');
  await brokenComment.scrollIntoViewIfNeeded();
  const brokenButton = brokenComment.locator('.comment-image.is-error');
  await brokenButton.waitFor();
  if (await brokenComment.locator('.comment-image-error').innerText() !== '加载失败') throw new Error('Failed comment image did not show the 加载失败 fallback');
  const hidden = await brokenButton.locator('img').evaluate(node => getComputedStyle(node).visibility);
  if (hidden !== 'hidden') throw new Error(`Failed comment image is still visible (visibility=${hidden})`);
  await brokenButton.click();
  const retry = dialog.locator('.gallery-error button', { hasText: '重试' });
  await retry.waitFor();
  if (!(await dialog.locator('.gallery-error').innerText()).includes('图片加载失败')) throw new Error('Viewer did not report the image load failure');
  brokenFixed = true;
  await retry.click();
  await dialog.locator('.gallery-error').waitFor({ state: 'detached' });
  await page.waitForFunction(src => [...document.querySelectorAll('.gallery-image-surface img')].some(node => node.getAttribute('src') === src && node.naturalWidth > 0), BROKEN);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });

  // (h) evidence screenshot, then a strict drift check on the mocked command surface.
  await page.screenshot({ path: 'output/playwright/comment-images.png' });
  if (unexpected.length) throw new Error(`Unexpected commands: ${unexpected.join(',')}`);
  if (errors.length) throw new Error(errors.join(';'));
  return { mainCommentImages: true, mainImagesLoaded: true, replyPreviewImage: true, paginatedReplyImage: true, mergeKeptImages: true, viewerTitleAndLabel: true, viewerPaging: true, postGalleryIndexUntouched: true, failureFallback: true, retryRecovers: true, noContainerWithoutImages: true, emojiUnaffected: true, noUnexpectedCommands: true };
}
