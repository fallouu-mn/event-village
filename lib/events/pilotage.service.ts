/**
 * Lot 5 (5.7, 5.10, 5.11) — lectures du pilotage d'un événement, des listes partenaire et admin, et
 * export des participants, côté serveur.
 *
 * Toutes les données viennent des RPC de la migration 20261102000005_lot5_pilotage.sql (pilotage_*,
 * participants_export, event_controller_set_cash, partner_events_overview, admin_events_list). Chaque
 * RPC vérifie elle-même l'accès de l'acteur (partenaire propriétaire avec compte ACTIF, ou admin) et
 * renvoie `{ ok:false, code, message }` en cas de refus : ce module traduit ce refus en statut HTTP,
 * sans jamais servir d'erreur Postgres brute. Aucun calcul n'est fait ici : la route renvoie le corps
 * de la RPC tel quel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const PILOTAGE_TABS = ['overview', 'sales', 'entries', 'team', 'cash', 'closing'] as const;
export type PilotageTab = (typeof PILOTAGE_TABS)[number];

const TAB_RPC: Record<PilotageTab, string> = {
    overview: 'pilotage_overview',
    sales: 'pilotage_sales',
    entries: 'pilotage_entries',
    team: 'pilotage_team',
    cash: 'pilotage_cash',
    closing: 'pilotage_closing',
};

const TAB_LABEL: Record<PilotageTab, string> = {
    overview: 'l’aperçu',
    sales: 'les ventes',
    entries: 'les entrées',
    team: 'l’équipe',
    cash: 'la caisse',
    closing: 'la clôture',
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Finalités admises pour exporter le téléphone et l'email des participants (liste fermée). */
export const EXPORT_PURPOSES = ['URGENT_EVENT_INFO', 'SAFETY_AND_RECEPTION'] as const;
export type ExportPurpose = (typeof EXPORT_PURPOSES)[number];

/** Refus métier : statut HTTP, code stable, message en français. */
export class PilotageError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) {
        super(message);
        this.name = 'PilotageError';
    }

    toBody(): { error: string; code: string } {
        return { error: this.message, code: this.code };
    }
}

const REFUSAL_HTTP: Record<string, number> = {
    EVENT_NOT_FOUND: 404,
    ASSIGNMENT_NOT_FOUND: 404,
    PARTNER_NOT_FOUND: 403,
    ACCOUNT_NOT_ACTIVE: 403,
    OWNER_ONLY: 403,
    FORBIDDEN: 403,
    PURPOSE_REQUIRED: 400,
    INVALID_INPUT: 400,
    UNKNOWN_STATUS: 400,
};

const DEFAULT_MESSAGES: Record<string, string> = {
    EVENT_NOT_FOUND: 'Événement introuvable.',
    ASSIGNMENT_NOT_FOUND: 'Affectation introuvable.',
    ACCOUNT_NOT_ACTIVE: 'Votre compte n’est pas actif.',
    FORBIDDEN: 'Accès refusé.',
};

interface RpcRefusal {
    ok: false;
    code?: string;
    message?: string;
}

export type RpcBody = Record<string, unknown> & { ok: true };

/**
 * Appel d'une RPC du lot : renvoie le corps accepté, lève PilotageError pour un refus métier et Error
 * (500, message générique) pour une panne.
 */
export async function callLot5Rpc(rpc: string, p: Record<string, unknown>, failure: string): Promise<RpcBody> {
    const { data, error } = await getServiceRoleClient().rpc(rpc, { p });
    if (error) {
        console.error(`[pilotage] ${rpc} : ${error.code} ${error.message}`);
        throw new Error(failure);
    }
    const body = (data ?? null) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
        console.error(`[pilotage] ${rpc} : réponse vide`);
        throw new Error(failure);
    }
    if (body.ok !== true) {
        const refusal = body as unknown as RpcRefusal;
        const code = typeof refusal.code === 'string' ? refusal.code : 'FORBIDDEN';
        throw new PilotageError(REFUSAL_HTTP[code] ?? 409, code, refusal.message || DEFAULT_MESSAGES[code] || 'Opération refusée.');
    }
    return body as RpcBody;
}

/** Réponse d'erreur d'une route (refus métier ou panne), jamais d'erreur Postgres brute. */
export function errorResponse(err: unknown, route: string, failure: string, failureCode: string): NextResponse {
    if (err instanceof PilotageError) return NextResponse.json(err.toBody(), { status: err.status });
    console.error(`[${route}]`, err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: failure, code: failureCode }, { status: 500 });
}

