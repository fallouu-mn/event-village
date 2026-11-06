import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { PartnerActivityTypes, toSenegaleseE164 } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

/**
 * Profil professionnel du partenaire connecté (page /partner/profile).
 *  - GET : la fiche et ses activités, colonnes publiques seulement (les pièces déposées à l'inscription ne
 *    sont pas renvoyées) ; rôle partenaire exigé.
 *  - PATCH (lot 7, 7.0 f, D72) : corps validé par Zod avant toute écriture. Refus : 400
 *    `{ error, code: 'INVALID_FIELD', field }`, message en français, jamais le texte de la base. Numéro
 *    normalisé en E.164 sénégalais ; logo et couverture : adresse du stockage public du projet déposée pour ce
 *    partenaire (ImageUpload), ou valeur déjà enregistrée ; activités dans la liste fermée, au moins une.
 *    Lot 8 (8.2 l, contrat 8.4) : fiche et activités s'écrivent dans une seule transaction, par la RPC
 *    partner_profile_update (20261106000006_lot8_profil.sql) : un échec n'écrit rien, 500 PROFILE_SAVE_FAILED.
 *    La route garde toute la validation. Une clé absente de `fields` laisse la colonne inchangée, une clé à
 *    null la vide ; `activities: null` laisse les activités inchangées. La lecture finale reste hors transaction.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };

const PUBLIC_COLUMNS = 'id, company_name, commercial_name, description, logo_url, cover_url, address, city, latitude, longitude, phone, email, status, partner_activities(activity_type, is_active)';

const FIELD_LABELS: Record<string, string> = {
    company_name: 'Le nom de l’entreprise',
    commercial_name: 'Le nom commercial',
    description: 'La description',
    logo_url: 'Le logo',
    cover_url: 'La photo de couverture',
    address: 'L’adresse',
    city: 'La ville',
    latitude: 'La latitude',
    longitude: 'La longitude',
    phone: 'Le numéro de téléphone',
    email: 'L’email professionnel',
    activities: 'Les activités',
};

/** Chaîne vide ou espaces → null (champ vidé). */
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Messages des refus : complément du libellé du champ (« Le nom commercial : 150 caractères au plus. »). */
const TYPE_ERROR = { invalid_type_error: 'valeur de type inattendu.' };

const text = (min: number, max: number) => z.string(TYPE_ERROR).trim()
    .min(min, `${min} caractères au moins.`)
    .max(max, `${max} caractères au plus.`);
const optionalText = (max: number) => z.preprocess(blankToNull, text(0, max).nullable());
const coordinate = (limit: number) => z.number(TYPE_ERROR).finite('nombre attendu.')
    .min(-limit, `nombre compris entre -${limit} et ${limit} attendu.`)
    .max(limit, `nombre compris entre -${limit} et ${limit} attendu.`)
    .nullable();

const ProfilePatchSchema = z.object({
    company_name: text(2, 150),
    commercial_name: optionalText(150),
    description: optionalText(2000),
    address: optionalText(200),
    city: z.preprocess(blankToNull, text(2, 80).nullable()),
    latitude: coordinate(90),
    longitude: coordinate(180),
    phone: z.preprocess(blankToNull, text(0, 20).nullable()),
    email: z.preprocess(blankToNull, text(0, 200).email('adresse invalide.').nullable()),
    logo_url: z.preprocess(blankToNull, text(0, 600).nullable()),
    cover_url: z.preprocess(blankToNull, text(0, 600).nullable()),
    activities: z.array(z.enum(PartnerActivityTypes, { errorMap: () => ({ message: 'activité hors de la liste proposée.' }) }), TYPE_ERROR)
        .min(1, 'choisissez au moins une activité.')
        .max(PartnerActivityTypes.length, 'liste trop longue.'),
}).partial();

type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

function invalidField(field: string, detail?: string): NextResponse {
    const label = FIELD_LABELS[field] ?? 'Une valeur';
    return NextResponse.json(
        { error: `${label} : ${detail ?? 'valeur invalide.'}`, code: 'INVALID_FIELD', field },
        { status: 400, headers: NO_STORE },
    );
}

function serverError(context: string, detail: string): NextResponse {
    console.error(`[API /api/partner/profile] ${context} :`, detail);
    return NextResponse.json(
        { error: 'Le profil n’a pas pu être enregistré. Réessayez dans un instant.', code: 'PROFILE_SAVE_FAILED' },
        { status: 500, headers: NO_STORE },
    );
}

