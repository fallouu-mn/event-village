/**
 * Lot 9 bis, tâche 15 (R6, R55 ; contrat 5.15, B37, B38, 4.2) — fiche partenaire de l'admin.
 *  - partner_status_set suit une table fermée : EN_ATTENTE → VALIDE ; EN_ATTENTE → REJETE (motif) ; VALIDE → SUSPENDU
 *    (motif) ; SUSPENDU → VALIDE (motif désormais obligatoire). Tout le reste : TRANSITION_NOT_ALLOWED (VALIDE → REJETE :
 *    « Seul un dossier en attente peut être refusé. Pour un partenaire validé, utilisez la suspension. »), sans effet ;
 *  - PATCH /api/admin/partners/[id]/status : mêmes refus en HTTP (409, 400 REASON_REQUIRED) ;
 *  - PATCH /api/admin/users {status} sur un compte partenaire → 409 PARTNER_STATUS_VIA_PARTNER_SHEET « Ce compte est celui
 *    d’un partenaire : suspendez-le ou réactivez-le depuis sa fiche partenaire, avec un motif. », aucune écriture ;
 *  - statique : la fiche (modale Dossier de /admin/dashboard et PartnerStatusDialog) propose « Suspendre » et
 *    « Réactiver » vers …/status avec `reason`, « Valider » et « Refuser » seulement pour EN_ATTENTE, lien profond
 *    `dossier=` ; /admin/users renvoie une partenaire vers sa fiche (« Voir la fiche partenaire »).
 *
 * Rouge avant correctif (fix(9b.15-SA), fix(9b.15), écrans E-B) : partner_status_set accepte toute transition vers un
 * statut différent (M/20261103000006:728-731) et réactive sans motif (:732) ; PATCH /api/admin/users écrit users.status
 * d'une partenaire (route.ts:321) ; la modale n'a ni Suspendre ni Réactiver et montre Valider et Refuser hors EN_ATTENTE
 * (app/admin/dashboard/page.tsx:361-369, :615-624).
 * Verts dès l'écriture (témoins, signalés) : les quatre transitions admises. Garde-fou : les refus du même fichier.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { service } from './paiement-helpers';
import { jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import type { RouteResult } from './acces-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';

after(async () => {
    await assertLot9bisInvariants('fiche-partenaire-9bis');
});

type Row = Record<string, unknown>;

const REASON = 'Test lot 9 bis : fiche partenaire';
const ONLY_PENDING = 'Seul un dossier en attente peut être refusé. Pour un partenaire validé, utilisez la suspension.';
const VIA_SHEET = 'Ce compte est celui d’un partenaire : suspendez-le ou réactivez-le depuis sa fiche partenaire, avec un motif.';

function sameQuotes(v: unknown): string {
    return String(v ?? '').replace(/’/g, '\'');
}

async function statusSet(partner: TestPartner, status: string, reason?: string): Promise<Row> {
    const p: Row = { partner_id: partner.partnerId, actor_id: await superadminId(), status };
    if (reason !== undefined) p.reason = reason;
    const { data, error } = await service.rpc('partner_status_set', { p });
    assert.equal(error, null, `partner_status_set ${status} : ${error?.message}`);
    return data as Row;
}

async function partnerState(partner: TestPartner): Promise<{ partner: string; user: string }> {
    const { data: p, error } = await service.from('partners').select('status').eq('id', partner.partnerId).single();
    assert.equal(error, null, error?.message);
    const { data: u, error: uErr } = await service.from('users').select('status').eq('id', partner.userId).single();
    assert.equal(uErr, null, uErr?.message);
    return { partner: String(p.status), user: String(u.status) };
}

/** Dossier remis EN_ATTENTE en base (préparation de test, comme partenaire-lot7:234). */
async function pending(label: string): Promise<TestPartner> {
    const p = await newPartner(label);
    const { error } = await service.from('partners').update({ status: 'EN_ATTENTE', is_verified: false }).eq('id', p.partnerId);
    assert.equal(error, null, `dossier EN_ATTENTE : ${error?.message}`);
    return p;
}

function assertRefused(out: Row, code: string, what: string): void {
    assert.equal(out.ok, false, `R55 : ${what} doit être refusé : ${JSON.stringify(out)}`);
    assert.equal(out.code, code, `${what} : code ${code} attendu : ${JSON.stringify(out)}`);
}

