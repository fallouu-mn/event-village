/**
 * Lot 5.1 — verrou réseau du navigateur et collecte des erreurs d'une page.
 *
 * Verrou (par contexte) : seuls les hôtes autorisés (application localhost:3000, Supabase local,
 * faux services) sont joints. Tout autre hôte est intercepté et journalisé :
 *  - tuiles de carte et images → tuile locale neutre (PNG 1×1 gris clair) ;
 *  - feuilles de style externes (Leaflet sur unpkg) → feuille vide ;
 *  - tout le reste → requête annulée (blockedbyclient).
 * Les WebSocket (Realtime) ne passent pas par ce routeur ; ils ne visent que Supabase local.
 *
 * Collecte (par page) : erreurs de console, exceptions de page, requêtes en échec et réponses ≥ 400
 * des hôtes autorisés. Les requêtes bloquées volontairement ne sont pas comptées comme des échecs.
 */
import type { BrowserContext, Page, Request } from '@playwright/test';

/** Tuile neutre (PNG 1×1, #E5E3DF) : servie à la place des tuiles OpenStreetMap et des images externes. */
export const NEUTRAL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4+vg+AAVYAqhyXHCrAAAAAElFTkSuQmCC', 'base64');

interface ContextState {
    allowedHosts: ReadonlySet<string>;
    blocked: string[];
    blockedUrls: Set<string>;
}

const states = new WeakMap<BrowserContext, ContextState>();
const blockedRequests = new WeakSet<Request>();

function isTile(url: URL): boolean {
    return /(^|\.)tile\.openstreetmap\.org$/.test(url.hostname) || /\/\d+\/\d+\/\d+(@2x)?\.(png|jpg|jpeg|webp)$/.test(url.pathname);
}

export async function installNetworkGuard(context: BrowserContext, allowedHosts: ReadonlySet<string>): Promise<void> {
    if (states.has(context)) return;
    const state: ContextState = { allowedHosts, blocked: [], blockedUrls: new Set() };
    states.set(context, state);
    await context.route('**/*', async (route) => {
        const request = route.request();
        const raw = request.url();
        let url: URL | null = null;
        try {
            url = new URL(raw);
        } catch (err) {
            state.blocked.push(`URL illisible (${err instanceof Error ? err.message : String(err)}) : ${raw.slice(0, 120)}`);
        }
        if (url && (url.protocol === 'http:' || url.protocol === 'https:') && allowedHosts.has(url.host)) {
            await route.continue();
            return;
        }
        blockedRequests.add(request);
        state.blockedUrls.add(raw);
        state.blocked.push(`${request.resourceType()} ${url ? url.host : '?'}${url ? url.pathname.slice(0, 80) : ''}`);
        if (url && (isTile(url) || request.resourceType() === 'image')) {
            await route.fulfill({ status: 200, contentType: 'image/png', body: NEUTRAL_PNG });
            return;
        }
        if (request.resourceType() === 'stylesheet') {
            await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '/* bloqué par le verrou réseau e2e */' });
            return;
        }
        await route.abort('blockedbyclient');
    });
}

export function blockedExternalRequests(context: BrowserContext): readonly string[] {
    return states.get(context)?.blocked ?? [];
}

function wasBlocked(context: BrowserContext, request: Request): boolean {
    return blockedRequests.has(request) || (states.get(context)?.blockedUrls.has(request.url()) ?? false);
}

export interface GuardOptions {
    /** Requêtes dont l'échec est attendu (ex. route d'API volontairement mise en erreur). */
    allowFailures?: readonly RegExp[];
    /** Écran d'état d'erreur simulé : les erreurs de console sont alors attendues. */
    ignoreConsoleErrors?: boolean;
}

/** Erreurs observées sur une page ; `freeze()` arrête la collecte (ex. passage hors ligne volontaire). */
export class PageGuard {
    readonly consoleErrors: string[] = [];
    readonly pageErrors: string[] = [];
    readonly failedRequests: string[] = [];
    private frozen = false;
    private allowFailures: RegExp[] = [];
    private ignoreConsole = false;

    constructor(private readonly page: Page) {
        const context = page.context();
        page.on('console', (msg) => {
            if (this.frozen || this.ignoreConsole || msg.type() !== 'error') return;
            const location = msg.location().url;
            if (location && (states.get(context)?.blockedUrls.has(location) ?? false)) return;
            if (location && this.isAllowedFailure(location)) return;
            this.consoleErrors.push(`${msg.text().slice(0, 300)}${location ? ` (${location.slice(0, 120)})` : ''}`);
        });
        page.on('pageerror', (err) => {
            if (this.frozen) return;
            this.pageErrors.push(`${err.name}: ${err.message.slice(0, 300)}`);
        });
        page.on('requestfailed', (request) => {
            if (this.frozen || wasBlocked(context, request) || this.isAllowedFailure(request.url())) return;
            const errorText = request.failure()?.errorText ?? 'échec';
            // Préchargements RSC interrompus par une navigation : bruit normal du routeur Next.js
            if (errorText === 'net::ERR_ABORTED' && request.url().includes('_rsc=')) return;
            this.failedRequests.push(`${request.method()} ${shortUrl(request.url())} : ${errorText}`);
        });
        page.on('response', (response) => {
            if (this.frozen || response.status() < 400) return;
            const url = response.url();
            let host = '';
            try {
                host = new URL(url).host;
            } catch (err) {
                this.failedRequests.push(`réponse ${response.status()} à une URL illisible (${err instanceof Error ? err.message : String(err)})`);
                return;
            }
            const state = states.get(context);
            if (state && !state.allowedHosts.has(host)) return;
            if (this.isAllowedFailure(url)) return;
            this.failedRequests.push(`${response.status()} ${response.request().method()} ${shortUrl(url)}`);
        });
    }

    configure(options: GuardOptions): void {
        this.allowFailures = [...(options.allowFailures ?? [])];
        this.ignoreConsole = options.ignoreConsoleErrors === true;
    }

    freeze(): void {
        this.frozen = true;
    }

    private isAllowedFailure(url: string): boolean {
        return this.allowFailures.some((re) => re.test(url));
    }

    /** Problèmes bloquants observés depuis l'ouverture de la page. */
    blockingIssues(): string[] {
        return [
            ...this.pageErrors.map((e) => `exception de page : ${e}`),
            ...this.consoleErrors.map((e) => `erreur de console : ${e}`),
            ...this.failedRequests.map((e) => `requête en échec : ${e}`),
        ];
    }

    get pageRef(): Page {
        return this.page;
    }
}

function shortUrl(url: string): string {
    try {
        const u = new URL(url);
        return `${u.host}${u.pathname}${u.search ? u.search.slice(0, 60) : ''}`;
    } catch (err) {
        return `${url.slice(0, 120)} (${err instanceof Error ? err.message : 'URL illisible'})`;
    }
}
