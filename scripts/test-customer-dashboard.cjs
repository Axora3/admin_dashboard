const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const os = require('node:os');
const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axora-customer-test-'));
process.env.AXORA_DATA_DIR = root;
const stores = new Map(); const audits = []; const invalidations = [];
let actor;
const stubs = {
  'server-only': {},
  'next/cache': { revalidatePath: (...args) => invalidations.push(args) },
  '@/lib/config': { sheetsMode: () => 'local' },
  '@/lib/registry': { getStoreRegistry: () => ({ get: async id => stores.get(id), updateSheets: async (id, sheets) => { stores.get(id).sheets = sheets; } }) },
  '@/lib/registry/audit-store': { recordPlatformAudit: async event => audits.push(event) },
  '@/lib/data/google-repository': { invalidateStoreCache: () => {} },
  '@/lib/platform/locks': { withPlatformLock: async (_key, fn) => fn() },
  '@/lib/auth/server': { getCurrentAdmin: async () => actor },
  '@/lib/rate-limit': { rateLimit: () => ({ allowed: true }) },
  '@/lib/utils': { normalizeDomain: value => value.toLowerCase() },
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = name => {
    if (name in stubs) return stubs[name];
    if (name.endsWith('/sheets-client') || name === './sheets-client') return new Proxy({}, { get: () => () => { throw Error('Real Google access forbidden in emulator tests'); } });
    if (name.startsWith('@/')) return load(path.join('src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  };
  vm.runInNewContext(source, { module: mod, exports: mod.exports, require: req, process, console, Date, URL, Map, Set, Buffer, Request, Response, AbortSignal, Intl, fetch: (...args) => global.fetch(...args), setTimeout, clearTimeout }, { filename: file });
  return mod.exports;
}
const schemas = load('src/lib/google/schema-registry.ts');
const data = load('src/lib/customer/data.ts');
const service = load('src/lib/google/site-data-service.ts');
const access = load('src/lib/customer/access.ts');
const backend = load('src/lib/google/sheet-backend.ts');
const actorFor = (site, role = 'owner') => ({ id: '00000000-0000-4000-8000-000000000001', fullName: 'QA customer', role: 'store_admin', isSuperAdmin: false, storeId: site.id, siteRole: role });
function site(type, suffix = '') {
  const s = { id: type + suffix, slug: type + suffix, status: 'active', businessType: type, settings: { visibility: { published: true } }, sheets: { spreadsheetId: 'fixture-' + type + suffix, enabledModules: schemas.modulesForBusiness(type), configurationVersion: 1 } };
  stores.set(s.id, s); return s;
}
const cases = [
  ['online_store', 'products', { name: 'Бараа', slug: 'product', description: '', price: 1200, stock: 3 }, 'name'],
  ['restaurant', 'menu', { name: 'Кофе', description: '', price: 5000 }, 'name'],
  ['service_business', 'services', { name: 'Үйлчилгээ', durationMinutes: 30, price: 10000 }, 'name'],
  ['business_profile', 'pages', { title: 'Тухай', slug: 'about', body: 'Танилцуулга', status: 'published' }, 'title'],
  ['portfolio', 'projects', { title: 'Төсөл', slug: 'project', status: 'published' }, 'title'],
];
for (const [type, resource, payload, titleField] of cases) test(`${type}: CRUD -> file-backed Sheets emulator -> published website projection; other tenant unchanged`, async () => {
  const s = site(type); const other = site(type, '-other'); const user = actorFor(s);
  await data.prepareCustomerSchema(user, s); await data.prepareCustomerSchema(actorFor(other), other);
  const created = await data.mutateCustomerRecord(user, s, resource, 'create', { payload, idempotencyKey: 'create-key-' + type });
  const record = created.record; assert.ok(record.id); assert.equal(created.mode, 'local');
  assert.equal((await data.readCustomerModule(user, s, resource)).length, 1);
  const retry = await data.mutateCustomerRecord(user, s, resource, 'create', { payload, idempotencyKey: 'create-key-' + type }); assert.equal(retry.record.id, record.id);
  assert.equal((await service.publicRead(s, resource))[0][titleField], payload[titleField]);
  await assert.rejects(data.readCustomerModule(actorFor(other), s, resource), e => e.status === 403);
  await assert.rejects(data.mutateCustomerRecord(actorFor(s, 'viewer'), s, resource, 'update', { id: record.id, expectedUpdatedAt: record.updatedAt, payload: { [titleField]: 'No' } }), e => e.status === 403);
  const updated = (await data.mutateCustomerRecord(user, s, resource, 'update', { id: record.id, expectedUpdatedAt: record.updatedAt, payload: { [titleField]: 'Шинэчлэгдсэн' } })).record;
  assert.equal(updated.id, record.id); assert.notEqual(updated.updatedAt, record.updatedAt);
  assert.equal((await service.publicRead(s, resource))[0][titleField], 'Шинэчлэгдсэн');
  assert.equal((await data.readCustomerModule(actorFor(other), other, resource)).length, 0);
  await assert.rejects(data.mutateCustomerRecord(user, s, resource, 'update', { id: record.id, expectedUpdatedAt: record.updatedAt, payload: { [titleField]: 'stale' } }), /changed since/);
  await assert.rejects(data.mutateCustomerRecord(user, s, resource, 'delete', { id: record.id, expectedUpdatedAt: updated.updatedAt, confirmed: false }), /confirmation/);
  await data.mutateCustomerRecord(user, s, resource, 'delete', { id: record.id, expectedUpdatedAt: updated.updatedAt, confirmed: true });
  assert.equal((await service.publicRead(s, resource)).length, 0);
  const b = backend.createSheetBackend({ storeId: s.id, spreadsheetId: s.sheets.spreadsheetId, mode: 'local' });
  assert.ok((await b.readTable(schemas.schemaFor(type, resource).tab)).rows[0].values.DeletedAt);
});
test('empty enabled modules, cross-site references, protected payment fields and non-HTTPS images fail closed', async () => {
  const s = site('online_store', '-validation'); await data.prepareCustomerSchema(actorFor(s), s);
  await assert.rejects(data.mutateCustomerRecord(actorFor(s), s, 'products', 'create', { payload: { ...cases[0][2], categoryId: 'foreign-id' }, idempotencyKey: 'invalid-ref' }), e => e.status === 422);
  await assert.rejects(data.mutateCustomerRecord(actorFor(s), s, 'products', 'create', { payload: { ...cases[0][2], images: ['http://unsafe.example/a.png'] }, idempotencyKey: 'invalid-url' }), e => e.status === 422);
  await assert.rejects(data.mutateCustomerRecord(actorFor(s), s, 'orders', 'create', { payload: { paymentStatus: 'paid' }, idempotencyKey: 'fake-payment' }), e => e.status === 403);
  s.sheets.enabledModules = []; assert.throws(() => data.assertCustomerAccess(actorFor(s), s, 'products'), e => e.status === 403);
});
test('partial update preserves false defaults, schema preparation preserves business cells, header casing fails explicitly', async () => {
  const s = site('online_store', '-preserve'); const user = actorFor(s); await data.prepareCustomerSchema(user, s);
  const a = service.siteAdapter(s, 'products'); const r = await a.create({ ...cases[0][2], isActive: false }, 'preserve-key');
  const b = backend.createSheetBackend({ storeId: s.id, spreadsheetId: 'fixture', mode: 'local' });
  await b.ensureColumns('Products', ['CustomerCustom']); let t = await b.readTable('Products'); await b.patchRow('Products', t.headers, { CustomerCustom: 'keep me' }, 2);
  const updated = await a.update(r.id, r.updatedAt, { price: 1300 }); assert.equal(updated.isActive, false);
  await data.prepareCustomerSchema(user, s); t = await b.readTable('Products'); assert.equal(t.rows[0].values.CustomerCustom, 'keep me'); assert.equal(t.rows[0].values.ID, r.id);
  const schema = schemas.schemaFor('online_store', 'products'); const fake = { readTable: async () => ({ headers: schema.fields.map(f => f.header.toLowerCase()), rows: [] }) };
  await assert.rejects(load('src/lib/google/typed-adapter.ts').createTypedSheetAdapter(fake, schema).list(), /missing required headers/);
});
test('API authorization rejects foreign or stale selected site, anonymous access, viewer writes and cross-origin requests', async () => {
  const s = site('business_profile', '-auth'); actor = actorFor(s);
  await assert.rejects(access.authorizeCustomer(new Request('http://localhost/api?siteId=other'), 'pages'), e => e.status === 403);
  actor = null; await assert.rejects(access.authorizeCustomer(new Request('http://localhost/api'), 'pages'), e => e.status === 401);
  actor = actorFor(s, 'viewer'); await assert.rejects(access.authorizeCustomer(new Request('http://localhost/api', { headers: { origin: 'http://localhost' } }), 'pages', true), e => e.status === 403);
  actor = actorFor(s); await assert.rejects(access.authorizeCustomer(new Request('http://localhost/api', { headers: { origin: 'https://evil.example' } }), 'pages', true), e => e.status === 403);
});
test('billing uses exact AXORA site binding and only starts 30-day trial after confirmed delivery', async () => {
  const billing = load('src/lib/customer/billing.ts'); delete process.env.AXORA_BILLING_API; delete process.env.AXORA_BILLING_TOKEN;
  assert.equal((await billing.customerBilling('a')).available, false);
  process.env.AXORA_BILLING_API = 'https://billing.example'; process.env.AXORA_BILLING_TOKEN = 'fixture-token';
  const payload = { site_id: 'a', as_of: '2026-11-10T00:00:00Z', confirmed_delivery_at: '2026-11-01T00:00:00Z', subscription: { status: 'trial', plan: null, next_billing_at: null }, payments: [] };
  const original = global.fetch; global.fetch = async () => Response.json(payload);
  try {
    const r = await billing.customerBilling('a'); assert.equal(r.available, true); assert.equal(r.trialEndsAt, '2026-12-01T00:00:00.000Z');
    assert.equal((await billing.customerBilling('b')).available, false);
    payload.confirmed_delivery_at = null; assert.equal((await billing.customerBilling('a')).available, false);
    assert.equal(billing.CUSTOMER_PRICING.monthly, 20000); assert.equal(billing.CUSTOMER_PRICING.annual, 228000);
  } finally { global.fetch = original; delete process.env.AXORA_BILLING_API; delete process.env.AXORA_BILLING_TOKEN; }
});
test('disabled explicit membership cannot be resurrected by legacy assignment', () => {
  const membershipFile = path.resolve('src/lib/auth/site-memberships.ts');
  stubs['@/lib/supabase/server'] = {}; stubs['@/lib/supabase/service'] = {};
  // Pure membership merge is extracted from the actual source to avoid initializing a Supabase client.
  const source = fs.readFileSync(membershipFile, 'utf8');
  const stripped = source.replace(/^import .*;\r?\n/gm, '');
  const compiled = ts.transpileModule(stripped, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exp = {}; vm.runInNewContext(compiled, { exports: exp });
  const merged = exp.mergeMemberships([{ site_id: 'a', role: 'owner', status: 'disabled' }], 'a'); assert.equal(merged.length, 0);
});
after(() => { assert.ok(audits.length > 0); assert.ok(invalidations.length > 0); console.log('Emulator fixture directory:', root, '(no Google calls made)'); });
test('remaining business-specific resources support validated CRUD in isolated spreadsheets', async () => {
  const groups = {
    online_store: [ ['categories',{name:'Ангилал',slug:'category'}], ['customers',{name:'Хэрэглэгч',phone:'99999999'}], ['discounts',{code:'SAVE5',type:'percent',value:5}], ['orders',{orderNumber:'QA-1',status:'new',items:[{id:'manual-snapshot',quantity:1}],totalAmount:100}] ],
    restaurant: [ ['categories',{name:'Ундаа',slug:'drinks'}], ['orders',{orderNumber:'QA-R1',status:'new',items:[{id:'manual-snapshot',quantity:1}],totalAmount:100}], ['reservations',{customerName:'Зочин',partySize:2,reservedAt:'2026-12-01T04:00:00Z',phone:'99999999'}], ['openingHours',{weekday:1,opensAt:'09:00',closesAt:'18:00'}] ],
    service_business: [ ['services',{name:'Үйлчилгээ',durationMinutes:30}], ['staff',{name:'Ажилтан'}], ['customers',{name:'Үйлчлүүлэгч'}] ],
    business_profile: [ ['gallery',{title:'Зураг',mediaUrl:'https://example.invalid/image.png',status:'published'}], ['articles',{title:'Мэдээ',slug:'news',body:'Мэдээний агуулга',status:'published'}], ['contactInquiries',{name:'Зочин',message:'Холбоо барих хүсэлтийн агуулга'}] ],
    portfolio: [ ['projectCategories',{name:'Төрөл',slug:'type'}], ['gallery',{title:'Зураг',mediaUrl:'https://example.invalid/image.png',status:'published'}] ],
  };
  for (const [type, resources] of Object.entries(groups)) {
    const s = site(type, '-modules'); const user = actorFor(s); await data.prepareCustomerSchema(user,s); const saved = [];
    if (type === 'service_business') {
      const service = (await data.mutateCustomerRecord(user,s,'services','create',{payload:{name:'Захиалах үйлчилгээ',durationMinutes:30},idempotencyKey:'service-ref-key'})).record;
      const staff = (await data.mutateCustomerRecord(user,s,'staff','create',{payload:{name:'Хуваарийн ажилтан',serviceIds:[service.id]},idempotencyKey:'staff-ref-key'})).record;
      resources.push(['appointments',{serviceId:service.id,staffId:staff.id,customerName:'Зочин',startsAt:'2026-12-01T04:00:00Z'}],['availability',{staffId:staff.id,weekday:1,startsAt:'09:00',endsAt:'18:00'}]);
    }
    if (type === 'online_store') {
      const product = (await data.mutateCustomerRecord(user,s,'products','create',{payload:cases[0][2],idempotencyKey:'inventory-product-key'})).record;
      resources.push(['inventory',{productId:product.id,changeAmount:1,reason:'QA journal only',balanceAfter:4}]);
    }
    for (const [resource,payload] of resources) {
      const record = (await data.mutateCustomerRecord(user,s,resource,'create',{payload,idempotencyKey:'module-create-'+resource})).record;
      assert.ok((await data.readCustomerModule(user,s,resource)).some(r=>r.id===record.id), type+':'+resource);
      const updated = (await data.mutateCustomerRecord(user,s,resource,'update',{id:record.id,expectedUpdatedAt:record.updatedAt,payload})).record;
      assert.notEqual(updated.updatedAt,record.updatedAt); saved.push([resource,updated]);
    }
    for (const [resource,record] of saved.reverse()) await data.mutateCustomerRecord(user,s,resource,'delete',{id:record.id,expectedUpdatedAt:record.updatedAt,confirmed:true});
  }
});