describe('R55 — partner_status_set : table fermée des transitions', () => {
    test('VALIDE → REJETE refusé (TRANSITION_NOT_ALLOWED, texte du contrat), statut inchangé', async () => {
        const p = await newPartner('r55-valide-refus');
        const out = await statusSet(p, 'REJETE', REASON);
        assertRefused(out, 'TRANSITION_NOT_ALLOWED', 'VALIDE → REJETE');
        assert.equal(sameQuotes(out.message), sameQuotes(ONLY_PENDING), `texte du refus : ${JSON.stringify(out)}`);
        assert.deepEqual(await partnerState(p), { partner: 'VALIDE', user: 'ACTIF' }, 'aucun effet');
    });

    test('SUSPENDU → VALIDE sans motif → REASON_REQUIRED, toujours SUSPENDU ; avec motif → VALIDE (témoin)', async () => {
        const p = await newPartner('r55-reactive');
        assert.equal((await statusSet(p, 'SUSPENDU', REASON)).ok, true, 'suspension avec motif');
        assertRefused(await statusSet(p, 'VALIDE'), 'REASON_REQUIRED', 'réactivation sans motif');
        assert.equal((await partnerState(p)).partner, 'SUSPENDU', 'toujours SUSPENDU');
        const ok = await statusSet(p, 'VALIDE', REASON);
        assert.equal(ok.ok, true, `réactivation avec motif : ${JSON.stringify(ok)}`);
        assert.deepEqual(await partnerState(p), { partner: 'VALIDE', user: 'ACTIF' });
    });

    test('EN_ATTENTE → SUSPENDU refusé, statut inchangé', async () => {
        const p = await pending('r55-attente-suspendu');
        assertRefused(await statusSet(p, 'SUSPENDU', REASON), 'TRANSITION_NOT_ALLOWED', 'EN_ATTENTE → SUSPENDU');
        assert.equal((await partnerState(p)).partner, 'EN_ATTENTE');
    });

    test('REJETE → VALIDE refusé (le complément de dossier remet EN_ATTENTE), statut inchangé', async () => {
        const p = await pending('r55-refus-valide');
        assert.equal((await statusSet(p, 'REJETE', REASON)).ok, true, 'refus d’un dossier en attente (témoin)');
        assertRefused(await statusSet(p, 'VALIDE', REASON), 'TRANSITION_NOT_ALLOWED', 'REJETE → VALIDE');
        assert.equal((await partnerState(p)).partner, 'REJETE');
    });

    test('témoin (vert dès l’écriture) : EN_ATTENTE → VALIDE accepté', async () => {
        const p = await pending('r55-attente-valide');
        assert.equal((await statusSet(p, 'VALIDE')).ok, true);
        assert.equal((await partnerState(p)).partner, 'VALIDE');
    });
});

describe('R55, R6 — routes de l’admin', () => {
    function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
        return { params: Object.assign(Promise.resolve(params), params) };
    }

    async function patchStatus(token: string, partner: TestPartner, body: Row): Promise<RouteResult> {
        const handler = await routeHandler('../../app/api/admin/partners/[id]/status/route', 'PATCH', 'PATCH /api/admin/partners/[id]/status');
        return invoke(handler, jsonRequest(`/api/admin/partners/${partner.partnerId}/status`, 'PATCH', token, body), ctx({ id: partner.partnerId }));
    }

    test('PATCH …/status : VALIDE → REJETE → 409 TRANSITION_NOT_ALLOWED ; réactivation sans motif → 400 REASON_REQUIRED', async () => {
        const admin = await newAdminWith(['partners.validate', 'partners.suspend'], { label: 'r55-route' });
        const p = await newPartner('r55-route');
        const refuse = await patchStatus(admin.accessToken, p, { status: 'REJETE', reason: REASON });
        assert.equal(refuse.status, 409, `R55 : refus d’une partenaire validée : ${show(refuse)}`);
        assert.equal(refuse.body.code, 'TRANSITION_NOT_ALLOWED', show(refuse));
        assert.equal(sameQuotes(refuse.body.error), sameQuotes(ONLY_PENDING), show(refuse));
        assert.equal((await partnerState(p)).partner, 'VALIDE', 'aucun effet');

        const suspend = await patchStatus(admin.accessToken, p, { status: 'SUSPENDU', reason: REASON });
        assert.equal(suspend.status, 200, `suspension avec motif (témoin) : ${show(suspend)}`);
        const back = await patchStatus(admin.accessToken, p, { status: 'VALIDE' });
        assert.equal(back.status, 400, `R6 : réactivation sans motif : ${show(back)}`);
        assert.equal(back.body.code, 'REASON_REQUIRED', show(back));
        assert.equal((await partnerState(p)).partner, 'SUSPENDU', 'toujours SUSPENDU');
        const restored = await patchStatus(admin.accessToken, p, { status: 'VALIDE', reason: REASON });
        assert.equal(restored.status, 200, `réactivation avec motif : ${show(restored)}`);
    });

    test('PATCH /api/admin/users {status: SUSPENDU} sur un compte partenaire → 409 PARTNER_STATUS_VIA_PARTNER_SHEET, aucune écriture', async () => {
        const admin = await newAdminWith(['users.read', 'users.write'], { label: 'r6-users' });
        const p = await newPartner('r6-users');
        const handler = await routeHandler('../../app/api/admin/users/route', 'PATCH', 'PATCH /api/admin/users');
        const res = await invoke(handler, jsonRequest('/api/admin/users', 'PATCH', admin.accessToken, { userId: p.userId, status: 'SUSPENDU', reason: REASON }));
        assert.equal(res.status, 409, `R6 : suspension d’une partenaire depuis /admin/users : ${show(res)}`);
        assert.equal(res.body.code, 'PARTNER_STATUS_VIA_PARTNER_SHEET', show(res));
        assert.equal(sameQuotes(res.body.error), sameQuotes(VIA_SHEET), show(res));
        assert.deepEqual(await partnerState(p), { partner: 'VALIDE', user: 'ACTIF' }, 'ni users.status ni partners.status changés');
    });
});

