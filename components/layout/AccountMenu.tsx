'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LogIn, LogOut, UserRound, type LucideIcon } from 'lucide-react';
import Link from '@/components/ui/IntentLink';
import { cn } from '@/components/ui/cn';

export interface AccountMenuLink {
  name: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Design 1e (point 3) — menu du compte de l'en-tête de l'ordinateur (≥ 1024 px) : il s'ouvre en glissant (translation et
 * fondu, 200 ms). Bouton à état (aria-expanded) et liste de liens ; Échap ou un clic ailleurs le ferment, le focus revient au
 * bouton ; refermé à chaque changement de page. Sans compte : « Se connecter » et les mêmes services.
 */
export function AccountMenu({
  pathname,
  loggedIn,
  avatar,
  displayName,
  subtitle,
  sections,
  onSignOut,
  themeToggle,
  compact = false,
}: {
  pathname: string;
  loggedIn: boolean;
  avatar: React.ReactNode;
  displayName: string;
  subtitle: string;
  sections: Array<{ label: string; items: AccountMenuLink[] }>;
  onSignOut: () => void;
  themeToggle: React.ReactNode;
  /**
   * Design 1e (décision du 21/11) : espaces organisatrice et administration : bouton réduit à l'avatar (44 × 44 px, nom
   * accessible gardé) ; un bouton large y passait au-dessus des cibles du haut de page quand la page défilait.
   */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  // Run 540 : le panneau fermé n'est plus dans la page (il restait invisible sous l'en-tête, à droite, et axe le comptait
  // comme masquant les cibles en dessous) ; présent à l'ouverture, retiré après son animation de fermeture (200 ms)
  const [present, setPresent] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) { setPresent(true); return undefined; }
    setShown(false);
    const timer = window.setTimeout(() => setPresent(false), 220);
    return () => window.clearTimeout(timer);
  }, [open]);
  useEffect(() => {
    if (!open || !present) return undefined;
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, [open, present]);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const linkClass = 'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground-strong transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div ref={rootRef} className="relative hidden lg:block">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={present ? panelId : undefined}
        data-ev-account=""
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex min-h-11 items-center rounded-full border border-border bg-background text-sm font-semibold text-foreground-strong transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact ? 'h-11 w-11 justify-center' : 'gap-2 py-0.5 pl-0.5 pr-3',
        )}
      >
        {loggedIn ? avatar : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary-text"><UserRound size={18} aria-hidden="true" /></span>}
        <span className={compact ? 'sr-only' : 'max-w-[12rem] break-words text-left leading-tight'}>{loggedIn ? displayName : 'Mon compte'}</span>
        {!compact && <ChevronDown size={16} aria-hidden="true" className={cn('transition-transform duration-200', open && 'rotate-180')} />}
      </button>
      {present && <div
        id={panelId}
        data-open={shown ? '' : undefined}
        className={cn(
          'ev-account-menu absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-border bg-popover p-2 shadow-lg',
          shown ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0',
        )}
      >
        {loggedIn && (
          <div className="flex items-center gap-3 border-b border-border px-3 pb-3 pt-2">
            {avatar}
            <span className="min-w-0 leading-tight">
              <span className="block break-words text-sm font-semibold text-foreground-strong">{displayName}</span>
              <span className="block break-words text-sm text-muted-foreground">{subtitle}</span>
            </span>
          </div>
        )}
        <div className="flex flex-col gap-3 py-2">
          {!loggedIn && (
            <Link href="/login" prefetch={false} className={cn(linkClass, 'font-semibold text-primary-text')}>
              <LogIn size={18} aria-hidden="true" />
              Se connecter
            </Link>
          )}
          {loggedIn && (
            <Link href="/profile" className={linkClass}>
              <UserRound size={18} aria-hidden="true" className="text-muted-foreground" />
              Mon profil
            </Link>
          )}
          {sections.filter((s) => s.items.length > 0).map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-1 text-sm font-semibold text-muted-foreground">{section.label}</p>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className={linkClass}>
                    <Icon size={18} aria-hidden="true" className="text-muted-foreground" />
                    <span className="min-w-0 break-words">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-1 pt-2">
          {themeToggle}
          {loggedIn && (
            <button type="button" onClick={onSignOut} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-danger-text transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <LogOut size={18} aria-hidden="true" />
              Se déconnecter
            </button>
          )}
        </div>
      </div>}
    </div>
  );
}
