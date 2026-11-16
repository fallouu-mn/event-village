/**
 * Correctifs de la contre-vérification de la finition 2a, T1 — fiche SUSPENDU : l'équipe de ses événements est en lecture
 * seule pour la partenaire, à la route ET en base ; un admin muni de events.write garde ses actions.
 *
 *  a. Base : chaque fonction d'équipe qui n'était pas essayée par cvf2a-1 b (droit d'encaisser, point d'entrée, ajout et
 *     retrait d'affectations, renvoi, annulation et effacement d'une invitation, événements du contrôleur, retrait de
 *     l'équipe), avec la partenaire pour autrice : acceptée quand la fiche est VALIDE (témoin, sur une autre organisatrice),
 *     refusée PARTNER_SUSPENDED quand elle est SUSPENDU, l'équipe inchangée. Les trois de cvf2a-1 b (réglages, porte,
 *     invitation) rendent aussi le code PARTNER_SUSPENDED.
 *  b. Routes : les 12 écritures de l'onglet Équipe (aide de cvf2a) et l'invitation d'un numéro inconnu (compte créé par
 *     l'invitation) : 403 PARTNER_SUSPENDED, texte de la fiche suspendue suivi du contact du support ; aucun compte créé,
 *     aucun SMS, l'équipe inchangée.
 *  c. Admin events.write sur l'équipe d'une fiche SUSPENDU : réglages acceptés en base (motif journalisé).
 * Rouge avant le correctif : fonctions acceptées pour la partenaire suspendue (les trois fonctions nouvelles n'existent pas
 * encore) ; routes de l'équipe acceptées (200, 201). Sortie brute `[F2ACV-T1]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { newController } from './acces-helpers';
import { newAdmin } from './notif-helpers';
import { randomSenegalPhone } from './helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { PARTNER_SUSPENDED_TEXT } from '../../lib/auth/partner-fiche-guard';
import { api, setFiche, show, type Row } from '../audit/cvf1-helpers';
import { makeResendable, mount, teamState, teamWrites, type Mount } from '../audit/cvf2a-helpers';

let W: Mount;   // fiche VALIDE : témoins
let S: Mount;   // fiche SUSPENDU : base
let R: Mount;   // fiche SUSPENDU : routes
let wCtrl2: Buyer;
let sCtrl2: Buyer;
const restore: string[] = [];

before(async () => {
    W = await mount('cv-t1-temoin');
    S = await mount('cv-t1-base');
    R = await mount('cv-t1-routes');
    // Second contrôleur de chaque équipe, pour « Retirer de l'équipe » (le premier sert aux autres essais)
    wCtrl2 = await newController(W.P, W.ev.eventId, { label: 'cv-t1-temoin-2' });
    sCtrl2 = await newController(S.P, S.ev.eventId, { label: 'cv-t1-base-2' });
    await makeResendable(W.invitationId);
    await makeResendable(S.invitationId);
    for (const m of [S, R]) {
        await setFiche(m.P.partnerId, 'SUSPENDU');
        restore.push(m.P.partnerId);
    }
});

after(async () => {
    for (const id of restore) await setFiche(id, 'VALIDE');
    await assertFinition1Invariants('f2acv-equipe-suspendue');
});

async function rpcJson(fn: string, args: Row): Promise<Row> {
    const { data, error } = await service.rpc(fn, args);
    if (error) return { ok: false, code: 'SQL_ERROR', message: `${error.code ?? ''} ${error.message}` };
    return (data ?? {}) as Row;
}

interface Call { fn: string; args: (m: Mount, ctrl2: Buyer) => Row }

/** Ordre des témoins : chaque appel laisse à l'appel suivant ce qu'il lui faut (invitation en attente, puis annulée…). */
const CALLS: Call[] = [
    { fn: 'event_controller_set_cash', args: (m) => ({ p: { assignment_id: m.assignmentId, actor_id: m.P.userId, can_accept_cash: true } }) },
    { fn: 'event_controller_entry_point_set', args: (m) => ({ p: { actor_id: m.P.userId, event_id: m.flat.eventId, controller_id: m.ctrl.userId, entry_point: 'Entrée VIP' } }) },
    { fn: 'event_controllers_add', args: (m) => ({ p: { actor_id: m.P.userId, controller_id: m.ctrl.userId, event_ids: [m.ev.eventId, m.flat.eventId], can_accept_cash: false } }) },
    { fn: 'controller_invitation_resend', args: (m) => ({ p: { actor_id: m.P.userId, invitation_id: m.invitationId, reason: null } }) },
    { fn: 'controller_invitation_cancel', args: (m) => ({ p: { actor_id: m.P.userId, invitation_id: m.invitationId, reason: null } }) },
    { fn: 'controller_invitation_clear', args: (m) => ({ p: { actor_id: m.P.userId, invitation_id: m.invitationId, reason: null } }) },
    {
        fn: 'controller_assignments_sync', args: (m) => ({
            p: { actor_id: m.P.userId, actor_role: 'PARTENAIRE', partner_id: m.P.partnerId, controller_id: m.ctrl.userId, assignments: [{ event_id: m.ev.eventId, can_accept_cash: false }] },
        }),
    },
    { fn: 'event_controllers_remove', args: (m) => ({ p: { actor_id: m.P.userId, event_id: m.ev.eventId, assignment_ids: [m.assignmentId] } }) },
    { fn: 'atomic_partner_remove_controller', args: (m, ctrl2) => ({ p_partner_id: m.P.partnerId, p_controller_id: ctrl2.userId, p_actor_id: m.P.userId }) },
];

