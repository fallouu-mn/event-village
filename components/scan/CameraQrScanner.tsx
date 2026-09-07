'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, SwitchCamera, AlertCircle, RefreshCw, QrCode, ShieldAlert, Sparkles, Flashlight, FlashlightOff, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
        await videoRef.current.play();

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
    <div className={`space-y-4 ${className}`}>
      {/* Conteneur Vidéo & Viseur */}
      <div className="relative w-full aspect-square max-w-sm mx-auto rounded-3xl bg-black border-2 border-slate-800 dark:border-zinc-800 overflow-hidden shadow-xl flex items-center justify-center">
        {/* Flux vidéo */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* État : Chargement initial */}
        {isInitializing && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white space-y-3 z-20">
            <RefreshCw className="w-8 h-8 animate-spin text-[#FF5722]" />
            <p className="text-xs font-bold tracking-wide">Initialisation de la caméra...</p>
          </div>
        )}

        {/* État : Erreur d'accès / Permission refusée */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center text-white space-y-4 z-30">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center">
              <ShieldAlert size={24} />
            </div>
            <div className="space-y-1 max-w-xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-red-400">Caméra Indisponible</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">{cameraError}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={startCameraStream}>
                <RefreshCw size={14} className="mr-1.5" />
                Réessayer
              </Button>
              {onSwitchToManual && (
                <Button size="sm" variant="primary" onClick={onSwitchToManual}>
                  Mode Manuel
                </Button>
              )}
            </div>
          </div>
        )}

        {/* État : Mise en veille automatique après 45s d'inactivité */}
        {isAsleep && !cameraError && (
          <div
            data-testid="scanner-sleep-overlay"
            onClick={wakeUpScanner}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white space-y-3 z-30 cursor-pointer pointer-events-auto"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center animate-pulse">
              <PowerOff size={24} />
            </div>
            <div className="space-y-1 max-w-xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">Scanner en veille</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Mis en veille après 45s d'inactivité pour économiser la batterie.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); wakeUpScanner(); }}>
              <Sparkles size={14} className="mr-1.5" />
              Réactiver la caméra
            </Button>
          </div>
        )}

        {/* Viseur de Cadrage & Ligne Laser Animée */}
        {!cameraError && !isInitializing && !isAsleep && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-10">
            <div className="relative w-60 h-60 rounded-2xl border-2 border-[#FF5722] shadow-[0_0_20px_rgba(255,87,34,0.35)] flex items-center justify-center overflow-hidden">
              {/* Coins de cadrage renforcés */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-white rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-white rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-white rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-white rounded-br-sm" />

              {/* Ligne Laser de Balayage */}
              {!isPausedAfterScan && !isVerifying && (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#FF5722] to-transparent shadow-[0_0_12px_#FF5722] animate-bounce" />
              )}

              {/* État : Pause / En cours de validation */}
              {(isPausedAfterScan || isVerifying) && (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center">
                  <span className="px-3 py-1.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 text-slate-900 dark:text-white text-[11px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                    {isVerifying ? (
                      <>
                        <RefreshCw size={12} className="animate-spin text-[#FF5722]" />
                        Vérification...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} className="text-emerald-500" />
                        Scanné !
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contrôles intégrés sur le flux vidéo */}
        {!cameraError && !isInitializing && !isAsleep && (
          <>
            {/* Bouton Torche en haut à droite (Accès direct à une main) */}
            <div className="absolute top-3 right-3 z-30 pointer-events-auto">
              {torchSupported ? (
                <button
                  type="button"
                  data-testid="torch-toggle-btn"
                  onClick={handleToggleTorch}
                  aria-label={isTorchOn ? 'Éteindre la torche' : 'Allumer la torche'}
                  className={`min-h-[44px] px-3.5 py-2 rounded-2xl backdrop-blur-md font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-lg border ${
                    isTorchOn
                      ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.6)] ring-2 ring-amber-300/50'
                      : 'bg-black/70 text-white hover:bg-black/90 border-white/20'
                  }`}
                >
                  {isTorchOn ? (
                    <Flashlight size={18} className="text-black fill-current animate-pulse" />
                  ) : (
                    <FlashlightOff size={18} className="text-slate-300" />
                  )}
                  <span>{isTorchOn ? 'Torche ON' : 'Torche'}</span>
                </button>
              ) : (
                /* Fallback gracieux pour iOS Safari et appareils sans flash : masquage sans crash */
                <span data-testid="torch-unsupported-fallback" className="hidden" />
              )}
            </div>

            {/* Barre de contrôle basse */}
            <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-auto z-20">
              {/* Badge Mode Actif */}
              <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white/90 border border-white/10 flex items-center gap-1">
                <Camera size={12} className="text-[#FF5722]" />
                <span>Scanner actif</span>
              </span>

              <div className="flex items-center gap-2">
                {/* Bouton Bascule Caméra Avant / Arrière (visible si plusieurs caméras) */}
                {availableCameras.length > 1 && (
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="min-h-[44px] min-w-[44px] p-2.5 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/80 transition-all border border-white/10 active:scale-95 flex items-center justify-center"
                    title="Changer de caméra"
                  >
                    <SwitchCamera size={18} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bouton de reprise immédiate lors d'un scan en rafale */}
      {isPausedAfterScan && !isVerifying && (
        <div className="text-center">
          <Button size="sm" variant="secondary" onClick={handleManualResume}>
            <QrCode size={14} className="mr-1.5 text-[#FF5722]" />
            Scanner le billet suivant
          </Button>
        </div>
      )}
    </div>
  );
};
