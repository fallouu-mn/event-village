'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  Ticket,
  ShoppingBag,
  User,
  Bell,
  MapPin,
  Search,
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
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useAuth } from '@/components/providers/AuthProvider';

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
  } else if (isPartner) {
    proItems.push({ name: 'Dashboard Partenaire', href: '/partner/dashboard', icon: LayoutDashboard });
    proItems.push({ name: 'Calendrier B2B', href: '/partner/calendar', icon: Calendar });
    proItems.push({ name: 'Scanner Billets', href: '/scan', icon: QrCode });
  } else if (isController) {
    proItems.push({ name: 'Scanner Billets', href: '/scan', icon: QrCode });
  }

  // Verrouillage : "Devenir Partenaire" est masqué pour Admin/Superadmin/Partenaire
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FAFAFA] dark:bg-[#111111] text-slate-900 dark:text-zinc-100 transition-colors duration-200">
      {/* ====================================================================
          1. SIDEBAR DESKTOP (Visible à partir de lg: 1024px)
          ==================================================================== */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161616] p-5 sticky top-0 h-screen overflow-y-auto flex-shrink-0 z-30">
        {/* Logo */}
        <div className="py-2 mb-6">
          <Logo variant="full" />
        </div>

        {/* Navigation Principale */}
        <div className="space-y-6 flex-1">
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
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 ${
                      active
                        ? 'bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/25 font-black'
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

          {/* Services & Réservations */}
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
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 ${
                      active
                        ? 'bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/25 font-black'
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

          {/* Espaces Professionnels & Administration */}
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
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-150 ${
                        active
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md font-black'
                          : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon size={18} className="text-[#FF6B35]" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Profil & Déconnexion / Connexion Bas de Sidebar */}
        <div className="pt-4 mt-auto border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          {isUserLoggedIn ? (
            <div className="flex items-center justify-between w-full min-w-0">
              <Link href="/profile" className="flex items-center gap-2.5 group min-w-0 flex-1 mr-1">
                <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#FF6B35] font-black text-xs flex items-center justify-center border border-orange-200 dark:border-orange-800/50 flex-shrink-0">
                  {initials}
                </div>
                <div className="leading-tight truncate min-w-0">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-[#FF6B35] transition-colors truncate">
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
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-[#FF6B35] text-xs font-black hover:bg-[#FF6B35] hover:text-white transition-all"
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
        {/* Topbar Header (Visible partout) */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-[#161616]/80 backdrop-blur-md px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
          {/* Logo Mobile */}
          <div className="lg:hidden">
            <Logo variant="auto" />
          </div>

          {/* Localisation & Recherche Rapide Desktop */}
          <div className="hidden sm:flex items-center gap-4 flex-1 max-w-md">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300">
              <MapPin size={14} className="text-[#FF6B35]" />
              <span>Dakar, Sénégal</span>
            </div>

            <Link
              href="/explore"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white transition-colors flex-1"
            >
              <Search size={14} />
              <span>Rechercher un événement, concert, restaurant...</span>
            </Link>
          </div>

          {/* Actions Droite (Notifications, Thème Mobile, Profil) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationBell />

            <div className="lg:hidden">
              <ThemeToggle />
            </div>

            {isUserLoggedIn ? (
              <div className="lg:hidden flex items-center gap-2">
                <Link href="/profile">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-[#FF6B35] font-black text-xs flex items-center justify-center border border-orange-200 dark:border-orange-800/50">
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
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-[#FF6B35] font-black text-xs flex items-center justify-center border border-orange-200 dark:border-orange-800/50">
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
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#161616]/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-zinc-800/80 px-2 py-2 safe-bottom shadow-lg">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const active = isNavActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 active:scale-95 ${
                  active
                    ? 'text-[#FF6B35] font-black'
                    : 'text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={20} className={active ? 'text-[#FF6B35]' : ''} />
                <span className="text-[10px] mt-0.5 font-bold">{item.name}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] mt-0.5 animate-pulse" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
