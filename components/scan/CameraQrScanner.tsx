'use client';

/**
 * Caméra du scanner (lot 4, refondue au lot 7, tâche 7.2 ; décisions D48, D50 ; amendement A6).
 *
 * Une seule boucle de détection à la fois, jamais orpheline :
 *  - chaque démarrage de la caméra reçoit un jeton de session (sessionRef) ; un démarrage dépassé par un
 *    autre (changement de caméra, retour au premier plan, démontage) libère aussitôt le flux qu'il obtient
 *    et ne lance aucune boucle ;
 *  - chaque boucle reçoit son propre numéro (loopRef) et s'arrête dès qu'il change ; pause, veille,
 *    arrière-plan et démontage changent ce numéro : la boucle est réellement arrêtée, pas seulement muette ;
 *  - `onScan` est lu par une ref : la boucle appelle toujours le gestionnaire courant de la page, jamais
 *    une fermeture périmée (défaut du lot 6 trouvé au run 73 : une boucle gardait un `isVerifying` vrai et
 *    avalait chaque lecture en silence) ;
 *  - toute lecture écartée laisse une trace (console) ; la page trace celles qu'elle ignore.
 * Après une lecture acceptée par la page, la boucle s'arrête jusqu'à la reprise (`paused` repasse à faux).
 * Décodage : BarcodeDetector natif, sinon décodeur logiciel image par image (même boucle, même arrêt) : ZXing et
 * jsQR en alternance, une image sur deux chacun (jsQR chargé à la demande sans retarder la caméra). Run 80 (fumée, étape 5) : ZXing (@zxing/library 0.23, comme
 * 0.21.3 et 0.22.0) ne lit pas certains QR de billet pourtant valides, quelle que soit l'image (≈ 8 % des QR
 * dynamiques sur l'image de la caméra simulée, ≈ 5 % sur des QR parfaits) ; jsQR les lit tous sur les mêmes
 * images. Le décodeur actif est exposé par `data-scan-decoder` (native, zxing+jsqr, zxing).
 * Caméra libérée (getTracks().stop()) en arrière-plan (visibilitychange) et après 3 min sans lecture
 * (veille, réveil par un toucher). Aucune vibration ici (D50 : seul le verdict vibre), aucun son.
 * Fonds opaques (jetons --scan-tech-*), ligne de visée fixe, aucune animation.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Flashlight, FlashlightOff, PauseCircle, PowerOff, RefreshCw, ShieldAlert, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { detectScannerSupport } from '@/lib/scanner/support';
import { isTorchSupported, setTorchState } from '@/lib/hardware/torch';

/** Intervalle entre deux analyses d'image (≈ 7 par seconde : batterie et processeur ménagés). */
export const CAMERA_SCAN_THROTTLE_MS = 140;
/** Veille de la caméra après 3 min sans lecture (D48). */
export const CAMERA_INACTIVITY_TIMEOUT_MS = 3 * 60_000;
/** Reprise de sécurité si la page accepte une lecture sans se mettre en pause. */
const HOLD_RELEASE_MS = 2000;
/** Largeur maximale de l'image analysée par ZXing. */
const ZXING_MAX_WIDTH = 640;

export type CameraReadVerdict = 'accepted' | 'ignored';

export interface CameraQrScannerProps {
  /** Lecture d'un code. « accepted » : la caméra s'arrête jusqu'à la reprise ; « ignored » : elle continue. */
  onScan: (code: string) => CameraReadVerdict;
  /** Pause demandée par la page (envoi, résultat affiché, encaissement) : boucle de détection arrêtée. */
  paused?: boolean;
  onSwitchToManual?: () => void;
  /** Délai de veille (ms). */
  idleTimeoutMs?: number;
  /** Calque posé sur l'image (état d'envoi). */
  overlay?: React.ReactNode;
  className?: string;
}

type Phase = 'starting' | 'live' | 'error' | 'asleep' | 'background';

interface NativeDetector { detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>> }
interface ZxingReader { decodeFromCanvas(canvas: HTMLCanvasElement): { getText(): string } }
type JsQrDecode = (data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: 'dontInvert' }) => { data?: string } | null;
type Decoder =
  | { kind: 'native'; detector: NativeDetector }
  | { kind: 'zxing'; reader: ZxingReader; jsqr: JsQrDecode | null; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; frame: number };

