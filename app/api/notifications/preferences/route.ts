import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Lot 6 (contrat H1, H2) — préférences de notification du compte connecté.
 *
 * GET : sujets optionnels (« Rappels avant l'événement », « Changements d'un événement », et pour un
 *   partenaire « Activité de vos ventes »), une ligne par canal avec son état (absence de ligne en base =
 *   activé), et la liste des messages indispensables, toujours envoyés.
 * PUT { topic, channel, enabled } : un sujet optionnel et un canal ; tout autre sujet (indispensable,
 *   inconnu), canal inconnu ou valeur non booléenne → 400 INVALID_PREFERENCE, sans écriture.
 * Compte ACTIF ou EN_ATTENTE ; suspendu → 403 ; sans session → 401. Écritures par la RPC
 * notification_preference_set (service_role) ; une préférence coupée donne des lignes SKIPPED
 * PREFERENCE_DISABLED dans la boîte d'envoi, jamais une absence.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };

const TOPICS = ['REMINDERS', 'EVENT_UPDATES', 'PRO_ACTIVITY'] as const;
type Topic = (typeof TOPICS)[number];
const CHANNELS = ['IN_APP', 'SMS', 'EMAIL', 'PUSH'] as const;
type Channel = (typeof CHANNELS)[number];

const TOPIC_TEXT: Record<Topic, { label: string; description: string }> = {
    REMINDERS: {
        label: 'Rappels avant l’événement',
        description: 'La veille et quelques heures avant le début d’un événement dont vous avez un billet (et, pour un contrôleur, la veille de chaque affectation).',
    },
    EVENT_UPDATES: {
        label: 'Changements d’un événement',
        description: 'Nouvelle date, nouveau lieu, suspension ou reprise d’un événement dont vous avez un billet.',
    },
    PRO_ACTIVITY: {
        label: 'Activité de vos ventes',
        description: 'Premier billet vendu, nouvelles commandes, catégories et événements complets.',
    },
};

const CHANNEL_LABELS: Record<Channel, string> = {
    IN_APP: 'Application',
    SMS: 'SMS',
    EMAIL: 'Email',
    PUSH: 'Notifications push',
};

/** Messages indispensables (H1), toujours envoyés : présentés tels quels, sans réglage. */
const ESSENTIALS = [
    'Codes de connexion',
    'Confirmations d’achat et reçus',
    'Billets transférés',
    'Annulations',
    'Remboursements',
    'Sécurité du compte',
];

const INVALID_PREFERENCE_MESSAGE =
    'Préférence inconnue : seuls les rappels, les changements d’un événement et l’activité des ventes se règlent, canal par canal. Les messages indispensables sont toujours envoyés.';

const PutSchema = z.object({
    topic: z.enum(TOPICS),
    channel: z.enum(CHANNELS),
    enabled: z.boolean(),
}).strict();

interface PreferencesRpc {
    ok?: boolean;
    code?: string;
    message?: string;
    topics?: Array<{ topic: string; channels: Record<string, unknown> }>;
    is_partner?: boolean;
}

function unavailable(what: string, detail: string): NextResponse {
    console.error(`[API /api/notifications/preferences] ${what} :`, detail);
    return NextResponse.json(
        { error: 'Vos préférences de notification sont momentanément indisponibles. Réessayez dans un instant.', code: 'PREFERENCES_UNAVAILABLE' },
        { status: 500, headers: NO_STORE },
    );
}

function invalidPreference(): NextResponse {
    return NextResponse.json({ error: INVALID_PREFERENCE_MESSAGE, code: 'INVALID_PREFERENCE' }, { status: 400, headers: NO_STORE });
}

async function readPreferences(userId: string): Promise<{ ok: true; body: PreferencesRpc } | { ok: false; response: NextResponse }> {
    const { data, error } = await getServiceRoleClient().rpc('notification_preferences_get', { p: { user_id: userId } });
    const body = data as PreferencesRpc | null;
    if (error || !body || body.ok !== true || !Array.isArray(body.topics)) {
        return { ok: false, response: unavailable('notification_preferences_get', error ? `${error.code ?? ''} ${error.message}` : JSON.stringify(body)) };
    }
    return { ok: true, body };
}

export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (session.response) return session.response;

    const prefs = await readPreferences(session.user.id);
    if (!prefs.ok) return prefs.response;
    const isPartner = prefs.body.is_partner === true;

    const topics = [];
    for (const t of prefs.body.topics ?? []) {
        if (!(TOPICS as readonly string[]).includes(t.topic)) {
            return unavailable('sujet inattendu', JSON.stringify(t.topic));
        }
        const topic = t.topic as Topic;
        if (topic === 'PRO_ACTIVITY' && !isPartner) continue;
        const channels = [];
        for (const c of CHANNELS) {
            const enabled = t.channels?.[c];
            if (typeof enabled !== 'boolean') {
                return unavailable('état de canal illisible', `${topic}/${c} = ${JSON.stringify(enabled)}`);
            }
            channels.push({ channel: c, label: CHANNEL_LABELS[c], enabled });
        }
        topics.push({ topic, label: TOPIC_TEXT[topic].label, description: TOPIC_TEXT[topic].description, channels });
    }

    return NextResponse.json({ topics, essentials: ESSENTIALS }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest) {
    const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (session.response) return session.response;

    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400, headers: NO_STORE });
    }
    const parsed = PutSchema.safeParse(raw);
    if (!parsed.success) return invalidPreference();

    // « Activité de vos ventes » n'est présentée qu'aux partenaires : un autre compte ne la règle pas.
    if (parsed.data.topic === 'PRO_ACTIVITY') {
        const prefs = await readPreferences(session.user.id);
        if (!prefs.ok) return prefs.response;
        if (prefs.body.is_partner !== true) return invalidPreference();
    }

    const { data, error } = await rpcWithRetry<{ ok?: boolean; code?: string; message?: string }>('notification_preference_set', {
        p: { user_id: session.user.id, topic: parsed.data.topic, channel: parsed.data.channel, enabled: parsed.data.enabled },
    });
    if (error || !data) {
        return unavailable('notification_preference_set', error ? `${error.code ?? ''} ${error.message}` : 'réponse vide');
    }
    if (data.ok !== true) {
        if (data.code === 'INVALID_PREFERENCE') return invalidPreference();
        return unavailable('notification_preference_set refusée', JSON.stringify(data));
    }
    return NextResponse.json({ success: true }, { headers: NO_STORE });
}
