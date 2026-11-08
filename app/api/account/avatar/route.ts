import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { noStore } from '@/lib/auth/account-sync';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { sniffImage } from '@/lib/images/sniff';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'avatars';
const MAX_BYTES = 2 * 1024 * 1024;
/** Enveloppe multipart au-delà du fichier. */
const MULTIPART_MARGIN_BYTES = 64 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const AVATAR_SIZE = 256;
const AVATAR_OBJECT_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

const POST_CONTEXT = 'POST /api/account/avatar';
const DELETE_CONTEXT = 'DELETE /api/account/avatar';
const FALLBACK = { message: 'Votre photo n’a pas pu être enregistrée. Réessayez dans un instant.', code: 'AVATAR_SAVE_FAILED' };
const FILE_TOO_LARGE = new PublicError('La photo dépasse la taille maximale autorisée (2 Mo).', 'FILE_TOO_LARGE', 413);
const UNSUPPORTED_FORMAT = new PublicError('Format non pris en charge : formats acceptés JPEG, PNG et WebP.', 'UNSUPPORTED_FORMAT', 400);

type AvatarStore = ReturnType<ReturnType<typeof getServiceRoleClient>['storage']['from']>;

/**
 * Supprime la photo remplacée. Le service_role passe outre le bucket : SEUL ce contrôle empêche une avatar_url forgée
 * de faire supprimer l'objet d'un autre compte (D-cpt C6). L'ancienne URL doit être exactement dans le dossier du compte de la
 * session, sous un nom <uuid>.webp ; sinon rien n'est supprimé. Un échec est journalisé : la photo courante reste valide.
 */
async function removeReplaced(store: AvatarStore, userId: string, previousUrl: string | null, context: string): Promise<void> {
    if (!previousUrl) return;
    const marker = `${userId}/0.webp`;
    const prefix = store.getPublicUrl(marker).data.publicUrl.slice(0, -'0.webp'.length);
    const name = previousUrl.startsWith(prefix) ? previousUrl.slice(prefix.length) : '';
    if (!AVATAR_OBJECT_NAME.test(name)) {
        console.error(`[${context}] ancienne photo du compte ${userId} hors de son dossier : rien n’est supprimé`);
        return;
    }
    const { error } = await store.remove([`${userId}/${name}`]);
    if (error) console.error(`[${context}] suppression de l’ancienne photo du compte ${userId} impossible : ${error.message}`);
}

type AvatarSetReply = { ok?: boolean; code?: string; previous_url?: string | null } | null;

async function handlePost(req: NextRequest): Promise<NextResponse> {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { user } = session;
    const refuse = (err: unknown): NextResponse => apiFailure(POST_CONTEXT, err, FALLBACK);

    // Avant formData(), qui charge tout le corps en mémoire.
    const declared = Number.parseInt(req.headers.get('content-length') ?? '', 10);
    if (!Number.isFinite(declared) || declared > MAX_BYTES + MULTIPART_MARGIN_BYTES) return refuse(FILE_TOO_LARGE);

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ error: 'Envoi illisible : joignez une photo.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Aucune photo fournie.', code: 'FILE_REQUIRED' }, { status: 400 });
    if (file.size > MAX_BYTES) return refuse(FILE_TOO_LARGE);

    const input = Buffer.from(await file.arrayBuffer());
    if (!sniffImage(input)) return refuse(UNSUPPORTED_FORMAT);

    try {
        const quota = await reserveQuota(
            [{ scope: 'avatar_upload_account', bucket: user.id, windowSecs: 3600, max: getServerEnv().AVATAR_UPLOADS_PER_ACCOUNT_HOUR }],
            'photo de profil',
        );
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, { error: 'Trop d’envois de photo pour le moment. Réessayez plus tard.', code: 'AVATAR_RATE_LIMITED' });
        }

        // rotate() applique l'orientation avant la perte des métadonnées ; sans withMetadata, sharp n'en recopie aucune (EXIF, GPS).
        let output: Buffer;
        try {
            output = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
                .rotate()
                .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
                .webp({ quality: 82 })
                .toBuffer();
        } catch (err) {
            console.warn(`[${POST_CONTEXT}] image refusée pour le compte ${user.id} : ${err instanceof Error ? err.message : String(err)}`);
            return refuse(UNSUPPORTED_FORMAT);
        }

        const supabase = getServiceRoleClient();
        const store = supabase.storage.from(BUCKET);
        // Dossier tiré de la session, nom tiré au sort : rien de ce que le client envoie n'entre dans le chemin.
        const objectPath = `${user.id}/${randomUUID()}.webp`;
        const { error: uploadErr } = await store.upload(objectPath, output, { contentType: 'image/webp', upsert: false });
        if (uploadErr) return refuse(uploadErr);

        const avatarUrl = store.getPublicUrl(objectPath).data.publicUrl;
        const { data, error } = await supabase.rpc('account_avatar_set', { p: { user_id: user.id, url: avatarUrl } });
        const reply = data as AvatarSetReply;
        if (error || reply?.ok !== true) {
            const { error: cleanupErr } = await store.remove([objectPath]);
            if (cleanupErr) console.error(`[${POST_CONTEXT}] objet orphelin ${objectPath} non retiré : ${cleanupErr.message}`);
            return refuse(error ?? new Error(`account_avatar_set : ${JSON.stringify(data)}`));
        }

        await removeReplaced(store, user.id, reply.previous_url ?? null, POST_CONTEXT);
        return NextResponse.json({ ok: true, avatar_url: avatarUrl });
    } catch (err) {
        return refuse(err);
    }
}

async function handleDelete(req: NextRequest): Promise<NextResponse> {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { user } = session;
    const refuse = (err: unknown): NextResponse => apiFailure(DELETE_CONTEXT, err, FALLBACK);

    try {
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase.rpc('account_avatar_set', { p: { user_id: user.id, url: null } });
        const reply = data as AvatarSetReply;
        if (error || reply?.ok !== true) return refuse(error ?? new Error(`account_avatar_set : ${JSON.stringify(data)}`));
        await removeReplaced(supabase.storage.from(BUCKET), user.id, reply.previous_url ?? null, DELETE_CONTEXT);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return refuse(err);
    }
}

/**
 * POST /api/account/avatar — photo de profil (lot 9, 9.2, contrat 4.3, 5.3, AR3). Multipart, champ `file`, JPEG, PNG ou WebP,
 * 2 Mo au plus, type lu dans le contenu. Sortie : WebP carré de 256 px sans métadonnées, sous <user_id>/<uuid>.webp.
 * Cette route est le seul écrivain du bucket avatars : ni anon ni authenticated n'y écrivent.
 */
export async function POST(req: NextRequest) {
    return noStore(await handlePost(req));
}

/** DELETE /api/account/avatar — retire la photo du compte de la session ; sans photo, sans effet. */
export async function DELETE(req: NextRequest) {
    return noStore(await handleDelete(req));
}
