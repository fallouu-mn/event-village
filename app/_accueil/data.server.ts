import { unstable_cache } from 'next/cache';
import { getFeatureFlags } from '@/lib/features/flags';
import { cachedCatalogEvents, PUBLIC_REVALIDATE_SECONDS } from '@/lib/events/catalog-cache.server';
import { catalogCities, type CatalogEventDto } from '@/lib/events/catalog.server';
import { homeSections, type HomeSections } from '@/lib/events/catalog-home';
import { featuredBadgeText } from '@/lib/events/catalog-display';
import { listHomeFeatured } from '@/lib/events/featured.server';
import { getPopularEvents } from '@/lib/events/popular.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

/**
 * Design 1b (points 1 et 3) — données de l'accueil, lues côté serveur et mises en cache 60 s (unstable_cache : les
 * lectures Supabase n'y rendent pas la page dynamique). Tout est public et identique pour chaque visiteur : aucune
 * session, aucune ville de profil, aucun panier. Les parties personnelles sont des îlots client chargés après.
 */

/** Cartes de la rangée « À la une ». */
export const HOME_FEATURED_LIMIT = 10;

export type HomeCard = CatalogEventDto & { highlight: string | null };

export type FeaturedSource = 'a-la-une' | 'populaires' | 'prochainement';

export interface ReferralOffer {
    /** Taux N1 et N2 de referral_config (en %), durée en mois : lignes actives seulement. */
    rateN1: number;
    rateN2: number;
    months: number;
}

export interface HomeData {
    renderedAt: number;
    featured: { source: FeaturedSource; events: HomeCard[] };
    sections: HomeSections<CatalogEventDto>;
    cities: string[];
    referral: ReferralOffer | null;
    hallsEnabled: boolean;
}

const cachedFeatured = unstable_cache(() => listHomeFeatured(HOME_FEATURED_LIMIT), ['accueil-a-la-une', 'v1'], { revalidate: PUBLIC_REVALIDATE_SECONDS, tags: ['accueil'] });
const cachedPopular = unstable_cache(() => getPopularEvents(), ['accueil-populaires', 'v1'], { revalidate: PUBLIC_REVALIDATE_SECONDS, tags: ['accueil'] });

/**
 * Offre de parrainage d'un client (sponsor STANDARD, filleul client), lue dans referral_config : jamais écrite en dur.
 * Aucune ligne active : null (le bloc n'est pas affiché).
 */
async function readReferralOffer(): Promise<ReferralOffer | null> {
    const { data, error } = await getServiceRoleClient()
        .from('referral_config')
        .select('rate_n1, rate_n2, duration_months')
        .eq('sponsor_status', 'STANDARD')
        .eq('referral_type', 'CLIENT_TO_CLIENT')
        .eq('is_active', true)
        .maybeSingle();
    if (error) throw new Error(`referral_config illisible : ${error.message}`);
    if (!data) return null;
    const rateN1 = Number(data.rate_n1);
    const rateN2 = Number(data.rate_n2);
    const months = Number(data.duration_months);
    if (!(rateN1 > 0) || !(months > 0) || !Number.isFinite(rateN2) || rateN2 < 0) return null;
    return { rateN1, rateN2, months };
}

const cachedReferral = unstable_cache(readReferralOffer, ['accueil-parrainage', 'v1'], { revalidate: PUBLIC_REVALIDATE_SECONDS });
const cachedHalls = unstable_cache(async () => (await getFeatureFlags()).halls, ['accueil-salles', 'v1'], { revalidate: PUBLIC_REVALIDATE_SECONDS });

/** Lecture facultative : une panne n'empêche pas l'accueil, la partie concernée est seulement absente. */
async function optional<T>(label: string, read: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await read();
    } catch (err) {
        console.error(`[accueil] ${label} indisponible :`, err instanceof Error ? err.message : String(err));
        return fallback;
    }
}

function card(e: CatalogEventDto, highlight: string | null = null): HomeCard {
    return { ...e, highlight };
}

/**
 * Données de l'accueil. Le catalogue est obligatoire (sa panne est levée : en régénération, Next garde la dernière page
 * réussie) ; « À la une », les plus vendus, le parrainage et l'interrupteur des salles sont facultatifs.
 * « À la une » : choix du Superadmin (étiquette « À la une », « Sponsorisé » prévu) ; sinon les plus vendus des 7 derniers
 * jours (sans étiquette) ; sinon les prochains événements.
 */
export async function loadHomeData(now = new Date()): Promise<HomeData> {
    const t = now.getTime();
    const stillOn = (e: CatalogEventDto): boolean => Date.parse(e.endsAt) > t;
    const [catalog, featured, referral, hallsEnabled] = await Promise.all([
        cachedCatalogEvents(t),
        optional('à la une', cachedFeatured, []),
        optional('parrainage', cachedReferral, null),
        optional('interrupteur des salles', cachedHalls, false),
    ]);

    let featuredBlock: HomeData['featured'];
    const chosen = featured.filter(stillOn);
    if (chosen.length > 0) {
        featuredBlock = { source: 'a-la-une', events: chosen.map((e) => card(e, featuredBadgeText(e.featuredLabel))) };
    } else {
        const popular = (await optional('populaires', cachedPopular, [])).filter(stillOn);
        featuredBlock = popular.length > 0
            ? { source: 'populaires', events: popular.slice(0, HOME_FEATURED_LIMIT).map((e) => card(e)) }
            : { source: 'prochainement', events: catalog.slice(0, HOME_FEATURED_LIMIT).map((e) => card(e)) };
    }

    return {
        renderedAt: t,
        featured: featuredBlock,
        sections: homeSections(catalog, now),
        cities: catalogCities(catalog),
        referral,
        hallsEnabled,
    };
}
