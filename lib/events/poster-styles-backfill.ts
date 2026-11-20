/**
 * Design 1d (point 1) — style des affiches déjà citées par un événement, déposées avant le design 1d (sans couleur ni
 * image floutée). Lancé par scripts/poster-styles.ts (tâche d'exploitation, compte de service) :
 *  - candidates : événements dont l'affiche est un fichier du compartiment public-images et dont la couleur est vide ;
 *  - pour chaque fichier (une fois s'il est cité par plusieurs événements) : lu, style calculé comme au dépôt
 *    (lib/images/poster-style.ts), enregistré par poster_style_put, qui le range aussi dans chaque événement qui cite le
 *    fichier (une écriture par événement, seulement si le style change) ;
 *  - à blanc (par défaut) : la liste de ce qui serait fait, rien n'est écrit ;
 *  - rejouable : un second passage ne retrouve que les fichiers absents ou illisibles, laissés et signalés ; l’écran
 *    garde le « bleu nuit ».
 * Module serveur (service_role).
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { computePosterStyle } from '@/lib/images/poster-style';
import { recordPosterStyle } from '@/lib/events/poster-style-store';

const BUCKET = 'public-images';
const PUBLIC_MARK = `/storage/v1/object/public/${BUCKET}/`;
const PAGE = 1000;
const DEFAULT_LIMIT = 100;

export interface PosterStylesOptions {
    /** false (défaut) : à blanc, rien n'est écrit. */
    apply?: boolean;
    /** Événements visés seulement (tests) ; sinon tous. */
    onlyEventIds?: string[];
    /** Fichiers traités au plus par passage (défaut 100) ; le reste est compté dans `remaining`. */
    limit?: number;
}

export interface PosterStylesReport {
    apply: boolean;
    candidates: number;
    planned: Array<{ path: string; events: string[]; color: string }>;
    done: Array<{ path: string; events: number; color: string }>;
    skipped: Array<{ path: string; events: string[]; reason: string }>;
    remaining: number;
}

/** Chemin tel que l'écrit l'adresse (même règle que public.poster_path_of : rien n'est décodé). */
function rawPathOf(url: string): string | null {
    const i = url.indexOf(PUBLIC_MARK);
    if (i < 0) return null;
    const raw = url.slice(i + PUBLIC_MARK.length).split(/[?#]/)[0];
    return raw && !raw.split('/').includes('..') ? raw : null;
}

async function candidates(onlyEventIds?: string[]): Promise<Map<string, string[]>> {
    const supabase = getServiceRoleClient();
    const out = new Map<string, string[]>();
    for (let from = 0; ; from += PAGE) {
        let query = supabase.from('events').select('id, image_url')
            .is('poster_color', null)
            .like('image_url', `%${PUBLIC_MARK}%`)
            .order('id').range(from, from + PAGE - 1);
        if (onlyEventIds) query = query.in('id', onlyEventIds);
        const { data, error } = await query;
        if (error) throw new Error(`affiches des événements illisibles : ${error.message}`);
        for (const row of data ?? []) {
            const path = typeof row.image_url === 'string' ? rawPathOf(row.image_url) : null;
            if (!path) continue;
            out.set(path, [...(out.get(path) ?? []), String(row.id)]);
        }
        if (!data || data.length < PAGE) break;
    }
    return out;
}

export async function backfillPosterStyles(opts: PosterStylesOptions = {}): Promise<PosterStylesReport> {
    const apply = opts.apply === true;
    const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT));
    const storage = getServiceRoleClient().storage.from(BUCKET);
    const found = await candidates(opts.onlyEventIds);
    const paths = Array.from(found.keys()).sort();
    const report: PosterStylesReport = { apply, candidates: paths.length, planned: [], done: [], skipped: [], remaining: Math.max(0, paths.length - limit) };

    for (const path of paths.slice(0, limit)) {
        const events = (found.get(path) ?? []).sort();
        let decoded = path;
        try {
            decoded = decodeURIComponent(path);
        } catch {
            decoded = path; // adresse non décodable : lue telle quelle
        }
        const { data: blob, error: readErr } = await storage.download(decoded);
        if (readErr || !blob) {
            report.skipped.push({ path, events, reason: 'fichier absent du stockage' });
            continue;
        }
        const bytes = Buffer.from(await blob.arrayBuffer());
        if (!apply) {
            try {
                const style = await computePosterStyle(bytes);
                report.planned.push({ path, events, color: style.color });
            } catch (err) {
                report.skipped.push({ path, events, reason: `image illisible (${err instanceof Error ? err.message : String(err)})` });
            }
            continue;
        }
        const saved = await recordPosterStyle(path, bytes);
        if (!saved.ok) {
            report.skipped.push({ path, events, reason: saved.reason });
            continue;
        }
        report.done.push({ path, events: saved.events, color: saved.style.color });
    }
    return report;
}
