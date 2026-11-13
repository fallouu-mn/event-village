/**
 * Lot 1C.2 — pièces d'inscription partenaire (pièce d'identité, document d'entreprise).
 *
 *  - Chaque dépôt reçoit un chemin aléatoire « pending/<uuid>/<type>.<ext> » et un jeton de
 *    dépôt (32 octets aléatoires) remis au déposant ; seule l'empreinte SHA-256 du jeton est
 *    conservée (table partner_document_uploads, service_role uniquement).
 *  - L'inscription rattache les pièces par leurs jetons, une seule fois, avant expiration.
 *  - Le chemin d'une pièce ne vient jamais du client : il est lu dans cette table.
 * Toute erreur de base est levée (aucun repli).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const PARTNER_DOCUMENTS_BUCKET = 'partner_documents';
export const DOC_TYPES = ['id_card', 'business_doc'] as const;
export type DocType = (typeof DOC_TYPES)[number];
export const UPLOAD_TTL_MS = 2 * 60 * 60 * 1000;

export function isDocType(value: unknown): value is DocType {
    return typeof value === 'string' && (DOC_TYPES as readonly string[]).includes(value);
}

export function hashUploadToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Type réel d'après la signature du contenu (le type annoncé par le client n'est pas cru). */
export function detectDocumentType(buf: Buffer): { mime: string; ext: string } | null {
    if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
    if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
    if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
    return null;
}

export function newUploadPath(docType: DocType, ext: string): string {
    return `pending/${randomUUID()}/${docType}.${ext}`;
}

/** Enregistre un dépôt et renvoie le jeton (en clair, une seule fois). */
export async function recordUpload(params: { objectPath: string; docType: DocType; mime: string; size: number }): Promise<{ token: string; expiresAt: string }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS).toISOString();
    const { error } = await getServiceRoleClient().from('partner_document_uploads').insert({
        object_path: params.objectPath,
        doc_type: params.docType,
        mime_type: params.mime,
        size_bytes: params.size,
        token_hash: hashUploadToken(token),
        expires_at: expiresAt,
    });
    if (error) throw new Error(`enregistrement du dépôt impossible : ${error.message}`);
    return { token, expiresAt };
}

export interface UploadRow {
    id: string;
    object_path: string;
    doc_type: DocType;
    expires_at: string;
    claimed_partner_id: string | null;
    claimed_at: string | null;
}

export async function findUploadByToken(token: string): Promise<UploadRow | null> {
    const { data, error } = await getServiceRoleClient()
        .from('partner_document_uploads')
        .select('id, object_path, doc_type, expires_at, claimed_partner_id, claimed_at')
        .eq('token_hash', hashUploadToken(token))
        .maybeSingle();
    if (error) throw new Error(`lecture du dépôt impossible : ${error.message}`);
    return (data as UploadRow | null) ?? null;
}

export type RegistrationUploads = Record<DocType, UploadRow>;

/**
 * Lot 9 bis (R75) : refus d'une pièce dit en français, jamais par son code (`id_card`, `business_doc`) ; mêmes mots que
 * l'écran d'inscription (app/partner/register/page.tsx).
 */
const DOC_REFUSALS: Record<DocType, { missing: string; used: string; expired: string }> = {
    id_card: {
        missing: 'La pièce d’identité est introuvable : déposez-la à nouveau.',
        used: 'La pièce d’identité est déjà utilisée par une autre inscription : déposez-la à nouveau.',
        expired: 'Le dépôt de la pièce d’identité a expiré : déposez-la à nouveau.',
    },
    business_doc: {
        missing: 'Le document d’entreprise est introuvable : déposez-le à nouveau.',
        used: 'Le document d’entreprise est déjà utilisé par une autre inscription : déposez-le à nouveau.',
        expired: 'Le dépôt du document d’entreprise a expiré : déposez-le à nouveau.',
    },
};

/** Vérifie les deux jetons d'une inscription : existants, du bon type, non rattachés, non expirés. */
export async function resolveRegistrationUploads(tokens: Record<DocType, string>): Promise<{ ok: true; uploads: RegistrationUploads } | { ok: false; error: string }> {
    const uploads = {} as RegistrationUploads;
    for (const docType of DOC_TYPES) {
        const row = await findUploadByToken(tokens[docType]);
        if (!row || row.doc_type !== docType) return { ok: false, error: DOC_REFUSALS[docType].missing };
        if (row.claimed_at) return { ok: false, error: DOC_REFUSALS[docType].used };
        if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, error: DOC_REFUSALS[docType].expired };
        uploads[docType] = row;
    }
    return { ok: true, uploads };
}

