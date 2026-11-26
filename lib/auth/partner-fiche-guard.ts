/**
 * Lot 9 quinquies (A9, contre-vérification du lot 9 quater, point 2) — droits d'une partenaire selon le statut de sa
 * FICHE partenaire (partners.status), et non plus seulement selon le statut de son compte.
 *
 * Règle (décision du chef de projet) :
 *  - fiche VALIDE : tout ce que la route permet (inchangé) ;
 *  - fiche SUSPENDU : lectures gardées ; finition 2a (1a) : toute écriture d'événement refusée (création, modification,
 *    billets, zones, transitions, annulation, invitations, remboursements, code du régisseur, dépôt d'image) avec
 *    PARTNER_SUSPENDED et le contact du support ; correctifs de la contre-vérification (T1, T2) : de même toute écriture de
 *    l'équipe (/api/partner/team/*) et des caisses (/api/partner/shifts/*) ; les autres routes inchangées ; la base refuse
 *    aussi (migrations 20261116000001, 20261116000004 et 20261116000005) ;
 *  - fiche EN_ATTENTE : seulement la lecture du tableau de bord, du profil, des pièces, et le complément de dossier ;
 *  - fiche REJETE : le complément de dossier seulement (avec la lecture du tableau de bord, qui porte le motif et le
 *    bouton « Compléter mon dossier », et des pièces) ;
 *  - aucune fiche : rien.
 * Les routes qui refusent déjà une fiche non validée avec leur propre texte (création, transition, dépôt d'image) gardent
 * leur refus (même code PARTNER_NOT_VALIDATED). La transition appelle partnerTransitionFicheRefusal avant de lire le corps :
 * la base ne refuse que la soumission et la publication (EN_ATTENTE, PUBLIE) ; toute autre transition (retrait, annulation…)
 * d'une fiche non validée est refusée ici (run 171).
 * Appliqué par requireActiveSession (lib/auth/session.ts) à toutes les routes /api/partner/* et aux routes /api/controller/*
 * d'une partenaire qui n'est pas aussi contrôleur (scan et caisse de ses propres événements), pour un compte qui a le
 * rôle PARTENAIRE sans être ADMIN ni SUPERADMIN. Côté base, is_partner_owner exige la même fiche (migration 20261112000005).
 * Lecture en échec : 503, jamais un passage.
 */
import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { supportSentenceOrHelp } from '@/lib/support-contact';

export const PARTNER_NOT_VALIDATED_TEXT = 'Votre profil d’organisateur doit être validé avant cette action.';
/** Texte de la base pour la soumission et la publication (event_transition, 20261109000008_lot9bis_cycle.sql), repris tel quel. */
export const PARTNER_NOT_VALIDATED_SUBMIT_TEXT = 'Votre profil d’organisateur doit être validé avant de soumettre ou de publier un événement.';

/** Finition 2a (1a) : refus d'une écriture d'événement pour une fiche SUSPENDU (texte de la base), suivi du contact. */
export const PARTNER_SUSPENDED_TEXT = 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.';

/** Contre-vérification du lot 10b (T1) : refus d'une écriture de salle pour une fiche SUSPENDU. */
export const PARTNER_SUSPENDED_HALLS_TEXT = 'Votre compte organisateur est suspendu : vos salles et leurs réservations ne sont plus modifiables. Contactez le support.';

/** Lot 11b (F1) : refus d'une écriture d'établissement, de zone, de table ou de réservation de table pour une fiche SUSPENDU. */
export const PARTNER_SUSPENDED_TABLES_TEXT = 'Votre compte organisateur est suspendu : vos établissements et leurs réservations ne sont plus modifiables. Contactez le support.';

type FicheStatus = 'VALIDE' | 'SUSPENDU' | 'EN_ATTENTE' | 'REJETE';

/** Route et méthode : `GET /api/partner/dashboard`. Un segment dynamique s'écrit `*`. */
type RouteKey = string;

const READ_PENDING: readonly RouteKey[] = [
    'GET /api/partner/dashboard',
    'GET /api/partner/profile',
    'GET /api/partner/documents/signed-url',
    'POST /api/partner/dossier/complete',
];

