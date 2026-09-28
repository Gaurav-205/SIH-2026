const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
// Run only against a disposable backend database, never a production service.
if (process.env.BHAROSA_TEST_ACCOUNTS !== '1') throw new Error('Set BHAROSA_TEST_ACCOUNTS=1 with a disposable backend database.');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const base = process.env.BHAROSA_BASE_URL || 'http://127.0.0.1:5173';
    const email = `browser-${Date.now()}@example.test`;
    const password = 'BrowserTest123!';
    const updatedPassword = 'UpdatedBrowser456!';
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/signup');
    await page.getByLabel('Full name').fill('Browser Test');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL('**/welcome');
    await page.goto(base + '/app/settings');
    await page.waitForURL('**/welcome');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('radio', { name: /^Kerala/ }).click();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Go to dashboard' }).click();
    await page.waitForURL('**/app');
    assert.equal(await page.getByRole('combobox', { name: 'Region', exact: true }).inputValue(), 'kerala');
    await page.goto(base + '/app/settings');
    await page.getByRole('radio', { name: 'Dark', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    await page.getByLabel('Full name').fill('Verified Browser Test');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('bharosa.session')).state.user.name === 'Verified Browser Test');
    await page.getByLabel('Current password', { exact: true }).fill(password);
    await page.getByLabel('New password', { exact: true }).fill(updatedPassword);
    await page.getByLabel('Confirm new password', { exact: true }).fill(updatedPassword);
    const changed = page.waitForResponse(r => r.url().endsWith('/users/me/password') && r.status() === 204);
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await changed;
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.goto(base + '/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(updatedPassword);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.waitForURL('**/app');
    await page.goto(base + '/app/settings');
    assert.equal(await page.getByLabel('Full name').inputValue(), 'Verified Browser Test');
    await page.getByRole('button', { name: 'Delete account…' }).click();
    await page.getByLabel('Confirm with your password').fill(updatedPassword);
    const deleted = page.waitForResponse(r => r.url().endsWith('/users/me/delete') && r.status() === 204);
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await deleted;
    assert.deepEqual(errors, []);
    console.log('PASS: real signup, onboarding guard, preferences, dark theme, profile, password change, sign out, login, and test-account deletion. No uncaught errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
