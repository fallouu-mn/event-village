'use client';

import React, { useState, useEffect } from 'react';
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
  X,
  Menu,
  Search,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/components/providers/AuthProvider';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { user, profile, isAuthenticated, isLoading, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isUserLoggedIn = mounted && (isAuthenticated || !!user);
  const rawRole = mounted ? (profile?.role || (user?.user_metadata?.role as string) || '') : '';
  const cleanPhone = mounted ? (profile?.phone || (user?.user_metadata?.phone as string) || '').replace(/\D/g, '') : '';
  const isSuperadminNumber = mounted && (cleanPhone === '221770000000' || cleanPhone === '770000000' || cleanPhone === '221773780756' || cleanPhone === '773780756');

  const isSuperAdmin = rawRole === 'SUPERADMIN' || isSuperadminNumber;
  const isAdmin = isSuperAdmin || rawRole === 'ADMIN';
  const isPartner = rawRole === 'PARTENAIRE';
  const isController = rawRole === 'CONTROLEUR' || isAdmin || isPartner;
  const isAmbassador = mounted && (profile?.referral_status === 'AMBASSADEUR');

  const isPartnerRoute = pathname.startsWith('/partner/') || pathname === '/partner';
  const isAdminRoute = pathname.startsWith('/admin/') || pathname === '/admin';
  const isControllerRoute = pathname.startsWith('/controller');

  // Navigation principale B2C
  const navItems = [
    { name: 'Accueil', href: '/', icon: Home },
    { name: 'Explorer', href: '/explore', icon: Compass },
    { name: 'Mes Billets', href: '/tickets', icon: Ticket },
    { name: 'Commandes', href: '/orders', icon: ShoppingBag },
    { name: 'Portefeuille', href: '/wallet', icon: Wallet },
  ];

  // Navigation Services
  const serviceItems = [
    { name: 'Salles de Fête', href: '/halls', icon: Building2 },
    { name: 'Restaurants & Tables', href: '/restaurants/rest-terrou-bi/tables', icon: Utensils },
  ];

  // Navigation Partenaire complète
  const partnerNavItems = [
    { name: 'Dashboard', href: '/partner/dashboard', icon: LayoutDashboard },
    { name: 'Événements', href: '/partner/events', icon: Calendar },
    { name: 'Produits & Menu', href: '/partner/products', icon: ShoppingBag },
    { name: 'Salles de Fête', href: '/partner/halls', icon: Building2 },
    { name: 'Tables', href: '/partner/tables', icon: Utensils },
    { name: 'Commandes', href: '/partner/orders', icon: ShoppingBag },
    { name: 'Équipe', href: '/partner/team', icon: Users },
  ];
  const partnerSecondaryItems = [
    { name: 'Finances', href: '/partner/finance', icon: DollarSign },
    { name: 'Statistiques', href: '/partner/stats', icon: Activity },
    { name: 'Scanner Billets', href: '/partner/scan', icon: QrCode },
    { name: 'Calendrier', href: '/partner/calendar', icon: Calendar },
    { name: 'Abonnement', href: '/partner/subscription', icon: Briefcase },
    { name: 'Profil Partenaire', href: '/partner/profile', icon: User },
  ];
  const partnerMobileItems = [
    { name: 'Dashboard', href: '/partner/dashboard', icon: LayoutDashboard },
    { name: 'Événements', href: '/partner/events', icon: Calendar },
    { name: 'Scanner', href: '/partner/scan', icon: QrCode },
    { name: 'Finances', href: '/partner/finance', icon: DollarSign },
    { name: 'Profil', href: '/partner/profile', icon: User },
  ];

  const adminMobileItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Partenaires', href: '/admin/dashboard', icon: Briefcase },
    { name: 'Utilisateurs', href: '/admin/users', icon: Users },
    { name: 'Finance', href: '/admin/finance', icon: DollarSign },
    { name: 'Audit', href: '/admin/audit', icon: Activity },
  ];

  const controllerMobileItems = [
    { name: 'Accueil', href: '/', icon: Home },
    { name: 'Scanner', href: '/controller/scanner', icon: QrCode },
    { name: 'Profil', href: '/controller/profile', icon: User },
  ];

  // Liens Espaces Pro & Admin dynamiques selon le rôle
  const proItems: { name: string; href: string; icon: React.ComponentType<any> }[] = [];

  if (isAdmin) {
    proItems.push({ name: 'Dashboard Global', href: '/admin/dashboard', icon: LayoutDashboard });
    proItems.push({ name: 'Utilisateurs & RBAC', href: '/admin/users', icon: Users });
    proItems.push({ name: 'Services & Catalogue', href: '/admin/services', icon: Building2 });
    proItems.push({ name: 'Finance & Rapprochement', href: '/admin/finance', icon: DollarSign });
    proItems.push({ name: 'Parrainage & Ambassadeurs', href: '/admin/referral', icon: ShieldAlert });
    proItems.push({ name: 'Tarifs & Monétisation', href: '/admin/pricing', icon: Sliders });
    proItems.push({ name: 'Communications & Campagnes', href: '/admin/communications', icon: Radio });
    proItems.push({ name: 'Journal d\'Audit', href: '/admin/audit', icon: Activity });
    proItems.push({ name: 'Scanner de Contrôle', href: '/scan', icon: QrCode });
  } else if (isPartner && !isPartnerRoute) {
    proItems.push({ name: 'Espace Partenaire', href: '/partner/dashboard', icon: LayoutDashboard });
  } else if (isController) {
    proItems.push({ name: 'Scanner Billets', href: '/controller/scanner', icon: QrCode });
  }

  if (!isPartner && !isAdmin && !isController) {
    proItems.push({ name: 'Devenir Partenaire', href: '/partner/register', icon: Briefcase });
  }

  const adminNavGroups = isAdmin ? [
    {
      label: 'Gestion',
      items: [
        { name: 'Utilisateurs', href: '/admin/users', icon: Users },
        { name: 'Services & Catalogue', href: '/admin/services', icon: Building2 },
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
        { name: 'Journal d\'Audit', href: '/admin/audit', icon: FileText },
        { name: 'Scanner', href: '/scan', icon: QrCode },
      ],
    },
  ] : [];

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => { setIsMobileMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
      document.addEventListener('keydown', onEsc);
      return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onEsc); };
    }
  }, [isMobileMenuOpen]);

  const canShowRoleNav = mounted && !isLoading;

  const isNavActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const renderDrawerLink = (item: { name: string; href: string; icon: React.ComponentType<any> }) => {
    const active = isNavActive(item.href);
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} onClick={closeMobileMenu}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
          active ? 'bg-[#FF5722]/10 text-[#FF5722] font-semibold' : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50'
        }`}>
        <Icon size={18} className={active ? 'text-[#FF5722]' : 'text-slate-400 dark:text-zinc-500'} />
        <span>{item.name}</span>
      </Link>
    );
  };

  const renderDrawerSection = (label: string, items: { name: string; href: string; icon: React.ComponentType<any> }[]) => (
    <div key={label}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-600 px-3 block mb-1.5">{label}</span>
      <div className="space-y-0.5">{items.map(renderDrawerLink)}</div>
    </div>
  );

  const userFirst = profile?.first_name || (user?.user_metadata?.first_name as string) || '';
  const userLast = profile?.last_name || (user?.user_metadata?.last_name as string) || '';
  const displayName = userFirst || userLast
    ? `${userFirst} ${userLast}`.trim()
    : user?.email?.split('@')[0] || 'Mon Compte';

  const initials = userFirst || userLast
    ? `${userFirst[0] || 'U'}${userLast[0] || 'E'}`.toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'EV';

  // Les routes /controller/* ont leur propre layout — ne pas injecter AppLayout
  if (isControllerRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8F9FA] dark:bg-[#0F0F11] text-slate-900 dark:text-zinc-100 transition-colors duration-200">
      {/* ====================================================================
          1. SIDEBAR DESKTOP (Visible à partir de lg: 1024px)
          ==================================================================== */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#16161A] p-5 sticky top-0 h-screen overflow-y-auto flex-shrink-0 z-30 shadow-subtle">
        {/* Logo */}
        <div className="py-2 mb-6">
          <Logo variant="full" />
        </div>

        {/* Navigation — Partner vs B2C */}
        <div className="space-y-6 flex-1">
          {canShowRoleNav && isAdminRoute && isAdmin ? (
            <div className="space-y-4">
              {/* Badge Administration */}
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100/60 dark:from-zinc-800/80 dark:to-zinc-800/40 border border-slate-200/50 dark:border-zinc-700/40">
                <ShieldCheck size={14} className="text-[#FF5722] flex-shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Administration</span>
              </div>

              {/* Dashboard — lien principal */}
              <div>
                <Link
                  href="/admin/dashboard"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                    isNavActive('/admin/dashboard')
                      ? 'bg-[#FF5722]/10 text-[#FF5722] dark:bg-[#FF5722]/15 font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutDashboard size={17} className={isNavActive('/admin/dashboard') ? 'text-[#FF5722]' : 'text-slate-400 dark:text-zinc-500'} />
                  <span>Dashboard</span>
                </Link>
              </div>

              <div className="h-px bg-slate-200/50 dark:bg-zinc-800/50 mx-3" />

              {/* Sections groupées */}
              {adminNavGroups.map((group) => (
                <div key={group.label}>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400/70 dark:text-zinc-600 px-3 block mb-1.5">
                    {group.label}
                  </span>
                  <nav className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = isNavActive(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                            active
                              ? 'bg-[#FF5722]/10 text-[#FF5722] dark:bg-[#FF5722]/15 font-semibold'
                              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Icon size={17} className={active ? 'text-[#FF5722]' : 'text-slate-400 dark:text-zinc-500'} />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}

              {/* Retour au site */}
              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-zinc-800/50">
                <Link
                  href="/"
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-slate-400 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-800/50 hover:text-slate-600 dark:hover:text-zinc-300 transition-all duration-150"
                >
                  <ArrowLeft size={17} />
                  <span>Retour au site</span>
                </Link>
              </div>
            </div>
          ) : canShowRoleNav && isPartnerRoute && isPartner ? (
            <>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 block mb-2">
                  Gestion
                </span>
                <nav className="space-y-1">
                  {partnerNavItems.map((item) => {
                    const active = isNavActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
                          active
                            ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold'
                            : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon size={18} className={active ? 'text-white' : 'text-slate-500 dark:text-zinc-400'} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 block mb-2">
                  Outils
                </span>
                <nav className="space-y-1">
                  {partnerSecondaryItems.map((item) => {
                    const active = isNavActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
                          active
                            ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold'
                            : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon size={18} className={active ? 'text-white' : 'text-slate-500 dark:text-zinc-400'} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <div>
                <Link
                  href="/"
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white transition-all duration-200"
                >
                  <Home size={18} />
                  <span>Retour au site</span>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 block mb-2">
                  Menu Principal
                </span>
                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const active = isNavActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
                          active
                            ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold'
                            : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon size={18} className={active ? 'text-white' : 'text-slate-500 dark:text-zinc-400'} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 block mb-2">
                  Services & Espaces
                </span>
                <nav className="space-y-1">
                  {serviceItems.map((item) => {
                    const active = isNavActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
                          active
                            ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold'
                            : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon size={18} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {proItems.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-3 block mb-2">
                    Espaces Métier
                  </span>
                  <nav className="space-y-1">
                    {proItems.map((item) => {
                      const active = isNavActive(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
                            active
                              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md font-bold'
                              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Icon size={18} className="text-[#FF5722]" />
                          <span>{item.name}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              )}
            </>
          )}
        </div>

        {/* Profil & Déconnexion / Connexion Bas de Sidebar */}
        <div className="pt-4 mt-auto border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          {isUserLoggedIn ? (
            <div className="flex items-center justify-between w-full min-w-0">
              <Link href="/profile" className="flex items-center gap-2.5 group min-w-0 flex-1 mr-1">
                <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] font-black text-xs flex items-center justify-center border border-orange-200 dark:border-orange-800/50 flex-shrink-0 shadow-xs">
                  {initials}
                </div>
                <div className="leading-tight truncate min-w-0">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#FF5722] transition-colors truncate">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate">
                    {isAmbassador ? '⭐ Ambassadeur' : profile?.role || 'CLIENT'}
                  </span>
                </div>
              </Link>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => signOut()}
                  title="Se déconnecter"
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                  aria-label="Se déconnecter"
                >
                  <LogOut size={16} />
                </button>
                <ThemeToggle />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <Link
                href="/login"
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-[#FF5722] text-xs font-bold hover:bg-[#FF5722] hover:text-white transition-all shadow-xs"
              >
                <LogIn size={15} />
                <span>Se connecter</span>
              </Link>
              <ThemeToggle />
            </div>
          )}
        </div>
      </aside>

      {/* ====================================================================
          1b. MOBILE DRAWER (Visible uniquement < 1024px, toggle hamburger)
          ==================================================================== */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMobileMenuOpen}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeMobileMenu} />

        {/* Panel */}
        <div
          className={`absolute top-0 left-0 bottom-0 w-[85vw] max-w-[320px] bg-white dark:bg-[#16161A] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="px-5 py-4 border-b border-slate-200/50 dark:border-zinc-800/50 flex items-center justify-between flex-shrink-0">
            <Logo variant="full" />
            <button
              type="button"
              onClick={closeMobileMenu}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search (visible sur petit écran < sm) */}
          <div className="px-4 pt-3 pb-1 sm:hidden">
            <Link
              href="/explore"
              onClick={closeMobileMenu}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800/80 text-xs text-slate-400 dark:text-zinc-500 border border-slate-200/60 dark:border-zinc-700/60"
            >
              <Search size={14} />
              <span>Rechercher...</span>
            </Link>
          </div>

          {/* Navigation — contexte rôle */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
            {canShowRoleNav && isAdminRoute && isAdmin ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800/60">
                  <ShieldCheck size={14} className="text-[#FF5722]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Administration</span>
                </div>

                {renderDrawerLink({ name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard })}
                <div className="h-px bg-slate-200/50 dark:bg-zinc-800/50 mx-3" />
                {adminNavGroups.map(group => renderDrawerSection(group.label, group.items))}

                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/50">
                  {renderDrawerLink({ name: 'Retour au site', href: '/', icon: ArrowLeft })}
                </div>
              </>
            ) : canShowRoleNav && isPartnerRoute && isPartner ? (
              <>
                {renderDrawerSection('Gestion', partnerNavItems)}
                {renderDrawerSection('Outils', partnerSecondaryItems)}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/50">
                  {renderDrawerLink({ name: 'Retour au site', href: '/', icon: Home })}
                </div>
              </>
            ) : (
              <>
                {renderDrawerSection('Menu Principal', navItems)}
                {renderDrawerSection('Services & Espaces', serviceItems)}
                {proItems.length > 0 && renderDrawerSection('Espaces Métier', proItems)}
              </>
            )}
          </nav>

          {/* Drawer Footer — Profil */}
          <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800 flex-shrink-0">
            {isUserLoggedIn ? (
              <div className="flex items-center justify-between">
                <Link href="/profile" onClick={closeMobileMenu} className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] font-black text-xs flex items-center justify-center border border-orange-200 dark:border-orange-800/50 flex-shrink-0">
                    {initials}
                  </div>
                  <div className="leading-tight truncate min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">{displayName}</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">{profile?.role || 'CLIENT'}</span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => { closeMobileMenu(); signOut(); }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all flex-shrink-0"
                  aria-label="Se déconnecter"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={closeMobileMenu}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF5722] text-white text-sm font-bold hover:bg-[#E64A19] transition-colors"
              >
                <LogIn size={16} />
                <span>Se connecter</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. ZONE PRINCIPALE (HEADER + CONTENU RESPONSIVE)
          ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#16161A] px-4 lg:px-8 py-3 flex items-center justify-between gap-4 shadow-subtle">
          {/* Left: Hamburger + Logo (Mobile) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(v => !v)}
              className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
              aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="lg:hidden">
              <Logo variant="auto" />
            </div>
          </div>

          {/* Centre: Recherche Rapide (Desktop + Tablette) */}
          <div className="hidden sm:flex items-center flex-1 max-w-lg">
            <Link
              href="/explore"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800/80 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors flex-1 border border-slate-200/60 dark:border-zinc-700/60"
            >
              <Search size={14} />
              <span>Rechercher un événement, concert, restaurant...</span>
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />

            {rawRole === 'CONTROLEUR' && (
              <Link
                href="/controller/scanner"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-black shadow-xs transition-all active:scale-95 min-h-[36px]"
                title="Accéder au scanner de billets"
              >
                <QrCode size={15} />
                <span className="hidden sm:inline">Scanner Billets</span>
                <span className="sm:hidden">Scanner</span>
              </Link>
            )}

            <div className="lg:hidden">
              <ThemeToggle />
            </div>

            {isUserLoggedIn ? (
              <div className="lg:hidden flex items-center gap-2">
                <Link href="/profile">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] font-black text-xs flex items-center justify-center border border-orange-200 dark:border-orange-800/50 shadow-xs">
                    {initials}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  title="Déconnexion"
                  className="w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-red-500 transition-colors"
                  aria-label="Déconnexion"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link href="/login" className="lg:hidden">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-[#FF5722] font-black text-xs flex items-center justify-center border border-orange-200 dark:border-orange-800/50">
                  <LogIn size={16} />
                </div>
              </Link>
            )}
          </div>
        </header>

        {/* Contenu de la Page (Largeur fluide, jamais de max-w-md forcé sur desktop) */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* ====================================================================
          3. BOTTOM NAVIGATION MOBILE (Visible uniquement < 1024px)
          ==================================================================== */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-[#16161A] border-t border-slate-200/80 dark:border-zinc-800/80 px-2 py-2 safe-bottom shadow-lg">
        <div className="flex items-center justify-around">
          {(canShowRoleNav && isPartnerRoute && isPartner
              ? partnerMobileItems
              : canShowRoleNav && isAdminRoute && isAdmin
              ? adminMobileItems
              : rawRole === 'CONTROLEUR'
              ? controllerMobileItems
              : navItems
            ).map((item) => {
            const active = isNavActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 active:scale-95 ${
                  active
                    ? 'text-[#FF5722] font-bold'
                    : 'text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={20} className={active ? 'text-[#FF5722]' : ''} />
                <span className="text-[10px] mt-0.5 font-bold">{item.name}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5722] mt-0.5 animate-pulse" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
