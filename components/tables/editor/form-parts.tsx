/**
 * Lot 11b — éléments communs des formulaires d'édition d'un établissement : en-tête numéroté d'une section, option
 * radio présentée en carte (cible de 44 px au moins, focus visible), carte de section.
 */
import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

export const SECTION_CARD = 'flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6';

export function SectionTitle({ n, id, title, text, aside }: { n?: number; id: string; title: string; text?: ReactNode; aside?: ReactNode }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
                {n !== undefined && (
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-soft text-sm font-bold tabular-nums text-primary-text" aria-hidden="true">
                        {n}
                    </span>
                )}
                <div className="min-w-0">
                    <h2 id={id} className="text-lg font-bold leading-snug text-foreground-strong">{title}</h2>
                    {text && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>}
                </div>
            </div>
            {aside}
        </div>
    );
}

export function RadioCard({ name, id, value, checked, onChange, title, text, icon }: {
    name: string; id: string; value: string; checked: boolean; onChange: () => void; title: string; text: ReactNode; icon?: ReactNode;
}) {
    return (
        <label
            htmlFor={id}
            className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors duration-fast ease-standard',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                checked ? 'border-primary-text bg-primary-soft' : 'border-border bg-card hover:bg-muted',
            )}
        >
            <input id={id} type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 h-5 w-5 flex-shrink-0 accent-primary" />
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-base font-semibold text-foreground-strong">
                    {icon && <span aria-hidden="true" className="text-primary-text">{icon}</span>}
                    {title}
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{text}</span>
            </span>
        </label>
    );
}
