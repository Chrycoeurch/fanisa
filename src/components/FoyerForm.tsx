import React, { useState, useEffect } from 'react';
import { Foyer } from '../types';
import { supabase } from '../lib/supabase';
import { X, Home, MapPin, Image, Loader2, Upload, Building2, UserCog } from 'lucide-react';

interface Props {
  foyer?: Foyer;
  onClose: () => void;
  onSave: (foyer: Partial<Foyer>) => Promise<void>;
}

const TYPES_LOGEMENT = ['Maison traditionnelle', 'Villa', 'Appartement', 'Case en bois', 'Studio', 'Autres'];
const MATERIAUX_TOITURE = ['Tôle', 'Tuile', 'Chaume / Ravinala', 'Béton', 'Autres'];
const MATERIAUX_MUR = ['Brique', 'Parpaing / Béton', 'Bois', 'Terre battue', 'Ravinala / Falafa', 'Autres'];
const MATERIAUX_PLANCHER = ['Ciment', 'Carrelage', 'Terre battue', 'Bois', 'Autres'];
const STATUTS_OCCUPANT = ['Propriétaire', 'Locataire', 'Gardien', 'Occupant à titre gratuit', 'Autres'];

async function genCodeMenage(): Promise<string> {
  const { data } = await supabase.from('foyers').select('code_menage').order('created_at', { ascending: false });
  if (!data || data.length === 0) return 'MEN-001';
  const nums = data.map(f => parseInt((f.code_menage || '').replace('MEN-', '')) || 0).filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `MEN-${String(max + 1).padStart(3, '0')}`;
}

function ChoiceGroup({ label, options, value, onChange, required }: { label: string; options: string[]; value: string; onChange: (v: string) => void; required?: boolean }) {
  const [customMode, setCustomMode] = useState(value !== '' && !options.includes(value) && value !== 'Autres');
  const [customVal, setCustomVal] = useState(customMode ? value : '');

  return (
    <div>
      <label className="text-xs font-bold text-slate-600 uppercase block mb-1.5">{label} {required && <span className="text-red-500">*</span>}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <label key={opt} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold transition ${value === opt && !customMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" className="hidden" checked={value === opt && !customMode} onChange={() => { onChange(opt); setCustomMode(false); }} />
            {opt}
          </label>
        ))}
      </div>
      {(value === 'Autres' || customMode) && (
        <input
          value={customVal}
          onChange={e => { setCustomVal(e.target.value); setCustomMode(true); onChange(e.target.value); }}
          placeholder="Préciser..."
          className="w-full mt-2 border border-indigo-300 bg-indigo-50 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none"
        />
      )}
    </div>
  );
}

