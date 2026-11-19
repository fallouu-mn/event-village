/**
 * Design 1b (point 8) — « Prévenir par WhatsApp » après un transfert (règles pures, testées sans navigateur :
 * tests/schema/design1b-billets.test.ts). Lien wa.me vers le numéro du destinataire retenu par le serveur (chiffres E.164
 * sans « + »), message avec l'adresse du site lue dans la configuration (NEXT_PUBLIC_APP_URL, écrite au build),
 * l'adresse où accepter le billet et l'échéance réelle du transfert. Module importé seulement par la fenêtre de transfert
 * (chargée à son ouverture) : hors du premier chargement de Mes billets.
 */
import { formatDateTime } from '@/lib/format';

/** Adresse publique du site : configuration (NEXT_PUBLIC_APP_URL, écrite au build), sinon l'origine de la page. */
export function siteUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//.test(configured)) return configured;
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/** Chiffres E.164 sans « + » (wa.me), ou null si le numéro n'en est pas un (8 à 15 chiffres). */
export function whatsappDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!/^\+?[\d\s.()-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export interface TransferWhatsapp {
  /** Numéro du destinataire tel que le serveur l'a retenu (E.164, « +221771234567 »). */
  phone: string | null | undefined;
  eventTitle: string;
  /** Échéance du transfert servie par le serveur (ISO). */
  expiresAt: string | null | undefined;
  /** Adresse du site, sans « / » final. */
  site: string;
}

/** Message envoyé au destinataire : où récupérer le billet et jusqu'à quand. */
export function transferMessage({ eventTitle, expiresAt, site }: Omit<TransferWhatsapp, 'phone'>): string {
  const deadline = expiresAt && !Number.isNaN(Date.parse(expiresAt)) ? ` avant le ${formatDateTime(expiresAt)}` : '';
  return `Bonjour, je vous ai transféré un billet pour « ${eventTitle} » sur Event Village. Connectez-vous avec ce numéro, puis ouvrez Mes billets, onglet Reçus, pour l’accepter${deadline} : ${site}/tickets?tab=recus`;
}

/** Lien « Prévenir par WhatsApp » vers le numéro du destinataire, ou null si ce numéro est inconnu (repli « Partager »). */
export function transferWhatsappUrl(input: TransferWhatsapp): string | null {
  const digits = whatsappDigits(input.phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(transferMessage(input))}`;
}
