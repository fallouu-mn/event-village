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
