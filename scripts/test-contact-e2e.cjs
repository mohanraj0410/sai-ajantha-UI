const playwright = require('playwright');

async function runTest() {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  console.log('Navigating to http://localhost:3000/contact...');
  await page.goto('http://localhost:3000/contact', { waitUntil: 'networkidle' });

  // 1. Verify H1
  const h1 = await page.textContent('h1');
  console.log('H1 verified:', h1.replace(/\s+/g, ' ').trim());

  // 2. Click purpose buttons
  await page.click('button:has-text("Sample Kit")');
  console.log('Sample Kit clicked');
  await page.click('button:has-text("Site Consultation")');
  console.log('Site Consultation clicked');
  await page.click('button:has-text("Dealer / Trade Desk")');
  console.log('Dealer / Trade Desk clicked');
  await page.click('button:has-text("BOQ")');
  console.log('BOQ clicked');

  // 3. Trigger validation
  await page.click('button[type="submit"]');
  const alert = await page.textContent('text=Please fill in all required fields');
  console.log('Validation alert visible:', !!alert);

  // 4. Fill form
  await page.fill('#full-name', 'Arun Kumar');
  await page.selectOption('#user-role', 'Architect / Designer');
  await page.fill('#company-org', 'Studio Arch Designs');
  await page.fill('#city-district', 'Trichy');
  await page.fill('#phone-number', '9842406588');
  await page.fill('#email-address', 'arun@studioarch.com');
  await page.selectOption('#service-product', 'Aluminium Sections & Extrusions');
  await page.fill('#user-notes', 'Testing BOQ consultation request form submission.');

  // Submit form
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  const successTitle = await page.textContent('text=Consultation Request Submitted!');
  console.log('Success state rendered:', !!successTitle);

  await browser.close();
}

runTest().catch(console.error);