// ── Contrôles statiques des écrans ─────────────────────────────────────────

const ROOT = process.cwd();

interface Source { rel: string; code: string; strings: string[] }

function readSource(rel: string): Source {
    const abs = path.join(ROOT, rel);
    assert.ok(fs.existsSync(abs), `${rel} absent`);
    const text = fs.readFileSync(abs, 'utf8');
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const strings: string[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) strings.push(node.text);
        else if (ts.isJsxText(node) && node.text.trim()) strings.push(node.text.trim());
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return { rel, code: ts.createPrinter({ removeComments: true }).printFile(sf), strings };
}

/** La fiche : modale Dossier du tableau de bord admin, plus le dialogue de statut s'il existe. */
function sheet(): Source[] {
    const out = [readSource('app/admin/dashboard/page.tsx')];
    if (fs.existsSync(path.join(ROOT, 'components/admin/PartnerStatusDialog.tsx'))) out.push(readSource('components/admin/PartnerStatusDialog.tsx'));
    return out;
}

describe('R6, R55 — écrans (contrôles statiques)', () => {
    test('fiche : « Suspendre » et « Réactiver » vers …/status avec un motif (PartnerStatusDialog)', () => {
        assert.ok(fs.existsSync(path.join(ROOT, 'components/admin/PartnerStatusDialog.tsx')), 'R6 : components/admin/PartnerStatusDialog.tsx absent (contrat 5.15)');
        const src = sheet();
        const strings = src.flatMap((s) => s.strings);
        for (const label of ['Suspendre', 'Réactiver']) {
            assert.ok(strings.some((x) => x.includes(label)), `R6 : bouton « ${label} » absent de la fiche partenaire`);
        }
        assert.ok(strings.some((x) => /\/status\b/.test(x)), 'R6 : la fiche n’appelle pas …/partners/[id]/status');
        assert.ok(src.some((s) => /\breason\b/.test(s.code)), 'R6 : aucun motif (`reason`) envoyé par la fiche');
    });

    test('« Valider » et « Refuser » seulement pour un dossier EN_ATTENTE ; lien profond dossier=', () => {
        const dash = readSource('app/admin/dashboard/page.tsx');
        assert.ok(/status\s*===\s*['"]EN_ATTENTE['"]/.test(dash.code), 'R55 : « Valider » et « Refuser » non conditionnés par status === \'EN_ATTENTE\'');
        assert.ok(/\.get\(\s*['"]dossier['"]\s*\)/.test(dash.code), 'R6 : lien profond ?dossier=<partnerId> non lu par le tableau de bord (searchParams.get(« dossier »))');
    });

    test('/admin/users : « Voir la fiche partenaire » vers /admin/dashboard?partenaires=ALL&dossier=', () => {
        const users = readSource('app/admin/users/page.tsx');
        assert.ok(users.strings.some((x) => x.includes('Voir la fiche partenaire')), 'R6 : « Voir la fiche partenaire » absent de /admin/users');
        assert.ok(users.strings.some((x) => x.includes('/admin/dashboard') && x.includes('dossier=')), 'R6 : lien vers la fiche (/admin/dashboard?partenaires=ALL&dossier=) absent');
    });
});
