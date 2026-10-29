/**
 * MaterialsModule.tsx — Gestion des matériels du Fokontany
 * - Stock persisté en Supabase
 * - Valeur globale = valeur_unitaire × quantite_total
 * - Prix de location configurable par matériel
 * - Prêts persistés + retour stock
 * - Si prêt payant → crée une recette dans la table finances
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Materiel, MaterielPret, Foyer } from '../types';
import {
  Package, Wrench, CheckCircle, AlertTriangle, Search, Plus, X,
  Calendar, MapPin, Trash2, ArrowRightLeft, Landmark, Loader2,
  RotateCcw, Tag, Save, Edit2, TrendingUp, DollarSign
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('fr-FR');

function etatColor(etat: Materiel['etat']) {
  switch (etat) {
    case 'Excellent': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Bon':       return 'bg-cyan-50 text-cyan-800 border-cyan-200';
    case 'Moyen':     return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'Détérioré': return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'En panne':  return 'bg-rose-50 text-rose-800 border-rose-200';
    default:          return 'bg-slate-50 text-slate-700';
  }
}

function joursEntre(d1: string, d2: string): number {
  const diff = new Date(d2).getTime() - new Date(d1).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ── Formulaire ajout/édition matériel ────────────────────────────────────────
function FormMateriel({
  materiel,
  onSave,
  onClose,
}: {
  materiel?: Materiel;
  onSave: () => void;
  onClose: () => void;
}) {
  const isEdit = !!materiel;
  const [nom, setNom] = useState(materiel?.nom || '');
  const [categorie, setCategorie] = useState<Materiel['categorie']>(materiel?.categorie || 'Mobilier');
  const [qty, setQty] = useState(materiel?.quantite_total || 1);
  const [etat, setEtat] = useState<Materiel['etat']>(materiel?.etat || 'Bon');
  const [valeurUnitaire, setValeurUnitaire] = useState(materiel?.valeur_unitaire || 0);
  const [prixLocation, setPrixLocation] = useState(materiel?.prix_location || 0);
  const [responsable, setResponsable] = useState(materiel?.responsable || 'Secrétaire Fokontany');
  const [stockage, setStockage] = useState(materiel?.lieu_stockage || 'Grande salle du Fokontany');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) return;
    setSaving(true);

    const payload: Partial<Materiel> = {
      nom: nom.trim(),
      categorie,
      quantite_total: qty,
      etat,
      valeur_unitaire: valeurUnitaire,
      prix_location: prixLocation,
      responsable: responsable.trim(),
      lieu_stockage: stockage.trim(),
    };

    if (isEdit) {
      // Si on augmente la quantité totale, on augmente la dispo du même delta
      const delta = qty - materiel!.quantite_total;
      if (delta > 0) {
        payload.quantite_disponible = materiel!.quantite_disponible + delta;
      }
      payload.updated_at = new Date().toISOString();
      await supabase.from('materiels').update(payload).eq('id', materiel!.id);
    } else {
      payload.quantite_disponible = qty;
      payload.date_acquisition = new Date().toISOString().split('T')[0];
      await supabase.from('materiels').insert(payload);
    }

    setSaving(false);
    onSave();
  };

  const valeurGlobale = valeurUnitaire * qty;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
            {isEdit ? 'Modifier le matériel' : 'Inscrire un équipement'}
          </h3>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-3 text-xs">
          {/* Nom */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Désignation *</label>
            <input
              autoFocus
              value={nom}
              onChange={e => setNom(e.target.value)}
              required
              placeholder="Ex: Chaises vertes, Mégaphone…"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Catégorie */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Catégorie</label>
              <select value={categorie} onChange={e => setCategorie(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400 bg-white">
                {['Mobilier','Informatique','Logistique','Événementiel','Sécurité','Autre'].map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
            {/* État */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">État</label>
              <select value={etat} onChange={e => setEtat(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400 bg-white">
                {['Excellent','Bon','Moyen','Détérioré','En panne'].map(e =>
                  <option key={e} value={e}>{e}</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Quantité */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Quantité totale</label>
              <input type="number" min={isEdit ? (materiel!.quantite_total - materiel!.quantite_disponible) : 1} value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400 font-mono" />
            </div>
            {/* Valeur unitaire */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Valeur unitaire (Ar)</label>
              <input type="number" min={0} value={valeurUnitaire || ''}
                onChange={e => setValeurUnitaire(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400 font-mono" />
            </div>
            {/* Prix location */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Loyer/unité/jour (Ar)</label>
              <input type="number" min={0} value={prixLocation || ''}
                onChange={e => setPrixLocation(parseInt(e.target.value) || 0)}
                placeholder="0 = gratuit"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400 font-mono" />
            </div>
          </div>

          {/* Aperçu valeur globale */}
          {valeurUnitaire > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-indigo-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-indigo-500 font-semibold uppercase">Valeur globale estimée</p>
                <p className="font-mono font-black text-indigo-900 text-sm">{fmt(valeurGlobale)} Ar</p>
                <p className="text-[10px] text-indigo-400">{fmt(valeurUnitaire)} Ar × {qty} unités</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Lieu de stockage</label>
              <input value={stockage} onChange={e => setStockage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Responsable</label>
              <input value={responsable} onChange={e => setResponsable(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400" />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? 'Mettre à jour' : 'Inscrire'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Formulaire prêt ───────────────────────────────────────────────────────────
function FormPret({
  materiel,
  foyers,
  onSave,
  onClose,
}: {
  materiel: Materiel;
  foyers: Foyer[];
  onSave: () => void;
  onClose: () => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const [emprunteur, setEmprunteur] = useState('');
  const [foyerId, setFoyerId] = useState('');
  const [qty, setQty] = useState(1);
  const [dateRetour, setDateRetour] = useState(tomorrowStr);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const jours = joursEntre(today, dateRetour);
  const tarifTotal = materiel.prix_location * qty * jours;
  const estPayant = tarifTotal > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emprunteur.trim()) return;
    setSaving(true);

    let finance_id: string | undefined;

    // Si payant → créer une recette dans finances
    if (estPayant) {
      const recette = {
        date: today,
        type: 'Recette',
        categorie: 'Location matériel',
        description: `Location ${materiel.nom} × ${qty} — ${emprunteur} (${jours} j)`,
        montant: tarifTotal,
        statut: 'En attente',
        reference: `LOC-${Date.now()}`,
        foyer_id: foyerId || null,
      };
      const { data: fin } = await supabase.from('finances').insert(recette).select('id').single();
      finance_id = fin?.id;
    }

    // Créer le prêt
    await supabase.from('materiels_prets').insert({
      materiel_id: materiel.id,
      emprunteur: emprunteur.trim(),
      foyer_id: foyerId || null,
      quantite: qty,
      date_emprunt: today,
      date_retour_prevue: dateRetour,
      tarif_total: tarifTotal,
      statut: 'En cours',
      notes: notes.trim() || null,
      finance_id: finance_id || null,
    });

    // Décrémenter le stock disponible
    await supabase.from('materiels')
      .update({ quantite_disponible: materiel.quantite_disponible - qty, updated_at: new Date().toISOString() })
      .eq('id', materiel.id);

    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Prêt de matériel</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-3 text-xs">
          {/* Info matériel */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
            <p className="font-bold text-indigo-900 text-sm">{materiel.nom}</p>
            <p className="text-indigo-500 text-[10px]">
              Dispo : <strong>{materiel.quantite_disponible}</strong> unités
              {materiel.prix_location > 0 && (
                <span> · <strong>{fmt(materiel.prix_location)} Ar</strong>/unité/jour</span>
              )}
              {materiel.prix_location === 0 && <span> · Prêt gratuit</span>}
            </p>
          </div>

          {/* Emprunteur */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Emprunteur *</label>
            <input autoFocus value={emprunteur} onChange={e => setEmprunteur(e.target.value)} required
              placeholder="Nom de l'emprunteur"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-400" />
          </div>

          {/* Foyer lié (optionnel) */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Foyer lié (optionnel)</label>
            <select value={foyerId} onChange={e => setFoyerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 bg-white">
              <option value="">— Aucun —</option>
              {foyers.map(f => <option key={f.id} value={f.id}>{f.code_menage}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Quantité */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Quantité</label>
              <input type="number" min={1} max={materiel.quantite_disponible} value={qty}
                onChange={e => setQty(Math.min(materiel.quantite_disponible, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-mono" />
            </div>
            {/* Date retour */}
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Retour prévu</label>
              <input type="date" min={today} value={dateRetour} onChange={e => setDateRetour(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-mono" />
            </div>
          </div>

          {/* Calcul tarif */}
          <div className={`rounded-xl p-3 border ${estPayant ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Durée</span>
              <span className="font-mono font-bold text-slate-700">{jours} jour{jours > 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] font-bold uppercase">{estPayant ? 'Tarif à facturer' : 'Prêt gratuit'}</span>
              <span className={`font-mono font-black text-sm ${estPayant ? 'text-amber-800' : 'text-emerald-700'}`}>
                {estPayant ? `${fmt(tarifTotal)} Ar` : '0 Ar'}
              </span>
            </div>
            {estPayant && (
              <p className="text-[10px] text-amber-600 mt-1">
                Une recette sera créée automatiquement dans Finances.
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Notes (optionnel)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              Confirmer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Module principal ──────────────────────────────────────────────────────────
export default function MaterialsModule({ foyers }: { foyers: Foyer[] }) {
  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [prets, setPrets] = useState<MaterielPret[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('all');
  const [filterEtat, setFilterEtat] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editingMat, setEditingMat] = useState<Materiel | undefined>();
  const [showPret, setShowPret] = useState(false);
  const [selectedMat, setSelectedMat] = useState<Materiel | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from('materiels').select('*').order('created_at', { ascending: false }),
      supabase.from('materiels_prets').select('*').order('created_at', { ascending: false }),
    ]);
    setMateriels((m || []) as Materiel[]);
    setPrets((p || []) as MaterielPret[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalQty = materiels.reduce((s, m) => s + m.quantite_total, 0);
  const dispoQty = materiels.reduce((s, m) => s + m.quantite_disponible, 0);
  const enPanne = materiels.filter(m => m.etat === 'En panne' || m.etat === 'Détérioré').length;
  // Valeur globale = valeur_unitaire × quantite_total (pas la dispo)
  const valeurGlobale = materiels.reduce((s, m) => s + (m.valeur_unitaire * m.quantite_total), 0);
  const pretsActifs = prets.filter(p => p.statut === 'En cours').length;

  // ── Filtres ───────────────────────────────────────────────────────────────
  const filtered = materiels.filter(m => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || m.nom.toLowerCase().includes(q) || m.responsable.toLowerCase().includes(q) || m.lieu_stockage.toLowerCase().includes(q);
    const matchCat = filterCategorie === 'all' || m.categorie === filterCategorie;
    const matchEtat = filterEtat === 'all' || m.etat === filterEtat;
    return matchSearch && matchCat && matchEtat;
  });

  // ── Retour d'un prêt ──────────────────────────────────────────────────────
  const handleRetour = async (pret: MaterielPret) => {
    const mat = materiels.find(m => m.id === pret.materiel_id);
    if (!mat) return;

    await Promise.all([
      supabase.from('materiels_prets').update({
        statut: 'Retourné',
        date_retour_reel: new Date().toISOString().split('T')[0],
      }).eq('id', pret.id),
      supabase.from('materiels').update({
        quantite_disponible: Math.min(mat.quantite_total, mat.quantite_disponible + pret.quantite),
        updated_at: new Date().toISOString(),
      }).eq('id', mat.id),
    ]);

    // Si payant → marquer la recette comme encaissée
    if (pret.finance_id && pret.tarif_total > 0) {
      await supabase.from('finances').update({ statut: 'Encaissé' }).eq('id', pret.finance_id);
    }

    await load();
  };

  const handleDeletePret = async (id: string) => {
    if (!confirm('Supprimer cet enregistrement de prêt ?')) return;
    await supabase.from('materiels_prets').delete().eq('id', id);
    await load();
  };

  const handleDeleteMat = async (mat: Materiel) => {
    if (!confirm(`Supprimer "${mat.nom}" du registre ?`)) return;
    await supabase.from('materiels').delete().eq('id', mat.id);
    await load();
  };

  const handleEtatChange = async (mat: Materiel, newEtat: Materiel['etat']) => {
    await supabase.from('materiels').update({ etat: newEtat, updated_at: new Date().toISOString() }).eq('id', mat.id);
    setMateriels(prev => prev.map(m => m.id === mat.id ? { ...m, etat: newEtat } : m));
  };

  if (loading) return (
    <div className="flex items-center gap-2 p-8 text-slate-400 text-sm">
      <Loader2 className="h-5 w-5 animate-spin" />Chargement des matériels…
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center"><Package className="h-4 w-4 text-indigo-600" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
            <p className="text-lg font-black text-slate-900">{totalQty} <span className="text-xs font-normal text-slate-400">unités</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center"><CheckCircle className="h-4 w-4 text-emerald-600" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Disponibles</p>
            <p className="text-lg font-black text-emerald-700">{dispoQty} <span className="text-xs font-normal text-slate-400">en stock</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center"><Wrench className="h-4 w-4 text-amber-600" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Avaries</p>
            <p className="text-lg font-black text-amber-700">{enPanne} <span className="text-xs font-normal text-slate-400">articles</span></p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-lg flex items-center justify-center"><ArrowRightLeft className="h-4 w-4 text-violet-600" /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Prêts actifs</p>
            <p className="text-lg font-black text-violet-700">{pretsActifs} <span className="text-xs font-normal text-slate-400">en cours</span></p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-xl border border-slate-800 p-4 flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="w-9 h-9 bg-indigo-800/50 rounded-lg flex items-center justify-center"><Landmark className="h-4 w-4 text-indigo-300" /></div>
          <div>
            <p className="text-[10px] font-bold text-indigo-300 uppercase">Valeur globale</p>
            <p className="text-sm font-black text-white font-mono">{fmt(valeurGlobale)}</p>
            <p className="text-[10px] text-indigo-400">Ariary</p>
          </div>
        </div>
      </div>

      {/* ── Corps principal ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Table matériels */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          {/* En-tête */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Registre des équipements</h3>
            </div>
            <button onClick={() => { setEditingMat(undefined); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg">
              <Plus className="h-3.5 w-3.5" />Inscrire
            </button>
          </div>

          {/* Filtres */}
          <div className="p-3 border-b border-slate-100 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input type="text" placeholder="Rechercher…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg outline-none bg-slate-50" />
            </div>
            <select value={filterCategorie} onChange={e => setFilterCategorie(e.target.value)}
              className="text-xs border border-slate-200 bg-white rounded-lg px-2 py-1.5">
              <option value="all">Toutes catégories</option>
              {['Mobilier','Informatique','Logistique','Événementiel','Sécurité','Autre'].map(c =>
                <option key={c} value={c}>{c}</option>
              )}
            </select>
            <select value={filterEtat} onChange={e => setFilterEtat(e.target.value)}
              className="text-xs border border-slate-200 bg-white rounded-lg px-2 py-1.5">
              <option value="all">Tous états</option>
              {['Excellent','Bon','Moyen','Détérioré','En panne'].map(e =>
                <option key={e} value={e}>{e}</option>
              )}
            </select>
            {(searchQuery || filterCategorie !== 'all' || filterEtat !== 'all') && (
              <button onClick={() => { setSearchQuery(''); setFilterCategorie('all'); setFilterEtat('all'); }}
                className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">
                <RotateCcw className="h-3 w-3" />Réinitialiser
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase text-slate-400 font-mono">
                  <th className="p-3">Désignation</th>
                  <th className="p-3 text-center">Dispo / Total</th>
                  <th className="p-3">État</th>
                  <th className="p-3 text-right">Val. unitaire</th>
                  <th className="p-3 text-right">Val. globale</th>
                  <th className="p-3 text-right">Loyer/u/j</th>
                  <th className="p-3 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400 italic">Aucun matériel enregistré.</td></tr>
                ) : filtered.map(mat => (
                  <tr key={mat.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3">
                      <p className="font-semibold text-slate-900">{mat.nom}</p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" />{mat.lieu_stockage}
                      </p>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold">{mat.categorie}</span>
                    </td>
                    <td className="p-3 text-center font-mono">
                      <span className={`font-black ${mat.quantite_disponible === 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {mat.quantite_disponible}
                      </span>
                      <span className="text-slate-400"> / {mat.quantite_total}</span>
                    </td>
                    <td className="p-3">
                      <select value={mat.etat} onChange={e => handleEtatChange(mat, e.target.value as any)}
                        className={`text-[10px] font-bold px-2 py-1 rounded border ${etatColor(mat.etat)} cursor-pointer`}>
                        {['Excellent','Bon','Moyen','Détérioré','En panne'].map(e =>
                          <option key={e} value={e}>{e}</option>
                        )}
                      </select>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {fmt(mat.valeur_unitaire)} Ar
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-indigo-700">
                      {fmt(mat.valeur_unitaire * mat.quantite_total)} Ar
                    </td>
                    <td className="p-3 text-right font-mono">
                      {mat.prix_location > 0
                        ? <span className="text-amber-700 font-bold">{fmt(mat.prix_location)} Ar</span>
                        : <span className="text-slate-400 text-[10px]">Gratuit</span>
                      }
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setSelectedMat(mat); setShowPret(true); }}
                          disabled={mat.quantite_disponible <= 0}
                          title="Prêter"
                          className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100">
                          Prêter
                        </button>
                        <button onClick={() => { setEditingMat(mat); setShowForm(true); }}
                          title="Modifier" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDeleteMat(mat)}
                          title="Supprimer" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panneau prêts */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-violet-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">Prêts & Retours</h3>
            </div>
            <span className="text-[10px] font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">
              {pretsActifs} actif{pretsActifs > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {prets.length === 0 ? (
              <p className="text-center text-slate-400 text-xs italic py-10">Aucun prêt enregistré.</p>
            ) : prets.map(pret => {
              const mat = materiels.find(m => m.id === pret.materiel_id);
              const isActif = pret.statut === 'En cours';
              const retourDate = new Date(pret.date_retour_prevue);
              const estEnRetard = isActif && retourDate < new Date();

              return (
                <div key={pret.id} className={`p-3 text-xs space-y-1.5 ${!isActif ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800">{pret.emprunteur}</p>
                      <p className="text-[10px] text-slate-400">
                        {mat?.nom || '—'} × <strong>{pret.quantite}</strong>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                        !isActif ? 'bg-slate-100 text-slate-500' :
                        estEnRetard ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {!isActif ? 'Retourné' : estEnRetard ? 'En retard' : 'En cours'}
                      </span>
                      {pret.tarif_total > 0 && (
                        <span className="text-[10px] font-mono font-bold text-amber-700 flex items-center gap-0.5">
                          <DollarSign className="h-3 w-3" />{fmt(pret.tarif_total)} Ar
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-3 w-3" />
                      Retour prévu : {new Date(pret.date_retour_prevue).toLocaleDateString('fr-FR')}
                    </span>
                    {isActif ? (
                      <button onClick={() => handleRetour(pret)}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded transition">
                        ✓ Retour
                      </button>
                    ) : (
                      <button onClick={() => handleDeletePret(pret.id)}
                        className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {pret.notes && <p className="text-[10px] text-slate-400 italic">{pret.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <FormMateriel
          materiel={editingMat}
          onSave={() => { setShowForm(false); setEditingMat(undefined); load(); }}
          onClose={() => { setShowForm(false); setEditingMat(undefined); }}
        />
      )}

      {showPret && selectedMat && (
        <FormPret
          materiel={selectedMat}
          foyers={foyers}
          onSave={() => { setShowPret(false); setSelectedMat(null); load(); }}
          onClose={() => { setShowPret(false); setSelectedMat(null); }}
        />
      )}
    </div>
  );
}
