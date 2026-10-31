import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { PARTNER_DOCUMENTS_BUCKET, findClaimedDocumentPath, findUploadByToken, isDocType, legacyDocumentPath } from '@/lib/partners/documents';

export const dynamic = 'force-dynamic';

const SIGNED_URL_TTL_SECONDS = 300;

function noStore(body: unknown, status = 200): NextResponse {
    return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function signedUrlFor(path: string): Promise<NextResponse> {
    const { data, error } = await getServiceRoleClient().storage.from(PARTNER_DOCUMENTS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
        console.error('[API /api/partner/documents/signed-url] URL signée impossible :', error?.message ?? 'aucune URL');
        return noStore({ error: 'Impossible de générer le lien de consultation.' }, 500);
    }
    return noStore({ success: true, signedUrl: data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
}

/**
 * GET /api/partner/documents/signed-url
 * URL signée temporaire (5 min) d'une pièce d'inscription du bucket privé partner_documents.
 *
 * Lot 1C.2 — le chemin ne vient jamais du client :
 *  - ?partnerId=…&docType=id_card|business_doc : propriétaire du dossier (partners.user_id) ou
 *    administrateur (permission partners.read) ; tout autre compte reçoit 403 ;
 *  - ?uploadToken=… : déposant pendant l'inscription, tant que la pièce n'est rattachée à aucun
 *    dossier (ensuite, accès par le dossier avec une session) ;
 *  - ?path=… (ancien contrat) : refusé.
 * Dossier antérieur au lot 1C.2 (aucune ligne partner_document_uploads) : chemin hérité servi
 * aux administrateurs seulement.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        if (searchParams.has('path')) {
            return noStore({ error: 'Paramètre « path » non pris en charge : utilisez partnerId et docType.' }, 400);
        }

        const uploadToken = searchParams.get('uploadToken');
        if (uploadToken) {
            const row = await findUploadByToken(uploadToken);
            if (!row) return noStore({ error: 'Pièce introuvable.' }, 404);
            if (row.claimed_at) return noStore({ error: 'Pièce rattachée à un dossier : consultez-la depuis votre compte.' }, 403);
            if (new Date(row.expires_at).getTime() <= Date.now()) return noStore({ error: 'Lien de dépôt expiré.' }, 410);
            return signedUrlFor(row.object_path);
        }

        const partnerId = searchParams.get('partnerId');
        const docType = searchParams.get('docType');
        if (!partnerId || !isDocType(docType)) {
            return noStore({ error: 'Paramètres partnerId et docType (id_card ou business_doc) requis.' }, 400);
        }

        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;

        const supabase = getServiceRoleClient();
        const { data: partner, error: partnerErr } = await supabase.from('partners').select('id, user_id, id_card_url, business_doc_url').eq('id', partnerId).maybeSingle();
        if (partnerErr) throw new Error(`lecture du dossier partenaire : ${partnerErr.message}`);
        if (!partner) return noStore({ error: 'Dossier partenaire introuvable.' }, 404);

        let authorized = partner.user_id === user.id;
        let asAdmin = false;
        if (!authorized && serverIsAdmin(user)) {
            const adminAuth = await verifyAdminAuth(req, { requiredPermission: 'partners.read' });
            if (!adminAuth.authorized) return adminAuth.errorResponse!;
            authorized = true;
            asAdmin = true;
        }
        if (!authorized) {
            console.warn(`[API /api/partner/documents/signed-url] compte ${user.id} : accès refusé au dossier ${partnerId}`);
            return noStore({ error: 'Accès non autorisé à ce document.' }, 403);
        }

        const claimedPath = await findClaimedDocumentPath(partnerId, docType);
        const legacyPath = !claimedPath && asAdmin ? legacyDocumentPath(partner, docType) : null;
        const path = claimedPath ?? legacyPath;
        if (!path) return noStore({ error: 'Pièce non fournie pour ce dossier.' }, 404);

        const { error: auditErr } = await supabase.from('audit_logs').insert({
            user_id: user.id,
            user_role: user.role,
            action: 'PARTNER_DOCUMENT_VIEWED',
            object_type: 'partners',
            object_id: partnerId,
            metadata: { doc_type: docType, ...(legacyPath ? { legacy_path: true } : {}) },
        });
        if (auditErr) console.error('[API /api/partner/documents/signed-url] journalisation impossible :', auditErr.message);

        return signedUrlFor(path);
    } catch (err: unknown) {
        console.error('[API /api/partner/documents/signed-url] Exception :', err instanceof Error ? err.message : err);
        return noStore({ error: 'Erreur interne du serveur.' }, 500);
    }
}
