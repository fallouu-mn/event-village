/**
 * Logique de détection de support et de cascade pour le scanner QR Code.
 * Stratégie en cascade :
 * 1. 'native'     : getUserMedia + BarcodeDetector natif (Chrome / Android récents - zéro dépendance, ultra-rapide)
 * 2. 'zxing'      : getUserMedia + fallback logiciel @zxing/browser (Safari iOS / Firefox)
 * 3. 'manual_only': Pas de getUserMedia / Permission refusée / Contexte non sécurisé (HTTP hors localhost)
 */

export type ScannerSupportMode = 'native' | 'zxing' | 'manual_only';

export interface ScannerSupportInfo {
  mode: ScannerSupportMode;
  hasGetUserMedia: boolean;
  hasBarcodeDetector: boolean;
  isSecureContext: boolean;
  reason?: string;
}

export function detectScannerSupport(win?: any): ScannerSupportInfo {
  const currentWindow = win !== undefined ? win : (typeof window !== 'undefined' ? window : null);
  const currentNav = currentWindow?.navigator;

  if (!currentWindow || !currentNav) {
    return {
      mode: 'manual_only',
      hasGetUserMedia: false,
      hasBarcodeDetector: false,
      isSecureContext: false,
      reason: 'Environnement non-navigateur (SSR)',
    };
  }

  const isSecure = currentWindow.isSecureContext ?? (
    currentWindow.location?.protocol === 'https:' ||
    currentWindow.location?.hostname === 'localhost' ||
    currentWindow.location?.hostname === '127.0.0.1'
  );

  const hasGetUserMedia = Boolean(
    currentNav.mediaDevices &&
    typeof currentNav.mediaDevices.getUserMedia === 'function'
  );

  const hasBarcodeDetector = Boolean(
    typeof currentWindow.BarcodeDetector === 'function'
  );

  if (!isSecure) {
    return {
      mode: 'manual_only',
      hasGetUserMedia,
      hasBarcodeDetector,
      isSecureContext: false,
      reason: 'Contexte non sécurisé (HTTPS requis pour la caméra)',
    };
  }

  if (!hasGetUserMedia) {
    return {
      mode: 'manual_only',
      hasGetUserMedia: false,
      hasBarcodeDetector,
      isSecureContext: true,
      reason: 'Périphérique ou navigateur sans support getUserMedia',
    };
  }

  if (hasBarcodeDetector) {
    return {
      mode: 'native',
      hasGetUserMedia: true,
      hasBarcodeDetector: true,
      isSecureContext: true,
    };
  }

  return {
    mode: 'zxing',
    hasGetUserMedia: true,
    hasBarcodeDetector: false,
    isSecureContext: true,
  };
}
