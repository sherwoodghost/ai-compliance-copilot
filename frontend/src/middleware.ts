import { NextRequest, NextResponse } from 'next/server';

// Paths that require NO authentication (accessible by everyone)
// Note: use trailing slash for prefix-matched paths to avoid false matches
// e.g. '/trust/' matches /trust/[slug] but NOT /trust-center
const PUBLIC_PATHS = ['/login', '/register', '/trust/', '/public', '/audit/', '/frameworks'];

// Paths that redirect AUTHENTICATED users away (auth-only paths like login/register)
// Authenticated users who hit these get sent to /overview
const AUTH_ONLY_PATHS = ['/login', '/register'];

const INTERNAL_PATHS = ['/internal'];
const ONBOARDING_PATH = '/onboarding';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Internal routes: handled by their own layout (checks internal_token cookie)
  // Middleware only ensures /internal/login doesn't require the customer token
  if (INTERNAL_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('access_token')?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p));

  // Unauthenticated user hitting a protected route → login
  if (!accessToken && !isPublic && pathname !== ONBOARDING_PATH) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting login/register → overview (not other public pages)
  if (accessToken && isAuthOnly) {
    const url = req.nextUrl.clone();
    url.pathname = '/overview';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
