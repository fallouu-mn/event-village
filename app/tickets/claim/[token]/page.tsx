'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  UserCheck,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  LogIn,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { TransferExplainerModal } from '@/components/tickets/TransferExplainerModal';

interface ClaimPageProps {
  params: {
    token: string;
  };
}

export default function ClaimTicketPage({ params }: ClaimPageProps) {
  const router = useRouter();
  const toast = useToast();
  const { user, profile, isAuthenticated, isLoading: isAuthLoading, session } = useAuth();

  const token = params.token;

  const [isLoading, setIsLoading] = useState(true);
  const [claimData, setClaimData] = useState<any | null>(null);
  const [errorState, setErrorState] = useState<{
    message: string;
    expired?: boolean;
    alreadyClaimed?: boolean;
    cancelled?: boolean;
  } | null>(null);

  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<any | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);

  // 1. Charger les informations publiques du transfert
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const fetchClaimInfo = async () => {
      try {
        setIsLoading(true);
        setErrorState(null);

        const res = await fetch(`/api/tickets/claim/${token}`);
        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.success && data.transfer) {
          setClaimData(data.transfer);
        } else {
          setErrorState({
            message: data.error || 'Impossible de charger ce transfert.',
            expired: data.expired || false,
            alreadyClaimed: data.already_claimed || false,
            cancelled: data.cancelled || false,
          });
        }
      } catch (err) {
        if (isMounted) {
          setErrorState({
            message: 'Connexion impossible. Vérifiez votre accès réseau.',
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchClaimInfo();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Décompte d'expiration (TTL 48h)
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!claimData?.expires_at) return;

    const targetTime = new Date(claimData.expires_at).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        setErrorState({
          message: 'Ce lien de transfert a expiré. Le billet a été retourné à l\'expéditeur.',
          expired: true,
        });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [claimData?.expires_at]);

  // 3. Action de réclamation du billet
  const handleClaim = async () => {
    if (!isAuthenticated) {
      const redirectUrl = `/tickets/claim/${token}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    setIsClaiming(true);
    try {
      const res = await fetch(`/api/tickets/claim/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setClaimSuccess(data.claim);
        toast.success('Billet réclamé avec succès ! Nouveau QR code généré.');
      } else {
        toast.error(data.error || 'Erreur lors de la réclamation du billet.');
        setErrorState({
          message: data.error || 'Impossible de réclamer ce billet.',
          alreadyClaimed: data.error?.includes('déjà été réclamé'),
        });
      }
    } catch {
      toast.error('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setIsClaiming(false);
    }
  };

  const formattedEventDate = useMemo(() => {
    if (!claimData?.event?.start_date) return '';
    try {
      const d = new Date(claimData.event.start_date);
      return d.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return claimData.event.start_date;
    }
  }, [claimData?.event?.start_date]);

  // Rendu : Chargement
  if (isLoading || isAuthLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 bg-white dark:bg-[#16161A] border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-xl space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-6 w-3/4 rounded-lg" />
          <Skeleton className="h-4 w-1/2 rounded-lg" />
          <Skeleton className="h-12 w-full rounded-2xl mt-4" />
        </div>
      </div>
    );
  }

  // Rendu : ÉTAT DE SUCCÈS APRÈS RÉCLAMATION
  if (claimSuccess) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-white dark:bg-[#16161A] border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-center space-y-6"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={44} className="stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              <Sparkles size={13} /> Billet 100% à vous
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Félicitations !
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
              Le billet pour <strong className="text-slate-900 dark:text-white">{claimSuccess.event_title || 'l\'événement'}</strong> est maintenant enregistré sur votre compte personnel.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-zinc-400">N° de Billet :</span>
              <span className="font-mono font-black text-slate-900 dark:text-white">
                {claimSuccess.ticket_number}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-zinc-400">Sécurité :</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck size={13} /> QR Code dynamique activé
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => router.push('/tickets')}
            rightIcon={<ArrowRight size={16} />}
          >
            Accéder à mon portefeuille de billets
          </Button>
        </motion.div>
      </div>
    );
  }

  // Rendu : ÉTAT D'ERREUR (Expiré, Annulé, Déjà réclamé ou Invalide)
  if (errorState || !claimData) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white dark:bg-[#16161A] border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 sm:p-8 text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
            {errorState?.expired ? (
              <Clock size={32} />
            ) : errorState?.cancelled ? (
              <XCircle size={32} />
            ) : (
              <AlertTriangle size={32} />
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              {errorState?.expired
                ? 'Lien de transfert expiré'
                : errorState?.cancelled
                ? 'Transfert annulé par l\'expéditeur'
                : errorState?.alreadyClaimed
                ? 'Billet déjà réclamé'
                : 'Transfert introuvable'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
              {errorState?.message || 'Ce lien de transfert n\'est plus actif ou valide.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link href="/tickets">
              <Button variant="secondary" size="md" fullWidth>
                Voir mes billets
              </Button>
            </Link>
            <Link href="/explore">
              <Button variant="primary" size="md" fullWidth>
                Explorer les événements
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // Rendu : PAGE DE RÉCLAMATION OFFICIELLE
  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-white dark:bg-[#16161A] border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* En-tête Cadeau */}
        <div className="bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] p-4 text-white text-center flex items-center justify-center gap-2">
          <Gift size={18} className="animate-bounce" />
          <span className="text-xs font-black tracking-wide uppercase">
            Vous avez reçu un billet officiel Event Village !
          </span>
        </div>

        {/* Visuel & Carte Événement */}
        <div className="relative w-full h-52 bg-slate-950 overflow-hidden">
          <Image
            src={
              claimData.event.image_url ||
              'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80'
            }
            alt={claimData.event.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

          {/* Badge Expéditeur */}
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/90 dark:bg-black/80 backdrop-blur-md text-slate-900 dark:text-white shadow-md">
              <Gift size={13} className="text-[#FF5722]" />
              <span>Transféré par <strong>{claimData.sender_name_masked}</strong></span>
            </span>
          </div>

          {/* Titre & Catégorie */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <span className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-[#FF5722] text-white uppercase tracking-wider mb-1">
              {claimData.ticket.category_name}
            </span>
            <h1 className="text-xl font-black tracking-tight leading-tight">
              {claimData.event.title}
            </h1>
          </div>
        </div>

        {/* Détails du Billet & Événement */}
        <div className="p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <Calendar size={15} className="text-[#FF5722] mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Date</span>
                <p className="font-bold text-slate-900 dark:text-white capitalize mt-0.5">
                  {formattedEventDate || 'Date à confirmer'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Clock size={15} className="text-[#FF5722] mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Heure</span>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {claimData.event.start_time ? claimData.event.start_time.substring(0, 5) : '20:00'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 col-span-2">
              <MapPin size={15} className="text-[#FF5722] mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Lieu</span>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                  {claimData.event.location}, {claimData.event.city}
                </p>
              </div>
            </div>
          </div>

          {/* Décompte de validité */}
          {timeLeft && (
            <div className="p-3.5 rounded-2xl bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                <Clock size={16} className="text-[#FF5722]" />
                <span>Temps restant pour réclamer :</span>
              </div>
              <div className="font-mono font-black text-[#FF5722] text-sm">
                {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
              </div>
            </div>
          )}

          {/* Destinataire Masqué & Vérification */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
                Destiné au numéro / email
              </span>
              <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                {claimData.recipient_target_masked}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={14} /> Sécurisé
            </span>
          </div>

          {/* Si NON CONNECTÉ : Invitation à la connexion */}
          {!isAuthenticated ? (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                <LogIn size={15} />
                <span>Connexion requise pour recevoir ce billet</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                Connectez-vous ou créez votre compte gratuit en 10 secondes avec votre numéro pour attribuer le billet à votre portefeuille.
              </p>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => {
                  const redirectUrl = `/tickets/claim/${token}`;
                  router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
                }}
                leftIcon={<LogIn size={15} />}
              >
                Se connecter pour accepter le billet
              </Button>
            </div>
          ) : (
            /* Si CONNECTÉ : Bouton Réclamer Immédiat */
            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleClaim}
                isLoading={isClaiming}
                leftIcon={<UserCheck size={18} />}
              >
                {isClaiming ? 'Réclamation en cours...' : 'Accepter & Ajouter à mes billets'}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500 text-center">
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>Le QR Code sera immédiatement synchronisé sur votre profil.</span>
              </div>
            </div>
          )}

          {/* Bouton d'explications */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setIsExplainerOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-[#FF5722] dark:hover:text-[#FF5722] transition-colors"
            >
              <HelpCircle size={13} />
              <span>Comment fonctionne la sécurité du billet ?</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Modale d'explication pédagogique & FAQ */}
      <TransferExplainerModal
        isOpen={isExplainerOpen}
        onClose={() => setIsExplainerOpen(false)}
      />
    </div>
  );
}