/** jsQR, chargé avec ZXing ; null s'il ne charge pas (ZXing seul, tracé). */
async function loadJsQr(): Promise<JsQrDecode | null> {
  try {
    const mod = (await import('jsqr')) as unknown as { default?: unknown };
    const fn = typeof mod.default === 'function' ? mod.default : mod;
    if (typeof fn !== 'function') throw new Error('module jsqr sans fonction de décodage');
    return fn as JsQrDecode;
  } catch (err) {
    console.warn('[camera] décodeur jsQR indisponible : ZXing seul', err instanceof Error ? err.message : String(err));
    return null;
  }
}

function stopTracks(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch (err) {
      console.warn('[camera] arrêt d’une piste impossible :', err instanceof Error ? err.message : String(err));
    }
  }
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur, ou passez en saisie manuelle.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'Aucune caméra compatible n’a été détectée sur cet appareil.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'La caméra est utilisée par une autre application.';
  return 'La caméra n’a pas pu démarrer. Réessayez ou passez en saisie manuelle.';
}

/** Exception « rien trouvé » de ZXing (attendue à chaque image sans QR) : elle porte getKind(). */
function isZxingMiss(err: unknown): boolean {
  return typeof err === 'object' && err !== null && typeof (err as { getKind?: unknown }).getKind === 'function';
}

