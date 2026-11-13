const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { AsyncLocalStorage } = require('node:async_hooks');

function load(file, mocks) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require(name) { if (name in mocks) return mocks[name]; throw Error(`Unexpected dependency ${name}`); } });
  return exports;
}
const storeScope = new AsyncLocalStorage();
const records = [{ id: 'store-a', slug: 'a' }, { id: 'store-b', slug: 'b' }];
const writes = [];
const registry = { kind: 'file', list: async () => records, get: async id => records.find(s => s.id === id || s.slug === id), update: async (id, value) => { writes.push(id); return value; } };
const { getStoreRegistry } = load('src/lib/registry/index.ts', { 'server-only': {}, './file-registry': { fileStoreRegistry: registry }, '@/lib/auth/store-scope': { storeScope } });

test('unscoped Super Admin retains all store access', async () => {
  assert.equal((await getStoreRegistry().list()).length, 2);
});
test('Store Admin enumeration and forged IDs cannot access another store', async () => {
  await storeScope.run('store-a', async () => {
    const scoped = getStoreRegistry();
    assert.equal((await scoped.list()).length, 1);
    assert.equal((await scoped.list())[0].id, 'store-a');
    assert.equal(await scoped.get('store-b'), null);
    assert.equal(await scoped.get('b'), null);
    assert.equal((await scoped.get('a')).id, 'store-a');
    await assert.rejects(scoped.update('store-b', {}));
    assert.throws(() => scoped.create({}));
    assert.throws(() => scoped.delete('store-a'));
    assert.throws(() => scoped.createDomain('store-a', 'example.com', true));
    await scoped.update('store-a', { name: 'Own store' });
    assert.equal(writes.at(-1), 'store-a');
  });
});
test('concurrent store scopes remain isolated across async boundaries', async () => {
  await Promise.all(records.map(store => storeScope.run(store.id, async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal((await getStoreRegistry().list())[0].id, store.id);
  })));
  assert.equal(storeScope.getStore(), undefined);
});

function auth(profile, assigned = 'store-a') {
  const query = data => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data }) });
  return load('src/lib/auth/server.ts', {
    'next/headers': { cookies: async () => ({ get: () => undefined }) }, 'next/navigation': { redirect(path) { throw Error(`redirect:${path}`); } },
    '@/lib/config': { isDemoMode: () => false }, './session': {},
    './site-memberships': { ACTIVE_SITE_COOKIE:'axora_active_site',membershipsFor:async()=>assigned?[{siteId:assigned,role:'owner',status:'active'}]:[],selectedMembership:members=>members[0]??null },
    '@/lib/supabase/server': {
      createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'a@example.com' } } }) }, from: () => query(profile) }),
      createSupabaseServiceClient: () => ({ from: () => query(assigned ? { store_id: assigned } : null) }),
    }, '@/lib/registry': { getStoreRegistry: () => ({ get: async id => ({ id, status: 'active' }) }) },
  });
}
const profile = { id: 'user-1', email: 'a@example.com', role: 'store_admin', is_super_admin: false, is_active: true, created_at: '2026-01-01' };
test('active Store Admin gets server assignment and cannot enter Super Admin gate', async () => {
  const api = auth(profile);
  assert.equal((await api.getCurrentAdmin()).storeId, 'store-a');
  await assert.rejects(api.requireSuperAdmin(), /redirect:\/store-admin/);
});
test('disabled account is denied even with an otherwise valid auth user', async () => {
  assert.equal(await auth({ ...profile, is_active: false }).getCurrentAdmin(), null);
});
test('missing assignment and unsupported role fail closed', async () => {
  assert.equal(await auth(profile, null).getCurrentAdmin(), null);
  assert.equal(await auth({ ...profile, role: 'store_staff' }).getCurrentAdmin(), null);
  assert.equal(await auth({ ...profile, role: 'super_admin', is_super_admin: false }).getCurrentAdmin(), null);
});
test('matching active Super Admin flags authorize platform access', async () => {
  assert.equal((await auth({ ...profile, role: 'super_admin', is_super_admin: true }).requireSuperAdmin()).isSuperAdmin, true);
});