const READ_REJECTED: readonly RouteKey[] = [
    'GET /api/partner/dashboard',
    'GET /api/partner/documents/signed-url',
    'POST /api/partner/dossier/complete',
];

/** Routes qui refusent elles-mêmes une fiche non validée (texte propre, même code PARTNER_NOT_VALIDATED). */
const OWN_REFUSAL: readonly RouteKey[] = [
    'POST /api/partner/events',
    'POST /api/partner/events/*/transition',
    'POST /api/partner/upload',
];

/**
 * Lot 11b (F1) : routes d'écriture qui filtrent ELLES-MÊMES une fiche SUSPENDU (partnerSuspendedTablesRefusal). Actions sur
 * une réservation de table : accepter ou refuser une demande passent en base, qui refuse l'acceptation d'une fiche non
 * VALIDE et rembourse le client en entier (correctif T5 de la contre-vérification du lot 11a) ; présence, annulation et
 * paiement sur place sont refusés par la route.
 */
const OWN_SUSPENDED_CHECK: readonly RouteKey[] = [
    'PATCH /api/partner/tables/reservations/*',
];

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function routeKey(method: string, pathname: string): RouteKey {
    const path = pathname.replace(/\/+$/, '').split('/').map((s) => (UUID_SEGMENT.test(s) ? '*' : s)).join('/');
    return `${method.toUpperCase()} ${path}`;
}

/** true si la fiche permet cette route (liste blanche par statut). */
export function partnerFicheAllows(status: string | null, method: string, pathname: string): boolean {
    if (status === 'VALIDE' || status === 'SUSPENDU') return true;
    const key = routeKey(method, pathname);
    if (OWN_REFUSAL.includes(key)) return true;
    if (status === 'EN_ATTENTE') return READ_PENDING.includes(key);
    if (status === 'REJETE') return READ_REJECTED.includes(key);
    return false;
}

/**
 * Finition 2a (1a) : écriture d'un événement, refusée à une fiche SUSPENDU. Toute méthode autre que GET sous
 * /api/partner/events (création comprise), sauf l'export des participants (lecture envoyée en POST), et le dépôt d'image.
 * Correctifs de la contre-vérification (T1, T2) : aussi toute écriture de l'équipe de ses événements (/api/partner/team/* :
 * réglages, porte, point d'entrée, espèces, invitation, renvoi, annulation, effacement, retraits) et de ses caisses
 * (/api/partner/shifts/* : validation d'un écart). Inventaire de toutes les écritures /api/partner/* et /api/controller/*
 * avec leur garde : tests/parcours/f2acv-ecritures-fiche.test.ts.
 * Contre-vérification du lot 10b (T1) : aussi toute écriture des salles (/api/partner/halls*) : création, modification,
 * suppression, renvoi en validation, annulation d'une réservation ; la base refuse aussi l'annulation par la salle
 * (hall_reservation_cancel, migration 20261126000004).
 * Lot 11b (F1) : aussi toute écriture des établissements et des tables (/api/partner/venues*, /api/partner/tables*) :
 * création, modification, envoi en validation, plan de salle, fermetures, zones, tables, réponse à une demande,
 * présence, annulation, paiement sur place ; la base refuse aussi la présence, l'annulation par l'établissement et les
 * écritures de l'établissement (venue_owner_refusal, migrations 20261129…).
 * Lot 12a : aussi toute écriture des commandes, des produits, des livreurs et des réglages de vente d'un établissement.
 */
export function partnerEventWrite(method: string, pathname: string): boolean {
    const m = method.toUpperCase();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
    const key = routeKey(m, pathname);
    if (key === 'POST /api/partner/events/*/participants-export') return false;
    const path = key.slice(m.length + 1);
    return path === '/api/partner/events' || path.startsWith('/api/partner/events/') || path === '/api/partner/upload'
        || path === '/api/partner/team' || path.startsWith('/api/partner/team/')
        || path === '/api/partner/shifts' || path.startsWith('/api/partner/shifts/')
        || path === '/api/partner/halls' || path.startsWith('/api/partner/halls/')
        || path === '/api/partner/venues' || path.startsWith('/api/partner/venues/')
        || path === '/api/partner/tables' || path.startsWith('/api/partner/tables/')
        // Lot 12a : commandes, produits, livreurs et réglages de vente d'un établissement (fiche SUSPENDU = lecture seule ;
        // les fonctions en base refusent aussi : order_partner_action, order_venue_settings_set, order_courier_*)
        || isOrderServiceWrite(path);
}

