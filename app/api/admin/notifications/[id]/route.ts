import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { renderNotification, TemplateDataError } from '@/lib/notifications/catalog';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/notifications/[id] — lot 6 (contrat L2, L3, L4). Détail d'une ligne de la boîte d'envoi :
 * permission notifications.read, compte ACTIF. Réponse { item, preview } :
 *  - item : la ligne sans claim_token (RPC admin_notification_detail), destinataire, instantané de
 *    décision, données du modèle ; pour un journal synchrone (OTP, invitation) les données sont réduites à
 *    { purpose } : le code et le lien ne sont jamais conservés ni renvoyés ;
 *  - preview : aperçu rendu par le serveur avec le catalogue (titre et texte du canal), ou
 *    { available: false, reason } (journal synchrone : contenu non conservé ; variable manquante).
 * Ligne inconnue → 404 NOT_FOUND.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;
type Preview =
    | { available: true; channel: string; title: string | null; text: string }
    | { available: false; reason: string };

function notFound(): NextResponse {
    return NextResponse.json({ error: 'Notification introuvable.', code: 'NOT_FOUND' }, { status: 404, headers: NO_STORE });
}

/** Aperçu du message tel que l'envoyeur le rendrait (mêmes données : template_data, sans rien d'autre). */
function previewOf(item: Row): Preview {
    if (item.origin === 'SYNC_LOG') {
        return { available: false, reason: 'Contenu non conservé : code à usage unique.' };
    }
    const channel = String(item.channel);
    try {
        const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
        const r = renderNotification(String(item.type), channel as 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH', item.template_data, { appUrl });
        switch (r.channel) {
            case 'IN_APP': return { available: true, channel, title: r.title, text: r.content };
            case 'SMS': return { available: true, channel, title: null, text: r.text };
            case 'PUSH': return { available: true, channel, title: r.title, text: r.body };
            case 'EMAIL': return { available: true, channel, title: r.subject, text: r.text };
        }
    } catch (err) {
        if (err instanceof TemplateDataError) {
            return { available: false, reason: 'Aperçu indisponible : une donnée du modèle manque ou est invalide.' };
        }
        console.error(`[API GET /api/admin/notifications/[id]] aperçu de ${String(item.id)} :`, err instanceof Error ? err.message : String(err));
        return { available: false, reason: 'Aperçu indisponible pour le moment.' };
    }
    return { available: false, reason: 'Aperçu indisponible pour ce canal.' };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const auth = await verifyAdminAuth(req, { requiredPermission: 'notifications.read' });
    if (!auth.authorized || !auth.user) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = await Promise.resolve(context.params);
    if (typeof id !== 'string' || !UUID_RE.test(id)) return notFound();

    const { data, error } = await getServiceRoleClient().rpc('admin_notification_detail', { p: { id } });
    const body = data as { ok?: boolean; code?: string; item?: Row } | null;
    if (error || !body) {
        console.error('[API GET /api/admin/notifications/[id]] admin_notification_detail :', error ? `${error.code ?? ''} ${error.message}` : 'réponse vide');
        return NextResponse.json(
            { error: 'Le détail de cette notification est momentanément indisponible.', code: 'NOTIFICATION_UNAVAILABLE' },
            { status: 500, headers: NO_STORE },
        );
    }
    if (body.ok !== true || !body.item) {
        if (body.code === 'NOT_FOUND') return notFound();
        console.error('[API GET /api/admin/notifications/[id]] refus inattendu :', JSON.stringify(body));
        return NextResponse.json(
            { error: 'Le détail de cette notification est momentanément indisponible.', code: 'NOTIFICATION_UNAVAILABLE' },
            { status: 500, headers: NO_STORE },
        );
    }
    return NextResponse.json({ item: body.item, preview: previewOf(body.item) }, { headers: NO_STORE });
}
