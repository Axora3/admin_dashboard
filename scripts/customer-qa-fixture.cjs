const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const ts = require('typescript'); const http = require('node:http');
const qaRoot = path.join(process.cwd(), '.data', 'customer-browser-qa'); fs.mkdirSync(path.join(qaRoot, 'sheets'), { recursive: true });
function pure(file) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: n => n === 'server-only' ? {} : require(n) }); return exports; }
const schema = pure('src/lib/google/schema-registry.ts'); const defaults = pure('src/lib/data/defaults.ts'); const sheets = pure('src/lib/google/types.ts');
const types = ['online_store', 'restaurant', 'service_business', 'business_profile', 'portfolio'];
const stores = [...types, 'foreign'].map(type => {
 const businessType = type === 'foreign' ? 'online_store' : type;
 const config = { ...sheets.defaultSheetsConfig(), spreadsheetId: 'qa-' + type, tabs: {}, columns: {}, enabledModules: schema.modulesForBusiness(businessType), connectionStatus: 'local' };
 const tabs = {}; for (const resource of config.enabledModules) { const s = schema.schemaFor(businessType, resource); tabs[s.tab] = { headers: s.fields.map(f => f.header), rows: [] }; }
 fs.writeFileSync(path.join(qaRoot, 'sheets', type + '.json'), JSON.stringify({ version: 1, tabs }));
 return { id: type, slug: type, name: 'QA ' + type, businessType, status: 'active', currency: 'MNT', language: 'mn', ownerName: 'QA owner', ownerEmail: 'qa@example.invalid', description: '', logoUrl: null, phone: '', email: '', address: '', ownerPhone: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sheets: config, settings: defaults.defaultStoreSettings(), domains: [{ id: type, storeId: type, domain: type.replaceAll('_','-') + '.example.test', isPrimary: true, verificationStatus: 'verified', status: 'active', sslStatus: 'active' }] };
});
fs.writeFileSync(path.join(qaRoot, 'registry.json'), JSON.stringify({ version: 1, stores }));
const owner = '00000000-0000-4000-8000-000000000001'; const viewer = '00000000-0000-4000-8000-000000000003';
function user(req) { try { return JSON.parse(Buffer.from(String(req.headers.authorization).replace('Bearer ', '').split('.')[1], 'base64url').toString()).sub; } catch { return owner; } }
http.createServer((req, res) => {
 const url = new URL(req.url, 'http://localhost'); const id = user(req); res.setHeader('Content-Type','application/json');
 const send = data => res.end(JSON.stringify(data));
 if (url.pathname === '/auth/v1/user') return send({ id, aud: 'authenticated', role: 'authenticated', email: 'qa@example.invalid', created_at: '2026-11-01T00:00:00Z', app_metadata: {}, user_metadata: {} });
 if (url.pathname === '/rest/v1/profiles') return send({ id: url.searchParams.get('id')?.replace('eq.','') || id, email: 'qa@example.invalid', full_name: 'QA customer', role: 'store_admin', is_super_admin: false, is_active: true, created_at: '2026-11-01T00:00:00Z' });
 if (url.pathname === '/rest/v1/site_memberships') {
 const uid = url.searchParams.get('user_id')?.replace('eq.','');
 return send((uid === owner ? types : uid === viewer ? ['online_store'] : ['foreign']).map(site_id => ({ site_id, role: uid === viewer ? 'viewer' : 'owner', status: 'active' })));
 }
 if (url.pathname === '/rest/v1/admin_assignments') return send(null);
 if (/^\/sites\/[^/]+\/billing$/.test(url.pathname)) return send({ site_id: url.pathname.split('/')[2], as_of: '2026-11-10T00:00:00Z', confirmed_delivery_at: '2026-11-01T00:00:00Z', subscription: { status: 'trial', plan: null, next_billing_at: null }, payments: [] });
 res.statusCode = 404; return send({ message: 'QA fixture endpoint not implemented' });
}).listen(43219, '127.0.0.1', () => console.log('Customer QA fixture listening on loopback 43219; synthetic data only'));
