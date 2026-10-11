async page => {
  const states={'heybox.preferences':{theme:'light',zoom:100,exit:'close',shortcuts:true,animations:false,showSidebar:false},'heybox.community-filter':{mode:'exclude',included:[],excluded:[],unknown:true},'heybox.bookmarks':[],'heybox.history':[],'heybox.home-communities':null};
  const post=id=>({id,userId:'12345',author:'测试盒友',avatar:'测',avatarUrl:'',color:'#ddd',time:'刚刚',title:`评论翻页测试${id}`,excerpt:'测试',body:id===1?Array.from({length:30},(_,i)=>`正文段落 ${i}`):[],topicIds:[],topics:[],likes:0,comments:23,images:[],level:0,medalUrl:'',medalName:'',liked:false,createdAt:0,videoUrl:'',isCy:false});
  const comment=id=>({id,rootId:id,userId:'12345',author:`评论者${id}`,avatar:'评',avatarUrl:'',text:`根评论${id}。`+'用于检查滚动分页。'.repeat(20),likes:0,time:'刚刚',level:10,medalUrl:'',medalName:'',pinned:id===1,isAuthor:false,createdAt:0,replyTo:'',replyCount:0,hasMoreReplies:false,replies:[]});
  const requests=[];let fail=true,release;
  const held=new Promise(resolve=>{release=resolve;});
  await page.setViewportSize({width:1100,height:900});
  await page.addInitScript(saved=>{for(const[key,value]of Object.entries(saved))localStorage.setItem(key,JSON.stringify(value));},states);
  await page.route('**/api/command',async route=>{
    const r=route.request().postDataJSON();let data;
    switch(r.type){
      case 'bootstrap':data={account:null,states,dataDirectory:'synthetic-test'};break;
      case 'stateGet':data=states[r.payload.key]??null;break;
      case 'stateSet':states[r.payload.key]=r.payload.value;data=true;break;
      case 'communities':data=[];break;
      case 'emojis':data={version:'synthetic',emojis:[]};break;
      case 'feed':data={posts:[post(1),post(2)],cursor:{offset:0,topics:{},exhausted:[],rotation:0},hasMore:false};break;
      case 'detail':{
        const {id,page:pageNumber}=r.payload;requests.push({id,page:pageNumber});
        if(id===2&&pageNumber===2){await held;data={post:post(2),comments:[comment(299)],page:2,hasMore:false};break;}
        if(pageNumber===2){await new Promise(resolve=>setTimeout(resolve,150));if(fail){fail=false;await route.fulfill({json:{ok:false,error:{code:'network',message:'测试：评论加载失败'}}});return;}}
        const comments=id===2?[comment(201)]:pageNumber===1?Array.from({length:10},(_,i)=>comment(i+1)):pageNumber===2?Array.from({length:11},(_,i)=>comment(i+10)):pageNumber===3?[]:[comment(21),comment(22),comment(23)];
        data={post:post(id),comments,page:pageNumber,hasMore:id===2||pageNumber<4};break;
      }
      default:throw new Error(`Unexpected command ${r.type}`);
    }
    try{await route.fulfill({json:{ok:true,data}});}catch(error){if(!(r.type==='detail'&&r.payload.id===2&&r.payload.page===2))throw error;}
  });
  const waitUntil=async predicate=>{const end=Date.now()+10000;while(!predicate()){if(Date.now()>end)throw new Error('Request timed out');await new Promise(resolve=>setTimeout(resolve,25));}};
  const bottom=()=>page.locator('.content-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('heading',{name:'评论翻页测试1',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.comment').length===10);
  if(requests.map(r=>r.page).join(',')!=='1')throw new Error('Comments loaded before approaching bottom');
  if(await page.getByRole('button',{name:'加载更多评论',exact:true}).count())throw new Error('Manual load button still exists');
  await bottom();await bottom();await bottom();
  await page.getByRole('alert').filter({hasText:'测试：评论加载失败'}).waitFor();
  if(requests.map(r=>r.page).join(',')!=='1,2'||await page.locator('.comment').count()!==10)throw new Error('Failure lost comments or duplicated requests');
  await bottom();await new Promise(resolve=>setTimeout(resolve,350));
  if(requests.length!==2)throw new Error('Failed request retried automatically');
  await page.getByRole('button',{name:'重试',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.comment').length===20);
  if(requests.map(r=>r.page).join(',')!=='1,2,2')throw new Error('Retry did not preserve failed page');
  await bottom();
  await page.waitForFunction(()=>document.querySelectorAll('.comment').length===23);
  if(requests.map(r=>r.page).join(',')!=='1,2,2,3,4')throw new Error('Empty page did not advance');
  if(await page.locator('.comments-end').count())throw new Error('Exhausted pagination sentinel remains');
  await bottom();await new Promise(resolve=>setTimeout(resolve,250));
  if(requests.length!==5)throw new Error('Exhausted comments still requested');
  await page.getByRole('button',{name:'返回',exact:true}).click();
  await page.getByRole('heading',{name:'评论翻页测试2',exact:true}).click();
  await bottom();await waitUntil(()=>requests.some(r=>r.id===2&&r.page===2));
  await page.getByRole('button',{name:'返回',exact:true}).click();
  await page.getByRole('heading',{name:'评论翻页测试1',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.comment').length===10);
  release();await new Promise(resolve=>setTimeout(resolve,150));
  if(await page.locator('.comment').count()!==10||await page.getByText('评论者299',{exact:true}).count())throw new Error('Old request replaced current comments');
  await page.getByRole('button',{name:'回到顶部',exact:true}).click();
  if(await page.locator('.content-scroll').evaluate(el=>el.scrollTop)!==0)throw new Error('Scroll position moved after loading');
  return {automaticPagination:true,nearBottomOnly:true,duplicateGuard:true,errorPreservesComments:true,retryPreservesPage:true,deduplicatedComments:true,emptyPageAdvances:true,exhaustedStops:true,staleRequestIgnored:true,scrollControlsWork:true};
}
