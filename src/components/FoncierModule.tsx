import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre, Parcelle, Batiment, TitulaireFoncier, Detenteur, ProprietaireBatiment, OccupantReel, MiseEnValeur } from '../types';
import {
  Building2, Plus, X, Edit2, Trash2, Search, MapPin, Home,
  ChevronDown, ChevronRight, User, Users, Loader2, Upload, FileText,
  Landmark, Eye, Save, AlertCircle
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

// ── Listes du formulaire KoboToolbox (correspondance PDF sections 01-12) ────
const STATUTS_PROPRIETE = ['proprietaire_declare','ayant_droit_declare','occupant_gratuit','locataire','gardien','inconnu'];
const STATUTS_LABELS: Record<string,string> = { proprietaire_declare:'Propriétaire déclaré', ayant_droit_declare:'Ayant-droit déclaré', occupant_gratuit:'Occupant gratuit', locataire:'Locataire', gardien:'Gardien', inconnu:'Inconnu' };
const NATURES_TERRAIN = ['sec','marecageux','riziere','mixte'];
const TYPES_OCCUPATION_TERRAIN = ['habitation','commerce','agriculture','elevage','mixte','non_bati','autre'];
const ORIGINES_DROIT = ['achat','heritage','donation','attribution','occupation_ancienne','autre','inconnue'];
const ORIGINES_LABELS: Record<string,string> = { achat:'Achat', heritage:'Héritage', donation:'Donation', attribution:'Attribution', occupation_ancienne:'Occupation ancienne', autre:'Autre', inconnue:'Inconnue' };
const TYPES_PERSONNE = ['personne_physique','couple','indivision','association','entreprise','etat_commune','autre','inconnu'];
const TYPES_PERSONNE_LABELS: Record<string,string> = { personne_physique:'Personne physique', couple:'Couple', indivision:'Indivision', association:'Association', entreprise:'Entreprise', etat_commune:'État / Commune', autre:'Autre', inconnu:'Inconnu' };
const LIENS_PARCELLE = ['detenteur_declare','ayant_droit_declare','proprietaire_titre','heritier_declare','gestionnaire','bailleur','autre'];
const LIENS_LABELS: Record<string,string> = { detenteur_declare:'Détenteur déclaré', ayant_droit_declare:'Ayant-droit déclaré', proprietaire_titre:'Propriétaire sur titre', heritier_declare:'Héritier déclaré', gestionnaire:'Gestionnaire', bailleur:'Bailleur', autre:'Autre' };
const MISES_EN_VALEUR = ['habitation','commerce','agriculture','elevage','plantation','cloture','infrastructure','aucune'];
const MEV_LABELS: Record<string,string> = { habitation:'Habitation', commerce:'Commerce', agriculture:'Agriculture', elevage:'Élevage', plantation:'Plantation', cloture:'Clôture', infrastructure:'Infrastructure', aucune:'Aucune' };
const TYPES_CONSTRUCTION = ['maison_individuelle','appartement','commerce','atelier','hangar','annexe','autre'];
const ETATS_CONSTRUCTION = ['achevee','en_construction','ruine'];
const USAGES_CONSTRUCTION = ['habitation','commerce','stockage','autre'];
const MATERIAUX = ['bois','brique','parpaing','beton','tole','chaume','fibrociment','autre'];
const DOCS_PROPRIETE = ['titre_foncier','certificat_situation_juridique','acte_notarial','aucun','autre'];
const AUTRES_DOCS = ['jorolava','acte_vente','acte_donation','jugement','attestation_heritage','autre'];
const PERSONNES_RENCONTREES = ['detenteur','conjoint','heritier','voisin','gardien','representant','absent','autre'];
const STATUTS_COLLECTE = ['complet','a_verifier','incomplet','annule','doublon'];

// Types anciens conservés pour la rétrocompatibilité (saisie manuelle)
const TYPES_BATIMENT = ['Habitation principale', 'Dépendance', 'Commerce', 'Atelier', 'Hangar', 'Clôture', 'Autre'];
const ETATS_BATIMENT = ['Excellent', 'Bon', 'Moyen', 'Dégradé', 'Ruine'];

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

// ── Composant MultiSelect (cases à cocher en grille) ─────────
function MultiCheck({ options, labels, value, onChange }: {
  options: string[]; labels: Record<string,string>; value: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <label key={o} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold transition select-none ${value.includes(o) ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
          <input type="checkbox" className="rounded w-3 h-3" checked={value.includes(o)} onChange={() => toggle(o)} />
          {labels[o] || o}
        </label>
      ))}
    </div>
  );
}

