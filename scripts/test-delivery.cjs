// Delivery regression tests run without network or live Supabase/Google writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));

function modules(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(projectRoot, file);
    if (cache.has(absolute)) return cache.get(absolute);
    const exports = {};
    cache.set(absolute, exports);
    const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    function imported(name) {
      if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
      if (name === 'server-only') return {};
      if (!name.startsWith('.') && !name.startsWith('@/')) return require(name);
      const base = name.startsWith('@/') ? path.resolve(projectRoot, 'src', name.slice(2)) : path.resolve(path.dirname(absolute), name);
      const target = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(candidate => fs.existsSync(candidate));
      if (!target) throw new Error(`Cannot resolve test import ${name} from ${file}`);
      const relative = path.relative(projectRoot, target).replaceAll('\\', '/');
      if (Object.prototype.hasOwnProperty.call(mocks, relative)) return mocks[relative];
      return load(target);
    }
    vm.runInNewContext(output, { exports, require: imported, process, Buffer, console, Date, URLSearchParams, FormData, setTimeout, clearTimeout, setInterval, clearInterval });
    return exports;
  }
  return load;
}

const load = modules();
const rules = load('src/lib/delivery/validation.ts');
const mapping = load('src/lib/google/mapping.ts');
const sheetTypes = load('src/lib/google/types.ts');
const detail = patch => ({ method: 'store_delivery', latitude: 47.918, longitude: 106.917, driverName: 'Driver', driverPhone: '99112233', note: 'Door 2', ...patch });

test('coordinates require a finite in-range pair and preserve zero coordinates', () => {
  for (const coordinates of [{ latitude: null, longitude: null }, { latitude: 0, longitude: 0 }, { latitude: -90, longitude: 180 }]) {
    assert.equal(rules.deliveryLocationSchema.safeParse(coordinates).success, true);
  }
  for (const coordinates of [
    { latitude: null, longitude: 100 }, { latitude: 40, longitude: null },
    { latitude: 90.01, longitude: 20 }, { latitude: 20, longitude: -180.01 },
    { latitude: Infinity, longitude: 20 }, { latitude: 40, longitude: NaN },
    { latitude: '47', longitude: '106' }, { latitude: '', longitude: '' },
  ]) assert.equal(rules.deliveryLocationSchema.safeParse(coordinates).success, false);
  assert.equal(rules.hasDeliveryCoordinates({ latitude: 0, longitude: 0 }), true);
  assert.equal(rules.hasDeliveryCoordinates({ latitude: null, longitude: null }), false);
  assert.equal(rules.hasDeliveryCoordinates({ latitude: 1, longitude: Infinity }), false);
});

test('delivery parsing rejects malformed and unexpected data without inventing a location', () => {
  for (const raw of ['', 'broken-json', 'null', '[]', '{}', JSON.stringify(detail({ method: 'unknown' })), JSON.stringify(detail({ latitude: null })), JSON.stringify({ ...detail(), trackingUrl: 'javascript:alert(1)' })]) {
    assert.equal(rules.parseDelivery(raw), null);
  }
  assert.equal(rules.deliverySchema.safeParse(detail({ driverName: 'a'.repeat(121) })).success, false);
  assert.deepEqual(plain(rules.parseDelivery(JSON.stringify(detail({ latitude: 0, longitude: 0 })))), detail({ latitude: 0, longitude: 0 }));
});

test('older Sheets orders remain readable; mapped Delivery JSON round-trips independently of status', () => {
  const oldRow = { ID: 'same-id', OrderNumber: 'A-1', CustomerName: 'Customer', OrderStatus: 'processing', TotalAmount: '100', CreatedAt: '2026-11-08T00:00:00Z' };
  const old = mapping.rowToOrder('a', 'A', oldRow, Object.keys(oldRow), sheetTypes.DEFAULT_COLUMNS);
  assert.equal(old.id, 'same-id');
  assert.equal(old.delivery, null);
  const customColumns = sheetTypes.cloneColumns(sheetTypes.DEFAULT_COLUMNS);
  customColumns.orders.delivery = 'Хүргэлт';
  const row = { ...oldRow, Хүргэлт: JSON.stringify(detail()) };
  const order = mapping.rowToOrder('a', 'A', row, Object.keys(row), customColumns);
  assert.deepEqual(plain(order.delivery), detail());
  assert.equal(order.orderStatus, 'processing');
  assert.equal(mapping.rowToOrder('a', 'A', { ...row, Хүргэлт: '{broken' }, Object.keys(row), customColumns).delivery, null);
});