/** Image du stockage public du projet, déposée pour ce partenaire (`public-images/<dossier>/<partner_id>/…`). */
function isPartnerImageUrl(url: string, partnerId: string): boolean {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    if (!base) return false;
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    const baseUrl = new URL(base);
    // https exigé, sauf si le projet lui-même est servi en http (base locale de développement et de test).
    if (parsed.protocol !== 'https:' && !(baseUrl.protocol === 'http:' && parsed.protocol === 'http:')) return false;
    if (parsed.origin !== baseUrl.origin) return false;
    const prefix = '/storage/v1/object/public/public-images/';
    if (!parsed.pathname.startsWith(prefix)) return false;
    const segments = parsed.pathname.slice(prefix.length).split('/');
    return segments.length >= 3 && segments[1] === partnerId && !segments.includes('..');
}

export async function GET(request: NextRequest) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux partenaires.', code: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
    }
    const { data: partner, error } = await getServiceRoleClient()
        .from('partners')
        .select(PUBLIC_COLUMNS)
        .eq('user_id', user.id)
        .maybeSingle();
    if (error) {
        console.error('[API GET /api/partner/profile] lecture de la fiche :', error.message);
        return NextResponse.json({ error: 'Profil momentanément indisponible. Réessayez.', code: 'PROFILE_UNAVAILABLE' }, { status: 500, headers: NO_STORE });
    }
    if (!partner) {
        return NextResponse.json({ error: 'Profil partenaire introuvable.', code: 'PARTNER_NOT_FOUND' }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ success: true, partner }, { headers: NO_STORE });
}

export async function PATCH(request: NextRequest) {
    const activeSession = await requireActiveSession(request);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux partenaires.', code: 'FORBIDDEN' }, { status: 403, headers: NO_STORE });
    }

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400, headers: NO_STORE });
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return NextResponse.json({ error: 'Demande illisible : objet JSON attendu.', code: 'INVALID_BODY' }, { status: 400, headers: NO_STORE });
    }

    const parsed = ProfilePatchSchema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = typeof issue?.path[0] === 'string' ? issue.path[0] : 'body';
        return invalidField(field, issue?.message);
    }
    const input: ProfilePatch = parsed.data;

    const supabase = getServiceRoleClient();
    const { data: existing, error: readErr } = await supabase
        .from('partners')
        .select('id, logo_url, cover_url')
        .eq('user_id', user.id)
        .maybeSingle();
    if (readErr) return serverError('lecture de la fiche', readErr.message);
    if (!existing) {
        return NextResponse.json({ error: 'Profil partenaire introuvable.', code: 'PARTNER_NOT_FOUND' }, { status: 404, headers: NO_STORE });
    }

    const update: Record<string, unknown> = {};
    for (const key of ['company_name', 'commercial_name', 'description', 'address', 'city', 'latitude', 'longitude', 'email'] as const) {
        if (input[key] !== undefined) update[key] = input[key];
    }
    if (input.phone !== undefined) {
        if (input.phone === null) update.phone = null;
        else {
            const e164 = toSenegaleseE164(input.phone);
            if (!e164) return invalidField('phone', 'numéro mobile sénégalais attendu (par exemple 77 123 45 67).');
            update.phone = e164;
        }
    }
    for (const key of ['logo_url', 'cover_url'] as const) {
        const value = input[key];
        if (value === undefined) continue;
        if (value !== null && value !== existing[key] && !isPartnerImageUrl(value, existing.id)) {
            return invalidField(key, 'déposez l’image depuis cette page (stockage Event Village).');
        }
        update[key] = value;
    }

    // Corps vide : rien à écrire, la fiche est relue telle quelle (aucune entrée vide n'atteint la RPC).
    if (Object.keys(update).length > 0 || input.activities !== undefined) {
        const { data: saved, error: saveErr } = await rpcWithRetry('partner_profile_update', {
            p: {
                partner_id: existing.id,
                user_id: user.id,
                fields: update,
                activities: input.activities !== undefined ? Array.from(new Set(input.activities)) : null,
            },
        });
        if (saveErr) return serverError('enregistrement du profil', `${saveErr.code ?? ''} ${saveErr.message}`);
        const outcome = saved as { ok?: unknown; code?: unknown } | null;
        if (outcome?.ok !== true) {
            if (outcome?.code === 'PARTNER_NOT_FOUND') {
                return NextResponse.json({ error: 'Profil partenaire introuvable.', code: 'PARTNER_NOT_FOUND' }, { status: 404, headers: NO_STORE });
            }
            return serverError('enregistrement du profil', `réponse inattendue : ${JSON.stringify(saved)}`);
        }
    }

    const { data: partner, error: rereadErr } = await supabase.from('partners').select(PUBLIC_COLUMNS).eq('id', existing.id).single();
    if (rereadErr || !partner) return serverError('relecture de la fiche', rereadErr?.message ?? 'réponse vide');
    return NextResponse.json({ success: true, partner }, { headers: NO_STORE });
}
