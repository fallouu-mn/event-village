import { Activity, Award, BellRing, Building2, Calendar, DollarSign, FileText, KeyRound, LayoutDashboard, Megaphone, QrCode, Settings2, ShieldCheck, Users } from 'lucide-react';
import type { NavItem } from './AppLayout';

export interface AdminNav {
  /** Barre latérale et tiroir, sur les pages de l'administration (groupes vides retirés). */
  groups: Array<{ label: string; items: NavItem[] }>;
  /** « Espaces métier », hors des pages de l'administration. */
  proItems: NavItem[];
  /** Barre du bas des pages de l'administration (5 cases au plus). */
  mobile: NavItem[];
}

/**
 * Finition 3b (E-34) — menu de l'administration selon les droits servis par /api/auth/me (`hasPermission` : lignes d'un
 * ADMIN, toutes pour un SUPERADMIN). Chargé à la demande par AppLayout (`import('./admin-nav')`) : rien de ce module
 * n'alourdit les pages publiques. « Scanner » seulement avec access.operate ; « Réglages » avec settings.read ; « Mes
 * droits » pour un ADMIN ; plus de « Tarification » (retirée). Finition 3d (point 2) : « Sécurité du compte » (codes de
 * secours, son numéro) pour un SUPERADMIN. Le menu n'est qu'un confort : chaque page et chaque route
 * refusent toujours côté serveur sans le droit (tests/parcours/f3b-securite.test.ts).
 */
export function buildAdminNav(can: (permission: string) => boolean, isSuperAdmin: boolean): AdminNav {
  const finance = can('payments.read') || can('refunds.manage');
  const referral = can('users.read') || can('referrals.manage');
  const isAdminOnly = !isSuperAdmin;

  const adminNavGroups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: 'Gestion',
      items: [
        ...(can('events.read') ? [{ name: 'Événements', href: '/admin/events', icon: Calendar }] : []),
        ...(can('users.read') ? [{ name: 'Comptes', href: '/admin/users', icon: Users }] : []),
        ...(can('events.read') ? [{ name: 'Catalogues et services', href: '/admin/services', icon: Building2 }] : []),
      ],
    },
    {
      label: 'Finances',
      items: [...(finance ? [{ name: 'Finance', href: '/admin/finance', icon: DollarSign }] : [])],
    },
    {
      label: 'Engagement',
      items: [
        ...(referral ? [{ name: 'Parrainage', href: '/admin/referral', icon: Award }] : []),
        ...(can('communications.manage') ? [{ name: 'Campagnes', href: '/admin/communications', icon: Megaphone }] : []),
      ],
    },
    {
      label: 'Système',
      items: [
        ...(can('settings.read') ? [{ name: 'Réglages', href: '/admin/finance-settings', icon: Settings2 }] : []),
        ...(isSuperAdmin ? [{ name: 'Journal d’audit', href: '/admin/audit', icon: FileText }] : []),
        ...(can('notifications.read') ? [{ name: 'Notifications', href: '/admin/notifications', icon: BellRing }] : []),
        ...(can('access.operate') ? [{ name: 'Scanner', href: '/scan', icon: QrCode }] : []),
        ...(isAdminOnly ? [{ name: 'Mes droits', href: '/admin/mes-droits', icon: KeyRound }] : []),
        ...(isSuperAdmin ? [{ name: 'Sécurité du compte', href: '/admin/securite', icon: ShieldCheck }] : []),
      ],
    },
  ];

  const proItems: NavItem[] = [{ name: 'Administration', href: '/admin/dashboard', icon: LayoutDashboard }];
  if (can('events.read')) proItems.push({ name: 'Événements à valider', href: '/admin/events', icon: Calendar });
  if (can('users.read')) proItems.push({ name: 'Comptes et administrateurs', href: '/admin/users', icon: Users });
  if (can('events.read')) proItems.push({ name: 'Catalogues et services', href: '/admin/services', icon: Building2 });
  if (finance) proItems.push({ name: 'Finance', href: '/admin/finance', icon: DollarSign });
  if (referral) proItems.push({ name: 'Parrainage et ambassadeurs', href: '/admin/referral', icon: Award });
  if (can('communications.manage')) proItems.push({ name: 'Campagnes', href: '/admin/communications', icon: Megaphone });
  if (can('settings.read')) proItems.push({ name: 'Réglages de la plateforme', href: '/admin/finance-settings', icon: Settings2 });
  if (isSuperAdmin) proItems.push({ name: 'Journal d’audit', href: '/admin/audit', icon: Activity });
  if (can('notifications.read')) proItems.push({ name: 'Notifications', href: '/admin/notifications', icon: BellRing });
  if (can('access.operate')) proItems.push({ name: 'Scanner de contrôle', href: '/scan', icon: QrCode });
  if (isAdminOnly) proItems.push({ name: 'Mes droits', href: '/admin/mes-droits', icon: KeyRound });
  if (isSuperAdmin) proItems.push({ name: 'Sécurité du compte', href: '/admin/securite', icon: ShieldCheck });

  // Barre du bas : une entrée par écran ; chaque case suit le droit de sa page.
  const adminMobileItems: NavItem[] = [
    { name: 'Accueil', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Événements', short: 'Validation', href: '/admin/events', icon: Calendar },
    { name: 'Comptes', href: '/admin/users', icon: Users },
    { name: 'Finance', href: '/admin/finance', icon: DollarSign },
    { name: 'Audit', href: '/admin/audit', icon: Activity },
  ];
  const mobileVisible: Record<string, boolean> = {
    '/admin/dashboard': true,
    '/admin/events': can('events.read'),
    '/admin/users': can('users.read'),
    '/admin/finance': finance,
    '/admin/audit': true,
  };
  const mobile = adminMobileItems
    .filter((i) => i.href !== '/admin/audit' || isSuperAdmin)
    .filter((i) => mobileVisible[i.href]);

  return { groups: adminNavGroups.filter((g) => g.items.length > 0), proItems, mobile };
}
