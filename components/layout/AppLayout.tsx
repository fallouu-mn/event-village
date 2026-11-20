'use client';

import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
// Design 1b (décision du 18/11) : liens préchargés à l'intention (survol, toucher, focus), pas à l'affichage
import Link from '@/components/ui/IntentLink';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  Ticket,
  ShoppingBag,
  User,
  LayoutDashboard,
  QrCode,
  Calendar,
  Wallet,
  Building2,
  Utensils,
  LogIn,
  LogOut,
  Briefcase,
  Users,
  DollarSign,
  Activity,
  ShieldCheck,
  ArrowLeft,
  X,
  Menu,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { cn } from '@/components/ui/cn';
import { useAuth } from '@/components/providers/AuthProvider';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { SEARCH_LAUNCH_ATTR, SEARCH_OPEN_EVENT, setPendingSearch } from '@/components/search/search-events';

// Design 1d (point 9) : lanceur de la recherche instantanée, monté au premier geste sur un déclencheur (searchWanted).
// React.lazy et non next/dynamic (run 504) : next/dynamic ajoute son moteur au JavaScript de CHAQUE page (budget de
// /billet/hors-ligne dépassé) ; même schéma que NavigationProgressDifferee. Morceau introuvable (hors ligne) : le lien
// garde son rôle, jamais d'erreur.
const SearchLauncher = lazy(() => import('@/components/search/SearchLauncher')
  .then((m): { default: React.ComponentType } => ({ default: m.SearchLauncher }))
  .catch((): { default: React.ComponentType } => ({ default: () => null })));
import { useFeatureFlags, type ClientFeatureFlags } from '@/lib/features/client';
import { isDeliverableEmail } from '@/lib/notifications/channels';

/** Interrupteur SUPERADMIN d'un service (features.halls_enabled, features.tables_enabled, features.orders_enabled). */
type FeatureKey = keyof ClientFeatureFlags;

export interface NavItem {
  name: string;
  /** Libellé de la barre du bas (< 1024 px), 60 px au plus en 12 px : tient sans troncature dès 360 px. */
  short?: string;
  href: string;
  icon: LucideIcon;
  /**
   * Lot 7 (7.3, D55) : entrée d'un service soumis à un interrupteur. Une liste : visible si l'un au moins est
   * ouvert (« Commandes » regroupe salles, tables et repas). Masquée tant que les interrupteurs ne sont pas lus.
   */
  feature?: FeatureKey | FeatureKey[];
}

/**
 * Entrée visible selon les interrupteurs lus par GET /api/features (useFeatureFlags) : une entrée de service
 * reste masquée tant que la réponse n'est pas arrivée (null), pour qu'aucune entrée n'apparaisse puis ne
 * disparaisse ; la page et la route répondent de toute façon 404 quand l'interrupteur est fermé.
 */
function isFeatureVisible(item: NavItem, flags: ClientFeatureFlags | null): boolean {
  if (!item.feature) return true;
  if (!flags) return false;
  const keys = Array.isArray(item.feature) ? item.feature : [item.feature];
  return keys.some((key) => flags[key]);
}

/** Pages rendues sans la coquille de l'application : le billet hors ligne (D26) est une page autonome. */
const BARE_ROUTES = new Set(['/billet/hors-ligne']);

/** Libellé humain du rôle principal (jamais le code brut). */
const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super-administrateur',
  ADMIN: 'Administrateur',
  PARTENAIRE: 'Partenaire',
  CONTROLEUR: 'Contrôleur',
  CLIENT: 'Client',
};

function roleLabel(role: string | null | undefined): string {
  return (role && ROLE_LABELS[role]) || 'Client';
}