export const CameraQrScanner: React.FC<CameraQrScannerProps> = ({
  onScan,
  paused = false,
  onSwitchToManual,
  idleTimeoutMs = CAMERA_INACTIVITY_TIMEOUT_MS,
  overlay,
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const decoderRef = useRef<Decoder | null>(null);
  const sessionRef = useRef(0);
  const loopRef = useRef(0);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdRef = useRef(false);
  const pausedRef = useRef(paused);
  const phaseRef = useRef<Phase>('starting');
  const onScanRef = useRef(onScan);
  const idleMsRef = useRef(idleTimeoutMs);
  const facingRef = useRef<'environment' | 'user'>('environment');
  const lastDecodeWarnRef = useRef(0);

  const [phase, setPhaseState] = useState<Phase>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraCount, setCameraCount] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  /** Décodeur actif (attribut data-scan-decoder : diagnostic des tests de bout en bout). */
  const [decoderKind, setDecoderKind] = useState<'native' | 'zxing+jsqr' | 'zxing' | null>(null);

  onScanRef.current = onScan;
  idleMsRef.current = idleTimeoutMs;

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const clearTimer = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  /** Arrête la boucle courante (son numéro change : elle sort à sa prochaine image). */
  const stopLoop = useCallback(() => {
    loopRef.current += 1;
    clearTimer(loopTimerRef);
  }, []);

  /** Libère le flux : pistes arrêtées, torche éteinte, vidéo détachée. */
  const releaseStream = useCallback(() => {
    const track = trackRef.current;
    if (track && isTorchSupported(track)) {
      setTorchState(track, false).then((r) => {
        if (!r.success && r.error) console.warn('[camera] extinction de la torche :', r.error);
      }, (err: unknown) => console.warn('[camera] extinction de la torche :', err instanceof Error ? err.message : String(err)));
    }
    trackRef.current = null;
    stopTracks(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  /** Arrêt complet : session close (tout démarrage en cours est abandonné), boucle et flux arrêtés. */
  const stopCamera = useCallback(() => {
    sessionRef.current += 1;
    stopLoop();
    clearTimer(idleTimerRef);
    clearTimer(holdTimerRef);
    releaseStream();
  }, [releaseStream, stopLoop]);

  const decodeFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    const decoder = decoderRef.current;
    if (!video || !decoder || video.readyState < 2) return null;
    try {
      if (decoder.kind === 'native') {
        const codes = await decoder.detector.detect(video);
        const raw = codes?.[0]?.rawValue;
        return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
      }
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return null;
      const scale = Math.min(1, ZXING_MAX_WIDTH / w);
      decoder.canvas.width = Math.round(w * scale);
      decoder.canvas.height = Math.round(h * scale);
      decoder.ctx.drawImage(video, 0, 0, decoder.canvas.width, decoder.canvas.height);
      decoder.frame += 1;
      if (decoder.jsqr && decoder.frame % 2 === 0) {
        // Une image sur deux : jsQR, qui lit les QR valides que ZXing rate (run 80) ; même coût par image
        const image = decoder.ctx.getImageData(0, 0, decoder.canvas.width, decoder.canvas.height);
        const found = decoder.jsqr(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        const text = typeof found?.data === 'string' ? found.data.trim() : '';
        return text !== '' ? text : null;
      }
      try {
        const text = decoder.reader.decodeFromCanvas(decoder.canvas).getText();
        return text && text.trim() !== '' ? text.trim() : null;
      } catch (err) {
        if (isZxingMiss(err)) return null;
        throw err;
      }
    } catch (err) {
      if (decoder.kind === 'native' && err instanceof Error && err.name === 'NotSupportedError') {
        // API présente mais sans décodeur QR sur cet appareil : bascule sur le décodeur logiciel
        console.warn('[camera] BarcodeDetector sans prise en charge du QR : passage au décodeur logiciel');
        decoderRef.current = null;
        return null;
      }
      const now = Date.now();
      if (now - lastDecodeWarnRef.current > 10_000) {
        lastDecodeWarnRef.current = now;
        console.warn('[camera] analyse d’image impossible (nouvel essai à l’image suivante) :', err instanceof Error ? err.message : String(err));
      }
      return null;
    }
  }, []);

  const goToSleep = useCallback(() => {
    console.info('[camera] veille : aucune lecture depuis', Math.round(idleMsRef.current / 1000), 's, caméra libérée');
    stopCamera();
    setPhase('asleep');
  }, [setPhase, stopCamera]);

  const armIdleTimer = useCallback(() => {
    clearTimer(idleTimerRef);
    if (idleMsRef.current > 0) idleTimerRef.current = setTimeout(goToSleep, idleMsRef.current);
  }, [goToSleep]);

  /** Lance la boucle de détection (une seule : la précédente est arrêtée). */
  const startLoop = useCallback(() => {
    stopLoop();
    if (phaseRef.current !== 'live' || pausedRef.current || holdRef.current) return;
    const loopId = loopRef.current;
    const session = sessionRef.current;
    const alive = () => loopId === loopRef.current && session === sessionRef.current;
    const tick = async (): Promise<void> => {
      loopTimerRef.current = null;
      if (!alive() || pausedRef.current || holdRef.current) return;
      if (!decoderRef.current) {
        try {
          await ensureDecoderRef.current('zxing');
        } catch (err) {
          console.error('[camera] décodeur logiciel indisponible :', err instanceof Error ? err.message : String(err));
          return;
        }
      }
      const code = await decodeFrame();
      if (!alive() || pausedRef.current || holdRef.current) {
        if (code) console.info('[camera] lecture arrivée pendant une pause : écartée, le QR sera relu à la reprise');
        return;
      }
      if (code) {
        armIdleTimer();
        let verdict: CameraReadVerdict = 'ignored';
        try {
          verdict = onScanRef.current(code);
        } catch (err) {
          console.error('[camera] traitement de la lecture en échec :', err instanceof Error ? err.message : String(err));
        }
        if (verdict === 'accepted') {
          holdRef.current = true;
          clearTimer(holdTimerRef);
          holdTimerRef.current = setTimeout(() => {
            holdTimerRef.current = null;
            if (holdRef.current && !pausedRef.current) {
              console.warn('[camera] lecture acceptée sans mise en pause de la page : détection reprise');
              holdRef.current = false;
              startLoopRef.current();
            }
          }, HOLD_RELEASE_MS);
          return;
        }
      }
      if (alive()) loopTimerRef.current = setTimeout(() => { void tick(); }, CAMERA_SCAN_THROTTLE_MS);
    };
    void tick();
  }, [armIdleTimer, decodeFrame, stopLoop]);

  const ensureDecoderRef = useRef<(mode: 'native' | 'zxing') => Promise<Decoder | null>>(async () => null);
  const startLoopRef = useRef(startLoop);
  startLoopRef.current = startLoop;

  const ensureDecoder = useCallback(async (mode: 'native' | 'zxing'): Promise<Decoder | null> => {
    if (decoderRef.current) return decoderRef.current;
    const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => NativeDetector }).BarcodeDetector;
    if (mode === 'native' && typeof Native === 'function') {
      decoderRef.current = { kind: 'native', detector: new Native({ formats: ['qr_code'] }) };
      setDecoderKind('native');
      return decoderRef.current;
    }
    // jsQR (≈ 47 Ko gzip) se charge en parallèle sans retarder la caméra : ZXing lit seul jusqu'à son arrivée
    const jsqrLoading = loadJsQr();
    const { BrowserQRCodeReader } = await import('@zxing/browser');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas 2D indisponible pour le décodeur logiciel');
    const decoder: Extract<Decoder, { kind: 'zxing' }> = { kind: 'zxing', reader: new BrowserQRCodeReader() as unknown as ZxingReader, jsqr: null, canvas, ctx, frame: 0 };
    decoderRef.current = decoder;
    setDecoderKind('zxing');
    void jsqrLoading.then((jsqr) => {
      if (!jsqr || decoderRef.current !== decoder) return;
      decoder.jsqr = jsqr;
      setDecoderKind('zxing+jsqr');
    });
    return decoder;
  }, []);
  ensureDecoderRef.current = ensureDecoder;

  /** Démarrage (ou redémarrage) : nouvelle session ; un résultat arrivé après une autre session est jeté. */
  const startCamera = useCallback(async () => {
    stopCamera();
    const session = sessionRef.current;
    holdRef.current = false;
    setCameraError(null);
    setPhase('starting');

    const support = detectScannerSupport();
    if (support.mode === 'manual_only') {
      setCameraError(support.reason || 'Caméra non prise en charge par ce navigateur.');
      setPhase('error');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facingRef.current, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (err) {
      if (session !== sessionRef.current) return;
      console.warn('[camera] accès caméra refusé ou impossible :', err instanceof Error ? `${err.name} ${err.message}` : String(err));
      setCameraError(cameraErrorMessage(err));
      setPhase('error');
      return;
    }
    if (session !== sessionRef.current) {
      // Démarrage dépassé (changement de caméra, arrière-plan, démontage) : ce flux n'est à personne
      stopTracks(stream);
      return;
    }
    streamRef.current = stream;
    const track = stream.getVideoTracks()[0] ?? null;
    trackRef.current = track;
    setTorchSupported(isTorchSupported(track));

    const video = videoRef.current;
    if (!video) {
      console.warn('[camera] élément vidéo absent : caméra libérée');
      stopCamera();
      return;
    }
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    try {
      await video.play();
    } catch (err) {
      if (session !== sessionRef.current) return;
      console.warn('[camera] lecture de la vidéo :', err instanceof Error ? err.message : String(err));
    }
    if (session !== sessionRef.current) return;

    try {
      await ensureDecoder(support.mode === 'native' ? 'native' : 'zxing');
    } catch (err) {
      if (session !== sessionRef.current) return;
      console.error('[camera] décodeur indisponible :', err instanceof Error ? err.message : String(err));
      stopCamera();
      setCameraError('Le décodeur de QR n’a pas pu démarrer. Passez en saisie manuelle.');
      setPhase('error');
      return;
    }
    if (session !== sessionRef.current) return;

    setPhase('live');
    armIdleTimer();
    if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
      navigator.mediaDevices.enumerateDevices().then(
        (list) => { if (session === sessionRef.current) setCameraCount(list.filter((d) => d.kind === 'videoinput').length); },
        (err: unknown) => console.warn('[camera] liste des caméras illisible :', err instanceof Error ? err.message : String(err)),
      );
    }
    startLoop();
  }, [armIdleTimer, ensureDecoder, setPhase, startLoop, stopCamera]);

  const startCameraRef = useRef(startCamera);
  startCameraRef.current = startCamera;

  // Montage : démarrage ; démontage : tout est libéré (y compris un démarrage encore en attente)
  useEffect(() => {
    void startCameraRef.current();
    return () => stopCamera();
  }, [stopCamera]);

  // Pause de la page : boucle arrêtée ; reprise : la lecture acceptée est libérée et la boucle relancée
  useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      stopLoop();
      clearTimer(idleTimerRef);
      return;
    }
    holdRef.current = false;
    clearTimer(holdTimerRef);
    if (phaseRef.current === 'live') {
      armIdleTimer();
      startLoopRef.current();
    }
  }, [paused, armIdleTimer, stopLoop]);

  // Arrière-plan : caméra réellement libérée ; premier plan : redémarrage (sauf veille)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (phaseRef.current !== 'asleep') {
          stopCamera();
          setPhase('background');
        }
      } else if (phaseRef.current === 'background') {
        void startCameraRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [setPhase, stopCamera]);

  const switchCamera = () => {
    facingRef.current = facingRef.current === 'environment' ? 'user' : 'environment';
    void startCamera();
  };

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    armIdleTimer();
    const next = !torchOn;
    const result = await setTorchState(track, next);
    if (result.success) setTorchOn(next);
    else console.warn('[camera] torche :', result.error ?? 'commande refusée');
  };

  const live = phase === 'live';

  return (
    <div className={cn('flex flex-col gap-3', className)} data-scan-decoder={decoderKind ?? undefined}>
      <div className="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-3xl border-2 border-border-strong bg-scan-tech-bg">
        <video ref={videoRef} autoPlay playsInline muted aria-label="Image de la caméra" className="h-full w-full object-cover" />

        {phase === 'starting' && (
          <div role="status" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-scan-tech-bg p-6 text-center text-scan-tech-fg">
            <RefreshCw size={32} aria-hidden="true" />
            <p className="text-base font-semibold">Démarrage de la caméra…</p>
          </div>
        )}

        {phase === 'error' && (
          <div role="alert" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-scan-tech-bg p-6 text-center text-scan-tech-fg">
            <ShieldAlert size={32} aria-hidden="true" />
            <div className="flex max-w-xs flex-col gap-1">
              <p className="text-base font-semibold">Caméra indisponible</p>
              <p className="text-sm leading-relaxed">{cameraError}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => void startCamera()} leftIcon={<RefreshCw size={16} />}>
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

        {(phase === 'asleep' || phase === 'background') && (
          <div data-testid="scanner-sleep-overlay" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-scan-tech-bg p-6 text-center text-scan-tech-fg">
            <PowerOff size={32} aria-hidden="true" />
            <div className="flex max-w-xs flex-col gap-1">
              <p className="text-base font-semibold">Caméra en veille</p>
              <p className="text-sm leading-relaxed">
                {phase === 'asleep' ? 'Aucun billet lu depuis 3 minutes : la caméra est coupée pour la batterie.' : 'Application en arrière-plan : la caméra est coupée.'}
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={() => void startCamera()} leftIcon={<Camera size={18} />}>
              Reprendre le contrôle
            </Button>
          </div>
        )}

        {live && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-8" aria-hidden="true">
            <div className="relative h-60 max-h-full w-60 max-w-full rounded-2xl border-2 border-scan-tech-fg">
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-brand-decor" />
            </div>
          </div>
        )}

        {live && overlay}

        {live && (
          <>
            {torchSupported && (
              <button
                type="button"
                data-testid="torch-toggle-btn"
                onClick={() => void toggleTorch()}
                aria-pressed={torchOn}
                className="absolute right-3 top-3 z-30 flex min-h-11 items-center gap-2 rounded-2xl border border-border-strong bg-scan-tech-bg px-3.5 text-sm font-semibold text-scan-tech-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {torchOn ? <Flashlight size={18} aria-hidden="true" /> : <FlashlightOff size={18} aria-hidden="true" />}
                <span>{torchOn ? 'Torche allumée' : 'Torche éteinte'}</span>
              </button>
            )}
            <div className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between gap-2">
              <span className="flex min-h-9 items-center gap-1.5 rounded-full bg-scan-tech-bg px-3 text-sm font-semibold text-scan-tech-fg">
                {paused ? <PauseCircle size={16} aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
                {paused ? 'Détection en pause' : 'Présentez le QR'}
              </span>
              {cameraCount > 1 && (
                <button
                  type="button"
                  onClick={switchCamera}
                  aria-label="Changer de caméra"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-border-strong bg-scan-tech-bg text-scan-tech-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SwitchCamera size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
