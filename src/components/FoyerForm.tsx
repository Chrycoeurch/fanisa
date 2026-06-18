import React, { useState } from 'react';
import { Foyer } from '../types';
import { FOKONTANY_LIST } from '../seedData';
import { X, Home, MapPin, Loader2 } from 'lucide-react';

interface Props {
  foyer?: Foyer;
  onClose: () => void;
  onSave: (foyer: Partial<Foyer>) => Promise<void>;
}

const genCode = () => `MEN-${Math.floor(1000 + Math.random() * 9000)}`;

export default function FoyerForm({ foyer, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [code_menage] = useState(foyer?.code_menage || genCode());
  const [statut, setStatut] = useState<Foyer['statut']>(foyer?.statut || 'Actif');
  const [adresse, setAdresse] = useState(foyer?.adresse || '');
  const [fokontany, setFokontany] = useState(foyer?.fokontany || '');
  const [commune, setCommune] = useState(foyer?.commune || '');
  const [district, setDistrict] = useState(foyer?.district || '');
  const [gps_lat, setGpsLat] = useState(foyer?.gps_lat?.toString() || '');
  const [gps_lng, setGpsLng] = useState(foyer?.gps_lng?.toString() || '');
  const [carreau, setCarreau] = useState(foyer?.carreau || '');
  const [num_carreau, setNumCarreau] = useState(foyer?.num_carreau || '');
  const [nombre_pieces, setNombrePieces] = useState(foyer?.nombre_pieces?.toString() || '');
  const [superficie_maison, setSuperficie] = useState(foyer?.superficie_maison?.toString() || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      code_menage,
      statut,
      adresse,
      fokontany,
      commune,
      district,
      gps_lat: gps_lat ? parseFloat(gps_lat) : undefined,
      gps_lng: gps_lng ? parseFloat(gps_lng) : undefined,
      carreau: carreau || undefined,
      num_carreau: num_carreau || undefined,
      nombre_pieces: nombre_pieces ? parseInt(nombre_pieces) : undefined,
      superficie_maison: superficie_maison ? parseFloat(superficie_maison) : undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl"><Home className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{foyer ? 'Modifier le foyer' : 'Nouveau foyer'}</h2>
              <p className="text-xs text-slate-500">Code : <span className="font-mono font-bold text-indigo-600">{code_menage}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition"><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Statut */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Statut du foyer</label>
            <div className="flex gap-3">
              {(['Actif', 'Dissous', 'Déplacé'] as const).map(s => (
                <label key={s} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-semibold transition ${statut === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" className="hidden" checked={statut === s} onChange={() => setStatut(s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {/* Adresse */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />Localisation</h3>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Adresse physique</label>
              <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Ex: Lot III G 12, Rue de l'Église" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Fokontany <span className="text-red-500">*</span></label>
                <select value={fokontany} onChange={e => setFokontany(e.target.value)} required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
                  <option value="">Choisir...</option>
                  {FOKONTANY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Commune</label>
                <input value={commune} onChange={e => setCommune(e.target.value)} placeholder="Ex: Toamasina" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">District</label>
                <input value={district} onChange={e => setDistrict(e.target.value)} placeholder="Ex: Toamasina II" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">GPS Latitude</label>
                <input value={gps_lat} onChange={e => setGpsLat(e.target.value)} placeholder="-18.9100" type="number" step="any" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">GPS Longitude</label>
                <input value={gps_lng} onChange={e => setGpsLng(e.target.value)} placeholder="47.5250" type="number" step="any" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Secteur / Carreau</label>
                <input value={carreau} onChange={e => setCarreau(e.target.value)} placeholder="Ex: Tsararivotra" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Numéro de carreau</label>
                <input value={num_carreau} onChange={e => setNumCarreau(e.target.value)} placeholder="Ex: CAR-12" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Nombre de pièces</label>
                <input value={nombre_pieces} onChange={e => setNombrePieces(e.target.value)} placeholder="Ex: 3" type="number" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase block mb-1">Superficie (m²)</label>
                <input value={superficie_maison} onChange={e => setSuperficie(e.target.value)} placeholder="Ex: 85" type="number" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold text-white transition flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : foyer ? 'Modifier' : 'Créer le foyer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
