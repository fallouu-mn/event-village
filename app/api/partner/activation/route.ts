import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/activation
 * Démarre de manière IDEMPOTENTE la période d'essai lors de la première connexion du partenaire validé (§7).
 * Lot 1B.6 : uniquement pour la fiche partenaire du compte connecté, lui-même ACTIF. Les champs
 * historiques `partnerId` / `userId` du corps doivent désigner cette même fiche.
 */
export async function POST(req: NextRequest) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;

        let body: { partnerId?: string; userId?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        const { data: ownPartner, error: ownErr } = await supabase
            .from('partners')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
        if (ownErr) {
            console.error('[API /api/partner/activation] lecture de la fiche partenaire :', ownErr.message);
            return NextResponse.json({ error: 'Lecture de la fiche partenaire impossible.' }, { status: 500 });
        }
        if (!ownPartner) {
            return NextResponse.json({ error: 'Aucune fiche partenaire associée à ce compte.' }, { status: 403 });
        }
        if ((body.userId && body.userId !== user.id) || (body.partnerId && body.partnerId !== ownPartner.id)) {
            console.warn(`[API /api/partner/activation] compte ${user.id} : activation d'une autre fiche refusée`);
            return NextResponse.json({ error: 'Vous ne pouvez activer que votre propre fiche partenaire.', code: 'FORBIDDEN_OTHER_PARTNER' }, { status: 403 });
        }
        const partnerId = ownPartner.id;

        // 1. Récupération du partenaire
        const { data: partner, error: fetchErr } = await supabase
            .from('partners')
            .select('*, users(*)')
            .eq('id', partnerId)
            .maybeSingle();

        if (fetchErr || !partner) {
            return NextResponse.json({ error: 'Fiche partenaire introuvable.' }, { status: 404 });
        }

        // Vérifier que le statut est au moins VALIDE ou ACTIF
        if (partner.status === 'EN_ATTENTE' || partner.status === 'REJETE') {
            return NextResponse.json(
                { error: 'Le compte partenaire doit d\'abord être validé par un administrateur.' },
                { status: 403 }
            );
        }

        // 2. Fonction SQL idempotente. Lot 6 (J2.8) : elle met en file TRIAL_STARTED (in-app, SMS) dans
        //    sa transaction à la première activation ; plus de repli JavaScript (il écrivait un statut
        //    partenaire inexistant et envoyait le SMS directement) : un échec de la RPC donne 500.
        const { data: activationResult, error: rpcErr } = await supabase.rpc('activate_partner_trial', { p_partner_id: partnerId });
        if (rpcErr || !activationResult) {
            console.error('[API /api/partner/activation] activate_partner_trial :', rpcErr?.message ?? 'réponse vide');
            return NextResponse.json({ error: 'Activation de la période d’essai momentanément impossible.', code: 'TRIAL_ACTIVATION_FAILED' }, { status: 500 });
        }
        const reply = activationResult as { success?: boolean };
        if (reply.success !== true) {
            console.error('[API /api/partner/activation] activation refusée :', JSON.stringify(activationResult));
            return NextResponse.json({ error: 'Fiche partenaire introuvable.', code: 'PARTNER_NOT_FOUND' }, { status: 404 });
        }

        return NextResponse.json(activationResult);
    } catch (err: unknown) {
        console.error('[API /api/partner/activation]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Activation de la période d’essai momentanément impossible.', code: 'TRIAL_ACTIVATION_FAILED' }, { status: 500 });
    }
}
