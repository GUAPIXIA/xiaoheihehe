async page => {
  const states = {'heybox.preferences':{theme:'light',zoom:100,exit:'close',shortcuts:true,animations:false,showSidebar:false},'heybox.community-filter':{mode:'all',included:[],excluded:[],unknown:true},'heybox.bookmarks':[],'heybox.history':[],'heybox.home-communities':null};
  const community = (id,name) => ({id,name,short:name[0],color:'#5c6c85',members:'社区',icon:''});
  const catalog=Array.from({length:8},(_,i)=>community(i+1,`社区${i+1}`));
  const extra=community(99,'搜索新增社区');
  let saves=0;
  await page.addInitScript(saved=>{for(const[key,value]of Object.entries(saved))localStorage.setItem(key,JSON.stringify(value));},states);
  await page.route('**/api/command',async route=>{
    const r=route.request().postDataJSON(); let data;
    switch(r.type){
      case 'bootstrap':data={account:null,states,dataDirectory:'synthetic-test'};break;
      case 'stateGet':data=states[r.payload.key]??null;break;
      case 'stateSet':states[r.payload.key]=r.payload.value;if(r.payload.key==='heybox.home-communities')saves++;data=true;break;
      case 'communities':data=r.payload.query?[extra]:catalog;break;
      case 'emojis':data={version:'synthetic',emojis:[]};break;
      case 'feed':data={posts:[],cursor:{offset:0,topics:{},exhausted:[],rotation:0},hasMore:false};break;
      default:throw new Error(`Unexpected command ${r.type}`);
    }
    await route.fulfill({json:{ok:true,data}});
  });
  const ribbonNames = () => page.locator('.community-ribbon button:not(.home-community-manage) > span:last-child').allTextContents();
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(()=>document.querySelectorAll('.community-ribbon button:not(.home-community-manage)').length===7);
  await page.getByRole('button',{name:'调整首页社区',exact:true}).click();
  await page.getByRole('textbox',{name:'搜索首页社区'}).waitFor();
  if(!await page.locator('.home-community-choices').getByRole('button',{name:'社 社区8',exact:true}).isDisabled())throw new Error('Seven item limit missing');
  await page.getByRole('button',{name:'移除社区1',exact:true}).click();
  await page.locator('.home-community-choices').getByRole('button',{name:'社 社区8',exact:true}).click();
  await page.getByRole('button',{name:'前移社区8',exact:true}).click();
  await page.getByRole('button',{name:'移除社区3',exact:true}).click();
  await page.getByRole('textbox',{name:'搜索首页社区'}).fill('搜索新增');
  await page.locator('.home-community-choices').getByRole('button',{name:'搜 搜索新增社区',exact:true}).click();
  await page.screenshot({path:'output/playwright/home-communities.png'});
  await page.getByRole('button',{name:'完成',exact:true}).click();
  const expected=['社区2','社区4','社区5','社区6','社区8','社区7','搜索新增社区'];
  if(JSON.stringify(await ribbonNames())!==JSON.stringify(expected))throw new Error('Selection/order not applied');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('heybox.home-communities'))?.at(-1)?.id===99);
  await page.waitForResponse(response=>{try{const r=response.request().postDataJSON();return r?.type==='stateSet'&&r.payload.key==='heybox.home-communities'&&r.payload.value?.at(-1)?.id===99}catch{return false}});
  if(states['heybox.community-filter'].excluded.length!==0)throw new Error('Homepage shortcuts changed filter');
  await page.reload();
  await page.getByRole('button',{name:'搜 搜索新增社区',exact:true}).waitFor();
  if(JSON.stringify(await ribbonNames())!==JSON.stringify(expected))throw new Error('Order or search-only item lost after reload');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.locator('.settings-nav').getByRole('button',{name:'首页社区',exact:true}).click();
  await page.getByRole('button',{name:'恢复默认首页社区',exact:true}).click();
  await page.getByRole('button',{name:'完成',exact:true}).click();
  if(JSON.stringify(await ribbonNames())!==JSON.stringify(catalog.slice(0,7).map(c=>c.name)))throw new Error('Defaults not restored');
  return {addRemove:true,order:true,limitSeven:true,search:true,persistentSearchItem:true,restoreDefaults:true,independentFilter:true,saves};
}
