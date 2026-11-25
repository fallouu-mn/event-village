/**
 * Finition 4 — recopies : chaque fonction recopiée par les migrations 20261125… part de sa DERNIÈRE définition dans main
 * (10a et 11a comprises : dernière définition d'un fichier antérieur à 20261125000001), et n'en perd aucune ligne.
 *
 *  1. (sans base) chaque ligne de la dernière version de main (commentaires et blancs retirés, espaces réduits) est dans la
 *     recopie, sauf les lignes listées ci-dessous une à une avec ce qui les remplace (lignes qui doivent être dans la
 *     recopie) ou [] quand la ligne disparaît exprès (raison en commentaire). Une ligne de main perdue sans être listée,
 *     ou une remplaçante absente, rend le test rouge. Si une autre branche (design 1c, lot 10b) redéfinit une de ces
 *     fonctions avant la fusion, sa version devient « la dernière de main » et toute ligne qu'elle ajoute est exigée ici ;
 *  2. (base locale de la CI) le corps en base (pg_proc.prosrc) est celui de la recopie : la dernière migration a gagné.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from '../audit/cv11a-helpers';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const FIRST_F4 = '20261125000001';

/** Lignes de main remplacées (→ lignes exigées dans la recopie) ou retirées exprès (→ []). */
const REPLACED: Record<string, Record<string, string[]>> = {
    notification_outbox_claim: {
        // la politique de nuit du type est lue avec la ligne
        'o.template_data, o.attempts, o.max_attempts, o.due_at, t.suspended_policy': ['o.template_data, o.attempts, o.max_attempts, o.due_at, t.suspended_policy,', 't.night_policy'],
        // nuit : le SMS facultatif n'est plus « non envoyé » (QUIET_HOURS) ; il est reporté (bloc NIGHT, avant le SMS)
        "ELSIF r.family = 'OPTIONAL' THEN": ["ELSIF r.family = 'OPTIONAL'"],
        'IF v_qs IS NULL OR v_qe IS NULL THEN': ['IF v_qs IS NOT NULL AND v_qe IS NOT NULL THEN'],
        // règle du 20/11 (migration …06) : événement proche d'abord, report de nuit ensuite
        'IF v_in_quiet THEN': ['IF v_in_quiet AND public.notif_event_soon(r.event_id, r.template_data, v_now) THEN', 'ELSIF v_in_quiet THEN'],
        "v_outcome := 'SKIP'; v_reason := 'QUIET_HOURS';": ["v_outcome := 'DEFER'; v_reason := 'NIGHT';"],
        // cas ADMIN_NIGHT du correctif main-414 : remplacé par le report général (ADMIN_REVIEW_SMS est DEFER au registre)
        "IF v_outcome = 'SEND' AND r.type = 'ADMIN_REVIEW_SMS' AND public.notif_admin_review_due(v_now) > v_now THEN":
            ["IF v_outcome = 'SEND' AND r.channel IN ('SMS', 'PUSH') AND r.night_policy = 'DEFER' THEN"],
        "v_outcome := 'DEFER'; v_reason := 'ADMIN_NIGHT';": ["v_outcome := 'DEFER'; v_reason := 'NIGHT';"],
        "v_quiet := jsonb_build_object('night', true, 'until', public.notif_admin_review_due(v_now),":
            ["v_quiet := v_quiet || jsonb_build_object('until', public.notif_quiet_end_at(v_now, v_qs, v_qe));"],
        "'hour', extract(hour FROM (v_now AT TIME ZONE 'Africa/Dakar'))::integer);": [],
        'SET due_at = public.notif_admin_review_due(v_now), next_attempt_at = public.notif_admin_review_due(v_now),':
            ["SET due_at = (v_quiet->>'until')::timestamptz, next_attempt_at = (v_quiet->>'until')::timestamptz,"],
    },
    notification_reminders_schedule: {
        // prévision : les rappels de la nuit sont reportés, plus perdus → comptés
        "v_fc_j1 := v_j1_on AND v_j1_sms <> 'NEVER'": ["v_fc_j1 := v_j1_on AND v_j1_sms <> 'NEVER';"],
        'AND (v_qs IS NULL OR v_qe IS NULL': [],
        "OR NOT public.notif_in_quiet_hours((v_tomorrow + make_time(v_j1_hour, 0, 0)) AT TIME ZONE 'Africa/Dakar', v_qs, v_qe));": [],
        'v_fc_ctrl := v_qs IS NULL OR v_qe IS NULL': ['v_fc_ctrl := true;'],
        "OR NOT public.notif_in_quiet_hours((v_tomorrow + time '18:00') AT TIME ZONE 'Africa/Dakar', v_qs, v_qe);": [],
        "AND ((((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar') - make_interval(hours => v_h3_hours))":
            ["AND (public.notif_quiet_end_at(((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar') - make_interval(hours => v_h3_hours),"],
        "AT TIME ZONE 'Africa/Dakar')::date = v_tomorrow": ["v_qs, v_qe) AT TIME ZONE 'Africa/Dakar')::date = v_tomorrow"],
        "OR NOT public.notif_in_quiet_hours(((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar')":
            ["v_qs, v_qe) < ((ev.start_date + ev.start_time) AT TIME ZONE 'Africa/Dakar') - interval '30 minutes'"],
        '- make_interval(hours => v_h3_hours), v_qs, v_qe))': [],
    },
    notification_preferences_get: {
        "FROM (VALUES ('REMINDERS', 1), ('EVENT_UPDATES', 2), ('PRO_ACTIVITY', 3)) AS t(topic, ord);":
            ["FROM (VALUES ('REMINDERS', 1), ('EVENT_UPDATES', 2), ('AFTER_EVENT', 3), ('PRO_ACTIVITY', 4), ('SALES_SUMMARY', 5)) AS t(topic, ord);"],
    },
    notification_preference_set: {
        "IF v_topic IS NULL OR v_topic NOT IN ('REMINDERS', 'EVENT_UPDATES', 'PRO_ACTIVITY')":
            ["IF v_topic IS NULL OR v_topic NOT IN ('REMINDERS', 'EVENT_UPDATES', 'PRO_ACTIVITY', 'SALES_SUMMARY', 'AFTER_EVENT')"],
        "'message', 'Préférence inconnue : seuls les rappels, les changements d''un événement et l''activité des ventes se règlent, canal par canal.');":
            ["'message', 'Préférence inconnue : seuls les rappels, les changements d''un événement, les messages après l''événement, l''activité des ventes et le résumé du matin se règlent, canal par canal.');"],
    },
    payment_confirm: {
        // NEW_ORDER par paiement → cloche et SMS groupés (notif_sale_recorded)
        "'type', 'NEW_ORDER', 'key', 'NEW_ORDER:' || p_payment_id::text,": ['PERFORM public.notif_sale_recorded(jsonb_build_object('],
        "'user_id', v_owner, 'event_id', v_event,": ["'owner_id', v_owner, 'event_id', v_event,"],
        "'data', v_data || jsonb_build_object(": [],
        "'total', COALESCE(v_pay.facial_amount, v_pay.amount - COALESCE(v_pay.service_fee, 0)))));":
            ["'total', COALESCE(v_pay.facial_amount, v_pay.amount - COALESCE(v_pay.service_fee, 0))));"],
    },
    notif_ticket_categories_sold_out: {
        // « complet » fusionné : EVENT_SOLD_OUT nomme la dernière catégorie
        "'user_id', v_owner, 'event_id', NEW.event_id, 'data', v_data));": ["'data', v_data || jsonb_build_object('category_id', NEW.id, 'category', NEW.name)));"],
    },
    notification_daily_checks: {},
    notif_cashouts_notify: {
        // REFUND_REQUESTED : l'auteur est lu pour tout remboursement de billet ; le compte reste exigé pour l'avis
        "IF TG_OP = 'INSERT' AND NEW.kind = 'TICKET_REFUND' AND v_user IS NOT NULL THEN": ["IF TG_OP = 'INSERT' AND NEW.kind = 'TICKET_REFUND' THEN", 'IF v_user IS NOT NULL THEN'],
        "'data', v_event_data || jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount)":
            ["'data', v_event_data || jsonb_strip_nulls(jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount,"],
        // retrait constaté non versé (not_paid) transmis aux administrateurs
        "'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount)": ["'data', jsonb_build_object('cashout_id', NEW.id, 'amount', NEW.amount, 'not_paid', v_not_paid)"],
    },
    notif_tickets_scanned: {},
    scan_refusal_alert: {
        // SMS au plus un par porte et par 15 minutes : canaux choisis à la mise en file
        "'window_minutes', s.minutes, 'threshold', s.threshold)));": ["'window_minutes', s.minutes, 'threshold', s.threshold),"],
    },
    notif_partners_notify: {},
    // contre-vérification (T1, migration …06) : seulement des lignes ajoutées (annulation des avis d'état, garde des statuts)
    notif_cancel_on_status: {},
};