describe('a. base : fonctions d’équipe, la partenaire suspendue pour autrice', () => {
    test('chaque fonction : acceptée si la fiche est VALIDE, PARTNER_SUSPENDED si elle est SUSPENDU, équipe inchangée', async () => {
        const breaches: string[] = [];
        for (const c of CALLS) {
            const witness = await rpcJson(c.fn, c.args(W, wCtrl2));
            console.log(`[F2ACV-T1] témoin ${c.fn} (fiche VALIDE) → ${JSON.stringify(witness).slice(0, 200)}`);
            // Précondition relevée sans arrêter l'essai (avant le correctif, les trois fonctions nouvelles n'existent pas)
            if (witness.ok !== true) breaches.push(`précondition : ${c.fn} refusée pour une fiche VALIDE → ${JSON.stringify(witness).slice(0, 200)}`);
            const before = await teamState(S);
            const reply = await rpcJson(c.fn, c.args(S, sCtrl2));
            const after = await teamState(S);
            console.log(`[F2ACV-T1] ${c.fn} (fiche SUSPENDU) → ${JSON.stringify(reply).slice(0, 200)}`);
            if (reply.ok === true || reply.code !== 'PARTNER_SUSPENDED') breaches.push(`${c.fn} → ${JSON.stringify(reply).slice(0, 200)}`);
            else if (after !== before) breaches.push(`${c.fn} : refusée mais l'équipe a changé`);
        }
        assert.deepEqual(breaches, [], `fiche SUSPENDU, fonctions d'équipe non refusées :\n${breaches.join('\n')}`);
    });

    test('réglages, porte, invitation (cvf2a-1 b) : code PARTNER_SUSPENDED et texte de la fiche suspendue', async () => {
        const fresh = await newBuyer('cv-t1-invite-base');
        const replies: Array<[string, Row]> = [
            ['event_controller_settings_set', await rpcJson('event_controller_settings_set', {
                p: { actor_id: S.P.userId, event_id: S.ev.eventId, controller_id: S.ctrl.userId, gate_id: S.gate2, gate_change_allowed: true, entry_point: null, can_accept_cash: true, reason: null },
            })],
            ['event_controller_gate_set', await rpcJson('event_controller_gate_set', {
                p: { actor_id: S.P.userId, event_id: S.ev.eventId, controller_id: S.ctrl.userId, gate_id: S.gate2, gate_change_allowed: true },
            })],
            ['controller_invitation_create', await rpcJson('controller_invitation_create', {
                p: { actor_id: S.P.userId, actor_role: 'PARTENAIRE', partner_id: S.P.partnerId, user_id: fresh.userId, assignments: [{ event_id: S.ev.eventId, can_accept_cash: false }], phone_entered: fresh.phoneE164, reason: null },
            })],
        ];
        for (const [fn, r] of replies) console.log(`[F2ACV-T1] ${fn} (fiche SUSPENDU) → ${JSON.stringify(r).slice(0, 200)}`);
        assert.deepEqual(replies.map(([fn, r]) => [fn, r.code, r.message]),
            replies.map(([fn]) => [fn, 'PARTNER_SUSPENDED', PARTNER_SUSPENDED_TEXT]));
    });
});

