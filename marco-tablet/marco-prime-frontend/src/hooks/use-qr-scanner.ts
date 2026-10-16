import { useEffect, useRef, useState } from "preact/hooks";
import type { RefObject } from "preact";

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

const DETECT_INTERVAL_MS = 250;
const AUTO_CLOSE_MS = 30_000;
const HAVE_CURRENT_DATA = 2;

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | undefined {
  return (globalThis as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
}

function cameraSupported() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export interface QrScanner {
  supported: boolean;
  active: boolean;
  error: string | null;
  videoRef: RefObject<HTMLVideoElement>;
  start: () => void;
  stop: () => void;
}

export function useQrScanner(onResult: (text: string) => void): QrScanner {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const autoCloseRef = useRef<number | undefined>(undefined);
  const onResultRef = useRef(onResult);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  onResultRef.current = onResult;

  const supported = cameraSupported() && getBarcodeDetectorCtor() !== undefined;

  const releaseCamera = () => {
    window.clearInterval(timerRef.current);
    window.clearTimeout(autoCloseRef.current);
    timerRef.current = undefined;
    autoCloseRef.current = undefined;
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const stop = () => {
    releaseCamera();
    setActive(false);
  };

  const start = async () => {
    if (active) return;
    setError(null);

    if (!cameraSupported()) {
      setError("Cette tablette ne propose pas de caméra utilisable.");
      return;
    }
    if (getBarcodeDetectorCtor() === undefined) {
      setError(
        "La lecture de QR code n'est pas prise en charge par le navigateur.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);
    } catch {
      setError("Impossible d'ouvrir la caméra. Vérifiez qu'elle est autorisée.");
    }
  };

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    const play = video.play();
    if (play) play.catch(() => {});

    return () => releaseCamera();
  }, [active]);

  // Fermeture automatique si aucun QR n'est lu.
  useEffect(() => {
    if (!active) return;
    autoCloseRef.current = window.setTimeout(stop, AUTO_CLOSE_MS);
    return () => window.clearTimeout(autoCloseRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const Detector = getBarcodeDetectorCtor();
    if (!Detector) return;

    const detector = new Detector({ formats: ["qr_code"] });
    timerRef.current = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < HAVE_CURRENT_DATA) return;
      try {
        const codes = await detector.detect(video);
        const value = codes.find((code) => code.rawValue)?.rawValue;
        if (value) {
          releaseCamera();
          setActive(false);
          onResultRef.current(value);
        }
      } catch {
        /* image non exploitable, on réessaie au prochain tick */
      }
    }, DETECT_INTERVAL_MS);

    return () => {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    };
  }, [active]);

  return {
    supported,
    active,
    error,
    videoRef,
    start: () => void start(),
    stop,
  };
}
