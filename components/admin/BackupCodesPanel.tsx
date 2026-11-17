'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import { KeyRound, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useIdentityConfirm } from '@/components/admin/IdentityConfirm';
import { formatDateTime } from '@/lib/format';

interface Status { remaining: number; generated_at: string | null }

/**
 * Finition 3d (point 2b) — codes de secours du SUPERADMIN, sur la page « Sécurité du compte ». 10 codes à usage unique,
 * créés avec le mot de passe et le code administrateur (useIdentityConfirm), montrés une seule fois avec « Imprimez-les ou
 * notez-les en lieu sûr » ; en créer de nouveaux annule les anciens ; le nombre restant est affiché. Le serveur ne rend
 * jamais deux fois les mêmes codes.
 */
export function BackupCodesPanel({ autoStart = false }: { autoStart?: boolean }) {
    const id = useId();
    const { run, dialog } = useIdentityConfirm();
    const [status, setStatus] = useState<Status | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [codes, setCodes] = useState<string[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/security/backup-codes', { cache: 'no-store' });
            const body = (await res.json().catch(() => null)) as (Status & { error?: string }) | null;
            if (!res.ok || !body) {
                setLoadError(body?.error ?? 'Codes de secours momentanément illisibles.');
                return;
            }
            setLoadError(null);
            setStatus({ remaining: Number(body.remaining ?? 0), generated_at: body.generated_at ?? null });
        } catch {
            setLoadError('Connexion impossible. Vérifiez votre réseau, puis réessayez.');
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const create = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const reply = await run(() => sendJson<{ codes?: string[] }>('/api/admin/security/backup-codes', 'POST', {}));
            if (reply && Array.isArray(reply.codes) && reply.codes.length === 10) {
                setCodes(reply.codes);
                await load();
            } else if (reply) {
                setError('Le serveur n’a pas rendu les codes : rien n’a été créé à l’écran. Réessayez.');
            }
        } catch (err) {
            setError(errorMessage(err, 'Les codes de secours n’ont pas pu être créés. Réessayez.'));
        } finally {
            setBusy(false);
        }
    }, [run, load]);

    useEffect(() => {
        if (autoStart && status && status.remaining === 0 && !codes && !busy) void create();
        // Lancement automatique une seule fois, à l'arrivée depuis la proposition de la double vérification
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart, status]);

    const remaining = status?.remaining ?? 0;
    return (
        <section aria-labelledby={`${id}-titre`} className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-6">
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true"><KeyRound size={20} /></span>
                <div className="min-w-0 space-y-1">
                    <h2 id={`${id}-titre`} className="text-lg font-bold tracking-tight text-fg">Codes de secours</h2>
                    <p className="text-sm text-fg-muted">
                        Si vous perdez votre téléphone, un code de secours remplace le code reçu par SMS pour ouvrir l’administration. Chaque code ne sert qu’une fois.
                    </p>
                </div>
            </div>
            {loadError && <StatusBanner tone="danger" announce="alert" title="Codes illisibles">{loadError}</StatusBanner>}
            {error && <StatusBanner tone="danger" announce="alert" title="Codes non créés">{error}</StatusBanner>}
            {codes ? (
                <div className="space-y-3">
                    <StatusBanner tone="warning" title="Imprimez-les ou notez-les en lieu sûr">
                        Ils ne s’afficheront plus jamais. Gardez-les loin de votre téléphone.
                    </StatusBanner>
                    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Vos 10 codes de secours">
                        {codes.map((c) => (
                            <li key={c} className="rounded-xl border border-border bg-surface-sunken px-4 py-3 text-base font-semibold tracking-wider text-fg tabular-nums">{c}</li>
                        ))}
                    </ol>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button variant="secondary" leftIcon={<Printer size={18} />} onClick={() => window.print()}>Imprimer</Button>
                        <Button variant="primary" leftIcon={<ShieldCheck size={18} />} onClick={() => setCodes(null)}>J’ai noté mes codes</Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {status && (
                        <p className="text-sm text-fg">
                            {remaining > 0
                                ? <>Il vous reste <span className="font-semibold tabular-nums">{remaining}</span> code{remaining > 1 ? 's' : ''} sur 10{status.generated_at ? <>, créés le {formatDateTime(status.generated_at)}</> : null}.</>
                                : <>Aucun code de secours : si vous perdez votre téléphone, vous ne pourrez plus ouvrir l’administration.</>}
                        </p>
                    )}
                    <Button variant={remaining > 0 ? 'secondary' : 'primary'} isLoading={busy} onClick={() => void create()} leftIcon={<KeyRound size={18} />}>
                        {remaining > 0 ? 'Remplacer mes codes' : 'Créer mes codes de secours'}
                    </Button>
                    {remaining > 0 && <p className="text-sm text-fg-muted">Remplacer vos codes annule les anciens.</p>}
                </div>
            )}
            {dialog}
        </section>
    );
}
