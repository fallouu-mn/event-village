'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Radio,
  Send,
  Users,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CampaignItem {
  id: string;
  title: string;
  message: string;
  sender_profile: string;
  target_audience: string;
  channels: string[];
  status: string;
  recipient_count: number;
  delivered_count: number;
  created_at: string;
  sent_at?: string;
}

export default function AdminCommunicationsPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Formulaire Campagne
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [senderProfile, setSenderProfile] = useState('Event Village Info');
  const [targetAudience, setTargetAudience] = useState('ALL_CLIENTS');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['SMS']);

  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/communications');
      const data = await res.json();
      if (res.ok && data.campaigns) {
        setCampaigns(data.campaigns);
      }
    } catch (err) {
      console.error('[AdminCommunications] Erreur chargement:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          senderProfile,
          targetAudience,
          channels: selectedChannels,
          sendNow: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'envoi.');

      setFeedback({
        type: 'success',
        text: `Campagne diffusée avec succès auprès de ${data.deliveredCount || data.recipientCount} destinataires.`,
      });
      setTitle('');
      setMessage('');
      await fetchCampaigns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la diffusion.';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF5722]">
              Console Superadmin HQ
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Diffusion & Campagnes de Communication (§121-§126)
            </h1>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchCampaigns()}
          disabled={isLoading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </Button>
      </div>

      {/* Message Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {/* Formulaire de Nouvelle Campagne */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-zinc-800 pb-3">
          <Radio size={20} className="text-[#FF5722]" />
          <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Diffuser une Nouvelle Communication
          </h2>
        </div>

        <form onSubmit={handleSendCampaign} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">
                Titre de la Campagne
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Soirée de Gala ou Mise à jour de sécurité"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">
                Profil Expéditeur Officiel (§125)
              </label>
              <select
                value={senderProfile}
                onChange={(e) => setSenderProfile(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 font-bold text-xs"
              >
                <option value="Event Village Info">Event Village Info (Actualités & Événements)</option>
                <option value="Event Village Sénégal">Event Village Sénégal (Annonces Nationales)</option>
                <option value="Support Officiel">Support Officiel (Transactions & Sécurité)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">
                Ciblage / Audience (§122)
              </label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 font-bold text-xs"
              >
                <option value="ALL_CLIENTS">Tous les Clients Inscrits</option>
                <option value="ALL_PARTNERS">Tous les Partenaires Professionnels</option>
                <option value="AMBASSADORS">Ambassadeurs VIP Uniquement</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">
                Canaux de Diffusion
              </label>
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes('SMS')}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedChannels([...selectedChannels, 'SMS']);
                      else setSelectedChannels(selectedChannels.filter((c) => c !== 'SMS'));
                    }}
                    className="rounded text-[#FF5722]"
                  />
                  <span>SMS (MTarget)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes('EMAIL')}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedChannels([...selectedChannels, 'EMAIL']);
                      else setSelectedChannels(selectedChannels.filter((c) => c !== 'EMAIL'));
                    }}
                    className="rounded text-[#FF5722]"
                  />
                  <span>Email</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">
              Contenu du Message (Modération automatique active)
            </label>
            <textarea
              required
              rows={4}
              placeholder="Rédigez votre message ici. Tout contenu offensant sera automatiquement bloqué."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-[#FF5722]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isSending}
              className="bg-[#FF5722] text-white flex items-center gap-1.5"
            >
              <Send size={14} />
              <span>Diffuser la Campagne</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Historique des Campagnes */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
          Historique des Diffusions
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <RefreshCw size={24} className="animate-spin mx-auto text-[#FF5722] mb-2" />
            <p className="text-xs">Chargement des campagnes...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <MessageSquare size={32} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
            <p className="text-xs font-bold">Aucune campagne diffusée pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-slate-900 dark:text-white">{camp.title}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/40 text-[#FF5722]">
                      {camp.sender_profile}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {camp.target_audience}
                    </span>
                  </div>

                  <span className="text-slate-400 font-mono text-[11px]">
                    {formatDate(camp.created_at)}
                  </span>
                </div>

                <p className="text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800/80 p-3 rounded-xl border border-slate-200/60 dark:border-zinc-700/60">
                  {camp.message}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-bold text-emerald-600">
                    Statut : {camp.status} ({camp.delivered_count || camp.recipient_count} livrés)
                  </span>
                  <span>Canaux : {camp.channels?.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
