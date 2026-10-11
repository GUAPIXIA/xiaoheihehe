// Playwright CLI: run-code --filename=scripts/check-qr-login.cjs
// Synthetic responses only; never signs into or writes to a real account.
async (page) => {
  let account = null;
  let polls = 0;
  let cancels = 0;
  const states = {};
  await page.route('https://avatar.example.test/avatar.svg', route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="blue"/></svg>',
  }));
  await page.route('**/api/command', async route => {
    const request = route.request().postDataJSON();
    let data = null;
    switch (request.type) {
      case 'bootstrap': data = { account, states, dataDirectory: 'synthetic-test' }; break;
      case 'stateGet': data = states[request.payload.key] ?? null; break;
      case 'stateSet': states[request.payload.key] = request.payload.value; data = true; break;
      case 'communities': data = []; break;
      case 'feed': data = { posts: [], hasMore: false, cursor: { offset: 0, topics: {}, exhausted: [], rotation: 0 } }; break;
      case 'qrStart': data = { session: 'synthetic-qr', expiresAt: Math.floor(Date.now() / 1000) + 120, svg: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/></svg>' }; break;
      case 'qrPoll':
        polls++;
        if (polls === 1) data = { state: 'waiting' };
        else if (polls === 2) data = { state: 'scanned' };
        else { account = { id: '12345', name: '扫码回归测试', avatarUrl: 'https://avatar.example.test/avatar.svg' }; data = { state: 'success', account }; }
        break;
      case 'qrCancel': cancels++; data = true; break;
      default: throw new Error(`Unexpected command ${request.type}`);
    }
    await route.fulfill({ json: { ok: true, data } });
  });
  try {
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: '用户', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '已扫码，请在小黑盒 App 中确认' }).waitFor({ timeout: 10000 });
    await page.getByRole('heading', { name: '扫码回归测试' }).waitFor({ timeout: 10000 });
    await page.waitForFunction(() => ['当前用户头像', '用户头像'].every(alt => {
      const image = document.querySelector(`img[alt="${alt}"]`);
      return image?.complete && image.naturalWidth > 0 && image.referrerPolicy === 'no-referrer';
    }));
    if (polls !== 3) throw new Error(`Expected three polls, received ${polls}`);
    await page.getByRole('button', { name: '关闭弹窗' }).click();
    await page.getByRole('button', { name: '用户', exact: true }).click();
    await page.getByRole('heading', { name: '扫码回归测试' }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: '用户', exact: true }).click();
    await page.getByRole('heading', { name: '扫码回归测试' }).waitFor();
    await page.getByRole('img', { name: '用户头像', exact: true }).waitFor();
    return { polls, cancels, scannedContinues: true, successVisible: true, accountRestored: true, avatarsVisible: true };
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
  }
}
