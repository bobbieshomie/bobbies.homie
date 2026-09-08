const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function generateIcons() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();

  // HTML template for the 180x180 Apple Touch Icon
  // iOS icon safe zone: 180x180 square, no transparent edges.
  // Bear icon is centered with 25% padding so iOS squircle mask doesn't touch it.
  const createHtml = (size) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: ${size}px;
          height: ${size}px;
          background: #FDFBF7;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .container {
          width: 100%;
          height: 100%;
          background: linear-gradient(145deg, #FDFBF7 0%, #F5EBE6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .inner-badge {
          width: ${Math.round(size * 0.78)}px;
          height: ${Math.round(size * 0.78)}px;
          background: #F4EFEA;
          border: ${Math.max(1, Math.round(size * 0.015))}px solid #D7CCC8;
          border-radius: ${Math.round(size * 0.24)}px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 ${Math.round(size * 0.03)}px ${Math.round(size * 0.08)}px rgba(93, 64, 55, 0.08);
        }
        svg {
          width: ${Math.round(size * 0.52)}px;
          height: ${Math.round(size * 0.52)}px;
          fill: #5D4037;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="inner-badge">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.5 2C19.9853 2 22 4.01472 22 6.5C22 7.85621 21.4001 9.07229 20.4511 9.89732C20.8061 10.8644 21 11.9096 21 13C21 17.9706 16.9706 22 12 22C7.02944 22 3 17.9706 3 13C3 11.9096 3.19392 10.8644 3.54916 9.8972C2.59995 9.07229 2 7.85621 2 6.5C2 4.01472 4.01472 2 6.5 2C8.12553 2 9.54976 2.86189 10.3406 4.15362C10.8774 4.05251 11.4326 4 12 4C12.5674 4 13.1226 4.05251 13.6609 4.15294C14.4502 2.86189 15.8745 2 17.5 2ZM10 13H8C8 15.2091 9.79086 17 12 17C14.2091 17 16 15.2091 16 13H14C14 14.1046 13.1046 15 12 15C10.8954 15 10 14.1046 10 13Z"/>
          </svg>
        </div>
      </div>
    </body>
    </html>
  `;

  const publicDir = path.resolve(__dirname, '..', 'public');
  const appDir = path.resolve(__dirname, '..', 'src', 'app');

  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  // 1. Generate 180x180 for Apple Touch Icon
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(createHtml(180));
  const appleIconPath1 = path.join(publicDir, 'apple-touch-icon.png');
  const appleIconPath2 = path.join(appDir, 'apple-icon.png');
  await page.screenshot({ path: appleIconPath1, type: 'png' });
  await page.screenshot({ path: appleIconPath2, type: 'png' });
  console.log(`[ICON] Created ${appleIconPath1}`);
  console.log(`[ICON] Created ${appleIconPath2}`);

  // 2. Generate 192x192 and 512x512 for PWA & web manifest
  await page.setViewportSize({ width: 192, height: 192 });
  await page.setContent(createHtml(192));
  const icon192 = path.join(publicDir, 'icon-192.png');
  await page.screenshot({ path: icon192, type: 'png' });
  console.log(`[ICON] Created ${icon192}`);

  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(createHtml(512));
  const icon512 = path.join(publicDir, 'icon-512.png');
  await page.screenshot({ path: icon512, type: 'png' });
  console.log(`[ICON] Created ${icon512}`);

  await browser.close();
  console.log('[ICON] All icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
