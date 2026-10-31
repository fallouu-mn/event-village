/**
 * Appel du middleware Next.js avec une vraie session Supabase (cookies @supabase/ssr).
 *
 * Les cookies sont produits par la bibliothèque elle-même (createServerClient + setSession),
 * pour reproduire exactement ce que reçoit le middleware d'un navigateur connecté.
 * Ce module n'utilise que la clé anon : les tests de sécurité peuvent l'importer.
 */
import './env';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';

export interface SessionCookie {
    name: string;
    value: string;
}

/** Cookies de session équivalents à ceux d'un navigateur connecté avec la session de `client`. */
export async function sessionCookies(client: SupabaseClient): Promise<SessionCookie[]> {
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(`lecture de la session : ${error.message}`);
    if (!data.session) throw new Error('aucune session ouverte sur ce client');

    const jar = new Map<string, string>();
    const ssr = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
            getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
            setAll: (cookies) => {
                for (const c of cookies) {
                    if (c.value) jar.set(c.name, c.value);
                    else jar.delete(c.name);
                }
            },
        },
    });
    const { error: setErr } = await ssr.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
    });
    if (setErr) throw new Error(`setSession : ${setErr.message}`);
    if (jar.size === 0) throw new Error('setSession n\'a produit aucun cookie de session');
    return Array.from(jar, ([name, value]) => ({ name, value }));
}

export interface MiddlewareResult {
    status: number;
    location: string | null;
    passedThrough: boolean;
}

/** Exécute le middleware sur `pathname` avec les cookies fournis. */
export async function callMiddleware(pathname: string, cookies: SessionCookie[]): Promise<MiddlewareResult> {
    const req = new NextRequest(`http://127.0.0.1:3000${pathname}`, {
        headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
    });
    const res = await middleware(req);
    return {
        status: res.status,
        location: res.headers.get('location'),
        passedThrough: res.headers.get('x-middleware-next') === '1',
    };
}
