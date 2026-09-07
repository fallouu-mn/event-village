'use client';

import React, { useEffect } from 'react';
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    Banknote,
    WifiOff,
    Volume2,
} from 'lucide-react';
import type { CombatFeedbackType } from '@/lib/hardware/feedback';
import { hasWolofAudio, normalizeWolofAudioType, WOLOF_AUDIO_MESSAGES } from '@/lib/hardware/wolof-audio';

export interface CombatFlashOverlayProps {
    status: CombatFeedbackType | null;
    message?: string;
    holderName?: string;
    category?: string;
    ticketNumber?: string;
    durationMs?: number;
    onDismiss?: () => void;
    onRepeatWolof?: () => void;
    showRepeatWolof?: boolean;
}

/**
 * Configuration visuelle des statuts de combat (couleurs, titres et icônes)
 */
export function getCombatFlashConfig(status: CombatFeedbackType | null) {
    if (!status) return null;

    switch (status) {
        case 'valid':
            return {
                bgClass: 'bg-emerald-600',
                title: 'ACCÈS AUTORISÉ',
                Icon: CheckCircle2,
            };
        case 'already_used':
            return {
                bgClass: 'bg-red-600',
                title: 'BILLET DÉJÀ UTILISÉ',
                Icon: XCircle,
            };
        case 'invalid':
            return {
                bgClass: 'bg-red-600',
                title: 'BILLET INVALIDE',
                Icon: XCircle,
            };
        case 'wrong_event':
            return {
                bgClass: 'bg-amber-600',
                title: 'MAUVAIS ÉVÉNEMENT',
                Icon: AlertTriangle,
            };
        case 'qr_expired':
            return {
                bgClass: 'bg-amber-500',
                title: 'QR CODE EXPIRÉ',
                Icon: Clock,
            };
        case 'cash_required':
            return {
                bgClass: 'bg-blue-600',
                title: 'ENCAISSEMENT ESPÈCES',
                Icon: Banknote,
            };
        case 'network_error':
            return {
                bgClass: 'bg-slate-700',
                title: 'VÉRIFICATION IMPOSSIBLE',
                Icon: WifiOff,
            };
        case 'alert':
            return {
                bgClass: 'bg-amber-500',
                title: 'ATTENTION',
                Icon: AlertTriangle,
            };
        case 'reject':
        default:
            return {
                bgClass: 'bg-red-600',
                title: 'ACCÈS REFUSÉ',
                Icon: XCircle,
            };
    }
}

/**
 * Overlay de Flash Plein Écran Haute Visibilité (Combat UX)
 * Permet au contrôleur d'identifier le résultat du scan du coin de l'œil,
 * même dans la pénombre ou sous 110 dB de musique forte.
 */
