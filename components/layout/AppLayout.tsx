'use client';

import React from 'react';
import dynamic from 'next/dynamic';
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
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/components/providers/AuthProvider';

const AppLayoutHeader = dynamic(() => import('./AppLayoutHeader'), {
  ssr: false,
  loading: () => (
    <div className="sticky top-0 z-20 h-16 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#16161A] shadow-subtle" />
  ),
});

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { user, profile, isAuthenticated, signOut } = useAuth();

  const isUserLoggedIn = isAuthenticated || !!user;
  const rawRole = profile?.role || (user?.user_metadata?.role as string) || '';
  const cleanPhone = (profile?.phone || (user?.user_metadata?.phone as string) || '').replace(/\D/g, '');
  const isSuperadminNumber = cleanPhone === '221770000000' || cleanPhone === '770000000' || cleanPhone === '221773780756' || cleanPhone === '773780756';

  const isSuperAdmin = rawRole === 'SUPERADMIN' || isSuperadminNumber;
  const isAdmin = isSuperAdmin || rawRole === 'ADMIN';
  const isPartner = rawRole === 'PARTENAIRE';
  const isController = rawRole === 'CONTROLEUR' || isAdmin || isPartner;
  const isAmbassador = profile?.referral_status === 'AMBASSADEUR';

  const isPartnerRoute = pathname.startsWith('/partner/') || pathname === '/partner';

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
  ];
  const partnerSecondaryItems = [
    { name: 'Scanner Billets', href: '/partner/scan', icon: QrCode },
    { name: 'Calendrier', href: '/partner/calendar', icon: Calendar },
    { name: 'Profil Partenaire', href: '/partner/profile', icon: User },
  ];
  const partnerMobileItems = [
    { name: 'Dashboard', href: '/partner/dashboard', icon: LayoutDashboard },
    { name: 'Événements', href: '/partner/events', icon: Calendar },
    { name: 'Scanner', href: '/partner/scan', icon: QrCode },
    { name: 'Commandes', href: '/partner/orders', icon: ShoppingBag },
    { name: 'Profil', href: '/partner/profile', icon: User },
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
    proItems.push({ name: 'Scanner Billets', href: '/scan', icon: QrCode });
  }

  if (!isPartner && !isAdmin && !isController) {
    proItems.push({ name: 'Devenir Partenaire', href: '/partner/register', icon: Briefcase });
  }

  const isNavActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

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
          {isPartnerRoute && isPartner ? (
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
          2. ZONE PRINCIPALE (HEADER + CONTENU RESPONSIVE)
          ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Header — client-only pour éviter les conflits d'hydratation avec les extensions navigateur */}
        <AppLayoutHeader />

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
          {(isPartnerRoute && isPartner ? partnerMobileItems : navItems).map((item) => {
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
