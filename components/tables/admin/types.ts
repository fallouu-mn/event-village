/**
 * Lot 11b (administration) : établissements de la réservation de tables — formes des réponses de
 * GET /api/admin/venues et GET /api/admin/venues/[id], lecture prudente des réponses, libellés des statuts
 * (lib/tables/views.ts) et mises en forme (horaires, capacité, durée du créneau, acompte).
 * Aucun montant calculé ici : acompte, nombres et dates viennent des routes ; ce fichier ne fait que les écrire en mots.
 */

import { WEEKDAYS, fcfaText, guestsText, hmText, venueStatusView, type Tone } from '@/lib/tables/views';

/** Statuts de la file, dans l'ordre des onglets (la file à traiter d'abord). Mêmes valeurs que la route. */
export const VENUE_ADMIN_STATUSES = ['EN_ATTENTE_VALIDATION', 'VALIDEE', 'REFUSEE', 'SUSPENDUE'] as const;
export type VenueAdminStatus = (typeof VENUE_ADMIN_STATUSES)[number];
export const DEFAULT_VENUE_STATUS: VenueAdminStatus = 'EN_ATTENTE_VALIDATION';

export function isVenueAdminStatus(value: unknown): value is VenueAdminStatus {
  return typeof value === 'string' && (VENUE_ADMIN_STATUSES as readonly string[]).includes(value);
}

/** Libellé d'un statut de validation (jamais le code en capitales). */
export function venueStatusLabel(status: string): string {
  return venueStatusView(status).label;
}

/** Explication courte d'un statut, vue côté administration. */
export const VENUE_STATUS_ADMIN_HINT: Readonly<Record<VenueAdminStatus, string>> = {
  EN_ATTENTE_VALIDATION: 'Établissements envoyés par les partenaires, les plus anciens d’abord. Ils restent invisibles des clients tant qu’ils ne sont pas validés.',
  VALIDEE: 'Établissements visibles et réservables par les clients, sauf si la partenaire les a retirés de la vente.',
  REFUSEE: 'Établissements refusés avec un motif. La partenaire peut les corriger puis les renvoyer en validation.',
  SUSPENDUE: 'Établissements retirés de la vue des clients. Les réservations déjà prises sont maintenues.',
};

/** Ligne de la file (GET /api/admin/venues). */
export interface AdminVenueRow {
  id: string;
  kind: string | null;
  kindLabel: string;
  name: string | null;
  city: string | null;
  address: string | null;
  photo: string | null;
  photoCount: number;
  tablesCount: number;
  status: string;
  statusLabel: string;
  statusTone: Tone;
  reason: string | null;
  /** Date exacte de l'envoi en validation (null : inconnue). */
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  partnerName: string | null;
  partnerValidated: boolean;
}

export interface AdminVenuesResponse {
  total: number;
  page: number;
  pageSize: number;
  counts: Partial<Record<string, number>>;
  venues: AdminVenueRow[];
}

