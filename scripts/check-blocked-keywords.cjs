async page => {
  const states={'heybox.preferences':{theme:'light',zoom:100,exit:'close',shortcuts:true,animations:false,showSidebar:false},'heybox.community-filter':{mode:'exclude',included:[],excluded:[],unknown:true},'heybox.bookmarks':[1,2,6,7],'heybox.history':[1,2,6,7],'heybox.home-communities':null};
  const topic={id:10,name:'剧透社区',short:'剧',color:'#ddd',members:'社区',icon:''};
  const post=(id,title,excerpt,extra={})=>({id,title,excerpt,userId:'12345',author:'普通作者',avatar:'普',avatarUrl:'',color:'#ddd',time:'刚刚',body:[],topicIds:[],topics:[],likes:0,comments:1,images:[],level:0,medalUrl:'',medalName:'',liked:false,createdAt:0,videoUrl:'',isCy:false,...extra});
  const posts=[post(1,'剧透标题','普通摘要'),post(2,'摘要匹配','包含剧透内容'),post(3,'正文匹配','普通摘要',{body:['正文独有剧透']}),post(4,'作者匹配','普通摘要',{author:'剧透作者'}),post(5,'社区匹配','普通摘要',{topicIds:[10],topics:[topic]}),post(6,'SPOILER 标题','普通摘要'),post(7,'字面符号 .*','普通摘要'),post(8,'A','B')];
  const comment={id:101,rootId:101,userId:'12345',author:'评论者',avatar:'评',avatarUrl:'',text:'评论独有剧透',likes:0,time:'刚刚',replies:[]};
  const requests=[];let paginationMode=false;
  await page.setViewportSize({width:1280,height:1000});
  await page.addInitScript(saved=>{for(const[key,value]of Object.entries(saved))localStorage.setItem(key,JSON.stringify(value));},states);
  await page.route('**/api/command',async route=>{
    const r=route.request().postDataJSON();let data;
    switch(r.type){
      case 'bootstrap':data={account:null,states,dataDirectory:'synthetic-test'};break;
      case 'stateGet':data=states[r.payload.key]??null;break;
      case 'stateSet':states[r.payload.key]=r.payload.value;data=true;break;
      case 'communities':data=[topic];break;
      case 'emojis':data={version:'synthetic',emojis:[]};break;
      case 'localPosts':data=posts.filter(p=>r.payload.ids.includes(p.id));break;
      case 'detail':data={post:posts.find(p=>p.id===r.payload.id),comments:[comment],page:1,hasMore:false,isCy:false};break;
      case 'feed':{
        requests.push(r.payload);const offset=r.payload.cursor?.offset??0;
        data={posts:paginationMode?(offset===0?[post(50,'hide 整页匹配','隐藏摘要')]:[post(51,'第二页可见帖子','普通摘要')]):posts,cursor:{offset:offset+30,topics:{},exhausted:[],rotation:0},hasMore:paginationMode&&offset===0};break;
      }
      default:throw new Error(`Unexpected command ${r.type}`);
    }
    await route.fulfill({json:{ok:true,data}});
  });
  const waitUntil=async predicate=>{const end=Date.now()+10000;while(!predicate()){if(Date.now()>end)throw new Error('Persistence timed out');await new Promise(resolve=>setTimeout(resolve,25));}};
  const check=async titles=>page.waitForFunction(titles=>JSON.stringify([...document.querySelectorAll('.post-content h2')].map(e=>e.textContent))===JSON.stringify(titles),titles);
  const settings=async()=>{await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('.settings-nav').getByRole('button',{name:'关键词屏蔽',exact:true}).click();};
  const go=async name=>{await page.getByRole('button',{name:'切换页面',exact:true}).click();await page.locator('.page-dropdown').getByRole('button',{name,exact:true}).click();};
  await page.goto('http://127.0.0.1:5173/');await check(posts.map(p=>p.title));
  await settings();
  await page.getByRole('textbox',{name:'屏蔽关键词',exact:true}).fill('  剧透  \nSpoiler\n spoiler \n.*\nAB\n');
  await page.getByRole('button',{name:'添加关键词',exact:true}).click();
  await check(['正文匹配','作者匹配','社区匹配','A']);
  if(await page.locator('.keyword-list button').count()!==4)throw new Error('Trimming or case-insensitive dedup failed');
  await waitUntil(()=>states['heybox.blocked-keywords']?.length===4);
  await page.getByRole('textbox',{name:'屏蔽关键词',exact:true}).fill('   \n');
  await page.getByRole('button',{name:'添加关键词',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'请输入关键词'}).waitFor();
  await page.getByRole('textbox',{name:'屏蔽关键词',exact:true}).fill('😀'.repeat(101));
  await page.getByRole('button',{name:'添加关键词',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'最多 100 个字符'}).waitFor();
  await page.getByRole('textbox',{name:'屏蔽关键词',exact:true}).fill('');
  await page.screenshot({path:'output/playwright/blocked-keywords.png'});
  await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByRole('heading',{name:'正文匹配',exact:true}).click();
  await page.getByText('正文独有剧透',{exact:true}).waitFor();
  await page.getByText('评论独有剧透',{exact:true}).waitFor();
  await page.getByRole('button',{name:'返回',exact:true}).click();
  await go('我的收藏');await check(posts.filter(p=>states['heybox.bookmarks'].includes(p.id)).map(p=>p.title));
  await go('浏览记录');await page.waitForFunction(()=>document.querySelectorAll('.post-card').length===5);
  await page.getByRole('heading',{name:'剧透标题',exact:true}).waitFor();
  await go('首页');await check(['正文匹配','作者匹配','社区匹配','A']);
  await page.reload();await check(['正文匹配','作者匹配','社区匹配','A']);
  await settings();await page.getByRole('button',{name:'移除关键词 .*',exact:true}).click();
  await check(['正文匹配','作者匹配','社区匹配','字面符号 .*','A']);
  await page.getByRole('button',{name:'清空关键词',exact:true}).click();await check(posts.map(p=>p.title));
  await page.getByRole('textbox',{name:'屏蔽关键词',exact:true}).fill('hide');await page.getByRole('button',{name:'添加关键词',exact:true}).click();
  await page.getByRole('button',{name:'完成',exact:true}).click();paginationMode=true;
  await page.getByRole('button',{name:'刷新推荐内容',exact:true}).click();
  await check(['第二页可见帖子']);
  if(requests.at(-1).cursor?.offset!==30)throw new Error('Fully hidden page blocked automatic pagination');
  if(requests.some(r=>'keywords' in r||'blockedKeywords' in r))throw new Error('Keywords sent to upstream request');
  return {titleAndExcerptOnly:true,caseInsensitive:true,literalMatch:true,noFieldJoining:true,trimAndDeduplicate:true,emptyAndLongRejected:true,automaticSave:true,persistence:true,authorAndCommunityUnaffected:true,bodyAndCommentsUnaffected:true,bookmarksAndHistoryUnaffected:true,removeAndClear:true,hiddenPageStillPaginates:true};
}
