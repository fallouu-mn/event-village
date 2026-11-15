/**
 * Finition 1 (complément 13) — mots d'une soirée passée, les mêmes pour le contrôleur (« Mes soirées ») et pour
 * l'organisatrice (« Événements passés » de l'équipe). Les chiffres viennent du serveur (controller_evening_figures) ;
 * ce module ne calcule rien, il met en mots. Écart = déclaré − attendu : négatif, il manque de l'argent ; positif, il y
 * en a trop.
 */
import { formatFcfa } from '@/lib/format';

export interface EveningCash {
    collected: number;
    gap: number;
    state: string;
}

export interface EveningFigures {
    entries: number;
    cash: EveningCash | null;
}

export function eveningEntriesText(entries: number): string {
    if (entries === 0) return 'Aucune entrée validée';
    return `${entries} entrée${entries > 1 ? 's' : ''} validée${entries > 1 ? 's' : ''}`;
}

/** Règle de la route du scanner (lot 9 bis, R100) : « Porte » ajouté seulement si le nom ne se nomme pas déjà. */
const NAMED_ENTRY = /^(porte|portail|entr[ée]e|acc[èe]s|guichet)\b/i;

/** « Porte Sud · Tribune », « Porte VIP · Carré VIP » (pas « Porte Porte VIP »), « Point d’entrée : … » ou « Porte non précisée ». */
export function eveningPlaceText(p: { gate: string | null; zone: string | null; entry_point: string | null }): string {
    if (p.gate) {
        const gate = p.gate.trim();
        return `${NAMED_ENTRY.test(gate) ? gate : `Porte ${gate}`}${p.zone ? ` · ${p.zone}` : ''}`;
    }
    if (p.entry_point) return `Point d’entrée : ${p.entry_point}`;
    return 'Porte non précisée';
}

function gapText(gap: number): string {
    return gap < 0 ? `il manquait ${formatFcfa(-gap)}` : `${formatFcfa(gap)} de trop`;
}

/** « Caisse : 12 000 F encaissés · Clôturée », ou « Pas de caisse » si le contrôleur n'en a pas tenu. */
export function eveningCashText(cash: EveningCash | null): string {
    if (!cash) return 'Pas de caisse';
    const total = `Caisse : ${formatFcfa(cash.collected)} encaissés`;
    switch (cash.state) {
        case 'CLOSED':
            return `${total} · Clôturée`;
        case 'GAP_PENDING':
            return `${total} · Clôturée, ${gapText(cash.gap)} : en attente de l’organisatrice`;
        case 'GAP_ACCEPTED':
            return `${total} · Clôturée, ${gapText(cash.gap)} : écart accepté par l’organisatrice`;
        case 'DISPUTED':
            return `${total} · En litige : l’organisatrice vérifie la caisse`;
        case 'OPEN':
            return `${total} · Pas encore clôturée : à fermer avec l’organisatrice`;
        default:
            return total;
    }
}