/** Rattache les pièces au dossier, une seule fois (refus si un autre dossier les a prises entre-temps). */
export async function claimRegistrationUploads(partnerId: string, uploads: RegistrationUploads): Promise<void> {
    const supabase = getServiceRoleClient();
    for (const docType of DOC_TYPES) {
        const { data, error } = await supabase
            .from('partner_document_uploads')
            .update({ claimed_partner_id: partnerId, claimed_at: new Date().toISOString() })
            .eq('id', uploads[docType].id)
            .is('claimed_at', null)
            .gt('expires_at', new Date().toISOString())
            .select('id');
        if (error) throw new Error(`rattachement de la pièce ${docType} impossible : ${error.message}`);
        if ((data ?? []).length !== 1) throw new Error(`pièce ${docType} déjà rattachée ou expirée`);
    }
}

/** Chemin de la dernière pièce d'un type rattachée à un dossier partenaire. */
export async function findClaimedDocumentPath(partnerId: string, docType: DocType): Promise<string | null> {
    const { data, error } = await getServiceRoleClient()
        .from('partner_document_uploads')
        .select('object_path')
        .eq('claimed_partner_id', partnerId)
        .eq('doc_type', docType)
        .order('claimed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw new Error(`lecture de la pièce ${docType} impossible : ${error.message}`);
    return (data?.object_path as string | undefined) ?? null;
}

/** Préfixe des dépôts antérieurs au lot 1C.2 (chemin saisi par le client à l'inscription). */
const LEGACY_UPLOAD_PREFIX = 'pending_registrations/';

/**
 * Dossier déposé avant le lot 1C.2 : chemin hérité de partners.id_card_url / business_doc_url,
 * sans ligne dans partner_document_uploads. Ce chemin avait été fourni par le client : il n'est
 * servi qu'aux administrateurs (validation des dossiers), jamais au propriétaire.
 */
export function legacyDocumentPath(partner: { id_card_url?: string | null; business_doc_url?: string | null }, docType: DocType): string | null {
    const value = docType === 'id_card' ? partner.id_card_url : partner.business_doc_url;
    return typeof value === 'string' && value.startsWith(LEGACY_UPLOAD_PREFIX) && !value.includes('..') ? value : null;
}

/** Lot 9 quater (F2 : AUD-25) : âge au-delà duquel un dépôt anonyme jamais rattaché à un dossier est purgé. */
export const UNCLAIMED_UPLOAD_MAX_AGE_HOURS = 24;
const PURGE_BATCH = 200;

/**
 * Lot 9 quater (F2 : AUD-25) — purge des pièces déposées par la route publique et jamais rattachées à un dossier
 * partenaire depuis plus de 24 h : fichier du stockage puis ligne de partner_document_uploads, par lots de 200. Appelée
 * par la tâche planifiée horaire (app/api/cron/stock-reservations). Lève une erreur si le stockage ou la base refuse.
 */
export async function purgeUnclaimedUploads(now: Date = new Date()): Promise<number> {
    const supabase = getServiceRoleClient();
    const before = new Date(now.getTime() - UNCLAIMED_UPLOAD_MAX_AGE_HOURS * 3_600_000).toISOString();
    const { data, error } = await supabase.from('partner_document_uploads')
        .select('id, object_path')
        .is('claimed_partner_id', null)
        .lt('created_at', before)
        .order('created_at', { ascending: true })
        .limit(PURGE_BATCH);
    if (error) throw new Error(`lecture des dépôts à purger : ${error.message}`);
    const rows = (data ?? []) as Array<{ id: string; object_path: string }>;
    if (rows.length === 0) return 0;
    const { error: rmErr } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).remove(rows.map((r) => r.object_path));
    if (rmErr) throw new Error(`suppression des pièces non rattachées : ${rmErr.message}`);
    const { error: delErr } = await supabase.from('partner_document_uploads').delete().in('id', rows.map((r) => r.id));
    if (delErr) throw new Error(`suppression des dépôts non rattachés : ${delErr.message}`);
    return rows.length;
}
