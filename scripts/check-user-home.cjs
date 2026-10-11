async page => {
  const preferences = {theme:'light',zoom:100,exit:'close',shortcuts:true,animations:false,showSidebar:false};
  const states = {'heybox.preferences':preferences,'heybox.community-filter':{mode:'all',included:[],excluded:[],unknown:true},'heybox.bookmarks':[],'heybox.history':[]};
  const post = {id:1,userId:'12345',author:'测试盒友',avatar:'测',avatarUrl:'',color:'#ddd',time:'刚刚',title:'信息流帖子',excerpt:'查看作者主页',body:['测试正文'],topicIds:[],topics:[],likes:1,comments:1,images:[],level:14,medalUrl:'',medalName:'',liked:false,createdAt:0,videoUrl:'',isCy:false};
  const first = {...post,id:2,title:'主页第一篇'};
  const second = {...post,id:3,title:'主页第二篇'};
  const comment = {id:100,userId:'67890',rootId:100,author:'评论盒友',avatar:'评',avatarUrl:'',text:'评论内容',likes:0,time:'刚刚',level:11,medalUrl:'',medalName:'',pinned:false,isAuthor:false,createdAt:0,replyTo:'',replyCount:1,hasMoreReplies:false,replies:[{id:101,userId:'11111',rootId:100,author:'子评论盒友',avatar:'子',avatarUrl:'',text:'子评论内容',likes:0,time:'刚刚',level:9,medalUrl:'',medalName:'',pinned:false,isAuthor:false,createdAt:0,replyTo:'评论盒友',replyCount:0,hasMoreReplies:false,replies:[]}]};
  const calls = [], errors = []; let failPage = true;
  await page.addInitScript(saved => {for (const [key,value] of Object.entries(saved)) localStorage.setItem(key,JSON.stringify(value));},states);
  await page.route('**/api/command',async route => {
    const r = route.request().postDataJSON(); calls.push(r); let data;
    switch(r.type) {
      case 'bootstrap':data={account:{id:'99999',name:'测试账号',avatarUrl:''},states,dataDirectory:'synthetic-test'};break;
      case 'stateGet':data=states[r.payload.key]??null;break;
      case 'stateSet':states[r.payload.key]=r.payload.value;data=true;break;
      case 'communities':data=[];break;
      case 'feed':data={posts:[{...post,userId:''}],cursor:{offset:30,topics:{},exhausted:[],rotation:0},hasMore:false};break;
      case 'detail':data={post:r.payload.id===2?first:post,comments:[comment],page:1,hasMore:false,isCy:false};break;
      case 'profile':data={id:r.payload.id,name:r.payload.id==='12345'?'测试盒友':r.payload.id==='67890'?'评论盒友':'子评论盒友',avatarUrl:'',level:14,bio:'主页个人简介'};break;
      case 'userPosts':
        if (r.payload.id!=='12345') {data={posts:[],hasMore:false,lastval:''};break;}
        if (!r.payload.lastval) data={posts:[first],hasMore:true,lastval:'123.456'};
        else if (failPage) {failPage=false;await route.fulfill({json:{ok:false,error:{code:'network',message:'模拟主页分页失败'}}});return;}
        else data={posts:[first,second],hasMore:false,lastval:'122.456'};
        break;
      default:throw new Error(`Unexpected command ${r.type}`);
    }
    await route.fulfill({json:{ok:true,data}});
  });
  await page.goto('http://127.0.0.1:5173/'); page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'查看 测试盒友 的资料'}).click();
  await page.getByRole('heading',{name:'盒友主页',exact:true}).waitFor();
  await page.getByText('主页个人简介',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'主页第一篇',exact:true}).waitFor();
  await page.getByRole('button',{name:'加载更多内容'}).click();
  await page.getByRole('alert').waitFor();
  await page.getByRole('button',{name:'重试',exact:true}).click();
  await page.getByRole('heading',{name:'主页第二篇',exact:true}).waitFor();
  if (await page.locator('.user-home-post').count()!==2) throw new Error('Home posts not deduplicated');
  const cursors=calls.filter(c=>c.type==='userPosts').map(c=>c.payload.lastval);
  if (cursors.filter(Boolean).join()!=='123.456,123.456') throw new Error('Cursor/retry mismatch');
  await page.screenshot({path:'output/playwright/user-home.png'});
  await page.getByRole('heading',{name:'主页第一篇',exact:true}).click();
  await page.getByRole('button',{name:'返回',exact:true}).waitFor();
  await page.getByRole('heading',{name:'主页第一篇',exact:true}).waitFor();
  await page.getByRole('button',{name:'返回',exact:true}).click();
  await page.getByRole('heading',{name:'盒友主页',exact:true}).waitFor();
  await page.getByRole('button',{name:'关闭弹窗'}).click();
  await page.locator('.post-content').click();
  await page.getByRole('button',{name:'查看 测试盒友 的主页',exact:true}).click();
  await page.getByRole('heading',{name:'盒友主页',exact:true}).waitFor();
  await page.getByRole('button',{name:'关闭弹窗'}).click();
  await page.getByRole('button',{name:'查看 评论盒友 的主页',exact:true}).click();
  await page.getByRole('heading',{name:'盒友主页',exact:true}).waitFor();
  await page.getByText('这个盒友还没有发布内容',{exact:true}).waitFor();
  await page.getByRole('button',{name:'关闭弹窗'}).click();
  await page.getByRole('button',{name:'查看 子评论盒友 的主页',exact:true}).click();
  await page.getByRole('heading',{name:'盒友主页',exact:true}).waitFor();
  await page.getByText('这个盒友还没有发布内容',{exact:true}).waitFor();
  if (!calls.some(c=>c.type==='profile'&&c.payload.id==='67890') || !calls.some(c=>c.type==='profile'&&c.payload.id==='11111')) throw new Error('Comment author identity incorrect');
  await page.getByRole('button',{name:'关闭弹窗'}).click();
  if (errors.length) throw new Error(errors.join(';'));
  return {oldCachedAuthorFallback:true,profileAndPosts:true,pagination:true,retryCursor:true,deduplication:true,openAndReturn:true,detailEntry:true,commentEntry:true,subCommentEntry:true};
}
