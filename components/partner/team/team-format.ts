/**
 * Finition 1 (E-15, E-21) — textes et liens de l'équipe, en mots simples : nom, numéro, « Appeler » (tel:), « WhatsApp »
 * (wa.me, message prêt sans aucun code), état écrit et daté, porte ou point d'entrée d'un événement.
 */
import { formatDateTime, formatShortDate, formatTime } from '@/lib/format';
import { INVALID_SN_PHONE_MESSAGE } from '@/lib/validations/auth';
import type { TeamAssignment, TeamInvitation, TeamMember } from './team-types';

/** Nom affiché d'un membre ; « Contrôleur sans nom » si le compte n'en a pas. */
export function memberName(m: Pick<TeamMember, 'first_name' | 'last_name'>): string {
    const full = [m.first_name, m.last_name].map((x) => (x ?? '').trim()).filter((x) => x && x !== 'Contrôleur').join(' ');
    return full || 'Contrôleur sans nom';
}

export function firstNameOf(m: Pick<TeamMember, 'first_name' | 'last_name'>): string {
    const first = (m.first_name ?? '').trim();
    return first && first !== 'Contrôleur' ? first : memberName(m);
}

/** Neuf chiffres du numéro sénégalais (sans +221), ou null. */
export function localDigits(phone: string | null): string | null {
    const digits = (phone ?? '').replace(/\D/g, '').replace(/^221/, '');
    return /^7\d{8}$/.test(digits) ? digits : null;
}

/** « 77 123 45 67 » ; « Numéro inconnu » si illisible. */
export function displayPhone(phone: string | null): string {
    const d = localDigits(phone);
    return d ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : 'Numéro inconnu';
}

export function telHref(phone: string | null): string | null {
    const d = localDigits(phone);
    return d ? `tel:+221${d}` : null;
}

export function whatsappHref(phone: string | null, message: string): string | null {
    const d = localDigits(phone);
    return d ? `https://wa.me/221${d}?text=${encodeURIComponent(message)}` : null;
}

/** Lieu de contrôle d'un événement, tel qu'affiché sur la ligne (porte comprise). */
export function placeOf(a: TeamAssignment): { text: string; missing: boolean } {
    if (a.gate) return { text: `${a.gate.name} · ${a.gate.zone_name}`, missing: false };
    if (a.has_zones) return { text: 'Sans porte : ne peut pas scanner', missing: true };
    if (a.entry_point) return { text: `Point d’entrée : ${a.entry_point}`, missing: false };
    return { text: 'Point d’entrée non précisé', missing: false };
}

/** Résumé exact d'une ligne d'événement (porte, espèces, caisse). */
export function assignmentSummary(a: TeamAssignment): string {
    const parts = [placeOf(a).text, a.can_accept_cash ? 'Espèces autorisées' : 'Sans espèces'];
    if (a.open_shift) parts.push('Caisse ouverte');
    return parts.join(' · ');
}

export function eventWhen(startAt: string | null): string {
    return startAt ? `${formatShortDate(startAt)} à ${formatTime(startAt)}` : 'Date à venir';
}

export function entriesText(a: TeamAssignment): string {
    const n = a.entries;
    const base = n === 0 ? 'Aucune entrée' : `${n} entrée${n > 1 ? 's' : ''}`;
    return a.last_scan_at ? `${base} · dernier scan à ${formatTime(a.last_scan_at)}` : base;
}

/** Badge et ligne d'état d'un membre (E-21). */
export function memberState(m: TeamMember, now = Date.now()): { badge: string; tone: 'success' | 'warning' | 'danger'; line: string } {
    if (m.account_state === 'SUSPENDED') {
        return { badge: 'Compte suspendu', tone: 'danger', line: 'Il ne peut pas scanner. Contactez le support.' };
    }
    if (m.account_state === 'PENDING_ACTIVATION') {
        const act = m.activation;
        if (!act) return { badge: 'Activation en attente', tone: 'warning', line: 'Lien d’activation pas encore envoyé : renvoyez le SMS.' };
        if (Date.parse(act.expires_at) <= now) {
            return { badge: 'Activation en attente', tone: 'warning', line: `Code expiré le ${formatDateTime(act.expires_at)} : renvoyez le SMS.` };
        }
        return { badge: 'Activation en attente', tone: 'warning', line: `Lien d’activation envoyé le ${formatDateTime(act.sent_at)}, valable jusqu’au ${formatDateTime(act.expires_at)}.` };
    }
    return { badge: 'Prêt', tone: 'success', line: m.active_since ? `Actif depuis le ${formatShortDate(m.active_since)}` : 'Actif' };
}

/** Badge et ligne d'une invitation (E-19). */
export function invitationState(i: TeamInvitation): { badge: string; tone: 'info' | 'neutral'; line: string } {
    const titles = i.events.map((e) => `« ${e.title} »`).join(', ');
    switch (i.state) {
        case 'PENDING':
            return { badge: 'Invitation envoyée', tone: 'info', line: `Envoyée le ${formatDateTime(i.last_sent_at)}. ${i.display_name} doit accepter avant le ${formatDateTime(i.expires_at)}.${titles ? ` Événements : ${titles}.` : ''}` };
        case 'EXPIRED':
            return { badge: 'Sans réponse', tone: 'neutral', line: `Invitation expirée le ${formatDateTime(i.responded_at ?? i.expires_at)}.${titles ? ` Événements : ${titles}.` : ''}` };
        case 'DECLINED':
            return { badge: 'Refusée', tone: 'neutral', line: `Refusée le ${formatDateTime(i.responded_at ?? i.created_at)}.${titles ? ` Événements : ${titles}.` : ''}` };
        default:
            return { badge: 'Annulée', tone: 'neutral', line: `Annulée le ${formatDateTime(i.responded_at ?? i.created_at)}. Le lien du SMS ne mène plus à rien.` };
    }
}

/** Message WhatsApp prêt (E-15) : jamais de code. */
export function whatsappMessage(m: TeamMember, organizer: string, a: TeamAssignment | undefined, origin: string): string {
    const hello = `Bonjour ${firstNameOf(m)}, ici ${organizer}.`;
    if (m.account_state === 'PENDING_ACTIVATION') {
        return `${hello} Pour scanner les billets${a ? ` de « ${a.title} »` : ''}, activez votre compte avec le code reçu par SMS : ${origin}/controller/setup. Si le code a expiré, dites-le-moi et je vous le renvoie.`;
    }
    if (!a) return `${hello} Ouvrez le scanner : ${origin}/controller/scanner`;
    const where = a.gate ? `, porte ${a.gate.name}` : a.entry_point ? `, ${a.entry_point}` : '';
    return `${hello} Vous contrôlez l’entrée de « ${a.title} » le ${eventWhen(a.start_at)}${where}. Ouvrez le scanner : ${origin}/controller/scanner`;
}

export function invitationWhatsappMessage(i: TeamInvitation, organizer: string, origin: string): string {
    const title = i.events[0]?.title;
    return `Bonjour, ici ${organizer}. Je vous ai invité à contrôler l’entrée${title ? ` de « ${title} »` : ''} sur Event Village. Acceptez l’invitation avant le ${formatDateTime(i.expires_at)} : ${origin}/invitations`;
}

/** Numéro saisi par l'utilisateur, ramené à neuf chiffres (77 123 45 67, +221…, 221…). */
export function normalizeTyped(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^221(?=7\d{8}$)/, '');
}

/** Texte unique du glossaire pour un numéro invalide (lib/validations/auth.ts). */
export const PHONE_ERROR = INVALID_SN_PHONE_MESSAGE;
