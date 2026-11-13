// Isolated unit tests for the SaaS expansion (sections 19–27). No network, no Supabase, no Google.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, require: n => { if (n in mocks) return mocks[n]; throw Error(`Unexpected dependency ${n}`); }, Date, console });
  return exports;
}

const rules = load('src/lib/platform/subscription-rules.ts');
const permissions = load('src/lib/platform/permissions.ts');
const healthRules = load('src/lib/platform/health-rules.ts', { './subscription-rules': rules });
const notificationRules = load('src/lib/platform/notification-rules.ts');
const reports = load('src/lib/platform/report-rules.ts');
const makeOrder = (patch = {}) => ({ id: 'o', storeId: 'a', createdAt: '2026-11-07T18:00:00Z', orderStatus: 'delivered', paymentStatus: 'paid', totalAmount: 100, customerPhone: '1', items: [{ productId: 'p', productName: 'Product', quantity: 2, unitPrice: 50 }], ...patch });

test('future roles are modelled but denied; store admin limited to own store', () => {
  const p = permissions;
  const sa = { role: 'store_admin', storeId: 'a', isSuperAdmin: false };
  assert.equal(p.hasPermission({ ...sa, role: 'store_manager' }, 'orders.read', 'a'), false);
  assert.equal(p.hasPermission({ ...sa, role: 'store_staff' }, 'orders.read', 'a'), false);
  assert.equal(p.hasPermission(sa, 'customers.read', 'a'), true);
  assert.equal(p.hasPermission({ ...sa, storeId: null }, 'customers.read', 'a'), false);
  assert.equal(p.hasPermission({ role: 'super_admin', storeId: null, isSuperAdmin: true }, 'settings.manage', 'any'), true);
  assert.ok(p.ROLE_PERMISSIONS.store_staff.every(x => p.STORE_PERMISSIONS.includes(x)));
  assert.equal(p.ROLE_PERMISSIONS.store_manager.includes('settings.manage'), false);
  assert.throws(() => p.assertPermission(sa, 'orders.manage', 'b'));
});

test('health status never reports healthy from configuration alone', () => {
  const now = Date.parse('2026-11-08T12:00:00Z');
  assert.equal(healthRules.currentStoreHealth([], false, now).status, 'disconnected');
  assert.equal(healthRules.currentStoreHealth([], true, now).status, 'unknown');
  const fresh = { store_id: 'a', component: 'sheets', status: 'healthy', code: 'connection_verified', checked_at: '2026-11-08T11:50:00Z' };
  assert.equal(healthRules.currentStoreHealth([fresh], true, now).status, 'healthy');
  const stale = { ...fresh, checked_at: '2026-11-08T10:00:00Z' };
  const r = healthRules.currentStoreHealth([stale], true, now);
  assert.equal(r.status, 'warning'); assert.equal(r.stale, true);
  assert.equal(healthRules.currentStoreHealth([stale, { ...fresh, status: 'error', code: 'connection_failed' }], true, now).status, 'error');
  assert.equal(healthRules.overallStatus(['healthy', 'warning', 'error']), 'error');
  assert.equal(healthRules.overallStatus([]), 'unknown');
  assert.deepEqual({ ...healthRules.summarizeStatuses(['healthy', 'healthy', 'error']) }, { healthy: 2, warning: 0, error: 1, disconnected: 0, unknown: 0 });
});

test('subscription consistency flags orphans, missing plans, blocked active stores and unassigned stores', () => {
  const now = Date.parse('2026-11-08T00:00:00Z');
  const stores = [{ id: 'a', status: 'active' }, { id: 'b', status: 'active' }, { id: 'c', status: 'active' }];
  const plans = [{ id: 'basic', max_products: 10, max_orders: null, storage_bytes: null }];
  const sub = (store_id, plan_id, expires_at) => ({ store_id, plan_id, status: 'active', starts_at: '2026-01-01T00:00:00Z', expires_at });
  const codes = JSON.parse(JSON.stringify(healthRules.subscriptionConsistency(stores, [sub('a', 'basic', '2026-10-01T00:00:00Z'), sub('b', 'ghost', '2027-01-01T00:00:00Z'), sub('zz', 'basic', '2027-01-01T00:00:00Z')], plans, now).map(i => `${i.storeId}:${i.code}`).sort()));
  assert.deepEqual(codes, ['a:active_store_blocked', 'b:plan_missing', 'c:unassigned_plan', 'zz:orphan_subscription']);
});

test('notification titles are readable; failures labelled; only subscription events reach stores', () => {
  const n = notificationRules;
  assert.equal(n.auditNotification('product.updated'), null);
  assert.equal(n.auditNotification('store.created').title, 'Шинэ дэлгүүр бүртгэгдлээ');
  assert.match(n.auditNotification('admin.create', { status: 'failed' }).title, /амжилтгүй$/);
  assert.equal(n.auditNotification('backup.failed', { status: 'failed' }).title, 'Backup амжилтгүй боллоо');
  assert.equal(n.auditNotification('admin.update', { before: { active: true }, after: { active: false } }).title, 'Store Admin account идэвхгүй боллоо');
  assert.equal(n.auditNotification('subscription.extended').storeVisible, true);
  assert.equal(n.auditNotification('subscription.extended', { status: 'failed' }).storeVisible, false);
  for (const a of ['store.sheets_updated', 'sheets.disconnected', 'backup.created', 'domain.verification_failed', 'admin.revoke']) assert.equal(n.auditNotification(a).storeVisible, false, a);
  assert.equal(n.auditNotification('store.sheets_updated').category, 'sheets');
});

