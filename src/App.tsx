import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Foyer, Membre, Log } from './types';
import { Habitant, HistoriqueLog, Transaction, Materiel, CotisationAdidy } from './types';
import FoyerCard from './components/FoyerCard';
import FoyerForm from './components/FoyerForm';
import FoyerDetail from './components/FoyerDetail';
import MembreForm from './components/MembreForm';
import DocumentGenerator from './components/DocumentGenerator';
import FinanceModule from './components/FinanceModule';
import MaterialsModule from './components/MaterialsModule';
import LandModule from './components/LandModule';
import StatsView from './components/StatsView';
import { FOKONTANY_LIST } from './seedData';
import {
  FolderLock, Users, HeartPulse, History, PlusCircle, Search,
  RotateCcw, ShieldCheck, Building, FileSignature, Landmark,
  Package, Loader2, Home, Filter
} from 'lucide-react';

export default function App() {
  const [foyers, setFoyers] = useState<Foyer[]>([]);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [cotisations, setCotisations] = useState<CotisationAdidy[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'annuaire'|'documents'|'statistics'|'finances'|'materials'|'logs'|'land'>('annuaire');
  const [searchQuery, setSearchQuery] = useState('');
  const [fokontanyFilter, setFokontanyFilter] = useState('Tous');
  const [statutFilter, setStatutFilter] = useState('Tous');

  // Modals
  const [showFoyerForm, setShowFoyerForm] = useState(false);
  const [editingFoyer, setEditingFoyer] = useState<Foyer | undefined>();
  const [selectedFoyer, setSelectedFoyer] = useState<Foyer | null>(null);
  const [showMembreForm, setShowMembreForm] = useState(false);
  const [editingMembre, setEditingMembre] = useState<Membre | undefined>();
  const [logSearch, setLogSearch] = useState('');

  // ── Chargement ───────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: f }, { data: m }, { data: l }] = await Promise.all([
        supabase.from('foyers').select('*').order('created_at', { ascending: false }),
        supabase.from('membres').select('*').order('created_at'),
        supabase.from('logs').select('*').order('date', { ascending: false }).limit(200),
      ]);
      setFoyers((f as Foyer[]) || []);
      setMembres((m as Membre[]) || []);
      setLogs((l as Log[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  // ── Log ──────────────────────────────────────────────────────
  const addLog = async (action: string, details: string, foyer_id?: string, membre_id?: string) => {
    const log = { date: new Date().toISOString(), utilisateur: 'Chef Fokontany (Admin)', action, details, foyer_id: foyer_id || null, membre_id: membre_id || null };
    const { data } = await supabase.from('logs').insert(log).select().single();
    if (data) setLogs(prev => [data, ...prev]);
  };

  // ── CRUD Foyer ───────────────────────────────────────────────
  const handleSaveFoyer = async (data: Partial<Foyer>) => {
    if (editingFoyer) {
      const { data: updated } = await supabase.from('foyers').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingFoyer.id).select().single();
      if (updated) {
        setFoyers(prev => prev.map(f => f.id === editingFoyer.id ? updated as Foyer : f));
        if (selectedFoyer?.id === editingFoyer.id) setSelectedFoyer(updated as Foyer);
        await addLog('Modification', `Foyer ${data.code_menage} modifié`, editingFoyer.id);
      }
    } else {
      const { data: created } = await supabase.from('foyers').insert({ ...data, nombre_membres: 0 }).select().single();
      if (created) {
        setFoyers(prev => [created as Foyer, ...prev]);
        await addLog('Création', `Nouveau foyer ${data.code_menage} créé`, created.id);
      }
    }
    setShowFoyerForm(false);
    setEditingFoyer(undefined);
  };

  const handleDeleteFoyer = async (foyer: Foyer) => {
    if (!confirm(`Supprimer le foyer ${foyer.code_menage} et tous ses membres ?`)) return;
    await supabase.from('foyers').delete().eq('id', foyer.id);
    setFoyers(prev => prev.filter(f => f.id !== foyer.id));
    setMembres(prev => prev.filter(m => m.foyer_id !== foyer.id));
    setSelectedFoyer(null);
    await addLog('Suppression', `Foyer ${foyer.code_menage} supprimé`);
  };

  // ── CRUD Membre ──────────────────────────────────────────────
  const handleSaveMembre = async (data: Partial<Membre>) => {
    if (!selectedFoyer) return;

    // Vérifier s'il y a déjà un chef si on essaie d'ajouter un chef
    const membresDuFoyer = membres.filter(m => m.foyer_id === selectedFoyer.id);
    if (data.is_chef && !editingMembre) {
      const chefExistant = membresDuFoyer.find(m => m.is_chef);
      if (chefExistant) {
        alert('Ce foyer a déjà un chef. Modifiez le chef existant ou changez la relation.');
        return;
      }
    }

    if (editingMembre) {
      const { data: updated } = await supabase.from('membres').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingMembre.id).select().single();
      if (updated) {
        setMembres(prev => prev.map(m => m.id === editingMembre.id ? updated as Membre : m));
        await addLog('Modification', `${data.nom} ${data.prenom} modifié`, selectedFoyer.id, editingMembre.id);
      }
    } else {
      const { data: created } = await supabase.from('membres').insert({ ...data, foyer_id: selectedFoyer.id }).select().single();
      if (created) {
        setMembres(prev => [...prev, created as Membre]);
        // Mettre à jour le compteur du foyer
        const newCount = membresDuFoyer.length + 1;
        await supabase.from('foyers').update({ nombre_membres: newCount }).eq('id', selectedFoyer.id);
        setFoyers(prev => prev.map(f => f.id === selectedFoyer.id ? { ...f, nombre_membres: newCount } : f));
        setSelectedFoyer(prev => prev ? { ...prev, nombre_membres: newCount } : prev);
        await addLog('Création', `${data.nom} ${data.prenom} ajouté au foyer ${selectedFoyer.code_menage}`, selectedFoyer.id, created.id);
      }
    }
    setShowMembreForm(false);
    setEditingMembre(undefined);
  };

  const handleDeleteMembre = async (id: string) => {
    if (!selectedFoyer) return;
    const m = membres.find(x => x.id === id);
    if (!confirm(`Supprimer ${m?.nom} ${m?.prenom} ?`)) return;
    await supabase.from('membres').delete().eq('id', id);
    setMembres(prev => prev.filter(x => x.id !== id));
    const newCount = Math.max((selectedFoyer.nombre_membres || 1) - 1, 0);
    await supabase.from('foyers').update({ nombre_membres: newCount }).eq('id', selectedFoyer.id);
    setFoyers(prev => prev.map(f => f.id === selectedFoyer.id ? { ...f, nombre_membres: newCount } : f));
    setSelectedFoyer(prev => prev ? { ...prev, nombre_membres: newCount } : prev);
    if (m) await addLog('Suppression', `${m.nom} ${m.prenom} retiré du foyer ${selectedFoyer.code_menage}`, selectedFoyer.id);
  };

  // ── Filtres ──────────────────────────────────────────────────
  const filteredFoyers = foyers.filter(f => {
    const q = searchQuery.toLowerCase();
    const membresFoyer = membres.filter(m => m.foyer_id === f.id);
    const chef = membresFoyer.find(m => m.is_chef);
    const matchSearch = !q || f.code_menage.toLowerCase().includes(q) || (chef && `${chef.nom} ${chef.prenom}`.toLowerCase().includes(q)) || (f.adresse || '').toLowerCase().includes(q) || membresFoyer.some(m => `${m.nom} ${m.prenom}`.toLowerCase().includes(q) || (m.cin || '').includes(q));
    const matchFokontany = fokontanyFilter === 'Tous' || f.fokontany === fokontanyFilter;
    const matchStatut = statutFilter === 'Tous' || f.statut === statutFilter;
    return matchSearch && matchFokontany && matchStatut;
  });

  const totalMembres = membres.length;

  // Adaptateur pour les modules existants (Finance, Matériels, Foncier)
  const habitants: Habitant[] = membres.map(m => ({
    id: m.id, nom: m.nom, prenom: m.prenom, sexe: m.sexe,
    dateNaissance: m.date_naissance || '', lieuNaissance: m.lieu_naissance || '',
    cin: m.cin, statut: m.statut as any,
    famille: { codeMenage: foyers.find(f => f.id === m.foyer_id)?.code_menage || '', isChefMenage: m.is_chef, conjointId: m.conjoint_id, pereId: m.pere_id, mereId: m.mere_id, enfantsIds: [] },
    residence: { adresse: foyers.find(f => f.id === m.foyer_id)?.adresse || '', fokontany: foyers.find(f => f.id === m.foyer_id)?.fokontany || '', commune: foyers.find(f => f.id === m.foyer_id)?.commune || '', district: foyers.find(f => f.id === m.foyer_id)?.district || '' },
    education: { niveauEtude: m.niveau_etude, competences: m.competences, langues: m.langues },
    economie: { profession: m.profession || '', secteur: m.secteur || '', revenuEstime: m.revenu_estime },
    sante: { groupeSanguin: m.groupe_sanguin, hypertension: m.hypertension, diabete: m.diabete, vaccination: m.vaccination },
    vulnerabilite: { estVulnerable: m.est_vulnerable, categories: m.vulnerabilite_categories, niveauPriorite: m.niveau_priorite, aidesObtenues: m.aides_obtenues },
  }));

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

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm py-3 px-6 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Logo SVG FANISA */}
            <svg width="44" height="44" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <path d="M60,6 L104,30 L104,90 L60,114 L16,90 L16,30 Z" fill="#4f46e5"/>
              <path d="M60,16 L96,36 L96,84 L60,104 L24,84 L24,36 Z" fill="#4338ca" opacity="0.4"/>
              <polygon points="60,28 92,54 28,54" fill="#a5b4fc"/>
              <polygon points="34,54 34,86 86,86 86,54" fill="white" opacity="0.95"/>
              <rect x="50" y="66" width="20" height="20" rx="10" fill="#4338ca"/>
              <rect x="38" y="60" width="10" height="10" rx="2" fill="#c7d2fe"/>
              <rect x="72" y="60" width="10" height="10" rx="2" fill="#c7d2fe"/>
              <circle cx="96" cy="26" r="10" fill="#10b981"/>
              <circle cx="96" cy="26" r="5" fill="white"/>
            </svg>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider">FANISA Web Pro</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 rounded px-1.5 py-0.5 font-semibold">Toamasina, MG</span>
              </div>
              <h1 className="text-lg font-extrabold text-slate-900 uppercase flex items-center gap-1.5">
                Registre des Habitants <ShieldCheck className="h-4 w-4 text-indigo-600" />
              </h1>
            </div>
          </div>
          {activeTab === 'annuaire' && (
            <button onClick={() => { setEditingFoyer(undefined); setShowFoyerForm(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition">
              <PlusCircle className="h-4 w-4" />Nouveau foyer
            </button>
          )}
        </div>
      </header>

      {/* Nav */}
      <div className="bg-white border-b border-slate-200 px-6 overflow-x-auto">
        <nav className="max-w-7xl mx-auto flex space-x-1 min-w-max">
          {([
            ['annuaire', Home, `Foyers (${foyers.length}) · ${totalMembres} personnes`],
            ['documents', FileSignature, 'Actes & Docs'],
            ['statistics', HeartPulse, 'Statistiques'],
            ['finances', Landmark, 'Finances'],
            ['materials', Package, 'Matériels'],
            ['land', Building, 'Foncier'],
            ['logs', History, `Journal (${logs.length})`],
          ] as const).map(([key, Icon, label]) => (
            <button key={key} onClick={() => setActiveTab(key as any)} className={`flex items-center gap-2 py-3.5 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition ${activeTab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-5">

        {/* ── ANNUAIRE ── */}
        {activeTab === 'annuaire' && (
          <div className="space-y-5">
            {/* Filtres */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Nom, CIN, code ménage, adresse…" className="w-full text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500" />
                </div>
                <select value={fokontanyFilter} onChange={e => setFokontanyFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-indigo-500 outline-none">
                  <option value="Tous">Tous les fokontany</option>
                  {FOKONTANY_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={statutFilter} onChange={e => setStatutFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:border-indigo-500 outline-none">
                  <option value="Tous">Tous statuts</option>
                  <option value="Actif">Actif</option>
                  <option value="Dissous">Dissous</option>
                  <option value="Déplacé">Déplacé</option>
                </select>
                {(searchQuery || fokontanyFilter !== 'Tous' || statutFilter !== 'Tous') && (
                  <button onClick={() => { setSearchQuery(''); setFokontanyFilter('Tous'); setStatutFilter('Tous'); }} className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition">
                    <RotateCcw className="h-3.5 w-3.5" />Réinitialiser
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500"><strong className="text-indigo-600">{filteredFoyers.length}</strong> foyer{filteredFoyers.length > 1 ? 's' : ''} · <strong>{totalMembres}</strong> personnes enregistrées</p>
            </div>

            {/* Grid foyers */}
            {filteredFoyers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFoyers.map(f => (
                  <FoyerCard
                    key={f.id}
                    foyer={f}
                    membres={membres.filter(m => m.foyer_id === f.id)}
                    onClick={() => setSelectedFoyer(f)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
                <Home className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="font-bold text-slate-700 text-lg">Aucun foyer enregistré</p>
                <p className="text-sm text-slate-500 mt-1">Commencez par créer le premier foyer du registre.</p>
                <button onClick={() => { setEditingFoyer(undefined); setShowFoyerForm(true); }} className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition flex items-center gap-2 mx-auto">
                  <PlusCircle className="h-4 w-4" />Créer le premier foyer
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && <DocumentGenerator habitants={habitants} onLoggedAction={(a, d) => addLog(a, d)} />}
        {activeTab === 'statistics' && <StatsView habitants={habitants} foyers={foyers} />}
        {activeTab === 'finances' && (
          <FinanceModule transactions={transactions} habitants={habitants} cotisations={cotisations}
            onAddTransaction={async (t) => setTransactions(p => [{ id: `tx-${Date.now()}`, ...t }, ...p])}
            onDeleteTransaction={async (id) => setTransactions(p => p.filter(x => x.id !== id))}
            onAddCotisation={async (c) => setCotisations(p => [{ id: `cot-${Date.now()}`, ...c }, ...p])}
            onDeleteCotisation={async (id) => setCotisations(p => p.filter(x => x.id !== id))}
          />
        )}
        {activeTab === 'materials' && (
          <MaterialsModule materiels={materiels}
            onAddMateriel={async (m) => setMateriels(p => [...p, { id: `mat-${Date.now()}`, ...m }])}
            onUpdateMateriel={async (m) => setMateriels(p => p.map(x => x.id === m.id ? m : x))}
            onDeleteMateriel={async (id) => setMateriels(p => p.filter(x => x.id !== id))}
          />
        )}
        {activeTab === 'land' && <LandModule allResidents={habitants} onAddLog={addLog} />}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="relative"><Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" /><input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Rechercher…" className="w-full text-xs pl-9 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none" /></div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50 border-b text-slate-500"><th className="p-3 text-left font-mono uppercase text-[10px]">Date</th><th className="p-3 text-left font-mono uppercase text-[10px]">Action</th><th className="p-3 text-left font-mono uppercase text-[10px]">Détails</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.filter(l => !logSearch || l.details.toLowerCase().includes(logSearch.toLowerCase()) || l.action.toLowerCase().includes(logSearch.toLowerCase())).map(l => (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{new Date(l.date).toLocaleString('fr-FR')}</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold">{l.action}</span></td>
                      <td className="p-3 text-slate-600">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t py-4 text-center text-xs text-slate-400">
        <p className="font-semibold text-slate-500">REPUBLIQUE DE MADAGASCAR</p>
        <p className="font-mono text-[10px] mt-0.5">Registre numérique du Fokontany · Version 2.0.0</p>
      </footer>

      {/* Modals */}
      {showFoyerForm && (
        <FoyerForm foyer={editingFoyer} onClose={() => { setShowFoyerForm(false); setEditingFoyer(undefined); }} onSave={handleSaveFoyer} />
      )}

      {selectedFoyer && !showMembreForm && !showFoyerForm && (
        <FoyerDetail
          foyer={selectedFoyer}
          membres={membres.filter(m => m.foyer_id === selectedFoyer.id)}
          onClose={() => setSelectedFoyer(null)}
          onEditFoyer={() => { setEditingFoyer(selectedFoyer); setShowFoyerForm(true); }}
          onDeleteFoyer={() => handleDeleteFoyer(selectedFoyer)}
          onAddMembre={() => { setEditingMembre(undefined); setShowMembreForm(true); }}
          onEditMembre={(m) => { setEditingMembre(m); setShowMembreForm(true); }}
          onDeleteMembre={handleDeleteMembre}
        />
      )}

      {showMembreForm && selectedFoyer && (
        <MembreForm
          foyer={selectedFoyer}
          membre={editingMembre}
          membres={membres.filter(m => m.foyer_id === selectedFoyer.id)}
          onClose={() => { setShowMembreForm(false); setEditingMembre(undefined); }}
          onSave={handleSaveMembre}
        />
      )}
    </div>
  );
}
