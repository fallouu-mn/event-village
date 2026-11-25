/**
 * Lot 10b (point 4) : salles de fête, administration — formes des réponses de GET /api/admin/halls et
 * GET /api/admin/halls/[id], lecture prudente des réponses et libellés des statuts (lib/halls/views.ts).
 * Aucun montant calculé ici : prix, acompte et nombres viennent des routes.
 * Lot 10b (correctifs, point 4) : date exacte de l'envoi en validation (`submittedAt`, null si inconnue).
 */

import { HALL_STATUS_VIEW, type Tone } from '@/lib/halls/views';

/** Statuts de la file, dans l'ordre des onglets (la file à traiter d'abord). */
export const HALL_ADMIN_STATUSES = ['EN_ATTENTE_VALIDATION', 'VALIDEE', 'REFUSEE', 'SUSPENDUE'] as const;
export type HallAdminStatus = (typeof HALL_ADMIN_STATUSES)[number];
export const DEFAULT_HALL_STATUS: HallAdminStatus = 'EN_ATTENTE_VALIDATION';

export function isHallAdminStatus(value: unknown): value is HallAdminStatus {
  return typeof value === 'string' && (HALL_ADMIN_STATUSES as readonly string[]).includes(value);
}

/** Libellé d'un statut (jamais le code en capitales). */
export function hallStatusLabel(status: string): string {
  return HALL_STATUS_VIEW[status]?.label ?? 'État inconnu';
}

/** Explication courte d'un statut, vue côté administration. */
export const HALL_STATUS_ADMIN_HINT: Readonly<Record<HallAdminStatus, string>> = {
  EN_ATTENTE_VALIDATION: 'Salles envoyées par les partenaires, les plus anciennes d’abord. Elles restent invisibles des clients tant qu’elles ne sont pas validées.',
  VALIDEE: 'Salles visibles et réservables par les clients, sauf si la partenaire les a retirées de la vente.',
  REFUSEE: 'Salles refusées avec un motif. La partenaire peut les corriger puis les renvoyer en validation.',
  SUSPENDUE: 'Salles retirées de la vue des clients. Les réservations déjà payées sont maintenues.',
};

/** Ligne de la file (GET /api/admin/halls). */
export interface AdminHallRow {
  id: string;
  name: string | null;
  city: string | null;
  address: string | null;
  capacity: number | null;
  pricePerDay: number | null;
  pricePerHour: number | null;
  photo: string | null;
  photoCount: number;
  status: string;
  statusLabel: string;
  statusTone: Tone;
  reason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Date exacte de l'envoi en validation (null : inconnue, salle ancienne). */
  submittedAt?: string | null;
  partnerName: string | null;
  partnerValidated: boolean;
}

export interface AdminHallsResponse {
  total: number;
  page: number;
  pageSize: number;
  counts: Partial<Record<string, number>>;
  halls: AdminHallRow[];
}

export interface AdminHallHistoryRow {
  at: string;
  what: string;
  reason: string | null;
}

/** Fiche d'une salle (GET /api/admin/halls/[id]). */
export interface AdminHallSheet {
  id: string;
  name: string | null;
  description: string | null;
  capacity: number | null;
  pricePerDay: number | null;
  pricePerHour: number | null;
  depositMode: string | null;
  depositValue: number | null;
  cancellation: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  /** Lot Carte B3 : 'PARTICULIER' ou 'PROFESSIONNEL' (absent : lu comme particulier) ; jamais affiché tel quel. */
  hostKind?: string | null;
  address: string | null;
  city: string | null;
  amenities: unknown[];
  photos: string[];
  isActive: boolean;
  status: string;
  statusLabel: string;
  statusTone: Tone;
  reason: string | null;
  validatedAt: string | null;
  /** Date exacte de l'envoi en validation (null : inconnue). */
  submittedAt?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  upcomingReservations: number;
  partner: {
    id: string | null;
    name: string | null;
    validated: boolean;
    /** Contre-vérification du lot 10b (T2) : faux sans le droit « Consulter les partenaires » (contacts absents). */
    contactsAllowed?: boolean;
    phone: string | null;
    email: string | null;
    city: string | null;
  };
  history: AdminHallHistoryRow[];
}

/** Phrase affichée quand la date d'envoi en validation manque (jamais un code). */
export const SUBMITTED_UNKNOWN = 'Date d’envoi inconnue';

/** Message d'un refus de la route (`error`, déjà en mots), sinon null. */
export function readError(body: unknown): string | null {
  if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
    const text = (body as { error: string }).error.trim();
    return text === '' ? null : text;
  }
  return null;
}

export function isHallsResponse(body: unknown): body is AdminHallsResponse {
  const b = body as AdminHallsResponse | null;
  return !!b && typeof b === 'object' && Array.isArray(b.halls) && typeof b.total === 'number';
}

export function isHallSheet(body: unknown): body is { hall: AdminHallSheet } {
  const h = (body as { hall?: AdminHallSheet } | null)?.hall;
  return !!h && typeof h === 'object' && typeof h.id === 'string' && Array.isArray(h.photos)
    && Array.isArray(h.history) && !!h.partner && typeof h.partner === 'object';
}

/** Nombre fini ou null (position renvoyée en nombre ou en texte selon la colonne). */
export function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
