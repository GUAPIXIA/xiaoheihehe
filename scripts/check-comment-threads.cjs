async (page) => {
  const preferences = { theme: 'light', zoom: 100, exit: 'close', shortcuts: true, animations: false, showSidebar: false };
  const states = { 'heybox.preferences': preferences, 'heybox.community-filter': { mode: 'all', included: [], excluded: [], unknown: true }, 'heybox.bookmarks': [], 'heybox.history': [] };
  const post = { id: 1, userId: '12345', author: '测试作者', avatar: '测', avatarUrl: '', color: '#ddd', time: '刚刚', title: '评论楼层测试', excerpt: '置顶、等级和楼中楼', body: ['测试正文'], topicIds: [], topics: [], likes: 0, comments: 7, images: [], level: 21, medalUrl: '', medalName: '', liked: false, createdAt: 0, videoUrl: '', isCy: false };
  const reply = id => ({ id, rootId: 100, author: `回复者 ${id}`, avatar: '回', avatarUrl: '', text: `回复内容 ${id}`, likes: 1, time: '刚刚', level: 11, medalUrl: '', medalName: '', pinned: false, isAuthor: false, replyTo: '测试作者', replyCount: 0, hasMoreReplies: false, replies: [] });
  const root = { ...reply(100), author: '测试作者', text: '置顶主评论', level: 21, pinned: true, isAuthor: true, replyTo: '', replyCount: 6, hasMoreReplies: true, replies: [reply(101), reply(102)] };
  const other = {...reply(200), rootId: 200, author:'热门盒友', text:'热门主评论', replyTo:''};
  let failNext = true, submission;
  const cursors = [], errors = [];
  await page.addInitScript(saved => { for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, JSON.stringify(value)); }, states);
  await page.route('**/api/command', async route => {
    const request = route.request().postDataJSON(); let data;
    switch (request.type) {
      case 'bootstrap': data = { account: { id: '12345', name: '测试账号', avatarUrl: '' }, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[request.payload.key] ?? null; break;
      case 'stateSet': states[request.payload.key] = request.payload.value; data = true; break;
      case 'communities': data = []; break;
      case 'feed': data = { posts: [post], cursor: { offset: 30, topics: {}, exhausted: [], rotation: 0 }, hasMore: false }; break;
      case 'detail': data = {post, comments:[root, other], page:1, hasMore:false, isCy:false}; break;
      case 'emojis': data = {version:'synthetic',emojis:[]}; break;
      case 'subComments': {
        if (request.payload.root !== 100) throw new Error('Wrong root requested');
        cursors.push(request.payload.lastval);
        if (request.payload.lastval === '102') {
          data = {comments:[reply(102),reply(103),reply(104),reply(104)],lastval:'104',hasMore:true};
          await new Promise(resolve => setTimeout(resolve, 150));
        } else if (failNext) {
          failNext = false;
          await route.fulfill({json:{ok:false,error:{code:'network',message:'模拟回复加载失败'}}}); return;
        } else data = {comments:[reply(105),reply(106)],lastval:'106',hasMore:false};
        break;
      }
      case 'comment': submission = request.payload; data = true; break;
      default: throw new Error(`Unexpected command ${request.type}`);
    }
    await route.fulfill({json:{ok:true,data}});
  });
  await page.goto('http://127.0.0.1:5173/');
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('.post-content').click();
  await page.getByText('置顶主评论', {exact:true}).waitFor();
  const thread = page.locator('.comment').first();
  if (await page.locator('.comment-pin').count() !== 1) throw new Error('Incorrect pinned markers');
  if (await thread.locator('.comment-author').first().locator('.author-level').textContent() !== 'Lv.21') throw new Error('Root level missing');
  if (await thread.locator('.comment-author-tag').count() !== 1) throw new Error('Author badge missing');
  if (await thread.locator('.sub-comment').count() !== 2) throw new Error('Previews missing');
  if (await thread.locator('.sub-comment').first().locator('.author-level').textContent() !== 'Lv.11') throw new Error('Reply level missing');
  await thread.getByRole('button', {name:'全部 6 条回复'}).click();
  await thread.getByText('回复内容 104', {exact:true}).waitFor();
  if (await thread.locator('.sub-comment').count() !== 4) throw new Error('Replies not deduplicated');
  await thread.getByRole('button', {name:'收起回复'}).click();
  if (await thread.locator('.sub-comment').count() !== 2) throw new Error('Collapse failed');
  await thread.getByRole('button', {name:'全部 6 条回复'}).click();
  await thread.getByRole('alert').waitFor();
  if (await thread.locator('.sub-comment').count() !== 4) throw new Error('Error discarded replies');
  await thread.getByRole('button', {name:'重试',exact:true}).click();
  await thread.getByText('回复内容 106', {exact:true}).waitFor();
  if (cursors.join() !== '102,104,104') throw new Error('Reply cursor or retry incorrect');
  if (await thread.getByRole('button', {name:'加载更多回复',exact:true}).count()) throw new Error('Exhaustion ignored');
  await thread.locator('.sub-comment').last().getByRole('button', {name:'回复',exact:true}).click();
  await page.getByRole('textbox', {name:'评论内容'}).fill('模拟回复，不发送到真实社区');
  await page.getByRole('button', {name:'评论',exact:true}).click();
  await page.getByText('评论已发送', {exact:true}).waitFor();
  if (submission.root !== 100 || submission.reply !== 106) throw new Error('Reply/root association incorrect');
  await page.screenshot({path:'output/playwright/comment-threads.png'});
  await page.getByRole('button', {name:'返回',exact:true}).click();
  if (errors.length) throw new Error(errors.join(';'));
  return {pinned:true,levels:true,previews:true,pagination:true,deduplication:true,collapse:true,retryPreservesCursor:true,replyRoot:true};
}
