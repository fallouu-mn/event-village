'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
  ShieldAlert,
  LogIn,
  LogOut,
  Briefcase,
  Users,
  DollarSign,
  Radio,
  Sliders,
  Activity,
  ShieldCheck,
  ArrowLeft,
  FileText,
  Megaphone,
  Award,
  BellRing,
  X,
  Menu,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { cn } from '@/components/ui/cn';
import { useAuth } from '@/components/providers/AuthProvider';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useFeatureFlags, type ClientFeatureFlags } from '@/lib/features/client';

/** Interrupteur SUPERADMIN d'un service (features.halls_enabled, features.tables_enabled, features.orders_enabled). */
type FeatureKey = keyof ClientFeatureFlags;

interface NavItem {
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
  SUPERADMIN: 'Super administrateur',
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
    active ? 'bg-brand-bg font-semibold text-brand-fg' : 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
  );
}

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { user, profile, isAuthenticated, isLoading, signOut } = useAuth();
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
  const isController = roles.includes('CONTROLEUR') || isAdmin;
  const isAmbassador = mounted && (profile?.referral_status === 'AMBASSADEUR');

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
    { name: 'Portefeuille', short: 'Solde', href: '/wallet', icon: Wallet },
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

  // Barre du bas de l'administration : une entrée par écran (lot 5 : plus de doublon /admin/dashboard).
  const adminMobileItems: NavItem[] = [
    { name: 'Accueil', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Événements', short: 'Validation', href: '/admin/events', icon: Calendar },
    { name: 'Utilisateurs', short: 'Comptes', href: '/admin/users', icon: Users },
    { name: 'Finance', href: '/admin/finance', icon: DollarSign },
    { name: 'Audit', href: '/admin/audit', icon: Activity },
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
    proItems.push({ name: 'Administration', href: '/admin/dashboard', icon: LayoutDashboard });
    proItems.push({ name: 'Événements à valider', href: '/admin/events', icon: Calendar });
    proItems.push({ name: 'Utilisateurs et rôles', href: '/admin/users', icon: Users });
    proItems.push({ name: 'Catalogues et services', href: '/admin/services', icon: Building2 });
    proItems.push({ name: 'Finance et rapprochement', href: '/admin/finance', icon: DollarSign });
    proItems.push({ name: 'Parrainage et ambassadeurs', href: '/admin/referral', icon: ShieldAlert });
    proItems.push({ name: 'Tarifs et monétisation', href: '/admin/pricing', icon: Sliders });
    proItems.push({ name: 'Communications et campagnes', href: '/admin/communications', icon: Radio });
    proItems.push({ name: 'Journal d’audit', href: '/admin/audit', icon: Activity });
    proItems.push({ name: 'Notifications', href: '/admin/notifications', icon: BellRing });
    proItems.push({ name: 'Scanner de contrôle', href: '/scan', icon: QrCode });
  } else if (isPartner && !isPartnerRoute) {
    proItems.push({ name: 'Espace partenaire', href: '/partner/dashboard', icon: LayoutDashboard });
  } else if (isController) {
    proItems.push({ name: 'Scanner les billets', href: '/controller/scanner', icon: QrCode });
  }

  if (!isPartner && !isAdmin && !isController) {
    proItems.push({ name: 'Devenir partenaire', href: '/partner/register', icon: Briefcase });
  }

  const adminNavGroups: Array<{ label: string; items: NavItem[] }> = isAdmin ? [
    {
      label: 'Gestion',
      items: [
        { name: 'Événements', href: '/admin/events', icon: Calendar },
        { name: 'Utilisateurs', href: '/admin/users', icon: Users },
        { name: 'Catalogues et services', href: '/admin/services', icon: Building2 },
      ],
    },
    {
      label: 'Finances',
      items: [
        { name: 'Finance', href: '/admin/finance', icon: DollarSign },
        { name: 'Tarification', href: '/admin/pricing', icon: Sliders },
      ],
    },
    {
      label: 'Engagement',
      items: [
        { name: 'Parrainage', href: '/admin/referral', icon: Award },
        { name: 'Communications', href: '/admin/communications', icon: Megaphone },
      ],
    },
    {
      label: 'Système',
      items: [
        { name: 'Journal d’audit', href: '/admin/audit', icon: FileText },
        { name: 'Notifications', href: '/admin/notifications', icon: BellRing },
        { name: 'Scanner', href: '/scan', icon: QrCode },
      ],
    },
  ] : [];

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        <Icon size={18} className={active ? 'text-brand-fg' : 'text-fg-muted'} />
        <span className="min-w-0 truncate">{item.name}</span>
      </Link>
    );
  };

  const renderNavSection = (label: string, items: NavItem[], onNavigate?: () => void) => (
    <div key={label}>
      <p className="mb-1.5 block px-3 text-sm font-semibold text-fg-muted">{label}</p>
      <div className="flex flex-col gap-0.5">{items.map((item) => renderNavLink(item, onNavigate))}</div>
    </div>
  );

  const adminBadge = (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-sunken px-3 py-2">
      <ShieldCheck size={16} className="flex-shrink-0 text-brand-fg" aria-hidden="true" />
      <span className="text-sm font-semibold text-fg">Administration</span>
    </div>
  );

  const userFirst = profile?.first_name || (user?.user_metadata?.first_name as string) || '';
  const userLast = profile?.last_name || (user?.user_metadata?.last_name as string) || '';
  const displayName = userFirst || userLast
    ? `${userFirst} ${userLast}`.trim()
    : user?.email?.split('@')[0] || 'Mon compte';

  const initials = userFirst || userLast
    ? `${userFirst[0] || 'U'}${userLast[0] || 'E'}`.toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'EV';

  const accountSubtitle = isAmbassador ? 'Ambassadeur' : roleLabel(profile?.role);

  const avatar = (
    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-brand-bg text-sm font-bold text-brand-fg" aria-hidden="true">
      {initials}
    </span>
  );

  // Les routes /controller/* ont leur propre layout — ne pas injecter AppLayout. Le billet hors ligne
  // (/billet/hors-ligne, D26) est rendu nu : page statique servie sans réseau, sans en-tête ni navigation.
  if (isControllerRoute || BARE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  const mobileItems = canShowRoleNav && isPartnerRoute && isPartner
    ? partnerMobileItems
    : canShowRoleNav && isAdminRoute && isAdmin
    ? adminMobileItems
    : roles.includes('CONTROLEUR')
    ? controllerMobileItems
    : navItems;

  const renderRoleNav = (onNavigate?: () => void) => {
    if (canShowRoleNav && isAdminRoute && isAdmin) {
      return (
        <>
          {adminBadge}
          {renderNavLink({ name: 'Tableau de bord', href: '/admin/dashboard', icon: LayoutDashboard }, onNavigate)}
          {adminNavGroups.map((group) => renderNavSection(group.label, group.items, onNavigate))}
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
    <div className="flex min-h-screen flex-col bg-surface-sunken text-fg transition-colors duration-200 lg:flex-row">
      {/* 1. Barre latérale (à partir de lg : 1024 px) */}
      <aside className="sticky top-0 z-30 hidden h-screen w-64 flex-shrink-0 flex-col overflow-y-auto border-r border-border bg-surface p-5 shadow-subtle lg:flex xl:w-72">
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
                  <span className="block truncate text-sm font-semibold text-fg group-hover:text-brand-fg">{displayName}</span>
                  <span className="block truncate text-sm text-fg-muted">{accountSubtitle}</span>
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
              <LinkButton href="/login" variant="outline" size="sm" leftIcon={<LogIn size={16} />}>
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
            'absolute bottom-0 left-0 top-0 flex w-[85vw] max-w-[320px] flex-col bg-surface-raised shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none',
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
              onClick={closeMobileMenu}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface-sunken px-3.5 text-sm text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    <span className="block truncate text-sm font-semibold text-fg">{displayName}</span>
                    <span className="block truncate text-sm text-fg-muted">{accountSubtitle}</span>
                  </span>
                </Link>
                <IconButton aria-label="Se déconnecter" variant="danger" onClick={() => { closeMobileMenu(); signOut(); }}>
                  <LogOut size={18} />
                </IconButton>
              </div>
            ) : (
              <LinkButton href="/login" onClick={closeMobileMenu} fullWidth leftIcon={<LogIn size={16} />}>
                Se connecter
              </LinkButton>
            )}
          </div>
        </div>
      </div>

      {/* 2. Zone principale : en-tête et contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2 shadow-subtle lg:px-8">
          <div className="flex min-w-0 items-center gap-1.5">
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
              className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-surface-sunken px-4 text-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Search size={16} aria-hidden="true" />
              <span className="truncate">Rechercher un événement, un concert, un restaurant…</span>
            </Link>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
            <NotificationBell />

            {/* Sous 640 px, le scanner est dans la barre du bas du contrôleur : l'en-tête tient à 390 px
                avec ses trois boutons de 44 px. */}
            {roles.includes('CONTROLEUR') && (
              <div className="hidden sm:block">
                <LinkButton href="/controller/scanner" size="sm" leftIcon={<QrCode size={16} />}>
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
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-brand-bg text-brand-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
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
      <nav aria-label="Navigation rapide" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-1 py-1 shadow-lg lg:hidden">
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
                  active ? 'text-brand-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                <Icon size={20} aria-hidden="true" />
                <small className="text-caption max-w-full truncate font-semibold">{item.short ?? item.name}</small>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
