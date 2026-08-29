import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/documents/signed-url?path=...
 * Génère une URL signée temporaire pour consulter un document privé du bucket partner_documents
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const filePath = searchParams.get('path');

        if (!filePath) {
            return NextResponse.json({ error: 'Chemin du fichier (path) requis.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // 1. Vérification de l'utilisateur authentifié
        let isAuthorized = false;

        // Vérifier si appel administrateur
        const adminAuth = await verifyAdminAuth(req);
        if (adminAuth.authorized) {
            isAuthorized = true;
        } else {
            // Vérifier si le token appartient au partenaire propriétaire du document
            const authHeader = req.headers.get('authorization');
            let token: string | undefined;
            if (authHeader?.startsWith('Bearer ')) token = authHeader.substring(7);
            else token = req.cookies.get('sb-access-token')?.value || req.cookies.get('sb-auth-token')?.value;

            if (token) {
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user && (filePath.startsWith(`${user.id}/`) || filePath.startsWith(`temp_`) || filePath.startsWith(`pending_registrations/`))) {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            return NextResponse.json(
                { error: 'Accès non autorisé à ce document.' },
                { status: 403 }
            );
        }

        // 2. Création de l'URL signée (valable 60 minutes)
        const { data: signedData, error: signError } = await supabase.storage
            .from('partner_documents')
            .createSignedUrl(filePath, 3600);

        if (signError || !signedData?.signedUrl) {
            return NextResponse.json(
                { error: signError?.message || 'Impossible de générer le lien de consultation.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            signedUrl: signedData.signedUrl,
            expiresIn: 3600,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
