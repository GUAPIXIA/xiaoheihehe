async page => {
  const states = {'heybox.preferences':{theme:'light',zoom:100,exit:'close',shortcuts:true,animations:false,showSidebar:false},'heybox.community-filter':{mode:'all',included:[],excluded:[],unknown:true},'heybox.bookmarks':[],'heybox.history':[],'heybox.home-communities':null};
  const savedWidths=[];
  await page.setViewportSize({width:2000,height:1600});
  await page.addInitScript(saved=>{for(const[key,value]of Object.entries(saved))localStorage.setItem(key,JSON.stringify(value));},states);
  await page.route('**/api/command',async route=>{
    const r=route.request().postDataJSON();let data;
    switch(r.type){
      case 'bootstrap':data={account:null,states,dataDirectory:'synthetic-test'};break;
      case 'stateGet':data=states[r.payload.key]??null;break;
      case 'stateSet':states[r.payload.key]=r.payload.value;if(r.payload.key==='heybox.preferences'&&r.payload.value.windowWidth)savedWidths.push(r.payload.value.windowWidth);data=true;break;
      case 'communities':data=[];break;
      case 'emojis':data={version:'synthetic',emojis:[]};break;
      case 'feed':data={posts:[],cursor:{offset:0,topics:{},exhausted:[],rotation:0},hasMore:false};break;
      default:throw new Error(`Unexpected command ${r.type}`);
    }
    await route.fulfill({json:{ok:true,data}});
  });
  const checkSize = async (width,height) => {
    try { await page.waitForFunction(({width,height})=>{
      const r=document.querySelector('.desktop-window').getBoundingClientRect();
      return Math.abs(r.width-width)<1&&Math.abs(r.height-height)<1;
    },{width,height},{timeout:5000}); } catch(error) { throw new Error(`Expected ${width}x${height}, actual ${JSON.stringify(await page.locator('.desktop-window').boundingBox())}, prefs ${await page.evaluate(()=>localStorage.getItem('heybox.preferences'))}`); }
  };
  const saved = value => page.waitForResponse(response=>{try{const r=response.request().postDataJSON();return r?.type==='stateSet'&&r.payload.key==='heybox.preferences'&&value(r.payload.value)}catch{return false}});
  await page.goto('http://127.0.0.1:5173/');
  await checkSize(720,760);
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const slider=page.getByRole('slider',{name:'窗口宽度',exact:true});
  let save=saved(p=>p.windowWidth===1280);
  await slider.fill('600');await slider.fill('960');await slider.fill('1280');
  await checkSize(1280,760);await save;
  if(savedWidths.includes(600)||savedWidths.includes(960))throw new Error('Width slider not debounced');
  await page.getByRole('button',{name:'800px',exact:true}).click();await checkSize(800,760);
  await page.getByRole('switch',{name:'显示右侧栏',exact:true}).click();await checkSize(800,760);
  await page.getByRole('button',{name:'600px',exact:true}).click();await checkSize(800,600);
  save=saved(p=>p.windowWidth===800&&p.windowHeight===600&&p.zoom===125);
  await page.getByRole('button',{name:'125%',exact:true}).click();await checkSize(1000,750);await save;
  await page.reload();await checkSize(1000,750);
  await page.getByRole('button',{name:'设置',exact:true}).click();
  if(await slider.inputValue()!=='800')throw new Error('Width not restored');
  await slider.fill('600');await page.getByRole('button',{name:'960px',exact:true}).click();await checkSize(1200,750);
  save=saved(p=>!('windowWidth' in p)&&p.showSidebar===true);
  await page.getByRole('button',{name:'恢复默认宽度',exact:true}).click();await save;await checkSize(1200,750);
  await page.getByRole('switch',{name:'显示右侧栏',exact:true}).click();await checkSize(900,750);
  await page.getByRole('button',{name:'100%',exact:true}).click();await checkSize(720,600);
  await slider.fill('1600');await checkSize(1600,600);
  await page.screenshot({path:'output/playwright/window-width.png'});
  await page.getByRole('button',{name:'完成',exact:true}).click();
  await page.setViewportSize({width:1000,height:700});
  await checkSize(952,357);
  return {legacyDefault:true,sliderDebounce:true,independentDimensions:true,sidebarKeepsCustomWidth:true,zoomCompatibility:true,persistence:true,presetOverridesDraft:true,automaticDefault:true,screenFit:true};
}
