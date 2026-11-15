/**
 * Contre-vérification de la finition 1, attaque 6 — invitations de contrôleur.
 *
 *  a. Une invitation annulée, effacée, échue ou refusée ne s'accepte plus : ni par la liste et la route du titulaire, ni
 *     par la fonction appelée avec son jeton ; elle ne se renvoie pas non plus (aucun SMS).
 *  b. « Renvoyer » ne permet pas d'envoyer des SMS en masse : même invitation en parallèle, invitations répétées vers un
 *     même numéro, une autre partenaire qui tente de brûler le quota du numéro, 25 invitations vers 25 numéros renvoyées
 *     en parallèle (plafond par organisatrice et par heure).
 *  c. On n'invite pas le numéro d'un admin (ADMIN, SUPERADMIN) : aucune invitation, aucun SMS, aucun rôle.
 *  d. Usurpation : accepter l'invitation d'un autre (route et fonction), renommer un compte existant par l'invitation,
 *     glisser l'organisatrice ou la société d'une autre dans le corps, annuler à la place de l'organisatrice.
 * Sortie brute `[CVF1-6]`.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, service, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newAdmin, outboxRows } from '../parcours/notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    api, assignmentOf, expireInvitation, freeEvent, invitationRow, invitationsFor, inviteExisting, ok2xx, restRpc, rolesOf,
    show, smsCount, userClient, type Reply, type Row,
} from './cvf1-helpers';

let P: TestPartner;
let B: TestPartner;
let evP: SaleEvent;

before(async () => {
    P = await newPartner('cvf1-inv-p');
    B = await newPartner('cvf1-inv-b');
    evP = await freeEvent(P, 'inv-p', { startsInHours: 48 });
});

after(async () => {
    await assertFinition1Invariants('cvf1-6-invitations');
});

/**
 * Organisatrice neuve et son événement : chaque groupe d'essais a ses propres quotas (INVITE_PER_PARTNER_HOUR compte
 * chaque tentative de l'organisatrice), pour qu'un refus 429 hérité d'un autre essai ne passe jamais pour une défense.
 */
async function freshTeam(label: string): Promise<{ partner: TestPartner; ev: SaleEvent }> {
    const partner = await newPartner(`cvf1-inv-${label}`);
    const ev = await freeEvent(partner, `inv-${label}`, { startsInHours: 48 });
    return { partner, ev };
}

async function action(kind: 'resend' | 'cancel' | 'clear', token: string, id: string, body: Row = {}): Promise<Reply> {
    if (kind === 'clear') return api('DELETE', 'partner/team/invitations/[id]', { token, path: `/api/partner/team/invitations/${id}`, params: { id }, body });
    return api('POST', `partner/team/invitations/[id]/${kind}`, { token, path: `/api/partner/team/invitations/${id}/${kind}`, params: { id }, body });
}

async function respond(holder: Buyer, id: string, accept: boolean): Promise<Reply> {
    return api('POST', 'account/controller-invitations/[id]', { token: holder.accessToken, path: `/api/account/controller-invitations/${id}`, params: { id }, body: { accept } });
}

async function listed(holder: Buyer, id: string): Promise<boolean> {
    const r = await api('GET', 'account/controller-invitations', { token: holder.accessToken });
    return JSON.stringify(r.body).includes(id);
}

/** Le titulaire tente d'accepter `id` par tous les chemins ; rend les brèches (rôle, affectation, acceptation). */
async function tryAccept(holder: Buyer, id: string, tag: string, breaches: string[]): Promise<void> {
    const inList = await listed(holder, id);
    const viaRoute = await respond(holder, id, true);
    const viaRpc = await restRpc(userClient(holder.accessToken), 'controller_invitation_respond', { p: { invitation_id: id, actor_id: holder.userId, accept: true } });
    console.log(`[CVF1-6] ${tag} : dans la liste du titulaire → ${inList} ; acceptation par la route → ${show(viaRoute)} ; par la fonction → ${viaRpc.ok ? `EXÉCUTÉE ${JSON.stringify(viaRpc.data)}` : `refus ${viaRpc.error}`}`);
    if (inList) breaches.push(`${tag} : encore proposée au titulaire`);
    if (ok2xx(viaRoute)) breaches.push(`${tag} : acceptée par la route ${show(viaRoute)}`);
    if (viaRpc.ok) breaches.push(`${tag} : fonction controller_invitation_respond exécutée par le titulaire`);
    if ((await invitationRow(id)).status === 'ACCEPTED') breaches.push(`${tag} : invitation passée à ACCEPTED`);
    if (await assignmentOf(evP.eventId, holder.userId)) breaches.push(`${tag} : titulaire affecté à l'événement`);
    if ((await rolesOf(holder.userId)).includes('CONTROLEUR')) breaches.push(`${tag} : rôle CONTROLEUR donné`);
}

