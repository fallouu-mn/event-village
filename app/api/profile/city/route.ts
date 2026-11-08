import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** En capitales avant le contrôle de longueur : le catalogue compare en capitales et la base borne à 2..80. */
const CitySchema = z.object({
    city: z.string().trim().toUpperCase().min(2).max(80).nullable(),
});

function failure(err: unknown): NextResponse {
    const response = apiFailure('PATCH /api/profile/city', err, {
        message: 'La ville n’a pas pu être enregistrée. Réessayez dans un instant.',
        code: 'CITY_SAVE_FAILED',
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

/**
 * PATCH /api/profile/city — ville du client connecté (lot 9, 9.1, L22). `{ city: string(2..80) | null }`, `null` efface.
 * Le compte vient de la session : tout identifiant du corps est ignoré. Seule écriture de users.city (aucun GRANT).
 */
export async function PATCH(request: NextRequest) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400, headers: NO_STORE });
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return NextResponse.json({ error: 'Demande illisible : objet JSON attendu.', code: 'INVALID_BODY' }, { status: 400, headers: NO_STORE });
    }

    const parsed = CitySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'La ville doit contenir de 2 à 80 caractères.', code: 'INVALID_FIELD', field: 'city' },
            { status: 400, headers: NO_STORE },
        );
    }
    const { city } = parsed.data;

    try {
        const { data, error } = await getServiceRoleClient()
            .from('users')
            .update({ city })
            .eq('id', session.user.id)
            .select('id')
            .maybeSingle();
        if (error) return failure(error);
        if (!data) return failure(new PublicError('Compte introuvable.', 'ACCOUNT_NOT_FOUND', 404));
        return NextResponse.json({ ok: true, city }, { headers: NO_STORE });
    } catch (err) {
        return failure(err);
    }
}