/** Lien de navigation (barre latérale et tiroir) : 44 px, page courante annoncée, tokens du thème. */
function navLinkClass(active: boolean): string {
  return cn(
    'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active ? 'bg-primary-soft font-semibold text-primary-text' : 'text-muted-foreground hover:bg-background hover:text-foreground-strong',
  );
}

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { user, profile, isAuthenticated, isLoading, signOut, hasPermission } = useAuth();
  const featureFlags = useFeatureFlags();
  const visibleItems = (items: NavItem[]): NavItem[] => items.filter((item) => isFeatureVisible(item, featureFlags));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isUserLoggedIn = mounted && (isAuthenticated || !!user);
  const roles = mounted ? (profile?.roles || []) : [];
  // Lot 1B.1 : rôles uniquement depuis le profil servi par /api/auth/me (user_roles),
  // ni user_metadata ni numéro de téléphone « magique ».
  const isSuperAdmin = roles.includes('SUPERADMIN');
  const isAdmin = isSuperAdmin || roles.includes('ADMIN');
  const isPartner = roles.includes('PARTENAIRE');
  // Finition 1 (complément 11) : pour un contrôleur (sans rôle partenaire ni admin), le menu « Scanner » suit ses
  // événements (contrôle ouvert ou ouvrant dans les 24 h), pas le rôle du compte : /api/auth/me sert
  // profile.scanner_open (faux : application d'un client normal ; null, état illisible : menu gardé, le scanner refuse
  // lui-même hors de la plage). Partenaires et admins gardent leurs entrées.
  const scannerNav = roles.includes('CONTROLEUR') && (isPartner || isAdmin || profile?.scanner_open !== false);
  const isController = scannerNav || isAdmin;
  const isAmbassador = mounted && (profile?.referral_status === 'AMBASSADEUR');
  // Finition 3b (E-34) : menu de l'administration selon les droits, chargé à la demande (rien pour les autres pages).
  const [adminNav, setAdminNav] = useState<import('./admin-nav').AdminNav | null>(null);
  useEffect(() => {
    if (!isAdmin) return undefined;
    let live = true;
    void import('./admin-nav').then((m) => { if (live) setAdminNav(m.buildAdminNav(hasPermission, isSuperAdmin)); });
    return () => { live = false; };
  }, [isAdmin, isSuperAdmin, hasPermission]);

  const isPartnerRoute = pathname.startsWith('/partner/') || pathname === '/partner';
  const isAdminRoute = pathname.startsWith('/admin/') || pathname === '/admin';
  const isControllerRoute = pathname.startsWith('/controller');

  // Navigation principale B2C
  // Navigation principale B2C (« Commandes » : salles, tables et repas ; masquée si les trois sont fermés)
  const navItems = visibleItems([
    { name: 'Accueil', href: '/', icon: Home },
    { name: 'Explorer', href: '/explore', icon: Compass },
    { name: 'Mes billets', short: 'Billets', href: '/tickets', icon: Ticket },
    { name: 'Commandes', short: 'Achats', href: '/orders', icon: ShoppingBag, feature: ['halls', 'tables', 'orders'] },
    { name: 'Portefeuille', href: '/wallet', icon: Wallet },
  ]);

  // Navigation Services
  const serviceItems = visibleItems([
    { name: 'Salles de fête', href: '/halls', icon: Building2, feature: 'halls' },
    { name: 'Restaurants et tables', href: '/restaurants/rest-terrou-bi/tables', icon: Utensils, feature: 'tables' },
  ]);

  // Navigation Partenaire complète
  const partnerNavItems = visibleItems([
    { name: 'Tableau de bord', href: '/partner/dashboard', icon: LayoutDashboard },
    { name: 'Événements', href: '/partner/events', icon: Calendar },
    { name: 'Produits et menu', href: '/partner/products', icon: ShoppingBag, feature: 'orders' },
    { name: 'Salles de fête', href: '/partner/halls', icon: Building2, feature: 'halls' },
    { name: 'Tables', href: '/partner/tables', icon: Utensils, feature: 'tables' },
    { name: 'Commandes', href: '/partner/orders', icon: ShoppingBag, feature: 'orders' },
    { name: 'Équipe', href: '/partner/team', icon: Users },
  ]);
  const partnerSecondaryItems: NavItem[] = [
    { name: 'Finances', href: '/partner/finance', icon: DollarSign },
    { name: 'Statistiques', href: '/partner/stats', icon: Activity },
    { name: 'Scanner les billets', href: '/partner/scan', icon: QrCode },
    { name: 'Calendrier', href: '/partner/calendar', icon: Calendar },
    { name: 'Abonnement', href: '/partner/subscription', icon: Briefcase },
    { name: 'Profil partenaire', href: '/partner/profile', icon: User },
  ];
  const partnerMobileItems: NavItem[] = [
    { name: 'Accueil', href: '/partner/dashboard', icon: LayoutDashboard },
    { name: 'Événements', short: 'Billetterie', href: '/partner/events', icon: Calendar },
    { name: 'Scanner', href: '/partner/scan', icon: QrCode },
    { name: 'Finances', href: '/partner/finance', icon: DollarSign },
    { name: 'Profil', href: '/partner/profile', icon: User },
  ];

  const controllerMobileItems: NavItem[] = [
    { name: 'Accueil', href: '/', icon: Home },
    { name: 'Explorer', href: '/explore', icon: Compass },
    { name: 'Scanner', href: '/controller/scanner', icon: QrCode },
    { name: 'Billets', href: '/tickets', icon: Ticket },
    { name: 'Profil', href: '/controller/profile', icon: User },
  ];

  // Liens Espaces Pro & Admin dynamiques selon le rôle
  const proItems: NavItem[] = [];

  if (isAdmin) {
    proItems.push(...(adminNav?.proItems ?? [{ name: 'Administration', href: '/admin/dashboard', icon: LayoutDashboard }]));
  } else if (isPartner && !isPartnerRoute) {
    proItems.push({ name: 'Espace partenaire', href: '/partner/dashboard', icon: LayoutDashboard });
  } else if (isController) {
    proItems.push({ name: 'Scanner les billets', href: '/controller/scanner', icon: QrCode });
  }

  if (!isPartner && !isAdmin && !isController) {
    proItems.push({ name: 'Devenir partenaire', href: '/partner/register', icon: Briefcase });
  }


  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Design 1d (point 9) : la recherche instantanée ouverte depuis le menu le referme
  useEffect(() => {
    const close = (): void => setIsMobileMenuOpen(false);
    window.addEventListener(SEARCH_OPEN_EVENT, close);
    return () => window.removeEventListener(SEARCH_OPEN_EVENT, close);
  }, []);
  // Design 1d (run 489, temps de blocage de Mes billets) : lanceur de la recherche chargé au premier geste sur un
  // déclencheur (toucher, clic, focus du champ de l'accueil), jamais au chargement de la page ; ce geste est rejoué.
  const [searchWanted, setSearchWanted] = useState(false);
  useEffect(() => {
    if (searchWanted) return undefined;
    const onIntent = (e: Event): void => {
      const target = (e.target as Element | null)?.closest?.<HTMLElement>(`[${SEARCH_LAUNCH_ATTR}]`);
      if (!target) return;
      if (e.type === 'click') {
        const m = e as MouseEvent;
        if (m.button !== 0 || m.metaKey || m.ctrlKey || m.shiftKey || m.altKey) return;
        e.preventDefault();
        e.stopPropagation();
      } else if (!(target instanceof HTMLInputElement)) {
        return;
      }
      setPendingSearch(target);
      setSearchWanted(true);
    };
    document.addEventListener('click', onIntent, true);
    document.addEventListener('focusin', onIntent, true);
    return () => {
      document.removeEventListener('click', onIntent, true);
      document.removeEventListener('focusin', onIntent, true);
    };
  }, [searchWanted]);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const wasMenuOpen = useRef(false);

  useEffect(() => { setIsMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      wasMenuOpen.current = true;
      document.body.style.overflow = 'hidden';
      drawerCloseRef.current?.focus();
      const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
      document.addEventListener('keydown', onEsc);
      return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onEsc); };
    }
    if (wasMenuOpen.current) {
      wasMenuOpen.current = false;
      menuButtonRef.current?.focus();
    }
    return undefined;
  }, [isMobileMenuOpen]);

  const canShowRoleNav = mounted && !isLoading;

  const isNavActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const renderNavLink = (item: NavItem, onNavigate?: () => void) => {
    const active = isNavActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={navLinkClass(active)}
      >
        <Icon size={18} className={active ? 'text-primary-text' : 'text-muted-foreground'} />
        <span className="min-w-0 break-words">{item.name}</span>
      </Link>
    );
  };

  const renderNavSection = (label: string, items: NavItem[], onNavigate?: () => void) => (
    <div key={label}>
      <p className="mb-1.5 block px-3 text-sm font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-0.5">{items.map((item) => renderNavLink(item, onNavigate))}</div>
    </div>
  );

  const adminBadge = (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2">
      <ShieldCheck size={16} className="flex-shrink-0 text-primary-text" aria-hidden="true" />
      <span className="text-sm font-semibold text-foreground-strong">Administration</span>
    </div>
  );

  const userFirst = profile?.first_name || (user?.user_metadata?.first_name as string) || '';
  const userLast = profile?.last_name || (user?.user_metadata?.last_name as string) || '';
  // Lot 9 (9.2) : l'adresse technique d'un compte par téléphone ne sert ni de nom ni d'initiales.
  const userEmail = isDeliverableEmail(user?.email) ? user.email : null;
  const displayName = userFirst || userLast
    ? `${userFirst} ${userLast}`.trim()
    : userEmail?.split('@')[0] || 'Mon compte';

  const initials = userFirst || userLast
    ? `${userFirst[0] || 'U'}${userLast[0] || 'E'}`.toUpperCase()
    : userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : 'EV';

  const accountSubtitle = isAmbassador ? 'Ambassadeur' : roleLabel(profile?.role);

  const avatar = <Avatar src={profile?.avatar_url} initials={initials} />;

  // Les routes /controller/* ont leur propre layout — ne pas injecter AppLayout. Le billet hors ligne
  // (/billet/hors-ligne, D26) est rendu nu : page statique servie sans réseau, sans en-tête ni navigation.
  if (isControllerRoute || BARE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  const mobileItems = canShowRoleNav && isPartnerRoute && isPartner
    ? partnerMobileItems
    : canShowRoleNav && isAdminRoute && isAdmin
    ? (adminNav?.mobile ?? [{ name: 'Accueil', href: '/admin/dashboard', icon: LayoutDashboard }])
    : scannerNav
    ? controllerMobileItems
    : navItems;

  const renderRoleNav = (onNavigate?: () => void) => {
    if (canShowRoleNav && isAdminRoute && isAdmin) {
      return (
        <>
          {adminBadge}
          {renderNavLink({ name: 'Tableau de bord', href: '/admin/dashboard', icon: LayoutDashboard }, onNavigate)}
          {(adminNav?.groups ?? []).map((group) => renderNavSection(group.label, group.items, onNavigate))}
          <div className="border-t border-border pt-2">
            {renderNavLink({ name: 'Retour au site', href: '/', icon: ArrowLeft }, onNavigate)}
          </div>
        </>
      );
    }
    if (canShowRoleNav && isPartnerRoute && isPartner) {
      return (
        <>
          {renderNavSection('Gestion', partnerNavItems, onNavigate)}
          {renderNavSection('Outils', partnerSecondaryItems, onNavigate)}
          <div className="border-t border-border pt-2">
            {renderNavLink({ name: 'Retour au site', href: '/', icon: Home }, onNavigate)}
          </div>
        </>
      );
    }
    return (
      <>
        {renderNavSection('Menu principal', navItems, onNavigate)}
        {serviceItems.length > 0 && renderNavSection('Services et espaces', serviceItems, onNavigate)}
        {proItems.length > 0 && renderNavSection('Espaces métier', proItems, onNavigate)}
      </>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground-strong transition-colors duration-200 lg:flex-row">
      {/* 1. Barre latérale (à partir de lg : 1024 px) */}
      <aside className="sticky top-0 z-30 hidden h-screen w-64 flex-shrink-0 flex-col overflow-y-auto border-r border-border bg-card p-5 shadow-subtle lg:flex xl:w-72">
        <div className="mb-6 py-2">
          <Logo variant="full" />
        </div>

        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-5">
          {renderRoleNav()}
        </nav>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
          {isUserLoggedIn ? (
            <div className="flex w-full min-w-0 items-center justify-between gap-1">
              <Link href="/profile" className="group flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {avatar}
                <span className="min-w-0 leading-tight">
                  <span className="block break-words text-sm font-semibold text-foreground-strong group-hover:text-primary-text">{displayName}</span>
                  <span className="block break-words text-sm text-muted-foreground">{accountSubtitle}</span>
                </span>
              </Link>
              <div className="flex flex-shrink-0 items-center gap-1">
                <IconButton aria-label="Se déconnecter" variant="danger" onClick={() => signOut()}>
                  <LogOut size={18} />
                </IconButton>
                <ThemeToggle />
              </div>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between gap-2">
              <LinkButton href="/login" prefetch={false} variant="outline" size="sm" leftIcon={<LogIn size={16} />}>
                Se connecter
              </LinkButton>
              <ThemeToggle />
            </div>
          )}
        </div>
      </aside>

      {/* 1b. Tiroir mobile (< 1024 px) : invisible et hors tabulation quand il est fermé */}
      <div
        className={cn(
          'fixed inset-0 z-50 duration-300 lg:hidden',
          isMobileMenuOpen ? 'visible opacity-100 transition-opacity' : 'pointer-events-none invisible opacity-0 transition-[opacity,visibility]',
        )}
      >
        <div className="absolute inset-0 bg-scrim/60 backdrop-blur-sm" aria-hidden="true" onClick={closeMobileMenu} />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={cn(
            'absolute bottom-0 left-0 top-0 flex w-[85vw] max-w-[320px] flex-col bg-popover shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <Logo variant="full" />
            <IconButton ref={drawerCloseRef} aria-label="Fermer le menu" onClick={closeMobileMenu}>
              <X size={20} />
            </IconButton>
          </div>

          <div className="px-4 pb-1 pt-3 sm:hidden">
            <Link
              href="/explore"
              data-ev-search=""
              onClick={closeMobileMenu}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3.5 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search size={16} aria-hidden="true" />
              <span>Rechercher un événement</span>
            </Link>
          </div>

          <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-3">
            {renderRoleNav(closeMobileMenu)}
          </nav>

          <div className="flex-shrink-0 border-t border-border px-4 py-3">
            {isUserLoggedIn ? (
              <div className="flex items-center justify-between gap-2">
                <Link href="/profile" onClick={closeMobileMenu} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {avatar}
                  <span className="min-w-0 leading-tight">
                    <span className="block break-words text-sm font-semibold text-foreground-strong">{displayName}</span>
                    <span className="block break-words text-sm text-muted-foreground">{accountSubtitle}</span>
                  </span>
                </Link>
                <IconButton aria-label="Se déconnecter" variant="danger" onClick={() => { closeMobileMenu(); signOut(); }}>
                  <LogOut size={18} />
                </IconButton>
              </div>
            ) : (
              <LinkButton href="/login" prefetch={false} onClick={closeMobileMenu} fullWidth leftIcon={<LogIn size={16} />}>
                Se connecter
              </LinkButton>
            )}
          </div>
        </div>
      </div>

      {/* 2. Zone principale : en-tête et contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 shadow-subtle lg:px-8">
          {/* Design 1c (point 1) : le logo ne rétrécit plus (à 768 px, « Event Village » passait sous la recherche) */}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <IconButton
              ref={menuButtonRef}
              aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="lg:hidden"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </IconButton>
            <div className="lg:hidden">
              <Logo variant="auto" />
            </div>
          </div>

          <div className="hidden max-w-lg flex-1 items-center sm:flex">
            <Link
              href="/explore"
              data-ev-search=""
              className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm text-muted-foreground transition-colors hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search size={16} aria-hidden="true" />
              <span className="min-w-0 break-words">Rechercher un événement…</span>
            </Link>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
            <NotificationBell />
            {/* Design 1d (point 9) : recherche instantanée, ouverte depuis tout déclencheur data-ev-search */}
            {searchWanted && <Suspense fallback={null}><SearchLauncher /></Suspense>}


            {/* Sous 640 px, le scanner est dans la barre du bas du contrôleur : l'en-tête tient à 390 px
                avec ses trois boutons de 44 px. */}
            {scannerNav && (
              <div className="hidden sm:block">
                <LinkButton href="/controller/scanner" prefetch={false} size="sm" leftIcon={<QrCode size={16} />}>
                  Scanner
                </LinkButton>
              </div>
            )}

            <div className="lg:hidden">
              <ThemeToggle />
            </div>

            {isUserLoggedIn ? (
              // Nom porté par un texte masqué plutôt que par aria-label : les initiales visibles (« MN »)
              // ne figuraient pas dans « Mon profil (…) » (axe label-content-name-mismatch). Cible de 44 px.
              <Link
                href="/profile"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              >
                {avatar}
                <span className="sr-only">{`Mon profil (${displayName})`}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                aria-label="Se connecter"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-primary-soft text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
              >
                <LogIn size={18} aria-hidden="true" />
              </Link>
            )}
          </div>
        </header>

        {/* Contenu de la page : une seule gouttière, réserve pour la barre du bas sur mobile */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          {children}
        </main>
      </div>

      {/* 3. Barre du bas (< 1024 px) */}
      <nav aria-label="Navigation rapide" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-1 py-1 shadow-lg lg:hidden">
        <div className="flex items-stretch justify-around">
          {mobileItems.map((item) => {
            const active = isNavActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active ? 'text-primary-text' : 'text-muted-foreground hover:text-foreground-strong',
                )}
              >
                <Icon size={20} aria-hidden="true" />
                {/* Design 1c (point 1) : libellé entier, au besoin sur deux lignes (aucun texte tronqué à 320 px) */}
                <small className="text-caption max-w-full text-center font-semibold leading-tight [overflow-wrap:anywhere]">{item.short ?? item.name}</small>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
