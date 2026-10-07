/**
 * QrScannerModal.tsx — Modal de scan QR caméra pour FANISA
 *
 * Ouvre la caméra du téléphone/PC, détecte le QR code du carnet Fokontany,
 * valide le format AMB-QQQ-YY-T-XXXXX et retourne le menage_id.
 *
 * Fonctionne aussi avec un lecteur QR USB/Bluetooth (mode clavier HID) :
 * dans ce cas, passer par le champ de saisie manuelle en bas.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, Keyboard, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { startQrScanner, QrScanResult, idValide, normaliserId } from '../lib/qrScanner';

interface Props {
  onResult: (menageId: string) => void;
  onClose: () => void;
}

export default function QrScannerModal({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef  = useRef<(() => void) | null>(null);

  const [mode, setMode]           = useState<'camera' | 'manual'>('camera');
  const [cameraErr, setCameraErr] = useState('');
  const [scanning, setScanning]   = useState(false);
  const [lastResult, setLastResult] = useState<QrScanResult | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState('');

  // ── Démarrer la caméra ───────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraErr('');
    setScanning(true);
    setLastResult(null);

    stopRef.current = await startQrScanner(
      videoRef.current,
      (result) => {
        setLastResult(result);
        if (result.valid) {
          // Flash vert puis fermeture automatique
          setTimeout(() => {
            onResult(result.normalised);
            onClose();
          }, 600);
        }
      },
      (err) => {
        setCameraErr(err);
        setScanning(false);
      }
    );
  }, [onResult, onClose]);

  // Démarrer auto en mode caméra
  useEffect(() => {
    if (mode === 'camera') {
      startCamera();
    }
    return () => { stopRef.current?.(); };
  }, [mode, startCamera]);

  // ── Saisie manuelle ──────────────────────────────────────────────────────
  const handleManualSubmit = () => {
    const v = normaliserId(manualInput);
    if (!v) { setManualError('Entrez un identifiant'); return; }
    if (!idValide(v)) {
      setManualError(`Format invalide. Attendu : AMB-TRV-26-T-XXXXX`);
      return;
    }
    onResult(v);
    onClose();
  };

  const handleManualKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleManualSubmit();
  };

  // ── Rendu ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Scanner le carnet Fokontany</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {[
            { id: 'camera', label: 'Caméra', Icon: Camera },
            { id: 'manual', label: 'Saisie manuelle', Icon: Keyboard },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { stopRef.current?.(); setMode(id as 'camera' | 'manual'); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold transition ${
                mode === id
                  ? 'border-b-2 border-indigo-600 text-indigo-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div className="p-5">

          {mode === 'camera' && (
            <div className="space-y-3">
              {/* Viewfinder */}
              <div className="relative bg-black rounded-xl overflow-hidden aspect-square">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {/* Overlay viseur */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-48 h-48 rounded-xl border-2 transition-colors ${
                    lastResult?.valid ? 'border-emerald-400' :
                    lastResult ? 'border-red-400' :
                    'border-white/70'
                  }`}>
                    {/* Coins du viseur */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-current rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-current rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-current rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-current rounded-br-lg" />
                  </div>
                </div>
                {/* Spinner */}
                {scanning && !lastResult && !cameraErr && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  </div>
                )}
                {/* Résultat valide */}
                {lastResult?.valid && (
                  <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                    <CheckCircle className="h-16 w-16 text-emerald-400" />
                  </div>
                )}
              </div>

              {/* Erreur caméra */}
              {cameraErr && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Caméra inaccessible</p>
                    <p className="mt-0.5">{cameraErr}</p>
                    <p className="mt-1 text-red-600">Utilisez la saisie manuelle ou un lecteur USB.</p>
                  </div>
                </div>
              )}

              {/* QR détecté mais format invalide */}
              {lastResult && !lastResult.valid && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">QR non reconnu</p>
                    <p className="font-mono mt-0.5 break-all">{lastResult.raw}</p>
                    <p className="mt-1">Ce QR n'est pas un carnet FANISA valide.</p>
                  </div>
                </div>
              )}

              <p className="text-xs text-center text-slate-400">
                Pointez la caméra vers le QR code du carnet
              </p>
            </div>
          )}

          {mode === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  Numéro du carnet (ex: AMB-TRV-26-T-EJC2U)
                </label>
                <input
                  autoFocus
                  value={manualInput}
                  onChange={e => { setManualInput(e.target.value.toUpperCase()); setManualError(''); }}
                  onKeyDown={handleManualKeyDown}
                  placeholder="AMB-TRV-26-T-XXXXX"
                  className={`w-full font-mono text-sm px-4 py-3 border rounded-xl outline-none transition ${
                    manualError ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-indigo-400'
                  }`}
                  maxLength={20}
                />
                {manualError && (
                  <p className="text-xs text-red-600 mt-1">{manualError}</p>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Compatible avec les lecteurs QR USB (le lecteur tape l'identifiant dans ce champ).
              </p>
              <button
                onClick={handleManualSubmit}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition"
              >
                Rechercher ce ménage
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
