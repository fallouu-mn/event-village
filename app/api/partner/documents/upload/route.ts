import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { getClientIp } from '@/lib/security/client-ip';
import { reserveQuota } from '@/lib/security/quota';
import {
    PARTNER_DOCUMENTS_BUCKET,
    detectDocumentType,
    isDocType,
    newUploadPath,
    recordUpload,
} from '@/lib/partners/documents';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

/**
 * POST /api/partner/documents/upload
 * Dépôt d'une pièce d'inscription partenaire (route publique : l'inscrit n'a pas encore de compte).
 *
 * Lot 1C.2 :
 *  - type de pièce limité à id_card / business_doc ;
 *  - type réel lu dans la signature du contenu (PDF, JPEG, PNG, WebP), jamais dans le type annoncé ;
 *  - chemin aléatoire « pending/<uuid>/<type>.<ext> », sans écrasement ;
 *  - jeton de dépôt renvoyé une seule fois ; l'inscription rattache la pièce par ce jeton ;
 *  - limite par IP en base (fail-closed).
 * Le bucket est créé par la migration 0005 (plus de création à la volée).
 */
export async function POST(req: NextRequest) {
    try {
        const ip = getClientIp(req) ?? 'unknown';
        // Lot 9 quater (F2 : AUD-25) : taille annoncée contrôlée avant toute lecture ; quota global par jour en plus du
        // quota par IP (les dépôts non rattachés sont purgés après 24 h par la tâche horaire).
        const announced = Number(req.headers.get('content-length') ?? '');
        if (Number.isFinite(announced) && announced > MAX_FILE_SIZE_BYTES + 64 * 1024) {
            return NextResponse.json({ error: 'Le fichier est vide ou dépasse la taille maximale autorisée (10 Mo).' }, { status: 413 });
        }
        const quota = await reserveQuota(
            [
                { scope: 'upload_ip', bucket: ip, windowSecs: 3600, max: getServerEnv().DOCUMENT_UPLOADS_PER_IP_HOUR },
                { scope: 'upload_global', bucket: 'all', windowSecs: 86_400, max: getServerEnv().DOCUMENT_UPLOADS_GLOBAL_DAY },
            ],
            'dépôt de pièce'
        );
        if (!quota.allowed) {
            return quota.reason === 'UNAVAILABLE'
                ? NextResponse.json({ error: 'Service momentanément indisponible. Réessayez.' }, { status: 503 })
                : NextResponse.json({ error: 'Trop de dépôts depuis cette connexion. Réessayez plus tard.', code: 'UPLOAD_RATE_LIMITED' }, { status: 429 });
        }

        const formData = await req.formData();
        const file = formData.get('file');
        const docType = formData.get('docType');

        if (!isDocType(docType)) {
            return NextResponse.json({ error: 'Type de pièce invalide (id_card ou business_doc).' }, { status: 400 });
        }
        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 });
        }
        if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json({ error: 'Le fichier est vide ou dépasse la taille maximale autorisée (10 Mo).' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const detected = detectDocumentType(buffer);
        if (!detected) {
            return NextResponse.json(
                { error: 'Format de fichier non supporté. Formats acceptés : PDF, JPEG, PNG, WebP.' },
                { status: 400 }
            );
        }

        const supabase = getServiceRoleClient();
        const filePath = newUploadPath(docType, detected.ext);
        const { error: uploadError } = await supabase.storage
            .from(PARTNER_DOCUMENTS_BUCKET)
            .upload(filePath, buffer, { contentType: detected.mime, upsert: false });
        if (uploadError) {
            console.error('[API /api/partner/documents/upload] Erreur Storage :', uploadError.message);
            return NextResponse.json({ error: 'Échec du dépôt du fichier. Réessayez.' }, { status: 500 });
        }

        let recorded: { token: string; expiresAt: string };
        try {
            recorded = await recordUpload({ objectPath: filePath, docType, mime: detected.mime, size: buffer.length });
        } catch (recordErr) {
            console.error('[API /api/partner/documents/upload]', recordErr instanceof Error ? recordErr.message : recordErr);
            const { error: cleanupErr } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).remove([filePath]);
            if (cleanupErr) console.error('[API /api/partner/documents/upload] suppression du fichier orphelin impossible :', cleanupErr.message);
            return NextResponse.json({ error: 'Échec du dépôt du fichier. Réessayez.' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            filePath,
            fileName: file.name,
            uploadToken: recorded.token,
            expiresAt: recorded.expiresAt,
        });
    } catch (err: unknown) {
        console.error('[API /api/partner/documents/upload] Exception :', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
