/**
 * Lot 7 (contrat, section 11.1) — vues et réseaux simulés partagés par playwright.config.ts et les specs
 * qui ouvrent leurs propres contextes (installable.spec.ts : contexte persistant ; perf.spec.ts : contexte
 * neuf par passage, sans verrou réseau). Valeurs reprises telles quelles de playwright.config.ts (lot 5.1).
 *
 * Réseaux simulés (décision D83, recopiés tels quels dans le rapport) : préréglages de Chrome DevTools,
 * appliqués par CDP `Network.emulateNetworkConditions` (débits en octets par seconde).
 *  - « 4G » (DevTools « Slow 4G », ex-« Fast 3G ») : 562,5 ms, 1,44 Mbit/s descendant, 675 kbit/s montant ;
 *  - « 3G » (DevTools « 3G », ex-« Slow 3G ») : 2 000 ms, 400 kbit/s descendant, 400 kbit/s montant.
 */
export const DESKTOP = {
    browserName: 'chromium' as const,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
};

export const MOBILE = {
    browserName: 'chromium' as const,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
};

export interface NetworkPreset {
    nom: string;
    /** Latence ajoutée par requête, en millisecondes. */
    latency: number;
    /** Débit descendant, en octets par seconde. */
    downloadThroughput: number;
    /** Débit montant, en octets par seconde. */
    uploadThroughput: number;
}

export const NET_4G: NetworkPreset = { nom: '4G (DevTools « Slow 4G »)', latency: 562.5, downloadThroughput: 1_440_000 / 8, uploadThroughput: 675_000 / 8 };
export const NET_3G: NetworkPreset = { nom: '3G (DevTools « 3G »)', latency: 2_000, downloadThroughput: 400_000 / 8, uploadThroughput: 400_000 / 8 };

/** Paramètres CDP de Network.emulateNetworkConditions pour un préréglage (jamais combiné à setOffline). */
export function cdpNetworkConditions(p: NetworkPreset): { offline: false; latency: number; downloadThroughput: number; uploadThroughput: number } {
    return { offline: false, latency: p.latency, downloadThroughput: p.downloadThroughput, uploadThroughput: p.uploadThroughput };
}

/** Retrait du bridage CDP (valeurs de Playwright pour « aucun bridage »), avant tout setOffline. */
export const CDP_NO_THROTTLING = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 } as const;
