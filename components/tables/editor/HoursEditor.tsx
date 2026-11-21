'use client';

/**
 * Lot 11b — horaires d'un établissement, jour par jour : jour fermé ou ouvert, jusqu'à 4 plages par jour, fermeture
 * après minuit acceptée (« ferme le lendemain à 2 h »), « Copier sur tous les jours ». Jours ISO de la base : 1 = lundi
 * … 7 = dimanche (index 0 à 6 ici). La base revérifie tout (venue_hours_set : plages valables, sans chevauchement).
 */
import { Copy, Moon, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Switch } from '@/components/ui/Switch';
import { TextInput } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { WEEKDAYS, hmText } from '@/lib/tables/views';

export interface HoursRange { opens: string; closes: string }
export interface DayHours { open: boolean; ranges: HoursRange[] }
export type WeekHours = DayHours[];

export const MAX_RANGES = 4;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Semaine par défaut d'un nouvel établissement : tous les jours de 12 h à 23 h. */
export function defaultWeek(): WeekHours {
    return WEEKDAYS.map(() => ({ open: true, ranges: [{ opens: '12:00', closes: '23:00' }] }));
}

/** Lignes de la base (weekday 1 à 7, « HH:MM ») → semaine du formulaire. */
export function weekFromRows(rows: readonly { weekday: number; opensAt: string; closesAt: string }[]): WeekHours {
    return WEEKDAYS.map((_, i) => {
        const ranges = rows.filter((r) => r.weekday === i + 1).map((r) => {
            const opens = r.opensAt.slice(0, 5);
            const raw = r.closesAt.slice(0, 5);
            // 24:00 (fin de journée) n'existe pas dans un champ d'heure : minuit, ou 23:59 pour une journée entière
            const closes = raw === '24:00' ? (opens === '00:00' ? '23:59' : '00:00') : raw;
            return { opens, closes };
        });
        return ranges.length > 0 ? { open: true, ranges } : { open: false, ranges: [{ opens: '12:00', closes: '23:00' }] };
    });
}

/**
 * Semaine du formulaire → lignes envoyées à la route ({ weekday, opens_at, closes_at }).
 * Une fermeture à 23:59 (affichage d'une fin de journée, voir weekFromRows) part en 24:00 : sans cela, une journée
 * entière enregistrée de nouveau perdrait son dernier créneau (un créneau doit tenir en entier dans les horaires).
 */
export function rowsFromWeek(week: WeekHours): { weekday: number; opens_at: string; closes_at: string }[] {
    return week.flatMap((d, i) => (d.open
        ? d.ranges.map((r) => ({ weekday: i + 1, opens_at: r.opens, closes_at: r.closes === '23:59' ? '24:00' : r.closes }))
        : []));
}

/** Contrôles de l'écran : erreur par jour (clé = index du jour) et erreur d'ensemble (« week »). */
export function validateWeek(week: WeekHours): Record<string, string> {
    const errors: Record<string, string> = {};
    week.forEach((d, i) => {
        if (!d.open) return;
        if (d.ranges.length === 0) errors[String(i)] = 'Ajoutez une plage ou indiquez que ce jour est fermé.';
        else if (d.ranges.length > MAX_RANGES) errors[String(i)] = `${MAX_RANGES} plages au plus par jour.`;
        else if (d.ranges.some((r) => !TIME_RE.test(r.opens) || !TIME_RE.test(r.closes))) errors[String(i)] = 'Indiquez l’heure d’ouverture et l’heure de fermeture de chaque plage.';
        else if (d.ranges.some((r) => r.opens === r.closes)) errors[String(i)] = 'L’heure de fermeture doit être différente de l’heure d’ouverture.';
    });
    if (!week.some((d) => d.open && d.ranges.length > 0)) errors.week = 'Ouvrez au moins un jour de la semaine.';
    return errors;
}

export function parseWeek(raw: unknown): WeekHours | null {
    if (!Array.isArray(raw) || raw.length !== 7) return null;
    const out: WeekHours = [];
    for (const d of raw) {
        if (!d || typeof d !== 'object') return null;
        const r = d as { open?: unknown; ranges?: unknown };
        if (typeof r.open !== 'boolean' || !Array.isArray(r.ranges) || r.ranges.length > MAX_RANGES) return null;
        const ranges: HoursRange[] = [];
        for (const x of r.ranges) {
            const o = x as { opens?: unknown; closes?: unknown } | null;
            if (!o || typeof o.opens !== 'string' || typeof o.closes !== 'string' || o.opens.length > 5 || o.closes.length > 5) return null;
            ranges.push({ opens: o.opens, closes: o.closes });
        }
        out.push({ open: r.open, ranges });
    }
    return out;
}

