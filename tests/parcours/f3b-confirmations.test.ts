/**
 * Finition 3b, point 5 (E-32) — confirmations de l'administration qui disent vrai.
 *
 *  1. Registre : chaque avis annoncé par une confirmation (lib/admin/confirmations.ts) a exactement les canaux du registre
 *     des avis (lib/notifications/catalog.ts), reprend le motif seulement si son gabarit le reprend, et n'est soumis à la
 *     préférence « actualités des événements » que si le registre le dit.
 *  2. Base : chaque transition d'un événement par l'administration (suspendre, réactiver, terminer, clore un suspendu),
 *     rejouée dans une transaction annulée, ne met en file que des avis annoncés, sur des canaux annoncés ; l'avis au
 *     partenaire est bien là. Un avis mis en file qui n'est pas annoncé est un mensonge par omission : il est nommé.
 *  3. Écrans : chaque confirmation citée par la consigne lit sa phrase « Prévenu(s) : … » de ce module ; « Marquer versé »
 *     dit « Un SMS part tout de suite à … : ne le faites qu'après avoir vérifié le versement » ; les phrases fausses
 *     d'avant ont disparu (« prévenu avec votre motif » pour une réactivation, détenteurs prévenus par SMS…).
 * Rouge avant la finition (module absent, anciennes phrases). Fin de suite : assertFinition3bInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';
import { assertFinition3bInvariants } from '../helpers/finition3b-invariants';
import { importModule } from './paiement-helpers';

type Notice = { who: string; type: string; channels: string[]; withReason: boolean; optIn?: boolean };
type Module = { CONFIRMATION_NOTICES: Record<string, Notice[]>; noticesText: (k: string) => string };

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

after(async () => {
    await assertFinition3bInvariants('f3b-confirmations');
});

async function mod(): Promise<Module> {
    return (await importModule('../../lib/admin/confirmations')) as Module;
}

/** Bloc `TYPE: define('TYPE', { … })` du registre. */
function catalogBlock(type: string): string | null {
    const src = read('lib/notifications/catalog.ts');
    const m = new RegExp(`\\n    ${type}: define\\('${type}', \\{([\\s\\S]*?)\\n    \\}\\),`).exec(src);
    return m ? m[1] : null;
}

