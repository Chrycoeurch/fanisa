import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer } from '../types';
import {
  Home, Car, Tv, Smartphone, Zap, Beef, Briefcase,
  Plus, X, Save, Loader2, Search, ChevronDown, ChevronRight,
  TrendingUp, BarChart2, Star, Edit2, Trash2, Award, Target
} from 'lucide-react';

interface Props { foyers: Foyer[]; }

// ── Constantes ────────────────────────────────────────────────
const IMMOBILIER_TYPES = ['Terrain', 'Maison', 'Commerce', 'Atelier', 'Dépôt', 'Terrain agricole', 'Local professionnel'];
const STATUTS_OCCUPATION = ['Propriétaire occupant', 'Loué', 'Vacant', 'Usage mixte'];
const VEHICULE_TYPES = ['Vélo', 'Moto', 'Scooter', 'Tricycle', 'Voiture', 'Camionnette', 'Camion', 'Tracteur'];
const ETATS = ['Neuf', 'Bon', 'Moyen', 'Mauvais'];

const EQUIPEMENTS: Record<string, { label: string; items: string[] }> = {
  menager:   { label: 'Équipements ménagers',  items: ['Télévision', 'Décodeur TV', 'Réfrigérateur', 'Congélateur', 'Cuisinière gaz', 'Four', 'Machine à laver'] },
  numerique: { label: 'Équipements numériques', items: ['Smartphone', 'Téléphone simple', 'Tablette', 'Ordinateur portable', 'Ordinateur de bureau', 'Imprimante'] },
  energie:   { label: 'Énergie',                items: ['Panneau solaire', 'Batterie solaire', 'Groupe électrogène', 'Onduleur'] },
};

const ANIMAUX = ['Zébus', 'Bovins', 'Porcs', 'Chèvres', 'Moutons', 'Poulets', 'Canards', 'Oies', 'Dindons'];
const ACTIVITES = ['Commerce', 'Agriculture', 'Élevage', 'Artisanat', 'Transport', 'Location immobilière', 'Services'];
const TAILLES = ['Micro', 'Petite', 'Moyenne', 'Grande'];

// ── Score patrimonial ─────────────────────────────────────────
const SCORE_RULES: Record<string, number> = {
  'Maison': 40, 'Terrain': 20, 'Commerce': 15, 'Terrain agricole': 12,
  'Local professionnel': 18, 'Atelier': 10, 'Dépôt': 8,
  'Voiture': 20, 'Camionnette': 18, 'Camion': 25, 'Tracteur': 22,
  'Moto': 10, 'Scooter': 8, 'Tricycle': 5, 'Vélo': 2,
  'Réfrigérateur': 5, 'Congélateur': 5, 'Télévision': 4,
  'Machine à laver': 6, 'Cuisinière gaz': 3, 'Four': 3, 'Décodeur TV': 1,
  'Ordinateur portable': 8, 'Ordinateur de bureau': 7, 'Tablette': 5,
  'Smartphone': 3, 'Imprimante': 4,
  'Panneau solaire': 10, 'Groupe électrogène': 8, 'Batterie solaire': 6, 'Onduleur': 4,
};

function calcScore(data: PatrimoineData): { score: number; niveau: string; couleur: string } {
  let score = 0;
  (data.immobilier || []).forEach(b => { score += SCORE_RULES[b.type_bien] || 5; });
  (data.vehicules || []).forEach(v => { score += SCORE_RULES[v.type_vehicule] || 3; });
  (data.equipements || []).forEach(e => { score += (SCORE_RULES[e.type_equipement] || 2) * (e.quantite || 1); });
  (data.activites || []).forEach(a => { score += 15; });
  (data.elevage || []).forEach(e => {
    const pts: Record<string,number> = {'Zébus':8,'Bovins':6,'Porcs':4,'Chèvres':3,'Moutons':3,'Poulets':1,'Canards':1,'Oies':1,'Dindons':1};
    score += (pts[e.type_animal]||1) * Math.min(e.quantite||0, 20);
  });
  let niveau = '', couleur = '';
  if (score < 20)       { niveau = 'Très vulnérable'; couleur = 'red'; }
  else if (score < 50)  { niveau = 'Vulnérable';       couleur = 'orange'; }
  else if (score < 100) { niveau = 'Moyen';             couleur = 'amber'; }
  else if (score < 180) { niveau = 'Stable';            couleur = 'blue'; }
  else                  { niveau = 'Aisé';              couleur = 'green'; }
  return { score, niveau, couleur };
}

