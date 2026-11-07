#!/usr/bin/env node
/**
 * Create (or promote) the initial AXORA Super Admin.
 *
 * Usage:
 *   1. Copy .env.example to .env.local and fill in Supabase + INITIAL_ADMIN_*.
 *   2. Run the migrations in supabase/migrations (0001 → 0004).
 *   3. npm run setup:admin
 *
 * The script uses the Supabase service role key, so it must only be run from a
 * trusted machine. It never prints the password.
 */

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = (process.env.INITIAL_ADMIN_EMAIL || process.argv[2] || "").trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD || process.argv[3] || "";
const fullName = (process.env.INITIAL_ADMIN_NAME || "AXORA Super Admin").trim();

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is missing. Add it to .env.local.");
if (!serviceKey) {
  fail("SUPABASE_SERVICE_ROLE_KEY is missing. It is required to create auth users.");
}
if (!email || !email.includes("@")) {
  fail("INITIAL_ADMIN_EMAIL is missing or invalid. Set it in .env.local.");
}
if (password.length < 8) {
  fail("INITIAL_ADMIN_PASSWORD must be at least 8 characters long.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(target) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === target,
    );
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  console.log(`→ Supabase: ${url}`);
  console.log(`→ Admin email: ${email}`);

  const existing = await findUserByEmail(email);
  let userId;

  if (existing) {
    userId = existing.id;
    console.log("• Auth user already exists — updating password and metadata.");
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
  } else {
    console.log("• Creating auth user.");
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role: "super_admin",
      is_super_admin: true,
    },
    { onConflict: "id" },
  );
  if (profileError) throw profileError;

  console.log("\n✔ Super Admin is ready.");
  console.log(`  User ID: ${userId}`);
  console.log("  Sign in at /admin/login with INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD.");
  console.log("  Remove INITIAL_ADMIN_PASSWORD from .env.local after the first login.\n");
}

main().catch((error) => {
  console.error("\n✖ Setup failed:", error?.message || error);
  if (String(error?.message || "").toLowerCase().includes("relation")) {
    console.error(
      "  Have you run the SQL files in supabase/migrations (0001 → 0004)?",
    );
  }
  process.exit(1);
});
