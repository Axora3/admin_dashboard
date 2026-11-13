const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function load(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => name === 'server-only' ? {} : require(name), process, Date, console, setTimeout, clearTimeout });
  return exports;
}

const registry = load('src/lib/google/schema-registry.ts');
const adapters = load('src/lib/google/typed-adapter.ts');

function fakeBackend(schema) {
  const headers = schema.fields.map(field => field.header);
  const rows = [];
  return {
    rows,
    async listTabs() { return [schema.tab]; },
    async readTable(tab) {
      if (tab !== schema.tab) throw new Error('missing tab');
      return { headers, rows: rows.map((values, index) => ({ rowNumber: index + 2, values: { ...values } })) };
    },
    async writeRow(tab, _headers, values) { assert.equal(tab, schema.tab); rows.push(Object.fromEntries(headers.map(header => [header, values[header] ?? '']))); },
    async patchRow(tab, _headers, values, rowNumber) {
      assert.equal(tab, schema.tab);
      const target = rows[rowNumber - 2];
      if (!target) throw new Error('missing row');
      Object.assign(target, values);
    },
    async deleteRow() { throw new Error('hard delete should not be used'); },
    async ensureTable() {}, async ensureColumns() {},
  };
}

test('business type registry maps each site to its own modules and rejects unrelated resources', () => {
  assert.equal(registry.canonicalBusinessType('Restaurant / Coffee shop'), 'restaurant');
  assert.equal(registry.canonicalBusinessType('Үйлчилгээний бизнес'), 'service_business');
  assert.equal(registry.canonicalBusinessType('Бизнес профайл'), 'business_profile');
  assert.deepEqual(JSON.parse(JSON.stringify(registry.modulesForBusiness('business_profile'))), ['pages', 'gallery', 'articles', 'contactInquiries', 'settings']);
  assert.throws(() => registry.schemaFor('restaurant', 'products'), /not enabled/);
  assert.throws(() => registry.schemaFor('business_profile', 'appointments'), /not enabled/);
});

test('typed adapter validates, creates idempotently, updates by stable ID, and soft-deletes with confirmation', async () => {
  const schema = registry.schemaFor('business_profile', 'pages');
  const backend = fakeBackend(schema);
  const adapter = adapters.createTypedSheetAdapter(backend, schema);
  const input = { slug: 'about', title: 'About', body: 'Company profile', status: 'published', extensions: { socialLinks: ['https://example.test'] } };
  const created = await adapter.create(input, 'page-create-key-01');
  assert.equal(created.slug, 'about');
  assert.equal(backend.rows.length, 1);
  const replay = await adapter.create(input, 'page-create-key-01');
  assert.equal(replay.id, created.id);
  assert.equal(backend.rows.length, 1);
  await assert.rejects(adapter.create({ ...input, title: 'Different page' }, 'page-create-key-01'), adapters.IdempotencyConflictError);
  assert.deepEqual(JSON.parse(JSON.stringify((await adapter.get(created.id)).extensions)), input.extensions);
  await assert.rejects(adapter.update(created.id, 'stale-version', { title: 'Changed' }), adapters.RecordConflictError);
  const updated = await adapter.update(created.id, created.updatedAt, { title: 'Updated title' });
  assert.equal(updated.title, 'Updated title');
  await assert.rejects(adapter.delete(created.id, updated.updatedAt, false), adapters.RecordConfirmationError);
  await adapter.delete(created.id, updated.updatedAt, true);
  assert.equal(await adapter.get(created.id), null);
  assert.equal((await adapter.list()).length, 0);
  assert.ok(backend.rows[0].DeletedAt, 'soft delete writes a tombstone');
});

test('record identity survives row movement and invalid data does not write', async () => {
  const schema = registry.schemaFor('service_business', 'services');
  const backend = fakeBackend(schema);
  const adapter = adapters.createTypedSheetAdapter(backend, schema);
  await assert.rejects(adapter.create({ name: 'Invalid', durationMinutes: 30, isActive: true, price: -1 }, 'invalid-key-0001'));
  assert.equal(backend.rows.length, 0);
  const first = await adapter.create({ name: 'Consultation', durationMinutes: 30, isActive: true }, 'service-create-01');
  const second = await adapter.create({ name: 'Design', durationMinutes: 60, isActive: true }, 'service-create-02');
  backend.rows.unshift(Object.fromEntries(schema.fields.map(field => [field.header, ''])));
  const updated = await adapter.update(second.id, second.updatedAt, { name: 'Design session' });
  assert.equal(updated.id, second.id);
  assert.equal((await adapter.get(first.id)).name, 'Consultation');
  assert.equal((await adapter.get(second.id)).name, 'Design session');
});

test('public create policy is limited to visitor intake resources', () => {
  for (const [business, module] of [['online_store', 'orders'], ['restaurant', 'orders'], ['restaurant', 'reservations'], ['service_business', 'appointments'], ['business_profile', 'contactInquiries']]) {
    assert.equal(registry.schemaFor(business, module).publicCreate, true);
  }
  for (const [business, module] of [['online_store', 'products'], ['restaurant', 'menu'], ['service_business', 'services'], ['business_profile', 'pages']]) {
    assert.equal(registry.schemaFor(business, module).publicCreate, false);
  }
});

test('public API code binds sites to verified origins and keeps private fields out of projection', () => {
  const service = fs.readFileSync(path.join(root, 'src/lib/google/site-data-service.ts'), 'utf8');
  const route = fs.readFileSync(path.join(root, 'src/app/api/public/site-data/[module]/route.ts'), 'utf8');
  assert.match(service, /findByDomain\(hostname\)/);
  assert.match(service, /domain\.status !== "active"/);
  assert.match(service, /publicReadable/);
  assert.match(service, /schema\.publicFields\.filter/);
  assert.match(route, /Idempotency-Key/);
  assert.match(route, /rateLimit\(/);
  assert.doesNotMatch(route, /spreadsheetId|spreadsheet_id/);
});

test('admin CRUD resolves a site from membership and rejects client-supplied spreadsheet mapping', () => {
  const route = fs.readFileSync(path.join(root, 'src/app/api/admin/site-data/[module]/route.ts'), 'utf8') + fs.readFileSync(path.join(root, 'src/lib/customer/access.ts'), 'utf8');
  assert.match(route, /actor\.storeId/);
  assert.match(route, /assertPermission\(/);
  assert.match(route, /expectedUpdatedAt/);
  assert.match(route, /confirmed: z\.literal\(true\)/);
  assert.doesNotMatch(route, /spreadsheetId|spreadsheet_id/);
});
