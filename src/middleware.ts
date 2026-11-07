import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  ADMIN_HOST,
  DEMO_COOKIE,
  PLATFORM_BASE_DOMAIN,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  isDemoMode,
  isLocalHost,
  isSupabaseConfigured,
} from "@/lib/config";
import { verifySession } from "@/lib/auth/session";
import { DEMO_DOMAIN_MAP } from "@/lib/demo-domains";

interface AuthResult {
  authenticated: boolean;
  /** Carries any refreshed Supabase auth cookies back to the browser. */
  response: NextResponse;
}

async function isAuthenticated(request: NextRequest): Promise<AuthResult> {
  if (isDemoMode()) {
    return {
      authenticated: Boolean(
        await verifySession(request.cookies.get(DEMO_COOKIE)?.value),
      ),
      response: NextResponse.next(),
    };
  }
  if (!isSupabaseConfigured()) {
    return { authenticated: false, response: NextResponse.next() };
  }

  const response = NextResponse.next();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>,
      ) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { authenticated: Boolean(user), response };
}

/** Copy refreshed auth cookies onto a redirect/rewrite response. */
function withCookies(source: NextResponse, target: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

async function resolveStoreSlug(hostname: string): Promise<string | null> {
  if (isDemoMode()) {
    return DEMO_DOMAIN_MAP[hostname] ?? null;
  }
  if (!isSupabaseConfigured() || !SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/platform_registry?select=payload&id=eq.true`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{payload:{stores:Array<{slug:string;status:string;domains:Array<{domain:string;verificationStatus:string;status:string}>}>}}>;
    const store=rows[0]?.payload.stores.find(s=>s.status==="active"&&s.domains.some(d=>d.domain===hostname&&d.verificationStatus==="verified"&&d.status==="active"));
    return store?.slug??null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hostHeader = request.headers.get("host") ?? "";
  const hostname = hostHeader.split(":")[0].toLowerCase();
  const local = isLocalHost(hostname);

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/store-admin" || pathname.startsWith("/store-admin/");
  const isLogin = pathname === "/admin/login";
  const isApi = pathname.startsWith("/api/");
  const isStorefront = pathname === "/store" || pathname.startsWith("/store/");

  // --- Admin authentication gate ------------------------------------------
  // Resolve auth once per request so refreshed Supabase cookies are preserved
  // on whichever response we end up returning.
  let auth: AuthResult | null = null;
  if (isAdmin || isLogin) {
    auth = await isAuthenticated(request);
  }

  if (isAdmin && !isLogin && !auth?.authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return withCookies(auth!.response, NextResponse.redirect(url));
  }

  // --- Host based storefront routing --------------------------------------
  if (!local && !isAdmin && !isApi && !isStorefront) {
    const platformHosts = [
      ADMIN_HOST,
      PLATFORM_BASE_DOMAIN,
      `www.${PLATFORM_BASE_DOMAIN}`,
    ];
    if (platformHosts.includes(hostname)) {
      if (pathname === "/") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/dashboard";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    let slug: string | null = null;
    if (hostname.endsWith(`.${PLATFORM_BASE_DOMAIN}`)) {
      const prefix = hostname.slice(0, -(PLATFORM_BASE_DOMAIN.length + 1));
      if (prefix && prefix !== "www" && prefix !== "admin") slug = prefix;
    }
    if (!slug) slug = await resolveStoreSlug(hostname);

    if (slug) {
      const url = request.nextUrl.clone();
      url.pathname = `/store/${slug}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (pathname === "/" && (local || hostname === ADMIN_HOST)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  if (pathname === "/admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    const redirect = NextResponse.redirect(url);
    return auth ? withCookies(auth.response, redirect) : redirect;
  }

  return auth?.response ?? NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
