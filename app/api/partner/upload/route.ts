import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const BUCKET_NAME = 'public-images';

export async function POST(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user || !['PARTENAIRE', 'ADMIN', 'SUPERADMIN'].includes(user.role)) {
            return NextResponse.json({ error: 'Non autorise.' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const folder = (formData.get('folder') as string) || 'misc';

        if (!file) {
            return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 });
        }

        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: 'Format non supporte. Formats acceptes : JPEG, PNG, WebP.' },
                { status: 400 }
            );
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json(
                { error: 'Le fichier depasse la taille maximale autorisee (5 Mo).' },
                { status: 400 }
            );
        }

        const supabase = getServiceRoleClient();

        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);
        if (!bucketExists) {
            await supabase.storage.createBucket(BUCKET_NAME, {
                public: true,
                fileSizeLimit: MAX_FILE_SIZE_BYTES,
                allowedMimeTypes: ALLOWED_MIME_TYPES,
            });
        }

        const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const sanitizedFolder = folder.replace(/[^a-z0-9_-]/gi, '');
        const filePath = `${sanitizedFolder}/${timestamp}_${randomSuffix}.${ext}`;

        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, { contentType: file.type, upsert: false });

        if (uploadError) {
            return NextResponse.json(
                { error: `Echec upload : ${uploadError.message}` },
                { status: 500 }
            );
        }

        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        return NextResponse.json({
            success: true,
            url: urlData.publicUrl,
            filePath,
        });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Erreur interne.' },
            { status: 500 }
        );
    }
}
