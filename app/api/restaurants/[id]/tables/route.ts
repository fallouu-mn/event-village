import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/api/public-error';
import { guardFeature } from '@/lib/features/flags';
import { VENUE_KIND_LABELS } from '@/lib/tables/booking';
import { POSITION_COLUMNS, publicAddress, publicPosition } from '@/lib/lieux/position-publique';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/restaurants/[id]/tables — un établissement (restaurant, bar, espace) : horaires, zones et tables.
 * Lot 11a : [id] est l'identifiant de l'établissement ; seul un établissement actif, validé par l'administration et
 * d'une partenaire VALIDE est montré (404 sinon). Avant, la route cherchait la partenaire par son nom, prenait la
 * première partenaire venue à défaut et inventait des zones d'exemple. Aucune réservation, aucune donnée personnelle.
 * Lot Carte B3 : lieu d'un particulier = ni adresse ni point exact (centre de sa zone de 300 m, `exact: false`).
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        // Lot 7 (7.3, D11, D56) : GET public, interrupteur d'abord (404 si le service est fermé)
        const closed = await guardFeature('tables', 'GET /api/restaurants/[id]/tables');
        if (closed) return closed;
        const { id } = await props.params;
        const notFound = NextResponse.json({ error: 'Cet établissement n’existe pas ou n’est plus proposé.', code: 'VENUE_NOT_FOUND' }, { status: 404 });
        if (!UUID.test(id)) return notFound;
        const supabase = getServiceRoleClient();

        const { data: venue, error } = await supabase
            .from('venues')
            .select(`id, kind, name, description, address, city, ${POSITION_COLUMNS}, slot_minutes, deposit_per_person, confirmation_mode, partners!inner(status)`)
            .eq('id', id)
            .eq('is_active', true)
            .eq('validation_status', 'VALIDEE')
            .eq('partners.status', 'VALIDE')
            .maybeSingle();
        if (error) throw new Error(`établissement ${id} : ${error.message}`);
        if (!venue) return notFound;

        const [hours, zones, tables, slot] = await Promise.all([
            supabase.from('venue_opening_hours').select('weekday, opens_at, closes_at').eq('venue_id', id).order('weekday').order('opens_at'),
            supabase.from('restaurant_zones').select('id, name, description').eq('venue_id', id).eq('is_active', true).order('name'),
            supabase.from('restaurant_tables').select('id, table_number, capacity, min_capacity, zone_id').eq('venue_id', id).eq('is_active', true).order('table_number'),
            supabase.from('platform_settings').select('value').eq('key', 'tables.slot_minutes').maybeSingle(),
        ]);
        for (const r of [hours, zones, tables]) if (r.error) throw new Error(`établissement ${id} : ${r.error.message}`);

        const position = publicPosition(venue);
        return NextResponse.json({
            venue: {
                id: venue.id,
                kind: VENUE_KIND_LABELS[String(venue.kind)] ?? 'Établissement',
                name: venue.name,
                description: venue.description,
                address: publicAddress(venue),
                city: venue.city,
                latitude: position?.lat ?? null,
                longitude: position?.lng ?? null,
                exact: position?.exact ?? false,
                slotMinutes: venue.slot_minutes ?? Number((slot.data?.value as { value?: unknown } | null)?.value ?? 120),
                depositPerPerson: venue.deposit_per_person === null ? 0 : Number(venue.deposit_per_person),
                confirmation: venue.confirmation_mode === 'MANUELLE' ? 'Sur acceptation de l’établissement' : 'Confirmation immédiate',
            },
            hours: (hours.data ?? []).map((h) => ({ weekday: h.weekday, opensAt: String(h.opens_at).slice(0, 5), closesAt: String(h.closes_at).slice(0, 5) })),
            zones: (zones.data ?? []).map((z) => ({ id: z.id, name: z.name, description: z.description })),
            tables: (tables.data ?? []).map((t) => ({ id: t.id, number: t.table_number, capacity: t.capacity, minCapacity: t.min_capacity, zoneId: t.zone_id })),
        });
    } catch (err: unknown) {
        return apiFailure('GET /api/restaurants/[id]/tables', err, { message: 'Établissement momentanément indisponible.', code: 'VENUE_UNAVAILABLE', status: 500 });
    }
}
