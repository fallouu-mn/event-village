/**
 * Finition 2a (1b) — affiches des événements dans le stockage public (compartiment public-images, dossier
 * events/<id de la partenaire>/). Module serveur (service_role).
 *  - posterPath : chemin d'une affiche du projet à partir de son adresse publique, ou null ;
 *  - posterExists : le fichier existe-t-il vraiment (vérifié à l'enregistrement de l'événement) ;
 *  - removePosterIfUnused : efface une affiche remplacée si plus aucun événement ne l'utilise ;
 *  - purgeOrphanPosters : efface les affiches de plus de N jours qu'aucun événement n'utilise (tâche planifiée
 *    events-finish) ; jamais une affiche utilisée (image_url ou galerie), jamais une affiche récente.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

const BUCKET = 'public-images';
const PUBLIC_MARK = `/storage/v1/object/public/${BUCKET}/`;
const POSTER_PATH = /^events\/[0-9a-f-]{36}\/[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$/i;

export const POSTER_NOT_FOUND_TEXT = 'L’affiche n’a pas été trouvée : déposez-la de nouveau.';

export function posterPath(url: string | null | undefined): string | null {
    if (!url) return null;
    const i = url.indexOf(PUBLIC_MARK);
    if (i < 0) return null;
    const path = decodeURIComponent(url.slice(i + PUBLIC_MARK.length).split(/[?#]/)[0]);
    return POSTER_PATH.test(path) && !path.split('/').includes('..') ? path : null;
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

function publicUrl(path: string): string {
    return getServiceRoleClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Adresses (parmi `urls`) encore utilisées par un événement autre que `exceptEventId` : affiche ou galerie. */
async function usedUrls(urls: string[], exceptEventId: string | null): Promise<Set<string>> {
    const used = new Set<string>();
    const supabase = getServiceRoleClient();
    for (let i = 0; i < urls.length; i += 100) {
        const chunk = urls.slice(i, i + 100);
        let byImage = supabase.from('events').select('id, image_url').in('image_url', chunk);
        let byGallery = supabase.from('events').select('id, gallery_urls').overlaps('gallery_urls', chunk);
        if (exceptEventId) {
            byImage = byImage.neq('id', exceptEventId);
            byGallery = byGallery.neq('id', exceptEventId);
        }
        const [a, b] = await Promise.all([byImage, byGallery]);
        if (a.error) throw new Error(`affiches utilisées illisibles : ${a.error.message}`);
        if (b.error) throw new Error(`galeries illisibles : ${b.error.message}`);
        for (const r of a.data ?? []) if (typeof r.image_url === 'string') used.add(r.image_url);
        for (const r of b.data ?? []) for (const u of (r.gallery_urls as string[] | null) ?? []) if (chunk.includes(u)) used.add(u);
    }
    return used;
}

/** Efface l'affiche remplacée si aucun autre événement ne l'utilise. Rend true si elle a été effacée. */
export async function removePosterIfUnused(url: string | null | undefined, exceptEventId: string): Promise<boolean> {
    const path = posterPath(url);
    if (!path || !url) return false;
    if ((await usedUrls([url], exceptEventId)).size > 0) return false;
    const { error } = await getServiceRoleClient().storage.from(BUCKET).remove([path]);
    if (error) throw new Error(`effacement de ${path} impossible : ${error.message}`);
    return true;
}

/** Affiches de plus de `olderThanDays` jours qu'aucun événement n'utilise : effacées (au plus `max` par passage). */
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
    const byUrl = new Map(candidates.map((p) => [publicUrl(p), p] as const));
    const used = await usedUrls([...byUrl.keys()], null);
    const orphans = [...byUrl.entries()].filter(([u]) => !used.has(u)).map(([, p]) => p).slice(0, max);
    if (orphans.length > 0) {
        const { error: rmErr } = await storage.remove(orphans);
        if (rmErr) throw new Error(`effacement des affiches orphelines impossible : ${rmErr.message}`);
    }
    return { scanned: candidates.length, deleted: orphans.length };
}