// ── Modal Parcelle (structure formulaire KoboToolbox PDF) ──────
function ParcelleModal({ parcelle, onClose, onSave }: {
  parcelle?: Parcelle;
  onClose: () => void; onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'01'|'02'|'04'|'05'|'06'|'08'|'10'|'11'|'12'>('01');
  const [data, setData] = useState<any>(parcelle || { fokontany: 'Ambodisaina', statut_collecte: 'a_verifier' });
  // Détenteurs : liste modifiable
  const [detenteurs, setDetenteurs] = useState<any[]>([{}]);
  // Constructions : liste modifiable
  const [constructions, setConstructions] = useState<any[]>([{}]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (parcelle?.id) {
      supabase.from('detenteurs_foncier').select('*').eq('parcelle_id', parcelle.id)
        .then(({ data: d }) => d?.length && setDetenteurs(d));
      supabase.from('constructions_foncier').select('*').eq('parcelle_id', parcelle.id)
        .then(({ data: c }) => c?.length && setConstructions(c));
    }
  }, [parcelle]);

  const up = (k: string, v: any) => setData((p: any) => ({ ...p, [k]: v }));
  const upDet = (idx: number, k: string, v: any) => setDetenteurs(prev => prev.map((d, i) => i === idx ? { ...d, [k]: v } : d));
  const upCon = (idx: number, k: string, v: any) => setConstructions(prev => prev.map((c, i) => i === idx ? { ...c, [k]: v } : c));

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
    const lotId = data.lot_id || data.numero_lot;
    if (!lotId) { alert('Le numéro de lot est obligatoire.'); return; }
    setSaving(true);

    // Données parcelle (tables parcelles)
    const parcelleData = {
      lot_id: data.lot_id || data.numero_lot,
      numero_lot: data.lot_id || data.numero_lot,
      fokontany: data.fokontany,
      quartier: data.quartier,
      carreau: data.carreau,
      adresse: data.adresse,
      statut_propriete: data.statut_propriete,
      occupation_terrain: data.occupation_terrain,
      nature_terrain: data.nature_terrain,
      superficie_declaree: data.superficie_declaree ? parseFloat(data.superficie_declaree) : null,
      superficie_estimee: data.superficie_estimee ? parseFloat(data.superficie_estimee) : null,
      superficie_gps: data.superficie_gps ? parseFloat(data.superficie_gps) : null,
      annee_debut_occupation: data.annee_debut_occupation ? parseInt(data.annee_debut_occupation) : null,
      detenteur_connu: data.detenteur_connu,
      documents_propriete: data.documents_propriete,
      autres_documents: data.autres_documents || [],
      presence_constructions: data.presence_constructions,
      nb_constructions: constructions.filter(c => c.type_construction).length || 0,
      mise_en_valeur: data.mise_en_valeur || [],
      parcelle_amenagee: data.parcelle_amenagee,
      origine_droit: data.origine_droit,
      origine_droit_detail: data.origine_droit_detail,
      annee_acquisition: data.annee_acquisition ? parseInt(data.annee_acquisition) : null,
      gps_lat: data.gps_lat ? parseFloat(data.gps_lat) : null,
      gps_lng: data.gps_lng ? parseFloat(data.gps_lng) : null,
      personne_rencontree: data.personne_rencontree,
      difficulte_rencontree: data.difficulte_rencontree,
      besoin_verification: data.besoin_verification,
      dossier_a_completer: data.dossier_a_completer,
      observations: data.observations,
      statut_collecte: data.statut_collecte || 'a_verifier',
      code_agent: data.code_agent,
      date_collecte: data.date_collecte || new Date().toISOString().slice(0,10),
      photo_url: data.photo_url,
      updated_at: new Date().toISOString(),
    };

    let parcelleId = parcelle?.id;
    if (parcelleId) {
      await supabase.from('parcelles').update(parcelleData).eq('id', parcelleId);
    } else {
      const { data: created } = await supabase.from('parcelles').insert(parcelleData).select().single();
      parcelleId = created?.id;
    }
    if (!parcelleId) { setSaving(false); return; }

    // Détenteurs (table detenteurs_foncier)
    const detsValides = detenteurs.filter(d => d.nom || d.type_personne);
    if (detsValides.length > 0) {
      // Supprimer les anciens puis réinsérer
      await supabase.from('detenteurs_foncier').delete().eq('parcelle_id', parcelleId);
      await supabase.from('detenteurs_foncier').insert(detsValides.map(d => ({ ...d, parcelle_id: parcelleId, id: undefined })));
    }

    // Constructions (table constructions_foncier)
    const consValides = constructions.filter(c => c.type_construction);
    if (consValides.length > 0) {
      await supabase.from('constructions_foncier').delete().eq('parcelle_id', parcelleId);
      await supabase.from('constructions_foncier').insert(consValides.map((c, i) => ({ ...c, parcelle_id: parcelleId, c_num: i+1, id: undefined })));
    }

    setSaving(false);
    onSave();
  };

  const TABS = [
    { key: '01', label: '01 · Identification' },
    { key: '02', label: '02 · Situation' },
    { key: '04', label: '04 · Détenteurs' },
    { key: '05', label: '05 · Mise en valeur' },
    { key: '06', label: '06 · Constructions' },
    { key: '08', label: '08 · Origine droit' },
    { key: '10', label: '10 · GPS' },
    { key: '11', label: '11 · Observations' },
    { key: '12', label: '12 · Validation' },
  ] as const;

  const Textarea = ({ value, onChange, placeholder, rows = 2 }: any) => (
    <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl"><Building2 className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{parcelle ? 'Modifier la parcelle' : 'Nouvelle parcelle'}</h2>
              {(data.lot_id || data.numero_lot) && <p className="text-xs text-indigo-600 font-mono font-bold">LOT {data.lot_id || data.numero_lot}</p>}
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-slate-200 overflow-x-auto shrink-0">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`px-3 py-2.5 text-[11px] font-semibold whitespace-nowrap border-b-2 transition ${activeTab === key ? 'border-indigo-600 text-indigo-700 bg-indigo-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── 01 : IDENTIFICATION ── */}
          {activeTab === '01' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-700 font-medium">Section 01 — Identification de la parcelle</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Numéro de lot *"><Input value={data.lot_id || data.numero_lot} onChange={(v: string) => { up('lot_id', v); up('numero_lot', v); }} placeholder="Ex: 20/AA-146" className="font-mono" /></Field>
                <Field label="Fokontany"><Input value={data.fokontany} onChange={(v: string) => up('fokontany', v)} placeholder="Ambodisaina" /></Field>
                <Field label="Quartier"><Input value={data.quartier} onChange={(v: string) => up('quartier', v)} placeholder="Ex: Antetezana" /></Field>
                <Field label="Carreau"><Input value={data.carreau} onChange={(v: string) => up('carreau', v)} placeholder="Ex: AA" /></Field>
              </div>
              <Field label="Adresse / Repère"><Input value={data.adresse} onChange={(v: string) => up('adresse', v)} placeholder="Adresse ou repère terrain" /></Field>
              <Field label="Photo de la parcelle">
                {data.photo_url ? (
                  <div className="relative h-32 rounded-xl overflow-hidden border border-slate-200">
                    <img src={data.photo_url} className="w-full h-full object-cover" alt="Parcelle" />
                    <button onClick={() => up('photo_url', '')} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-xl cursor-pointer ${uploadingPhoto ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'}`}>
                    <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
                    {uploadingPhoto ? <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" /> : <><Upload className="h-5 w-5 text-slate-300" /><span className="text-xs text-slate-400 mt-1">Ajouter une photo</span></>}
                  </label>
                )}
              </Field>
            </div>
          )}

          {/* ── 02 : SITUATION FONCIÈRE ── */}
          {activeTab === '02' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700 font-medium">Section 02 — Situation foncière et occupation</div>
              <Field label="Statut de propriété">
                <div className="flex flex-wrap gap-2">
                  {STATUTS_PROPRIETE.map(s => (
                    <label key={s} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold transition select-none ${data.statut_propriete === s ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                      <input type="radio" name="statut_propriete" checked={data.statut_propriete === s} onChange={() => up('statut_propriete', s)} className="w-3 h-3" />
                      {STATUTS_LABELS[s]}
                    </label>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nature du terrain">
                  <Select value={data.nature_terrain || ''} onChange={v => up('nature_terrain', v)}
                    options={NATURES_TERRAIN} placeholder="Choisir..." />
                </Field>
                <Field label="Occupation du terrain">
                  <Select value={data.occupation_terrain || ''} onChange={v => up('occupation_terrain', v)}
                    options={TYPES_OCCUPATION_TERRAIN} placeholder="Choisir..." />
                </Field>
                <Field label="Superficie déclarée (m²)"><Input type="number" value={data.superficie_declaree} onChange={(v: string) => up('superficie_declaree', v)} placeholder="Ex: 320" /></Field>
                <Field label="Superficie estimée (m²)"><Input type="number" value={data.superficie_estimee} onChange={(v: string) => up('superficie_estimee', v)} placeholder="Ex: 310" /></Field>
                <Field label="Année début occupation"><Input type="number" value={data.annee_debut_occupation} onChange={(v: string) => up('annee_debut_occupation', v)} placeholder="Ex: 1985" /></Field>
              </div>
              <Field label="Détenteur connu ?">
                <div className="flex gap-3">
                  {['Oui','Non','Incertain'].map(v => (
                    <label key={v} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold transition ${String(data.detenteur_connu) === v ? 'bg-blue-50 border-blue-400 text-blue-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                      <input type="radio" checked={String(data.detenteur_connu) === v} onChange={() => up('detenteur_connu', v)} className="w-3 h-3" />{v}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Documents établissant la propriété">
                <MultiCheck options={DOCS_PROPRIETE} labels={{ titre_foncier:'Titre foncier', certificat_situation_juridique:'Certificat SJ', acte_notarial:'Acte notarial', aucun:'Aucun', autre:'Autre' }}
                  value={data.autres_documents || []} onChange={v => up('autres_documents', v)} />
              </Field>
            </div>
          )}

          {/* ── 04 : DÉTENTEURS ── */}
          {activeTab === '04' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 font-medium">Section 04 — Détenteurs et ayants-droit</div>
              {detenteurs.map((det, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-600 uppercase">Détenteur {idx + 1}</p>
                    {detenteurs.length > 1 && <button onClick={() => setDetenteurs(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  <Field label="Type de personne">
                    <Select value={det.type_personne || ''} onChange={v => upDet(idx, 'type_personne', v)}
                      options={TYPES_PERSONNE} placeholder="Choisir..." />
                  </Field>
                  <Field label="Lien avec la parcelle">
                    <div className="flex flex-wrap gap-2">
                      {LIENS_PARCELLE.map(l => (
                        <label key={l} className={`flex items-center gap-1 px-2 py-1 rounded-lg border cursor-pointer text-xs font-semibold transition select-none ${det.lien_parcelle === l ? 'bg-blue-50 border-blue-400 text-blue-800' : 'bg-white border-slate-200 text-slate-500'}`}>
                          <input type="radio" checked={det.lien_parcelle === l} onChange={() => upDet(idx, 'lien_parcelle', l)} className="w-3 h-3" />
                          {LIENS_LABELS[l]}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nom"><Input value={det.nom} onChange={(v: string) => upDet(idx, 'nom', v)} placeholder="Nom de famille" /></Field>
                    <Field label="Prénom"><Input value={det.prenom} onChange={(v: string) => upDet(idx, 'prenom', v)} placeholder="Prénom" /></Field>
                    <Field label="CIN"><Input value={det.cin} onChange={(v: string) => upDet(idx, 'cin', v)} placeholder="Numéro CIN" className="font-mono" /></Field>
                    <Field label="Date délivrance CIN"><Input type="date" value={det.cin_date} onChange={(v: string) => upDet(idx, 'cin_date', v)} /></Field>
                    <Field label="Lieu délivrance CIN"><Input value={det.cin_lieu} onChange={(v: string) => upDet(idx, 'cin_lieu', v)} placeholder="Ex: Antananarivo" /></Field>
                    <Field label="Téléphone"><Input value={det.telephone} onChange={(v: string) => upDet(idx, 'telephone', v)} placeholder="+261 34..." /></Field>
                  </div>
                  <Field label="Adresse"><Input value={det.adresse} onChange={(v: string) => upDet(idx, 'adresse', v)} placeholder="Adresse du détenteur" /></Field>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={!!det.reside_fkt} onChange={e => upDet(idx, 'reside_fkt', e.target.checked)} />
                      Réside dans le fokontany
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={!!det.present_sur_place} onChange={e => upDet(idx, 'present_sur_place', e.target.checked)} />
                      Présent lors de la visite
                    </label>
                  </div>
                  <Field label="Source d'information">
                    <Input value={det.source_information} onChange={(v: string) => upDet(idx, 'source_information', v)} placeholder="Ex: Voisin, chef fokontany..." />
                  </Field>
                </div>
              ))}
              <button onClick={() => setDetenteurs(prev => [...prev, {}])} className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />Ajouter un détenteur
              </button>
            </div>
          )}

          {/* ── 05 : MISE EN VALEUR ── */}
          {activeTab === '05' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-700 font-medium">Section 05 — Mise en valeur de la parcelle</div>
              <Field label="Types de mise en valeur présents">
                <MultiCheck options={MISES_EN_VALEUR} labels={MEV_LABELS}
                  value={data.mise_en_valeur || []} onChange={v => up('mise_en_valeur', v)} />
              </Field>
              <Field label="Parcelle aménagée ?">
                <div className="flex gap-3">
                  {['Oui','Non','Partiellement','Inconnu'].map(v => (
                    <label key={v} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold transition ${data.parcelle_amenagee === v ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                      <input type="radio" checked={data.parcelle_amenagee === v} onChange={() => up('parcelle_amenagee', v)} className="w-3 h-3" />{v}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Observations mise en valeur">
                <textarea value={data.observations_mev || ''} onChange={e => up('observations_mev', e.target.value)} rows={3}
                  placeholder="Détails sur les cultures, élevage, plantation, clôture..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
              </Field>
            </div>
          )}

          {/* ── 06 : CONSTRUCTIONS ── */}
          {activeTab === '06' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-700 font-medium">Section 06 — Constructions sur la parcelle</div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" className="rounded" checked={!!data.presence_constructions} onChange={e => up('presence_constructions', e.target.checked)} />
                Il y a des constructions sur cette parcelle
              </label>
              {data.presence_constructions && (
                <>
                  {constructions.map((con, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-indigo-600 uppercase">Construction {idx + 1}</p>
                        {constructions.length > 1 && <button onClick={() => setConstructions(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Type">
                          <Select value={con.type_construction || ''} onChange={v => upCon(idx, 'type_construction', v)} options={TYPES_CONSTRUCTION} placeholder="Choisir..." />
                        </Field>
                        <Field label="État">
                          <Select value={con.etat || ''} onChange={v => upCon(idx, 'etat', v)} options={ETATS_CONSTRUCTION} placeholder="Choisir..." />
                        </Field>
                        <Field label="Usage">
                          <Select value={con.usage || ''} onChange={v => upCon(idx, 'usage', v)} options={USAGES_CONSTRUCTION} placeholder="Choisir..." />
                        </Field>
                        <Field label="Surface (m²)"><Input type="number" value={con.surface_m2} onChange={(v: string) => upCon(idx, 'surface_m2', v)} /></Field>
                        <Field label="Nb de pièces"><Input type="number" value={con.nb_pieces} onChange={(v: string) => upCon(idx, 'nb_pieces', v)} /></Field>
                        <Field label="Matériaux murs">
                          <Select value={con.materiaux_murs || ''} onChange={v => upCon(idx, 'materiaux_murs', v)} options={MATERIAUX} placeholder="Choisir..." />
                        </Field>
                        <Field label="Matériaux toiture">
                          <Select value={con.materiaux_toiture || ''} onChange={v => upCon(idx, 'materiaux_toiture', v)} options={MATERIAUX} placeholder="Choisir..." />
                        </Field>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase">Propriétaire de la construction</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={con.proprio_nom} onChange={(v: string) => upCon(idx, 'proprio_nom', v)} placeholder="Nom propriétaire" />
                          <Input value={con.proprio_cin} onChange={(v: string) => upCon(idx, 'proprio_cin', v)} placeholder="CIN" className="font-mono" />
                          <Input value={con.proprio_tel} onChange={(v: string) => upCon(idx, 'proprio_tel', v)} placeholder="Téléphone" />
                          <Input value={con.accord_terrain} onChange={(v: string) => upCon(idx, 'accord_terrain', v)} placeholder="Accord avec propriétaire terrain" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setConstructions(prev => [...prev, {}])} className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition flex items-center justify-center gap-2">
                    <Plus className="h-4 w-4" />Ajouter une construction
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── 08 : ORIGINE DU DROIT ── */}
          {activeTab === '08' && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-700 font-medium">Section 08 — Origine du droit foncier</div>
              <Field label="Origine du droit déclarée">
                <div className="flex flex-wrap gap-2">
                  {ORIGINES_DROIT.map(o => (
                    <label key={o} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold transition select-none ${data.origine_droit === o ? 'bg-purple-50 border-purple-400 text-purple-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                      <input type="radio" name="origine_droit" checked={data.origine_droit === o} onChange={() => up('origine_droit', o)} className="w-3 h-3" />
                      {ORIGINES_LABELS[o]}
                    </label>
                  ))}
                </div>
              </Field>
              {data.origine_droit && data.origine_droit !== 'inconnue' && (
                <div className="grid grid-cols-2 gap-3 bg-purple-50 border border-purple-100 rounded-xl p-3">
                  {data.origine_droit === 'achat' && <>
                    <Field label="Nom du vendeur"><Input value={data.vendeur} onChange={(v: string) => up('vendeur', v)} placeholder="Nom du vendeur" /></Field>
                    <Field label="Année d'achat"><Input type="number" value={data.annee_acquisition} onChange={(v: string) => up('annee_acquisition', v)} placeholder="Ex: 2010" /></Field>
                    <Field label="Prix (Ar)"><Input type="number" value={data.prix_acquisition} onChange={(v: string) => up('prix_acquisition', v)} placeholder="Ex: 5000000" /></Field>
                  </>}
                  {data.origine_droit === 'heritage' && <>
                    <Field label="Nom du défunt"><Input value={data.nom_defunt} onChange={(v: string) => up('nom_defunt', v)} placeholder="Nom du défunt" /></Field>
                    <Field label="Lien de parenté"><Input value={data.lien_parenté} onChange={(v: string) => up('lien_parenté', v)} placeholder="Ex: Père, Mère..." /></Field>
                  </>}
                  {data.origine_droit === 'donation' && <>
                    <Field label="Nom du donateur"><Input value={data.donateur} onChange={(v: string) => up('donateur', v)} placeholder="Nom du donateur" /></Field>
                    <Field label="Date de donation"><Input type="date" value={data.date_donation} onChange={(v: string) => up('date_donation', v)} /></Field>
                  </>}
                  <Field label="Précisions complémentaires">
                    <Input value={data.origine_droit_detail} onChange={(v: string) => up('origine_droit_detail', v)} placeholder="Détails sur l'acquisition..." />
                  </Field>
                </div>
              )}
              <Field label="Autres documents justificatifs">
                <MultiCheck options={AUTRES_DOCS} labels={{ jorolava:'JOROLAVA', acte_vente:'Acte de vente', acte_donation:'Acte de donation', jugement:'Jugement', attestation_heritage:'Attestation héritage', autre:'Autre' }}
                  value={data.autres_documents || []} onChange={v => up('autres_documents', v)} />
              </Field>
            </div>
          )}

          {/* ── 10 : GPS ── */}
          {activeTab === '10' && (
            <div className="space-y-4">
              <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-xs text-teal-700 font-medium">Section 10 — Localisation GPS de la parcelle</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude (visite)"><Input type="number" value={data.gps_lat} onChange={(v: string) => up('gps_lat', v)} placeholder="-18.9100" /></Field>
                <Field label="Longitude (visite)"><Input type="number" value={data.gps_lng} onChange={(v: string) => up('gps_lng', v)} placeholder="47.5250" /></Field>
                <Field label="Superficie GPS (m²)"><Input type="number" value={data.superficie_gps} onChange={(v: string) => up('superficie_gps', v)} placeholder="Calculée depuis polygone" /></Field>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
                <p className="font-semibold mb-1">Points du polygone</p>
                <p>Le polygone parcelle est enregistré automatiquement lors de l'import KoboToolbox. Pour la saisie manuelle, indiquer les coordonnées GPS du point de visite ci-dessus.</p>
              </div>
            </div>
          )}

          {/* ── 11 : OBSERVATIONS ── */}
          {activeTab === '11' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-xs text-orange-700 font-medium">Section 11 — Observations de l'agent de collecte</div>
              <Field label="Personne rencontrée">
                <div className="flex flex-wrap gap-2">
                  {PERSONNES_RENCONTREES.map(p => (
                    <label key={p} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold transition select-none ${data.personne_rencontree === p ? 'bg-orange-50 border-orange-400 text-orange-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                      <input type="radio" name="personne_rencontree" checked={data.personne_rencontree === p} onChange={() => up('personne_rencontree', p)} className="w-3 h-3" />
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Difficulté rencontrée">
                <Input value={data.difficulte_rencontree} onChange={(v: string) => up('difficulte_rencontree', v)} placeholder="Ex: Parcelle clôturée, propriétaire absent..." />
              </Field>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-700 cursor-pointer bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <input type="checkbox" className="rounded" checked={!!data.besoin_verification} onChange={e => up('besoin_verification', e.target.checked)} />
                  ⚠ Vérification requise
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-red-700 cursor-pointer bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <input type="checkbox" className="rounded" checked={!!data.dossier_a_completer} onChange={e => up('dossier_a_completer', e.target.checked)} />
                  📋 Dossier à compléter
                </label>
              </div>
              <Field label="Observations libres">
                <textarea value={data.observations || ''} onChange={e => up('observations', e.target.value)} rows={4}
                  placeholder="Observations, remarques, informations complémentaires..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
              </Field>
            </div>
          )}

          {/* ── 12 : VALIDATION ── */}
          {activeTab === '12' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 font-medium">Section 12 — Validation et statut du dossier</div>
              <Field label="Statut de collecte">
                <div className="flex flex-wrap gap-2">
                  {STATUTS_COLLECTE.map(s => {
                    const colors: Record<string,string> = { complet:'emerald', a_verifier:'amber', incomplet:'red', annule:'slate', doublon:'purple' };
                    const labels: Record<string,string> = { complet:'Complet', a_verifier:'À vérifier', incomplet:'Incomplet', annule:'Annulé', doublon:'Doublon' };
                    const c = colors[s] || 'slate';
                    return (
                      <label key={s} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold transition select-none ${data.statut_collecte === s ? `bg-${c}-50 border-${c}-400 text-${c}-800` : 'bg-white border-slate-200 text-slate-600'}`}>
                        <input type="radio" name="statut_collecte" checked={data.statut_collecte === s} onChange={() => up('statut_collecte', s)} className="w-3 h-3" />
                        {labels[s]}
                      </label>
                    );
                  })}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code agent"><Input value={data.code_agent} onChange={(v: string) => up('code_agent', v)} placeholder="Ex: AGT-001" /></Field>
                <Field label="Date de collecte"><Input type="date" value={data.date_collecte} onChange={(v: string) => up('date_collecte', v)} /></Field>
              </div>
              <Field label="Commentaire de validation">
                <textarea value={data.commentaire_validation || ''} onChange={e => up('commentaire_validation', e.target.value)} rows={3}
                  placeholder="Commentaire sur la validation du dossier..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none resize-none" />
              </Field>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-100 shrink-0">
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
    // Lire depuis les anciennes tables (saisie manuelle) ET les nouvelles tables Kobo
    const [t, d, b, v, dKobo, bKobo, jKobo] = await Promise.all([
      supabase.from('titulaires_fonciers').select('*').eq('parcelle_id', id),
      supabase.from('detenteurs').select('*').eq('parcelle_id', id),
      supabase.from('batiments').select('*').eq('parcelle_id', id),
      supabase.from('mises_en_valeur').select('*').eq('parcelle_id', id),
      // Tables Kobo
      supabase.from('detenteurs_foncier').select('*').eq('parcelle_id', id),
      supabase.from('constructions_foncier').select('*').eq('parcelle_id', id),
      supabase.from('jorolava_foncier').select('*').eq('parcelle_id', id),
    ]);
    // Fusion : priorité aux données Kobo si présentes
    const detenteurKobo = dKobo.data?.[0];
    const detenteurManuel = d.data?.[0];
    const batimentsKobo = bKobo.data || [];
    const batimentsManuel = b.data || [];
    setDetails(prev => ({ ...prev, [id]: {
      titulaire: t.data?.[0],
      detenteur: detenteurManuel,
      detenteurKobo: detenteurKobo,
      tousDetenteurs: dKobo.data || [],
      batiments: batimentsManuel,
      constructions: batimentsKobo,
      jorolava: jKobo.data || [],
      valeur: v.data?.[0]
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
    const lot = ((p as any).lot_id || p.numero_lot || '').toLowerCase();
    return lot.includes(q) || (p.adresse || '').toLowerCase().includes(q) || (p.fokontany || '').toLowerCase().includes(q);
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
                      <span className="font-mono font-bold text-indigo-700 text-sm">LOT {(p as any).lot_id || p.numero_lot || '—'}</span>
                      {((p as any).statut_propriete || p.usage) && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE_USAGE[(p as any).statut_propriete || p.usage || ''] || 'bg-slate-100 text-slate-600'}`}>{(p as any).statut_propriete || p.usage}</span>}
                      {((p as any).statut_collecte) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{(p as any).statut_collecte}</span>}
                      {p.titre_foncier && <span className="text-[10px] text-slate-400 font-mono">{p.titre_foncier}</span>}
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{p.adresse || (p as any).quartier || '—'}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                      {p.fokontany && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.fokontany}</span>}
                      {((p as any).superficie_declaree || p.superficie_m2) && <span>{(p as any).superficie_declaree || p.superficie_m2} m²</span>}
                      {(p as any).nb_constructions > 0 && <span>🏗 {(p as any).nb_constructions} construction{(p as any).nb_constructions > 1 ? 's' : ''}</span>}
                      {(p as any).code_agent && <span>Agent : {(p as any).code_agent}</span>}
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
                  <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3 text-xs">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                      {/* Détenteur (manuel ou Kobo) */}
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <p className="font-bold text-blue-600 uppercase text-[10px] mb-1.5 flex items-center gap-1"><User className="h-3 w-3" />Détenteur</p>
                        {det.detenteur ? (
                          <>
                            <p className="font-semibold text-slate-800">{det.detenteur.nom} {det.detenteur.prenom}</p>
                            <p className="text-slate-500">{det.detenteur.type_detention}</p>
                          </>
                        ) : det.detenteurKobo ? (
                          <>
                            <p className="font-semibold text-slate-800">{det.detenteurKobo.nom} {det.detenteurKobo.prenom}</p>
                            {det.detenteurKobo.type_personne && det.detenteurKobo.type_personne !== 'personne_physique' && (
                              <p className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded inline-block mb-0.5">{det.detenteurKobo.type_personne}</p>
                            )}
                            {det.detenteurKobo.lien_parcelle && <p className="text-slate-500">{det.detenteurKobo.lien_parcelle}</p>}
                            {det.detenteurKobo.cin && <p className="font-mono text-slate-400">CIN : {det.detenteurKobo.cin}{det.detenteurKobo.cin_lieu ? ` (${det.detenteurKobo.cin_lieu})` : ''}</p>}
                            {det.detenteurKobo.telephone && <p className="text-slate-400">☎ {det.detenteurKobo.telephone}</p>}
                            {det.detenteurKobo.source_information && <p className="text-[9px] text-slate-400 mt-0.5">Source : {det.detenteurKobo.source_information}</p>}
                          </>
                        ) : <p className="text-slate-400 italic">Non défini</p>}
                        {/* Infos parcelle : occupation & documents */}
                        {((p as any).annee_debut_occupation || (p as any).documents_propriete) && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-0.5">
                            {(p as any).annee_debut_occupation && <p className="text-[9px] text-slate-400">Occupation depuis : <span className="font-semibold text-slate-600">{(p as any).annee_debut_occupation}</span></p>}
                            {(p as any).documents_propriete && <p className="text-[9px] text-slate-400">Doc. propriété : <span className="font-semibold text-slate-600">{(p as any).documents_propriete}</span></p>}
                            {(p as any).autres_documents?.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {((p as any).autres_documents as string[]).map((d: string) => (
                                  <span key={d} className="bg-violet-50 text-violet-600 px-1 py-0.5 rounded text-[8px]">{d}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Constructions (Kobo) ou Bâtiments (manuel) */}
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <p className="font-bold text-indigo-600 uppercase text-[10px] mb-1.5 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />Bâtiments ({(det.constructions?.length || 0) + (det.batiments?.length || 0)})
                        </p>
                        {det.constructions?.length > 0 ? det.constructions.map((c: any, i: number) => (
                          <div key={c.id || i} className="mb-1.5 pb-1.5 border-b border-slate-50 last:border-0">
                            <p className="font-semibold text-slate-700">{c.type_construction || '—'}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {c.etat && <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[9px]">{c.etat}</span>}
                              {c.usage && <span className="bg-blue-50 text-blue-600 px-1 py-0.5 rounded text-[9px]">{c.usage}</span>}
                              {c.surface_m2 && <span className="text-slate-400 text-[9px]">{c.surface_m2} m²</span>}
                              {c.nb_pieces && <span className="text-slate-400 text-[9px]">{c.nb_pieces} pièces</span>}
                            </div>
                            {c.proprio_nom && <p className="text-slate-400 mt-0.5">Proprio : {c.proprio_nom}</p>}
                          </div>
                        )) : det.batiments?.length > 0 ? det.batiments.map((b: Batiment) => (
                          <div key={b.id} className="mb-1">
                            <p className="font-mono font-semibold text-slate-700">{b.reference_batiment}</p>
                            <p className="text-slate-400">{b.type_batiment} · {b.etat}</p>
                          </div>
                        )) : <p className="text-slate-400 italic">Aucun bâtiment</p>}
                      </div>
                      {/* Mise en valeur / Jorolava */}
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <p className="font-bold text-emerald-600 uppercase text-[10px] mb-1.5 flex items-center gap-1"><Home className="h-3 w-3" />Mise en valeur</p>
                        {/* Kobo: champ mise_en_valeur sur la parcelle */}
                        {(p as any).mise_en_valeur?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {((p as any).mise_en_valeur as string[]).map((v: string) => (
                              <span key={v} className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">{v}</span>
                            ))}
                          </div>
                        ) : det.valeur ? (
                          <div className="flex flex-wrap gap-1">
                            {det.valeur.maison && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Maison</span>}
                            {det.valeur.cloture && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Clôture</span>}
                            {det.valeur.cultures && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Cultures</span>}
                            {det.valeur.elevage && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Élevage</span>}
                            {det.valeur.electricite && <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Électricité</span>}
                            {det.valeur.eau && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">Eau</span>}
                          </div>
                        ) : <p className="text-slate-400 italic">Non renseigné</p>}
                      </div>
                    </div>
                    {/* Jorolava (Kobo uniquement) */}
                    {det.jorolava?.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <p className="font-bold text-purple-600 uppercase text-[10px] mb-2 flex items-center gap-1"><FileText className="h-3 w-3" />Registre Jorolava ({det.jorolava.length})</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {det.jorolava.map((j: any, i: number) => (
                            <div key={j.id || i} className="bg-purple-50 rounded p-2">
                              <p className="font-semibold text-purple-800 text-[10px]">#{j.numero_jorolava || i+1} {j.annee ? `(${j.annee})` : ''}</p>
                              {j.nom_inscrit && <p className="text-purple-600 text-[10px]">{j.nom_inscrit}</p>}
                              {j.reference && <p className="font-mono text-purple-400 text-[9px]">{j.reference}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Tous les détenteurs Kobo */}
                    {(det as any).tousDetenteurs?.length > 1 && (
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <p className="font-bold text-blue-600 uppercase text-[10px] mb-2 flex items-center gap-1"><Users className="h-3 w-3" />Tous les détenteurs ({(det as any).tousDetenteurs.length})</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {(det as any).tousDetenteurs.map((d: any, i: number) => (
                            <div key={d.id || i} className="bg-blue-50 rounded p-2">
                              <p className="font-semibold text-blue-800 text-[10px]">{d.nom} {d.prenom}</p>
                              {d.lien_parcelle && <p className="text-blue-600 text-[10px]">{d.lien_parcelle}</p>}
                              {d.type_personne && d.type_personne !== 'personne_physique' && <p className="text-blue-400 text-[9px]">{d.type_personne}</p>}
                              {d.cin && <p className="font-mono text-blue-400 text-[9px]">CIN : {d.cin}</p>}
                              {d.telephone && <p className="text-blue-400 text-[9px]">☎ {d.telephone}</p>}
                              {d.source_information && <p className="text-blue-300 text-[8px]">Source : {d.source_information}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Informations collecte agent */}
                    {((p as any).personne_rencontree || (p as any).origine_droit || (p as any).observations) && (
                      <div className="bg-white border border-slate-200 rounded-lg p-3">
                        <p className="font-bold text-slate-500 uppercase text-[10px] mb-2 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Observations agent</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-[10px]">
                          {(p as any).origine_droit && (
                            <div><span className="text-slate-400">Origine droit : </span><span className="font-semibold text-slate-700">{(p as any).origine_droit}{(p as any).annee_acquisition ? ` (${(p as any).annee_acquisition})` : ''}</span></div>
                          )}
                          {(p as any).personne_rencontree && (
                            <div><span className="text-slate-400">Personne rencontrée : </span><span className="font-semibold text-slate-700">{(p as any).personne_rencontree}</span></div>
                          )}
                          {(p as any).difficulte_rencontree && (
                            <div><span className="text-slate-400">Difficulté : </span><span className="font-semibold text-slate-700">{(p as any).difficulte_rencontree}</span></div>
                          )}
                          {(p as any).besoin_verification && (
                            <div><span className="bg-amber-100 text-amber-700 px-1 py-0.5 rounded">⚠ Vérification requise</span></div>
                          )}
                          {(p as any).dossier_a_completer && (
                            <div><span className="bg-red-100 text-red-700 px-1 py-0.5 rounded">📋 Dossier à compléter</span></div>
                          )}
                          {(p as any).observations && (
                            <div className="col-span-full mt-1"><span className="text-slate-400">Observations : </span><span className="text-slate-600">{(p as any).observations}</span></div>
                          )}
                        </div>
                      </div>
                    )}
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
