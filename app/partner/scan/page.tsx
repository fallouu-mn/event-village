'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  Search,
  Keyboard,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CameraQrScanner } from '@/components/scan/CameraQrScanner';

export default function PartnerScanPage() {
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [stats, setStats] = useState<{ checkedInCount: number; totalExpected: number }>({
    checkedInCount: 0,
    totalExpected: 0,
  });
  const [scanHistory, setScanHistory] = useState<Array<{
    time: string;
    ticketNumber: string;
    holderName: string;
    status: 'valid' | 'already_used' | 'invalid';
  }>>([]);

  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'valid' | 'already_used' | 'invalid';
    message?: string;
    ticketInfo?: {
      ticketNumber: string;
      eventTitle: string;
      holderName: string;
      category: string;
      checkedInAt?: string;
    };
  }>({ status: 'idle' });

  // Pipeline de vérification unifié partagé par le scan Caméra ET la saisie Manuelle
  const handleVerifyTicket = async (code: string) => {
    const trimmed = (code || qrCodeInput).trim();
    if (!trimmed) return;

    setIsVerifying(true);
    try {
      const res = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: trimmed }),
      });

      const data = await res.json();
      setScanResult({
        status: data.status || 'invalid',
        message: data.message,
        ticketInfo: data.ticketInfo,
      });

      if (data.stats) {
        setStats({
          checkedInCount: data.stats.checkedInCount,
          totalExpected: data.stats.totalExpected,
        });
      }

      // Ajout à l'historique de session
      const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setScanHistory((prev) => [
        {
          time: nowStr,
          ticketNumber: data.ticketInfo?.ticketNumber || trimmed,
          holderName: data.ticketInfo?.holderName || 'Inconnu',
          status: data.status || 'invalid',
        },
        ...prev.slice(0, 9), // 10 derniers scans
      ]);
    } catch {
      setScanResult({
        status: 'invalid',
        message: 'Erreur réseau lors de la validation du billet.',
      });
    } finally {
      setIsVerifying(false);
      setQrCodeInput('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      {/* 1. Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <QrCode className="text-[#FF5722]" size={24} />
            <span>Contrôle &amp; Validation des Entrées</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Scannez les billets en temps réel via la caméra ou saisissez le code manuellement (§39-§40).
          </p>
        </div>

        <Link href="/partner/dashboard">
          <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={16} />}>
            Dashboard
          </Button>
        </Link>
      </div>

      {/* 2. Basculeur de Mode (Caméra / Manuel) */}
      <div className="flex items-center justify-center">
        <div className="p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center gap-1 shadow-xs">
          <button
            type="button"
            onClick={() => setScanMode('camera')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              scanMode === 'camera'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Camera size={15} className={scanMode === 'camera' ? 'text-[#FF5722]' : ''} />
            <span>Scanner Caméra</span>
          </button>
          <button
            type="button"
            onClick={() => setScanMode('manual')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              scanMode === 'manual'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Keyboard size={15} className={scanMode === 'manual' ? 'text-[#FF5722]' : ''} />
            <span>Saisie Manuelle</span>
          </button>
        </div>
      </div>

      {/* 3. Mode Actif : Caméra ou Saisie */}
      {scanMode === 'camera' ? (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-4">
          <CameraQrScanner
            onScan={handleVerifyTicket}
            isVerifying={isVerifying}
            onSwitchToManual={() => setScanMode('manual')}
          />
        </div>
      ) : (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-4 shadow-sm">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
              Numéro de billet ou token QR Code
            </label>
            <p className="text-[11px] text-slate-400">
              Saisissez ou collez le code présent sur le billet électronique ou imprimé.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ex : EV-QR-xxx ou TKT-xxx"
              value={qrCodeInput}
              onChange={(e) => setQrCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerifyTicket(qrCodeInput);
              }}
              className="flex-1 h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-mono font-bold focus:outline-none focus:border-[#FF5722]"
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => handleVerifyTicket(qrCodeInput)}
              isLoading={isVerifying}
              leftIcon={<Search size={16} />}
            >
              Vérifier
            </Button>
          </div>
        </div>
      )}

      {/* 4. Résultat de Validation (Affichage Immédiat) */}
      {scanResult.status !== 'idle' && (
        <div className="animate-in fade-in zoom-in-95 duration-200">
          {scanResult.status === 'valid' && (
            <div className="p-5 rounded-3xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-950 dark:text-emerald-200 flex items-start gap-4 shadow-md">
              <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  ✅ ACCÈS AUTORISÉ (BILLET COMPOSTÉ)
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  {scanResult.ticketInfo?.holderName}
                </h3>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {scanResult.ticketInfo?.category} • {scanResult.ticketInfo?.eventTitle}
                </p>
                <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1">
                  {scanResult.ticketInfo?.ticketNumber}
                </p>
              </div>
            </div>
          )}

          {scanResult.status === 'already_used' && (
            <div className="p-5 rounded-3xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-950 dark:text-amber-200 flex items-start gap-4 shadow-md">
              <AlertTriangle size={32} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  ⚠️ BILLET DÉJÀ COMPOSTÉ
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  {scanResult.ticketInfo?.holderName}
                </h3>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Composté le : {scanResult.ticketInfo?.checkedInAt}
                </p>
                <p className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1">
                  {scanResult.ticketInfo?.ticketNumber}
                </p>
              </div>
            </div>
          )}

          {scanResult.status === 'invalid' && (
            <div className="p-5 rounded-3xl bg-red-500/15 border-2 border-red-500/40 text-red-950 dark:text-red-200 flex items-start gap-4 shadow-md">
              <XCircle size={32} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                  ❌ TICKET INVALIDE OU INCONNU
                </span>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  {scanResult.message || 'Ce QR code ne correspond à aucun billet officiel enregistré dans la base Event Village.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. KPIs Contrôleur & Historique des Scans du Jour */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            Historique des Scans de la Session ({scanHistory.length})
          </h3>
          {stats.totalExpected > 0 && (
            <span className="text-xs font-bold text-[#FF5722]">
              {stats.checkedInCount} / {stats.totalExpected} validés
            </span>
          )}
        </div>

        {scanHistory.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 text-center text-xs text-slate-400 dark:text-zinc-500">
            Aucun scan effectué durant cette session.
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl border border-slate-200/80 dark:border-zinc-800 overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800/80">
            {scanHistory.map((item, idx) => (
              <div key={idx} className="p-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  {item.status === 'valid' ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : item.status === 'already_used' ? (
                    <AlertTriangle size={16} className="text-amber-500" />
                  ) : (
                    <XCircle size={16} className="text-red-500" />
                  )}
                  <div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {item.ticketNumber}
                    </span>
                    <span className="text-slate-400 text-[10px] block">
                      {item.holderName}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
