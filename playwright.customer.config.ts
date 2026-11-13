import { defineConfig } from '@playwright/test';
const env = { ...process.env, AXORA_DIST_DIR: '.next-qa', AXORA_AUTH_MODE: 'supabase', AXORA_PLATFORM_STORAGE: 'local', AXORA_SHEETS_MODE: 'local', AXORA_DATA_DIR: process.cwd() + '/.data/customer-browser-qa', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:43219', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'qa-anonymous-key', SUPABASE_SERVICE_ROLE_KEY: 'qa-service-key', AXORA_BILLING_API: 'http://127.0.0.1:43219', AXORA_BILLING_TOKEN: 'qa-billing-token', AXORA_ALLOW_LOCAL_BILLING: '1' };
export default defineConfig({ testDir: './tests/customer', workers: 1, timeout: 45000, reporter: 'list', use: { baseURL: 'http://localhost:43220', channel: 'chrome', trace: 'retain-on-failure' }, webServer: [
 { command: 'node scripts/customer-qa-fixture.cjs', url: 'http://127.0.0.1:43219/auth/v1/user', reuseExistingServer: false },
 { command: 'npm run build && npm run start -- --port 43220', url: 'http://localhost:43220/admin/login', env, timeout: 240000, reuseExistingServer: false },
] });
