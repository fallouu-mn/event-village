'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/** Retour automatique au suivi : le code ne reste pas affiché en grand sur un téléphone posé. */
const AUTO_RETURN_S = 90;

interface WakeLockLike {
    release: () => Promise<void>;
}
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> } };

/**
 * Lot 12b, correctifs après contre-vérification (idée 11) — « Montrer au comptoir » : le code de remise en très grand,
 * plein écran (Modal du projet : focus, Échap et défilement figé), l'écran gardé allumé quand le navigateur le permet
 * (Wake Lock, rendu à la fermeture et repris au retour sur l'onglet), retour automatique au suivi après 90 s, Échap ou
 * « Fermer ». Aucune copie proposée (texte non
 * sélectionnable, ni copie ni menu contextuel) ; le code ne vit que dans l'état du composant parent (HandoverCode) :
 * jamais dans le stockage du navigateur, l'adresse de la page ni la console.
 */
export function CounterCode({ code, venueName, forCourier = false, onClose }: { code: string; venueName: string | null; forCourier?: boolean; onClose: () => void }) {
    const [left, setLeft] = useState(AUTO_RETURN_S);
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Écran gardé allumé (navigateurs qui le permettent ; sinon l'écran suit son réglage)
    useEffect(() => {
        let lock: WakeLockLike | null = null;
        let gone = false;
        const request = async () => {
            const api = (navigator as WakeLockNavigator).wakeLock;
            if (!api || document.visibilityState !== 'visible') return;
            try {
                const next = await api.request('screen');
                if (gone) void next.release().catch(() => undefined);
                else lock = next;
            } catch {
                // refusé (économie d'énergie, onglet caché) : rien à faire
            }
        };
        void request();
        const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            gone = true;
            document.removeEventListener('visibilitychange', onVisible);
            if (lock) void lock.release().catch(() => undefined);
        };
    }, []);

    // Retour automatique (Échap et focus : Modal)
    useEffect(() => {
        const timer = window.setInterval(() => setLeft((s) => s - 1), 1000);
        return () => window.clearInterval(timer);
    }, []);
    useEffect(() => {
        if (left <= 0) onCloseRef.current();
    }, [left]);

    const block = (e: React.SyntheticEvent) => e.preventDefault();
    return (
        <Modal isOpen onClose={() => onCloseRef.current()} fullScreen title="Code de remise" subtitle={venueName ?? undefined}>
            <div
                data-testid="mode-comptoir"
                className="flex min-h-full select-none flex-col items-center justify-center gap-6 px-5 py-8 text-center [-webkit-touch-callout:none]"
                onCopy={block}
                onCut={block}
                onContextMenu={block}
            >
                <p className="sr-only">{`Code : ${code.split('').join(' ')}`}</p>
                <div className="flex justify-center gap-[3vw] sm:gap-4" aria-hidden="true">
                    {code.split('').map((digit, i) => (
                        <span
                            key={i}
                            className="flex aspect-[3/4] w-[20vw] max-w-36 items-center justify-center rounded-3xl border-4 border-primary bg-card text-[clamp(3.5rem,17vw,8rem)] font-extrabold leading-none tabular-nums text-foreground-strong shadow-md"
                        >
                            {digit}
                        </span>
                    ))}
                </div>
                <p className="max-w-sm text-base text-foreground">{forCourier ? 'Montrez cet écran au livreur : il saisit ces 4 chiffres.' : 'Montrez cet écran au comptoir : la personne saisit ces 4 chiffres.'}</p>
                <Button autoFocus variant="secondary" size="lg" leftIcon={<X size={20} />} onClick={() => onCloseRef.current()}>
                    Fermer
                </Button>
                <p className="text-sm tabular-nums text-muted-foreground">{`Retour automatique dans ${Math.max(left, 0)} s`}</p>
            </div>
        </Modal>
    );
}
