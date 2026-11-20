'use client';

/**
 * Design 1b (point 8, contrat avec le lot FICHE) — petite fête après un achat réussi (`/tickets?tab=a-venir&fete=1`),
 * chargée à la demande, seulement quand le paramètre est là.
 *  - Annonce « Vos billets sont là. » par le système de toasts (zone `status` lue par les lecteurs d'écran), toujours.
 *  - Gerbe de confettis : 300 ms de mouvement (déplacement et transparence seulement, API Web Animations), calque fixe
 *    sans pointeur (n'empêche aucun toucher, ne décale rien : aucun saut de mise en page) ; rien du tout si le téléphone
 *    demande de réduire les animations.
 *  - Une seule fois : `onDone` retire le paramètre de l'adresse (la page s'en charge).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { lightVibration } from '@/lib/ui/haptics';

const PIECES = [
  { color: 'bg-brand-vif', dx: -96, dy: -64 },
  { color: 'bg-scan-cat-turquoise-bg', dx: -48, dy: -104 },
  { color: 'bg-primary', dx: 8, dy: -116 },
  { color: 'bg-scan-cat-rose-bg', dx: 60, dy: -96 },
  { color: 'bg-brand-vif', dx: 104, dy: -56 },
  { color: 'bg-scan-cat-violet-bg', dx: -72, dy: -20 },
  { color: 'bg-scan-cat-bleu-bg', dx: 84, dy: -12 },
  { color: 'bg-primary', dx: -20, dy: -72 },
];

export const CELEBRATION_MESSAGE = 'Vos billets sont là.';
const MOTION_MS = 300;

export function PurchaseCelebration({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [burst, setBurst] = useState(false);
  const piecesRef = useRef<Array<HTMLSpanElement | null>>([]);
  const announcedRef = useRef(false);

  // Au montage (la page ne monte ce composant qu'avec ?fete=1, puis retire le paramètre) ; annonce une seule fois, même
  // quand React rejoue l'effet en développement.
  useEffect(() => {
    if (!announcedRef.current) {
      announcedRef.current = true;
      toastRef.current.success(CELEBRATION_MESSAGE);
      // Design 1d (point 10) : vibration légère à l'achat confirmé (téléphones qui le permettent)
      lightVibration();
    }
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      doneRef.current();
      return;
    }
    setBurst(true);
    const timer = window.setTimeout(() => {
      setBurst(false);
      doneRef.current();
    }, MOTION_MS + 100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!burst) return;
    const animations = piecesRef.current.map((el, i) => {
      if (!el || typeof el.animate !== 'function') return null;
      const p = PIECES[i];
      return el.animate(
        [
          { transform: 'translate(0, 0) scale(0.6)', opacity: 1 },
          { transform: `translate(${p.dx}px, ${p.dy}px) scale(1)`, opacity: 0 },
        ],
        { duration: MOTION_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
      );
    });
    return () => animations.forEach((a) => a?.cancel());
  }, [burst]);

  if (!burst) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed bottom-40 left-1/2 z-50 h-0 w-0">
      {PIECES.map((p, i) => (
        <span
          key={i}
          ref={(el) => { piecesRef.current[i] = el; }}
          className={`absolute h-2.5 w-2.5 rounded-sm ${p.color}`}
        />
      ))}
    </div>
  );
}