async function tryResend(holder: Buyer, id: string, tag: string, breaches: string[]): Promise<void> {
    const sms = await smsCount('CONTROLLER_INVITATION', holder.userId);
    const r = await action('resend', P.accessToken, id);
    console.log(`[CVF1-6] ${tag} : « Renvoyer » → ${show(r)}`);
    if (ok2xx(r)) breaches.push(`${tag} : renvoyée ${show(r)}`);
    if ((await smsCount('CONTROLLER_INVITATION', holder.userId)) > sms) breaches.push(`${tag} : SMS envoyé`);
}

describe('a. annulée, effacée, échue, refusée : plus acceptable, plus renvoyable', () => {
    test('annulée, puis « Inviter de nouveau » : l’ancien lien ne mène à rien', async () => {
        const breaches: string[] = [];
        const h = await newBuyer('cvf1-inv-annulee', { firstName: 'Annulee', lastName: 'Titulaire' });
        const id = await inviteExisting(P, [evP.eventId], h);
        const c = await action('cancel', P.accessToken, id);
        assert.equal(c.status, 200, `annulation (montage) : ${show(c)}`);
        await tryAccept(h, id, 'annulée', breaches);
        await tryResend(h, id, 'annulée', breaches);
        const again = await inviteExisting(P, [evP.eventId], h);
        const old = await respond(h, id, true);
        console.log(`[CVF1-6] annulée puis réinvitée : acceptation de l'ancien lien → ${show(old)}`);
        if (ok2xx(old)) breaches.push(`ancien lien accepté après la réinvitation ${show(old)}`);
        const row = await invitationRow(again);
        assert.equal(row.status, 'PENDING', 'la nouvelle invitation attend sa réponse');
        assert.deepEqual(breaches, [], breaches.join('\n'));
    });

    test('effacée (annulée puis effacée) : ni acceptée, ni renvoyée', async () => {
        const breaches: string[] = [];
        const h = await newBuyer('cvf1-inv-effacee', { firstName: 'Effacee', lastName: 'Titulaire' });
        const id = await inviteExisting(P, [evP.eventId], h);
        assert.equal((await action('cancel', P.accessToken, id)).status, 200, 'annulation (montage)');
        const cl = await action('clear', P.accessToken, id);
        assert.equal(cl.status, 200, `effacement (montage) : ${show(cl)}`);
        await tryAccept(h, id, 'effacée', breaches);
        await tryResend(h, id, 'effacée', breaches);
        assert.deepEqual(breaches, [], breaches.join('\n'));
    });

    test('échue : ni acceptée, ni renvoyée, ni annulée', async () => {
        const breaches: string[] = [];
        const h = await newBuyer('cvf1-inv-echue', { firstName: 'Echue', lastName: 'Titulaire' });
        const id = await inviteExisting(P, [evP.eventId], h);
        await expireInvitation(id);
        await tryResend(h, id, 'échue', breaches);
        const c = await action('cancel', P.accessToken, id);
        console.log(`[CVF1-6] échue : « Annuler » → ${show(c)}`);
        if (ok2xx(c)) breaches.push(`échue : annulée ${show(c)}`);
        await tryAccept(h, id, 'échue', breaches);
        assert.deepEqual(breaches, [], breaches.join('\n'));
    });

    test('refusée par le titulaire : ni acceptée ensuite, ni renvoyée', async () => {
        const breaches: string[] = [];
        const h = await newBuyer('cvf1-inv-refusee', { firstName: 'Refusee', lastName: 'Titulaire' });
        const id = await inviteExisting(P, [evP.eventId], h);
        const no = await respond(h, id, false);
        assert.equal(no.status, 200, `refus (montage) : ${show(no)}`);
        await tryAccept(h, id, 'refusée', breaches);
        await tryResend(h, id, 'refusée', breaches);
        assert.deepEqual(breaches, [], breaches.join('\n'));
    });
});

