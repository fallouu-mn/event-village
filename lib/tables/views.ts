/**
 * Lot 11b — tables : libellés et règles d'affichage, sans dépendance serveur (importable par un écran).
 * Aucun code ni statut en capitales à l'écran : chaque état a ses mots, son ton, et dit quoi faire ensuite.
 */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** État d'une réservation (booking_state) : libellé pour le client, pour l'établissement, ton. */
export const TABLE_STATE_VIEW: Readonly<Record<string, { client: string; partner: string; tone: Tone }>> = {
    EN_ATTENTE_PAIEMENT: { client: 'Acompte à payer pour garder la table', partner: 'En attente du paiement de l’acompte', tone: 'warning' },
    EN_ATTENTE_ACCEPTATION: { client: 'En attente de la réponse de l’établissement', partner: 'À accepter ou refuser', tone: 'warning' },
    CONFIRMEE: { client: 'Confirmée', partner: 'Confirmée', tone: 'success' },
    ARRIVEE: { client: 'Vous êtes arrivé', partner: 'Client arrivé', tone: 'success' },
    ABSENT: { client: 'Absence constatée', partner: 'Client absent', tone: 'neutral' },
    EXPIREE: { client: 'Acompte non payé à temps', partner: 'Acompte non payé à temps', tone: 'neutral' },
    SANS_REPONSE: { client: 'Sans réponse de l’établissement', partner: 'Annulée faute de réponse', tone: 'danger' },
    REFUSEE: { client: 'Refusée par l’établissement', partner: 'Refusée par vous', tone: 'danger' },
    ANNULEE_CLIENT: { client: 'Annulée par vous', partner: 'Annulée par le client', tone: 'neutral' },
    ANNULEE_ETABLISSEMENT: { client: 'Annulée par l’établissement', partner: 'Annulée par vous', tone: 'danger' },
    ANNULEE_EV: { client: 'Annulée par Event Village', partner: 'Annulée par Event Village', tone: 'danger' },
};

export function tableStateView(state: unknown, who: 'client' | 'partner'): { label: string; tone: Tone } {
    const v = typeof state === 'string' ? TABLE_STATE_VIEW[state] : undefined;
    return v ? { label: v[who], tone: v.tone } : { label: 'État inconnu', tone: 'neutral' };
}

/** Réservation qui tient encore une table (attente de paiement, demande, confirmée). */
export function tableStateIsLive(state: unknown): boolean {
    return state === 'EN_ATTENTE_PAIEMENT' || state === 'EN_ATTENTE_ACCEPTATION' || state === 'CONFIRMEE';
}

/** Statut de validation d'un établissement : libellé, ton, ce qu'il faut savoir. */
export const VENUE_STATUS_VIEW: Readonly<Record<string, { label: string; tone: Tone; hint: string }>> = {
    EN_ATTENTE_VALIDATION: { label: 'En attente de validation', tone: 'warning', hint: 'L’équipe d’Event Village vérifie l’établissement avant de le rendre visible.' },
    VALIDEE: { label: 'Validé', tone: 'success', hint: 'L’établissement est visible et réservable.' },
    REFUSEE: { label: 'Refusé', tone: 'danger', hint: 'Corrigez l’établissement puis renvoyez-le en validation.' },
    SUSPENDUE: { label: 'Suspendu', tone: 'danger', hint: 'L’établissement n’est plus visible. Les réservations déjà prises sont maintenues.' },
};

export function venueStatusView(status: unknown): { label: string; tone: Tone; hint: string } {
    return (typeof status === 'string' && VENUE_STATUS_VIEW[status]) || { label: 'État inconnu', tone: 'neutral', hint: '' };
}

export const VENUE_KIND_VIEW: Readonly<Record<string, string>> = { RESTAURANT: 'Restaurant', BAR: 'Bar', ESPACE: 'Espace' };

export const WEEKDAYS: readonly string[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** « 21:30 » → « 21 h 30 », « 20:00 » → « 20 h ». */
export function hmText(value: string | null | undefined): string {
    const m = /^(\d{2}):(\d{2})/.exec(value ?? '');
    if (!m) return '';
    const h = String(Number(m[1]));
    return m[2] === '00' ? `${h} h` : `${h} h ${m[2]}`;
}

/** Date de Dakar « AAAA-MM-JJ » → « samedi 5 décembre ». */
export function dayText(isoDay: string, withYear = false): string {
    const d = new Date(`${isoDay}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return isoDay;
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(d);
}

/** Montant en F CFA : « 21 000 F CFA ». */
export function fcfaText(n: unknown): string {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return '—';
    return `${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F CFA`;
}

/** Heure de Dakar d'un horodatage ISO (UTC toute l'année) : « 21 h 30 ». */
export function instantHm(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return hmText(`${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`);
}

/** Aujourd'hui à Dakar, « AAAA-MM-JJ ». */
export function dakarToday(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
}

/** Nombre de personnes : « 1 personne », « 4 personnes ». */
export function guestsText(n: number): string {
    return `${n} personne${n > 1 ? 's' : ''}`;
}
