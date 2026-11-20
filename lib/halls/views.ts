/**
 * Lot 10b — salles : libellés et règles d'affichage, sans dépendance serveur (importable par un écran).
 * Aucun code, aucun statut en capitales à l'écran : chaque état a ses mots et son ton.
 */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** État d'une réservation (booking_state) : libellé pour le client, libellé pour la salle, ton. */
export const BOOKING_STATE_VIEW: Readonly<Record<string, { client: string; partner: string; tone: Tone }>> = {
    EN_ATTENTE_PAIEMENT: { client: 'À payer pour garder la date', partner: 'En attente de paiement', tone: 'warning' },
    ACOMPTE_PAYE: { client: 'Acompte payé, solde à payer', partner: 'Acompte payé', tone: 'info' },
    PAYEE: { client: 'Payée', partner: 'Payée', tone: 'success' },
    EXPIREE: { client: 'Non payée à temps', partner: 'Non payée à temps', tone: 'neutral' },
    DELAI_DEPASSE: { client: 'Annulée : solde non payé à temps', partner: 'Annulée : solde non payé à temps', tone: 'danger' },
    ANNULEE_CLIENT: { client: 'Annulée par vous', partner: 'Annulée par le client', tone: 'neutral' },
    ANNULEE_SALLE: { client: 'Annulée par la salle', partner: 'Annulée par vous', tone: 'danger' },
    ANNULEE_EV: { client: 'Annulée par Event Village', partner: 'Annulée par Event Village', tone: 'danger' },
};

export function bookingView(state: unknown, who: 'client' | 'partner'): { label: string; tone: Tone } {
    const v = typeof state === 'string' ? BOOKING_STATE_VIEW[state] : undefined;
    return v ? { label: v[who], tone: v.tone } : { label: 'État inconnu', tone: 'neutral' };
}

/** Réservation qui tient encore la date (attente de paiement, acompte payé, payée). */
export function bookingIsLive(state: unknown): boolean {
    return state === 'EN_ATTENTE_PAIEMENT' || state === 'ACOMPTE_PAYE' || state === 'PAYEE';
}

/** Statut de validation d'une salle : libellé pour la partenaire et pour l'administration, ton. */
export const HALL_STATUS_VIEW: Readonly<Record<string, { label: string; tone: Tone; hint: string }>> = {
    EN_ATTENTE_VALIDATION: { label: 'En attente de validation', tone: 'warning', hint: 'L’équipe d’Event Village vérifie la salle avant de la rendre visible.' },
    VALIDEE: { label: 'Validée', tone: 'success', hint: 'La salle est visible et peut être réservée.' },
    REFUSEE: { label: 'Refusée', tone: 'danger', hint: 'Corrigez la salle puis renvoyez-la en validation.' },
    SUSPENDUE: { label: 'Suspendue', tone: 'danger', hint: 'La salle n’est plus visible. Les réservations déjà payées sont maintenues.' },
};

export function hallStatusView(status: unknown): { label: string; tone: Tone; hint: string } {
    return (typeof status === 'string' && HALL_STATUS_VIEW[status]) || { label: 'État inconnu', tone: 'neutral', hint: '' };
}

export const POLICY_LABELS: Readonly<Record<string, string>> = { SOUPLE: 'Souple', MODEREE: 'Modérée', STRICTE: 'Stricte' };

/** Équipements proposés à la création d'une salle (texte libre accepté en plus). */
export const AMENITY_SUGGESTIONS: readonly string[] = [
    'Climatisation', 'Sonorisation', 'Éclairage', 'Scène', 'Parking', 'Cuisine', 'Groupe électrogène', 'Wi-Fi',
    'Tables et chaises', 'Vestiaire', 'Accès en fauteuil roulant', 'Espace extérieur',
];

/** Date de Dakar « AAAA-MM-JJ » → « samedi 5 décembre 2026 ». */
export function longDate(isoDay: string): string {
    const d = new Date(`${isoDay}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return isoDay;
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** Période d'une réservation : « le 5 décembre 2026 », « du 5 au 6 décembre 2026 », « le 5 décembre 2026 de 18:00 à 23:00 ». */
export function periodText(r: { start_date: string; end_date: string; start_time?: string | null; end_time?: string | null }): string {
    const fmt = (day: string) => {
        const d = new Date(`${day}T00:00:00Z`);
        return Number.isNaN(d.getTime()) ? day : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
    };
    if (r.start_time && r.end_time) return `le ${fmt(r.start_date)} de ${r.start_time} à ${r.end_time}`;
    return r.start_date === r.end_date ? `le ${fmt(r.start_date)}` : `du ${fmt(r.start_date)} au ${fmt(r.end_date)}`;
}

/** Montant en F CFA : « 126 000 F CFA ». */
export function fcfaText(n: unknown): string {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return '—';
    return `${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F CFA`;
}

/** Heure de Dakar d'un horodatage : « 14:32 ». */
export function dakarTime(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Date de Dakar d'un horodatage : « 28 novembre 2026 ». */
export function dakarDate(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
