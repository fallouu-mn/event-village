/**
 * Design 1d (point 7) — « Ajouter à mon agenda » : fichier .ics (iPhone, Android, Outlook) et lien Google Agenda, à
 * l'heure de Dakar (fuseau Africa/Dakar, déclaré dans le fichier). Rien n'est envoyé au serveur : le fichier est
 * fabriqué sur le téléphone. Module sans dépendance (navigateur et serveur).
 */

export const DAKAR_TZ = 'Africa/Dakar';

export interface CalendarEvent {
    /** Identifiant de l'événement (UID du fichier, stable : un second ajout remplace le premier). */
    id: string;
    title: string;
    /** Début et fin retenue, instants ISO. */
    startsAt: string;
    endsAt: string;
    /** Lieu, puis adresse ou ville. */
    location?: string | null;
    /** Adresse complète de la fiche. */
    url?: string | null;
    /** Texte libre (une ou deux lignes). */
    details?: string | null;
}

/** « 20261121T200000 » : heure locale de Dakar. */
export function dakarStamp(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error(`date illisible : ${iso}`);
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: DAKAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(d);
    const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '00';
    return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

/** « 20261120T101500Z » : instant UTC (DTSTAMP). */
function utcStamp(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Échappement d'un texte iCalendar (RFC 5545, 3.3.11). */
export function icsText(value: string): string {
    return value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

/** Pliage des lignes à 75 octets (RFC 5545, 3.1), sans couper un caractère. */
function fold(line: string): string {
    const out: string[] = [];
    let current = '';
    let bytes = 0;
    for (const ch of line) {
        const size = new TextEncoder().encode(ch).length;
        const limit = out.length === 0 ? 75 : 74;
        if (bytes + size > limit) {
            out.push(current);
            current = '';
            bytes = 0;
        }
        current += ch;
        bytes += size;
    }
    out.push(current);
    return out.join('\r\n ');
}

/** Contenu du fichier .ics (fin de ligne CRLF). */
export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Event Village//Billetterie//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VTIMEZONE',
        `TZID:${DAKAR_TZ}`,
        'BEGIN:STANDARD',
        'DTSTART:19700101T000000',
        'TZOFFSETFROM:+0000',
        'TZOFFSETTO:+0000',
        'TZNAME:GMT',
        'END:STANDARD',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        `UID:${icsText(event.id)}@event-village`,
        `DTSTAMP:${utcStamp(now)}`,
        `DTSTART;TZID=${DAKAR_TZ}:${dakarStamp(event.startsAt)}`,
        `DTEND;TZID=${DAKAR_TZ}:${dakarStamp(event.endsAt)}`,
        `SUMMARY:${icsText(event.title)}`,
        ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
        ...(event.details || event.url ? [`DESCRIPTION:${icsText([event.details, event.url].filter(Boolean).join('\n'))}`] : []),
        ...(event.url ? [`URL:${icsText(event.url)}`] : []),
        'END:VEVENT',
        'END:VCALENDAR',
    ];
    return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** Lien « Ajouter à Google Agenda » (heure de Dakar, ctz=Africa/Dakar). */
export function googleCalendarUrl(event: CalendarEvent): string {
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${dakarStamp(event.startsAt)}/${dakarStamp(event.endsAt)}`,
        ctz: DAKAR_TZ,
    });
    const details = [event.details, event.url].filter(Boolean).join('\n');
    if (details) params.set('details', details);
    if (event.location) params.set('location', event.location);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Nom du fichier : « event-village-<titre simplifié>.ics ». */
export function icsFileName(title: string): string {
    const slug = title
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return `event-village-${slug || 'evenement'}.ics`;
}
