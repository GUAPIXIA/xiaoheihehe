async page => {
  const preferences={theme:'light',zoom:100,exit:'close',shortcuts:true,animations:false,showSidebar:false};
  const states={'heybox.preferences':preferences,'heybox.community-filter':{mode:'all',included:[],excluded:[],unknown:true},'heybox.bookmarks':[],'heybox.history':[]};
  const emojis=[{token:'[cube_哭泣]',name:'哭泣',url:'https://emoji.example.test/cry.png',group:'cube',groupName:'CUBE表情'},{token:'[heygirl_无语]',name:'无语',url:'https://emoji.example.test/silent.png',group:'heygirl',groupName:'黑盒娘表情'},{token:'[cube_失败]',name:'失败',url:'https://emoji.example.test/broken.png',group:'cube',groupName:'CUBE表情'}];
  const post={id:1,userId:'12345',author:'测试盒友',avatar:'测',avatarUrl:'',color:'#ddd',time:'刚刚',title:'表情测试[cube_哭泣]',excerpt:'摘要[cube_哭泣] 未知[unknown_表情] 失败[cube_失败]',body:['正文[cube_哭泣] 未知[unknown_表情] 失败[cube_失败] <script>literal</script>'],topicIds:[],topics:[],likes:0,comments:1,images:[],level:14,medalUrl:'',medalName:'',liked:false,createdAt:0,videoUrl:'',isCy:false};
  const root={id:100,userId:'12345',rootId:100,author:'评论盒友',avatar:'评',avatarUrl:'',text:'主评论[cube_哭泣]',likes:0,time:'刚刚',level:11,medalUrl:'',medalName:'',pinned:false,isAuthor:false,createdAt:0,replyTo:'',replyCount:1,hasMoreReplies:false,replies:[{id:101,userId:'67890',rootId:100,author:'子评论盒友',avatar:'子',avatarUrl:'',text:'子评论[heygirl_无语]',likes:0,time:'刚刚',level:9,medalUrl:'',medalName:'',pinned:false,isAuthor:false,createdAt:0,replyTo:'评论盒友',replyCount:0,hasMoreReplies:false,replies:[]}]};
  let submission, catalogs=0;
  await page.addInitScript(saved=>{for(const [key,value] of Object.entries(saved))localStorage.setItem(key,JSON.stringify(value));},states);
  await page.route('https://emoji.example.test/**',async route=>{
    if(route.request().url().endsWith('broken.png')){await route.fulfill({status:404,body:''});return;}
    await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="15" fill="#f8c14d"/><path d="M9 12h2m10 0h2M11 23q5-5 10 0" stroke="#222" fill="none" stroke-width="2"/></svg>'});
  });
  await page.route('**/api/command',async route=>{
    const r=route.request().postDataJSON();let data;
    switch(r.type){
      case 'emojis':catalogs++;data={version:'synthetic-v1',emojis};break;
      case 'bootstrap':data={account:{id:'99999',name:'测试账号',avatarUrl:''},states,dataDirectory:'synthetic-test'};break;
      case 'stateGet':data=states[r.payload.key]??null;break;
      case 'stateSet':states[r.payload.key]=r.payload.value;data=true;break;
      case 'communities':data=[];break;
      case 'feed':data={posts:[post],cursor:{offset:30,topics:{},exhausted:[],rotation:0},hasMore:false};break;
      case 'detail':data={post,comments:[root],page:1,hasMore:false,isCy:false};break;
      case 'comment':submission=r.payload;data=true;break;
      default:throw new Error(`Unexpected command ${r.type}`);
    }
    await route.fulfill({json:{ok:true,data}});
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>document.querySelectorAll('.post-content .inline-emoji').length===2&&[...document.querySelectorAll('.post-content .inline-emoji')].every(img=>img.naturalWidth>0));
  if(catalogs!==1)throw new Error('Repeated emoji catalog requests');
  await page.locator('.post-content').click();
  await page.waitForFunction(()=>document.querySelectorAll('.post-detail .inline-emoji').length===4&&[...document.querySelectorAll('.post-detail .inline-emoji')].every(img=>img.naturalWidth>0));
  const body=await page.locator('.post-body').textContent();
  if(!body.includes('[unknown_表情]')||!body.includes('[cube_失败]')||!body.includes('<script>literal</script>'))throw new Error('Unknown/broken/text fallback missing');
  if(await page.locator('.post-detail script').count())throw new Error('Unsafe HTML rendered');
  await page.getByRole('textbox',{name:'评论内容'}).fill('前后');
  await page.getByRole('textbox',{name:'评论内容'}).press('ArrowLeft');
  await page.getByRole('button',{name:'选择表情',exact:true}).click();
  await page.getByRole('button',{name:'插入 哭泣 表情'}).click();
  if(await page.getByRole('textbox',{name:'评论内容'}).inputValue()!=='前[cube_哭泣]后')throw new Error('Caret insertion failed');
  await page.getByRole('button',{name:'黑盒娘表情'}).click();
  await page.getByRole('button',{name:'插入 无语 表情'}).click();
  if(await page.getByRole('textbox',{name:'评论内容'}).inputValue()!=='前[cube_哭泣][heygirl_无语]后')throw new Error('Group selection/insertion failed');
  await page.screenshot({path:'output/playwright/emojis.png'});
  await page.getByRole('button',{name:'评论',exact:true}).click();
  await page.getByText('评论已发送',{exact:true}).waitFor();
  if(submission.text!=='前[cube_哭泣][heygirl_无语]后')throw new Error('Submitted emoji tokens changed');
  return {officialTokenMapping:true,feedAndDetail:true,rootAndSubComments:true,unknownFallback:true,imageFailureFallback:true,plainTextSafety:true,caretInsertion:true,groupSelection:true,submittedTokens:true};
}
