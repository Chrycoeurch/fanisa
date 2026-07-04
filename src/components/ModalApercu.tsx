import React from 'react';
import { X, Download, Printer, Loader2 } from 'lucide-react';

interface Props {
  titre: string;
  sous_titre?: string;
  pdfUrl: string | null;
  loading: boolean;
  nomFichier: string;
  onClose: () => void;
  onTelecharger: () => void;
}

export default function ModalApercu({ titre, sous_titre, pdfUrl, loading, nomFichier, onClose, onTelecharger }: Props) {
  const handleImprimer = () => {
    if (!pdfUrl) return;
    const w = window.open(pdfUrl, '_blank');
    if (w) w.addEventListener('load', () => { try { w.print(); } catch {} });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col" style={{ height: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{titre}</h2>
            {sous_titre && <p className="text-xs text-slate-400 mt-0.5">{sous_titre}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Aperçu */}
        <div className="flex-1 bg-slate-100 overflow-hidden relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
              <p className="text-sm text-slate-500 font-medium">Génération du document…</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title="Aperçu du document"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
              Erreur de génération
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 shrink-0 bg-slate-50">
          <p className="text-xs text-slate-400">{nomFichier}</p>
          <div className="flex gap-2">
            <button
              onClick={handleImprimer}
              disabled={!pdfUrl || loading}
              className="flex items-center gap-1.5 px-4 py-2.5 border-2 border-indigo-200 hover:bg-indigo-50 disabled:opacity-40 text-indigo-700 text-sm font-bold rounded-xl transition"
            >
              <Printer className="h-4 w-4" />Imprimer
            </button>
            <button
              onClick={onTelecharger}
              disabled={!pdfUrl || loading}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl transition"
            >
              <Download className="h-4 w-4" />Télécharger
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