export const CombatFlashOverlay: React.FC<CombatFlashOverlayProps> = ({
    status,
    message,
    holderName,
    category,
    ticketNumber,
    durationMs,
    onDismiss,
    onRepeatWolof,
    showRepeatWolof,
}) => {
    // Calcul de la durée par défaut : rapide pour succès (1000ms), étendu pour litiges avec bouton répéter (3500ms)
    const effectiveDuration = durationMs !== undefined
        ? durationMs
        : (status === 'valid' ? 1000 : 3500);

    useEffect(() => {
        if (!status) return;

        const timer = setTimeout(() => {
            if (onDismiss) onDismiss();
        }, effectiveDuration);

        return () => clearTimeout(timer);
    }, [status, effectiveDuration, onDismiss]);

    const config = getCombatFlashConfig(status);
    if (!config) return null;
    const { bgClass, title, Icon } = config;

    const wolofType = normalizeWolofAudioType(status);
    const hasWolofMessage = showRepeatWolof ?? (hasWolofAudio(status) && Boolean(onRepeatWolof));
    const wolofTranscription = wolofType ? WOLOF_AUDIO_MESSAGES[wolofType]?.wolof : null;

    return (
        <div
            data-testid="combat-flash-overlay"
            data-combat-status={status}
            onClick={onDismiss}
            className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 text-white text-center cursor-pointer select-none ${bgClass} animate-in fade-in zoom-in-95 duration-100 overflow-y-auto`}
            role="alert"
            aria-live="assertive"
        >
            {/* Icône Gigantesque */}
            <div className="mb-3 sm:mb-4 drop-shadow-md">
                <Icon size={84} strokeWidth={2.5} className="mx-auto sm:w-24 sm:h-24" />
            </div>

            {/* Titre Haute Visibilité */}
            <div className="inline-block px-4 sm:px-5 py-1 sm:py-1.5 rounded-full bg-white/20 backdrop-blur-xs text-xs sm:text-base font-black tracking-widest uppercase mb-3">
                {title}
            </div>

            {/* Nom du Porteur en taille MAXIMALE pour SUCCÈS */}
            {status === 'valid' && (
                <div className="space-y-2 max-w-4xl px-2">
                    <h1
                        data-testid="combat-holder-name"
                        className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight drop-shadow-xl break-words leading-none"
                    >
                        {holderName || 'PORTEUR VALIDÉ'}
                    </h1>
                    {(category || ticketNumber) && (
                        <p className="text-lg sm:text-2xl font-bold font-mono opacity-95 tracking-wide pt-2">
                            {[category, ticketNumber].filter(Boolean).join(' — ')}
                        </p>
                    )}
                </div>
            )}

            {/* Messages de Rejet / Doublon / Invalide */}
            {(status === 'already_used' || status === 'invalid' || status === 'reject') && (
                <div className="space-y-3 max-w-3xl px-2">
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight drop-shadow-xl leading-tight">
                        {message || (status === 'already_used' ? 'BILLET DÉJÀ UTILISÉ' : 'BILLET REFUSÉ')}
                    </h1>
                    {ticketNumber && (
                        <p className="text-base sm:text-xl font-mono opacity-90">
                            Billet : {ticketNumber}
                        </p>
                    )}
                </div>
            )}

            {/* Message Mauvais Événement */}
            {status === 'wrong_event' && (
                <div className="space-y-3 max-w-3xl px-2">
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight drop-shadow-xl leading-tight">
                        {message || 'CE BILLET N\'EST PAS POUR CET ÉVÉNEMENT'}
                    </h1>
                    {ticketNumber && (
                        <p className="text-base sm:text-xl font-mono opacity-90">
                            Billet : {ticketNumber}
                        </p>
                    )}
                </div>
            )}

            {/* Message QR Expiré */}
            {status === 'qr_expired' && (
                <div className="space-y-3 max-w-3xl px-2">
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight drop-shadow-xl leading-tight">
                        {message || 'QR CODE EXPIRÉ'}
                    </h1>
                    <p className="text-sm sm:text-lg font-medium opacity-90">
                        Demandez au spectateur de rafraîchir son écran.
                    </p>
                </div>
            )}

            {/* Message Encaissement Espèces */}
            {status === 'cash_required' && (
                <div className="space-y-3 max-w-3xl px-2">
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight drop-shadow-xl leading-tight">
                        {message || 'ENCAISSEMENT REQUIS'}
                    </h1>
                    {holderName && (
                        <p className="text-lg sm:text-2xl font-bold opacity-95">
                            Porteur : {holderName}
                        </p>
                    )}
                </div>
            )}

            {/* Message Erreur Réseau (Neutre, sans accuser le spectateur) */}
            {status === 'network_error' && (
                <div className="space-y-3 max-w-3xl px-2">
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight drop-shadow-xl leading-tight">
                        {message || 'VÉRIFICATION IMPOSSIBLE'}
                    </h1>
                    <p className="text-sm sm:text-base font-semibold opacity-90">
                        Connexion réseau instable. Vérifiez la couverture 4G/Wi-Fi et réessayez.
                    </p>
                </div>
            )}

            {/* Message Alerte Générique */}
            {status === 'alert' && (
                <div className="space-y-3 max-w-3xl px-2">
                    <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight drop-shadow-xl leading-tight">
                        {message || 'CONTRÔLE REQUIS'}
                    </h1>
                    {holderName && (
                        <p className="text-lg sm:text-2xl font-bold opacity-95">
                            Porteur : {holderName}
                        </p>
                    )}
                </div>
            )}

            {/* Transcription Wolof textuelle (Sous-titrage haute lisibilité) */}
            {wolofTranscription && (
                <div className="mt-3 px-3 py-1.5 rounded-xl bg-black/30 border border-white/20 max-w-lg">
                    <p className="text-xs sm:text-sm font-semibold tracking-wide text-amber-200 italic">
                        « {wolofTranscription} »
                    </p>
                </div>
            )}

            {/* Bouton "Répéter en Wolof" (Touch Target >= 48px, action prioritaire sur litige) */}
            {hasWolofMessage && onRepeatWolof && (
                <div className="mt-4 sm:mt-6 z-20" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        data-testid="repeat-wolof-btn"
                        onClick={onRepeatWolof}
                        className="px-6 py-3 rounded-2xl bg-white text-slate-900 font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-2xl hover:bg-slate-100 active:scale-95 transition-all min-h-[48px] touch-manipulation cursor-pointer border-2 border-white/90"
                        aria-label="Répéter l'explication en Wolof pour le spectateur"
                    >
                        <Volume2 size={20} className="text-[#FF5722] shrink-0" />
                        <span>🔊 Répéter en Wolof</span>
                    </button>
                </div>
            )}

            {/* Indication tactile pour enchaîner immédiatement */}
            <p className="mt-6 text-xs sm:text-sm font-semibold opacity-75 tracking-wider">
                Toucher l&apos;écran pour scanner le suivant immédiatement
            </p>
        </div>
    );
};
