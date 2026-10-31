/**
 * Connexion directe à la base Postgres LOCALE, réservée aux tests de catalogue
 * (tests/schema) : RLS activée sur chaque table, privilèges EXECUTE des fonctions,
 * privilèges par défaut. Ces informations ne sont pas exposées par l'API REST.
 *
 * Garanties :
 *  - SUPABASE_DB_URL doit pointer sur localhost / 127.0.0.1 (vérifié par tests/helpers/env.ts
 *    au démarrage, revérifié ici) ;
 *  - `inspect` exécute les requêtes dans une transaction READ ONLY, éventuellement sous
 *    `SET LOCAL ROLE anon | authenticated` pour observer exactement les droits de ces rôles ;
 *  - `inRolledBackTransaction` permet un DDL d'essai qui est TOUJOURS annulé (ROLLBACK).
 */
import './env';
import { Client } from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type ApiRole = 'anon' | 'authenticated';

function localDbUrl(): string {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) {
        throw new Error('SUPABASE_DB_URL absent de .env.test (URL Postgres de l\'instance locale, voir .env.test.example).');
    }
    const host = new URL(url).hostname;
    if (!LOCAL_HOSTS.has(host)) {
        throw new Error(`SUPABASE_DB_URL ne pointe pas sur une base locale (hôte : ${host}).`);
    }
    return url;
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: localDbUrl() });
    await client.connect();
    try {
        return await fn(client);
    } finally {
        await client.end();
    }
}

/** Exécute des requêtes de lecture dans une transaction READ ONLY, éventuellement sous un rôle API. */
export async function inspect<T>(fn: (client: Client) => Promise<T>, role?: ApiRole): Promise<T> {
    return withClient(async (client) => {
        await client.query('BEGIN TRANSACTION READ ONLY');
        try {
            if (role) await client.query(`SET LOCAL ROLE ${role}`);
            return await fn(client);
        } finally {
            await client.query('ROLLBACK');
        }
    });
}

/** Exécute un essai (DDL compris) dans une transaction systématiquement annulée. */
export async function inRolledBackTransaction<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    return withClient(async (client) => {
        await client.query('BEGIN');
        try {
            return await fn(client);
        } finally {
            await client.query('ROLLBACK');
        }
    });
}
