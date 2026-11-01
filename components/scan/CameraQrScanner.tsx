'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, SwitchCamera, RefreshCw, QrCode, ShieldAlert, Sparkles, Flashlight, FlashlightOff, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { detectScannerSupport, ScannerSupportMode } from '@/lib/scanner/support';
import { isTorchSupported, setTorchState } from '@/lib/hardware/torch';

export const CAMERA_SCAN_THROTTLE_MS = 140; // 120-150ms interval (~7 checks/s, optimal mobile CPU/battery usage)
export const CAMERA_INACTIVITY_TIMEOUT_MS = 45000; // 45s inactivité avant mise en veille automatique

export interface CameraQrScannerProps {
  onScan: (code: string) => void;
  isVerifying?: boolean;
  onSwitchToManual?: () => void;
  autoResumeDelayMs?: number;
  className?: string;
  onTorchToggle?: (isOn: boolean) => void;
}

export const CameraQrScanner: React.FC<CameraQrScannerProps> = ({
  onScan,
  isVerifying = false,
  onSwitchToManual,
  autoResumeDelayMs = 2200,
  className = '',
  onTorchToggle,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const zxingReaderRef = useRef<any>(null);
  const isScanningActiveRef = useRef<boolean>(true);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [supportMode, setSupportMode] = useState<ScannerSupportMode>('native');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentFacingMode, setCurrentFacingMode] = useState<'environment' | 'user'>('environment');
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>(undefined);
  const [isPausedAfterScan, setIsPausedAfterScan] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isAsleep, setIsAsleep] = useState<boolean>(false);

  // Synchronisation de l'état actif dans une ref pour la boucle de détection
  useEffect(() => {
    isScanningActiveRef.current = !isVerifying && !isPausedAfterScan && !cameraError && !isAsleep;
  }, [isVerifying, isPausedAfterScan, cameraError, isAsleep]);

  // Détection du mode de support au montage
  useEffect(() => {
    const info = detectScannerSupport();
    setSupportMode(info.mode);
  }, []);

  // Énumération des caméras disponibles (pour afficher le bouton bascule si > 1)
  const refreshAvailableCameras = useCallback(async () => {
    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
      }
    } catch {
      // Ignore enumeration errors
    }
  }, []);

  // Gestion du timer d'inactivité (45s -> mise en veille automatique + coupure torche)
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    inactivityTimerRef.current = setTimeout(() => {
      // Coupure automatique de la torche à la mise en veille
      if (activeVideoTrackRef.current) {
        setTorchState(activeVideoTrackRef.current, false).catch(() => {});
      }
      setIsTorchOn(false);
      setIsAsleep(true);
      isScanningActiveRef.current = false;
    }, CAMERA_INACTIVITY_TIMEOUT_MS);
  }, []);

  const wakeUpScanner = useCallback(() => {
    setIsAsleep(false);
    isScanningActiveRef.current = true;
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Arrêt et libération propre des pistes de la caméra
  const stopCameraStream = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (zxingReaderRef.current) {
      try {
        if (typeof zxingReaderRef.current.reset === 'function') {
          zxingReaderRef.current.reset();
        }
      } catch {
        // Ignore reset errors
      }
      zxingReaderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }

    if (activeVideoTrackRef.current) {
      // Coupure systématique de la torche
      setTorchState(activeVideoTrackRef.current, false).catch(() => {});
      activeVideoTrackRef.current = null;
    }
    setIsTorchOn(false);
    setTorchSupported(false);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Traitement d'un code détecté
  const handleCodeDetected = useCallback(
    (code: string) => {
      resetInactivityTimer();
      const trimmed = (code || '').trim();
      if (!trimmed) return;

      const now = Date.now();
      // Protection anti-rafale / doublon immédiat (debounce 1.5s)
      if (lastScannedCodeRef.current === trimmed && now - lastScannedTimeRef.current < 1500) {
        return;
      }

      lastScannedCodeRef.current = trimmed;
      lastScannedTimeRef.current = now;
      isScanningActiveRef.current = false;
      setIsPausedAfterScan(true);

      // Feedback haptique si supporté par l'appareil
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(80);
        } catch {
          // Ignore vibration permission
        }
      }

      onScan(trimmed);

      // Auto-reprise après le délai configuré
      setTimeout(() => {
        setIsPausedAfterScan(false);
        isScanningActiveRef.current = true;
      }, autoResumeDelayMs);
    },
    [onScan, autoResumeDelayMs, resetInactivityTimer]
  );

  // Boucle de détection BarcodeDetector natif
  const startNativeDetectionLoop = useCallback(
    (barcodeDetector: any) => {
      let lastCheck = 0;
      const THROTTLE_MS = CAMERA_SCAN_THROTTLE_MS; // 140ms (~7 checks/s, optimal CPU/battery preservation)

      const checkFrame = async (timestamp: number) => {
        if (!isScanningActiveRef.current) {
          animationFrameRef.current = requestAnimationFrame(checkFrame);
          return;
        }

        const video = videoRef.current;
        if (video && video.readyState >= 2 && timestamp - lastCheck >= THROTTLE_MS) {
          lastCheck = timestamp;
          try {
            const barcodes = await barcodeDetector.detect(video);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleCodeDetected(barcodes[0].rawValue);
            }
          } catch {
            // Frame detection error (e.g. video resize or transient frame drop)
          }
        }

        animationFrameRef.current = requestAnimationFrame(checkFrame);
      };

      animationFrameRef.current = requestAnimationFrame(checkFrame);
    },
    [handleCodeDetected]
  );

  // Boucle de détection ZXing (fallback logiciel)
  const startZXingDetection = useCallback(
    async (videoElement: HTMLVideoElement) => {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const codeReader = new BrowserQRCodeReader();
        zxingReaderRef.current = codeReader;

        // Décodage continu sur le flux vidéo
        codeReader.decodeFromVideoElement(videoElement, (result, err) => {
          if (!isScanningActiveRef.current) return;
          if (result && result.getText()) {
            handleCodeDetected(result.getText());
          }
        });
      } catch (err) {
        console.error('[CameraQrScanner] Erreur initialisation ZXing:', err);
        setCameraError('Impossible d\'initialiser le décodeur logiciel.');
      }
    },
    [handleCodeDetected]
  );

  // Démarrage de la caméra
  const startCameraStream = useCallback(async () => {
    setIsInitializing(true);
    setCameraError(null);
    stopCameraStream();

    const supportInfo = detectScannerSupport();
    if (supportInfo.mode === 'manual_only') {
      setCameraError(supportInfo.reason || 'Caméra non supportée dans cet environnement.');
      setIsInitializing(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: currentDeviceId
          ? { deviceId: { exact: currentDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0] || null;
      activeVideoTrackRef.current = videoTrack;
      const supported = isTorchSupported(videoTrack);
      setTorchSupported(supported);
      setIsTorchOn(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Indispensable pour iOS Safari
        videoRef.current.muted = true;

        // Démarrage sécurisé du flux vidéo sans conflit de promesses play()
        try {
          if (videoRef.current.paused) {
            await videoRef.current.play();
          }
        } catch (playErr: any) {
          if (playErr.name !== 'AbortError') {
            console.warn('[CameraQrScanner] Lecture vidéo:', playErr.message);
          }
        }

        await refreshAvailableCameras();
        resetInactivityTimer();

        // Lancement du décodeur selon le mode
        if (supportInfo.mode === 'native' && typeof (window as any).BarcodeDetector === 'function') {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          startNativeDetectionLoop(barcodeDetector);
        } else {
          await startZXingDetection(videoRef.current);
        }
      }

      setIsInitializing(false);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Interruption normale lors d'un basculement de caméra ou cycle rapide
        setIsInitializing(false);
        return;
      }

      console.warn('[CameraQrScanner] Erreur accès caméra:', err);
      setIsInitializing(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError(
          'Accès caméra refusé. Veuillez autoriser l\'accès dans les réglages de votre navigateur ou utiliser la saisie manuelle.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Aucune caméra compatible n\'a été détectée sur cet appareil.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('La caméra est actuellement utilisée par une autre application.');
      } else {
        setCameraError('Erreur d\'initialisation de la caméra. Utilisez la saisie manuelle ci-dessous.');
      }
    }
  }, [
    currentDeviceId,
    currentFacingMode,
    stopCameraStream,
    refreshAvailableCameras,
    startNativeDetectionLoop,
    startZXingDetection,
    resetInactivityTimer,
  ]);

  // Initialisation au montage et gestion des changements de caméra
  useEffect(() => {
    startCameraStream();
    return () => {
      stopCameraStream();
    };
  }, [startCameraStream, stopCameraStream]);

  // Gestion de la visibilité de l'onglet (économie de batterie sur smartphone)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCameraStream();
      } else {
        startCameraStream();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startCameraStream, stopCameraStream]);

  // Bascule Caméra Avant / Arrière
  const toggleFacingMode = () => {
    resetInactivityTimer();
    setCurrentDeviceId(undefined);
    setCurrentFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Commutation de la torche matérielle
  const handleToggleTorch = useCallback(async () => {
    resetInactivityTimer();
    const track = activeVideoTrackRef.current;
    if (!track) return;
    const nextState = !isTorchOn;
    const result = await setTorchState(track, nextState);
    if (result.success) {
      setIsTorchOn(nextState);
      if (onTorchToggle) {
        onTorchToggle(nextState);
      }
    }
  }, [isTorchOn, onTorchToggle, resetInactivityTimer]);

  // Recommencer le scan manuellement
  const handleManualResume = () => {
    resetInactivityTimer();
    setIsPausedAfterScan(false);
    isScanningActiveRef.current = true;
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Flux vidéo et viseur : surface sombre de la caméra, identique en thème clair et sombre */}
      <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-3xl border-2 border-border-strong bg-black shadow-xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />

        {/* État : chargement initial */}
        {isInitializing && (
          <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-scrim/80 p-6 text-center text-white backdrop-blur-xs">
            <RefreshCw size={32} aria-hidden="true" className="text-brand-decor motion-safe:animate-spin" />
            <p className="text-sm font-semibold">Initialisation de la caméra…</p>
          </div>
        )}

        {/* État : erreur d'accès ou permission refusée */}
        {cameraError && (
          <div role="alert" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-scrim/95 p-6 text-center text-white">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white" aria-hidden="true">
              <ShieldAlert size={24} />
            </span>
            <div className="flex max-w-xs flex-col gap-1">
              <h4 className="text-base font-semibold">Caméra indisponible</h4>
              <p className="text-sm leading-relaxed text-white/85">{cameraError}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="glass" onClick={startCameraStream} leftIcon={<RefreshCw size={16} />}>
                Réessayer
              </Button>
              {onSwitchToManual && (
                <Button variant="primary" onClick={onSwitchToManual}>
                  Saisie manuelle
                </Button>
              )}
            </div>
          </div>
        )}

        {/* État : mise en veille automatique après 45 s d'inactivité */}
        {isAsleep && !cameraError && (
          <div
            data-testid="scanner-sleep-overlay"
            onClick={wakeUpScanner}
            className="pointer-events-auto absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center gap-3 bg-scrim/90 p-6 text-center text-white backdrop-blur-sm"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white" aria-hidden="true">
              <PowerOff size={24} />
            </span>
            <div className="flex max-w-xs flex-col gap-1">
              <h4 className="text-base font-semibold">Scanner en veille</h4>
              <p className="text-sm leading-relaxed text-white/85">
                Mis en veille après 45 secondes d’inactivité pour économiser la batterie.
              </p>
            </div>
            <Button variant="primary" onClick={(e) => { e.stopPropagation(); wakeUpScanner(); }} leftIcon={<Sparkles size={16} />}>
              Réactiver la caméra
            </Button>
          </div>
        )}

        {/* Viseur de cadrage et ligne de balayage (décor) */}
        {!cameraError && !isInitializing && !isAsleep && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="relative flex h-60 max-h-full w-60 max-w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-brand-decor">
              <div className="absolute -left-1 -top-1 h-5 w-5 rounded-tl-sm border-l-4 border-t-4 border-white" aria-hidden="true" />
              <div className="absolute -right-1 -top-1 h-5 w-5 rounded-tr-sm border-r-4 border-t-4 border-white" aria-hidden="true" />
              <div className="absolute -bottom-1 -left-1 h-5 w-5 rounded-bl-sm border-b-4 border-l-4 border-white" aria-hidden="true" />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-br-sm border-b-4 border-r-4 border-white" aria-hidden="true" />

              {!isPausedAfterScan && !isVerifying && (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-brand-decor to-transparent motion-safe:animate-bounce" aria-hidden="true" />
              )}

              {/* État : billet lu ou vérification en cours */}
              {(isPausedAfterScan || isVerifying) && (
                <div className="absolute inset-0 flex items-center justify-center bg-scrim/40 backdrop-blur-xs">
                  <span role="status" className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-fg shadow-lg">
                    {isVerifying ? (
                      <>
                        <RefreshCw size={16} aria-hidden="true" className="text-brand-fg motion-safe:animate-spin" />
                        Vérification…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} aria-hidden="true" className="text-success-fg" />
                        Billet lu
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Commandes posées sur le flux vidéo */}
        {!cameraError && !isInitializing && !isAsleep && (
          <>
            {/* Torche en haut à droite (accès direct à une main) */}
            <div className="pointer-events-auto absolute right-3 top-3 z-30">
              {torchSupported ? (
                <button
                  type="button"
                  data-testid="torch-toggle-btn"
                  onClick={handleToggleTorch}
                  aria-pressed={isTorchOn}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-2xl border px-3.5 text-sm font-semibold shadow-lg backdrop-blur-md transition-colors duration-200 motion-safe:active:scale-95',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isTorchOn ? 'border-warning-border bg-warning-bg text-warning-fg' : 'border-white/20 bg-black/70 text-white hover:bg-black/90',
                  )}
                >
                  {isTorchOn ? <Flashlight size={18} aria-hidden="true" /> : <FlashlightOff size={18} aria-hidden="true" />}
                  <span>{isTorchOn ? 'Torche allumée' : 'Torche éteinte'}</span>
                </button>
              ) : (
                /* Repli pour iOS Safari et les appareils sans flash : rien n'est affiché, sans erreur */
                <span data-testid="torch-unsupported-fallback" className="hidden" />
              )}
            </div>

            {/* Barre basse : état du scanner et changement de caméra */}
            <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-sm font-medium text-white backdrop-blur-md">
                <Camera size={16} aria-hidden="true" className="text-brand-decor" />
                Scanner actif
              </span>

              {availableCameras.length > 1 && (
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  aria-label="Changer de caméra"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition-colors duration-200 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:active:scale-95"
                >
                  <SwitchCamera size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Reprise immédiate lors d'un scan en rafale */}
      {isPausedAfterScan && !isVerifying && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={handleManualResume} leftIcon={<QrCode size={18} />}>
            Scanner le billet suivant
          </Button>
        </div>
      )}
    </div>
  );
};
