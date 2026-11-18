/**
 * Design 1b (À LA UNE) — mots de la page /admin/a-la-une : état d'affichage, actions du journal, motifs de retrait,
 * étiquette ; jamais le code brut à l'écran (repli « Autre action »). Aides pures (ordre, dates à Dakar), lisibles par
 * un composant client et par les tests.
 */
import type { BadgeVariant } from '@/components/ui/Badge';

/** Texte de l'étiquette vue par les visiteurs. « Sponsorisé » est prévu, pas encore ouvert. */
export const FEATURED_LABEL_TEXT: Readonly<Record<string, string>> = {
    A_LA_UNE: 'À la une',
    SPONSORISE: 'Sponsorisé',
};

export function featuredLabelText(label: string | null | undefined): string {
    return FEATURED_LABEL_TEXT[String(label)] ?? 'À la une';
}

export const DISPLAY_STATE_META: Readonly<Record<string, { label: string; variant: BadgeVariant; help: string }>> = {
    LIVE: { label: 'Sur l’accueil', variant: 'success', help: 'Les visiteurs le voient maintenant.' },
    SCHEDULED: { label: 'Programmé', variant: 'info', help: 'Il apparaîtra au début de l’affichage.' },
    WINDOW_ENDED: { label: 'Affichage fini', variant: 'neutral', help: 'La fin d’affichage est passée : retirez-le ou changez ses dates.' },
    EVENT_FINISHED: { label: 'Événement passé', variant: 'neutral', help: 'L’événement est passé : il sera retiré tout seul.' },
    EVENT_NOT_PUBLISHED: { label: 'Plus en vente', variant: 'warning', help: 'L’événement n’est plus en vente : il sera retiré tout seul.' },
};

export function displayStateMeta(state: string | null | undefined): { label: string; variant: BadgeVariant; help: string } {
    return DISPLAY_STATE_META[String(state)] ?? { label: 'État inconnu', variant: 'neutral', help: 'Rechargez la page.' };
}

export const JOURNAL_ACTION_LABELS: Readonly<Record<string, string>> = {
    HOME_FEATURED_ADDED: 'Mis à la une',
    HOME_FEATURED_REORDERED: 'Ordre changé',
    HOME_FEATURED_WINDOW_SET: 'Dates d’affichage changées',
    HOME_FEATURED_REMOVED: 'Retiré de la une',
    HOME_FEATURED_AUTO_REMOVED: 'Retiré automatiquement',
};

export function journalActionLabel(action: string | null | undefined): string {
    return JOURNAL_ACTION_LABELS[String(action)] ?? 'Autre action';
}

export const REMOVAL_LABELS: Readonly<Record<string, string>> = {
    MANUAL: 'Retiré à la main',
    EVENT_CANCELLED: 'Événement annulé',
    EVENT_SUSPENDED: 'Événement suspendu',
    EVENT_FINISHED: 'Événement terminé',
    EVENT_UNPUBLISHED: 'Plus en vente au public',
};

export function removalLabel(code: string | null | undefined): string {
    return REMOVAL_LABELS[String(code)] ?? 'Retiré';
}

/** Copie de la liste avec l'élément `index` déplacé d'un cran (-1 : monter, +1 : descendre) ; la même liste sinon. */
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
    const target = index + delta;
    if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    return next;
}

/**
 * Valeur d'un champ `datetime-local` (« AAAA-MM-JJTHH:mm », heure de Dakar) en horodatage ISO avec fuseau. Africa/Dakar
 * = UTC+0 toute l'année : l'heure saisie est l'heure UTC, quel que soit le fuseau du navigateur. Vide → null ; valeur
 * illisible → undefined.
 */
export function dakarLocalToIso(value: string): string | null | undefined {
    const v = value.trim();
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return undefined;
    const d = new Date(`${v}:00Z`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