test('public checkout accepts optional zero coordinates and rejects partial or invalid pins before creating an order', async () => {
  const created = [];
  const checkoutLoad = modules({
    'next/cache': { revalidatePath: () => {} },
    '@/lib/rate-limit': { clientIp: async () => 'test', rateLimit: () => ({ allowed: true }) },
    '@/lib/data': { getRepository: () => ({ createOrder: async input => { created.push(input); return { id: 'fixture', orderNumber: 'F-1' }; } }) },
  });
  const checkout = checkoutLoad('src/app/store/actions/checkout.ts').submitCheckoutAction;
  const form = patch => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ storeSlug: 'a', customerName: 'Customer', customerPhone: '99112233', customerAddress: 'Address 1', items: JSON.stringify([{ productId: 'p', quantity: 1 }]), ...patch })) data.set(key, value);
    return data;
  };
  assert.equal((await checkout(undefined, form({ latitude: '0', longitude: '0' }))).ok, true);
  assert.deepEqual(plain(created[0].delivery), { latitude: 0, longitude: 0 });
  assert.equal((await checkout(undefined, form({}))).ok, true);
  assert.deepEqual(plain(created[1].delivery), { latitude: null, longitude: null });
  for (const patch of [{ latitude: '47' }, { latitude: '', longitude: '106' }, { latitude: '91', longitude: '0' }, { latitude: 'NaN', longitude: '0' }, { latitude: 'Infinity', longitude: '106' }]) {
    const result = await checkout(undefined, form(patch));
    assert.equal(result.ok, false);
    assert.ok(result.errors.delivery);
  }
  assert.equal(created.length, 2);
});