/** Lot 12a : écritures du service des commandes d'une partenaire. */
function isOrderServiceWrite(path: string): boolean {
    return path === '/api/partner/orders' || path.startsWith('/api/partner/orders/')
        || path === '/api/partner/products' || path.startsWith('/api/partner/products/')
        || path === '/api/partner/couriers' || path.startsWith('/api/partner/couriers/')
        || /^\/api\/partner\/venues\/[^/]+\/orders$/.test(path);
}

/** Texte du refus PARTNER_SUSPENDED : texte de la base suivi du contact du support (contre-vérification 11c-c, T4 : l'écran
 * des tables l'affiche à l'identique). */
export async function partnerSuspendedMessage(text: string = PARTNER_SUSPENDED_TEXT): Promise<string> {
    const support = await supportSentenceOrHelp('fiche suspendue');
    return `${text} ${support}`;
}

/** Réponse 403 PARTNER_SUSPENDED : texte de la base suivi du contact du support. */
export async function partnerSuspendedResponse(text: string = PARTNER_SUSPENDED_TEXT): Promise<NextResponse> {
    return NextResponse.json({ error: await partnerSuspendedMessage(text), code: 'PARTNER_SUSPENDED' }, { status: 403 });
}

/**
 * Lot 11b (F1) : refus 403 PARTNER_SUSPENDED d'une action sur les tables pour une fiche SUSPENDU (routes de
 * OWN_SUSPENDED_CHECK), ou null. Lecture en échec : 503, jamais un passage.
 */
export async function partnerSuspendedTablesRefusal(user: { id: string; roles: readonly string[] }): Promise<NextResponse | null> {
    if (!partnerFicheGuardApplies(user.roles, '/api/partner/tables/reservations')) return null;
    const read = await readFicheStatus(user.id, 'partnerSuspendedTablesRefusal');
    if ('response' in read) return read.response;
    return read.status === 'SUSPENDU' ? partnerSuspendedResponse(PARTNER_SUSPENDED_TABLES_TEXT) : null;
}

/** La garde s'applique-t-elle à ce compte et à ce chemin ? */
export function partnerFicheGuardApplies(roles: readonly string[], pathname: string): boolean {
    if (!roles.includes('PARTENAIRE') || roles.includes('ADMIN') || roles.includes('SUPERADMIN')) return false;
    if (pathname.startsWith('/api/partner/')) return true;
    return pathname.startsWith('/api/controller/') && !roles.includes('CONTROLEUR');
}

/** Statut de la fiche du compte (null : aucune fiche), ou la réponse 503 si la lecture échoue (jamais un passage). */
async function readFicheStatus(userId: string, context: string): Promise<{ status: FicheStatus | null } | { response: NextResponse }> {
    const { data, error } = await getServiceRoleClient().from('partners').select('status').eq('user_id', userId).maybeSingle();
    if (error) {
        console.error(`[${context}] fiche partenaire de ${userId} illisible :`, error.message);
        return { response: NextResponse.json({ error: 'Vérification du compte momentanément impossible.', code: 'PARTNER_UNAVAILABLE' }, { status: 503 }) };
    }
    return { status: (data?.status as FicheStatus | undefined) ?? null };
}

