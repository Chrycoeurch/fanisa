import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre, Parcelle, Batiment, TitulaireFoncier, Detenteur, ProprietaireBatiment, OccupantReel, MiseEnValeur } from '../types';
import {
  Building2, Plus, X, Edit2, Trash2, Search, MapPin, Home,
  ChevronDown, ChevronRight, User, Loader2, Upload, FileText,
  Landmark, Eye, Save, AlertCircle
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

const TYPES_TITULAIRE = ['Société / Entreprise', 'Personne physique', 'État', 'Commune', 'Inconnu'];
const TYPES_DETENTION = ['Détenteur JOROLAVA', 'Héritier', 'Donataire', 'Occupant historique', 'Acquéreur', 'Autre'];
const TYPES_OCCUPATION = ['Propriétaire occupant', 'Locataire', 'Hébergé', 'Gardien', 'Autre'];
const TYPES_BATIMENT = ['Habitation principale', 'Dépendance', 'Commerce', 'Atelier', 'Hangar', 'Clôture', 'Autre'];
const ETATS_BATIMENT = ['Excellent', 'Bon', 'Moyen', 'Dégradé', 'Ruine'];
const USAGES_PARCELLE = ['Habitation', 'Commercial', 'Agricole', 'Mixte', 'Non bâti', 'Autre'];
const BIENS_TYPES = ['Maison', 'Terrain', 'Moto', 'Voiture', 'Camion', 'Télévision', 'Réfrigérateur', 'Groupe électrogène', 'Panneau solaire', 'Autre'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', className = '' }: any) {
  return <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none ${className}`} />;
}

function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none bg-white">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── Modal Parcelle ────────────────────────────────────────────
function ParcelleModal({ parcelle, foyers, membres, onClose, onSave }: {
  parcelle?: Parcelle; foyers: Foyer[]; membres: Membre[];
  onClose: () => void; onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'parcelle' | 'titulaire' | 'detenteur' | 'batiments' | 'valeur'>('parcelle');
  const [data, setData] = useState<Partial<Parcelle>>(parcelle || {});
  const [titulaire, setTitulaire] = useState<Partial<TitulaireFoncier>>({});
  const [detenteur, setDetenteur] = useState<Partial<Detenteur>>({});
  const [batiments, setBatiments] = useState<Partial<Batiment>[]>([{}]);
  const [proprietaires, setProprietaires] = useState<Partial<ProprietaireBatiment>[]>([{}]);
  const [occupants, setOccupants] = useState<Partial<OccupantReel>[]>([{}]);
  const [valeur, setValeur] = useState<Partial<MiseEnValeur>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (parcelle?.id) {
      supabase.from('titulaires_fonciers').select('*').eq('parcelle_id', parcelle.id).single()
        .then(({ data }) => data && setTitulaire(data));
      supabase.from('detenteurs').select('*').eq('parcelle_id', parcelle.id).single()
        .then(({ data }) => data && setDetenteur(data));
      supabase.from('batiments').select('*').eq('parcelle_id', parcelle.id)
        .then(({ data }) => data?.length && setBatiments(data));
      supabase.from('mises_en_valeur').select('*').eq('parcelle_id', parcelle.id).single()
        .then(({ data }) => data && setValeur(data));
    }
  }, [parcelle]);

  const up = (k: keyof Parcelle, v: any) => setData(p => ({ ...p, [k]: v }));

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingPhoto(true);
    const path = `parcelles/${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('Photos').upload(path, file, { upsert: true });
    if (!error) {
      const { data: u } = supabase.storage.from('Photos').getPublicUrl(path);
      up('photo_url', u.publicUrl);
    }
    setUploadingPhoto(false);
  };

  const handleSave = async () => {
    if (!data.numero_lot) { alert('Le numéro de lot est obligatoire.'); return; }
    setSaving(true);
    let parcelleId = parcelle?.id;
    if (parcelleId) {
      await supabase.from('parcelles').update({ ...data, updated_at: new Date().toISOString() }).eq('id', parcelleId);
    } else {
      const { data: created } = await supabase.from('parcelles').insert(data).select().single();
      parcelleId = created?.id;
    }
    if (!parcelleId) { setSaving(false); return; }

    // Titulaire
    if (titulaire.type_titulaire || titulaire.nom) {
      const existing = await supabase.from('titulaires_fonciers').select('id').eq('parcelle_id', parcelleId).single();
      if (existing.data?.id) await supabase.from('titulaires_fonciers').update(titulaire).eq('id', existing.data.id);
      else await supabase.from('titulaires_fonciers').insert({ ...titulaire, parcelle_id: parcelleId });
    }
    // Détenteur
    if (detenteur.type_detention || detenteur.nom) {
      const existing = await supabase.from('detenteurs').select('id').eq('parcelle_id', parcelleId).single();
      if (existing.data?.id) await supabase.from('detenteurs').update(detenteur).eq('id', existing.data.id);
      else await supabase.from('detenteurs').insert({ ...detenteur, parcelle_id: parcelleId });
    }
    // Bâtiments
    for (const bat of batiments.filter(b => b.reference_batiment)) {
      if (bat.id) await supabase.from('batiments').update(bat).eq('id', bat.id);
      else await supabase.from('batiments').insert({ ...bat, parcelle_id: parcelleId });
    }
    // Mise en valeur
    if (Object.keys(valeur).length > 0) {
      const existing = await supabase.from('mises_en_valeur').select('id').eq('parcelle_id', parcelleId).single();
      if (existing.data?.id) await supabase.from('mises_en_valeur').update(valeur).eq('id', existing.data.id);
      else await supabase.from('mises_en_valeur').insert({ ...valeur, parcelle_id: parcelleId });
    }
    setSaving(false);
    onSave();
  };

  const TABS = [
    { key: 'parcelle', label: 'Parcelle', icon: MapPin },
    { key: 'titulaire', label: 'Titulaire foncier', icon: Landmark },
    { key: 'detenteur', label: 'Détenteur JOROLAVA', icon: User },
    { key: 'batiments', label: 'Bâtiments', icon: Building2 },
    { key: 'valeur', label: 'Mise en valeur', icon: Home },
  ] as const;

  const chkVal = (k: keyof MiseEnValeur) => (
    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${valeur[k] ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'}`}>
      <input type="checkbox" className="rounded" checked={!!valeur[k]} onChange={e => setValeur(p => ({ ...p, [k]: e.target.checked }))} />
      {k.charAt(0).toUpperCase() + k.slice(1)}
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl"><Building2 className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{parcelle ? 'Modifier la parcelle' : 'Nouvelle parcelle'}</h2>
              {data.numero_lot && <p className="text-xs text-indigo-600 font-mono font-bold">LOT {data.numero_lot}</p>}
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        <div className="flex border-b border-slate-200 overflow-x-auto shrink-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition ${activeTab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── PARCELLE ── */}
          {activeTab === 'parcelle' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Numéro de lot *"><Input value={data.numero_lot} onChange={(v: string) => up('numero_lot', v)} placeholder="Ex: 20/AA-146" className="font-mono" /></Field>
                <Field label="Titre foncier"><Input value={data.titre_foncier} onChange={(v: string) => up('titre_foncier', v)} placeholder="Ex: TF-12345" /></Field>
                <Field label="Référence cadastrale"><Input value={data.cadastre_ref} onChange={(v: string) => up('cadastre_ref', v)} placeholder="Ex: SEC-A-012" /></Field>
                <Field label="Superficie (m²)"><Input type="number" value={data.superficie_m2} onChange={(v: string) => up('superficie_m2', parseFloat(v))} placeholder="Ex: 320" /></Field>
                <Field label="Usage du terrain"><Select value={data.usage || ''} onChange={(v: string) => up('usage', v)} options={USAGES_PARCELLE} placeholder="Choisir..." /></Field>
                <Field label="Fokontany"><Input value={data.fokontany} onChange={(v: string) => up('fokontany', v)} placeholder="Ex: Ambodisaina" /></Field>
                <Field label="GPS Latitude"><Input type="number" value={data.gps_lat} onChange={(v: string) => up('gps_lat', parseFloat(v))} placeholder="-18.9100" /></Field>
                <Field label="GPS Longitude"><Input type="number" value={data.gps_lng} onChange={(v: string) => up('gps_lng', parseFloat(v))} placeholder="47.5250" /></Field>
              </div>
              <Field label="Adresse"><Input value={data.adresse} onChange={(v: string) => up('adresse', v)} placeholder="Adresse complète" /></Field>
              <Field label="Historique de subdivision">
                <textarea value={data.historique_subdivision || ''} onChange={e => up('historique_subdivision', e.target.value)} rows={2} placeholder="Ex: Issu du lot 20/AA, divisé en 2026..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
              </Field>
              <Field label="Notes">
                <textarea value={data.notes || ''} onChange={e => up('notes', e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
              </Field>
              <Field label="Photo de la parcelle">
                {data.photo_url ? (
                  <div className="relative h-32 rounded-xl overflow-hidden border border-slate-200">
                    <img src={data.photo_url} className="w-full h-full object-cover" alt="Parcelle" />
                    <button onClick={() => up('photo_url', '')} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-xl cursor-pointer ${uploadingPhoto ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                    <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
                    {uploadingPhoto ? <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" /> : <Upload className="h-5 w-5 text-slate-300" />}
                  </label>
                )}
              </Field>
            </div>
          )}

          {/* ── TITULAIRE FONCIER ── */}
          {activeTab === 'titulaire' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">Le titulaire foncier est le propriétaire légal du terrain (selon le titre foncier officiel). Il peut être différent du détenteur réel.</div>
              <Field label="Type de titulaire"><Select value={titulaire.type_titulaire || ''} onChange={v => setTitulaire(p => ({ ...p, type_titulaire: v }))} options={TYPES_TITULAIRE} placeholder="Choisir..." /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom / Raison sociale"><Input value={titulaire.nom} onChange={(v: string) => setTitulaire(p => ({ ...p, nom: v }))} placeholder="Nom" /></Field>
                <Field label="Prénom"><Input value={titulaire.prenom} onChange={(v: string) => setTitulaire(p => ({ ...p, prenom: v }))} placeholder="Prénom" /></Field>
                <Field label="CIN"><Input value={titulaire.cin} onChange={(v: string) => setTitulaire(p => ({ ...p, cin: v }))} placeholder="CIN" className="font-mono" /></Field>
                <Field label="Téléphone"><Input value={titulaire.telephone} onChange={(v: string) => setTitulaire(p => ({ ...p, telephone: v }))} placeholder="+261 34..." /></Field>
              </div>
              <Field label="Adresse du titulaire"><Input value={titulaire.adresse} onChange={(v: string) => setTitulaire(p => ({ ...p, adresse: v }))} placeholder="Adresse" /></Field>
              <Field label="Notes">
                <textarea value={titulaire.notes || ''} onChange={e => setTitulaire(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
              </Field>
            </div>
          )}

          {/* ── DÉTENTEUR JOROLAVA ── */}
          {activeTab === 'detenteur' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">Le détenteur est la personne reconnue localement comme occupant ou gestionnaire du terrain (JOROLAVA). Il peut être différent du titulaire officiel.</div>
              <Field label="Type de détention"><Select value={detenteur.type_detention || ''} onChange={v => setDetenteur(p => ({ ...p, type_detention: v }))} options={TYPES_DETENTION} placeholder="Choisir..." /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom"><Input value={detenteur.nom} onChange={(v: string) => setDetenteur(p => ({ ...p, nom: v }))} placeholder="Nom" /></Field>
                <Field label="Prénom"><Input value={detenteur.prenom} onChange={(v: string) => setDetenteur(p => ({ ...p, prenom: v }))} placeholder="Prénom" /></Field>
                <Field label="CIN"><Input value={detenteur.cin} onChange={(v: string) => setDetenteur(p => ({ ...p, cin: v }))} className="font-mono" /></Field>
                <Field label="Téléphone"><Input value={detenteur.telephone} onChange={(v: string) => setDetenteur(p => ({ ...p, telephone: v }))} /></Field>
                <Field label="Depuis (date)"><Input type="date" value={detenteur.date_debut_occupation} onChange={(v: string) => setDetenteur(p => ({ ...p, date_debut_occupation: v }))} /></Field>
                <Field label="Document détenu"><Input value={detenteur.document_detenu} onChange={(v: string) => setDetenteur(p => ({ ...p, document_detenu: v }))} placeholder="Ex: Acte de vente, héritage..." /></Field>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                <p className="text-xs font-bold text-indigo-700 mb-2">Lier à un membre du registre</p>
                <Select value={detenteur.membre_id || ''} onChange={v => setDetenteur(p => ({ ...p, membre_id: v || undefined }))}
                  options={membres.map(m => `${m.id}|${m.nom} ${m.prenom}`).map(s => s.split('|')[0])}
                  placeholder="Sélectionner un membre (optionnel)" />
              </div>
              <Field label="Notes">
                <textarea value={detenteur.notes || ''} onChange={e => setDetenteur(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
              </Field>
            </div>
          )}

          {/* ── BÂTIMENTS ── */}
          {activeTab === 'batiments' && (
            <div className="space-y-4">
              {batiments.map((bat, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-indigo-600 uppercase">Bâtiment {idx + 1}</p>
                    {batiments.length > 1 && <button onClick={() => setBatiments(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Référence *"><Input value={bat.reference_batiment} onChange={(v: string) => setBatiments(prev => prev.map((b, i) => i === idx ? { ...b, reference_batiment: v } : b))} placeholder={`Ex: BAT-${String(idx + 1).padStart(2, '0')}`} className="font-mono" /></Field>
                    <Field label="Type"><Select value={bat.type_batiment || ''} onChange={v => setBatiments(prev => prev.map((b, i) => i === idx ? { ...b, type_batiment: v } : b))} options={TYPES_BATIMENT} placeholder="Choisir..." /></Field>
                    <Field label="État"><Select value={bat.etat || ''} onChange={v => setBatiments(prev => prev.map((b, i) => i === idx ? { ...b, etat: v } : b))} options={ETATS_BATIMENT} placeholder="Choisir..." /></Field>
                    <Field label="Superficie (m²)"><Input type="number" value={bat.superficie_m2} onChange={(v: string) => setBatiments(prev => prev.map((b, i) => i === idx ? { ...b, superficie_m2: parseFloat(v) } : b))} /></Field>
                    <Field label="Niveaux"><Input type="number" value={bat.nombre_niveaux} onChange={(v: string) => setBatiments(prev => prev.map((b, i) => i === idx ? { ...b, nombre_niveaux: parseInt(v) } : b))} /></Field>
                    <Field label="Année construction"><Input type="number" value={bat.annee_construction} onChange={(v: string) => setBatiments(prev => prev.map((b, i) => i === idx ? { ...b, annee_construction: parseInt(v) } : b))} /></Field>
                    <Field label="Matériaux mur"><Input value={bat.materiaux_mur} onChange={(v: string) => setBatiments(prev => prev.map((b, i) => i === idx ? { ...b, materiaux_mur: v } : b))} /></Field>
                    <Field label="Matériaux toiture"><Input value={bat.materiaux_toiture} onChange={(v: string) => setBatiments(prev => prev.map((b, i) => i === idx ? { ...b, materiaux_toiture: v } : b))} /></Field>
                  </div>

                  {/* Propriétaire du bâtiment */}
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Propriétaire déclaré du bâtiment</p>
                    <p className="text-[11px] text-slate-400 italic">Peut être différent du titulaire foncier</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input value={proprietaires[idx]?.nom} onChange={(v: string) => setProprietaires(prev => { const n = [...prev]; n[idx] = { ...n[idx], nom: v }; return n; })} placeholder="Nom" />
                      <Input value={proprietaires[idx]?.prenom} onChange={(v: string) => setProprietaires(prev => { const n = [...prev]; n[idx] = { ...n[idx], prenom: v }; return n; })} placeholder="Prénom" />
                      <Input value={proprietaires[idx]?.cin} onChange={(v: string) => setProprietaires(prev => { const n = [...prev]; n[idx] = { ...n[idx], cin: v }; return n; })} placeholder="CIN" className="font-mono" />
                      <Input value={proprietaires[idx]?.lien_avec_parcelle} onChange={(v: string) => setProprietaires(prev => { const n = [...prev]; n[idx] = { ...n[idx], lien_avec_parcelle: v }; return n; })} placeholder="Ex: Fils propriétaire terrain" />
                    </div>
                  </div>

                  {/* Occupant réel */}
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Occupant réel</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={occupants[idx]?.type_occupation || ''} onChange={v => setOccupants(prev => { const n = [...prev]; n[idx] = { ...n[idx], type_occupation: v }; return n; })} options={TYPES_OCCUPATION} placeholder="Type d'occupation..." />
                      <Select value={occupants[idx]?.foyer_id || ''} onChange={v => setOccupants(prev => { const n = [...prev]; n[idx] = { ...n[idx], foyer_id: v || undefined }; return n; })}
                        options={foyers.map(f => f.id)} placeholder="Lier à un foyer (optionnel)" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setBatiments(prev => [...prev, {}])} className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />Ajouter un bâtiment
              </button>
            </div>
          )}

          {/* ── MISE EN VALEUR ── */}
          {activeTab === 'valeur' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-700">La mise en valeur justifie les investissements réalisés sur le terrain (AMV - Attestation de Mise en Valeur).</div>
              <p className="text-xs font-bold text-slate-500 uppercase">Éléments présents sur la parcelle</p>
              <div className="grid grid-cols-3 gap-2">
                {chkVal('maison')}{chkVal('cloture')}{chkVal('cultures')}
                {chkVal('elevage')}{chkVal('eau')}{chkVal('electricite')}
                {chkVal('commerce')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Année de début"><Input type="number" value={valeur.annee_debut} onChange={(v: string) => setValeur(p => ({ ...p, annee_debut: parseInt(v) }))} placeholder="Ex: 1985" /></Field>
              </div>
              <Field label="Description complémentaire">
                <textarea value={valeur.description || ''} onChange={e => setValeur(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Détails des investissements, historique d'occupation..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
              </Field>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Save className="h-4 w-4" />{parcelle ? 'Modifier' : 'Créer la parcelle'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────
export default function FoncierModule({ foyers, membres }: Props) {
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingParcelle, setEditingParcelle] = useState<Parcelle | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, any>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('parcelles').select('*').order('created_at', { ascending: false });
    setParcelles((data || []) as Parcelle[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadDetails = async (id: string) => {
    const [t, d, b, v] = await Promise.all([
      supabase.from('titulaires_fonciers').select('*').eq('parcelle_id', id),
      supabase.from('detenteurs').select('*').eq('parcelle_id', id),
      supabase.from('batiments').select('*').eq('parcelle_id', id),
      supabase.from('mises_en_valeur').select('*').eq('parcelle_id', id),
    ]);
    setDetails(prev => ({ ...prev, [id]: {
      titulaire: t.data?.[0], detenteur: d.data?.[0],
      batiments: b.data || [], valeur: v.data?.[0]
    }}));
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!details[id]) await loadDetails(id);
  };

  const deleteParcelle = async (id: string) => {
    if (!confirm('Supprimer cette parcelle et toutes ses données liées ?')) return;
    await supabase.from('parcelles').delete().eq('id', id);
    setParcelles(prev => prev.filter(p => p.id !== id));
  };

  const filtered = parcelles.filter(p => {
    const q = search.toLowerCase();
    return (p.numero_lot || '').toLowerCase().includes(q) || (p.adresse || '').toLowerCase().includes(q) || (p.fokontany || '').toLowerCase().includes(q);
  });

  const BADGE_USAGE: Record<string, string> = {
    'Habitation': 'bg-blue-100 text-blue-700',
    'Commercial': 'bg-amber-100 text-amber-700',
    'Agricole': 'bg-emerald-100 text-emerald-700',
    'Mixte': 'bg-purple-100 text-purple-700',
    'Non bâti': 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl"><Building2 className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Foncier, Cadastre & Habitat</h2>
              <p className="text-xs text-slate-500">Gestion des parcelles, bâtiments, titulaires et détenteurs</p>
            </div>
          </div>
          <button onClick={() => { setEditingParcelle(undefined); setShowModal(true); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="h-4 w-4" />Nouvelle parcelle
          </button>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par lot, adresse, fokontany..." className="w-full text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500" />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Building2 className="h-4 w-4" />{filtered.length} parcelle{filtered.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Parcelles', value: parcelles.length, color: 'indigo' },
          { label: 'Habitation', value: parcelles.filter(p => p.usage === 'Habitation').length, color: 'blue' },
          { label: 'Commercial', value: parcelles.filter(p => p.usage === 'Commercial').length, color: 'amber' },
          { label: 'Agricole', value: parcelles.filter(p => p.usage === 'Agricole').length, color: 'emerald' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold text-${color}-700`}>{value}</p>
            <p className={`text-xs text-${color}-600 font-medium`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Liste parcelles */}
      {loading ? (
        <div className="text-center py-16"><Loader2 className="h-8 w-8 text-indigo-600 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
          <Building2 className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <p className="font-bold text-slate-700 text-lg">Aucune parcelle enregistrée</p>
          <p className="text-sm text-slate-500 mt-1">Commencez par créer la première parcelle du registre.</p>
          <button onClick={() => { setEditingParcelle(undefined); setShowModal(true); }} className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg flex items-center gap-2 mx-auto transition">
            <Plus className="h-4 w-4" />Créer la première parcelle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const isExpanded = expandedId === p.id;
            const det = details[p.id];
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Ligne principale */}
                <div className="flex items-center gap-4 p-4">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                      <MapPin className="h-6 w-6 text-indigo-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-indigo-700 text-sm">LOT {p.numero_lot}</span>
                      {p.usage && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE_USAGE[p.usage] || 'bg-slate-100 text-slate-600'}`}>{p.usage}</span>}
                      {p.titre_foncier && <span className="text-[10px] text-slate-400 font-mono">{p.titre_foncier}</span>}
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{p.adresse || '—'}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                      {p.fokontany && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.fokontany}</span>}
                      {p.superficie_m2 && <span>{p.superficie_m2} m²</span>}
                      {p.gps_lat && <span className="font-mono">📍 {p.gps_lat?.toFixed(4)}, {p.gps_lng?.toFixed(4)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleExpand(p.id)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <button onClick={() => { setEditingParcelle(p); setShowModal(true); }} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => deleteParcelle(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {/* Détails expandés */}
                {isExpanded && det && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    {/* Titulaire */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <p className="font-bold text-amber-600 uppercase text-[10px] mb-1.5 flex items-center gap-1"><Landmark className="h-3 w-3" />Titulaire foncier</p>
                      {det.titulaire ? (
                        <>
                          <p className="font-semibold text-slate-800">{det.titulaire.nom} {det.titulaire.prenom}</p>
                          <p className="text-slate-500">{det.titulaire.type_titulaire}</p>
                          {det.titulaire.cin && <p className="font-mono text-slate-400">{det.titulaire.cin}</p>}
                        </>
                      ) : <p className="text-slate-400 italic">Non défini</p>}
                    </div>
                    {/* Détenteur */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <p className="font-bold text-blue-600 uppercase text-[10px] mb-1.5 flex items-center gap-1"><User className="h-3 w-3" />Détenteur JOROLAVA</p>
                      {det.detenteur ? (
                        <>
                          <p className="font-semibold text-slate-800">{det.detenteur.nom} {det.detenteur.prenom}</p>
                          <p className="text-slate-500">{det.detenteur.type_detention}</p>
                          {det.detenteur.date_debut_occupation && <p className="text-slate-400">Depuis {new Date(det.detenteur.date_debut_occupation).toLocaleDateString('fr-FR')}</p>}
                        </>
                      ) : <p className="text-slate-400 italic">Non défini</p>}
                    </div>
                    {/* Bâtiments */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <p className="font-bold text-indigo-600 uppercase text-[10px] mb-1.5 flex items-center gap-1"><Building2 className="h-3 w-3" />Bâtiments ({det.batiments?.length || 0})</p>
                      {det.batiments?.length > 0 ? det.batiments.map((b: Batiment) => (
                        <div key={b.id} className="mb-1">
                          <p className="font-mono font-semibold text-slate-700">{b.reference_batiment}</p>
                          <p className="text-slate-400">{b.type_batiment} · {b.etat}</p>
                        </div>
                      )) : <p className="text-slate-400 italic">Aucun bâtiment</p>}
                    </div>
                    {/* Mise en valeur */}
                    <div className="bg-white border border-slate-200 rounded-lg p-3">
                      <p className="font-bold text-emerald-600 uppercase text-[10px] mb-1.5 flex items-center gap-1"><Home className="h-3 w-3" />Mise en valeur</p>
                      {det.valeur ? (
                        <div className="flex flex-wrap gap-1">
                          {det.valeur.maison && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Maison</span>}
                          {det.valeur.cloture && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Clôture</span>}
                          {det.valeur.cultures && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Cultures</span>}
                          {det.valeur.elevage && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibent">Élevage</span>}
                          {det.valeur.electricite && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Électricité</span>}
                          {det.valeur.eau && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Eau</span>}
                          {det.valeur.annee_debut && <p className="text-slate-400 w-full mt-1">Depuis {det.valeur.annee_debut}</p>}
                        </div>
                      ) : <p className="text-slate-400 italic">Non renseigné</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ParcelleModal
          parcelle={editingParcelle}
          foyers={foyers}
          membres={membres}
          onClose={() => { setShowModal(false); setEditingParcelle(undefined); }}
          onSave={() => { setShowModal(false); setEditingParcelle(undefined); load(); }}
        />
      )}
    </div>
  );
}