describe('b. « Renvoyer » ne permet pas d’envoyer des SMS en masse', () => {
    const perPhone = Number(process.env.INVITE_PER_PHONE_DAY ?? 3);
    const perPartner = Number(process.env.INVITE_PER_PARTNER_HOUR ?? 20);

    test('même invitation, 6 renvois en parallèle : plafond du numéro tenu', async () => {
        const { partner: X, ev } = await freshTeam('rafale');
        const h = await newBuyer('cvf1-inv-rafale', { firstName: 'Rafale', lastName: 'Titulaire' });
        const id = await inviteExisting(X, [ev.eventId], h);
        const replies = await Promise.all(Array.from({ length: 6 }, () => action('resend', X.accessToken, id)));
        const statuses = replies.map((r) => r.status);
        const sent = replies.filter(ok2xx).length;
        const sms = await smsCount('CONTROLLER_INVITATION', h.userId);
        const row = await invitationRow(id);
        console.log(`[CVF1-6] 6 renvois simultanés : ${statuses.join(', ')} ; SMS d'invitation : ${sms} ; send_count ${String(row.send_count)} (plafond ${perPhone} par numéro et par jour)`);
        assert.ok(!statuses.includes(500), `erreur serveur pendant la rafale : ${replies.map(show).join(' | ')}`);
        assert.ok(sms <= perPhone, `${sms} SMS vers le même numéro (plafond ${perPhone})`);
        assert.equal(sms, 1 + sent, `SMS (${sms}) ≠ 1 invitation + ${sent} renvoi(s) acceptés`);
        assert.equal(Number(row.send_count), 1 + sent, 'compteur d’envois de l’invitation');
    });

    test('une autre partenaire tente de brûler le quota du numéro : sans effet', async () => {
        const { partner: X, ev } = await freshTeam('quota');
        const h = await newBuyer('cvf1-inv-quota', { firstName: 'Quota', lastName: 'Titulaire' });
        const id = await inviteExisting(X, [ev.eventId], h);
        const foreign = await Promise.all(Array.from({ length: 5 }, () => action('resend', B.accessToken, id)));
        console.log(`[CVF1-6] 5 renvois de B sur l'invitation d'une autre organisatrice : ${foreign.map((r) => r.status).join(', ')}`);
        assert.ok(foreign.every((r) => r.status === 404), `renvois de B : ${foreign.map(show).join(' | ')}`);
        const mine = await action('resend', X.accessToken, id);
        console.log(`[CVF1-6] renvoi de l'organisatrice ensuite → ${show(mine)}`);
        assert.equal(mine.status, 200, `quota du numéro consommé par B : ${show(mine)}`);
        assert.equal(await smsCount('CONTROLLER_INVITATION', h.userId), 2, 'SMS : invitation + un renvoi');
    });

    test('invitations répétées vers un même numéro (annuler, inviter de nouveau) puis renvoi : plafond partagé', async () => {
        const { partner: X, ev } = await freshTeam('repete');
        const h = await newBuyer('cvf1-inv-repete', { firstName: 'Repete', lastName: 'Titulaire' });
        const statuses: number[] = [];
        let last: string | null = null;
        for (let i = 0; i < perPhone + 2; i += 1) {
            if (last) await action('cancel', X.accessToken, last);
            const r = await api('POST', 'partner/team/invite', { token: X.accessToken, body: { event_ids: [ev.eventId], phone: h.phoneE164, confirm_promotion: true } });
            statuses.push(r.status);
            if (typeof r.body.invitation_id === 'string') last = r.body.invitation_id;
        }
        const resend = last ? await action('resend', X.accessToken, last) : null;
        const sms = await smsCount('CONTROLLER_INVITATION', h.userId);
        console.log(`[CVF1-6] ${perPhone + 2} invitations du même numéro : ${statuses.join(', ')} ; renvoi → ${resend ? show(resend) : 'aucune invitation'} ; SMS : ${sms}`);
        assert.ok(sms <= perPhone, `${sms} SMS vers le même numéro en un jour (plafond ${perPhone})`);
    });

    test('25 invitations vers 25 numéros, renvoyées en parallèle : plafond de l’organisatrice tenu', async () => {
        const P2 = await newPartner('cvf1-inv-masse');
        const ev = await freeEvent(P2, 'inv-masse', { startsInHours: 48 });
        const holders: Buyer[] = [];
        const ids: string[] = [];
        for (let i = 0; i < 25; i += 1) {
            const h = await newBuyer(`cvf1-inv-m${i}`, { firstName: 'Masse', lastName: `Titulaire${i}` });
            holders.push(h);
            const { data, error } = await service.from('controller_invitations').insert({
                partner_id: P2.partnerId, user_id: h.userId, created_by: P2.userId,
                assignments: [{ event_id: ev.eventId, can_accept_cash: false }], phone_entered: h.phoneE164,
            }).select('id').single();
            assert.equal(error, null, `invitation ${i} (montage) : ${error?.message}`);
            ids.push(String(data!.id));
        }
        const replies = await Promise.all(ids.map((id) => action('resend', P2.accessToken, id)));
        const sent = replies.filter(ok2xx).length;
        let sms = 0;
        for (const h of holders) sms += await smsCount('CONTROLLER_INVITATION', h.userId);
        const counts = replies.reduce<Record<number, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
        console.log(`[CVF1-6] 25 renvois simultanés vers 25 numéros : ${JSON.stringify(counts)} ; SMS : ${sms} (plafond ${perPartner} par organisatrice et par heure)`);
        assert.ok(!(500 in counts), `erreur serveur : ${replies.filter((r) => r.status === 500).map(show).join(' | ')}`);
        assert.ok(sms <= perPartner, `${sms} SMS en une heure pour une organisatrice (plafond ${perPartner})`);
        assert.equal(sms, sent, `SMS (${sms}) ≠ renvois acceptés (${sent})`);
    });
});