export default function FoyerForm({ foyer, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [code_menage, setCodeMenage] = useState(foyer?.code_menage || '');
  const [loadingCode, setLoadingCode] = useState(!foyer);
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
  const [photo_maison_url, setPhotoMaisonUrl] = useState(foyer?.photo_maison_url || '');

  // Logement
  const [type_logement, setTypeLogement] = useState(foyer?.type_logement || '');
  const [a_etage, setAEtage] = useState(foyer?.a_etage || false);
  const [nombre_etages, setNombreEtages] = useState(foyer?.nombre_etages?.toString() || '1');
  const [materiau_toiture, setMateriauToiture] = useState(foyer?.materiau_toiture || '');
  const [materiau_mur, setMateriauMur] = useState(foyer?.materiau_mur || '');
  const [materiau_plancher, setMateriauPlancher] = useState(foyer?.materiau_plancher || '');

  // Occupation
  const [statut_occupant, setStatutOccupant] = useState(foyer?.statut_occupant || 'Propriétaire');
  const [proprietaire_nom, setProprietaireNom] = useState(foyer?.proprietaire_nom || '');
  const [proprietaire_prenom, setProprietairePrenom] = useState(foyer?.proprietaire_prenom || '');
  const [proprietaire_cin, setProprietaireCin] = useState(foyer?.proprietaire_cin || '');
  const [proprietaire_telephone, setProprietaireTelephone] = useState(foyer?.proprietaire_telephone || '');
  const [proprietaire_adresse, setProprietaireAdresse] = useState(foyer?.proprietaire_adresse || '');

  const isProprietaire = statut_occupant === 'Propriétaire';

  useEffect(() => {
    if (!foyer) genCodeMenage().then(code => { setCodeMenage(code); setLoadingCode(false); });
  }, [foyer]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image trop grande (max 5 Mo)'); return; }
    setUploadingPhoto(true);
    const ext = file.name.split('.').pop();
    const path = `maisons/${code_menage}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('Photos').upload(path, file, { upsert: true });
    if (error) { alert('Erreur upload : ' + error.message); setUploadingPhoto(false); return; }
    const { data: urlData } = supabase.storage.from('Photos').getPublicUrl(path);
    setPhotoMaisonUrl(urlData.publicUrl);
    setUploadingPhoto(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fokontany.trim()) return;
    setSaving(true);
    await onSave({
      code_menage, statut,
      adresse: adresse || undefined,
      fokontany,
      commune: commune || undefined,
      district: district || undefined,
      gps_lat: gps_lat ? parseFloat(gps_lat) : undefined,
      gps_lng: gps_lng ? parseFloat(gps_lng) : undefined,
      carreau: carreau || undefined,
      num_carreau: num_carreau || undefined,
      nombre_pieces: nombre_pieces ? parseInt(nombre_pieces) : undefined,
      superficie_maison: superficie_maison ? parseFloat(superficie_maison) : undefined,
      photo_maison_url: photo_maison_url || undefined,
      type_logement: type_logement || undefined,
      a_etage,
      nombre_etages: a_etage ? (parseInt(nombre_etages) || 1) : undefined,
      materiau_toiture: materiau_toiture || undefined,
      materiau_mur: materiau_mur || undefined,
      materiau_plancher: materiau_plancher || undefined,
      statut_occupant,
      proprietaire_nom: !isProprietaire ? (proprietaire_nom || undefined) : undefined,
      proprietaire_prenom: !isProprietaire ? (proprietaire_prenom || undefined) : undefined,
      proprietaire_cin: !isProprietaire ? (proprietaire_cin || undefined) : undefined,
      proprietaire_telephone: !isProprietaire ? (proprietaire_telephone || undefined) : undefined,
      proprietaire_adresse: !isProprietaire ? (proprietaire_adresse || undefined) : undefined,
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
              <p className="text-xs text-slate-500">Code : {loadingCode ? <span className="text-slate-400 italic">génération…</span> : <span className="font-mono font-bold text-indigo-600">{code_menage}</span>}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-7">

          {/* Statut */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Statut du foyer</label>
            <div className="flex gap-3">
              {(['Actif', 'Dissous', 'Déplacé'] as const).map(s => (
                <label key={s} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-semibold transition ${statut === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" className="hidden" checked={statut === s} onChange={() => setStatut(s)} />{s}
                </label>
              ))}
            </div>
          </div>

          {/* Localisation */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />Localisation</h3>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Adresse physique</label>
              <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Ex: Lot III G 12, Rue de l'Église" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Fokontany <span className="text-red-500">*</span></label>
                <input value={fokontany} onChange={e => setFokontany(e.target.value)} placeholder="Ex: Androranga" required className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Commune</label>
                <input value={commune} onChange={e => setCommune(e.target.value)} placeholder="Ex: Toamasina" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">District</label>
                <input value={district} onChange={e => setDistrict(e.target.value)} placeholder="Ex: Toamasina II" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">GPS Latitude</label>
                <input value={gps_lat} onChange={e => setGpsLat(e.target.value)} placeholder="-18.9100" type="number" step="any" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">GPS Longitude</label>
                <input value={gps_lng} onChange={e => setGpsLng(e.target.value)} placeholder="47.5250" type="number" step="any" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Secteur / Carreau</label>
                <input value={carreau} onChange={e => setCarreau(e.target.value)} placeholder="Ex: Tsararivotra" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Numéro de carreau</label>
                <input value={num_carreau} onChange={e => setNumCarreau(e.target.value)} placeholder="Ex: CAR-12" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Caractéristiques du logement */}
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />Caractéristiques du logement</h3>

            <ChoiceGroup label="Type de logement" options={TYPES_LOGEMENT} value={type_logement} onChange={setTypeLogement} />

            {/* Étage */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1.5">Maison à étage ?</label>
              <div className="flex gap-3 items-center">
                <div className="flex gap-2">
                  {[{ v: false, l: 'Non' }, { v: true, l: 'Oui' }].map(({ v, l }) => (
                    <label key={l} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border cursor-pointer text-sm font-semibold transition ${a_etage === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" className="hidden" checked={a_etage === v} onChange={() => setAEtage(v)} />{l}
                    </label>
                  ))}
                </div>
                {a_etage && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Nombre d'étages :</span>
                    <input type="number" min="1" max="10" value={nombre_etages} onChange={e => setNombreEtages(e.target.value)} className="w-16 border border-slate-200 rounded-lg px-2 py-2 text-sm focus:border-indigo-500 outline-none text-center" />
                  </div>
                )}
              </div>
            </div>

            <ChoiceGroup label="Matériau de toiture" options={MATERIAUX_TOITURE} value={materiau_toiture} onChange={setMateriauToiture} />
            <ChoiceGroup label="Matériau de mur" options={MATERIAUX_MUR} value={materiau_mur} onChange={setMateriauMur} />
            <ChoiceGroup label="Matériau de plancher" options={MATERIAUX_PLANCHER} value={materiau_plancher} onChange={setMateriauPlancher} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Nombre de pièces</label>
                <input value={nombre_pieces} onChange={e => setNombrePieces(e.target.value)} placeholder="Ex: 3" type="number" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Superficie (m²)</label>
                <input value={superficie_maison} onChange={e => setSuperficie(e.target.value)} placeholder="Ex: 85" type="number" min="1" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Statut occupant */}
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><UserCog className="h-3.5 w-3.5" />Statut de l'occupant</h3>
            <ChoiceGroup label="Statut" options={STATUTS_OCCUPANT} value={statut_occupant} onChange={setStatutOccupant} required />

            {!isProprietaire && statut_occupant && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
                  ⓘ Informations du propriétaire (à compléter ultérieurement si non disponibles)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-amber-700 uppercase block mb-1">Nom</label>
                    <input value={proprietaire_nom} onChange={e => setProprietaireNom(e.target.value)} placeholder="Nom du propriétaire" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-amber-700 uppercase block mb-1">Prénom</label>
                    <input value={proprietaire_prenom} onChange={e => setProprietairePrenom(e.target.value)} placeholder="Prénom du propriétaire" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-amber-700 uppercase block mb-1">CIN</label>
                    <input value={proprietaire_cin} onChange={e => setProprietaireCin(e.target.value)} placeholder="Numéro CIN" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white font-mono" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-amber-700 uppercase block mb-1">Téléphone</label>
                    <input value={proprietaire_telephone} onChange={e => setProprietaireTelephone(e.target.value)} placeholder="+261 34..." className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-amber-700 uppercase block mb-1">Adresse du propriétaire</label>
                  <input value={proprietaire_adresse} onChange={e => setProprietaireAdresse(e.target.value)} placeholder="Adresse de résidence du propriétaire" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:border-amber-400 outline-none bg-white" />
                </div>
              </div>
            )}
          </div>

          {/* Photo maison */}
          <div className="space-y-3 border-t border-slate-100 pt-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Image className="h-3.5 w-3.5" />Photo de la maison</h3>
            {photo_maison_url ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 h-48">
                <img src={photo_maison_url} alt="Photo maison" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setPhotoMaisonUrl('')} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 transition shadow-md"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center h-36 border-2 border-dashed rounded-xl cursor-pointer transition ${uploadingPhoto ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                {uploadingPhoto
                  ? <><Loader2 className="h-7 w-7 text-indigo-600 animate-spin mb-2" /><p className="text-xs text-indigo-600 font-semibold">Téléversement en cours…</p></>
                  : <><Upload className="h-7 w-7 text-slate-300 mb-2" /><p className="text-xs font-semibold text-slate-500">Cliquer pour téléverser une photo</p><p className="text-[10px] text-slate-400 mt-1">JPG, PNG, WEBP — max 5 Mo</p></>
                }
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Annuler</button>
            <button type="submit" disabled={saving || loadingCode || uploadingPhoto} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-lg text-sm font-semibold text-white transition flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : foyer ? 'Modifier' : 'Créer le foyer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