describe('b. routes de l’équipe : 403 PARTNER_SUSPENDED, texte et contact du support', () => {
    test('12 écritures de l’onglet Équipe et invitation d’un numéro inconnu : refusées, rien ne change', async () => {
        const before = await teamState(R);
        const attempts = await teamWrites(R, R.P.accessToken);
        const unknownPhone = randomSenegalPhone('77');
        const invite = await api('POST', 'partner/team/invite', {
            token: R.P.accessToken, body: { event_ids: [R.ev.eventId], phone: unknownPhone, first_name: 'Awa', last_name: 'Nouvelle', confirm_promotion: true },
        });
        console.log(`[F2ACV-T1] POST /api/partner/team/invite (numéro inconnu) → ${show(invite).slice(0, 260)}`);
        attempts.push({ what: 'POST /api/partner/team/invite (numéro inconnu)', reply: invite });
        const wrong = attempts.filter((a) => a.reply.status !== 403 || a.reply.body.code !== 'PARTNER_SUSPENDED'
            || typeof a.reply.body.error !== 'string' || !String(a.reply.body.error).startsWith(`${PARTNER_SUSPENDED_TEXT} `))
            .map((a) => `${a.what} → ${show(a.reply).slice(0, 220)}`);
        const { count: created } = await service.from('users').select('id', { count: 'exact', head: true })
            .in('phone', [unknownPhone, unknownPhone.replace(/^\+/, ''), unknownPhone.replace(/^\+221/, '')]);
        console.log(`[F2ACV-T1] compte créé pour le numéro inconnu : ${created ?? 0}`);
        assert.deepEqual(wrong, [], `écritures de l'équipe d'une fiche SUSPENDU sans le refus attendu :\n${wrong.join('\n')}`);
        assert.equal(created ?? 0, 0, 'compte de contrôleur créé pour une fiche SUSPENDU');
        assert.equal(await teamState(R), before, 'équipe changée par une fiche SUSPENDU');
    });
});

describe('c. admin events.write sur l’équipe d’une fiche SUSPENDU', () => {
    test('réglages d’un contrôleur par un admin muni de events.write : acceptés en base, motif journalisé', async () => {
        const admin = await newAdmin('cv-t1-admin', ['events.write']);
        const r = await rpcJson('event_controller_settings_set', {
            p: { actor_id: admin.userId, event_id: S.ev.eventId, controller_id: S.ctrl.userId, gate_id: S.gate1, gate_change_allowed: false, entry_point: null, can_accept_cash: false, reason: 'Contre-vérification de la finition 2a (T1)' },
        });
        console.log(`[F2ACV-T1] admin events.write, fiche SUSPENDU : event_controller_settings_set → ${JSON.stringify(r).slice(0, 200)}`);
        assert.equal(r.ok, true, `admin events.write refusé sur l'équipe d'une fiche SUSPENDU : ${JSON.stringify(r)}`);
    });
});
