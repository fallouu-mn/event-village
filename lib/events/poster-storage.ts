/**
 * Finition 2a (1b) — affiches des événements dans le stockage public (compartiment public-images, dossier
 * events/<id de la partenaire>/). Module serveur (service_role).
 *  - posterPath : chemin d'une affiche déposée par le formulaire, à partir de son adresse publique, ou null (sert au
 *    contrôle d'existence à l'enregistrement, qui n'accepte que les noms de dépôt) ;
 *  - posterExists : le fichier existe-t-il vraiment ;
 *  - removePosterIfUnused : efface une affiche remplacée si plus aucun événement ne l'utilise ;
 *  - purgeOrphanPosters : efface les affiches de plus de N jours qu'aucun événement n'utilise (tâche planifiée
 *    events-finish).
 * Une affiche est « utilisée » quand le chemin de stockage d'une adresse enregistrée (affiche ou galerie de n'importe
 * quel événement) lui est égal, quel que soit l'hôte de l'adresse et sans filtre sur le nom : une affiche ancienne au
 * nom libre, ou enregistrée avec une autre forme d'adresse, n'est jamais effacée tant qu'un événement la cite.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

const BUCKET = 'public-images';
const PUBLIC_MARK = `/storage/v1/object/public/${BUCKET}/`;
const POSTER_PATH = /^events\/[0-9a-f-]{36}\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$/i;
const EVENTS_PAGE = 1000;

export const POSTER_NOT_FOUND_TEXT = 'L’affiche n’a pas été trouvée : déposez-la de nouveau.';

/** Chemin de stockage d'une adresse publique du compartiment (décodé, sans paramètres), ou null. */
function storagePathOf(url: unknown): string | null {
    if (typeof url !== 'string') return null;
    const i = url.indexOf(PUBLIC_MARK);
    if (i < 0) return null;
    const raw = url.slice(i + PUBLIC_MARK.length).split(/[?#]/)[0];
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

export function posterPath(url: string | null | undefined): string | null {
    const path = storagePathOf(url);
    return path && POSTER_PATH.test(path) && !path.split('/').includes('..') ? path : null;
}

function split(path: string): { folder: string; name: string } {
    const slash = path.lastIndexOf('/');
    return { folder: path.slice(0, slash), name: path.slice(slash + 1) };
}

export async function posterExists(path: string): Promise<boolean> {
    const { folder, name } = split(path);
    const { data, error } = await getServiceRoleClient().storage.from(BUCKET).list(folder, { search: name, limit: 20 });
    if (error) throw new Error(`stockage illisible (${folder}) : ${error.message}`);
    return (data ?? []).some((o) => o.name === name && o.id !== null);
}

/** Chemins de stockage cités par les événements (affiche et galerie de tous les événements, état enregistré). */
async function referencedPaths(): Promise<Set<string>> {
    const used = new Set<string>();
    const supabase = getServiceRoleClient();
    for (let from = 0; ; from += EVENTS_PAGE) {
        const { data, error } = await supabase.from('events').select('id, image_url, gallery_urls').order('id').range(from, from + EVENTS_PAGE - 1);
        if (error) throw new Error(`affiches des événements illisibles : ${error.message}`);
        for (const row of data ?? []) {
            for (const url of [row.image_url, ...((row.gallery_urls as unknown[] | null) ?? [])]) {
                const path = storagePathOf(url);
                if (path) used.add(path);
            }
        }
        if (!data || data.length < EVENTS_PAGE) break;
    }
    return used;
}

/**
 * Efface l'affiche remplacée si aucun événement ne la cite plus (appelée après l'enregistrement : l'événement porte déjà
 * sa nouvelle affiche ; sa galerie compte comme les autres). Rend true si elle a été effacée.
 */
export async function removePosterIfUnused(url: string | null | undefined): Promise<boolean> {
    const path = storagePathOf(url);
    if (!path || !path.startsWith('events/') || path.split('/').includes('..')) return false;
    if ((await referencedPaths()).has(path)) return false;
    const { error } = await getServiceRoleClient().storage.from(BUCKET).remove([path]);
    if (error) throw new Error(`effacement de ${path} impossible : ${error.message}`);
    return true;
}

/** Affiches de plus de `olderThanDays` jours qu'aucun événement ne cite : effacées (au plus `max` par passage). */
export async function purgeOrphanPosters(olderThanDays = 7, max = 200): Promise<{ scanned: number; deleted: number }> {
    const storage = getServiceRoleClient().storage.from(BUCKET);
    const cutoff = Date.now() - olderThanDays * 86_400_000;
    const { data: folders, error } = await storage.list('events', { limit: 1000 });
    if (error) throw new Error(`dossier events illisible : ${error.message}`);
    const candidates: string[] = [];
    for (const folder of folders ?? []) {
        if (folder.id !== null) continue; // un fichier posé à la racine : jamais une affiche d'une partenaire
        const { data: files, error: filesErr } = await storage.list(`events/${folder.name}`, { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
        if (filesErr) throw new Error(`dossier events/${folder.name} illisible : ${filesErr.message}`);
        for (const f of files ?? []) {
            const created = Date.parse(f.created_at ?? '');
            if (f.id !== null && Number.isFinite(created) && created < cutoff) candidates.push(`events/${folder.name}/${f.name}`);
        }
    }
    if (candidates.length === 0) return { scanned: 0, deleted: 0 };
    const used = await referencedPaths();
    const orphans = candidates.filter((p) => !used.has(p)).slice(0, max);
    if (orphans.length > 0) {
        const { error: rmErr } = await storage.remove(orphans);
        if (rmErr) throw new Error(`effacement des affiches orphelines impossible : ${rmErr.message}`);
    }
    return { scanned: candidates.length, deleted: orphans.length };
}
