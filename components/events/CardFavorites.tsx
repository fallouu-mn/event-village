'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { lightVibration } from '@/lib/ui/haptics';
import { FAV_ATTR, takePendingFavorite } from './fav-pending';

/** Durée du rebond du cœur (classe ev-fav-pop, app/globals.css). */
const POP_MS = 260;

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };

function setPressed(id: string, on: boolean): void {
  document.querySelectorAll<HTMLElement>(`[${FAV_ATTR}="${CSS.escape(id)}"]`).forEach((el) => {
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

/**
 * Design 1d (point 8) — UN SEUL îlot par page pour tous les cœurs des favoris (cartes et fiche), comme CardTransitions
 * et CardLiveBadges : aucune carte n'hydrate de composant.
 *  - Compte connecté : ses favoris sont lus une fois après l'affichage (GET /api/favorites, compte de la session), puis
 *    reportés sur chaque cœur, y compris les cartes ajoutées plus tard (« Voir plus », « Près de chez vous »).
 *  - Toucher : visiteur → connexion, puis retour à la page ; compte connecté → cœur rempli tout de suite (rebond de
 *    260 ms, vibration légère à l'ajout), enregistré par PUT ou DELETE /api/favorites/<id> ; refus ou panne : le cœur
 *    revient à son état et un message le dit.
 */
export function CardFavorites() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const ids = useRef<Set<string>>(new Set());
  const userId = useRef<string | null>(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  userId.current = user?.id ?? null;
  const toggleRef = useRef<((button: HTMLElement) => void) | null>(null);

  // Favoris du compte reportés sur les cœurs de la page
  useEffect(() => {
    if (isLoading) return undefined;
    const paint = (): void => {
      document.querySelectorAll<HTMLElement>(`[${FAV_ATTR}]`).forEach((el) => {
        const on = ids.current.has(el.getAttribute(FAV_ATTR) ?? '');
        if ((el.getAttribute('aria-pressed') === 'true') !== on) el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    };
    if (!user) {
      ids.current = new Set();
      paint();
      return undefined;
    }
    let cancelled = false;
    let frame = 0;
    const w = window as IdleWindow;
    const load = async (): Promise<void> => {
      try {
        const res = await fetch('/api/favorites', { cache: 'no-store' });
        if (!res.ok) throw new Error(`réponse ${res.status}`);
        const body = (await res.json()) as { ids?: unknown };
        if (cancelled) return;
        ids.current = new Set(Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : []);
        paint();
      } catch (err) {
        console.warn('[favoris] cœurs non mis à jour :', err instanceof Error ? err.message : String(err));
      }
    };
    const hasIdle = typeof w.requestIdleCallback === 'function' && typeof w.cancelIdleCallback === 'function';
    const idle = hasIdle ? w.requestIdleCallback!(() => void load()) : window.setTimeout(() => void load(), 200);
    const observer = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; paint(); });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      if (hasIdle) w.cancelIdleCallback!(idle);
      else window.clearTimeout(idle);
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [user, isLoading]);

  // Touchers des cœurs (délégation)
  useEffect(() => {
    const pending = new Set<string>();
    const onClick = (e: MouseEvent): void => {
      const button = (e.target as Element | null)?.closest?.<HTMLElement>(`[${FAV_ATTR}]`);
      if (!button) return;
      e.preventDefault();
      e.stopPropagation();
      toggle(button);
    };
    const toggle = (button: HTMLElement): void => {
      const id = button.getAttribute(FAV_ATTR);
      if (!id || pending.has(id)) return;
      if (!userId.current) {
        router.push(`/login?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`);
        return;
      }
      const on = !ids.current.has(id);
      if (on) ids.current.add(id);
      else ids.current.delete(id);
      setPressed(id, on);
      if (on) {
        lightVibration();
        button.classList.remove('ev-fav-pop');
        void button.offsetWidth;
        button.classList.add('ev-fav-pop');
        window.setTimeout(() => button.classList.remove('ev-fav-pop'), POP_MS + 40);
      }
      pending.add(id);
      void (async () => {
        let message: string | null = null;
        try {
          const res = await fetch(`/api/favorites/${encodeURIComponent(id)}`, { method: on ? 'PUT' : 'DELETE' });
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
            message = typeof body?.error === 'string' ? body.error : 'Le favori n’a pas pu être enregistré. Réessayez.';
          }
        } catch (err) {
          console.warn('[favoris] enregistrement impossible :', err instanceof Error ? err.message : String(err));
          message = 'Pas de connexion : le favori n’a pas été enregistré. Réessayez.';
        } finally {
          pending.delete(id);
        }
        if (message) {
          if (on) ids.current.delete(id);
          else ids.current.add(id);
          setPressed(id, !on);
          toastRef.current.error(message);
        } else if (on) {
          toastRef.current.success('Ajouté à vos favoris.');
        }
      })();
    };
    toggleRef.current = toggle;
    document.addEventListener('click', onClick);
    return () => {
      toggleRef.current = null;
      document.removeEventListener('click', onClick);
    };
  }, [router]);

  // Un toucher arrivé avant l'îlot (CardFavoritesLazy, fav-pending) est rejoué une fois la session connue ; cet effet est
  // déclaré APRÈS celui des touchers, qui pose toggleRef
  useEffect(() => {
    if (isLoading) return;
    const button = takePendingFavorite();
    if (button) toggleRef.current?.(button);
  }, [isLoading]);

  return null;
}