async function withRepository(work) {
  const root = path.resolve(projectRoot, '.data', 'delivery-test');
  fs.mkdirSync(root, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(root, 'run-'));
  const previous = process.env.AXORA_DATA_DIR;
  process.env.AXORA_DATA_DIR = temporary;
  let actor = { id: 'admin-a', role: 'store_admin', isSuperAdmin: false, storeId: 'a' };
  const stores = ['a', 'b'].map(id => ({ id, slug: id, name: id.toUpperCase(), status: 'active', sheets: sheetTypes.defaultSheetsConfig() }));
  const limitCalls = [];
  const audits = [];
  let denied = false;
  const registry = { kind: 'file', list: async () => stores, get: async id => stores.find(store => store.id === id || store.slug === id) ?? null };
  const fixtureLoad = modules({
    'src/lib/registry/file-registry.ts': { fileStoreRegistry: registry },
    'src/lib/auth/server.ts': {
      getCurrentAdmin: async () => actor,
      requireStoreAdmin: async () => { if (actor?.role !== 'store_admin') throw new Error('Store admin required'); return actor; },
      requireSuperAdmin: async () => { if (!actor?.isSuperAdmin) throw new Error('Super admin required'); return actor; },
    },
    '@/lib/config': { sheetsMode: () => 'local' },
    'src/lib/google/sheets-client.ts': { GoogleSheetsError: class GoogleSheetsError extends Error {} },
    'src/lib/platform/db.ts': { platformEnabled: () => false },
    '@/lib/registry/audit-store': {},
    '@/lib/audit': { recordAudit: async (admin, event) => { audits.push({ admin, ...event }); } },
    '@/lib/rate-limit': { rateLimit: () => ({ allowed: true }) },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/platform/subscriptions': { currentMonthStart: () => '2026-11-01', enforceLimit: async (...args) => { limitCalls.push(args); if (denied) throw new Error('Subscription suspended'); } },
  });
  try {
    const backendModule = fixtureLoad('src/lib/google/sheet-backend.ts');
    const backends = Object.fromEntries(stores.map(store => [store.id, backendModule.createSheetBackend({ storeId: store.id, spreadsheetId: '', mode: 'local' })]));
    const legacyHeaders = ['ID', 'OrderNumber', 'CustomerName', 'OrderStatus', 'PaymentStatus', 'TotalAmount', 'CreatedAt', 'CustomColumn'];
    for (const id of ['a', 'b']) {
      await backends[id].ensureTable('Orders', legacyHeaders);
      await backends[id].writeRow('Orders', legacyHeaders, { ID: 'same-id', OrderNumber: `${id}-1`, CustomerName: `Customer ${id}`, OrderStatus: 'processing', PaymentStatus: 'unpaid', TotalAmount: '100', CreatedAt: '2026-11-08T00:00:00Z', CustomColumn: `preserve-${id}` });
    }
    const scope = fixtureLoad('src/lib/auth/store-scope.ts');
    const repository = fixtureLoad('src/lib/data/index.ts').getRepository();
    await work({ repository, scope, backends, stores, limitCalls, audits, fixtureLoad, setActor: value => { actor = value; }, denyWrites: () => { denied = true; } });
  } finally {
    if (previous === undefined) delete process.env.AXORA_DATA_DIR;
    else process.env.AXORA_DATA_DIR = previous;
    if (path.dirname(temporary) !== root) throw new Error('Unsafe test cleanup path');
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

test('delivery writes add columns to legacy Sheets without losing custom values; status/payment edits preserve delivery', async () => {
  await withRepository(async ({ repository, scope, backends, limitCalls }) => {
    await scope.withStoreAdmin(async () => {
      await repository.updateOrderDelivery('same-id', detail());
      const written = await repository.getOrder('same-id');
      assert.deepEqual(plain(written.delivery), detail());
      await repository.updateOrderStatus('same-id', 'shipped');
      await repository.updatePaymentStatus('same-id', 'paid');
      const result = await repository.getOrder('same-id');
      assert.deepEqual(plain(result.delivery), detail());
      assert.equal(result.orderStatus, 'shipped');
      assert.equal(result.paymentStatus, 'paid');
    });
    const table = await backends.a.readTable('Orders');
    assert.ok(table.headers.includes('Delivery'));
    assert.equal(table.rows[0].values.CustomColumn, 'preserve-a');
    assert.ok(limitCalls.some(([id, resource]) => id === 'a' && resource === 'write'));
    assert.equal((await backends.b.readTable('Orders')).rows[0].values.Delivery, undefined);
  });
});

test('Google adapter appends delivery headers and expands the grid without replacing existing columns', async () => {
  const calls = [];
  const headers = ['ID', 'CustomHeader'];
  const cloudLoad = modules({
    'src/lib/google/sheets-client.ts': {
      getSpreadsheetMeta: async () => ({ tabs: [{ title: 'Orders', sheetId: 7, columnCount: 2 }] }),
      getSheetValues: async () => ({ values: [headers, ['same-id', 'keep-me']] }),
      batchUpdateSheet: async (_, requests) => { calls.push({ kind: 'expand', requests }); },
      updateSheetValues: async (_, range, values) => { calls.push({ kind: 'values', range, values }); headers.push(...values[0]); },
    },
  });
  const backend = cloudLoad('src/lib/google/sheet-backend.ts').createSheetBackend({ storeId: 'a', spreadsheetId: 'fixture-only', mode: 'google' });
  await backend.ensureColumns('Orders', ['Delivery', 'UpdatedAt']);
  assert.deepEqual(headers, ['ID', 'CustomHeader', 'Delivery', 'UpdatedAt']);
  assert.equal(calls[0].kind, 'expand');
  assert.equal(calls[0].requests[0].updateSheetProperties.properties.gridProperties.columnCount, 4);
  assert.equal(calls[1].range, "'Orders'!C1:D1");
  await backend.ensureColumns('Orders', ['Delivery', 'UpdatedAt']);
  assert.equal(calls.length, 2, 'already-present headers must not be rewritten');
});

test('Google delivery patches touch only requested cells and preserve unrelated formulas', async () => {
  const grid = [{ stringValue: 'same-id' }, { formulaValue: '=SUM(1,2)' }, { stringValue: 'old' }, { stringValue: 'old-time' }];
  const requests = [];
  const cloudLoad = modules({
    'src/lib/google/sheets-client.ts': {
      getSpreadsheetMeta: async () => ({ tabs: [{ title: 'Orders', sheetId: 7, columnCount: 4 }] }),
      batchUpdateSheet: async (_, batch) => {
        for (const request of batch) {
          const update = request.updateCells;
          requests.push(update);
          assert.equal(update.start.rowIndex, 1);
          assert.equal(update.fields, 'userEnteredValue');
          grid[update.start.columnIndex] = update.rows[0].values[0].userEnteredValue;
        }
      },
    },
  });
  const backend = cloudLoad('src/lib/google/sheet-backend.ts').createSheetBackend({ storeId: 'a', spreadsheetId: 'fixture-only', mode: 'google' });
  const raw = JSON.stringify(detail({ note: '=IMPORTXML("untrusted")' }));
  await backend.patchRow('Orders', ['ID', 'CustomFormula', 'Delivery', 'UpdatedAt'], { Delivery: raw, UpdatedAt: 'new-time' }, 2);
  assert.deepEqual(requests.map(update => update.start.columnIndex), [2, 3]);
  assert.deepEqual(grid[1], { formulaValue: '=SUM(1,2)' });
  assert.deepEqual(plain(grid[2]), { stringValue: raw });
  await assert.rejects(backend.patchRow('Orders', ['ID'], { Missing: 'bad' }, 2));
  await assert.rejects(backend.patchRow('Orders', ['ID'], { ID: 'bad' }, 1));
  assert.equal(requests.length, 2);
});

test('delivery server action derives tenant from the session and keeps coordinates out of platform audit', async () => {
  await withRepository(async ({ fixtureLoad, backends, audits, setActor }) => {
    const action = fixtureLoad('src/app/admin/actions/delivery.ts').deliveryAction;
    const form = patch => {
      const data = new FormData();
      for (const [key, value] of Object.entries({ operation: 'details', orderId: 'same-id', storeId: 'a', method: 'store_delivery', latitude: '0', longitude: '0', driverName: 'Private Driver', driverPhone: '99112233', note: 'Private door', ...patch })) data.set(key, value);
      return data;
    };
    const beforeB = JSON.stringify(await backends.b.readTable('Orders'));
    assert.equal((await action(undefined, form({ storeId: 'b', role: 'super_admin' }))).ok, false);
    assert.equal(JSON.stringify(await backends.b.readTable('Orders')), beforeB);
    assert.equal((await action(undefined, form({}))).ok, true);
    assert.equal(JSON.parse((await backends.a.readTable('Orders')).rows[0].values.Delivery).latitude, 0);
    assert.equal(audits.length, 1);
    const auditJson = JSON.stringify(audits[0].metadata);
    for (const forbidden of ['latitude', 'longitude', 'Private Driver', '99112233', 'Private door']) assert.equal(auditJson.includes(forbidden), false);
    assert.equal((await action(undefined, form({ operation: 'status', status: 'delivered' }))).ok, false);
    assert.equal((await action(undefined, form({ operation: 'status', status: 'shipped' }))).ok, true);
    assert.equal((await action(undefined, form({ operation: 'status', status: 'delivered' }))).ok, true);
    assert.equal((await action(undefined, form({ operation: 'status', status: 'shipped' }))).ok, false);
    setActor({ id: 'super', role: 'super_admin', isSuperAdmin: true });
    assert.equal((await action(undefined, form({ storeId: 'b', latitude: '47', longitude: '106' }))).ok, true);
    assert.equal(JSON.parse((await backends.b.readTable('Orders')).rows[0].values.Delivery).latitude, 47);
    setActor(null);
    assert.equal((await action(undefined, form({}))).ok, false);
  });
});

test('session store scoping protects reads and writes even when stores have identical order IDs', async () => {
  await withRepository(async ({ repository, scope, backends }) => {
    const beforeB = JSON.stringify(await backends.b.readTable('Orders'));
    await scope.withStoreAdmin(async () => {
      assert.equal((await repository.getOrder('same-id')).storeId, 'a');
      await assert.rejects(repository.listOrders({ storeId: 'b' }));
      await assert.rejects(repository.getOrder('same-id', 'b'));
      await assert.rejects(repository.updateOrderDelivery('same-id', detail(), 'b'));
      await repository.updateOrderDelivery('same-id', detail({ latitude: 0, longitude: 0 }));
      assert.equal((await repository.getOrder('same-id')).delivery.latitude, 0);
    });
    assert.equal(JSON.stringify(await backends.b.readTable('Orders')), beforeB);
    const selectedB = await repository.getOrder('same-id', 'b');
    assert.equal(selectedB.storeId, 'b');
  });
});

test('status edits retain an unreadable legacy delivery cell for later repair', async () => {
  await withRepository(async ({ repository, scope, backends }) => {
    await backends.a.ensureColumns('Orders', ['Delivery']);
    const table = await backends.a.readTable('Orders');
    await backends.a.writeRow('Orders', table.headers, { ...table.rows[0].values, Delivery: '{legacy-malformed-json' }, 2);
    await scope.withStoreAdmin(async () => {
      assert.equal((await repository.getOrder('same-id')).delivery, null);
      await repository.updateOrderStatus('same-id', 'shipped');
      await repository.updatePaymentStatus('same-id', 'paid');
    });
    assert.equal((await backends.a.readTable('Orders')).rows[0].values.Delivery, '{legacy-malformed-json');
  });
});

test('invalid input and blocked subscription fail before a delivery sheet write', async () => {
  await withRepository(async ({ repository, scope, backends, denyWrites }) => {
    const before = JSON.stringify(await backends.a.readTable('Orders'));
    await scope.withStoreAdmin(async () => {
      await assert.rejects(repository.updateOrderDelivery('same-id', detail({ latitude: Infinity })));
      assert.equal(JSON.stringify(await backends.a.readTable('Orders')), before);
      denyWrites();
      await assert.rejects(repository.updateOrderDelivery('same-id', detail()), /Subscription suspended/);
      assert.equal(JSON.stringify(await backends.a.readTable('Orders')), before);
    });
  });
});
