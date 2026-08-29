import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

/**
 * POST /api/partner/documents/upload
 * Upload sécurisé de justificatifs professionnels pour l'onboarding partenaire
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const docType = (formData.get('docType') as string) || 'document';

        if (!file) {
            return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 });
        }

        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Format de fichier non supporté. Formats acceptés : PDF, JPEG, PNG.' },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json(
                { error: 'Le fichier dépasse la taille maximale autorisée (10 Mo).' },
                { status: 400 }
            );
        }

        const supabase = getServiceRoleClient();

        // Vérification de l'existence du bucket partner_documents (création si absent)
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === 'partner_documents');
        if (!bucketExists) {
            await supabase.storage.createBucket('partner_documents', {
                public: false,
                fileSizeLimit: MAX_FILE_SIZE_BYTES,
                allowedMimeTypes: ALLOWED_MIME_TYPES,
            });
        }

        const fileExt = file.name.split('.').pop() || 'pdf';
        const sanitizedExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '');
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const fileName = `${docType}_${timestamp}_${randomSuffix}.${sanitizedExt}`;
        const filePath = `pending_registrations/${fileName}`;

        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: uploadError } = await supabase.storage
            .from('partner_documents')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) {
            console.error('[API /api/partner/documents/upload] Erreur upload:', uploadError);
            return NextResponse.json(
                { error: `Échec du téléchargement du fichier : ${uploadError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            filePath,
            fileName: file.name,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/partner/documents/upload] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
