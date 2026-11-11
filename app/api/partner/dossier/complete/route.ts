import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { noStore } from '@/lib/auth/account-sync';
import { requireActiveSession } from '@/lib/auth/session';
import { resolveRegistrationUploads } from '@/lib/partners/documents';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/partner/dossier/complete';
const FAILURE = { error: 'Envoi du dossier momentanément impossible. Réessayez.', code: 'DOSSIER_RESUBMIT_FAILED' };

const BodySchema = z.object({
    upload_ids: z.array(z.string().trim().min(1).max(200)).length(2, 'Déposez la pièce d’identité et le document de l’entreprise.'),
    ninea: z.string().trim().max(40, 'Le NINEA fait 40 caractères au plus.').optional().nullable(),
    rccm: z.string().trim().max(40, 'Le RCCM fait 40 caractères au plus.').optional().nullable(),
}).strict();

/** Refus de partner_dossier_resubmit (M04) → statut HTTP ; le texte vient de la RPC (contrat 4.2). */
const REFUSALS: Readonly<Record<string, number>> = {
    INVALID_INPUT: 400,
    PARTNER_NOT_FOUND: 404,
    DOSSIER_NOT_REJECTED: 409,
    RESUBMIT_ALREADY_USED: 409,
    INVALID_DOCUMENT_UPLOAD: 409,
};

/** Pièces des jetons de dépôt, dans l'ordre reçu ou l'ordre inverse (le type de chaque pièce est lu en base). */
async function resolveTokens(tokens: string[]) {
    const direct = await resolveRegistrationUploads({ id_card: tokens[0], business_doc: tokens[1] });
    if (direct.ok) return direct;
    const swapped = await resolveRegistrationUploads({ id_card: tokens[1], business_doc: tokens[0] });
    return swapped.ok ? swapped : direct;
}

async function handle(req: NextRequest): Promise<NextResponse> {
    // EN_ATTENTE admis : après un complément, le compte est de nouveau en attente ; un second essai doit lire
    // RESUBMIT_ALREADY_USED, pas un refus de compte.
    const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (session.response) return session.response;
    const { user } = session;

    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return NextResponse.json({ error: issue?.message ?? 'Dossier incomplet.', code: 'INVALID_FIELD', field: issue?.path[0] ?? null }, { status: 400 });
    }

    try {
        const documents = await resolveTokens(parsed.data.upload_ids);
        if (!documents.ok) {
            return NextResponse.json({ error: documents.error, code: 'INVALID_DOCUMENT_UPLOAD' }, { status: 400 });
        }
        const { data, error } = await getServiceRoleClient().rpc('partner_dossier_resubmit', {
            p: {
                user_id: user.id,
                upload_ids: [documents.uploads.id_card.id, documents.uploads.business_doc.id],
                id_card_url: documents.uploads.id_card.object_path,
                business_doc_url: documents.uploads.business_doc.object_path,
                ninea: parsed.data.ninea || null,
                rccm: parsed.data.rccm || null,
            },
        });
        if (error || !data) {
            console.error(`[${CONTEXT}] partner_dossier_resubmit :`, error ? `${error.code ?? ''} ${error.message}` : 'réponse vide');
            return NextResponse.json(FAILURE, { status: 500 });
        }
        const reply = data as { ok?: boolean; code?: string; message?: string; status?: string };
        if (reply.ok !== true) {
            const status = REFUSALS[String(reply.code)];
            if (!status || typeof reply.message !== 'string') {
                console.error(`[${CONTEXT}] refus non répertorié :`, JSON.stringify(reply));
                return NextResponse.json(FAILURE, { status: 500 });
            }
            return NextResponse.json({ error: reply.message, code: reply.code }, { status });
        }
        return NextResponse.json({ ok: true, status: reply.status, message: 'Dossier envoyé : il est de nouveau en cours de vérification.' });
    } catch (err) {
        console.error(`[${CONTEXT}]`, err instanceof Error ? err.message : String(err));
        return NextResponse.json(FAILURE, { status: 500 });
    }
}

/**
 * POST /api/partner/dossier/complete — lot 9 bis, tâche 17 (R54 ; contrat 4.2, B41) : la partenaire dont le dossier a
 * été refusé le complète une seule fois. `{ upload_ids: [jeton de la pièce d'identité, jeton du document de
 * l'entreprise], ninea?, rccm? }` (jetons rendus par POST /api/partner/documents/upload). 200 « Dossier envoyé : il est
 * de nouveau en cours de vérification. » ; 409 DOSSIER_NOT_REJECTED ; 409 RESUBMIT_ALREADY_USED ; 400 pièce introuvable.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
