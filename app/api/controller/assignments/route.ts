import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser, serverHasAnyRole } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const COUNTER_SALE_KEY = 'access.counter_sale_enabled';

/** Réglage SUPERADMIN du guichet (platform_settings) ; absent ou non booléen : erreur explicite. */
async function readCounterSaleEnabled(): Promise<boolean> {
    const { data, error } = await getServiceRoleClient().from('platform_settings').select('value').eq('key', COUNTER_SALE_KEY).maybeSingle();
    if (error) throw new Error(`lecture du réglage ${COUNTER_SALE_KEY} : ${error.message}`);
    const value = (data?.value as { value?: unknown } | null | undefined)?.value;
    if (typeof value !== 'boolean') throw new Error(`réglage ${COUNTER_SALE_KEY} absent ou non booléen : ${JSON.stringify(data?.value ?? null)}`);
    return value;
}

interface ScanState {
    open: boolean;
    problem: string | null;
    opens_at: string | null;
    closes_at: string | null;
}

/**
 * Lot 9 bis (R16, B48) : état du contrôle de chaque événement affecté, dit par le serveur (RPC scan_states, même
 * règle que ticket_scan). Une seule lecture pour toutes les affectations ; en échec, erreur explicite.
 */
async function readScanStates(eventIds: string[]): Promise<Map<string, ScanState>> {
    const states = new Map<string, ScanState>();
    if (eventIds.length === 0) return states;
    const { data, error } = await getServiceRoleClient().rpc('scan_states', { p: { event_ids: Array.from(new Set(eventIds)) } });
    if (error) throw new Error(`scan_states : ${error.message}`);
    const reply = data as { ok?: boolean; items?: Array<ScanState & { event_id: string }> } | null;
    if (!reply || reply.ok !== true || !Array.isArray(reply.items)) throw new Error(`scan_states : réponse inattendue ${JSON.stringify(reply)}`);
    for (const item of reply.items) {
        states.set(item.event_id, { open: item.open === true, problem: item.problem ?? null, opens_at: item.opens_at ?? null, closes_at: item.closes_at ?? null });
    }
    return states;
}

/**
 * Lot 9 bis (R17, B49) : caisse OUVERT du compte par événement (identifiant), lue même sans droit d'encaisser : une
 * caisse ouverte avant le retrait du droit reste joignable pour être fermée. En échec, erreur explicite.
 */
async function readOpenShifts(userId: string, eventIds: string[]): Promise<Map<string, string>> {
    const shifts = new Map<string, string>();
    if (eventIds.length === 0) return shifts;
    const { data, error } = await getServiceRoleClient()
        .from('controller_shifts')
        .select('id, event_id')
        .eq('controller_id', userId)
        .eq('status', 'OUVERT')
        .in('event_id', Array.from(new Set(eventIds)));
    if (error) throw new Error(`caisses ouvertes : ${error.message}`);
    for (const row of data ?? []) shifts.set(String(row.event_id), String(row.id));
    return shifts;
}

/**
 * GET /api/controller/assignments — événements auxquels le contrôleur connecté est affecté, avec leurs
 * compteurs. Lot 7 (D42, D53, contrat 3.3) : chaque affectation porte son point d'entrée (`entry_point`) et
 * `counter_sale_enabled` (réglage access.counter_sale_enabled) ; « Arrivées » (`stats.scanned_today`, nom
 * gardé) = toutes les entrées de l'événement, plus coupées à minuit UTC (un concert de 22 h à 3 h gardait
 * son compteur jusqu'à minuit seulement). Lot 9 bis (R16, contrat 4.3) : `scan { open, problem, opens_at,
 * closes_at }` par affectation ; le scanner décide par `scan.open`. Lot 9 bis (R17, contrat 4.3) : `open_shift`
 * (identifiant de la caisse ouverte du compte, ou null) par affectation.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        if (!serverHasAnyRole(user, ['CONTROLEUR', 'ADMIN', 'SUPERADMIN'])) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const supabase = getServiceRoleClient();

        // Assignations + infos événement
        const { data: assignments, error } = await supabase
            .from('event_controllers')
            .select(`
                id,
                can_accept_cash,
                entry_point,
                events (
                    id,
                    title,
                    start_date,
                    start_time,
                    location,
                    status,
                    image_url
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[GET assignments]', error.message);
            return NextResponse.json({ error: 'Impossible de charger vos assignations.' }, { status: 500 });
        }

        const counterSaleEnabled = await readCounterSaleEnabled();
        const eventIds: string[] = (assignments ?? []).map((a: any) => a.events?.id).filter((id: unknown): id is string => typeof id === 'string');
        const scanStates = await readScanStates(eventIds);
        const openShifts = await readOpenShifts(user.id, eventIds);

        // Compteurs de chaque événement affecté (lus par le serveur, toute la durée de l'événement)
        const enriched = await Promise.all(
            (assignments ?? []).map(async (a: any) => {
                const eventId = a.events?.id;
                const formattedEvent = a.events ? {
                    ...a.events,
                    date: a.events.start_date,
                    cover_image_url: a.events.image_url,
                } : null;
                const base = {
                    ...a,
                    entry_point: typeof a.entry_point === 'string' && a.entry_point.trim() !== '' ? a.entry_point : null,
                    counter_sale_enabled: counterSaleEnabled,
                    scan: eventId ? scanStates.get(eventId) ?? null : null,
                    open_shift: eventId ? openShifts.get(eventId) ?? null : null,
                    events: formattedEvent,
                };

                if (!eventId) return { ...base, stats: { scanned_today: 0, total_tickets: 0 } };

                const [arrivals, total] = await Promise.all([
                    supabase
                        .from('tickets')
                        .select('id', { count: 'exact', head: true })
                        .eq('event_id', eventId)
                        .eq('status', 'UTILISE'),
                    supabase
                        .from('tickets')
                        .select('id', { count: 'exact', head: true })
                        .eq('event_id', eventId)
                        .in('status', ['VALIDE', 'UTILISE']),
                ]);
                if (arrivals.error) throw new Error(`arrivées de l'événement ${eventId} : ${arrivals.error.message}`);
                if (total.error) throw new Error(`billets de l'événement ${eventId} : ${total.error.message}`);

                return {
                    ...base,
                    stats: {
                        scanned_today: arrivals.count ?? 0,
                        total_tickets: total.count ?? 0,
                    },
                };
            })
        );

        // Récupérer le nom du contrôleur
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', user.id)
            .maybeSingle();
        if (profileError) throw new Error(`profil du contrôleur : ${profileError.message}`);

        return NextResponse.json({
            success: true,
            assignments: enriched,
            controller: {
                id: user.id,
                first_name: profile?.first_name ?? '',
                last_name: profile?.last_name ?? '',
            },
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        console.error('[API /api/controller/assignments]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}
