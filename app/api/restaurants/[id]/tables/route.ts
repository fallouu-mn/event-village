import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/restaurants/[id]/tables
 * Récupère les tables et zones disponibles pour un restaurant
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const partnerIdOrSlug = params.id;
        const supabase = getServiceRoleClient();

        // 1. Détection format UUID pour éviter toute erreur de syntaxe SQL PostgreSQL
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(partnerIdOrSlug);

        let partner: { id: string; company_name: string; commercial_name?: string | null } | null = null;

        if (isUuid) {
            const { data } = await supabase
                .from('partners')
                .select('id, company_name, commercial_name')
                .eq('id', partnerIdOrSlug)
                .maybeSingle();
            partner = data;
        } else {
            const cleanSlug = partnerIdOrSlug.replace(/^(rest|restaurant)-/, '').replace(/-/g, ' ');
            const { data } = await supabase
                .from('partners')
                .select('id, company_name, commercial_name')
                .or(`commercial_name.ilike.%${cleanSlug}%,company_name.ilike.%${cleanSlug}%`)
                .limit(1)
                .maybeSingle();
            partner = data;
        }

        // Si aucun partenaire spécifique trouvé, chercher le premier partenaire disponible
        if (!partner) {
            const { data: fallbackPartner } = await supabase
                .from('partners')
                .select('id, company_name, commercial_name')
                .limit(1)
                .maybeSingle();
            partner = fallbackPartner;
        }

        // Si aucun partenaire n'existe en base
        if (!partner) {
            return NextResponse.json({
                partnerId: null,
                partnerName: 'Restaurant & Lounge',
                zones: [
                    { id: 'TERRASSE', name: 'Terrasse Vue Mer', description: 'Ambiance lounge en plein air', capacityMax: 8, tables: [] },
                    { id: 'SALLE', name: 'Grande Salle Panoramique', description: 'Cadre feutré et climatisé', capacityMax: 12, tables: [] },
                    { id: 'VIP', name: 'Salon VIP Privé', description: 'Espace discret avec maître d’hôtel dédié', capacityMax: 6, tables: [] },
                ],
                rawTables: [],
            });
        }

        const partnerId = partner.id;

        // Récupération des tables réelles associées
        const { data: tables, error } = await supabase
            .from('restaurant_tables')
            .select(`
                id,
                table_number,
                capacity,
                is_active,
                partner_id,
                zone_id,
                restaurant_zones(id, name, description)
            `)
            .eq('partner_id', partnerId)
            .eq('is_active', true);

        if (error) {
            console.error('[API /api/restaurants/[id]/tables] Erreur Supabase:', error);
            return NextResponse.json({ error: 'Impossible de charger les tables.' }, { status: 500 });
        }

        // Regroupement par zone
        const zonesMap = new Map<string, { id: string; name: string; description: string; capacityMax: number; tables: any[] }>();

        (tables || []).forEach((t: any) => {
            const zoneId = t.restaurant_zones?.id || 'ZONE_GENERALE';
            const zoneName = t.restaurant_zones?.name || 'Salle Principale';
            const zoneDesc = t.restaurant_zones?.description || 'Espace de restauration chaleureux';

            if (!zonesMap.has(zoneId)) {
                zonesMap.set(zoneId, {
                    id: zoneId,
                    name: zoneName,
                    description: zoneDesc,
                    capacityMax: t.capacity,
                    tables: [],
                });
            }

            const zone = zonesMap.get(zoneId)!;
            zone.capacityMax = Math.max(zone.capacityMax, t.capacity);
            zone.tables.push({
                id: t.id,
                tableNumber: t.table_number,
                capacity: t.capacity,
            });
        });

        const zones = Array.from(zonesMap.values());

        return NextResponse.json({
            partnerId,
            partnerName: partner?.commercial_name || partner?.company_name || 'Restaurant & Lounge',
            zones: zones.length > 0 ? zones : [
                { id: 'TERRASSE', name: 'Terrasse Vue Mer', description: 'Ambiance lounge en plein air', capacityMax: 8, tables: [] },
                { id: 'SALLE', name: 'Grande Salle Panoramique', description: 'Cadre feutré et climatisé', capacityMax: 12, tables: [] },
                { id: 'VIP', name: 'Salon VIP Privé', description: 'Espace discret avec maître d’hôtel dédié', capacityMax: 6, tables: [] },
            ],
            rawTables: tables || [],
        });
    } catch (err: unknown) {
        console.error('[API /api/restaurants/[id]/tables] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
