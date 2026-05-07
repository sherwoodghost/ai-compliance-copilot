import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/trust', '/public'];
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

  // Unauthenticated user hitting a protected route → login
  if (!accessToken && !isPublic && pathname !== ONBOARDING_PATH) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting login/register → overview
  if (accessToken && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/overview';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
