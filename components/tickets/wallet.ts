/**
 * Design 1b (point 8) — « Mes billets » façon Wallet : règles pures, sans React (testées sans navigateur ni base,
 * tests/schema/design1b-billets.test.ts).
 *  - couleur de la catégorie au contrôle (`scan_color`, palette fermée du scanner) → jetons `--scan-cat-<clé>-bg/-fg`
 *    (mêmes valeurs en clair et en sombre, texte ≥ 7:1, app/globals.css) ; sans couleur : carte neutre ;
 *  - compte à rebours jusqu'au début, à la minute, calculé sur le téléphone à partir des instants servis par
 *    GET /api/tickets (`startsAt`, `endsAt`) ;
 *  - ordre du portefeuille : le prochain billet d'abord (le jour J, son QR est le premier, revue E-58) ;
 *  - « Prévenir par WhatsApp » après un transfert : transfer-whatsapp.ts (chargé avec la fenêtre de transfert) ;
 *  - expéditeur d'un billet reçu dit en mots vrais (jamais « Envoyé par Un utilisateur »).
 */
import type { ScanCategoryColor } from '@/lib/scan/scan-result';

/** Classes littérales (Tailwind ne voit que des noms complets) : fond et texte de la catégorie. */
const CATEGORY_CLASSES: Record<ScanCategoryColor, string> = {
  BLANC: 'bg-scan-cat-blanc-bg text-scan-cat-blanc-fg',
  OR: 'bg-scan-cat-or-bg text-scan-cat-or-fg',
  ARGENT: 'bg-scan-cat-argent-bg text-scan-cat-argent-fg',
  ROSE: 'bg-scan-cat-rose-bg text-scan-cat-rose-fg',
  TURQUOISE: 'bg-scan-cat-turquoise-bg text-scan-cat-turquoise-fg',
  BLEU: 'bg-scan-cat-bleu-bg text-scan-cat-bleu-fg',
  VIOLET: 'bg-scan-cat-violet-bg text-scan-cat-violet-fg',
  NOIR: 'bg-scan-cat-noir-bg text-scan-cat-noir-fg',
};

/** Catégorie sans couleur au contrôle : talon sur le fond doux de la marque, texte du thème. */
export const NEUTRAL_CATEGORY_CLASSES = 'bg-primary-soft text-foreground-strong';

export function categoryClasses(color: string | null | undefined): string {
  return color && Object.prototype.hasOwnProperty.call(CATEGORY_CLASSES, color)
    ? CATEGORY_CLASSES[color as ScanCategoryColor]
    : NEUTRAL_CATEGORY_CLASSES;
}

const MINUTE_MS = 60_000;

function instant(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Compte à rebours jusqu'au début, à la minute près (arrondi à la minute supérieure : « Dans 1 min » jusqu'au début) :
 * « Dans 3 jours et 4 h », « Dans 1 jour », « Dans 2 h 5 min », « Dans 12 min » ; « En cours » entre le début et la fin
 * retenue ; null quand l'événement est fini ou l'heure inconnue.
 */
export function countdownLabel(startsAt: string | null | undefined, endsAt: string | null | undefined, now: number): string | null {
  const start = instant(startsAt);
  if (start === null) return null;
  const end = instant(endsAt);
  if (end !== null && now >= end) return null;
  if (now >= start) return end === null ? null : 'En cours';
  const minutes = Math.max(1, Math.ceil((start - now) / MINUTE_MS));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `Dans ${days} jour${days > 1 ? 's' : ''}${hours > 0 ? ` et ${hours} h` : ''}`;
  if (hours > 0) return `Dans ${hours} h${mins > 0 ? ` ${mins} min` : ''}`;
  return `Dans ${mins} min`;
}

/** Délai jusqu'au changement de minute suivant (horloge du compte à rebours), 250 ms de marge. */
export function msToNextMinute(now: number): number {
  return MINUTE_MS - (now % MINUTE_MS) + 250;
}

/** Ordre du portefeuille : billets avec une date de début, du plus proche au plus lointain ; les autres ensuite. */
export function byStart<T extends { startsAt?: string | null }>(a: T, b: T): number {
  const sa = instant(a.startsAt);
  const sb = instant(b.startsAt);
  if (sa === null && sb === null) return 0;
  if (sa === null) return 1;
  if (sb === null) return -1;
  return sa - sb;
}

/** Repli du serveur quand l'expéditeur n'a ni prénom ni nom (fonction ticket_transfers_incoming). */
const NAMELESS = /^un utilisateur\b/i;
/** Initiale masquée (« A*** ») : ce n'est pas un nom à montrer. */
const MASKED = /\*/;
const ORGANIZER = /^l[’']organisateur/i;

/**
 * Ligne « de qui vient ce billet » d'un billet reçu : le nom quand le serveur en donne un (« Envoyé par Awa D. »),
 * « Invitation de l’organisateur » pour une invitation, sinon une formulation vraie sans expéditeur (« Billet reçu »).
 */
export function senderLine(kind: 'INVITATION' | 'TRANSFER', display: string | null | undefined): string {
  const name = (display ?? '').trim();
  if (kind === 'INVITATION') {
    return !name || ORGANIZER.test(name) || NAMELESS.test(name) || MASKED.test(name) ? 'Invitation de l’organisateur' : `Invitation de ${name}`;
  }
  return !name || NAMELESS.test(name) || MASKED.test(name) ? 'Billet reçu' : `Envoyé par ${name}`;
}
