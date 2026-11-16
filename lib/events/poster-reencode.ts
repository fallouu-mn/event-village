/**
 * Correctifs de la contre-vérification de la finition 2a (T5) — affiches déjà citées par un événement mais déposées
 * avant la finition : le fichier est servi tel qu'il a été déposé, métadonnées comprises (position GPS de la prise de
 * vue). Réencodage une fois, par scripts/reencode-posters.ts (tâche d'exploitation, compte de service) :
 *  - candidates : adresse `image_url` d'un événement qui désigne un fichier du compartiment public-images rangé dans
 *    `events/<dossier>/` et dont le nom n'est pas celui de la route de dépôt (horodatage_8 caractères.webp) ;
 *  - pour chaque fichier (une seule fois s'il est cité par plusieurs événements) : lu, réencodé comme à la route
 *    (lib/images/encode-image.ts), déposé dans LE MÊME dossier sous un nom de la route ; chaque événement qui cite encore
 *    l'ancienne adresse prend la nouvelle (event_poster_reencoded : comparaison puis écriture, sans alerte « affiche »
 *    aux admins, journalisé) ; l'ancien fichier est effacé s'il n'est plus cité nulle part (removePosterIfUnused) ;
 *  - à blanc (par défaut) : la liste de ce qui serait fait, rien n'est écrit ;
 *  - rejouable : un second passage ne trouve plus rien ; un passage interrompu laisse au pire un fichier nouveau non
 *    cité, effacé par la purge des affiches au bout de 7 jours ;
 *  - un fichier absent ou illisible est laissé tel quel et signalé (« skipped »).
 * Module serveur (service_role).
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { encodeImage, storedImageName } from '@/lib/images/encode-image';
import { STORED_IMAGE_NAME_RE } from '@/lib/images/stored-name';
import { removePosterIfUnused, storagePathOf } from '@/lib/events/poster-storage';

const BUCKET = 'public-images';
/** Fichier rangé directement dans un dossier de partenaire : events/<uuid>/<nom> (rien d'autre). */
const LEGACY_PATH = /^events\/([0-9a-f-]{36})\/([^/]+)$/;
const PAGE = 1000;
const DEFAULT_LIMIT = 50;

export interface ReencodeOptions {
    /** false (défaut) : à blanc, rien n'est écrit. */
    apply?: boolean;
    /** Événements visés seulement (tests) ; sinon tous. */
    onlyEventIds?: string[];
    /** Fichiers traités au plus par passage (défaut 50) ; le reste est compté dans `remaining`. */
    limit?: number;
}

export interface ReencodeReport {
    apply: boolean;
    /** Fichiers d'avant la finition cités par au moins un événement. */
    candidates: number;
    /** À blanc : ce qui serait réencodé. */
    planned: Array<{ path: string; events: string[] }>;
    /** Réencodés : ancien chemin, nouveau chemin, événements mis à jour, ancien fichier effacé ou gardé (encore cité). */
    done: Array<{ from: string; to: string; events: string[]; oldRemoved: boolean }>;
    /** Laissés tels quels, et pourquoi. */
    skipped: Array<{ path: string; events: string[]; reason: string }>;
    /** Laissés pour un passage suivant (limite). */
    remaining: number;
}

interface Citation { eventId: string; url: string }

/** Fichiers d'avant la finition cités par un événement : chemin → citations (événement, adresse telle qu'enregistrée). */
async function legacyCitations(onlyEventIds?: string[]): Promise<Map<string, Citation[]>> {
    const supabase = getServiceRoleClient();
    const out = new Map<string, Citation[]>();
    for (let from = 0; ; from += PAGE) {
        let query = supabase.from('events').select('id, image_url')
            .like('image_url', `%/storage/v1/object/public/${BUCKET}/events/%`)
            .order('id').range(from, from + PAGE - 1);
        if (onlyEventIds) query = query.in('id', onlyEventIds);
        const { data, error } = await query;
        if (error) throw new Error(`affiches des événements illisibles : ${error.message}`);
        for (const row of data ?? []) {
            const url = typeof row.image_url === 'string' ? row.image_url : null;
            const path = storagePathOf(url);
            if (!url || !path || path.split('/').includes('..')) continue;
            const m = LEGACY_PATH.exec(path);
            if (!m || STORED_IMAGE_NAME_RE.test(m[2])) continue;
            const list = out.get(path) ?? [];
            list.push({ eventId: String(row.id), url });
            out.set(path, list);
        }
        if (!data || data.length < PAGE) break;
    }
    return out;
}

export async function reencodeLegacyPosters(opts: ReencodeOptions = {}): Promise<ReencodeReport> {
    const apply = opts.apply === true;
    const limit = Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT));
    const supabase = getServiceRoleClient();
    const storage = supabase.storage.from(BUCKET);
    const citations = await legacyCitations(opts.onlyEventIds);
    const paths = Array.from(citations.keys()).sort();
    const report: ReencodeReport = { apply, candidates: paths.length, planned: [], done: [], skipped: [], remaining: Math.max(0, paths.length - limit) };

    for (const path of paths.slice(0, limit)) {
        const cited = citations.get(path) ?? [];
        const events = Array.from(new Set(cited.map((c) => c.eventId))).sort();
        const { data: blob, error: readErr } = await storage.download(path);
        if (readErr || !blob) {
            report.skipped.push({ path, events, reason: 'fichier absent du stockage' });
            continue;
        }
        let encoded: Buffer;
        try {
            encoded = await encodeImage(Buffer.from(await blob.arrayBuffer()));
        } catch (err) {
            report.skipped.push({ path, events, reason: `image illisible (${err instanceof Error ? err.message : String(err)})` });
            continue;
        }
        if (!apply) {
            report.planned.push({ path, events });
            continue;
        }
        const folder = path.slice(0, path.lastIndexOf('/'));
        const target = `${folder}/${storedImageName()}`;
        const { error: upErr } = await storage.upload(target, encoded, { contentType: 'image/webp', upsert: false });
        if (upErr) throw new Error(`dépôt de ${target} impossible : ${upErr.message}`);
        const newUrl = storage.getPublicUrl(target).data.publicUrl;
        const updated: string[] = [];
        for (const c of cited) {
            const { data, error } = await supabase.rpc('event_poster_reencoded', { p: { event_id: c.eventId, old_url: c.url, new_url: newUrl } });
            if (error) throw new Error(`event_poster_reencoded (${c.eventId}) : ${error.code ?? ''} ${error.message}`);
            const reply = (data ?? {}) as { ok?: boolean; updated?: boolean; code?: string };
            if (reply.ok !== true) throw new Error(`event_poster_reencoded (${c.eventId}) : refus ${JSON.stringify(reply)}`);
            if (reply.updated === true) updated.push(c.eventId);
        }
        if (updated.length === 0) {
            // Affiche changée entre-temps par tous ses événements : le fichier nouveau n'est cité par personne
            const { error: rmErr } = await storage.remove([target]);
            if (rmErr) console.error(`[reencodeLegacyPosters] fichier nouveau ${target} non effacé :`, rmErr.message);
            report.skipped.push({ path, events, reason: 'affiche changée entre-temps' });
            continue;
        }
        const oldRemoved = await removePosterIfUnused(cited[0].url);
        report.done.push({ from: path, to: target, events: Array.from(new Set(updated)).sort(), oldRemoved });
    }
    return report;
}
