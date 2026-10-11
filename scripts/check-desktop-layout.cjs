// Run against a desktop WebView attached with Playwright CLI:
// playwright-cli -s=desktop run-code --filename=scripts/check-desktop-layout.cjs
async (page) => {
  const bounds = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
    };
    return {
      native: !!window.__TAURI_INTERNALS__,
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      window: box('.desktop-window'),
      close: box('.close-control'),
      zoom: box('.zoom-control'),
      content: box('.content-scroll'),
      padding: getComputedStyle(document.querySelector('.desktop-stage')).padding,
    };
  });
  if (!bounds.native) throw new Error('Attach to the desktop WebView before checking layout.');
  const { width, height } = bounds.viewport;
  const failures = [];
  if (bounds.padding !== '0px') failures.push(`Desktop padding is ${bounds.padding}`);
  if (bounds.document.width > width + 1 || bounds.document.height > height + 1) failures.push('Document overflows the desktop viewport');
  if (Math.abs(bounds.window.x) > 1 || Math.abs(bounds.window.y) > 1) failures.push('Desktop window is inset');
  if (bounds.close.right > width + 1 || bounds.close.x < 0 || bounds.close.bottom > height + 1) failures.push('Close button is clipped');
  if (bounds.zoom.right > width + 1 || bounds.zoom.bottom > height + 1 || bounds.zoom.x < 0 || bounds.zoom.y < 0) failures.push('Zoom control is clipped');
  if (Math.abs(bounds.content.bottom - height) > 1) failures.push('Content does not fill the viewport');
  if (failures.length) throw new Error(JSON.stringify({ failures, bounds }));
  return bounds;
}
