import { test, expect, type BrowserContext } from '@playwright/test';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
const owner = '00000000-0000-4000-8000-000000000001';
async function login(context: BrowserContext, id = owner) {
 const jwt = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now()/1000)+7200 })).toString('base64url') + '.synthetic-qa-signature';
 let cookieValues: Array<{ name: string; value: string; options?: CookieOptions }> = [];
 const client = createServerClient('http://127.0.0.1:43219', 'qa-anonymous-key', { cookies: { getAll: () => [], setAll: (cookies: Array<{ name: string; value: string; options?: CookieOptions }>) => { cookieValues = cookies; } } });
 await client.auth.setSession({ access_token: jwt, refresh_token: 'qa-refresh-token' });
 await context.addCookies(cookieValues.map(c => ({ name: c.name, value: c.value, domain: 'localhost', path: '/', httpOnly: false, sameSite: 'Lax' as const })));
}
const cases = [ ['online_store','products','name'], ['restaurant','menu','name'], ['service_business','services','name'], ['business_profile','pages','title'], ['portfolio','projects','title'] ];
for (const [site, resource, titleField] of cases) test(`${site}: authenticated create/edit/delete and site-scoped published reads`, async ({ page, context }) => {
 await login(context); await context.addCookies([{ name: 'axora_active_site', value: site, domain: 'localhost', path: '/' }]);
 await page.goto('/store-admin/' + resource); await expect(page.getByTestId('module-' + resource)).toBeVisible();
 const form = page.locator('main form');
 const fill = async (name: string, value: string) => { const input = form.locator('[name="' + name + '"]'); if (await input.count()) await input.fill(value); };
 await fill(titleField, 'QA browser content'); await fill('slug', 'qa-browser'); await fill('description', 'QA description'); await fill('body','QA body'); await fill('price','1500'); await fill('stock','4'); await fill('durationMinutes','30');
 if (await form.locator('[name="status"]').count()) await form.locator('[name="status"]').selectOption('published');
 await form.getByRole('button', { name: 'Хадгалах', exact: true }).click();
 await expect(page.locator('article').filter({ hasText: 'QA browser content' })).toBeVisible();
 const article = page.locator('article').filter({ hasText: 'QA browser content' }); const id = await article.getAttribute('data-record-id');
 await article.getByRole('button', { name: 'Засах' }).click(); await fill(titleField, 'QA edited content'); await form.getByRole('button', { name: 'Хадгалах', exact: true }).click();
 await expect(page.locator('article').filter({ hasText: 'QA edited content' })).toBeVisible();
 const published = await page.request.get('/api/public/site-data/' + resource, { headers: { Origin: 'https://' + site.replaceAll('_','-') + '.example.test' } }); expect(published.status()).toBe(200); expect((await published.json()).data.some((row: Record<string,unknown>) => row.id === id && row[titleField] === 'QA edited content')).toBe(true);
 const foreign = await page.request.get('/api/admin/site-data/' + resource + '?siteId=foreign'); expect(foreign.status()).toBe(403);
 for (const width of [375,768,1440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
 page.once('dialog', d => d.accept()); await page.locator('article').filter({ hasText: 'QA edited content' }).getByRole('button', { name: 'Устгах' }).click(); await expect(page.locator('article')).toHaveCount(0);
 const links = await page.getByRole('navigation', { name: 'Сайтын удирдлагын цэс' }).locator('a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')!));
 for (const href of links) { const response = await page.request.get(href); expect(response.status(), href).toBe(200); }
 const html = await page.content(); expect(html).not.toContain('qa-service-key'); expect(html).not.toContain('qa-billing-token');
});
test('site switching, AXORA billing and viewer permissions', async ({ page, context }) => {
 await login(context); await page.goto('/store-admin'); const switcher = page.locator('header form').filter({ has: page.locator('select[name="siteId"]') }); await switcher.locator('select').selectOption('portfolio'); await switcher.getByRole('button', { name: 'Сонгох' }).click(); await expect(page.getByRole('banner').locator('p')).toContainText('QA portfolio'); await expect(page.locator('h1')).toHaveText('QA portfolio');
 await page.goto('/store-admin/subscription'); await expect(page.locator('main')).toContainText('228,000'); await expect(page.locator('main')).toContainText('20,000');
 const stale = await page.request.get('/api/admin/site-data/products?siteId=online_store'); expect(stale.status()).toBe(403);
});
test('viewer sees read-only UI and API denies writes; anonymous API denied', async ({ page, context, browser }) => {
 await login(context, '00000000-0000-4000-8000-000000000003'); await page.goto('/store-admin/products'); await expect(page.locator('main')).toContainText('зөвхөн харах эрхтэй');
 const result = await page.request.post('/api/admin/site-data/products?siteId=online_store', { headers: { Origin: 'http://localhost:43220' }, data: { payload: {}, idempotencyKey: '00000000-0000-4000-8000-000000000009' } }); expect(result.status()).toBe(403);
 const anonymous = await browser.newContext(); const response = await anonymous.request.get('http://localhost:43220/api/admin/site-data/products'); expect(response.status()).toBe(401); await anonymous.close();
});
