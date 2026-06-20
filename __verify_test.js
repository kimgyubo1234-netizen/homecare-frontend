const { chromium } = require('./node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  const ss = (name) => page.screenshot({ path: `C:\\Users\\lg1\\AppData\\Local\\Temp\\verify-screenshots\\${name}.png` });

  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  // 1. 빈 폼 제출
  await page.click('button[type="submit"]');
  await page.waitForTimeout(400);
  await ss('03-login-validation');
  console.log('validation OK');

  // 2. 잘못된 이메일 형식
  await page.fill('input[type="email"]', 'notanemail');
  await page.fill('input[type="password"]', 'test');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(400);
  await ss('04-login-email-error');
  console.log('email error OK');

  // 3. 잘못된 자격증명
  await page.fill('input[type="email"]', 'wrong@test.com');
  await page.fill('input[type="password"]', 'wrongpassword');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  await ss('05-login-wrong-creds');
  console.log('wrong creds OK');

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
