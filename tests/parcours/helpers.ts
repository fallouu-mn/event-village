/**
 * Aides des tests de parcours serveur (tests fonctionnels : les routes s'exécutent
 * avec leur propre client service_role, comme en production).
 */
import '../helpers/env';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';

export const BASE_URL = 'http://127.0.0.1:3000';

export function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}, method = 'POST'): NextRequest {
    return new NextRequest(`${BASE_URL}${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
}

export function formRequest(path: string, body: string, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
        body,
    });
}

/** Numéro sénégalais mobile valide et aléatoire (+22178XXXXXXX). */
export function randomSenegalPhone(prefix: '76' | '77' | '78' = '78'): string {
    return `+221${prefix}${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

export function randomEmail(label: string): string {
    return `parcours-${label}-${randomBytes(5).toString('hex')}@test.eventvillage.local`;
}

export const STRONG_PASSWORD = 'Parcours#2026-local';

export function routeContext<T extends Record<string, string>>(params: T): { params: Promise<T> } {
    return { params: Promise.resolve(params) };
}

/** PDF minimal valide (signature %PDF-) pour les dépôts de pièces. */
export const MINIMAL_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');

export function uploadRequest(docType: string, content: Buffer = MINIMAL_PDF, mime = 'application/pdf', name = 'piece.pdf', headers: Record<string, string> = {}): NextRequest {
    const form = new FormData();
    form.append('file', new File([new Uint8Array(content)], name, { type: mime }));
    form.append('docType', docType);
    return new NextRequest(`${BASE_URL}/api/partner/documents/upload`, { method: 'POST', body: form, headers });
}

export interface RegistrationDocuments {
    idCardUploadToken: string;
    businessDocUploadToken: string;
    /** Chemins historiques (contrat d'avant le lot 1C.2), envoyés en plus pour compatibilité. */
    idCardUrl: string;
    businessDocUrl: string;
}

/**
 * Dépose la pièce d'identité et le document d'entreprise comme le fait l'écran d'inscription
 * partenaire, et renvoie ce qu'il faut joindre à /api/partner/register.
 */
export async function uploadRegistrationDocuments(): Promise<RegistrationDocuments> {
    const { POST: upload } = await import('../../app/api/partner/documents/upload/route');
    const out: Record<string, string> = {};
    for (const docType of ['id_card', 'business_doc'] as const) {
        const res = await upload(uploadRequest(docType));
        const body = await res.json();
        if (res.status !== 200 || !body.success) throw new Error(`dépôt ${docType} : HTTP ${res.status} ${JSON.stringify(body)}`);
        out[docType] = body.filePath;
        out[`${docType}_token`] = body.uploadToken ?? '';
    }
    return {
        idCardUploadToken: out.id_card_token,
        businessDocUploadToken: out.business_doc_token,
        idCardUrl: out.id_card,
        businessDocUrl: out.business_doc,
    };
}
