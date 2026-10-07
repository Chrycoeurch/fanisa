/**
 * qrScanner.ts — Utilitaire de scan QR pour FANISA
 *
 * Utilise l'API Camera du navigateur (MediaDevices) pour lire les QR codes
 * des carnets Fokontany. Fonctionne en HTTPS uniquement.
 *
 * Compatible avec les lecteurs QR USB/Bluetooth (mode clavier HID) :
 * l'agent clique dans un champ input et scanne — le lecteur tape l'identifiant.
 */

import { normaliserId, idValide } from './koboMapping';

export { normaliserId, idValide };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QrScanResult {
  raw: string;
  normalised: string;
  valid: boolean;
}

// ── Scanner caméra ────────────────────────────────────────────────────────────

/**
 * Démarre le scan QR via la caméra.
 * Retourne une fonction stop() pour arrêter le scan.
 *
 * @param videoEl   L'élément <video> qui affiche le flux caméra
 * @param onResult  Callback appelé à chaque QR détecté
 * @param onError   Callback en cas d'erreur caméra
 */
export async function startQrScanner(
  videoEl: HTMLVideoElement,
  onResult: (result: QrScanResult) => void,
  onError: (err: string) => void
): Promise<() => void> {
  // Vérifier la disponibilité de BarcodeDetector (Chrome/Edge) ou fallback canvas
  const hasBarcodeDetector = typeof (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector !== 'undefined';

  let stream: MediaStream | null = null;
  let animFrame: number | null = null;
  let stopped = false;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    videoEl.srcObject = stream;
    videoEl.play();
  } catch (e) {
    onError(`Caméra inaccessible : ${e instanceof Error ? e.message : String(e)}`);
    return () => {};
  }

  const lastSeen = new Set<string>();

  if (hasBarcodeDetector) {
    // ── BarcodeDetector API (Chrome 83+, Edge) ────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

    const detect = async () => {
      if (stopped) return;
      try {
        const barcodes = await detector.detect(videoEl);
        for (const bc of barcodes) {
          const raw: string = bc.rawValue;
          if (!lastSeen.has(raw)) {
            lastSeen.add(raw);
            setTimeout(() => lastSeen.delete(raw), 3000); // anti-spam
            const normalised = normaliserId(raw);
            onResult({ raw, normalised, valid: idValide(normalised) });
          }
        }
      } catch { /* frame ignorée */ }
      animFrame = requestAnimationFrame(detect);
    };
    videoEl.addEventListener('loadeddata', () => { animFrame = requestAnimationFrame(detect); }, { once: true });

  } else {
    // ── Fallback : canvas + jsQR ──────────────────────────────────────────────
    let jsQR: ((data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;

    // Chargement dynamique de jsQR (CDN)
    await new Promise<void>((resolve) => {
      if ((window as unknown as Record<string, unknown>)['jsQR']) { jsQR = (window as unknown as Record<string, unknown>)['jsQR'] as typeof jsQR; resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      s.onload = () => { jsQR = (window as unknown as Record<string, unknown>)['jsQR'] as typeof jsQR; resolve(); };
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const tick = () => {
      if (stopped) return;
      if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && ctx && jsQR) {
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);
        if (code && !lastSeen.has(code.data)) {
          lastSeen.add(code.data);
          setTimeout(() => lastSeen.delete(code.data), 3000);
          const normalised = normaliserId(code.data);
          onResult({ raw: code.data, normalised, valid: idValide(normalised) });
        }
      }
      animFrame = requestAnimationFrame(tick);
    };
    animFrame = requestAnimationFrame(tick);
  }

  // Fonction stop
  return () => {
    stopped = true;
    if (animFrame !== null) cancelAnimationFrame(animFrame);
    if (stream) stream.getTracks().forEach(t => t.stop());
    videoEl.srcObject = null;
  };
}