interface PatrimoineData {
  immobilier: any[];
  vehicules: any[];
  equipements: any[];
  elevage: any[];
  activites: any[];
}

const COLOR: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  red:    { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    badge: 'bg-red-600' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-500' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  badge: 'bg-amber-500' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   badge: 'bg-blue-600' },
  green:  { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',badge: 'bg-emerald-600' },
};

// ── Formulaire Patrimoine ─────────────────────────────────────
function PatrimoineForm({ foyer, onClose, onSave }: { foyer: Foyer; onClose: () => void; onSave: () => void }) {
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'immobilier'|'vehicules'|'equipements'|'elevage'|'activites'|'score'>('immobilier');
  const [immobilier, setImmobilier] = useState<any[]>([]);
  const [vehicules, setVehicules] = useState<any[]>([]);
  const [equipements, setEquipements] = useState<any[]>([]);
  const [elevage, setElevage] = useState<any[]>([]);
  const [activites, setActivites] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [im, ve, eq, el, ac] = await Promise.all([
        supabase.from('patrimoine_immobilier').select('*').eq('foyer_id', foyer.id),
        supabase.from('patrimoine_vehicules').select('*').eq('foyer_id', foyer.id),
        supabase.from('patrimoine_equipements').select('*').eq('foyer_id', foyer.id),
        supabase.from('patrimoine_elevage').select('*').eq('foyer_id', foyer.id),
        supabase.from('patrimoine_activites').select('*').eq('foyer_id', foyer.id),
      ]);
      setImmobilier(im.data || []);
      setVehicules(ve.data || []);
      setElevage(el.data || []);
      setActivites(ac.data || []);
      // Init équipements avec toutes les catégories
      const eqData = eq.data || [];
      const allEq: any[] = [];
      Object.entries(EQUIPEMENTS).forEach(([cat, { items }]) => {
        items.forEach(item => {
          const existing = eqData.find((e: any) => e.type_equipement === item && e.categorie === cat);
          allEq.push(existing || { categorie: cat, type_equipement: item, quantite: 0, puissance: '' });
        });
      });
      setEquipements(allEq);
    };
    load();
  }, [foyer.id]);

  const data: PatrimoineData = { immobilier, vehicules, equipements: equipements.filter(e => e.quantite > 0), elevage, activites };
  const scoreResult = calcScore(data);

  const handleSave = async () => {
    setSaving(true);
    // Immobilier — delete + reinsert
    await supabase.from('patrimoine_immobilier').delete().eq('foyer_id', foyer.id);
    if (immobilier.length > 0) await supabase.from('patrimoine_immobilier').insert(immobilier.map(i => ({ ...i, foyer_id: foyer.id })));
    // Véhicules
    await supabase.from('patrimoine_vehicules').delete().eq('foyer_id', foyer.id);
    if (vehicules.length > 0) await supabase.from('patrimoine_vehicules').insert(vehicules.map(v => ({ ...v, foyer_id: foyer.id })));
    // Équipements (seulement ceux avec quantite > 0)
    await supabase.from('patrimoine_equipements').delete().eq('foyer_id', foyer.id);
    const eqToSave = equipements.filter(e => e.quantite > 0);
    if (eqToSave.length > 0) await supabase.from('patrimoine_equipements').insert(eqToSave.map(e => ({ ...e, foyer_id: foyer.id })));
    // Élevage (seulement quantite > 0)
    await supabase.from('patrimoine_elevage').delete().eq('foyer_id', foyer.id);
    const elToSave = elevage.filter(e => e.quantite > 0);
    if (elToSave.length > 0) await supabase.from('patrimoine_elevage').insert(elToSave.map(e => ({ ...e, foyer_id: foyer.id })));
    // Activités
    await supabase.from('patrimoine_activites').delete().eq('foyer_id', foyer.id);
    if (activites.length > 0) await supabase.from('patrimoine_activites').insert(activites.map(a => ({ ...a, foyer_id: foyer.id })));
    // Score global
    await supabase.from('patrimoine_foyer').upsert({ foyer_id: foyer.id, score_patrimonial: scoreResult.score, niveau_patrimonial: scoreResult.niveau, updated_at: new Date().toISOString() }, { onConflict: 'foyer_id' });
    setSaving(false);
    onSave();
  };

  const TABS = [
    { key: 'immobilier', label: 'Immobilier', icon: Home },
    { key: 'vehicules', label: 'Véhicules', icon: Car },
    { key: 'equipements', label: 'Équipements', icon: Tv },
    { key: 'elevage', label: 'Élevage', icon: Beef },
    { key: 'activites', label: 'Activités', icon: Briefcase },
    { key: 'score', label: 'Score', icon: Star },
  ] as const;

  const scoreColors = COLOR[scoreResult.couleur];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-xl"><Award className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Patrimoine & Équipements</h2>
              <p className="text-xs text-slate-500 font-mono">{foyer.code_menage} · {foyer.fokontany}</p>
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto shrink-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key as any)} className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition ${tab === key ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── IMMOBILIER ── */}
          {tab === 'immobilier' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Recenser tous les biens immobiliers appartenant au ménage.</p>
              {immobilier.map((b, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-600 uppercase">Bien {i + 1}</span>
                    <button onClick={() => setImmobilier(prev => prev.filter((_, j) => j !== i))}><X className="h-4 w-4 text-slate-400 hover:text-red-500" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Type de bien *</label>
                      <select value={b.type_bien || ''} onChange={e => setImmobilier(prev => prev.map((x,j)=>j===i?{...x,type_bien:e.target.value}:x))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-purple-500">
                        <option value="">Choisir...</option>
                        {IMMOBILIER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Statut d'occupation</label>
                      <select value={b.statut_occupation || ''} onChange={e => setImmobilier(prev => prev.map((x,j)=>j===i?{...x,statut_occupation:e.target.value}:x))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-purple-500">
                        <option value="">Choisir...</option>
                        {STATUTS_OCCUPATION.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Adresse / Référence Fanisa</label>
                      <input value={b.adresse || ''} onChange={e => setImmobilier(prev => prev.map((x,j)=>j===i?{...x,adresse:e.target.value}:x))} placeholder="Adresse ou LOT..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Valeur estimée (Ar)</label>
                      <input type="number" value={b.valeur_estimee || ''} onChange={e => setImmobilier(prev => prev.map((x,j)=>j===i?{...x,valeur_estimee:parseFloat(e.target.value)}:x))} placeholder="Facultatif" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setImmobilier(prev => [...prev, { type_bien: '', adresse: '', statut_occupation: '', valeur_estimee: null }])} className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-purple-400 hover:text-purple-600 transition flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />Ajouter un bien immobilier
              </button>
            </div>
          )}

          {/* ── VÉHICULES ── */}
          {tab === 'vehicules' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Recenser tous les véhicules appartenant au ménage.</p>
              {vehicules.map((v, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-600 uppercase">Véhicule {i + 1}</span>
                    <button onClick={() => setVehicules(prev => prev.filter((_, j) => j !== i))}><X className="h-4 w-4 text-slate-400 hover:text-red-500" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Type *</label>
                      <select value={v.type_vehicule || ''} onChange={e => setVehicules(prev => prev.map((x,j)=>j===i?{...x,type_vehicule:e.target.value}:x))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-purple-500">
                        <option value="">Choisir...</option>
                        {VEHICULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">État</label>
                      <select value={v.etat || ''} onChange={e => setVehicules(prev => prev.map((x,j)=>j===i?{...x,etat:e.target.value}:x))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-purple-500">
                        <option value="">Choisir...</option>
                        {ETATS.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Marque</label>
                      <input value={v.marque || ''} onChange={e => setVehicules(prev => prev.map((x,j)=>j===i?{...x,marque:e.target.value}:x))} placeholder="Ex: Honda, Toyota..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Modèle</label>
                      <input value={v.modele || ''} onChange={e => setVehicules(prev => prev.map((x,j)=>j===i?{...x,modele:e.target.value}:x))} placeholder="Ex: Wave, Hilux..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Année</label>
                      <input type="number" value={v.annee || ''} onChange={e => setVehicules(prev => prev.map((x,j)=>j===i?{...x,annee:parseInt(e.target.value)}:x))} placeholder="Ex: 2018" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Immatriculation (facultatif)</label>
                      <input value={v.immatriculation || ''} onChange={e => setVehicules(prev => prev.map((x,j)=>j===i?{...x,immatriculation:e.target.value}:x))} placeholder="Ex: TMN 1234" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-purple-500" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setVehicules(prev => [...prev, { type_vehicule: '', marque: '', modele: '', annee: null, etat: 'Bon', immatriculation: '' }])} className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-purple-400 hover:text-purple-600 transition flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />Ajouter un véhicule
              </button>
            </div>
          )}

          {/* ── ÉQUIPEMENTS ── */}
          {tab === 'equipements' && (
            <div className="space-y-5">
              {Object.entries(EQUIPEMENTS).map(([cat, { label, items }]) => (
                <div key={cat}>
                  <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">{label}</h4>
                  <div className="space-y-2">
                    {items.map(item => {
                      const eq = equipements.find(e => e.type_equipement === item && e.categorie === cat);
                      const qty = eq?.quantite || 0;
                      return (
                        <div key={item} className={`flex items-center justify-between p-2.5 rounded-lg border transition ${qty > 0 ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}>
                          <span className={`text-sm font-medium ${qty > 0 ? 'text-purple-800' : 'text-slate-600'}`}>{item}</span>
                          <div className="flex items-center gap-2">
                            {cat === 'energie' && qty > 0 && (
                              <input value={eq?.puissance || ''} onChange={e => setEquipements(prev => prev.map(x => x.type_equipement === item && x.categorie === cat ? { ...x, puissance: e.target.value } : x))} placeholder="Puissance" className="border border-slate-200 rounded-lg px-2 py-1 text-xs w-24 outline-none" />
                            )}
                            <button onClick={() => setEquipements(prev => prev.map(x => x.type_equipement === item && x.categorie === cat ? { ...x, quantite: Math.max(0, (x.quantite || 0) - 1) } : x))} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-red-100 text-slate-600 font-bold flex items-center justify-center text-sm transition">−</button>
                            <span className={`w-8 text-center font-bold text-sm ${qty > 0 ? 'text-purple-700' : 'text-slate-400'}`}>{qty}</span>
                            <button onClick={() => setEquipements(prev => prev.map(x => x.type_equipement === item && x.categorie === cat ? { ...x, quantite: (x.quantite || 0) + 1 } : x))} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-purple-100 text-slate-600 font-bold flex items-center justify-center text-sm transition">+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ÉLEVAGE ── */}
          {tab === 'elevage' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Indiquer les quantités d'animaux possédées par le ménage.</p>
              <div className="space-y-2">
                {ANIMAUX.map(animal => {
                  const existing = elevage.find(e => e.type_animal === animal);
                  const qty = existing?.quantite || 0;
                  return (
                    <div key={animal} className={`flex items-center justify-between p-3 rounded-xl border transition ${qty > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <span className={`text-sm font-medium ${qty > 0 ? 'text-emerald-800' : 'text-slate-600'}`}>{animal}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setElevage(prev => { const e = prev.find(x=>x.type_animal===animal); if(e) return prev.map(x=>x.type_animal===animal?{...x,quantite:Math.max(0,x.quantite-1)}:x); return prev; })} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-red-100 text-slate-600 font-bold flex items-center justify-center transition">−</button>
                        <span className={`w-10 text-center font-bold ${qty > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{qty}</span>
                        <button onClick={() => setElevage(prev => { const e = prev.find(x=>x.type_animal===animal); if(e) return prev.map(x=>x.type_animal===animal?{...x,quantite:x.quantite+1}:x); return [...prev,{type_animal:animal,quantite:1}]; })} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-600 font-bold flex items-center justify-center transition">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ACTIVITÉS ── */}
          {tab === 'activites' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Recenser toutes les activités productives du ménage.</p>
              {activites.map((a, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-600 uppercase">Activité {i + 1}</span>
                    <button onClick={() => setActivites(prev => prev.filter((_, j) => j !== i))}><X className="h-4 w-4 text-slate-400 hover:text-red-500" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Type *</label>
                      <select value={a.type_activite || ''} onChange={e => setActivites(prev => prev.map((x,j)=>j===i?{...x,type_activite:e.target.value}:x))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-purple-500">
                        <option value="">Choisir...</option>
                        {ACTIVITES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Taille</label>
                      <select value={a.taille || ''} onChange={e => setActivites(prev => prev.map((x,j)=>j===i?{...x,taille:e.target.value}:x))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-purple-500">
                        <option value="">Choisir...</option>
                        {TAILLES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                      <input value={a.description || ''} onChange={e => setActivites(prev => prev.map((x,j)=>j===i?{...x,description:e.target.value}:x))} placeholder="Détails..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Revenu estimé (Ar/mois)</label>
                      <input type="number" value={a.revenu_estime || ''} onChange={e => setActivites(prev => prev.map((x,j)=>j===i?{...x,revenu_estime:parseFloat(e.target.value)}:x))} placeholder="Facultatif" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setActivites(prev => [...prev, { type_activite: '', description: '', taille: '', revenu_estime: null }])} className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-purple-400 hover:text-purple-600 transition flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />Ajouter une activité
              </button>
            </div>
          )}

          {/* ── SCORE ── */}
          {tab === 'score' && (
            <div className="space-y-4">
              {/* Score principal */}
              <div className={`${scoreColors.bg} ${scoreColors.border} border-2 rounded-2xl p-6 text-center`}>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Score patrimonial</p>
                <p className={`text-6xl font-black ${scoreColors.text}`}>{scoreResult.score}</p>
                <p className={`text-lg font-bold ${scoreColors.text} mt-1`}>{scoreResult.niveau}</p>
                {/* Barre de progression */}
                <div className="mt-4 bg-white/60 rounded-full h-3 w-full max-w-xs mx-auto">
                  <div className={`h-3 rounded-full ${scoreColors.badge} transition-all`} style={{ width: `${Math.min(scoreResult.score / 2.5, 100)}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-2">{Math.min(scoreResult.score, 250)} / 250 points</p>
              </div>

              {/* Grille des niveaux */}
              <div className="grid grid-cols-5 gap-1.5">
                {[['Très vulnérable','< 20','red'],['Vulnérable','< 50','orange'],['Moyen','< 100','amber'],['Stable','< 180','blue'],['Aisé','180+','green']].map(([n,r,c])=>(
                  <div key={n} className={`p-2 rounded-lg text-center text-[10px] ${COLOR[c].bg} ${COLOR[c].border} border ${scoreResult.niveau === n ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                    <p className={`font-bold ${COLOR[c].text}`}>{n}</p>
                    <p className={`${COLOR[c].text} opacity-70`}>{r} pts</p>
                  </div>
                ))}
              </div>

              {/* Détail des points */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase">Détail des points</h4>
                {[
                  { label: 'Biens immobiliers', value: immobilier.reduce((s,b) => s+(SCORE_RULES[b.type_bien]||5), 0), icon: Home },
                  { label: 'Véhicules', value: vehicules.reduce((s,v) => s+(SCORE_RULES[v.type_vehicule]||3), 0), icon: Car },
                  { label: 'Équipements', value: equipements.filter(e=>e.quantite>0).reduce((s,e) => s+(SCORE_RULES[e.type_equipement]||2)*(e.quantite||1), 0), icon: Tv },
                  { label: 'Activités productives', value: activites.length*15, icon: Briefcase },
                  { label: 'Élevage', value: elevage.reduce((s,e)=>{const p:any={'Zébus':8,'Bovins':6,'Porcs':4,'Chèvres':3,'Moutons':3,'Poulets':1,'Canards':1,'Oies':1,'Dindons':1};return s+(p[e.type_animal]||1)*Math.min(e.quantite||0,20);},0), icon: Beef },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-2 text-xs text-slate-600"><Icon className="h-3.5 w-3.5" />{label}</span>
                    <span className="font-bold text-sm text-slate-800">{value} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Save className="h-4 w-4" />Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vue principale ────────────────────────────────────────────
export default function PatrimoineModule({ foyers }: Props) {
  const [search, setSearch] = useState('');
  const [editingFoyer, setEditingFoyer] = useState<Foyer | null>(null);
  const [scores, setScores] = useState<Record<string, any>>({});
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: scoreData } = await supabase.from('patrimoine_foyer').select('*');
    const scoreMap: Record<string, any> = {};
    (scoreData || []).forEach((s: any) => { scoreMap[s.foyer_id] = s; });
    setScores(scoreMap);

    // Stats globales
    const [imm, veh, eq, el, act] = await Promise.all([
      supabase.from('patrimoine_immobilier').select('type_bien'),
      supabase.from('patrimoine_vehicules').select('type_vehicule'),
      supabase.from('patrimoine_equipements').select('type_equipement, quantite'),
      supabase.from('patrimoine_elevage').select('type_animal, quantite'),
      supabase.from('patrimoine_activites').select('type_activite'),
    ]);
    setStats({
      motos: (veh.data||[]).filter((v:any)=>v.type_vehicule==='Moto').length,
      voitures: (veh.data||[]).filter((v:any)=>v.type_vehicule==='Voiture').length,
      commerces: (imm.data||[]).filter((b:any)=>b.type_bien==='Commerce').length,
      frigos: (eq.data||[]).filter((e:any)=>e.type_equipement==='Réfrigérateur').reduce((s:number,e:any)=>s+(e.quantite||0),0),
      solaire: (eq.data||[]).filter((e:any)=>e.type_equipement==='Panneau solaire').reduce((s:number,e:any)=>s+(e.quantite||0),0),
      zebus: (el.data||[]).filter((e:any)=>e.type_animal==='Zébus').reduce((s:number,e:any)=>s+(e.quantite||0),0),
    });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = foyers.filter(f => {
    const q = search.toLowerCase();
    return f.code_menage.toLowerCase().includes(q) || (f.adresse||'').toLowerCase().includes(q) || (f.fokontany||'').toLowerCase().includes(q);
  });

  const NIVEAU_COLORS = { 'Très vulnérable': 'red', 'Vulnérable': 'orange', 'Moyen': 'amber', 'Stable': 'blue', 'Aisé': 'green' } as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2.5 rounded-xl"><Award className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Patrimoine & Équipements</h2>
              <p className="text-xs text-slate-500">Recensement du patrimoine des ménages — alimentation automatique FFA</p>
            </div>
          </div>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un foyer..." className="w-full text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-purple-500" />
        </div>
      </div>

      {/* Stats globales */}
      {!loading && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: 'Motos', value: stats.motos||0, icon: '🏍️' },
            { label: 'Voitures', value: stats.voitures||0, icon: '🚗' },
            { label: 'Commerces', value: stats.commerces||0, icon: '🏪' },
            { label: 'Réfrigérateurs', value: stats.frigos||0, icon: '🧊' },
            { label: 'Panneaux solaires', value: stats.solaire||0, icon: '☀️' },
            { label: 'Zébus', value: stats.zebus||0, icon: '🐄' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-2xl">{icon}</p>
              <p className="text-xl font-bold text-slate-900">{value}</p>
              <p className="text-[10px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Distribution niveaux */}
      {!loading && Object.keys(scores).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><BarChart2 className="h-4 w-4" />Distribution des niveaux patrimoniaux</h3>
          <div className="flex gap-2 flex-wrap">
            {(['Très vulnérable','Vulnérable','Moyen','Stable','Aisé'] as const).map(niveau => {
              const count = Object.values(scores).filter((s:any) => s.niveau_patrimonial === niveau).length;
              const c = COLOR[NIVEAU_COLORS[niveau]];
              return (
                <div key={niveau} className={`${c.bg} ${c.border} border rounded-lg px-3 py-2 flex items-center gap-2`}>
                  <span className={`text-lg font-bold ${c.text}`}>{count}</span>
                  <span className={`text-xs font-medium ${c.text}`}>{niveau}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste foyers */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-10"><Loader2 className="h-8 w-8 text-purple-600 animate-spin mx-auto" /></div>
        ) : filtered.map(foyer => {
          const score = scores[foyer.id];
          const niveau = score?.niveau_patrimonial;
          const c = niveau ? COLOR[NIVEAU_COLORS[niveau as keyof typeof NIVEAU_COLORS] || 'amber'] : null;
          return (
            <div key={foyer.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-purple-200 transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-indigo-600 text-sm">{foyer.code_menage}</span>
                  {score && c && (
                    <span className={`${c.badge} text-white text-[10px] font-bold px-2 py-0.5 rounded-full`}>{niveau}</span>
                  )}
                  {score && <span className="text-xs text-slate-500 font-semibold">{score.score_patrimonial} pts</span>}
                  {!score && <span className="text-[10px] text-slate-400 italic bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">Non recensé</span>}
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{foyer.adresse || foyer.fokontany || '—'}</p>
              </div>
              <button onClick={() => setEditingFoyer(foyer)} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition shrink-0">
                <Edit2 className="h-3.5 w-3.5" />{score ? 'Modifier' : 'Recenser'}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && !loading && (
          <div className="text-center py-10 text-slate-400">
            <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Aucun foyer trouvé</p>
          </div>
        )}
      </div>

      {editingFoyer && (
        <PatrimoineForm foyer={editingFoyer} onClose={() => setEditingFoyer(null)} onSave={() => { setEditingFoyer(null); loadData(); }} />
      )}
    </div>
  );
}