describe('1. chaque avis annoncé correspond au registre des avis', () => {
    test('canaux, motif et préférence identiques au registre', async () => {
        const { CONFIRMATION_NOTICES } = await mod();
        const faults: string[] = [];
        for (const [key, list] of Object.entries(CONFIRMATION_NOTICES)) {
            for (const n of list) {
                const block = catalogBlock(n.type);
                if (!block) { faults.push(`${key} : avis ${n.type} absent du registre`); continue; }
                const channels = /channels: \[([^\]]*)\]/.exec(block)?.[1].split(',').map((c) => c.trim().replace(/'/g, '')).filter(Boolean).sort() ?? [];
                if (JSON.stringify(channels) !== JSON.stringify([...n.channels].sort())) faults.push(`${key} / ${n.type} : canaux ${n.channels} ≠ registre ${channels}`);
                const usesReason = /\breason\b/.test(block);
                if (usesReason !== n.withReason) faults.push(`${key} / ${n.type} : motif annoncé ${n.withReason}, gabarit ${usesReason}`);
                const optIn = /topic: 'EVENT_UPDATES'/.test(block);
                if (optIn !== Boolean(n.optIn)) faults.push(`${key} / ${n.type} : préférence annoncée ${Boolean(n.optIn)}, registre ${optIn}`);
            }
        }
        assert.deepEqual(faults, [], faults.join('\n'));
    });

    test('phrases : un avis sans SMS le dit, un avis sans motif le dit', async () => {
        const { noticesText } = await mod();
        const suspend = noticesText('event_suspend');
        assert.match(suspend, /^Prévenus : /);
        assert.match(suspend, /les détenteurs de billets par notification et email \(si une adresse vérifiée\), sans SMS, sans votre motif/);
        assert.match(noticesText('account_reactivate'), /sans votre motif/);
        assert.match(noticesText('partner_reactivate'), /sans votre motif/);
        assert.match(noticesText('event_close'), /les détenteurs de billets par SMS/);
    });
});

describe('2. base : une transition par l’administration ne met en file que des avis annoncés', () => {
    const CASES: Array<[string, string, string]> = [
        ['event_suspend', 'PUBLIE', 'SUSPENDU'],
        ['event_reactivate', 'SUSPENDU', 'PUBLIE'],
        ['event_finish', 'PUBLIE', 'TERMINE'],
        ['event_close', 'SUSPENDU', 'TERMINE'],
    ];
    for (const [key, from, to] of CASES) {
        test(`${key} (${from} → ${to}) : avis mis en file ⊆ avis annoncés ; avis au partenaire présent`, async () => {
            const { CONFIRMATION_NOTICES } = await mod();
            const declared = CONFIRMATION_NOTICES[key];
            const queued = await inRolledBackTransaction(async (c) => {
                // Événement d'un partenaire au compte actif, sans caisse ouverte (sinon SHIFT_OPEN_AT_END remplace EVENT_FINISHED),
                // de préférence avec des détenteurs de billets et des contrôleurs affectés.
                const { rows: ev } = await c.query<{ id: string }>(`
                    SELECT e.id FROM public.events e
                      JOIN public.partners pa ON pa.id = e.partner_id JOIN public.users u ON u.id = pa.user_id
                     WHERE u.status::text = 'ACTIF'
                       AND NOT EXISTS (SELECT 1 FROM public.controller_shifts s WHERE s.event_id = e.id AND s.status = 'OUVERT')
                       -- un avis à clé par événement (EVENT_FINISHED:<événement>) déjà envoyé ne repart pas (clé d'idempotence)
                       AND NOT EXISTS (SELECT 1 FROM public.notification_outbox o WHERE o.idempotency_key LIKE $1 || ':' || e.id::text || '%')
                     ORDER BY (EXISTS (SELECT 1 FROM public.tickets t WHERE t.event_id = e.id AND t.user_id IS NOT NULL AND t.status::text IN ('VALIDE', 'UTILISE'))) DESC,
                              (EXISTS (SELECT 1 FROM public.event_controllers ec WHERE ec.event_id = e.id)) DESC, e.created_at
                     LIMIT 1`, [declared[0].type]);
                assert.ok(ev[0], 'aucun événement d’un partenaire actif');
                const { rows: h } = await c.query<{ id: string }>(`
                    INSERT INTO public.event_status_history (event_id, old_status, new_status, actor_role, reason, channel)
                    VALUES ($1, $2::event_status, $3::event_status, 'ADMIN', 'Motif de l’essai de la finition 3b', 'TRANSITION') RETURNING id`, [ev[0].id, from, to]);
                assert.ok(h[0], 'ligne d’historique non créée');
                // Avis créés par cette transaction (même now() : created_at par défaut), quelle que soit la forme de leur clé
                const { rows } = await c.query<{ type: string; channel: string }>(
                    `SELECT DISTINCT type, channel FROM public.notification_outbox WHERE created_at = now() ORDER BY 1, 2`);
                return rows;
            });
            const faults: string[] = [];
            for (const q of queued) {
                const n = declared.find((d) => d.type === q.type);
                if (!n) faults.push(`avis mis en file non annoncé : ${q.type} (${q.channel})`);
                else if (!n.channels.includes(q.channel)) faults.push(`${q.type} : canal ${q.channel} non annoncé`);
            }
            assert.deepEqual(faults, [], faults.join('\n'));
            assert.ok(queued.some((q) => q.type === declared[0].type), `avis au partenaire absent : ${JSON.stringify(queued)}`);
        });
    }
});

describe('3. écrans : chaque confirmation dit qui est prévenu, et seulement ce qui se passe', () => {
    test('les confirmations de la consigne lisent leur phrase du module', () => {
        const uses: Array<[string, string[]]> = [
            ['app/admin/events/[id]/page.tsx', ['event_suspend', 'event_reactivate', 'event_finish', 'event_close']],
            ['components/admin/RefundsToRetry.tsx', ['cashout_mark_paid_refund', 'cashout_mark_paid_withdrawal']],
            ['components/admin/PartnerStatusDialog.tsx', ['partner_suspend', 'partner_reactivate']],
            ['app/admin/dashboard/page.tsx', ['partner_validate', 'partner_reject']],
            ['app/admin/users/page.tsx', ['account_suspend', 'account_reactivate']],
        ];
        const faults: string[] = [];
        for (const [file, keys] of uses) {
            const src = read(file);
            for (const k of keys) if (!src.includes(`noticesText('${k}')`)) faults.push(`${file} : noticesText('${k}') absent`);
        }
        assert.deepEqual(faults, [], faults.join('\n'));
    });

    test('« Marquer versé » prévient qu’un SMS part tout de suite ; « Clore l’événement ? » pour un suspendu', () => {
        assert.match(read('components/admin/RefundsToRetry.tsx'), /Un SMS part tout de suite à \$\{[^}]+\} : ne le faites qu’après avoir vérifié le versement\./);
        const sheet = read('app/admin/events/[id]/page.tsx');
        assert.match(sheet, /title: 'Clore l’événement \?'/, 'clôture d’un suspendu titrée « Terminer »');
        assert.match(sheet, /Les détenteurs de billets ne sont pas prévenus\./, '« Terminer » ne dit pas que les détenteurs ne sont pas prévenus');
    });

    test('les phrases fausses d’avant ont disparu', () => {
        const all = ['app/admin/events/[id]/page.tsx', 'components/admin/PartnerStatusDialog.tsx', 'app/admin/users/page.tsx'].map(read).join('\n');
        for (const old of ['L’organisateur et les détenteurs de billets sont prévenus', 'Il est prévenu avec votre motif', 'Ce motif est communiqué au partenaire']) {
            assert.ok(!all.includes(old), `phrase fausse encore à l’écran : « ${old} »`);
        }
    });
});
