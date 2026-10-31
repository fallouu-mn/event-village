/**
 * Lot 1C.9 — IP du client pour les limites par IP.
 *
 * La source est fixée par CLIENT_IP_SOURCE (lib/env.ts) :
 *  - x-forwarded-for (défaut) : PREMIÈRE valeur de l'en-tête. Fiable seulement derrière un
 *    hébergeur ou un proxy qui réécrit cet en-tête (Vercel le fait) ; en auto-hébergement sans
 *    proxy, le client peut le falsifier et chaque valeur inventée ouvrirait un compteur neuf ;
 *  - x-real-ip : en-tête posé par un proxy de confiance ;
 *  - none : aucune IP (les limites par IP ne s'appliquent pas, les autres oui).
 * Une IPv6 est ramenée à son préfixe /64 (un abonné dispose en général d'un /64 entier).
 */
import type { NextRequest } from 'next/server';
import { getServerEnv } from '@/lib/env';

function normalizeIp(raw: string | null | undefined): string | null {
    const value = (raw ?? '').trim().replace(/^\[|\]$/g, '');
    if (!value) return null;
    if (value.includes(':') && !/^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(value)) {
        const groups = value.split('%')[0].split(':');
        return `${groups.slice(0, 4).map((g) => g || '0').join(':')}::/64`;
    }
    return value.replace(/:\d+$/, '');
}

export function getClientIp(req: NextRequest | Request): string | null {
    const source = getServerEnv().CLIENT_IP_SOURCE;
    if (source === 'none') return null;
    if (source === 'x-real-ip') return normalizeIp(req.headers.get('x-real-ip'));
    return normalizeIp((req.headers.get('x-forwarded-for') ?? '').split(',')[0]);
}
