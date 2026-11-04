import { NextResponse } from 'next/server';
import { featuresUnavailable, getFeatureFlags } from '@/lib/features/flags';

export const dynamic = 'force-dynamic';

/**
 * GET /api/features — lot 7 (7.3, contrat 3.4, D55) : interrupteurs des services, publics (middleware,
 * PUBLIC_API_EXACT), lus en base à chaque requête : { halls, tables, orders }. Valeur absente ou non
 * booléenne : false (lib/features/flags). Base injoignable : 503 explicite, journalisé.
 * Sert seulement à masquer les entrées de navigation : chaque page et route contrôle son interrupteur.
 */
export async function GET() {
    try {
        const flags = await getFeatureFlags();
        return NextResponse.json(
            { halls: flags.halls, tables: flags.tables, orders: flags.orders },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    } catch (err) {
        console.error('[API /api/features]', err instanceof Error ? err.message : String(err));
        return featuresUnavailable();
    }
}
