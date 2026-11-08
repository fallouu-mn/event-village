import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { sniffImage } from '@/lib/images/sniff';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
/** Compartiment public créé par la migration 20261102000004_lot5_edition.sql (plus de création à l'exécution). */
const BUCKET_NAME = 'public-images';
const FOLDERS = new Set(['events', 'halls', 'products', 'misc']);

/**
 * POST /api/partner/upload — dépôt d'une image publique (affiche, salle, produit) par un organisateur.
 * Lot 5 (contrat F1) : le fichier est rangé dans `<dossier>/<partner_id>/…` du compartiment public-images ;
 * pour une affiche, c'est le seul préfixe accepté par le schéma partagé (IMAGE_ORIGIN_INVALID sinon).
 * JPEG, PNG ou WebP reconnus à leurs octets, 5 Mo au plus. Réponse : `{ success, url, filePath }`.
 */
export async function POST(req: NextRequest) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json({ error: 'Envoi illisible : joignez un fichier image.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const file = formData.get('file');
    const requestedFolder = String(formData.get('folder') || 'misc');
    const folder = FOLDERS.has(requestedFolder) ? requestedFolder : 'misc';

    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Aucun fichier fourni.', code: 'FILE_REQUIRED' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: 'Le fichier dépasse la taille maximale autorisée (5 Mo).', code: 'FILE_TOO_LARGE' }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { data: partner, error: partnerErr } = await supabase.from('partners').select('id').eq('user_id', user.id).maybeSingle();
    if (partnerErr) {
        console.error(`[upload] partenaire du compte ${user.id} illisible : ${partnerErr.message}`);
        return NextResponse.json({ error: 'Dépôt impossible pour le moment.', code: 'UPLOAD_FAILED' }, { status: 500 });
    }
    if (!partner) {
        return NextResponse.json({ error: 'Un profil d’organisateur est nécessaire pour déposer une image.', code: 'PARTNER_NOT_FOUND' }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = sniffImage(buffer);
    if (!kind) {
        return NextResponse.json({ error: 'Format non pris en charge : formats acceptés JPEG, PNG et WebP.', code: 'UNSUPPORTED_FORMAT' }, { status: 400 });
    }

    const filePath = `${folder}/${partner.id}/${Date.now()}_${randomUUID().slice(0, 8)}.${kind.ext}`;
    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, { contentType: kind.mime, upsert: false });
    if (uploadError) {
        console.error(`[upload] dépôt de ${filePath} impossible : ${uploadError.message}`);
        return NextResponse.json({ error: 'Dépôt impossible pour le moment. Réessayez.', code: 'UPLOAD_FAILED' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return NextResponse.json({ success: true, url: urlData.publicUrl, filePath });
}
