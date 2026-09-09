import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database.types';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // 1. Check for homie_session cookie
  const homieSession = request.cookies.get('homie_session')?.value;
  const hasHomieSession = Boolean(homieSession && homieSession.trim().length > 0);

  // 2. Check for Supabase auth token cookie (sb-*-auth-token)
  const hasSupabaseCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));

  let isAuthenticated = hasHomieSession || hasSupabaseCookie;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabase = createServerClient<Database>(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
              supabaseResponse = NextResponse.next({
                request,
              });
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        isAuthenticated = true;
      } else if (!hasHomieSession) {
        isAuthenticated = false;
      }
    } catch {
      // Continue with cookie evaluation
    }
  }

  const isAuthRoute =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/register' ||
    pathname.startsWith('/register/') ||
    pathname === '/join' ||
    pathname.startsWith('/join/');

  const isAppRoute =
    pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/shopping') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/pets') ||
    pathname.startsWith('/finances') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/household') ||
    pathname.startsWith('/rewards') ||
    pathname.startsWith('/chores') ||
    pathname.startsWith('/create');

  // Redirect unauthenticated users to /login
  if (!isAuthenticated && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/' && pathname !== '/dashboard') {
      url.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from root to dashboard
  if (isAuthenticated && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages to dashboard
  if (isAuthenticated && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
