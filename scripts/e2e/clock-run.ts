/**
 * Lot 6 (contrat Y, tâche 6.12) — repli de l'horloge simulée de la fumée prolongée (e2e/support/clock.ts),
 * utilisé seulement si l'import des modules du dépôt échoue dans le processus Playwright :
 *
 *   node --import tsx scripts/e2e/clock-run.ts schedule --now <ISO> --event <id> [--event <id>…]
 *   node --import tsx scripts/e2e/clock-run.ts dispatch --now <ISO> --event <id> [--event <id>…]
 *   node --import tsx scripts/e2e/clock-run.ts render-sms --type <TYPE> --data <JSON>
 *
 * `.env.e2e` est chargé (sans écraser le shell) et ses URL vérifiées locales (e2e/support/env.ts) ;
 * EV_INTEGRATIONS est refusé : les vrais adaptateurs visent les faux services. La dernière ligne de la
 * sortie standard est le rapport JSON (scheduleReminders, dispatchNotifications, ou { text } du SMS rendu
 * par le catalogue).
 */
import { e2eConfig } from '../../e2e/support/env';

function usage(message: string): never {
    process.stderr.write(
        `[clock-run] ${message}\nUsage : clock-run.ts schedule|dispatch --now <ISO 8601> --event <uuid> [--event <uuid>…]\n`
        + '        clock-run.ts render-sms --type <TYPE> --data <JSON>\n',
    );
    process.exit(2);
}

interface Options { now: Date | null; events: string[]; type: string | null; data: Record<string, unknown> | null }

function parse(rest: string[]): Options {
    const out: Options = { now: null, events: [], type: null, data: null };
    for (let i = 0; i < rest.length; i += 2) {
        const flag = rest[i];
        const value = rest[i + 1];
        if (value === undefined) usage(`valeur manquante après ${flag}`);
        if (flag === '--now') {
            const now = new Date(value);
            if (Number.isNaN(now.getTime())) usage(`horloge illisible : ${value}`);
            out.now = now;
        } else if (flag === '--event') {
            if (!/^[0-9a-f-]{36}$/i.test(value)) usage(`identifiant d'événement invalide : ${value}`);
            out.events.push(value);
        } else if (flag === '--type') {
            if (!/^[A-Z][A-Z0-9_]*$/.test(value)) usage(`type de notification invalide : ${value}`);
            out.type = value;
        } else if (flag === '--data') {
            let parsed: unknown;
            try {
                parsed = JSON.parse(value);
            } catch (err) {
                usage(`--data illisible : ${err instanceof Error ? err.message : String(err)}`);
            }
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) usage('--data : objet JSON attendu');
            out.data = parsed as Record<string, unknown>;
        } else {
            usage(`option inconnue : ${flag}`);
        }
    }
    return out;
}

async function main(): Promise<void> {
    const [command, ...rest] = process.argv.slice(2);
    if (command !== 'schedule' && command !== 'dispatch' && command !== 'render-sms') usage(`commande inconnue : ${command ?? '(aucune)'}`);
    const opts = parse(rest);

    e2eConfig();
    if (process.env.EV_INTEGRATIONS) usage('EV_INTEGRATIONS est défini : la fumée utilise les vrais adaptateurs pointés sur les faux services.');

    if (command === 'render-sms') {
        if (!opts.type || !opts.data) usage('render-sms : --type et --data obligatoires');
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) usage('NEXT_PUBLIC_APP_URL absente de .env.e2e');
        const { renderNotification } = await import('../../lib/notifications/catalog');
        const rendered = renderNotification(opts.type, 'SMS', opts.data, { appUrl: appUrl.replace(/\/+$/, '') });
        if (rendered.channel !== 'SMS') usage(`rendu ${opts.type} : canal ${rendered.channel} au lieu de SMS`);
        process.stdout.write(`${JSON.stringify({ text: rendered.text })}\n`);
        return;
    }
    if (!opts.now) usage('--now obligatoire (aucune horloge par défaut)');
    if (opts.events.length === 0) usage('au moins un --event (jamais de passage global)');
    if (command === 'schedule') {
        const { scheduleReminders } = await import('../../lib/notifications/reminders');
        const report = await scheduleReminders({ now: opts.now, onlyEventIds: opts.events });
        process.stdout.write(`${JSON.stringify(report)}\n`);
        return;
    }
    const { dispatchNotifications } = await import('../../lib/notifications/dispatcher');
    const report = await dispatchNotifications({ now: opts.now, onlyEventIds: opts.events });
    process.stdout.write(`${JSON.stringify(report)}\n`);
}

main().catch((err: unknown) => {
    process.stderr.write(`[clock-run] ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
});