function daySummary(d: DayHours): string {
    if (!d.open) return 'Fermé';
    const parts = d.ranges.filter((r) => TIME_RE.test(r.opens) && TIME_RE.test(r.closes)).map((r) => `${hmText(r.opens)} à ${r.closes === '00:00' ? 'minuit' : hmText(r.closes)}`);
    return parts.length > 0 ? parts.join(', ') : 'Horaires à compléter';
}

export function HoursEditor({ idPrefix, week, onChange, errors }: {
    idPrefix: string;
    week: WeekHours;
    onChange: (next: WeekHours) => void;
    errors: Record<string, string>;
}) {
    const setDay = (i: number, day: DayHours) => onChange(week.map((d, k) => (k === i ? day : d)));
    const copyToAll = (i: number) => onChange(week.map(() => ({ open: week[i].open, ranges: week[i].ranges.map((r) => ({ ...r })) })));

    return (
        <div className="flex flex-col gap-3">
            {errors.week && <p id={`${idPrefix}-semaine-erreur`} role="alert" className="text-sm font-medium text-danger-text">{errors.week}</p>}
            <ul className="flex flex-col gap-3">
                {week.map((d, i) => {
                    const dayName = cap(WEEKDAYS[i] ?? '');
                    const err = errors[String(i)];
                    return (
                        <li key={dayName} className={cn('rounded-xl border p-3 sm:p-4', err ? 'border-danger-border' : 'border-border', d.open ? 'bg-card' : 'bg-background')}>
                            <Switch
                                id={`${idPrefix}-jour-${i}`}
                                label={dayName}
                                description={daySummary(d)}
                                checked={d.open}
                                onChange={(open) => setDay(i, { open, ranges: d.ranges.length > 0 ? d.ranges : [{ opens: '12:00', closes: '23:00' }] })}
                            />
                            {d.open && (
                                <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                                    {d.ranges.map((r, j) => {
                                        const overnight = TIME_RE.test(r.opens) && TIME_RE.test(r.closes) && r.closes < r.opens;
                                        return (
                                            <div key={j} className="flex flex-col gap-1">
                                                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                                                    <TextInput
                                                        id={`${idPrefix}-j${i}-p${j}-ouvre`}
                                                        label="Ouvre à"
                                                        type="time"
                                                        step={900}
                                                        value={r.opens}
                                                        onChange={(e) => setDay(i, { ...d, ranges: d.ranges.map((x, k) => (k === j ? { ...x, opens: e.target.value } : x)) })}
                                                        aria-invalid={err ? true : undefined}
                                                    />
                                                    <TextInput
                                                        id={`${idPrefix}-j${i}-p${j}-ferme`}
                                                        label="Ferme à"
                                                        type="time"
                                                        step={900}
                                                        value={r.closes}
                                                        onChange={(e) => setDay(i, { ...d, ranges: d.ranges.map((x, k) => (k === j ? { ...x, closes: e.target.value } : x)) })}
                                                        aria-invalid={err ? true : undefined}
                                                    />
                                                    <IconButton
                                                        aria-label={`Retirer la plage ${j + 1} du ${WEEKDAYS[i]}`}
                                                        variant="danger"
                                                        onClick={() => setDay(i, d.ranges.length === 1 ? { open: false, ranges: d.ranges } : { ...d, ranges: d.ranges.filter((_, k) => k !== j) })}
                                                    >
                                                        <Trash2 size={18} />
                                                    </IconButton>
                                                </div>
                                                {overnight && (
                                                    <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                                                        <Moon size={14} aria-hidden="true" />
                                                        {r.closes === '00:00' ? 'Ferme à minuit.' : `Ferme le lendemain à ${hmText(r.closes)}.`}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {err && <p id={`${idPrefix}-jour-${i}-erreur`} className="text-sm font-medium text-danger-text">{err}</p>}
                                    <div className="flex flex-wrap gap-2">
                                        {d.ranges.length < MAX_RANGES && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                leftIcon={<Plus size={16} />}
                                                onClick={() => setDay(i, { ...d, ranges: [...d.ranges, { opens: '19:00', closes: '23:00' }] })}
                                            >
                                                Ajouter une plage
                                            </Button>
                                        )}
                                        <Button type="button" variant="ghost" size="sm" leftIcon={<Copy size={16} />} onClick={() => copyToAll(i)} aria-label={`Copier sur tous les jours les horaires du ${WEEKDAYS[i]}`}>
                                            Copier sur tous les jours
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