describe('c. le numéro d’un admin ne s’invite pas', () => {
    test('ADMIN et SUPERADMIN : aucune invitation, aucun SMS, aucun rôle', async () => {
        const breaches: string[] = [];
        const { partner: X, ev } = await freshTeam('admin');
        const admin = await newAdmin('cvf1-inv-admin', ['events.read']);
        const superadmin = await newAdmin('cvf1-inv-super', [], { role: 'SUPERADMIN' });
        for (const [label, target] of [['ADMIN', admin], ['SUPERADMIN', superadmin]] as const) {
            const rolesBefore = await rolesOf(target.userId);
            const ask = await api('POST', 'partner/team/invite', { token: X.accessToken, body: { event_ids: [ev.eventId], phone: target.phoneE164 } });
            const confirm = await api('POST', 'partner/team/invite', { token: X.accessToken, body: { event_ids: [ev.eventId], phone: target.phoneE164, confirm_promotion: true } });
            console.log(`[CVF1-6] numéro d'un ${label} : première étape → ${show(ask)} ; confirmation → ${show(confirm)}`);
            const inv = await invitationsFor(X.partnerId, target.userId);
            const sms = await smsCount('CONTROLLER_INVITATION', target.userId);
            console.log(`[CVF1-6] numéro d'un ${label} : invitations créées ${inv.length} ; SMS ${sms} ; rôles ${rolesBefore.join(',')} → ${(await rolesOf(target.userId)).join(',')}`);
            if (ok2xx(confirm) && (confirm.body.invitation_id || confirm.body.success)) breaches.push(`${label} : invitation acceptée par la route ${show(confirm)}`);
            if (inv.length > 0) breaches.push(`${label} : ${inv.length} invitation(s) créée(s) pour un compte d'administration`);
            if (sms > 0) breaches.push(`${label} : ${sms} SMS d'invitation envoyé(s) à un compte d'administration`);
            if (await assignmentOf(ev.eventId, target.userId)) breaches.push(`${label} : affecté directement à l'événement`);
            if ((await rolesOf(target.userId)).join(',') !== rolesBefore.join(',')) breaches.push(`${label} : rôles modifiés`);
        }
        assert.deepEqual(breaches, [], `le numéro d'un admin s'invite :\n${breaches.join('\n')}`);
    });
});

