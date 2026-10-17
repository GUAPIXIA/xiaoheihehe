async page => {
  const states = {'heybox.preferences':{theme:'light',zoom:100,exit:'close',shortcuts:true,animations:false,showSidebar:false},'heybox.community-filter':{mode:'all',included:[],excluded:[],unknown:true},'heybox.bookmarks':[],'heybox.history':[],'heybox.home-communities':null};
  const savedHeights=[];
  await page.setViewportSize({width:2000,height:1600});
  await page.addInitScript(saved=>{for(const[key,value]of Object.entries(saved))localStorage.setItem(key,JSON.stringify(value));},states);
  await page.route('**/api/command',async route=>{
    const r=route.request().postDataJSON();let data;
    switch(r.type){
      case 'bootstrap':data={account:null,states,dataDirectory:'synthetic-test'};break;
      case 'stateGet':data=states[r.payload.key]??null;break;
      case 'stateSet':states[r.payload.key]=r.payload.value;if(r.payload.key==='heybox.preferences'&&r.payload.value.windowHeight)savedHeights.push(r.payload.value.windowHeight);data=true;break;
      case 'communities':data=[];break;
      case 'emojis':data={version:'synthetic',emojis:[]};break;
      case 'feed':data={posts:[],cursor:{offset:0,topics:{},exhausted:[],rotation:0},hasMore:false};break;
      default:throw new Error(`Unexpected command ${r.type}`);
    }
    await route.fulfill({json:{ok:true,data}});
  });
  const checkSize = async (width,height) => {
    await page.waitForFunction(({width,height})=>{
      const r=document.querySelector('.desktop-window').getBoundingClientRect();
      return Math.abs(r.width-width)<1&&Math.abs(r.height-height)<1;
    },{width,height});
  };
  await page.goto('http://127.0.0.1:5173/');
  await checkSize(720,760);
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const slider=page.getByRole('slider',{name:'窗口高度',exact:true});
  await slider.fill('480');await slider.fill('900');await slider.fill('1080');
  await checkSize(720,1080);
  await page.waitForResponse(response=>{try{const r=response.request().postDataJSON();return r?.type==='stateSet'&&r.payload.key==='heybox.preferences'&&r.payload.value.windowHeight===1080}catch{return false}});
  if(savedHeights.includes(480)||savedHeights.includes(900))throw new Error('Height slider was not debounced');
  await page.getByRole('button',{name:/^600px/}).click();
  await checkSize(720,600);
  await page.getByRole('button',{name:'125%',exact:true}).click();
  await checkSize(900,750);
  await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.waitForResponse(response=>{try{const r=response.request().postDataJSON();return r?.type==='stateSet'&&r.payload.key==='heybox.preferences'&&r.payload.value.zoom===125&&r.payload.value.windowHeight===600}catch{return false}});
  await page.reload();
  await checkSize(900,750);
  await page.getByRole('button',{name:'设置',exact:true}).click();
  if(await slider.inputValue()!=='600')throw new Error('Height not restored after reload');
  await slider.fill('480');
  await page.getByRole('button',{name:/^900px/}).click();
  await checkSize(900,1125);
  const defaultChip=page.getByRole('button',{name:/（默认）/});
  const defaultHeight=Number((await defaultChip.innerText()).replace(/[^0-9]/g,''));
  if(!(defaultHeight>=480&&defaultHeight<=1200))throw new Error(`Default height preset out of range: ${defaultHeight}`);
  await defaultChip.click();
  await checkSize(900,defaultHeight*1.25);
  await page.getByRole('slider',{name:'窗口缩放',exact:true}).fill('100');
  await checkSize(720,defaultHeight);
  await page.screenshot({path:'output/playwright/window-height.png'});
  await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.setViewportSize({width:1000,height:700});
  await page.waitForFunction(()=>document.querySelector('.desktop-window').getBoundingClientRect().height<=636);
  const bounds=await page.locator('.desktop-window').boundingBox();
  if(bounds.height>636||bounds.width>952)throw new Error('Window no longer fits available viewport');
  return {legacyDefault:true,sliderDebounce:true,independentHeight:true,zoomCompatibility:true,persistence:true,presetOverridesDraft:true,restoreDefault:true,screenFit:true};
}
