/**
 * Lot 11b (écrans du client) : petites aides d'affichage des tables. Aucun montant n'est calculé ici : les montants
 * viennent des routes (devis, réservation figée, aperçu d'annulation) et sont seulement mis en forme (fcfaText de
 * lib/tables/views). Les durées et les heures sont mises en mots, en français simple.
 */
import type { BadgeVariant } from '@/components/ui/Badge';
import type { StatusBannerTone } from '@/components/ui/StatusBanner';
import { dayText, hmText, instantHm } from '@/lib/tables/views';

/** Ton d'un état (`tone` de la route) → variante de pastille. */
export function badgeVariantOf(tone: string): BadgeVariant {
    if (tone === 'info' || tone === 'success' || tone === 'warning' || tone === 'danger') return tone;
    return 'neutral';
}

export function bannerToneOf(tone: string): StatusBannerTone {
    if (tone === 'info' || tone === 'success' || tone === 'warning' || tone === 'danger') return tone;
    return 'neutral';
}

/** Première lettre en capitale (« samedi 5 décembre » → « Samedi 5 décembre »). */
export function capitalize(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** « 1 minute », « 15 minutes ». */
export function minutesText(n: number): string {
    return n > 1 ? `${n} minutes` : `${n} minute`;
}

/** « 1 heure », « 24 heures ». */
export function hoursText(n: number): string {
    return n > 1 ? `${n} heures` : `${n} heure`;
}

/** Durée en minutes en mots courts : « 45 min », « 2 h », « 1 h 30 ». */
export function durationText(minutes: number): string {
    const m = Math.max(0, Math.round(minutes));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')}`;
}

/** Délai restant (millisecondes) : « 45 s », « 12 min », « 1 h 12 », « 2 j 3 h ». */
export function remainingText(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return `${s} s`;
    const min = Math.floor(s / 60);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) {
        const rest = min % 60;
        return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')}`;
    }
    const d = Math.floor(h / 24);
    const restH = h % 24;
    return restH === 0 ? `${d} j` : `${d} j ${restH} h`;
}

/** Jour d'un horodatage ISO de Dakar (UTC toute l'année) : « samedi 5 décembre ». */
export function instantDay(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return dayText(d.toISOString().slice(0, 10));
}

/** Jour et heure d'un horodatage ISO : « samedi 5 décembre à 21 h 30 ». */
export function instantText(value: string | null | undefined): string {
    const day = instantDay(value);
    const hm = instantHm(value);
    return day && hm ? `${day} à ${hm}` : '';
}

/** Jour et heure locaux « AAAA-MM-JJTHH:MM » (heure de Dakar) : « samedi 5 décembre à 18 h ». */
export function localText(value: string | null | undefined): string {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value ?? '');
    return m ? `${dayText(m[1])} à ${hmText(m[2])}` : '';
}

/** Jour en mots, avec « aujourd'hui » et « demain » : « aujourd'hui », « demain », « samedi 5 décembre ». */
export function relativeDay(day: string, today: string): string {
    if (day === today) return 'aujourd’hui';
    const next = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    if (day === next) return 'demain';
    return dayText(day);
}

/** « Samedi 5 décembre · 20 h · 4 personnes ». */
export function reservationLine(date: string, time: string, guests: number): string {
    return `${capitalize(dayText(date))} · ${hmText(time)} · ${guests > 1 ? `${guests} personnes` : '1 personne'}`;
}

/** Plage d'horaires : « 12 h à 15 h », « 19 h à 2 h (le lendemain) », « 18 h à minuit ». */
export function hoursRangeText(opensAt: string, closesAt: string): string {
    const end = closesAt.startsWith('24:00') || closesAt.startsWith('00:00') ? 'minuit' : hmText(closesAt);
    const overnight = !closesAt.startsWith('24:00') && !closesAt.startsWith('00:00') && closesAt <= opensAt;
    return `${hmText(opensAt)} à ${end}${overnight ? ' (le lendemain)' : ''}`;
}

/** Fermeture exceptionnelle (début et fin, heure de Dakar « AAAA-MM-JJTHH:MM[:SS] ») en mots. */
export function closureText(startsAt: string, endsAt: string): string {
    const s = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(startsAt);
    const e = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(endsAt);
    if (!s || !e) return '';
    const [, sDay, sTime] = s;
    let [, eDay, eTime] = e;
    // Fin à minuit pile : dernier jour = la veille, toute la journée
    if (eTime === '00:00' && eDay > sDay) {
        eDay = new Date(Date.parse(`${eDay}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
        eTime = '24:00';
    }
    const fullStart = sTime === '00:00';
    const fullEnd = eTime === '24:00' || eTime === '23:59';
    if (sDay === eDay) {
        if (fullStart && fullEnd) return `${capitalize(dayText(sDay))}, toute la journée`;
        return `${capitalize(dayText(sDay))}, de ${hmText(sTime)} à ${fullEnd ? 'minuit' : hmText(eTime)}`;
    }
    if (fullStart && fullEnd) return `Du ${dayText(sDay)} au ${dayText(eDay)}`;
    return `Du ${dayText(sDay)} à ${hmText(sTime)} au ${dayText(eDay)} à ${fullEnd ? 'minuit' : hmText(eTime)}`;
}
