import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import ResidentCard from './components/ResidentCard';
import ResidentDetailModal from './components/ResidentDetailModal';
import ResidentForm from './components/ResidentForm';
import CertificateModal from './components/CertificateModal';
import DocumentGenerator from './components/DocumentGenerator';
import FinanceModule from './components/FinanceModule';
import MaterialsModule from './components/MaterialsModule';
import LandModule from './components/LandModule';
import StatsView from './components/StatsView';
import { Habitant, HistoriqueLog, Transaction, Materiel, CotisationAdidy } from './types';
import { FOKONTANY_LIST, SECTEUR_LIST, COMPULSORY_VACCINATIONS } from './seedData';
import {
  FolderLock, Users, HeartPulse, History, PlusCircle, Search,
  RotateCcw, Download, ShieldCheck, Building, SlidersHorizontal,
  Save, Trash2, FileSignature, Landmark, Package, Loader2
} from 'lucide-react';

export default function App() {
  const [habitants, setHabitants] = useState<Habitant[]>([]);
  const [logs, setLogs] = useState<HistoriqueLog[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [cotisations, setCotisations] = useState<CotisationAdidy[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'directory'|'documents'|'statistics'|'finances'|'materials'|'logs'|'land'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [sexeFilter, setSexeFilter] = useState('Tous');
  const [fokontanyFilter, setFokontanyFilter] = useState('Tous');
  const [householdFilter, setHouseholdFilter] = useState('');
  const [healthAlertFilter, setHealthAlertFilter] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minAge, setMinAge] = useState(0);
  const [maxAge, setMaxAge] = useState(100);
  const [educationFilter, setEducationFilter] = useState('Tous');
  const [sectorFilter, setSectorFilter] = useState('Tous');
  const [bloodFilter, setBloodFilter] = useState('Tous');
  const [hasCinFilter, setHasCinFilter] = useState('Tous');
  const [householdRoleFilter, setHouseholdRoleFilter] = useState('Tous');
  const [minIncome, setMinIncome] = useState(0);
  const [vaccineFilter, setVaccineFilter] = useState('Tous');
  const [savedPresets, setSavedPresets] = useState<{id:string;name:string;filters:any}[]>([]);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [activePresetId, setActivePresetId] = useState('');
  const [selectedResident, setSelectedResident] = useState<Habitant|null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formCurrentResident, setFormCurrentResident] = useState<Habitant|undefined>(undefined);
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);
  const [certificateResident, setCertificateResident] = useState<Habitant|null>(null);
  const [logSearchQuery, setLogSearchQuery] = useState('');

  // ── Convertir ligne DB → type Habitant ──────────────────────
  const rowToHabitant = (row: any): Habitant => ({
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    sexe: row.sexe,
    dateNaissance: row.date_naissance || '',
    lieuNaissance: row.lieu_naissance || '',
    cin: row.cin,
    dateCin: row.date_cin,
    telephone: row.telephone,
    email: row.email,
    statut: row.statut,
    photoUrl: row.photo_url,
    famille: {
      codeMenage: row.code_menage,
      isChefMenage: row.is_chef_menage,
      conjointId: row.conjoint_id,
      pereId: row.pere_id,
      mereId: row.mere_id,
      pereNom: row.pere_nom,
      mereNom: row.mere_nom,
      enfantsIds: [],
    },
    residence: {
      adresse: row.adresse || '',
      fokontany: row.fokontany || '',
      commune: row.commune || '',
      district: row.district || '',
      gps: row.gps_lat != null ? { lat: row.gps_lat, lng: row.gps_lng } : undefined,
      numLot: row.num_lot,
      carreau: row.carreau,
      numCarreau: row.num_carreau,
      photoMaisonUrl: row.photo_maison_url,
      nombrePieces: row.nombre_pieces,
      superficieMaison: row.superficie_maison,
    },
    education: {
      niveauEtude: row.niveau_etude || 'Secondaire',
      diplome: row.diplome,
      competences: row.competences || [],
      langues: row.langues || ['Malagasy'],
    },
    economie: {
      profession: row.profession || '',
      secteur: row.secteur || '',
      employeur: row.employeur,
      revenuEstime: row.revenu_estime,
    },
    sante: {
      groupeSanguin: row.groupe_sanguin,
      handicap: row.handicap,
      hypertension: row.hypertension || 'Normal',
      diabete: row.diabete || 'Normal',
      vaccination: row.vaccination || [],
      poids: row.poids,
      taille: row.taille,
    },
    vulnerabilite: {
      estVulnerable: row.est_vulnerable || false,
      categories: row.vulnerabilite_categories || [],
      description: row.vulnerabilite_description,
      niveauPriorite: row.niveau_priorite || 'Aucun',
      aidesObtenues: row.aides_obtenues || [],
    },
  });

  // ── Convertir Habitant → ligne DB ────────────────────────────
  const habitantToRow = (h: Habitant) => ({
    id: h.id,
    nom: h.nom,
    prenom: h.prenom,
    sexe: h.sexe,
    date_naissance: h.dateNaissance || null,
    lieu_naissance: h.lieuNaissance,
    cin: h.cin || null,
    date_cin: h.dateCin || null,
    telephone: h.telephone || null,
    email: h.email || null,
    statut: h.statut,
    photo_url: h.photoUrl || null,
    code_menage: h.famille.codeMenage,
    is_chef_menage: h.famille.isChefMenage,
    conjoint_id: h.famille.conjointId || null,
    pere_id: h.famille.pereId || null,
    mere_id: h.famille.mereId || null,
    pere_nom: h.famille.pereNom || null,
    mere_nom: h.famille.mereNom || null,
    adresse: h.residence.adresse,
    fokontany: h.residence.fokontany,
    commune: h.residence.commune,
    district: h.residence.district,
    gps_lat: h.residence.gps?.lat || null,
    gps_lng: h.residence.gps?.lng || null,
    num_lot: h.residence.numLot || null,
    carreau: h.residence.carreau || null,
    num_carreau: h.residence.numCarreau || null,
    photo_maison_url: h.residence.photoMaisonUrl || null,
    nombre_pieces: h.residence.nombrePieces || null,
    superficie_maison: h.residence.superficieMaison || null,
    niveau_etude: h.education.niveauEtude,
    diplome: h.education.diplome || null,
    competences: h.education.competences,
    langues: h.education.langues,
    profession: h.economie.profession,
    secteur: h.economie.secteur,
    employeur: h.economie.employeur || null,
    revenu_estime: h.economie.revenuEstime || null,
    groupe_sanguin: h.sante.groupeSanguin || null,
    handicap: h.sante.handicap || null,
    hypertension: h.sante.hypertension,
    diabete: h.sante.diabete,
    vaccination: h.sante.vaccination,
    poids: h.sante.poids || null,
    taille: h.sante.taille || null,
    est_vulnerable: h.vulnerabilite?.estVulnerable || false,
    vulnerabilite_categories: h.vulnerabilite?.categories || [],
    vulnerabilite_description: h.vulnerabilite?.description || null,
    niveau_priorite: h.vulnerabilite?.niveauPriorite || 'Aucun',
    aides_obtenues: h.vulnerabilite?.aidesObtenues || [],
    updated_at: new Date().toISOString(),
  });

  // ── Chargement initial depuis Supabase ───────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: rows } = await supabase.from('habitants').select('*').order('created_at', { ascending: false });
      const { data: logRows } = await supabase.from('logs').select('*').order('date', { ascending: false });

      // Reconstituer enfantsIds depuis les relations père/mère
      const rawHabitants: Habitant[] = (rows || []).map(rowToHabitant);
      const withChildren = rawHabitants.map(h => ({
        ...h,
        famille: {
          ...h.famille,
          enfantsIds: rawHabitants.filter(c => c.famille.pereId === h.id || c.famille.mereId === h.id).map(c => c.id),
        }
      }));

      setHabitants(withChildren);
      setLogs((logRows || []).map((r: any) => ({
        id: r.id, date: r.date, utilisateur: r.utilisateur,
        action: r.action, details: r.details, habitantId: r.habitant_id
      })));
      setLoading(false);
    }
    load();
  }, []);

  // ── Log ──────────────────────────────────────────────────────
  const addLog = async (action: HistoriqueLog['action'], details: string, habitantId?: string) => {
    const newLog = { id: `log-${Date.now()}`, date: new Date().toISOString(), utilisateur: 'Chef Fokontany (Admin)', action, details, habitant_id: habitantId || null };
    await supabase.from('logs').insert(newLog);
    setLogs(prev => [{ ...newLog, habitantId }, ...prev]);
  };

  // ── Filtres ──────────────────────────────────────────────────
  const calcAge = (d: string) => { const b = new Date(d); return Math.abs(new Date(Date.now() - b.getTime()).getUTCFullYear() - 1970); };
  const filteredHabitants = habitants.filter(r => {
    const q = searchQuery.toLowerCase();
    return (
      (r.nom.toLowerCase().includes(q) || r.prenom.toLowerCase().includes(q) || (r.cin||'').includes(q) || r.famille.codeMenage.toLowerCase().includes(q)) &&
      (statusFilter === 'Tous' || r.statut === statusFilter) &&
      (sexeFilter === 'Tous' || (sexeFilter === 'Homme' ? r.sexe === 'M' : r.sexe === 'F')) &&
      (fokontanyFilter === 'Tous' || r.residence.fokontany === fokontanyFilter) &&
      (!householdFilter.trim() || r.famille.codeMenage.toUpperCase().includes(householdFilter.toUpperCase())) &&
      (!healthAlertFilter || r.sante.hypertension !== 'Normal' || r.sante.diabete !== 'Normal') &&
      calcAge(r.dateNaissance) >= minAge && calcAge(r.dateNaissance) <= maxAge &&
      (educationFilter === 'Tous' || r.education.niveauEtude === educationFilter) &&
      (sectorFilter === 'Tous' || r.economie.secteur === sectorFilter) &&
      (bloodFilter === 'Tous' || r.sante.groupeSanguin === bloodFilter) &&
      (hasCinFilter === 'Tous' || (hasCinFilter === 'Oui' ? !!r.cin : !r.cin)) &&
      (householdRoleFilter === 'Tous' || (householdRoleFilter === 'Chef' ? r.famille.isChefMenage : !r.famille.isChefMenage)) &&
      (r.economie.revenuEstime || 0) >= minIncome &&
      (vaccineFilter === 'Tous' || r.sante.vaccination.includes(vaccineFilter))
    );
  });

  const resetFilters = () => { setSearchQuery(''); setStatusFilter('Tous'); setSexeFilter('Tous'); setFokontanyFilter('Tous'); setHouseholdFilter(''); setHealthAlertFilter(false); setMinAge(0); setMaxAge(100); setEducationFilter('Tous'); setSectorFilter('Tous'); setBloodFilter('Tous'); setHasCinFilter('Tous'); setHouseholdRoleFilter('Tous'); setMinIncome(0); setVaccineFilter('Tous'); setActivePresetId(''); };

  // ── CRUD Habitants ───────────────────────────────────────────
  const handleSaveResident = async (h: Habitant) => {
    const row = habitantToRow(h);
    const exists = habitants.some(x => x.id === h.id);
    if (exists) {
      await supabase.from('habitants').update(row).eq('id', h.id);
      const old = habitants.find(x => x.id === h.id);
      const action = old?.residence.adresse !== h.residence.adresse ? 'Changement adresse' : 'Modification';
      setHabitants(prev => prev.map(x => x.id === h.id ? h : x));
      await addLog(action, `Mise à jour : ${h.nom} ${h.prenom}`, h.id);
    } else {
      await supabase.from('habitants').insert(row);
      setHabitants(prev => [h, ...prev]);
      await addLog('Création', `Nouveau résident : ${h.nom} ${h.prenom} (${h.id})`, h.id);
    }
    setIsFormOpen(false);
    setFormCurrentResident(undefined);
    if (selectedResident?.id === h.id) setSelectedResident(h);
  };

  const handleQuickStatusChange = async (id: string, newStatus: Habitant['statut']) => {
    const r = habitants.find(h => h.id === id);
    if (!r) return;
    await supabase.from('habitants').update({ statut: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    const updated = habitants.map(h => h.id === id ? { ...h, statut: newStatus } : h);
    setHabitants(updated);
    const action: HistoriqueLog['action'] = newStatus === 'Décédé' ? 'Décès' : newStatus === 'Déménagé' ? 'Déménagement' : 'Modification';
    await addLog(action, `${r.nom} ${r.prenom} → ${newStatus}`, id);
    setSelectedResident(updated.find(h => h.id === id) || null);
  };

  const handleAddFamilyMember = (ref: Habitant) => {
    const freshId = `IND-${Math.floor(10000 + Math.random() * 90000)}`;
    const template: Habitant = {
      id: freshId, nom: ref.nom, prenom: '', sexe: 'M', dateNaissance: '',
      lieuNaissance: ref.residence.commune, statut: 'Actif',
      famille: { codeMenage: ref.famille.codeMenage, isChefMenage: false, conjointId: '', pereId: ref.sexe === 'M' ? ref.id : undefined, mereId: ref.sexe === 'F' ? ref.id : undefined, enfantsIds: [] },
      residence: { adresse: ref.residence.adresse, fokontany: ref.residence.fokontany, commune: ref.residence.commune, district: ref.residence.district },
      education: { niveauEtude: 'Secondaire', competences: [], langues: ['Malagasy'] },
      economie: { profession: '', secteur: 'Commerce & Artisanat' },
      sante: { hypertension: 'Normal', diabete: 'Normal', vaccination: [] },
    };
    setSelectedResident(null);
    setFormCurrentResident(template);
    setIsFormOpen(true);
  };

  const handleExportBackup = () => {
    const a = document.createElement('a');
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ habitants, logs }, null, 2));
    a.download = `registre_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    addLog('Modification', 'Export JSON.');
  };

  // ── Presets (localStorage OK pour les préférences UI) ────────
  const handleSavePreset = () => {
    if (!presetNameInput.trim()) return;
    const p = { id: `p-${Date.now()}`, name: presetNameInput, filters: { statusFilter, sexeFilter, fokontanyFilter, householdFilter, healthAlertFilter, minAge, maxAge, educationFilter, sectorFilter, bloodFilter, hasCinFilter, householdRoleFilter, minIncome, vaccineFilter } };
    const updated = [...savedPresets, p];
    setSavedPresets(updated);
    localStorage.setItem('fanisa_presets', JSON.stringify(updated));
    setPresetNameInput(''); setActivePresetId(p.id);
  };
  const handleApplyPreset = (id: string) => {
    const p = savedPresets.find(x => x.id === id); if (!p) return;
    setActivePresetId(id); setStatusFilter(p.filters.statusFilter); setSexeFilter(p.filters.sexeFilter); setFokontanyFilter(p.filters.fokontanyFilter); setHouseholdFilter(p.filters.householdFilter||''); setHealthAlertFilter(p.filters.healthAlertFilter||false); setMinAge(p.filters.minAge??0); setMaxAge(p.filters.maxAge??100); setEducationFilter(p.filters.educationFilter??'Tous'); setSectorFilter(p.filters.sectorFilter??'Tous'); setBloodFilter(p.filters.bloodFilter??'Tous'); setHasCinFilter(p.filters.hasCinFilter??'Tous'); setHouseholdRoleFilter(p.filters.householdRoleFilter??'Tous'); setMinIncome(p.filters.minIncome??0); setVaccineFilter(p.filters.vaccineFilter??'Tous'); setShowAdvancedFilters(true);
  };
  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated); localStorage.setItem('fanisa_presets', JSON.stringify(updated));
    if (activePresetId === id) setActivePresetId('');
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Chargement du registre…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 shadow-sm py-4 px-6 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="bg-emerald-600 p-2.5 rounded-xl text-white shrink-0 flex items-center justify-center relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600 rounded-l-xl"></div>
              <FolderLock className="h-6 w-6 ml-1" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5 font-bold tracking-widest uppercase">Fokontany local ledger</span>
                <span className="text-[9px] bg-emerald-50 text-emerald-800 border border-emerald-100 rounded px-1.5 py-0.5 font-semibold">Toamasina, MG</span>
              </div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase mt-0.5 flex items-center">
                Registre des Habitants <ShieldCheck className="h-4 w-4 text-indigo-600 ml-1.5" />
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-2.5">
            <button onClick={() => { setFormCurrentResident(undefined); setIsFormOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center space-x-1.5 transition">
              <PlusCircle className="h-4 w-4" /><span>Inscrire un Habitant</span>
            </button>
            <button onClick={handleExportBackup} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3.5 rounded-lg flex items-center space-x-1.5 transition">
              <Download className="h-4 w-4" /><span>Exporter</span>
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-6 py-1 overflow-x-auto">
        <nav className="max-w-7xl mx-auto flex space-x-6 min-w-max">
          {([['directory', Users, `Annuaire (${habitants.length})`], ['documents', FileSignature, "Actes & Docs"], ['statistics', HeartPulse, 'Statistiques'], ['finances', Landmark, 'Finances'], ['materials', Package, 'Matériels'], ['land', Building, 'Foncier'], ['logs', History, `Journal (${logs.length})`]] as const).map(([key, Icon, label]) => (
            <button key={key} onClick={() => setActiveTab(key as any)} className={`py-3.5 text-xs font-semibold border-b-2 transition flex items-center ${activeTab === key ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <Icon className="h-4 w-4 mr-2" />{label}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {activeTab === 'directory' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1"><Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" /><input type="text" placeholder="Nom, prénom, CIN, code ménage..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full text-xs pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg outline-none" /></div>
                <div className="relative w-full lg:w-48"><input type="text" placeholder="Code ménage..." value={householdFilter} onChange={e => setHouseholdFilter(e.target.value)} className="w-full text-xs pl-3 pr-8 py-3.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-mono uppercase" />{householdFilter && <button onClick={() => setHouseholdFilter('')} className="absolute right-2.5 top-3.5 text-slate-400 text-xs">×</button>}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div><span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Statut</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full border border-slate-200 bg-white rounded-lg p-2"><option value="Tous">Tous</option><option value="Actif">Actif</option><option value="Décédé">Décédé</option><option value="Déménagé">Déménagé</option></select></div>
                <div><span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Genre</span><select value={sexeFilter} onChange={e => setSexeFilter(e.target.value)} className="w-full border border-slate-200 bg-white rounded-lg p-2"><option value="Tous">Tous</option><option value="Homme">Hommes</option><option value="Femme">Femmes</option></select></div>
                <div><span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Fokontany</span><select value={fokontanyFilter} onChange={e => setFokontanyFilter(e.target.value)} className="w-full border border-slate-200 bg-white rounded-lg p-2"><option value="Tous">Tous</option>{FOKONTANY_LIST.map(f => <option key={f} value={f}>{f}</option>)}</select></div>
                <div className="flex items-end justify-between gap-2">
                  <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={healthAlertFilter} onChange={e => setHealthAlertFilter(e.target.checked)} className="rounded h-4 w-4" /><span className="text-xs font-semibold text-slate-700">Alerte santé</span></label>
                  <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${showAdvancedFilters ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200'}`}><SlidersHorizontal className="h-3.5 w-3.5" /><span>Avancé</span></button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <p className="text-slate-500"><strong className="text-indigo-600">{filteredHabitants.length}</strong> / <strong>{habitants.length}</strong> habitants</p>
                {(searchQuery || statusFilter !== 'Tous' || sexeFilter !== 'Tous' || fokontanyFilter !== 'Tous' || householdFilter) && <button onClick={resetFilters} className="text-indigo-600 font-semibold flex items-center gap-1 border border-indigo-100 rounded px-2 py-0.5"><RotateCcw className="h-3 w-3" />Réinitialiser</button>}
              </div>
            </div>

            {filteredHabitants.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredHabitants.map(r => <ResidentCard key={r.id} resident={r} onSelect={setSelectedResident} />)}
              </div>
            ) : (
              <div className="bg-white border rounded-xl py-16 text-center">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-800">Aucun habitant</p>
                <p className="text-xs text-slate-500 mt-1">Commencez par inscrire le premier habitant.</p>
                <button onClick={() => { setFormCurrentResident(undefined); setIsFormOpen(true); }} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2 mx-auto">
                  <PlusCircle className="h-4 w-4" />Inscrire un habitant
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && <DocumentGenerator habitants={habitants} onLoggedAction={(a,d) => addLog(a,d)} />}
        {activeTab === 'statistics' && <StatsView habitants={habitants} />}
        {activeTab === 'finances' && (
          <FinanceModule transactions={transactions} habitants={habitants} cotisations={cotisations}
            onAddTransaction={async (t) => { const tx = { id:`tx-${Date.now()}`, ...t }; setTransactions(p => [tx,...p]); addLog('Finance', `Transaction ${tx.type} - ${tx.montant.toLocaleString()} Ar`); }}
            onDeleteTransaction={async (id) => { setTransactions(p => p.filter(t => t.id !== id)); }}
            onAddCotisation={async (c) => { const cot = { id:`cot-${Date.now()}`, ...c }; setCotisations(p => [cot,...p]); addLog('Finance', `Cotisation Adidy - Foyer: ${cot.codeMenage}`); }}
            onDeleteCotisation={async (id) => { setCotisations(p => p.filter(c => c.id !== id)); }}
          />
        )}
        {activeTab === 'materials' && (
          <MaterialsModule materiels={materiels}
            onAddMateriel={async (m) => { const mat = { id:`mat-${Date.now()}`, ...m }; setMateriels(p => [...p, mat]); addLog('Matériel', `Ajout : ${mat.nom}`); }}
            onUpdateMateriel={async (m) => { setMateriels(p => p.map(x => x.id === m.id ? m : x)); addLog('Matériel', `Mise à jour : ${m.nom}`); }}
            onDeleteMateriel={async (id) => { const t = materiels.find(m => m.id === id); setMateriels(p => p.filter(m => m.id !== id)); if(t) addLog('Matériel', `Retrait : ${t.nom}`); }}
          />
        )}
        {activeTab === 'land' && <LandModule allResidents={habitants} onAddLog={addLog} />}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4"><div className="relative"><Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" /><input type="text" placeholder="Rechercher dans le journal..." value={logSearchQuery} onChange={e => setLogSearchQuery(e.target.value)} className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none" /></div></div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead><tr className="bg-slate-50 border-b text-slate-500"><th className="p-3.5 font-mono text-[10px] uppercase">Date</th><th className="p-3.5 font-mono text-[10px] uppercase">Opérateur</th><th className="p-3.5 font-mono text-[10px] uppercase">Action</th><th className="p-3.5 font-mono text-[10px] uppercase">Détails</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.filter(l => { const q = logSearchQuery.toLowerCase(); return l.action.toLowerCase().includes(q) || l.details.toLowerCase().includes(q); }).map(l => (
                    <tr key={l.id} className="hover:bg-slate-50"><td className="p-3.5 text-slate-500 whitespace-nowrap font-mono">{new Date(l.date).toLocaleString('fr-FR')}</td><td className="p-3.5 font-semibold">{l.utilisateur}</td><td className="p-3.5"><span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-[10px] rounded font-semibold">{l.action}</span></td><td className="p-3.5 text-slate-600">{l.details}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        <p className="font-semibold text-slate-500">REPUBLIQUE DE MADAGASCAR</p>
        <p className="mt-1 font-mono text-[10px]">Registre numérique du Fokontany • Version 2.0.0</p>
      </footer>

      {selectedResident && <ResidentDetailModal resident={selectedResident} allResidents={habitants} onClose={() => setSelectedResident(null)} onEdit={(r) => { setFormCurrentResident(r); setIsFormOpen(true); }} onGenerateCertificate={(r) => { setCertificateResident(r); setIsCertificateOpen(true); }} onNavigateToResident={setSelectedResident} onQuickStatusChange={handleQuickStatusChange} onAddFamilyMember={handleAddFamilyMember} logs={logs} />}
      {isFormOpen && <ResidentForm resident={formCurrentResident} allResidents={habitants} onClose={() => { setIsFormOpen(false); setFormCurrentResident(undefined); }} onSave={handleSaveResident} />}
      {isCertificateOpen && certificateResident && <CertificateModal resident={certificateResident} onClose={() => { setIsCertificateOpen(false); setCertificateResident(null); }} onLoggedAction={(a,m) => addLog(a,m)} onAddTransaction={async (t) => { setTransactions(p => [{ id:`tx-${Date.now()}`, ...t }, ...p]); }} />}
    </div>
  );
}
