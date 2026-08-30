'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell,
  Ticket,
  DollarSign,
  Gift,
  CheckCheck,
  RefreshCw,
  FileText,
  Shield,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/components/providers/AuthProvider';

interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  channel?: string;
  status: string;
  isRead: boolean;
  readAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export default function NotificationsPage() {
  const { user, isAuthenticated } = useAuth();
  const [filterType, setFilterType] = useState<string>('ALL');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=50');
      if (!res.ok) {
        setNotifications([]);
        return;
      }
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount ?? data.notifications.filter((n: NotificationItem) => !n.isRead).length);
      }
    } catch (err) {
      console.error('[NotificationsPage] Erreur chargement:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllAsRead = async () => {
    setIsMarkingAll(true);
    // Optimistic UI
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, status: 'READ' })));
    setUnreadCount(0);

    try {
      await fetch('/api/notifications', { method: 'PATCH' });
    } catch (err) {
      console.error('[NotificationsPage] Erreur markAllAsRead:', err);
      fetchNotifications();
    } finally {
      setIsMarkingAll(false);
    }
  };

  const markSingleAsRead = async (id: string) => {
    // Optimistic UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, status: 'READ' } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    } catch (err) {
      console.error('[NotificationsPage] Erreur markSingleAsRead:', err);
    }
  };

  const filteredNotifs = notifications.filter((n) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'UNREAD') return !n.isRead;
    return n.type === filterType;
  });

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'KYC':
        return <FileText size={18} className="text-amber-500" />;
      case 'PAYMENT':
        return <DollarSign size={18} className="text-emerald-500" />;
      case 'TICKET':
        return <Ticket size={18} className="text-[#FF5722]" />;
      case 'REFERRAL':
        return <Gift size={18} className="text-purple-500" />;
      case 'SECURITY':
        return <Shield size={18} className="text-red-500" />;
      default:
        return <Bell size={18} className="text-blue-500" />;
    }
  };

  const formatRelativeTime = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMin < 1) return 'À l’instant';
      if (diffMin < 60) return `Il y a ${diffMin} min`;
      if (diffHours < 24) return `Il y a ${diffHours} h`;
      if (diffDays === 1) return 'Hier';
      if (diffDays < 7) return `Il y a ${diffDays} jours`;
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] text-xs font-black mb-2">
            <Sparkles size={13} />
            <span>Centre de Notifications Événementielles</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Bell className="text-[#FF5722]" size={28} />
            <span>Vos Notifications In-App</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Mises à jour en direct : candidatures, réservations, billetterie et versements SamirPay.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchNotifications}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw size={14} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={markAllAsRead}
              disabled={isMarkingAll}
              className="bg-[#FF5722] hover:bg-[#E8551F] text-white text-xs font-bold shadow-xs"
            >
              <CheckCheck size={14} className="mr-1" />
              Tout marquer comme lu ({unreadCount})
            </Button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'ALL', label: `Toutes (${notifications.length})` },
          { id: 'UNREAD', label: `Non lues (${unreadCount})` },
          { id: 'KYC', label: 'Candidatures & KYC' },
          { id: 'TICKET', label: 'Billetterie' },
          { id: 'PAYMENT', label: 'Paiements' },
          { id: 'REFERRAL', label: 'Parrainage' },
          { id: 'SYSTEM', label: 'Système' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterType(f.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              filterType === f.id
                ? 'bg-[#FF5722] text-white border-[#FF5722] shadow-xs'
                : 'bg-white dark:bg-[#1E1E1E] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste des Notifications */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw size={24} className="animate-spin mx-auto text-[#FF5722]" />
          <p className="text-xs text-slate-400 dark:text-zinc-500">Chargement de vos notifications réelles...</p>
        </div>
      ) : filteredNotifs.length > 0 ? (
        <div className="space-y-3">
          {filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                notif.isRead
                  ? 'bg-white dark:bg-[#1E1E1E] border-slate-200/80 dark:border-zinc-800'
                  : 'bg-orange-50/50 dark:bg-orange-950/20 border-[#FF5722]/30 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getNotifIcon(notif.type)}
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      {notif.title}
                    </h3>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#FF5722] animate-pulse flex-shrink-0" />
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold uppercase">
                      {notif.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {notif.content}
                  </p>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500 block">
                    {formatRelativeTime(notif.createdAt)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                {!notif.isRead && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => markSingleAsRead(notif.id)}
                    className="text-xs"
                  >
                    Marquer lu
                  </Button>
                )}

                {notif.metadata?.actionUrl && (
                  <Link href={notif.metadata.actionUrl}>
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-[#FF5722] hover:bg-[#E8551F] text-white text-xs font-bold"
                    >
                      <span>Consulter</span>
                      <ChevronRight size={14} className="ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Aucune notification"
          description={
            filterType === 'UNREAD'
              ? 'Toutes vos notifications ont été lues.'
              : 'Votre journal de notifications est vide pour le moment.'
          }
        />
      )}
    </div>
  );
}