describe('d. se faire passer pour un autre', () => {
    test('accepter l’invitation d’un autre, ou l’annuler à la place de l’organisatrice : refusé', async () => {
        const breaches: string[] = [];
        const { partner: X, ev } = await freshTeam('usurpation');
        const h = await newBuyer('cvf1-inv-vrai', { firstName: 'Vrai', lastName: 'Titulaire' });
        const id = await inviteExisting(X, [ev.eventId], h);
        const k = await newBuyer('cvf1-inv-intrus', { firstName: 'Intrus', lastName: 'Client' });
        const viaRoute = await respond(k, id, true);
        const viaRpc = await restRpc(userClient(k.accessToken), 'controller_invitation_respond', { p: { invitation_id: id, actor_id: h.userId, accept: true } });
        const cancelByHolder = await action('cancel', h.accessToken, id);
        console.log(`[CVF1-6] un autre compte accepte → ${show(viaRoute)} ; fonction au nom du titulaire → ${viaRpc.ok ? 'EXÉCUTÉE' : `refus ${viaRpc.error}`} ; le titulaire annule à la place de l'organisatrice → ${show(cancelByHolder)}`);
        if (ok2xx(viaRoute)) breaches.push(`invitation acceptée par un autre compte ${show(viaRoute)}`);
        if (viaRpc.ok) breaches.push('fonction de réponse exécutée au nom du titulaire');
        if (ok2xx(cancelByHolder)) breaches.push(`invitation annulée par le titulaire ${show(cancelByHolder)}`);
        if ((await invitationRow(id)).status !== 'PENDING') breaches.push(`invitation passée à ${String((await invitationRow(id)).status)}`);
        if ((await rolesOf(k.userId)).includes('CONTROLEUR') || await assignmentOf(ev.eventId, k.userId)) breaches.push('l’intrus est devenu contrôleur');
        assert.deepEqual(breaches, [], breaches.join('\n'));
    });

    test('l’invitation ne renomme pas un compte existant et ne porte jamais le nom d’une autre organisatrice', async () => {
        const breaches: string[] = [];
        const { partner: X, ev } = await freshTeam('nom');
        const h = await newBuyer('cvf1-inv-nom', { firstName: 'Seynabou', lastName: 'Gueye' });
        const r = await api('POST', 'partner/team/invite', {
            token: X.accessToken,
            body: {
                event_ids: [ev.eventId], phone: h.phoneE164, confirm_promotion: true, first_name: 'Faux', last_name: 'Nom', firstName: 'Faux', lastName: 'Nom',
                partner_id: B.partnerId, partnerId: B.partnerId, company: 'Société de B', actor_id: B.userId, created_by: B.userId,
            },
        });
        console.log(`[CVF1-6] invitation avec nom, organisatrice et société d'une autre dans le corps → ${show(r)}`);
        assert.equal(r.status, 201, `invitation (montage) : ${show(r)}`);
        const { data: u } = await service.from('users').select('first_name, last_name').eq('id', h.userId).single();
        if (u?.first_name !== 'Seynabou' || u?.last_name !== 'Gueye') breaches.push(`compte renommé par l'invitation : ${JSON.stringify(u)}`);
        const inv = await invitationRow(String(r.body.invitation_id));
        if (inv.partner_id !== X.partnerId) breaches.push(`invitation rattachée à ${String(inv.partner_id)} au lieu de l'organisatrice de la session`);
        if (inv.created_by !== X.userId) breaches.push(`invitation créée au nom de ${String(inv.created_by)}`);
        const { data: pa } = await service.from('partners').select('commercial_name, company_name').eq('id', X.partnerId).single();
        const expected = String(pa?.commercial_name || pa?.company_name);
        const rows = await outboxRows({ type: 'CONTROLLER_INVITATION', userId: h.userId, channel: 'SMS' });
        const companies = rows.map((x) => String((x.template_data as Row).company));
        console.log(`[CVF1-6] société dans le SMS : ${companies.join(', ')} (attendu ${expected})`);
        if (companies.some((c) => c !== expected)) breaches.push(`SMS au nom de « ${companies.join(', ')} » au lieu de « ${expected} »`);
        assert.deepEqual(breaches, [], breaches.join('\n'));
    });
});
