/* 공유 카드(og:image) 생성. build/og-card.html 을 1200×630 으로 찍어 og.png 를 만든다.
 *   node build/make_og.js
 * Playwright 가 있어야 한다. 카드 문구는 og-card.html 에서 고친다. */
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright');

(async () => {
  const src = 'file://' + path.resolve(__dirname, 'og-card.html');
  const out = path.resolve(__dirname, '..', 'og.png');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto(src, { waitUntil: 'networkidle' });
  await p.screenshot({ path: out });
  await b.close();
  console.log('생성:', out);
})();
