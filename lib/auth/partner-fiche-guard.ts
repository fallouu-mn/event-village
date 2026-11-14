/**
 * Lot 9 quinquies (A9, contre-vérification du lot 9 quater, point 2) — droits d'une partenaire selon le statut de sa
 * FICHE partenaire (partners.status), et non plus seulement selon le statut de son compte.
 *
 * Règle (décision du chef de projet) :
 *  - fiche VALIDE : tout ce que la route permet (inchangé) ;
 *  - fiche SUSPENDU : inchangé (lot 6 : lectures gardées ; lot 9 quater A6 : actions refusées par leurs contrôles) ;
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

export const PARTNER_NOT_VALIDATED_TEXT = 'Votre profil d’organisateur doit être validé avant cette action.';
/** Texte de la base pour la soumission et la publication (event_transition, 20261109000008_lot9bis_cycle.sql), repris tel quel. */
export const PARTNER_NOT_VALIDATED_SUBMIT_TEXT = 'Votre profil d’organisateur doit être validé avant de soumettre ou de publier un événement.';

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
    if (partnerFicheAllows(read.status, method, pathname)) return null;
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
    if (read.status === 'VALIDE' || read.status === 'SUSPENDU') return null;
    const text = to === 'EN_ATTENTE' || to === 'PUBLIE' ? PARTNER_NOT_VALIDATED_SUBMIT_TEXT : PARTNER_NOT_VALIDATED_TEXT;
    return NextResponse.json({ error: text, code: 'PARTNER_NOT_VALIDATED' }, { status: 403 });
}
