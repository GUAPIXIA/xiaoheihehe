async page => {
  const community = id => ({id,name:`社区${id}`,short:'社',color:'#5c6c85',members:'社区',icon:''});
  const catalog = Array.from({length:16},(_,i)=>community(i+1));
  const states = {'heybox.preferences':{theme:'light',zoom:100,exit:'close',shortcuts:true,animations:false,showSidebar:false},'heybox.community-filter':{mode:'all',included:[],excluded:[],unknown:true},'heybox.bookmarks':[],'heybox.history':[],'heybox.home-communities':[community(2),community(4)]};
  await page.addInitScript(saved=>{
    for(const[key,value]of Object.entries(saved))localStorage.setItem(key,JSON.stringify(value));
    const launch = Number(sessionStorage.getItem('random-test-launch')??0)+1;
    sessionStorage.setItem('random-test-launch',String(launch));
    Math.random=()=>launch%2 ? 0.1 : 0.6;
  },states);
  await page.route('**/api/command',async route=>{
    const r=route.request().postDataJSON();let data;
    switch(r.type){
      case 'bootstrap':data={account:null,states,dataDirectory:'synthetic-test'};break;
      case 'stateGet':data=states[r.payload.key]??null;break;
      case 'stateSet':states[r.payload.key]=r.payload.value;data=true;break;
      case 'communities':data=catalog;break;
      case 'emojis':data={version:'synthetic',emojis:[]};break;
      case 'feed':data={posts:[],cursor:{offset:0,topics:{},exhausted:[],rotation:0},hasMore:false};break;
      default:throw new Error(`Unexpected command ${r.type}`);
    }
    await route.fulfill({json:{ok:true,data}});
  });
  const names = ()=>page.locator('.community-ribbon button:not(.home-community-manage) > span:last-child').allTextContents();
  const checkFilled = async()=>{
    await page.waitForFunction(()=>document.querySelectorAll('.community-ribbon button:not(.home-community-manage)').length===7);
    const result=await names();
    if(new Set(result).size!==7||result[0]!=='社区2'||result[1]!=='社区4')throw new Error('Fixed order or unique random filling failed');
    return result;
  };
  await page.goto('http://127.0.0.1:5173/');
  const first=await checkFilled();
  await page.getByRole('button',{name:'刷新推荐内容'}).click();
  if(JSON.stringify(await names())!==JSON.stringify(first))throw new Error('Refresh rerolled startup selection');
  await page.getByRole('button',{name:'调整首页社区'}).click();
  if(await page.locator('.home-selected-row').count()!==2)throw new Error('Random entries incorrectly treated as fixed');
  await page.getByRole('button',{name:'完成',exact:true}).click();
  if(JSON.stringify(await names())!==JSON.stringify(first))throw new Error('Settings rerolled startup selection');
  if(states['heybox.home-communities'].length!==2)throw new Error('Random entries persisted as fixed');
  await page.reload();
  const second=await checkFilled();
  if(JSON.stringify(first.slice(2))===JSON.stringify(second.slice(2)))throw new Error('New startup seed did not change selection');
  await page.getByRole('button',{name:'调整首页社区'}).click();
  await page.getByRole('button',{name:'移除社区2',exact:true}).click();
  await page.getByRole('button',{name:'移除社区4',exact:true}).click();
  await page.getByRole('button',{name:'完成',exact:true}).click();
  const allRandom=await names();
  if(allRandom.length!==7||new Set(allRandom).size!==7)throw new Error('Zero fixed communities did not fill seven');
  const edgeCases=await page.evaluate(async()=>{
    const {fillHomeCommunities}=await import('/src/community.ts');
    const c=id=>({id,name:String(id),short:'社',color:'#aaa',members:'社区',icon:''});
    const small=fillHomeCommunities([c(1),c(1)],[c(1),c(2),c(2)],123);
    const full=fillHomeCommunities(Array.from({length:7},(_,i)=>c(i+1)),[c(8),c(9)],123);
    return {small:small.map(c=>c.id),full:full.map(c=>c.id)};
  });
  if(edgeCases.small.join()!=='1,2'||edgeCases.full.join()!=='1,2,3,4,5,6,7')throw new Error('Insufficient pool/duplicate/full selection handling failed');
  return {fixedOrder:true,uniqueFill:true,stableWithinRun:true,newStartupSeed:true,onlyFixedPersisted:true,allRandomWhenEmpty:true,smallPool:true};
}