test('notification reads are scoped server-side to the assigned store and audience', async () => {
  const calls = [];
  const builder = () => { const q = { select() { return q; }, eq(k, v) { calls.push([k, v]); return q; }, order() { return q; }, range: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: null, error: null }), upsert: async () => ({ error: null }) }; return q; };
  const svc = load('src/lib/platform/notifications.ts', { 'server-only': {}, './db': { checked: r => r, platformDb: () => ({ from: () => builder() }), platformEnabled: () => true }, './notification-rules': notificationRules });
  await svc.notificationPage({ id: '00000000-0000-4000-8000-000000000001', isSuperAdmin: false, role: 'store_admin', storeId: 'store-a' });
  assert.ok(calls.some(([k, v]) => k === 'store_id' && v === 'store-a'));
  assert.ok(calls.some(([k, v]) => k === 'audience' && v === 'store'));
  calls.length = 0;
  await svc.notificationPage({ id: '00000000-0000-4000-8000-000000000002', isSuperAdmin: true, role: 'super_admin' });
  assert.equal(calls.some(([k]) => k === 'store_id' || k === 'audience'), false);
  await assert.rejects(svc.notificationPage({ id: '00000000-0000-4000-8000-000000000001', isSuperAdmin: false, role: 'store_admin', storeId: null }), /No store assignment/);
  await assert.rejects(svc.publishNotification({ key: 'k', storeId: null, category: 'order', title: 't', audience: 'store' }), /requires a store/);
});

test('store analytics: status distribution, customer activity, product share and inventory', () => {
  const o = (id, patch) => makeOrder({ id, ...patch });
  const r = reports.aggregateReport([
    o('1', { customerPhone: 'A', createdAt: '2026-10-01T02:00:00Z' }),
    o('2', { customerPhone: 'A' }),
    o('3', { customerPhone: 'B', orderStatus: 'cancelled' }),
    o('4', { customerPhone: 'C', orderStatus: 'new', paymentStatus: 'unpaid', items: [{ productId: 'q', productName: 'Q', quantity: 1, unitPrice: 300 }] }),
  ], [{ id: 'p', name: 'P', stock: 0, isActive: true }, { id: 'z', name: 'Z', stock: 3, isActive: true }, { id: 'w', name: 'W', stock: 50, isActive: true }], '2026-11-01', '2026-11-30', 'daily');
  assert.equal(r.orders, 3);
  assert.deepEqual(Object.fromEntries(r.statusBreakdown.map(s => [s.status, s.count])), { new: 1, confirmed: 0, processing: 0, shipped: 0, delivered: 1, cancelled: 1 });
  // A ordered before the range → not new; B and C are first-time customers in range.
  assert.equal(r.customerActivity.active, 3);
  assert.equal(r.customerActivity.newCustomers, 2);
  assert.equal(r.customerActivity.returning, 0);
  assert.equal(r.topProducts.length, 1); assert.equal(r.topProducts[0].share, 1);
  assert.equal(r.lowStock, 1); assert.equal(r.outOfStock, 1); assert.equal(r.unsoldProducts, 2);
});

test('platform comparison never sums revenue across currencies', () => {
  const d = (revenue, orders) => ({ ...reports.aggregateReport([], [], '2026-01-01', '2026-01-01', 'daily'), revenue, orders });
  const c = reports.compareStores([{ id: 'a', name: 'A', currency: 'MNT', data: d(300, 3) }, { id: 'b', name: 'B', currency: 'MNT', data: d(100, 1) }, { id: 'c', name: 'C', currency: 'USD', data: d(50, 0) }]);
  assert.deepEqual(JSON.parse(JSON.stringify(c.totals.map(t => [t.currency, t.revenue]).sort())), [['MNT', 400], ['USD', 50]]);
  assert.equal(c.rows.find(r => r.id === 'a').revenueShare, 0.75);
  assert.equal(c.rows.find(r => r.id === 'c').revenueShare, 1);
  assert.equal(c.activeStores, 2); assert.equal(c.idleStores, 1);
});

test('subscription extension never back-dates an expired plan; limits come from plan config', () => {
  const now = Date.parse('2026-11-08T00:00:00Z');
  assert.equal(rules.extendExpiry('2026-10-01T00:00:00Z', 30, now), '2026-12-08T00:00:00.000Z');
  assert.equal(rules.extendExpiry('2026-12-01T00:00:00Z', 30, now), '2026-12-31T00:00:00.000Z');
  assert.equal(rules.usageLimit({ max_products: 5, max_orders: null, max_admins: 1, storage_bytes: 9 }, 'orders'), null);
  assert.equal(rules.usageLimit(null, 'products'), null);
  assert.deepEqual([...rules.PLAN_IDS], ['basic', 'pro', 'business']);
});