/** Corps de chaque définition `CREATE OR REPLACE FUNCTION public.<name>(` des migrations, dans l'ordre des fichiers. */
function definitions(name: string): Array<{ file: string; body: string }> {
    const out: Array<{ file: string; body: string }> = [];
    const head = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\s*\\(`, 'g');
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
        const text = readFileSync(join(MIGRATIONS, file), 'utf8');
        for (const m of text.matchAll(head)) {
            const as = text.indexOf('AS $', m.index!);
            const tag = text.slice(as + 3, text.indexOf('$', as + 4) + 1);
            const start = as + 3 + tag.length;
            out.push({ file, body: text.slice(start, text.indexOf(tag, start)) });
        }
    }
    return out;
}

function lines(body: string): string[] {
    return body.split(/\r?\n/).map((l) => l.replace(/--.*$/, '').trim().replace(/\s+/g, ' ')).filter(Boolean);
}

function versions(name: string): { main: { file: string; body: string }; f4: { file: string; body: string } } {
    const defs = definitions(name);
    const main = defs.filter((d) => d.file < FIRST_F4).at(-1);
    const f4 = defs.filter((d) => d.file >= FIRST_F4).at(-1);
    assert.ok(main, `${name} : aucune définition dans main`);
    assert.ok(f4, `${name} : pas recopiée par la finition 4`);
    return { main: main!, f4: f4! };
}

describe('1. recopies de la finition 4 : tout le code de la dernière version de main', () => {
    for (const name of Object.keys(REPLACED)) {
        test(`${name} : aucune ligne de main perdue sans être listée`, () => {
            const { main, f4 } = versions(name);
            const mine = new Set(lines(f4.body));
            const replaced = REPLACED[name];
            const lost: string[] = [];
            const missing: string[] = [];
            for (const l of lines(main.body)) {
                if (mine.has(l)) continue;
                if (!(l in replaced)) lost.push(l);
                else for (const r of replaced[l]) if (!mine.has(r)) missing.push(`${l} → ${r}`);
            }
            const stale = Object.keys(replaced).filter((l) => mine.has(l) || !lines(main.body).includes(l));
            assert.deepEqual(lost, [], `${name} : lignes de ${main.file} perdues dans ${f4.file}`);
            assert.deepEqual(missing, [], `${name} : remplaçantes absentes de ${f4.file}`);
            assert.deepEqual(stale, [], `${name} : lignes listées comme remplacées qui ne sont pas (ou plus) dans main, ou encore présentes`);
        });
    }
});

/** Lignes d'une recopie de la branche remplacées par la recopie suivante de la branche (→ lignes exigées). */
const REPLACED_IN_F4: Record<string, Record<string, string[]>> = {
    notification_outbox_claim: {
        'IF v_in_quiet THEN': ['IF v_in_quiet AND public.notif_event_soon(r.event_id, r.template_data, v_now) THEN', 'ELSIF v_in_quiet THEN'],
    },
    // Carte B3 (contre-vérification, T2 ; décision du client du 25/11 ; modification signalée au rapport du lot Carte B3) :
    // la recopie de 20261210000001 nomme l'organisatrice par son nom commercial, jamais par sa raison sociale
    notif_tickets_scanned: {
        "SELECT COALESCE(NULLIF(btrim(pa.company_name), ''), 'l''organisateur'), public.event_start_at(e.id), public.event_end_at(e.id)":
            ["SELECT COALESCE(NULLIF(btrim(pa.commercial_name), ''), 'Partenaire Event Village'), public.event_start_at(e.id), public.event_end_at(e.id)"],
    },
};

describe('1 bis. recopies successives de la branche : la dernière garde tout de la précédente', () => {
    for (const name of Object.keys(REPLACED)) {
        const f4defs = definitions(name).filter((d) => d.file >= FIRST_F4);
        if (f4defs.length < 2) continue;
        test(`${name} : ${f4defs.at(-2)!.file} → ${f4defs.at(-1)!.file}`, () => {
            const prev = f4defs.at(-2)!;
            const last = new Set(lines(f4defs.at(-1)!.body));
            const replaced = REPLACED_IN_F4[name] ?? {};
            const lost = lines(prev.body).filter((l) => !last.has(l) && !(l in replaced));
            const missing = Object.entries(replaced).flatMap(([l, rs]) => rs.filter((r) => !last.has(r)).map((r) => `${l} → ${r}`));
            assert.deepEqual(lost, [], `${name} : lignes de ${prev.file} perdues`);
            assert.deepEqual(missing, [], `${name} : remplaçantes absentes`);
        });
    }
});

describe('2. base : le corps en base est celui de la recopie', () => {
    for (const name of Object.keys(REPLACED)) {
        test(name, async () => {
            const { f4 } = versions(name);
            const rows = await sql<{ src: string }>(`SELECT string_agg(prosrc, E'\\n') AS src FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = $1`, [name]);
            const live = new Set(lines(String(rows[0]?.src ?? '')));
            const notApplied = lines(f4.body).filter((l) => !live.has(l));
            assert.deepEqual(notApplied, [], `${name} : le corps en base n'est pas celui de ${f4.file}`);
        });
    }
});