/** Paramètres d'une route dynamique : objet (Next 14) ou promesse (Next 15). */
export type RouteParams<T extends Record<string, string>> = { params: T | Promise<T> };

export async function routeParam<T extends Record<string, string>>(ctx: RouteParams<T> | undefined, key: keyof T): Promise<string> {
    if (!ctx) return '';
    const params = await Promise.resolve(ctx.params);
    const value = params?.[key];
    return typeof value === 'string' ? value : '';
}

/** Lecture d'un onglet du pilotage (contrat I) : corps de la RPC pilotage_<onglet>. */
export async function readPilotageTab(tab: PilotageTab, eventId: string, actorId: string): Promise<RpcBody> {
    return callLot5Rpc(TAB_RPC[tab], { event_id: eventId, actor_id: actorId }, `Lecture de ${TAB_LABEL[tab]} impossible pour le moment.`);
}

/**
 * Gestionnaire GET d'un onglet : session ACTIVE (401 ou 403), identifiant d'événement valide (404),
 * puis la RPC, qui refuse en 404 le partenaire B, un client ou un événement inconnu.
 */
export function pilotageGetHandler(tab: PilotageTab) {
    return async function GET(request: NextRequest, ctx: RouteParams<{ id: string }>): Promise<NextResponse> {
        const session = await requireActiveSession(request);
        if (session.response) return session.response;
        const eventId = await routeParam(ctx, 'id');
        if (!UUID_RE.test(eventId)) {
            return NextResponse.json({ error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
        }
        try {
            const body = await readPilotageTab(tab, eventId, session.user.id);
            return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
        } catch (err) {
            return errorResponse(err, `GET /api/partner/events/[id]/pilotage/${tab}`,
                `Lecture de ${TAB_LABEL[tab]} impossible pour le moment.`, 'PILOTAGE_READ_FAILED');
        }
    };
}

// ── Export des participants ────────────────────────────────────────────────

export interface ParticipantRow {
    name: string;
    category: string;
    status: string;
    entered_at: string | null;
    phone?: string | null;
    email?: string | null;
}

export interface ParticipantsExport {
    exportId: string;
    title: string;
    includeContacts: boolean;
    rowCount: number;
    rows: ParticipantRow[];
}

export async function exportParticipants(eventId: string, actorId: string, includeContacts: boolean, purpose: string | null): Promise<ParticipantsExport> {
    const p: Record<string, unknown> = { event_id: eventId, actor_id: actorId, include_contacts: includeContacts };
    if (purpose !== null) p.purpose = purpose;
    const body = await callLot5Rpc('participants_export', p, 'Export des participants impossible pour le moment.');
    if (!Array.isArray(body.rows)) {
        console.error('[pilotage] participants_export : lignes absentes de la réponse');
        throw new Error('Export des participants impossible pour le moment.');
    }
    return {
        exportId: String(body.export_id),
        title: typeof body.title === 'string' ? body.title : 'evenement',
        includeContacts: body.include_contacts === true,
        rowCount: Number(body.row_count),
        rows: body.rows as ParticipantRow[],
    };
}

/** Cellule CSV : guillemets si besoin, et neutralisation des formules (=, +, -, @) à l'ouverture dans un tableur. */
function csvCell(value: unknown): string {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
    return text;
}

/** CSV UTF-8 avec BOM, séparateur « ; », fins de ligne CRLF, en-têtes français. */
export function participantsCsv(exp: ParticipantsExport): string {
    const header = ['Nom', 'Catégorie', 'Statut du billet', 'Heure d’entrée'];
    if (exp.includeContacts) header.push('Téléphone', 'E-mail');
    const lines = [header.map(csvCell).join(';')];
    for (const r of exp.rows) {
        const cells: unknown[] = [r.name, r.category, r.status, r.entered_at ?? ''];
        if (exp.includeContacts) cells.push(r.phone ?? '', r.email ?? '');
        lines.push(cells.map(csvCell).join(';'));
    }
    return `﻿${lines.join('\r\n')}\r\n`;
}

/** Nom de fichier ASCII sûr : participants-<titre>-<AAAA-MM-JJ>.csv */
export function exportFileName(title: string): string {
    const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'evenement';
    return `participants-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
}
