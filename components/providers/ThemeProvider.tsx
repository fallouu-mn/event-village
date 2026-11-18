'use client';

/**
 * Design 1a (direction.md, section 9, décision 5) — thème : celui du téléphone par défaut, choix « Clair » ou « Sombre »
 * mémorisé dans le cookie `ev-theme` (lib/theme.ts). Le thème du premier affichage est posé par le script de <head>
 * (THEME_BOOT_SCRIPT, app/layout.tsx) : ce fournisseur lit ce qui est déjà sur <html>, puis suit les changements (choix
 * de la personne, réglage du téléphone en mode `system`). Ancien choix rangé dans localStorage : recopié dans le cookie,
 * puis effacé. Le scanner, le QR et le billet PDF ont leurs propres couleurs (jetons --scan-*, noir sur blanc).
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { isThemeChoice, themeCookie, themeFromCookie, THEME_COOKIE, type ResolvedTheme, type ThemeChoice } from '@/lib/theme';

interface ThemeContextType {
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeChoice) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function systemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  return choice === 'dark' || (choice === 'system' && systemDark()) ? 'dark' : 'light';
}

function apply(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolve(choice);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  root.setAttribute('data-theme-choice', choice);
  return resolved;
}

function remember(choice: ThemeChoice): void {
  document.cookie = themeCookie(choice, window.location.protocol === 'https:');
  try {
    window.localStorage.removeItem(THEME_COOKIE);
  } catch {
    // stockage indisponible (navigation privée) : le cookie suffit
  }
}

/** Choix courant : cookie, sinon ancien choix de localStorage, sinon `system`. */
function initialChoice(): ThemeChoice {
  const fromCookie = themeFromCookie(document.cookie);
  if (fromCookie) return fromCookie;
  try {
    const legacy = window.localStorage.getItem(THEME_COOKIE);
    if (isThemeChoice(legacy)) {
      remember(legacy);
      return legacy;
    }
  } catch {
    // stockage indisponible : thème du téléphone
  }
  return 'system';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeChoice>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    const choice = initialChoice();
    setThemeState(choice);
    setResolvedTheme(apply(choice));
  }, []);

  useEffect(() => {
    if (theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => setResolvedTheme(apply('system'));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((choice: ThemeChoice) => {
    remember(choice);
    setThemeState(choice);
    setResolvedTheme(apply(choice));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolve(theme) === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
};
