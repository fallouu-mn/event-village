import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { UUID_RE, deliverHandoverCode, orderNotFound, orderRefusal } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/** Réponse qui porte le code : jamais gardée par le navigateur, un intermédiaire ni le service worker. */
const SECRET_HEADERS = { 'Cache-Control': 'no-store, private, max-age=0', Pragma: 'no-cache', Expires: '0' };

/**
 * GET /api/orders/[id]/code — lot 12b (décision 1 du client, 21/11) : le code de remise affiché dans la commande, pour
 * le client connecté de la commande seulement (order_code_reveal) : compte actif, commande ouverte prête à retirer ou en
 * route, code émis et toujours valable. Gardé chiffré en base (private.order_codes), jamais lisible par la partenaire,
 * le livreur ni l'administration, jamais en file, notification du téléphone ni email ; cette réponse n'est jamais mise en
 * cache (en-têtes ci-dessus) et rien n'est journalisé du code. Commande d'un autre compte : « Commande introuvable » (404).
 * Sans interrupteur, comme le suivi : le client garde son code même si le service vient d'être fermé.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const { data, error } = await getServiceRoleClient().rpc('order_code_reveal', { p: { order_id: id, client_id: session.user.id } });
        if (error) throw new Error(`order_code_reveal : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) {
            const res = orderRefusal(r, 'Code momentanément indisponible.');
            for (const [k, v] of Object.entries(SECRET_HEADERS)) res.headers.set(k, v);
            return res;
        }
        return NextResponse.json({
            success: true,
            code: String(r.code),
            issuedAt: r.issued_at ?? null,
            locked: r.locked === true,
            resendsLeft: Number(r.resends_left ?? 0),
        }, { headers: SECRET_HEADERS });
    } catch (err: unknown) {
        const res = apiFailure('GET /api/orders/[id]/code', err, { message: 'Code momentanément indisponible. Réessayez.', code: 'ORDER_CODE_UNAVAILABLE', status: 500 });
        for (const [k, v] of Object.entries(SECRET_HEADERS)) res.headers.set(k, v);
        return res;
    }
}

/**
 * POST /api/orders/[id]/code — le client demande un nouveau code de remise (perdu, ou trop d'essais) : order_code_resend.
 * Le code part par SMS immédiat (ORDER_HANDOVER_CODE, journal sans le code) ; l'ancien ne vaut plus ; nombre de
 * demandes borné (orders.code_resend_max). Le code n'est jamais rendu dans la réponse ni stocké en clair.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const { data, error } = await getServiceRoleClient().rpc('order_code_resend', { p: { order_id: id, client_id: session.user.id } });
        if (error) throw new Error(`order_code_resend : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Nouveau code impossible pour le moment.');
        await deliverHandoverCode(r, session.user.id);
        return NextResponse.json({
            success: true,
            message: 'Un nouveau code vous est envoyé par SMS. L’ancien ne marche plus.',
            resendsLeft: Number(r.resends_left),
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/orders/[id]/code', err, { message: 'Nouveau code impossible pour le moment. Réessayez.', code: 'ORDER_CODE_FAILED' });
    }
}
