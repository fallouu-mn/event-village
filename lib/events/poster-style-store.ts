/**
 * Design 1d (point 1) — enregistrement du style d'une image déposée (couleur dominante assombrie, image floutée) par
 * poster_style_put (migration 20261127000001, service_role seulement). Les événements qui citent le fichier prennent ce
 * style par le trigger trg_events_poster_style (à l'enregistrement de l'adresse) ou par poster_style_put lui-même (ceux
 * qui le citent déjà). Un échec n'empêche jamais le dépôt : il est journalisé, et l'écran prend le « bleu nuit ».
 * Module serveur (sharp, service_role).
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { computePosterStyle, type PosterStyle } from '@/lib/images/poster-style';

export type PosterStyleRecord =
    | { ok: true; style: PosterStyle; events: number }
    | { ok: false; reason: string };

/** Calcule et enregistre le style du fichier `path` (chemin dans public-images) à partir de ses octets. */
export async function recordPosterStyle(path: string, image: Buffer): Promise<PosterStyleRecord> {
    let style: PosterStyle;
    try {
        style = await computePosterStyle(image);
    } catch (err) {
        const reason = `style non calculé : ${err instanceof Error ? err.message : String(err)}`;
        console.warn(`[affiche] ${path} : ${reason}`);
        return { ok: false, reason };
    }
    const { data, error } = await getServiceRoleClient().rpc('poster_style_put', { p_path: path, p_color: style.color, p_blur: style.blur });
    if (error) {
        const reason = `style non enregistré : ${error.code ?? ''} ${error.message}`.trim();
        console.warn(`[affiche] ${path} : ${reason}`);
        return { ok: false, reason };
    }
    const reply = (data ?? {}) as { ok?: unknown; code?: unknown; events?: unknown };
    if (reply.ok !== true) {
        const reason = `style refusé : ${String(reply.code ?? 'réponse inattendue')}`;
        console.warn(`[affiche] ${path} : ${reason}`);
        return { ok: false, reason };
    }
    return { ok: true, style, events: Number(reply.events ?? 0) };
}
