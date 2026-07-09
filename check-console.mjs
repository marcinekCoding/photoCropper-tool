import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const port of [5173, 5174]) {
  const page = await browser.newPage();
  const messages = [];
  page.on('console', (msg) => messages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => messages.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) =>
    messages.push(`[requestfailed] ${req.url()} - ${req.failure()?.errorText}`),
  );

  try {
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0', timeout: 15000 });
    const rootText = await page.$eval('#root', (el) => el.innerHTML.trim());
    const rootInner = await page.$eval('#root', (el) => el.innerText.trim().slice(0, 200));

    console.log(`\n=== PORT ${port} ===`);
    console.log('ROOT HTML length:', rootText.length);
    console.log('ROOT text:', rootInner || '(empty)');
    console.log('--- console ---');
    for (const m of messages) console.log(m);
  } catch (err) {
    console.log(`\n=== PORT ${port} FAIL ===`, err.message);
  }

  await page.close();
}

await browser.close();
