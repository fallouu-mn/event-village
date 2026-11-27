/**
 * Lot 12b — service des commandes (`features.orders_enabled`) partagé par les specs du job responsive qui l'ouvrent, sur
 * le modèle exact de e2e/support/tables-service.ts (run 722 : un spec qui remet l'interrupteur à son état d'avant le
 * refermait sous les pas d'un autre spec qui tournait en même temps).
 *
 * Compteur commun dans le dossier de sortie e2e (fichier + verrou par création de dossier, atomique) : le premier spec qui
 * s'inscrit note l'état d'origine et ouvre le service ; le dernier qui se retire remet l'état d'origine.
 * À la fusion avec le lot 12c : son spec (e2e/lot12c.responsive.spec.ts) ouvre et remet l'interrupteur lui-même ; il doit
 * passer par ce compteur (signalé au rapport du lot 12b).
 */
import fs from 'node:fs';
import path from 'node:path';
import { E2E_OUTPUT_DIR } from './demo-ids';
import { serviceClient } from './service';

const KEY = 'features.orders_enabled';
const STATE = path.join(E2E_OUTPUT_DIR, 'service-commandes.json');
const LOCK = `${STATE}.verrou`;
/** Verrou laissé par un processus interrompu : repris au-delà de ce délai. */
const STALE_LOCK_MS = 30_000;

interface SharedState { users: string[]; previous: boolean }

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    fs.mkdirSync(E2E_OUTPUT_DIR, { recursive: true });
    const t0 = Date.now();
    for (;;) {
        try {
            fs.mkdirSync(LOCK);
            break;
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
            if (Date.now() - t0 > STALE_LOCK_MS) fs.rmSync(LOCK, { recursive: true, force: true });
            await new Promise((r) => setTimeout(r, 50));
        }
    }
    try {
        return await fn();
    } finally {
        fs.rmSync(LOCK, { recursive: true, force: true });
    }
}

function readState(): SharedState {
    try {
        const parsed = JSON.parse(fs.readFileSync(STATE, 'utf8')) as Partial<SharedState>;
        return { users: Array.isArray(parsed.users) ? parsed.users.map(String) : [], previous: parsed.previous === true };
    } catch {
        return { users: [], previous: false };
    }
}

async function readSetting(): Promise<boolean> {
    const { data, error } = await serviceClient().from('platform_settings').select('value').eq('key', KEY).maybeSingle();
    if (error) throw new Error(`[service des commandes] réglage illisible : ${error.message}`);
    return (data?.value as { value?: boolean } | null)?.value === true;
}

async function writeSetting(open: boolean, actor: string, who: string): Promise<void> {
    const { data, error } = await serviceClient().rpc('finance_setting_set', { p_key: KEY, p_value: { value: open }, p_actor: actor, p_reason: `Captures ${who}` });
    if (error || (data as { ok?: boolean } | null)?.ok !== true) throw new Error(`[service des commandes] interrupteur (${who}) : ${error?.message ?? JSON.stringify(data)}`);
}

/** Inscrit le spec et ouvre le service (l'état d'origine est noté par le premier inscrit). */
export async function openOrdersService(who: string, actor: string): Promise<void> {
    await withLock(async () => {
        const state = readState();
        if (state.users.length === 0) state.previous = await readSetting();
        if (!state.users.includes(who)) state.users.push(who);
        await writeSetting(true, actor, who);
        fs.writeFileSync(STATE, JSON.stringify(state));
    });
}

/** Retire le spec ; le dernier inscrit remet l'état d'origine. */
export async function releaseOrdersService(who: string, actor: string): Promise<void> {
    await withLock(async () => {
        const state = readState();
        state.users = state.users.filter((u) => u !== who);
        if (state.users.length > 0) {
            fs.writeFileSync(STATE, JSON.stringify(state));
            return;
        }
        await writeSetting(state.previous, actor, who);
        fs.rmSync(STATE, { force: true });
    });
}
