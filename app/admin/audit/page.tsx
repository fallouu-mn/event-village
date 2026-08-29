'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Activity,
  Shield,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Eye,
  FileCode,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface AuditItem {
  id: string;
  user_id: string | null;
  user_role: string | null;
  action: string;
  object_type: string;
  object_id: string | null;
  old_value: any;
  new_value: any;
  metadata: any;
  created_at: string;
}

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [objectFilter, setObjectFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/admin/audit?limit=100`;
      if (actionFilter !== 'ALL') url += `&action=${actionFilter}`;
      if (objectFilter !== 'ALL') url += `&objectType=${objectFilter}`;

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('[AdminAudit] Erreur chargement:', err);
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, objectFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="w-10 h-10 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF6B35]">
              Console Superadmin HQ
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Journal d&apos;Audit Inaltérable & Traçabilité (§134, §156)
            </h1>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchLogs()}
          disabled={isLoading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </Button>
      </div>

      {/* Filtres */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs font-bold"
              >
                <option value="ALL">Toutes les actions</option>
                <option value="INSERT">INSERT (Création)</option>
                <option value="UPDATE">UPDATE (Modification)</option>
                <option value="STATUS_CHANGE">STATUS_CHANGE (Changement Statut)</option>
                <option value="UPDATE_PERMISSIONS">UPDATE_PERMISSIONS (Droits RBAC)</option>
                <option value="UPDATE_PRICING">UPDATE_PRICING (Tarifs)</option>
                <option value="SEND_COMMUNICATION">SEND_COMMUNICATION (Campagne)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Entité / Objet</label>
              <select
                value={objectFilter}
                onChange={(e) => setObjectFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-xs font-bold"
              >
                <option value="ALL">Tous les objets</option>
                <option value="partners">Partenaires (partners)</option>
                <option value="users">Utilisateurs (users)</option>
                <option value="admin_permissions">Permissions (admin_permissions)</option>
                <option value="platform_settings">Tarifs (platform_settings)</option>
                <option value="campaigns">Communications (campaigns)</option>
                <option value="payments">Paiements (payments)</option>
              </select>
            </div>
          </div>

          <span className="text-xs font-mono font-bold text-[#FF6B35]">
            {logs.length} entrée(s) trouvée(s)
          </span>
        </div>

        {/* Tableau des Logs */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <RefreshCw size={24} className="animate-spin mx-auto text-[#FF6B35] mb-2" />
            <p className="text-xs">Chargement du journal d&apos;audit...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <Activity size={32} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
            <p className="text-xs font-bold">Aucun enregistrement d&apos;audit trouvé.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-3">Horodatage</th>
                  <th className="pb-3">Rôle</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Objet</th>
                  <th className="pb-3">ID Objet</th>
                  <th className="pb-3 text-right">Détails JSON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/40 text-[11px]">
                    <td className="py-3 text-slate-500">{formatDate(log.created_at)}</td>
                    <td className="py-3 font-bold text-purple-600 dark:text-purple-400">{log.user_role || 'SYSTEM'}</td>
                    <td className="py-3 font-black text-slate-900 dark:text-white">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 font-bold text-[#FF6B35]">{log.object_type}</td>
                    <td className="py-3 text-slate-400 truncate max-w-[120px]">{log.object_id || 'N/A'}</td>
                    <td className="py-3 text-right font-sans">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="text-[10px] py-1 px-2"
                      >
                        <FileCode size={12} className="mr-1" />
                        Examiner
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Détails JSON Diff */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Log #${selectedLog.id.slice(0, 8)} • ${selectedLog.action}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-zinc-400">
              <div><strong className="text-slate-900 dark:text-white">Date:</strong> {formatDate(selectedLog.created_at)}</div>
              <div><strong className="text-slate-900 dark:text-white">Rôle:</strong> {selectedLog.user_role}</div>
              <div><strong className="text-slate-900 dark:text-white">Objet:</strong> {selectedLog.object_type}</div>
              <div><strong className="text-slate-900 dark:text-white">ID Objet:</strong> {selectedLog.object_id}</div>
            </div>

            {selectedLog.old_value && (
              <div>
                <span className="block font-bold text-red-500 mb-1">Ancienne Valeur (Old Value)</span>
                <pre className="p-3 rounded-xl bg-red-50/60 dark:bg-red-950/20 text-red-700 dark:text-red-300 font-mono text-[10px] overflow-x-auto border border-red-200 dark:border-red-900">
                  {JSON.stringify(selectedLog.old_value, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.new_value && (
              <div>
                <span className="block font-bold text-emerald-500 mb-1">Nouvelle Valeur (New Value)</span>
                <pre className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] overflow-x-auto border border-emerald-200 dark:border-emerald-900">
                  {JSON.stringify(selectedLog.new_value, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div>
                <span className="block font-bold text-slate-500 mb-1">Métadonnées</span>
                <pre className="p-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono text-[10px] overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
