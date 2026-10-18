async (page) => {
  // Fully mocked regression guard for "user-home thumbnails collapse into narrow strips".
  // Root cause was `.user-home-images` being a <button> that shrank to 100px, so each
  // image's `max-width: 30%` resolved to 30px. Every assertion below is expressed in
  // CSS px (divided by the `.window-inner` transform scale) so zoom cannot mask it.
  const ORIGIN = 'http://127.0.0.1:5173';
  const GAP = 7;
  const SVG = (w, h, fill) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`;
  const IMAGES = {
    'uh-normal-1.svg': SVG(400, 300, '#4a90d9'),
    'uh-normal-2.svg': SVG(400, 300, '#4a90d9'),
    'uh-normal-3.svg': SVG(400, 300, '#4a90d9'),
    'uh-wide.svg': SVG(1200, 100, '#d9534f'),
    'uh-tall.svg': SVG(60, 900, '#5cb85c'),
    'uh-tiny.svg': SVG(8, 8, '#f0ad4e'),
  };
  const url = name => `${ORIGIN}/${name}`;

  const preferences = { theme: 'light', zoom: 100, exit: 'close', shortcuts: true, animations: false, showSidebar: false };
  const states = { 'heybox.preferences': preferences, 'heybox.community-filter': { mode: 'all', included: [], excluded: [], unknown: true }, 'heybox.bookmarks': [], 'heybox.history': [] };

  const post = { id: 1, userId: '12345', author: '图片盒友', avatar: '图', avatarUrl: '', color: '#ddd', time: '刚刚', title: '信息流帖子', excerpt: '查看作者主页', body: ['测试正文'], topicIds: [], topics: [], likes: 1, comments: 1, images: [], level: 14, medalUrl: '', medalName: '', liked: false, createdAt: 0, videoUrl: '', isCy: false };
  const mk = (id, title, images) => ({ ...post, id, title, images, excerpt: `${title} 摘要` });
  const posts = [
    mk(11, '单图帖子', [url('uh-normal-1.svg')]),
    mk(12, '两图帖子', [url('uh-normal-2.svg'), url('uh-wide.svg')]),
    mk(13, '三图帖子', [url('uh-normal-3.svg'), url('uh-tall.svg'), url('uh-tiny.svg')]),
    mk(14, '单图超窄长图帖子', [url('uh-tall.svg')]),
    mk(15, '三图全极端帖子', [url('uh-wide.svg'), url('uh-tall.svg'), url('uh-tiny.svg')]),
  ];

  const unexpected = [];
  await page.route('**/uh-*.svg', route => {
    const name = route.request().url().split('/').pop().split('?')[0];
    const body = IMAGES[name];
    if (!body) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing' });
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body });
  });
  await page.route('**/api/command', async route => {
    const r = route.request().postDataJSON();
    let data;
    switch (r.type) {
      case 'bootstrap': data = { account: { id: '99999', name: '测试账号', avatarUrl: '' }, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[r.payload.key] ?? null; break;
      case 'stateSet': data = states[r.payload.key] = r.payload.value, true; break;
      case 'communities': data = []; break;
      case 'emojis': data = { version: 'synthetic', emojis: [] }; break;
      case 'feed': data = { posts: [{ ...post, userId: '' }], cursor: { offset: 30, topics: {}, exhausted: [], rotation: 0 }, hasMore: false }; break;
      case 'detail': data = { post: posts[0], comments: [], page: 1, hasMore: false, isCy: false }; break;
      case 'profile': data = { id: r.payload.id, name: '图片盒友', avatarUrl: '', level: 14, bio: '主业配图验证' }; break;
      case 'userPosts': data = { posts, hasMore: false, lastval: '1.2' }; break;
      default: unexpected.push(r.type); data = null;
    }
    await route.fulfill({ json: { ok: true, data } });
  });

  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  const measure = () => page.evaluate(() => {
    const inner = document.querySelector('.window-inner');
    const scale = inner && inner.offsetWidth ? inner.getBoundingClientRect().width / inner.offsetWidth : 1;
    return {
      scale,
      zoomControlText: document.querySelector('.zoom-control')?.textContent ?? null,
      storedZoom: JSON.parse(localStorage.getItem('heybox.preferences') ?? '{}').zoom ?? null,
      innerOffsetWidth: inner ? inner.offsetWidth : null,
      rows: [...document.querySelectorAll('.user-home-images')].map(row => {
        const card = row.closest('.user-home-post');
        const cardStyle = getComputedStyle(card);
        const rowStyle = getComputedStyle(row);
        const rowWidth = row.getBoundingClientRect().width / scale;
        const cardContent = card.getBoundingClientRect().width / scale - parseFloat(cardStyle.paddingLeft) - parseFloat(cardStyle.paddingRight);
        return {
          title: card.querySelector('h2')?.textContent ?? '',
          rowClass: row.className,
          display: rowStyle.display,
          gridColumns: rowStyle.gridTemplateColumns,
          rowWidth,
          cardContent,
          cardOverflow: card.scrollWidth - card.clientWidth,
          images: [...row.querySelectorAll('img')].map(image => {
            const rect = image.getBoundingClientRect();
            return {
              src: image.getAttribute('src'),
              width: rect.width / scale,
              height: rect.height / scale,
              objectFit: getComputedStyle(image).objectFit,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
            };
          }),
        };
      }),
    };
  });

  const openProfile = async () => {
    await page.getByRole('button', { name: '查看 图片盒友 的资料' }).click();
    await page.getByRole('heading', { name: '盒友主页', exact: true }).waitFor();
    await page.getByRole('heading', { name: '单图帖子', exact: true }).waitFor();
  };

  const failures = [];
  const zoomReport = [];

  // `zoom` only scales the app visually (transform on .window-inner), while the CSS
  // layout width is always prefs.windowWidth. Narrow widths are therefore the case that
  // can actually cause reflow overflow, so both levers are swept.
  const scenarios = [
    { zoom: 100, windowWidth: 720 },
    { zoom: 50, windowWidth: 720 },
    { zoom: 150, windowWidth: 720 },
    { zoom: 100, windowWidth: 360 },
    { zoom: 100, windowWidth: 1280 },
  ];

  for (const { zoom, windowWidth } of scenarios) {
    preferences.zoom = zoom;
    preferences.windowWidth = windowWidth;
    states['heybox.preferences'] = { ...preferences };
    // addInitScript snapshots its argument at registration time, so register a fresh
    // snapshot per scenario (the last one registered wins on each navigation).
    await page.addInitScript(saved => { for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, JSON.stringify(value)); }, { ...states, 'heybox.preferences': { ...preferences } });
    await page.goto(`${ORIGIN}/`);
    await page.locator('.post-list').waitFor();
    await openProfile();
    await page.waitForFunction(() => [...document.querySelectorAll('.user-home-images img')].every(image => image.complete && image.naturalWidth > 0));
    const { scale, zoomControlText, storedZoom, innerOffsetWidth, rows } = await measure();

    if (rows.length !== 5) throw new Error(`Expected 5 image rows, got ${rows.length}`);
    // Guard the harness itself: a scenario that never reached the app would make the
    // whole sweep vacuous.
    if (storedZoom !== zoom || zoomControlText !== `${zoom}%`) throw new Error(`Zoom ${zoom}% did not reach the app: stored=${storedZoom} control=${zoomControlText}`);
    if (innerOffsetWidth !== windowWidth) throw new Error(`windowWidth ${windowWidth} did not reach the app: layout width=${innerOffsetWidth}`);
    const label0 = `zoom${zoom}/width${windowWidth}`;
    const report = { zoom, windowWidth, scale: Number(scale.toFixed(4)), zoomControlText, layoutWidth: innerOffsetWidth, rows: [] };

    for (const row of rows) {
      const label = `${row.title} @${label0}`;
      // (a) the row must fill the card, never shrink to a content width like 100px.
      if (row.display !== 'grid') throw new Error(`${label}: display=${row.display}, expected grid`);
      if (Math.abs(row.rowWidth - row.cardContent) > 1) throw new Error(`${label}: row width ${row.rowWidth} != card content width ${row.cardContent}`);
      if (row.rowWidth < 200) throw new Error(`${label}: row collapsed to ${row.rowWidth}px`);
      // Nothing may overflow the card horizontally at any layout width.
      if (row.cardOverflow > 1) throw new Error(`${label}: card content overflows by ${row.cardOverflow}px`);

      const single = row.images.length === 1;
      // (b) single-image row: 255x120 CSS px (clamped by the card width).
      if (single) {
        const expectedWidth = Math.min(255, row.cardContent);
        if (Math.abs(row.images[0].width - expectedWidth) > 1) throw new Error(`${label}: single image width ${row.images[0].width} != ${expectedWidth}`);
        if (Math.abs(row.images[0].height - 120) > 1) throw new Error(`${label}: single image height ${row.images[0].height} != 120`);
      } else {
        // (c) 2- and 3-image rows share the same 3-column grid: each column is (row - 2*gap)/3.
        const expected = (row.rowWidth - 2 * GAP) / 3;
        for (const image of row.images) {
          if (Math.abs(image.width - expected) > 1) throw new Error(`${label}: image width ${image.width} != ${expected} (row ${row.rowWidth})`);
          if (Math.abs(image.height - 106) > 1) throw new Error(`${label}: image height ${image.height} != 106`);
        }
      }

      for (const image of row.images) {
        // (d) regression lock: nothing may ever be narrower than a quarter of the row.
        if (image.width < row.rowWidth * 0.25) throw new Error(`${label}: image ${image.width}px is below 25% of the ${row.rowWidth}px row`);
        if (image.objectFit !== 'cover') throw new Error(`${label}: object-fit=${image.objectFit}, expected cover`);
        if (!image.naturalWidth) throw new Error(`${label}: image did not load (${image.src})`);
        // An extreme source aspect must still fill its grid cell because of
        // object-fit: cover: the rendered width must track the cell, not the intrinsic
        // width (a 60x900 source must not become a 60px-wide strip).
        const intrinsic = image.naturalWidth / image.naturalHeight;
        if (intrinsic < 0.25 || intrinsic > 4) {
          const cell = single ? Math.min(255, row.cardContent) : (row.rowWidth - 2 * GAP) / 3;
          if (Math.abs(image.width - cell) > 1) throw new Error(`${label}: extreme source (${image.naturalWidth}x${image.naturalHeight}) rendered ${image.width}px instead of its ${cell}px cell`);
          if (Math.abs(image.height - (single ? 120 : 106)) > 1) throw new Error(`${label}: extreme source box height ${image.height} collapsed`);
        }
      }

      const totalImages = row.images.reduce((sum, image) => sum + image.width, 0) + (row.images.length - 1) * GAP;
      if (totalImages > row.rowWidth + 1) throw new Error(`${label}: images overflow the row (${totalImages} > ${row.rowWidth})`);

      report.rows.push({ title: row.title, rowWidth: Number(row.rowWidth.toFixed(2)), cardContent: Number(row.cardContent.toFixed(2)), columns: row.gridColumns, widths: row.images.map(image => Number(image.width.toFixed(2))), heights: row.images.map(image => Number(image.height.toFixed(2))) });
    }
    zoomReport.push(report);
  }

  // (e) the image row is still a control that opens its post, and returning restores the profile.
  await page.getByRole('heading', { name: '单图帖子', exact: true }).waitFor();
  await page.locator('.user-home-post').filter({ hasText: '单图帖子' }).locator('.user-home-images').click();
  await page.locator('.post-detail').waitFor();
  await page.getByRole('heading', { name: '单图帖子', exact: true }).waitFor();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await page.getByRole('heading', { name: '盒友主页', exact: true }).waitFor();
  await page.getByRole('heading', { name: '单图帖子', exact: true }).waitFor();

  // The row must remain an accessible button labelled for its post.
  const label = await page.locator('.user-home-post').filter({ hasText: '两图帖子' }).locator('.user-home-images').getAttribute('aria-label');
  if (label !== '打开 两图帖子 的帖子') throw new Error(`Image row aria-label changed: ${JSON.stringify(label)}`);

  await page.screenshot({ path: 'output/playwright/userhome-images.png' });
  if (unexpected.length) throw new Error(`Unexpected commands: ${unexpected.join(',')}`);
  if (errors.length) throw new Error(errors.join(';'));
  if (failures.length) throw new Error(failures.join('; '));
  return {
    rowFillsCardAtEveryZoom: true,
    singleImage255x120: true,
    multiImageThirdsWith106Height: true,
    noImageBelowQuarterRow: true,
    extremeAspectStillCovered: true,
    imageRowStillOpensPost: true,
    noUnexpectedCommands: true,
    zoomReport,
  };
}
