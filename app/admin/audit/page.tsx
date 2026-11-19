'use client';

import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import { Activity, FileSearch, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { AUDIT_ACTION_FILTER, AUDIT_OBJECT_LABELS, auditActionLabel, auditActorRoleLabel, auditObjectLabel } from '@/lib/labels/audit';
import { formatDateTime, formatInteger } from '@/lib/format';

const ACTOR_ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  PARTENAIRE: 'Partenaire',
  CONTROLEUR: 'Contrôleur',
  ADMIN: 'Administrateur',
  SUPERADMIN: 'Super-administrateur',
};

interface AuditItem {
  id: string;
  user_id: string | null;
  user_role: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  object_type: string;
  object_id: string | null;
  old_value: unknown;
  new_value: unknown;
  metadata: unknown;
  created_at: string;
}

/** Valeur enregistrée non vide (objet avec au moins une clé, ou valeur simple). */
function hasData(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

/**
 * Journal des actions de l'administration (lot 9, A24 et A38 ; finition 3b, E-37), réservé au super-administrateur.
 * Design 1c : jetons de la charte, filtres en champs de la charte, liste en DataList (cartes jusqu'à xl : la page a un menu
 * latéral) ; aucun identifiant brut à l'écran (ni l'auteur, ni l'objet) ; les données enregistrées (avant, après) restent
 * repliées sous « Détail technique », que le super-administrateur ouvre s'il en a besoin.
 */
export default function AdminAuditLogPage() {
  const fieldId = useId();
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [objectFilter, setObjectFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Lot 9 (A24) : un 403 est un refus de droits, pas une panne : ni « Réessayer » ni message technique.
  const [forbidden, setForbidden] = useState(false);
  // Deux filtres changés de suite : seule la dernière lecture décide de ce qui est affiché.
  const lastRequest = useRef(0);

  const fetchLogs = useCallback(async () => {
    const request = ++lastRequest.current;
    setIsLoading(true);
    setLoadError(false);
    setForbidden(false);
    try {
      let url = `/api/admin/audit?limit=100`;
      if (actionFilter !== 'ALL') url += `&action=${actionFilter}`;
      if (objectFilter !== 'ALL') url += `&objectType=${objectFilter}`;

      const res = await fetch(url);
      if (res.status === 403) {
        if (request === lastRequest.current) setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error(`lecture refusée, HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.logs)) throw new Error('réponse sans journal');
      if (request === lastRequest.current) setLogs(data.logs);
    } catch (err) {
      console.error('[AdminAudit] Erreur chargement:', err);
      if (request === lastRequest.current) setLoadError(true);
    } finally {
      if (request === lastRequest.current) setIsLoading(false);
    }
  }, [actionFilter, objectFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const author = (log: AuditItem) => (
    <span className="flex min-w-0 flex-col">
      <span className="break-words font-semibold text-foreground-strong">{log.actor_name ?? 'Système'}</span>
      {log.actor_role && (
        <span className="text-sm text-muted-foreground">
          Aujourd’hui : {ACTOR_ROLE_LABELS[log.actor_role] ?? 'Autre rôle'}
        </span>
      )}
    </span>
  );

  const when = (log: AuditItem) => (
    <time dateTime={log.created_at} className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(log.created_at)}</time>
  );

  const detailButton = (log: AuditItem) => (
    <Button variant="secondary" size="sm" onClick={() => setSelectedLog(log)} leftIcon={<FileSearch size={16} aria-hidden="true" />}>
      Examiner
    </Button>
  );

  const columns: DataColumn<AuditItem>[] = [
    { key: 'date', header: 'Date', render: when },
    { key: 'author', header: 'Auteur', render: author, className: 'min-w-[11rem]' },
    { key: 'role', header: 'Rôle à l’action', render: (log) => auditActorRoleLabel(log.user_role) },
    { key: 'action', header: 'Action', render: (log) => <span className="font-semibold">{auditActionLabel(log.action)}</span> },
    { key: 'object', header: 'Objet', render: (log) => auditObjectLabel(log.object_type) },
    { key: 'detail', header: 'Détail', align: 'right', render: detailButton },
  ];

  const renderCard = (log: AuditItem) => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="break-words text-base font-semibold text-foreground-strong">{auditActionLabel(log.action)}</p>
        <p className="text-sm text-muted-foreground">{auditObjectLabel(log.object_type)} · {when(log)}</p>
      </div>
      <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Auteur</dt>
        <dd className="min-w-0">{author(log)}</dd>
        <dt className="text-muted-foreground">Rôle à l’action</dt>
        <dd className="min-w-0 break-words text-foreground-strong">{auditActorRoleLabel(log.user_role)}</dd>
      </dl>
      <div>{detailButton(log)}</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pb-16">
      <PageHeader
        title="Journal"
        description="Les actions sensibles de l’administration : qui, quand, sur quoi. Les 100 plus récentes."
        back={{ href: '/admin/dashboard', label: 'Accueil de l’administration' }}
        actions={!forbidden ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchLogs()}
            isLoading={isLoading}
            leftIcon={<RefreshCw size={16} aria-hidden="true" />}
          >
            Actualiser
          </Button>
        ) : undefined}
      />

      {forbidden ? (
        <EmptyState
          icon={<Shield size={28} />}
          title="Réservé au super-administrateur"
          description="Seul un super-administrateur peut consulter le journal. Si vous en avez besoin, adressez-vous à lui."
          actionLabel="Retour au tableau de bord"
          actionHref="/admin/dashboard"
        />
      ) : (
        <>
          <Card className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:flex-wrap md:items-end">
            <Select
              id={`${fieldId}-action`}
              label="Action"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              options={[{ value: 'ALL', label: 'Toutes les actions' }, ...AUDIT_ACTION_FILTER.map((a) => ({ value: a, label: auditActionLabel(a) }))]}
              fieldClassName="md:w-72"
            />
            <Select
              id={`${fieldId}-objet`}
              label="Objet"
              value={objectFilter}
              onChange={(e) => setObjectFilter(e.target.value)}
              options={[{ value: 'ALL', label: 'Tous les objets' }, ...Object.keys(AUDIT_OBJECT_LABELS).map((o) => ({ value: o, label: auditObjectLabel(o) }))]}
              fieldClassName="md:w-64"
            />
            {!loadError && !isLoading && (
              <p className="text-sm text-muted-foreground md:ml-auto md:pb-3" aria-live="polite">
                <span className="font-semibold tabular-nums text-foreground-strong">{formatInteger(logs.length)}</span>{' '}
                {logs.length > 1 ? 'entrées' : 'entrée'}
              </p>
            )}
          </Card>

          {isLoading && logs.length === 0 ? (
            <div role="status" aria-label="Chargement du journal" className="flex flex-col gap-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : loadError ? (
            <ErrorState
              title="Journal indisponible"
              description="La lecture du journal a échoué. Rien ne permet de dire qu’il est vide : réessayez."
              onRetry={() => void fetchLogs()}
              isRetrying={isLoading}
            />
          ) : (
            <DataList
              items={logs}
              columns={columns}
              getKey={(log) => log.id}
              caption="Journal des actions"
              renderCard={renderCard}
              breakpoint="xl"
              empty={<EmptyState icon={<Activity size={28} />} title="Aucune entrée" description="Aucune action ne correspond à ces filtres." />}
            />
          )}
        </>
      )}

      {/* Détail d'une entrée : en mots ; les données enregistrées restent repliées (« Détail technique ») */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={auditActionLabel(selectedLog.action)}
          subtitle={formatDateTime(selectedLog.created_at)}
          icon={<FileSearch size={20} />}
          maxWidth="xl"
        >
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Auteur</dt>
              <dd className="min-w-0 break-words font-semibold text-foreground-strong">{selectedLog.actor_name ?? 'Système'}</dd>
              <dt className="text-muted-foreground">Rôle à l’action</dt>
              <dd className="min-w-0 text-foreground-strong">{auditActorRoleLabel(selectedLog.user_role)}</dd>
              <dt className="text-muted-foreground">Objet</dt>
              <dd className="min-w-0 text-foreground-strong">{auditObjectLabel(selectedLog.object_type)}</dd>
            </dl>

            {(hasData(selectedLog.old_value) || hasData(selectedLog.new_value) || hasData(selectedLog.metadata)) ? (
              <details className="rounded-xl border border-border bg-muted p-3">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-foreground-strong">
                  Détail technique (données enregistrées)
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  {hasData(selectedLog.old_value) && (
                    <div>
                      <p className="mb-1 text-sm font-semibold text-danger-text">Avant</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 font-mono text-sm text-foreground">
                        {JSON.stringify(selectedLog.old_value, null, 2)}
                      </pre>
                    </div>
                  )}
                  {hasData(selectedLog.new_value) && (
                    <div>
                      <p className="mb-1 text-sm font-semibold text-success-text">Après</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 font-mono text-sm text-foreground">
                        {JSON.stringify(selectedLog.new_value, null, 2)}
                      </pre>
                    </div>
                  )}
                  {hasData(selectedLog.metadata) && (
                    <div>
                      <p className="mb-1 text-sm font-semibold text-muted-foreground">Contexte</p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 font-mono text-sm text-foreground">
                        {JSON.stringify(selectedLog.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune donnée enregistrée en plus pour cette action.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