/** Réponse de refus à rendre telle quelle, ou null si la fiche permet la route. */
export async function partnerFicheRefusal(user: { id: string; roles: readonly string[] }, method: string, pathname: string): Promise<NextResponse | null> {
    if (!partnerFicheGuardApplies(user.roles, pathname)) return null;
    const read = await readFicheStatus(user.id, 'partnerFicheRefusal');
    if ('response' in read) return read.response;
    if (read.status === 'SUSPENDU' && partnerEventWrite(method, pathname) && !OWN_SUSPENDED_CHECK.includes(routeKey(method, pathname))) {
        const text = pathname.startsWith('/api/partner/halls') ? PARTNER_SUSPENDED_HALLS_TEXT
            : pathname.startsWith('/api/partner/venues') || pathname.startsWith('/api/partner/tables') ? PARTNER_SUSPENDED_TABLES_TEXT
                : PARTNER_SUSPENDED_TEXT;
        return partnerSuspendedResponse(text);
    }
    if (partnerFicheAllows(read.status, method, pathname)) return null;
    return NextResponse.json({ error: PARTNER_NOT_VALIDATED_TEXT, code: 'PARTNER_NOT_VALIDATED' }, { status: 403 });
}

/**
 * cvf1 T2 — routes /api/controller/* (scan, vérification, invités, porte, guichet, devis, vente, ouverture de caisse) sur
 * l'événement `eventId` : un compte partenaire (non ADMIN ni SUPERADMIN), qu'il ait ou non aussi le rôle CONTROLEUR, n'agit
 * sur SES PROPRES événements qu'avec une fiche VALIDE (comme counter_sale, scan_scanner_authorized et
 * shift_can_handle_cash en base). Ses affectations chez une autre organisatrice ne sont pas visées. Lecture en échec :
 * 503, jamais un passage.
 */
export async function ownEventFicheRefusal(user: { id: string; roles: readonly string[] }, eventId: string | null | undefined): Promise<NextResponse | null> {
    if (!eventId || !user.roles.includes('PARTENAIRE') || user.roles.includes('ADMIN') || user.roles.includes('SUPERADMIN')) return null;
    const supabase = getServiceRoleClient();
    const { data: fiche, error } = await supabase.from('partners').select('id, status').eq('user_id', user.id).maybeSingle();
    if (error) {
        console.error(`[ownEventFicheRefusal] fiche partenaire de ${user.id} illisible :`, error.message);
        return NextResponse.json({ error: 'Vérification du compte momentanément impossible.', code: 'PARTNER_UNAVAILABLE' }, { status: 503 });
    }
    if (!fiche || fiche.status === 'VALIDE') return null;
    const { data: own, error: evErr } = await supabase.from('events').select('id').eq('id', eventId).eq('partner_id', fiche.id).maybeSingle();
    if (evErr) {
        console.error(`[ownEventFicheRefusal] événement ${eventId} illisible :`, evErr.message);
        return NextResponse.json({ error: 'Vérification du compte momentanément impossible.', code: 'PARTNER_UNAVAILABLE' }, { status: 503 });
    }
    if (!own) return null;
    return NextResponse.json({ error: PARTNER_NOT_VALIDATED_TEXT, code: 'PARTNER_NOT_VALIDATED' }, { status: 403 });
}

/**
 * POST /api/partner/events/[id]/transition : refus d'une fiche ni VALIDE ni SUSPENDU, quelle que soit la transition et
 * avant toute lecture du corps. `to` (lu dans le corps, s'il est lisible) ne choisit que le texte : celui de la base pour
 * la soumission et la publication, le texte commun sinon.
 */
export async function partnerTransitionFicheRefusal(user: { id: string; roles: readonly string[] }, to: unknown): Promise<NextResponse | null> {
    if (!partnerFicheGuardApplies(user.roles, '/api/partner/events/*/transition')) return null;
    const read = await readFicheStatus(user.id, 'partnerTransitionFicheRefusal');
    if ('response' in read) return read.response;
    // Finition 2a (1a) : une fiche SUSPENDU ne fait plus aucune transition (refusée ici et en base)
    if (read.status === 'SUSPENDU') return partnerSuspendedResponse();
    if (read.status === 'VALIDE') return null;
    const text = to === 'EN_ATTENTE' || to === 'PUBLIE' ? PARTNER_NOT_VALIDATED_SUBMIT_TEXT : PARTNER_NOT_VALIDATED_TEXT;
    return NextResponse.json({ error: text, code: 'PARTNER_NOT_VALIDATED' }, { status: 403 });
}
