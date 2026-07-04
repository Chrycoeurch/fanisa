import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import {
  Search, Filter, Plus, X, Play, Save, Trash2, Download, ChevronDown,
  ChevronUp, Users, Home, FileText, BarChart2, Loader2, Star, StarOff,
  RefreshCw, AlertCircle, CheckCircle, Eye, ArrowUpDown, BookOpen
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

// ── Types ─────────────────────────────────────────────────────────
type Operateur = 'egal' | 'different' | 'superieur' | 'inferieur' | 'contient' | 'commence_par' | 'se_termine_par' | 'est_vide' | 'nest_pas_vide' | 'entre';
type TypeChamp = 'texte' | 'nombre' | 'date' | 'booleen' | 'enum';
type LogiqueGroupe = 'ET' | 'OU';

interface ChampDef {
  id: string;
  label: string;
  categorie: string;
  type: TypeChamp;
  source: 'foyers' | 'membres' | 'cotisations' | 'demandes_documents' | 'transactions_caisse';
  champ: string;
  enumValues?: string[];
}

interface Filtre {
  id: string;
  champ_id: string;
  operateur: Operateur;
  valeur: string;
  valeur2?: string; // pour "entre"
  logique: LogiqueGroupe; // connexion avec le filtre suivant
}

interface Recherche {
  id: string;
  nom: string;
  description?: string;
  filtres: Filtre[];
  created_at: string;
}

interface ResultatLigne {
  type: 'foyer' | 'membre';
  foyer_id: string;
  membre_id?: string;
  nom: string;
  code_menage: string;
  fokontany?: string;
  adresse?: string;
  nb_membres?: number;
  statut?: string;
  profession?: string;
  age?: number;
  sexe?: string;
  vulnerabilite?: boolean;
  cotisation_statut?: string;
}

// ── Définition des champs disponibles ────────────────────────────
const CHAMPS: ChampDef[] = [
  // Ménages
  { id: 'foyer_code',        label: 'Code ménage',           categorie: 'Ménages', type: 'texte',   source: 'foyers',   champ: 'code_menage' },
  { id: 'foyer_adresse',     label: 'Adresse',               categorie: 'Ménages', type: 'texte',   source: 'foyers',   champ: 'adresse' },
  { id: 'foyer_fokontany',   label: 'Fokontany',             categorie: 'Ménages', type: 'texte',   source: 'foyers',   champ: 'fokontany' },
  { id: 'foyer_commune',     label: 'Commune',               categorie: 'Ménages', type: 'texte',   source: 'foyers',   champ: 'commune' },
  { id: 'foyer_district',    label: 'District',              categorie: 'Ménages', type: 'texte',   source: 'foyers',   champ: 'district' },
  { id: 'foyer_nb_membres',  label: 'Nombre de membres',     categorie: 'Ménages', type: 'nombre',  source: 'foyers',   champ: 'nombre_membres' },
  { id: 'foyer_statut',      label: 'Statut ménage',         categorie: 'Ménages', type: 'enum',    source: 'foyers',   champ: 'statut', enumValues: ['Actif', 'Inactif', 'Dissous'] },
  { id: 'foyer_type_log',    label: 'Type de logement',      categorie: 'Ménages', type: 'texte',   source: 'foyers',   champ: 'type_logement' },
  { id: 'foyer_installation', label: 'Année installation',   categorie: 'Ménages', type: 'nombre',  source: 'foyers',   champ: 'annee_installation' },
  { id: 'foyer_eau',         label: 'Source d\'eau',         categorie: 'Ménages', type: 'texte',   source: 'foyers',   champ: 'eau_source' },
  { id: 'foyer_electricite', label: 'Électricité',           categorie: 'Ménages', type: 'booleen', source: 'foyers',   champ: 'a_electricite' },
  // Membres
  { id: 'membre_nom',        label: 'Nom',                   categorie: 'Membres', type: 'texte',   source: 'membres',  champ: 'nom' },
  { id: 'membre_prenom',     label: 'Prénom',                categorie: 'Membres', type: 'texte',   source: 'membres',  champ: 'prenom' },
  { id: 'membre_cin',        label: 'CIN',                   categorie: 'Membres', type: 'texte',   source: 'membres',  champ: 'cin' },
  { id: 'membre_telephone',  label: 'Téléphone',             categorie: 'Membres', type: 'texte',   source: 'membres',  champ: 'telephone' },
  { id: 'membre_sexe',       label: 'Sexe',                  categorie: 'Membres', type: 'enum',    source: 'membres',  champ: 'sexe', enumValues: ['M', 'F'] },
  { id: 'membre_statut',     label: 'Statut membre',         categorie: 'Membres', type: 'enum',    source: 'membres',  champ: 'statut', enumValues: ['Actif', 'Inactif', 'Décédé', 'Parti'] },
  { id: 'membre_profession', label: 'Profession',            categorie: 'Membres', type: 'texte',   source: 'membres',  champ: 'profession' },
  { id: 'membre_niveau',     label: 'Niveau d\'étude',       categorie: 'Membres', type: 'enum',    source: 'membres',  champ: 'niveau_etude', enumValues: ['Aucun','Primaire','Secondaire','Collège','Lycée','Universitaire','Formation professionnelle'] },
  { id: 'membre_sit_mat',    label: 'Situation matrimoniale',categorie: 'Membres', type: 'texte',   source: 'membres',  champ: 'situation_matrimoniale' },
  { id: 'membre_religion',   label: 'Religion',              categorie: 'Membres', type: 'texte',   source: 'membres',  champ: 'religion' },
  { id: 'membre_vulnerable', label: 'Est vulnérable',        categorie: 'Membres', type: 'booleen', source: 'membres',  champ: 'est_vulnerable' },
  { id: 'membre_is_chef',    label: 'Est chef de ménage',    categorie: 'Membres', type: 'booleen', source: 'membres',  champ: 'is_chef' },
  { id: 'membre_handicap',   label: 'Handicap',              categorie: 'Santé',   type: 'booleen', source: 'membres',  champ: 'handicap_oui' },
  { id: 'membre_grossesse',  label: 'Grossesse en cours',    categorie: 'Santé',   type: 'booleen', source: 'membres',  champ: 'grossesse_cours' },
  { id: 'membre_suivi',      label: 'Suivi médical',         categorie: 'Santé',   type: 'booleen', source: 'membres',  champ: 'suivi_medical' },
  { id: 'membre_revenu',     label: 'Revenu estimé (Ar)',    categorie: 'Économie',type: 'nombre',  source: 'membres',  champ: 'revenu_estime' },
  { id: 'membre_emploi',     label: 'Situation d\'emploi',   categorie: 'Économie',type: 'texte',   source: 'membres',  champ: 'situation_emploi' },
  // Cotisations
  { id: 'cot_statut',        label: 'Statut cotisation',     categorie: 'Cotisations', type: 'enum', source: 'cotisations', champ: 'statut', enumValues: ['À jour', 'En attente de paiement', 'En retard'] },
  { id: 'cot_montant',       label: 'Montant payé (Ar)',     categorie: 'Cotisations', type: 'nombre', source: 'cotisations', champ: 'montant_paye' },
  { id: 'cot_periode',       label: 'Période',               categorie: 'Cotisations', type: 'texte',  source: 'cotisations', champ: 'periode' },
  // Documents
  { id: 'doc_type',          label: 'Type de document',      categorie: 'Documents', type: 'texte',   source: 'demandes_documents', champ: 'code_document' },
  { id: 'doc_statut',        label: 'Statut document',       categorie: 'Documents', type: 'enum',    source: 'demandes_documents', champ: 'statut', enumValues: ['En attente de paiement','Payé','Archivé'] },
];

const CATEGORIES = [...new Set(CHAMPS.map(c => c.categorie))];

const OPERATEURS: { value: Operateur; label: string; types: TypeChamp[] }[] = [
  { value: 'egal',           label: 'égal à',           types: ['texte','nombre','date','enum','booleen'] },
  { value: 'different',      label: 'différent de',     types: ['texte','nombre','date','enum','booleen'] },
  { value: 'contient',       label: 'contient',         types: ['texte'] },
  { value: 'commence_par',   label: 'commence par',     types: ['texte'] },
  { value: 'se_termine_par', label: 'se termine par',   types: ['texte'] },
  { value: 'superieur',      label: 'supérieur à',      types: ['nombre','date'] },
  { value: 'inferieur',      label: 'inférieur à',      types: ['nombre','date'] },
  { value: 'entre',          label: 'entre',            types: ['nombre','date'] },
  { value: 'est_vide',       label: 'est vide',         types: ['texte','nombre','date','enum'] },
  { value: 'nest_pas_vide',  label: "n'est pas vide",   types: ['texte','nombre','date','enum'] },
];

const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
const genId = () => Math.random().toString(36).slice(2, 9);

// ── Ligne de filtre ───────────────────────────────────────────────
function LigneFiltre({ filtre, index, total, onChange, onRemove }: {
  filtre: Filtre; index: number; total: number;
  onChange: (f: Filtre) => void; onRemove: () => void;
}) {
  const champ = CHAMPS.find(c => c.id === filtre.champ_id);
  const ops = champ ? OPERATEURS.filter(o => o.types.includes(champ.type)) : OPERATEURS;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Logique ET/OU (sauf premier) */}
      {index > 0 && (
        <select value={filtre.logique} onChange={e => onChange({ ...filtre, logique: e.target.value as LogiqueGroupe })}
          className="border border-indigo-300 bg-indigo-50 rounded-lg px-2 py-1.5 text-xs font-bold text-indigo-700 outline-none w-16">
          <option value="ET">ET</option>
          <option value="OU">OU</option>
        </select>
      )}

      {/* Sélecteur de champ */}
      <select value={filtre.champ_id} onChange={e => onChange({ ...filtre, champ_id: e.target.value, operateur: 'egal', valeur: '' })}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:border-indigo-400 min-w-40">
        <option value="">-- Choisir un champ --</option>
        {CATEGORIES.map(cat => (
          <optgroup key={cat} label={cat}>
            {CHAMPS.filter(c => c.categorie === cat).map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Opérateur */}
      {filtre.champ_id && (
        <select value={filtre.operateur} onChange={e => onChange({ ...filtre, operateur: e.target.value as Operateur })}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:border-indigo-400 min-w-32">
          {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      {/* Valeur */}
      {filtre.champ_id && filtre.operateur !== 'est_vide' && filtre.operateur !== 'nest_pas_vide' && (
        <>
          {champ?.type === 'enum' && champ.enumValues ? (
            <select value={filtre.valeur} onChange={e => onChange({ ...filtre, valeur: e.target.value })}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:border-indigo-400">
              <option value="">-- Choisir --</option>
              {champ.enumValues.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          ) : champ?.type === 'booleen' ? (
            <select value={filtre.valeur} onChange={e => onChange({ ...filtre, valeur: e.target.value })}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:border-indigo-400">
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          ) : champ?.type === 'date' ? (
            <input type="date" value={filtre.valeur} onChange={e => onChange({ ...filtre, valeur: e.target.value })}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400" />
          ) : (
            <input value={filtre.valeur} onChange={e => onChange({ ...filtre, valeur: e.target.value })}
              placeholder="Valeur..." className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 min-w-28" />
          )}
          {filtre.operateur === 'entre' && (
            <>
              <span className="text-xs text-slate-400">et</span>
              {champ?.type === 'date' ? (
                <input type="date" value={filtre.valeur2 || ''} onChange={e => onChange({ ...filtre, valeur2: e.target.value })}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400" />
              ) : (
                <input value={filtre.valeur2 || ''} onChange={e => onChange({ ...filtre, valeur2: e.target.value })}
                  placeholder="Valeur max..." className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 min-w-24" />
              )}
            </>
          )}
        </>
      )}

      {/* Supprimer */}
      <button onClick={onRemove} className="p-1 text-slate-300 hover:text-red-500 transition">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Module principal ──────────────────────────────────────────────
export default function CRAADModule({ foyers, membres }: Props) {
  const [recherche, setRecherche] = useState('');
  const [filtres, setFiltres] = useState<Filtre[]>([]);
  const [resultats, setResultats] = useState<ResultatLigne[]>([]);
  const [loading, setLoading] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [sortCol, setSortCol] = useState<keyof ResultatLigne>('nom');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc');
  const [page, setPage] = useState(1);
  const [savedSearches, setSavedSearches] = useState<Recherche[]>([]);
  const [savingName, setSavingName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const PAGE = 15;

  // Chargement des recherches sauvegardées
  const loadSaved = useCallback(async () => {
    const { data } = await supabase.from('craad_recherches').select('*').order('created_at', { ascending: false });
    setSavedSearches((data || []) as Recherche[]);
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  // Suggestions en temps réel
  useEffect(() => {
    if (recherche.length < 2) { setSuggestions([]); return; }
    const q = recherche.toLowerCase();
    const sugs = new Set<string>();
    membres.filter(m => `${m.nom} ${m.prenom}`.toLowerCase().includes(q)).slice(0, 4).forEach(m => sugs.add(`${m.nom} ${m.prenom}`));
    membres.filter(m => m.cin?.toLowerCase().includes(q)).slice(0, 2).forEach(m => sugs.add(m.cin!));
    membres.filter(m => m.telephone?.includes(q)).slice(0, 2).forEach(m => sugs.add(m.telephone!));
    foyers.filter(f => f.code_menage.toLowerCase().includes(q)).slice(0, 3).forEach(f => sugs.add(f.code_menage));
    foyers.filter(f => f.adresse?.toLowerCase().includes(q)).slice(0, 2).forEach(f => sugs.add(f.adresse!));
    setSuggestions([...sugs].slice(0, 8));
    setShowSuggestions(true);
  }, [recherche, membres, foyers]);

  // ── Exécution de la recherche ─────────────────────────────────
  const executer = useCallback(async () => {
    setLoading(true);
    setPage(1);
    try {
      const res: ResultatLigne[] = [];
      const q = recherche.toLowerCase().trim();

      // Pour chaque foyer, on vérifie les filtres
      for (const foyer of foyers) {
        const membresFoyer = membres.filter(m => m.foyer_id === foyer.id);
        const chef = membresFoyer.find(m => m.is_chef);

        // Filtres côté foyer
        let foyerMatch = true;
        const filtresFoyer = filtres.filter(f => {
          const champ = CHAMPS.find(c => c.id === f.champ_id);
          return champ?.source === 'foyers';
        });

        if (filtresFoyer.length > 0) {
          foyerMatch = appliquerFiltres(foyer as any, filtresFoyer);
        }

        // Filtres côté membres — check si au moins un membre du foyer match
        const filtresMembres = filtres.filter(f => {
          const champ = CHAMPS.find(c => c.id === f.champ_id);
          return champ?.source === 'membres';
        });

        // Filtres cotisations — via Supabase direct pour éviter de charger tout en mémoire
        let cotMatch = true;
        const filtresCot = filtres.filter(f => { const c = CHAMPS.find(x => x.id === f.champ_id); return c?.source === 'cotisations'; });
        if (filtresCot.length > 0) {
          const { data: cots } = await supabase.from('cotisations').select('*').eq('foyer_id', foyer.id);
          cotMatch = (cots || []).some(c => appliquerFiltres(c as any, filtresCot));
        }

        // Filtres documents
        let docMatch = true;
        const filtresDocs = filtres.filter(f => { const c = CHAMPS.find(x => x.id === f.champ_id); return c?.source === 'demandes_documents'; });
        if (filtresDocs.length > 0) {
          const { data: ddocs } = await supabase.from('demandes_documents').select('*').eq('foyer_id', foyer.id);
          docMatch = (ddocs || []).some(d => appliquerFiltres(d as any, filtresDocs));
        }

        // Recherche textuelle globale
        let textMatch = true;
        if (q) {
          const inFoyer = foyer.code_menage.toLowerCase().includes(q) ||
            (foyer.adresse || '').toLowerCase().includes(q) ||
            (foyer.fokontany || '').toLowerCase().includes(q);
          const inMembres = membresFoyer.some(m =>
            `${m.nom} ${m.prenom}`.toLowerCase().includes(q) ||
            (m.cin || '').toLowerCase().includes(q) ||
            (m.telephone || '').includes(q)
          );
          textMatch = inFoyer || inMembres;
        }

        if (!foyerMatch || !cotMatch || !docMatch || !textMatch) continue;

        // Pour les filtres membres : créer une ligne par membre qui matche, ou une ligne par foyer si pas de filtre membre
        if (filtresMembres.length > 0) {
          const membresMatch = membresFoyer.filter(m => appliquerFiltres(m as any, filtresMembres));
          if (membresMatch.length === 0) continue;
          membresMatch.forEach(m => {
            const dn = m.date_naissance ? new Date().getFullYear() - new Date(m.date_naissance).getFullYear() : undefined;
            res.push({
              type: 'membre', foyer_id: foyer.id, membre_id: m.id,
              nom: `${m.nom} ${m.prenom}`, code_menage: foyer.code_menage,
              fokontany: foyer.fokontany, adresse: foyer.adresse,
              statut: m.statut, profession: m.profession, age: dn, sexe: m.sexe,
              vulnerabilite: m.est_vulnerable, nb_membres: membresFoyer.length,
            });
          });
        } else {
          res.push({
            type: 'foyer', foyer_id: foyer.id,
            nom: chef ? `${chef.nom} ${chef.prenom}` : foyer.code_menage,
            code_menage: foyer.code_menage, fokontany: foyer.fokontany, adresse: foyer.adresse,
            nb_membres: membresFoyer.length,
            statut: foyer.statut,
            vulnerabilite: membresFoyer.some(m => m.est_vulnerable),
          });
        }
      }

      setResultats(res);
    } catch (e) { console.error(e); }
    setLoading(false);
    setExecuted(true);
  }, [filtres, recherche, foyers, membres]);

  // Appliquer un groupe de filtres sur un objet
  function appliquerFiltres(obj: Record<string, any>, filtresGroupe: Filtre[]): boolean {
    if (filtresGroupe.length === 0) return true;
    let result = testerFiltre(obj, filtresGroupe[0]);
    for (let i = 1; i < filtresGroupe.length; i++) {
      const f = filtresGroupe[i];
      const test = testerFiltre(obj, f);
      if (f.logique === 'OU') result = result || test;
      else result = result && test;
    }
    return result;
  }

  function testerFiltre(obj: Record<string, any>, f: Filtre): boolean {
    const champ = CHAMPS.find(c => c.id === f.champ_id);
    if (!champ) return true;
    const val = obj[champ.champ];
    const cible = f.valeur;

    switch (f.operateur) {
      case 'egal':          return String(val || '') === cible;
      case 'different':     return String(val || '') !== cible;
      case 'contient':      return String(val || '').toLowerCase().includes(cible.toLowerCase());
      case 'commence_par':  return String(val || '').toLowerCase().startsWith(cible.toLowerCase());
      case 'se_termine_par':return String(val || '').toLowerCase().endsWith(cible.toLowerCase());
      case 'superieur':     return Number(val) > Number(cible);
      case 'inferieur':     return Number(val) < Number(cible);
      case 'est_vide':      return !val || val === '' || val === null;
      case 'nest_pas_vide': return !!val && val !== '' && val !== null;
      case 'entre':         return Number(val) >= Number(cible) && Number(val) <= Number(f.valeur2 || cible);
      default:              return true;
    }
  }

  // ── Tri et pagination ─────────────────────────────────────────
  const sorted = [...resultats].sort((a, b) => {
    const av = String(a[sortCol] || ''), bv = String(b[sortCol] || '');
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const page_data = sorted.slice((page - 1) * PAGE, page * PAGE);

  const sort = (col: keyof ResultatLigne) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  // ── Statistiques ──────────────────────────────────────────────
  const foyerIds = [...new Set(resultats.map(r => r.foyer_id))];
  const membresDansResultats = membres.filter(m => foyerIds.includes(m.foyer_id));
  const stats = {
    menages: foyerIds.length,
    population: membresDansResultats.length,
    hommes: membresDansResultats.filter(m => m.sexe === 'M').length,
    femmes: membresDansResultats.filter(m => m.sexe === 'F').length,
    enfants: membresDansResultats.filter(m => m.date_naissance && new Date().getFullYear() - new Date(m.date_naissance).getFullYear() < 18).length,
    ages: membresDansResultats.filter(m => m.date_naissance && new Date().getFullYear() - new Date(m.date_naissance).getFullYear() >= 60).length,
    vulnerables: membresDansResultats.filter(m => m.est_vulnerable).length,
  };

  // ── Sauvegarde ────────────────────────────────────────────────
  const sauvegarder = async () => {
    if (!savingName.trim()) return;
    await supabase.from('craad_recherches').insert({
      nom: savingName.trim(), filtres: JSON.stringify(filtres),
    });
    setSavingName(''); setShowSaveForm(false);
    loadSaved();
  };

  const chargerRecherche = (r: Recherche) => {
    setFiltres(typeof r.filtres === 'string' ? JSON.parse(r.filtres) : r.filtres);
    setShowSaved(false);
  };

  const supprimerRecherche = async (id: string) => {
    await supabase.from('craad_recherches').delete().eq('id', id);
    loadSaved();
  };

  // ── Export CSV ────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Code ménage', 'Nom', 'Type', 'Fokontany', 'Adresse', 'Nb membres', 'Statut', 'Profession', 'Âge', 'Sexe', 'Vulnérable'];
    const rows = sorted.map(r => [r.code_menage, r.nom, r.type === 'foyer' ? 'Ménage' : 'Membre', r.fokontany || '', r.adresse || '', r.nb_membres || '', r.statut || '', r.profession || '', r.age || '', r.sexe || '', r.vulnerabilite ? 'Oui' : 'Non']);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `CRAAD_export_${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const addFiltre = () => setFiltres(f => [...f, { id: genId(), champ_id: '', operateur: 'egal', valeur: '', logique: 'ET' }]);
  const updateFiltre = (id: string, updated: Filtre) => setFiltres(f => f.map(x => x.id === id ? updated : x));
  const removeFiltre = (id: string) => setFiltres(f => f.filter(x => x.id !== id));

  return (
    <div className="space-y-4">
      {/* ── En-tête ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl"><BarChart2 className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">CRAAD</h2>
              <p className="text-xs text-slate-500">Centre de Recherche, d'Analyse & d'Aide à la Décision</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSaved(!showSaved)} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <BookOpen className="h-3.5 w-3.5" />Recherches sauvegardées ({savedSearches.length})
            </button>
            {executed && resultats.length > 0 && (
              <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 border border-emerald-300 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-50">
                <Download className="h-3.5 w-3.5" />Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Recherches sauvegardées */}
        {showSaved && (
          <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Recherches sauvegardées</h3>
            {savedSearches.length === 0 ? (
              <p className="text-xs text-slate-400">Aucune recherche sauvegardée.</p>
            ) : savedSearches.map(r => (
              <div key={r.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
                <button onClick={() => chargerRecherche(r)} className="text-sm font-semibold text-indigo-600 hover:underline flex-1 text-left">{r.nom}</button>
                <button onClick={() => supprimerRecherche(r.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Barre de recherche universelle */}
        <div className="relative mb-4">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            value={recherche}
            onChange={e => { setRecherche(e.target.value); setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={e => { if (e.key === 'Enter') { setShowSuggestions(false); executer(); } }}
            placeholder="Recherche universelle : nom, CIN, téléphone, adresse, code ménage, référence..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button key={i} onMouseDown={() => { setRecherche(s); setShowSuggestions(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 border-b border-slate-50 text-sm text-slate-700">
                  <Search className="h-3 w-3 inline mr-2 text-slate-400" />{s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Constructeur de filtres */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Filter className="h-3.5 w-3.5" />Filtres avancés</h3>
            <button onClick={addFiltre} className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline">
              <Plus className="h-3.5 w-3.5" />Ajouter un filtre
            </button>
          </div>
          {filtres.length === 0 && (
            <p className="text-xs text-slate-400 py-2 text-center">Aucun filtre — la recherche retournera tous les résultats correspondant au texte saisi ci-dessus.</p>
          )}
          {filtres.map((f, i) => (
            <div key={f.id} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <LigneFiltre filtre={f} index={i} total={filtres.length} onChange={u => updateFiltre(f.id, u)} onRemove={() => removeFiltre(f.id)} />
            </div>
          ))}
          {filtres.length > 0 && (
            <button onClick={() => setFiltres([])} className="text-xs text-red-400 hover:text-red-600 font-semibold flex items-center gap-1 mt-1">
              <X className="h-3 w-3" />Effacer tous les filtres
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowSuggestions(false); executer(); }} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl transition">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {loading ? 'Recherche…' : 'Lancer la recherche'}
          </button>
          {executed && (
            <button onClick={() => { setRecherche(''); setFiltres([]); setResultats([]); setExecuted(false); }}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <RefreshCw className="h-3.5 w-3.5" />Réinitialiser
            </button>
          )}
          {executed && (filtres.length > 0 || recherche) && (
            <button onClick={() => setShowSaveForm(!showSaveForm)}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-amber-300 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50">
              <Save className="h-3.5 w-3.5" />Sauvegarder cette recherche
            </button>
          )}
        </div>

        {/* Formulaire sauvegarde */}
        {showSaveForm && (
          <div className="mt-3 flex gap-2 items-center">
            <input value={savingName} onChange={e => setSavingName(e.target.value)} placeholder="Nom de la recherche…"
              className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500" />
            <button onClick={sauvegarder} disabled={!savingName.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg disabled:bg-slate-200 transition">
              <Save className="h-4 w-4" />
            </button>
            <button onClick={() => setShowSaveForm(false)} className="p-2 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {/* ── Statistiques ── */}
      {executed && resultats.length > 0 && (
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {[
            ['Ménages', stats.menages, 'bg-indigo-50 border-indigo-200 text-indigo-700'],
            ['Population', stats.population, 'bg-slate-50 border-slate-200 text-slate-700'],
            ['Hommes', stats.hommes, 'bg-blue-50 border-blue-200 text-blue-700'],
            ['Femmes', stats.femmes, 'bg-pink-50 border-pink-200 text-pink-700'],
            ['Enfants', stats.enfants, 'bg-orange-50 border-orange-200 text-orange-700'],
            ['Personnes âgées', stats.ages, 'bg-purple-50 border-purple-200 text-purple-700'],
            ['Vulnérables', stats.vulnerables, 'bg-red-50 border-red-200 text-red-600'],
          ].map(([label, val, cls]) => (
            <div key={label as string} className={`rounded-xl border p-3 text-center ${cls}`}>
              <p className="text-xl font-black">{val as number}</p>
              <p className="text-[11px] font-semibold mt-0.5 opacity-80">{label as string}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Résultats ── */}
      {executed && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              {resultats.length === 0 ? 'Aucun résultat' : `${resultats.length} résultat${resultats.length > 1 ? 's' : ''}`}
            </h3>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="px-2 py-1 border rounded disabled:opacity-40">‹</button>
                Page {page} / {totalPages}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="px-2 py-1 border rounded disabled:opacity-40">›</button>
              </div>
            )}
          </div>

          {resultats.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Aucun résultat pour ces critères</p>
              <p className="text-xs mt-1">Essayez d'assouplir vos filtres ou d'utiliser des opérateurs OU</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50 border-b">
                  {[['code_menage','Code ménage'],['nom','Nom'],['type','Type'],['fokontany','Fokontany'],['adresse','Adresse'],['nb_membres','Membres'],['statut','Statut'],['profession','Profession'],['age','Âge'],['sexe','Sexe'],['vulnerabilite','Vulnérable']].map(([col, label]) => (
                    <th key={col} onClick={() => sort(col as keyof ResultatLigne)} className="p-3 text-left text-slate-500 cursor-pointer hover:text-slate-800 whitespace-nowrap">
                      <span className="flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                    </th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {page_data.map((r, i) => (
                    <tr key={i} className="hover:bg-indigo-50/30 transition">
                      <td className="p-3 font-mono font-bold text-indigo-600">{r.code_menage}</td>
                      <td className="p-3 font-semibold text-slate-800">{r.nom}</td>
                      <td className="p-3">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${r.type==='foyer'?'bg-indigo-100 text-indigo-700':'bg-emerald-100 text-emerald-700'}`}>
                          {r.type==='foyer'?'Ménage':'Membre'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{r.fokontany || '—'}</td>
                      <td className="p-3 text-slate-500 max-w-32 truncate">{r.adresse || '—'}</td>
                      <td className="p-3 text-center text-slate-700 font-semibold">{r.nb_membres || '—'}</td>
                      <td className="p-3">
                        {r.statut && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${r.statut==='Actif'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{r.statut}</span>}
                      </td>
                      <td className="p-3 text-slate-600">{r.profession || '—'}</td>
                      <td className="p-3 text-center text-slate-600">{r.age || '—'}</td>
                      <td className="p-3 text-center text-slate-600">{r.sexe || '—'}</td>
                      <td className="p-3 text-center">
                        {r.vulnerabilite && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">⚠ Oui</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
