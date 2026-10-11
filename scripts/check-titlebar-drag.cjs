async page => {
  await page.setViewportSize({width:1280,height:900});
  await page.addInitScript(() => {
    const states={'heybox.preferences':{theme:'light',zoom:100,exit:'close',shortcuts:true,animations:false,showSidebar:false},'heybox.community-filter':{mode:'exclude',included:[],excluded:[],unknown:true},'heybox.bookmarks':[],'heybox.history':[],'heybox.home-communities':null};
    for(const[key,value]of Object.entries(states))localStorage.setItem(key,JSON.stringify(value));
    window.isTauri=true;
    window.__windowCalls=[];
    window.__TAURI_INTERNALS__={invoke:async(cmd,args)=>{
      if(cmd==='window_action'){window.__windowCalls.push(args.action);return;}
      if(cmd!=='command')throw new Error(`Unexpected invocation ${cmd}`);
      const r=args.request;
      switch(r.type){
        case 'bootstrap':return {account:null,states,dataDirectory:'synthetic-test'};
        case 'stateGet':return states[r.payload.key]??null;
        case 'stateSet':states[r.payload.key]=r.payload.value;return true;
        case 'communities':return [];
        case 'emojis':return {version:'synthetic',emojis:[]};
        case 'feed':return {posts:[],cursor:{offset:0,topics:{},exhausted:[],rotation:0},hasMore:false};
        default:throw new Error(`Unexpected command ${r.type}`);
      }
    }};
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.native-desktop').waitFor();
  await page.getByRole('heading',{name:'没有符合条件的帖子',exact:true}).waitFor();
  const count=()=>page.evaluate(()=>window.__windowCalls.filter(action=>action==='drag').length);
  const press=async(x,y,button='left')=>{await page.mouse.move(x,y);await page.mouse.down({button});await page.mouse.up({button});};
  const wrap=await page.locator('.page-menu-wrap').boundingBox(), menu=await page.locator('.page-menu').boundingBox();
  if(wrap.x+wrap.width-menu.x-menu.width<5)throw new Error('Missing test blank area');
  await press(menu.x+menu.width+3,wrap.y+wrap.height/2);
  if(await count()!==1)throw new Error('Blank area immediately after homepage does not start dragging');
  await press(wrap.x+wrap.width+5,wrap.y+wrap.height/2);
  if(await count()!==2)throw new Error('Header gap does not start dragging');
  const divider=await page.locator('.titlebar-divider').boundingBox();
  await press(divider.x+divider.width/2,divider.y+divider.height/2);
  if(await count()!==3)throw new Error('Noninteractive child does not start dragging');
  await press(menu.x+menu.width+3,wrap.y+wrap.height/2,'right');
  if(await count()!==3)throw new Error('Right mouse button started dragging');
  await page.locator('.page-menu span').click();
  await page.locator('.page-dropdown').waitFor();
  const dropdown=await page.locator('.page-dropdown').boundingBox();
  await press(dropdown.x+2,dropdown.y+2);
  if(await count()!==3)throw new Error('Dropdown padding starts dragging');
  await page.getByRole('button',{name:'首页',exact:true}).click();
  await page.locator('.titlebar-search svg').click();
  await page.locator('.titlebar-search kbd').click();
  await page.getByRole('textbox',{name:'搜索帖子或社区',exact:true}).click();
  if(!await page.getByRole('textbox',{name:'搜索帖子或社区',exact:true}).evaluate(el=>el===document.activeElement))throw new Error('Search cannot receive focus');
  await page.getByRole('button',{name:'设置',exact:true}).locator('svg').click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'最大化',exact:true}).locator('svg').click();
  await page.getByRole('button',{name:'还原窗口',exact:true}).click();
  if(await count()!==3)throw new Error('Interactive control started dragging');
  const actions=await page.evaluate(()=>window.__windowCalls);
  if(actions.filter(a=>a==='maximize').length!==2)throw new Error('Window controls stopped working');
  return {homepageBlank:true,headerGaps:true,noninteractiveChildren:true,leftButtonOnly:true,dropdownExcluded:true,searchExcluded:true,nestedControlIconsExcluded:true,controlsStillWork:true,nativeCallsMocked:true};
}