export interface AdminVenueHours {
  /** 1 = lundi … 7 = dimanche (jour ISO). */
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface AdminVenueZone {
  id: string;
  name: string | null;
  isActive: boolean;
}

export interface AdminVenueTable {
  id: string;
  number: string | number | null;
  capacity: number;
  minCapacity: number;
  zoneId: string | null;
  isActive: boolean;
}

export interface AdminVenueHistoryRow {
  at: string;
  what: string;
  reason: string | null;
}

/** Fiche de décision (GET /api/admin/venues/[id]). */
export interface AdminVenueSheet {
  id: string;
  kind: string | null;
  kindLabel: string;
  name: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  photos: string[];
  slotMinutes: number | null;
  depositPerPerson: number | null;
  /** AUTO (confirmation immédiate) ou MANUELLE (sur acceptation) : jamais affiché tel quel. */
  confirmation: string | null;
  floorPlan: boolean;
  isActive: boolean;
  status: string;
  statusLabel: string;
  statusTone: Tone;
  reason: string | null;
  validatedAt: string | null;
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  hours: AdminVenueHours[];
  zones: AdminVenueZone[];
  tables: AdminVenueTable[];
  upcomingReservations: number;
  partner: {
    id: string | null;
    name: string | null;
    validated: boolean;
    /** Faux sans le droit « Consulter les partenaires » : téléphone et email absents. */
    contactsAllowed?: boolean;
    phone: string | null;
    email: string | null;
    city: string | null;
  };
  history: AdminVenueHistoryRow[];
}

/** Phrase affichée quand la date d'envoi en validation manque (jamais un code). */
export const SUBMITTED_UNKNOWN = 'Date d’envoi inconnue';

export function isVenuesResponse(body: unknown): body is AdminVenuesResponse {
  const b = body as AdminVenuesResponse | null;
  return !!b && typeof b === 'object' && Array.isArray(b.venues) && typeof b.total === 'number';
}

export function isVenueSheet(body: unknown): body is { venue: AdminVenueSheet } {
  const v = (body as { venue?: AdminVenueSheet } | null)?.venue;
  return !!v && typeof v === 'object' && typeof v.id === 'string' && Array.isArray(v.photos)
    && Array.isArray(v.hours) && Array.isArray(v.zones) && Array.isArray(v.tables)
    && Array.isArray(v.history) && !!v.partner && typeof v.partner === 'object';
}

/** Nom affiché d'un établissement. */
export function venueName(name: string | null | undefined): string {
  return name?.trim() || 'Établissement sans nom';
}

/** « 1 table », « 12 tables », « Aucune table ». */
export function tablesCountText(n: number): string {
  if (n <= 0) return 'Aucune table';
  return n === 1 ? '1 table' : `${n} tables`;
}

/** « Aucune photo », « 1 photo », « 4 photos ». */
export function photoCountText(n: number): string {
  if (n <= 0) return 'Aucune photo';
  return n === 1 ? '1 photo' : `${n} photos`;
}

/** Jour de la semaine (1 = lundi) avec une majuscule : « Lundi ». */
export function weekdayLabel(weekday: number): string {
  const day = WEEKDAYS[weekday - 1];
  if (!day) return 'Jour inconnu';
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** Heure de fermeture : « minuit » pour 00:00 et 24:00, sinon « 2 h 30 ». */
function closingText(value: string): string {
  return value.startsWith('24:00') || value.startsWith('00:00') ? 'minuit' : hmText(value);
}

/** Plage d'ouverture : « 12 h à 15 h », « 19 h à 2 h (le lendemain) », « 18 h à minuit ». */
export function openingRangeText(h: AdminVenueHours): string {
  const opens = hmText(h.opensAt) || h.opensAt;
  const closes = closingText(h.closesAt) || h.closesAt;
  const isMidnight = h.closesAt.startsWith('24:00') || h.closesAt.startsWith('00:00');
  const overnight = !isMidnight && h.closesAt.slice(0, 5) < h.opensAt.slice(0, 5);
  return overnight ? `${opens} à ${closes} (le lendemain)` : `${opens} à ${closes}`;
}

/** Capacité d'une table : « 4 personnes », « 2 à 4 personnes » quand un minimum est fixé. */
export function tableCapacityText(t: AdminVenueTable): string {
  if (t.minCapacity > 1 && t.minCapacity < t.capacity) return `${t.minCapacity} à ${t.capacity} personnes`;
  return guestsText(t.capacity);
}

/** Nom d'une table : « Table 4 ». */
export function tableName(t: AdminVenueTable): string {
  const n = t.number === null || t.number === undefined ? '' : String(t.number).trim();
  return n ? `Table ${n}` : 'Table sans numéro';
}

/** Durée du créneau : « 2 h », « 1 h 30 », « 45 min ». */
export function slotDurationText(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) return 'Durée par défaut d’Event Village';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Acompte par personne tel que réglé par la partenaire (valeur de la route, mise en forme seulement). */
export function depositText(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return 'Gratuit : aucun acompte demandé';
  return `${fcfaText(value)} par personne`;
}

/** Mode de confirmation en mots. */
export function confirmationText(mode: string | null): { label: string; hint: string } {
  if (mode === 'MANUELLE') {
    return { label: 'Sur acceptation', hint: 'L’établissement accepte ou refuse chaque demande dans le délai fixé par Event Village.' };
  }
  return { label: 'Confirmation immédiate', hint: 'La table est réservée dès que le client valide (et paie l’acompte s’il y en a un).' };
}

/** Réservations à venir : « Aucune réservation à venir », « 1 réservation à venir », « 5 réservations à venir ». */
export function upcomingText(n: number): string {
  if (n <= 0) return 'Aucune réservation à venir';
  return n === 1 ? '1 réservation à venir' : `${n} réservations à venir`;
}
