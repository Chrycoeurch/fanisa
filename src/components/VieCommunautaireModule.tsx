import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import {
  MessageSquare, Calendar, Gift, Heart, Radio, Archive,
  Plus, X, Search, Loader2, AlertCircle, CheckCircle,
  Clock, Filter, Eye, Edit2, ChevronDown, ChevronRight,
  Users, MapPin, Phone, FileText, Send, BarChart2,
  Trash2, Save, RefreshCw, Flag, Star
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

// ── Types ─────────────────────────────────────────────────────────
interface Doleance {
  id: string; numero: string; date_heure: string; agent: string;
  foyer_id: string | null; membre_id: string | null;
  declarant_nom: string; declarant_telephone: string;
  categorie: string; priorite: string; description: string; statut: string;
}
interface Evenement {
  id: string; titre: string; type: string; description: string;
  date_evenement: string; heure_debut: string; heure_fin: string;
  lieu: string; organisateur: string; responsable: string;
  statut: string; ordre_du_jour: string; decisions: string;
  compte_rendu: string; nb_presents: number;
}
interface CampagneSociale {
  id: string; nom: string; type_aide: string; organisme_partenaire: string;
  responsable: string; date_debut: string; date_fin: string;
  lieu: string; description: string; statut: string; nb_beneficiaires: number;
}
interface SuiviSocial {
  id: string; foyer_id: string; membre_id: string | null;
  categorie: string; motif: string; niveau_vulnerabilite: string;
  statut: string; recommandations: string; date_ouverture: string;
}
interface SMS {
  id: string; objet: string; contenu: string; type_destinataires: string;
  nb_destinataires: number; agent: string; statut: string; created_at: string;
}

// ── Constantes ────────────────────────────────────────────────────
const CATS_DOLEANCE = ['Conflit familial','Conflit foncier','Litige entre voisins','Nuisance','Sécurité','Violence','Assainissement','Eau','Éclairage','Demande d\'intervention','Suggestion','Autre'];
const TYPES_EVENEMENT = ['Réunion communautaire','Assemblée générale','Réunion du bureau','Réunion de médiation','Sensibilisation','Nettoyage collectif','Vaccination','Distribution d\'aide','Visite officielle','Urgence','Catastrophe','Activité culturelle','Activité sportive','Autre'];
const TYPES_AIDE = ['Complément alimentaire','Riz','Huile','Kit scolaire','Moustiquaire','Semences','Médicaments','Aide financière','Aide après cyclone','Autre'];
const CATS_SUIVI = ['Familles vulnérables','Personnes âgées','Handicap','Femmes enceintes','Enfants de moins de 5 ans','Orphelins','Familles sinistrées','Autre'];
const STATUTS_DOL = ['Reçue','En cours d\'analyse','Convocation programmée','En médiation','Décision prise','Résolue','Clôturée'];
const PRIORITES = ['Faible','Normale','Haute','Urgente'];
const NIVEAUX_VULN = ['Faible','Moyen','Élevé','Critique'];

const PRIORITE_COLOR: Record<string,string> = {
  'Faible':'bg-slate-100 text-slate-600','Normale':'bg-blue-100 text-blue-700',
  'Haute':'bg-orange-100 text-orange-700','Urgente':'bg-red-100 text-red-700'
};
const STATUT_DOL_COLOR: Record<string,string> = {
  'Reçue':'bg-slate-100 text-slate-600','En cours d\'analyse':'bg-blue-100 text-blue-700',
  'Convocation programmée':'bg-purple-100 text-purple-700','En médiation':'bg-amber-100 text-amber-700',
  'Décision prise':'bg-indigo-100 text-indigo-700','Résolue':'bg-emerald-100 text-emerald-700',
  'Clôturée':'bg-slate-200 text-slate-500'
};
const STATUT_EVT_COLOR: Record<string,string> = {
  'Planifié':'bg-blue-100 text-blue-700','En cours':'bg-amber-100 text-amber-700',
  'Terminé':'bg-emerald-100 text-emerald-700','Annulé':'bg-red-100 text-red-600'
};

const fmt = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtDT = (d: string) => d ? new Date(d).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const genNum = (prefix: string) => `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`;

// ── SOUS-MODULE DOLÉANCES ─────────────────────────────────────────
function DoleancesTab({ foyers, membres }: Props) {
  const [doleances, setDoleances] = useState<Doleance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Doleance | null>(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtrePriorite, setFiltrePriorite] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [newStatut, setNewStatut] = useState('');
  const [actions, setActions] = useState<any[]>([]);

  const [form, setForm] = useState({
    declarant_nom:'', declarant_telephone:'', categorie:'', priorite:'Normale',
    description:'', foyer_id:'', membre_id:'', agent:'Agent Fokontany'
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('doleances').select('*').order('date_heure', { ascending: false });
    setDoleances((data || []) as Doleance[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadActions = async (id: string) => {
    const { data } = await supabase.from('doleances_actions').select('*').eq('doleance_id', id).order('created_at', { ascending: true });
    setActions(data || []);
  };

  const ouvrir = async (d: Doleance) => { setSelected(d); await loadActions(d.id); };

  const creer = async () => {
    if (!form.categorie || !form.description || !form.declarant_nom) { alert('Remplissez tous les champs obligatoires.'); return; }
    setSaving(true);
    await supabase.from('doleances').insert({
      numero: genNum('DOL'), ...form,
      foyer_id: form.foyer_id || null, membre_id: form.membre_id || null,
      statut: 'Reçue',
    });
    setShowForm(false);
    setForm({ declarant_nom:'', declarant_telephone:'', categorie:'', priorite:'Normale', description:'', foyer_id:'', membre_id:'', agent:'Agent Fokontany' });
    await load();
    setSaving(false);
  };

  const ajouterAction = async () => {
    if (!selected || (!newAction && !newStatut)) return;
    await supabase.from('doleances_actions').insert({
      doleance_id: selected.id, type_action: newStatut ? 'statut' : 'observation',
      description: newAction || `Statut changé en : ${newStatut}`,
      agent: 'Agent Fokontany', nouveau_statut: newStatut || null,
    });
    if (newStatut) {
      await supabase.from('doleances').update({ statut: newStatut, updated_at: new Date().toISOString() }).eq('id', selected.id);
    }
    setNewAction(''); setNewStatut('');
    await loadActions(selected.id);
    await load();
    if (selected) {
      const { data } = await supabase.from('doleances').select('*').eq('id', selected.id).single();
      setSelected(data as Doleance);
    }
  };

  const filtrees = doleances.filter(d => {
    if (filtreStatut && d.statut !== filtreStatut) return false;
    if (filtrePriorite && d.priorite !== filtrePriorite) return false;
    if (search && !d.declarant_nom.toLowerCase().includes(search.toLowerCase()) && !d.numero.includes(search) && !d.categorie.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Filter className="h-3.5 w-3.5"/>Filtres</h3>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg">
              <Plus className="h-4 w-4"/>Nouvelle doléance
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="relative col-span-2"><Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-rose-400"/>
            </div>
            <select value={filtreStatut} onChange={e=>setFiltreStatut(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white outline-none">
              <option value="">Tous les statuts</option>
              {STATUTS_DOL.map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={filtrePriorite} onChange={e=>setFiltrePriorite(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white outline-none">
              <option value="">Toutes priorités</option>
              {PRIORITES.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex justify-end text-xs text-slate-500 font-semibold border-t border-slate-100 pt-2">{filtrees.length} doléance{filtrees.length>1?'s':''}</div>
        </div>

        {loading ? <div className="text-center py-10"><Loader2 className="h-6 w-6 text-rose-600 animate-spin mx-auto"/></div>
        : filtrees.length === 0 ? <div className="text-center py-12 text-slate-400"><MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30"/><p className="text-sm font-semibold">Aucune doléance</p></div>
        : <table className="w-full text-xs"><thead><tr className="bg-slate-50 border-b">
            <th className="p-3 text-left text-slate-500">Numéro</th>
            <th className="p-3 text-left text-slate-500">Date</th>
            <th className="p-3 text-left text-slate-500">Déclarant</th>
            <th className="p-3 text-left text-slate-500">Catégorie</th>
            <th className="p-3 text-center text-slate-500">Priorité</th>
            <th className="p-3 text-center text-slate-500">Statut</th>
            <th className="p-3 text-center text-slate-500">Action</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {filtrees.map(d=>(
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold text-rose-600">{d.numero}</td>
                <td className="p-3 text-slate-500">{fmtDT(d.date_heure)}</td>
                <td className="p-3 text-slate-700 font-semibold">{d.declarant_nom}</td>
                <td className="p-3 text-slate-600">{d.categorie}</td>
                <td className="p-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITE_COLOR[d.priorite]||'bg-slate-100'}`}>{d.priorite}</span></td>
                <td className="p-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_DOL_COLOR[d.statut]||'bg-slate-100'}`}>{d.statut}</span></td>
                <td className="p-3 text-center"><button onClick={()=>ouvrir(d)} className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600"><Eye className="h-3.5 w-3.5"/></button></td>
              </tr>
            ))}
          </tbody></table>}
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Nouvelle doléance</h2><button onClick={()=>setShowForm(false)}><X className="h-5 w-5 text-slate-400"/></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Déclarant *</label><input value={form.declarant_nom} onChange={e=>setForm({...form,declarant_nom:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Téléphone</label><input value={form.declarant_telephone} onChange={e=>setForm({...form,declarant_telephone:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Agent</label><input value={form.agent} onChange={e=>setForm({...form,agent:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Catégorie *</label>
                <select value={form.categorie} onChange={e=>setForm({...form,categorie:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-rose-400">
                  <option value="">-- Choisir --</option>{CATS_DOLEANCE.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Priorité</label>
                <select value={form.priorite} onChange={e=>setForm({...form,priorite:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                  {PRIORITES.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Ménage concerné</label>
                <select value={form.foyer_id} onChange={e=>setForm({...form,foyer_id:e.target.value,membre_id:''})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                  <option value="">-- Aucun --</option>{foyers.map(f=><option key={f.id} value={f.id}>{f.code_menage}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Personne concernée</label>
                <select value={form.membre_id} onChange={e=>setForm({...form,membre_id:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                  <option value="">-- Aucune --</option>
                  {membres.filter(m=>!form.foyer_id||m.foyer_id===form.foyer_id).map(m=><option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Description *</label><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 resize-none"/></div>
            </div>
            <div className="flex gap-3"><button onClick={()=>setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Annuler</button>
              <button onClick={creer} disabled={saving} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dossier doléance */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
              <div><h2 className="font-bold text-slate-900">Dossier {selected.numero}</h2>
                <p className="text-xs text-slate-400">{fmtDT(selected.date_heure)} · {selected.categorie}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITE_COLOR[selected.priorite]}`}>{selected.priorite}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_DOL_COLOR[selected.statut]}`}>{selected.statut}</span>
                <button onClick={()=>setSelected(null)}><X className="h-5 w-5 text-slate-400"/></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Infos */}
              <div className="grid grid-cols-2 gap-3">
                {[['Déclarant',selected.declarant_nom],['Téléphone',selected.declarant_telephone||'—'],['Ménage',selected.foyer_id?foyers.find(f=>f.id===selected.foyer_id)?.code_menage||'—':'—'],['Agent',selected.agent]].map(([k,v])=>(
                  <div key={k} className="bg-slate-50 rounded-lg p-3"><p className="text-[10px] text-slate-400 font-bold uppercase">{k}</p><p className="text-sm font-semibold text-slate-800">{v}</p></div>
                ))}
              </div>
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Description</p><p className="text-sm text-slate-700">{selected.description}</p></div>

              {/* Historique actions */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Historique du dossier</h3>
                {actions.length===0 ? <p className="text-xs text-slate-400">Aucune action enregistrée.</p>
                : actions.map((a,i)=>(
                  <div key={i} className="flex gap-3 mb-3">
                    <div className="w-2 h-2 rounded-full bg-rose-400 mt-1.5 shrink-0"/>
                    <div><p className="text-xs font-semibold text-slate-700">{a.description}</p>
                      <p className="text-[10px] text-slate-400">{fmtDT(a.created_at)} · {a.agent}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ajouter action */}
              {selected.statut !== 'Clôturée' && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase">Ajouter une action</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="text-xs text-slate-400 block mb-1">Changer le statut</label>
                      <select value={newStatut} onChange={e=>setNewStatut(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none">
                        <option value="">-- Conserver --</option>
                        {STATUTS_DOL.filter(s=>s!==selected.statut).map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <textarea value={newAction} onChange={e=>setNewAction(e.target.value)} placeholder="Observation, décision, suite..." rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none resize-none"/>
                  <button onClick={ajouterAction} disabled={!newAction&&!newStatut} className="w-full py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 text-white text-xs font-bold rounded-lg">Enregistrer l'action</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SOUS-MODULE ÉVÉNEMENTS ────────────────────────────────────────
function EvenementsTab({ foyers, membres }: Props) {
  const [evenements, setEvenements] = useState<Evenement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Evenement | null>(null);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [searchParticipant, setSearchParticipant] = useState('');
  const [editingSection, setEditingSection] = useState<string|null>(null);
  const [sectionValue, setSectionValue] = useState('');

  const [form, setForm] = useState({
    titre:'', type:'', description:'', date_evenement:'', heure_debut:'',
    heure_fin:'', lieu:'', organisateur:'', responsable:'', ordre_du_jour:''
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('evenements').select('*').order('date_evenement', { ascending: false });
    setEvenements((data||[]) as Evenement[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadParticipants = async (id: string) => {
    const { data } = await supabase.from('evenements_participants').select('*').eq('evenement_id', id);
    setParticipants(data||[]);
  };

  const ouvrir = async (e: Evenement) => { setSelected(e); await loadParticipants(e.id); };

  const creer = async () => {
    if (!form.titre || !form.type || !form.date_evenement) { alert('Titre, type et date sont obligatoires.'); return; }
    setSaving(true);
    await supabase.from('evenements').insert({ ...form, statut: 'Planifié', nb_presents: 0 });
    setShowForm(false);
    setForm({ titre:'', type:'', description:'', date_evenement:'', heure_debut:'', heure_fin:'', lieu:'', organisateur:'', responsable:'', ordre_du_jour:'' });
    await load();
    setSaving(false);
  };

  const majStatut = async (statut: string) => {
    if (!selected) return;
    await supabase.from('evenements').update({ statut, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSelected({ ...selected, statut });
    await load();
  };

  const majSection = async () => {
    if (!selected || !editingSection) return;
    await supabase.from('evenements').update({ [editingSection]: sectionValue, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSelected({ ...selected, [editingSection]: sectionValue });
    setEditingSection(null); setSectionValue('');
    await load();
  };

  const ajouterParticipant = async (foyer: Foyer) => {
    if (!selected) return;
    const exist = participants.find(p=>p.foyer_id===foyer.id);
    if (exist) return;
    await supabase.from('evenements_participants').insert({ evenement_id: selected.id, foyer_id: foyer.id, present: false });
    await loadParticipants(selected.id);
    await supabase.from('evenements').update({ nb_presents: participants.length + 1 }).eq('id', selected.id);
  };

  const togglePresence = async (partId: string, present: boolean) => {
    await supabase.from('evenements_participants').update({ present: !present }).eq('id', partId);
    await loadParticipants(selected!.id);
  };

  const filtres = evenements.filter(e => {
    if (filtreStatut && e.statut !== filtreStatut) return false;
    if (search && !e.titre.toLowerCase().includes(search.toLowerCase()) && !e.lieu?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const participantSearch = foyers.filter(f =>
    searchParticipant && (f.code_menage.toLowerCase().includes(searchParticipant.toLowerCase()) ||
    membres.find(m=>m.foyer_id===f.id&&m.is_chef&&`${m.nom} ${m.prenom}`.toLowerCase().includes(searchParticipant.toLowerCase())))
  ).slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Filter className="h-3.5 w-3.5"/>Filtres</h3>
            <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg"><Plus className="h-4 w-4"/>Nouvel événement</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="relative col-span-2"><Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none"/>
            </div>
            <select value={filtreStatut} onChange={e=>setFiltreStatut(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white outline-none">
              <option value="">Tous les statuts</option>
              {['Planifié','En cours','Terminé','Annulé'].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex justify-end text-xs text-slate-500 font-semibold border-t border-slate-100 pt-2">{filtres.length} événement{filtres.length>1?'s':''}</div>
        </div>

        {loading ? <div className="text-center py-10"><Loader2 className="h-6 w-6 text-violet-600 animate-spin mx-auto"/></div>
        : filtres.length === 0 ? <div className="text-center py-12 text-slate-400"><Calendar className="h-8 w-8 mx-auto mb-2 opacity-30"/><p className="text-sm font-semibold">Aucun événement</p></div>
        : <table className="w-full text-xs"><thead><tr className="bg-slate-50 border-b">
            <th className="p-3 text-left text-slate-500">Titre</th>
            <th className="p-3 text-left text-slate-500">Type</th>
            <th className="p-3 text-left text-slate-500">Date</th>
            <th className="p-3 text-left text-slate-500">Lieu</th>
            <th className="p-3 text-center text-slate-500">Présents</th>
            <th className="p-3 text-center text-slate-500">Statut</th>
            <th className="p-3 text-center text-slate-500">Action</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {filtres.map(e=>(
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-800">{e.titre}</td>
                <td className="p-3 text-slate-500">{e.type}</td>
                <td className="p-3 text-slate-500">{fmt(e.date_evenement)}{e.heure_debut?` · ${e.heure_debut}`:''}</td>
                <td className="p-3 text-slate-500">{e.lieu||'—'}</td>
                <td className="p-3 text-center font-semibold text-slate-700">{e.nb_presents}</td>
                <td className="p-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_EVT_COLOR[e.statut]||'bg-slate-100'}`}>{e.statut}</span></td>
                <td className="p-3 text-center"><button onClick={()=>ouvrir(e)} className="p-1.5 hover:bg-violet-50 rounded-lg text-slate-400 hover:text-violet-600"><Eye className="h-3.5 w-3.5"/></button></td>
              </tr>
            ))}
          </tbody></table>}
      </div>

      {/* Form création */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Nouvel événement</h2><button onClick={()=>setShowForm(false)}><X className="h-5 w-5 text-slate-400"/></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Titre *</label><input value={form.titre} onChange={e=>setForm({...form,titre:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Type *</label>
                <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-violet-400">
                  <option value="">-- Choisir --</option>{TYPES_EVENEMENT.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Date *</label><input type="date" value={form.date_evenement} onChange={e=>setForm({...form,date_evenement:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Heure début</label><input type="time" value={form.heure_debut} onChange={e=>setForm({...form,heure_debut:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Heure fin</label><input type="time" value={form.heure_fin} onChange={e=>setForm({...form,heure_fin:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Lieu</label><input value={form.lieu} onChange={e=>setForm({...form,lieu:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Organisateur</label><input value={form.organisateur} onChange={e=>setForm({...form,organisateur:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Responsable</label><input value={form.responsable} onChange={e=>setForm({...form,responsable:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Ordre du jour</label><textarea value={form.ordre_du_jour} onChange={e=>setForm({...form,ordre_du_jour:e.target.value})} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none resize-none"/></div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Annuler</button>
              <button onClick={creer} disabled={saving} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dossier événement */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
              <div><h2 className="font-bold text-slate-900">{selected.titre}</h2>
                <p className="text-xs text-slate-400">{selected.type} · {fmt(selected.date_evenement)}{selected.lieu?` · ${selected.lieu}`:''}</p>
              </div>
              <div className="flex items-center gap-2">
                {selected.statut === 'Planifié' && <button onClick={()=>majStatut('En cours')} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg">Démarrer</button>}
                {selected.statut === 'En cours' && <button onClick={()=>majStatut('Terminé')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg">Terminer</button>}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_EVT_COLOR[selected.statut]}`}>{selected.statut}</span>
                <button onClick={()=>setSelected(null)}><X className="h-5 w-5 text-slate-400"/></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Infos */}
              <div className="grid grid-cols-3 gap-3">
                {[['Organisateur',selected.organisateur||'—'],['Responsable',selected.responsable||'—'],['Présents',String(participants.filter(p=>p.present).length)+'/'+participants.length]].map(([k,v])=>(
                  <div key={k} className="bg-slate-50 rounded-lg p-3"><p className="text-[10px] text-slate-400 font-bold uppercase">{k}</p><p className="text-sm font-semibold text-slate-800">{v}</p></div>
                ))}
              </div>

              {/* Sections éditables */}
              {[['ordre_du_jour','Ordre du jour'],['decisions','Décisions'],['compte_rendu','Compte rendu']].map(([key,label])=>(
                <div key={key} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase">{label}</h3>
                    <button onClick={()=>{setEditingSection(key);setSectionValue((selected as any)[key]||'');}} className="text-xs text-indigo-600 hover:underline">{(selected as any)[key]?'Modifier':'Ajouter'}</button>
                  </div>
                  {editingSection === key ? (
                    <div className="space-y-2">
                      <textarea value={sectionValue} onChange={e=>setSectionValue(e.target.value)} rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none resize-none focus:border-violet-400"/>
                      <div className="flex gap-2"><button onClick={()=>setEditingSection(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">Annuler</button>
                        <button onClick={majSection} className="flex-1 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg">Enregistrer</button>
                      </div>
                    </div>
                  ) : <p className="text-xs text-slate-600 whitespace-pre-line">{(selected as any)[key]||'Aucun contenu.'}</p>}
                </div>
              ))}

              {/* Participants */}
              <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Participants ({participants.length})</h3>
                <div className="relative mb-3"><Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none"/>
                  <input value={searchParticipant} onChange={e=>setSearchParticipant(e.target.value)} placeholder="Ajouter un ménage..." className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none"/>
                  {searchParticipant && participantSearch.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-40 overflow-y-auto">
                      {participantSearch.map(f=>{
                        const chef=membres.find(m=>m.foyer_id===f.id&&m.is_chef);
                        return <button key={f.id} onMouseDown={()=>{ajouterParticipant(f);setSearchParticipant('');}} className="w-full text-left px-3 py-2 hover:bg-violet-50 flex items-center gap-2 text-xs">
                          <span className="font-mono text-violet-600">{f.code_menage}</span>{chef&&<span>{chef.nom} {chef.prenom}</span>}
                        </button>;
                      })}
                    </div>
                  )}
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {participants.map(p=>{
                    const foyer=foyers.find(f=>f.id===p.foyer_id);
                    const chef=membres.find(m=>m.foyer_id===p.foyer_id&&m.is_chef);
                    return <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-xs"><span className="font-mono text-violet-600">{foyer?.code_menage}</span>{chef&&` · ${chef.nom} ${chef.prenom}`}</span>
                      <button onClick={()=>togglePresence(p.id,p.present)} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.present?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>
                        {p.present?'✓ Présent':'Absent'}
                      </button>
                    </div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SOUS-MODULE CAMPAGNES SOCIALES ────────────────────────────────
function CampagnesSocialesTab({ foyers, membres }: Props) {
  const [campagnes, setCampagnes] = useState<CampagneSociale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<CampagneSociale | null>(null);
  const [distributions, setDistributions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddBenef, setShowAddBenef] = useState(false);
  const [searchBenef, setSearchBenef] = useState('');
  const [newDist, setNewDist] = useState({ foyer_id:'', membre_id:'', nom_beneficiaire:'', produit:'', quantite:'1', unite:'unité', valeur_estimee:'' });

  const [form, setForm] = useState({
    nom:'', type_aide:'', organisme_partenaire:'', responsable:'',
    date_debut:'', date_fin:'', lieu:'', description:''
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('campagnes_sociales').select('*').order('date_debut', { ascending: false });
    setCampagnes((data||[]) as CampagneSociale[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDist = async (id: string) => {
    const { data } = await supabase.from('campagnes_sociales_distributions').select('*').eq('campagne_id', id);
    setDistributions(data||[]);
  };

  const creer = async () => {
    if (!form.nom||!form.type_aide||!form.date_debut) { alert('Nom, type d\'aide et date de début sont obligatoires.'); return; }
    setSaving(true);
    await supabase.from('campagnes_sociales').insert({ ...form, statut:'Planifiée', nb_beneficiaires:0 });
    setShowForm(false);
    setForm({ nom:'', type_aide:'', organisme_partenaire:'', responsable:'', date_debut:'', date_fin:'', lieu:'', description:'' });
    await load();
    setSaving(false);
  };

  const ajouterDistribution = async () => {
    if (!selected||!newDist.produit||!newDist.nom_beneficiaire) return;
    await supabase.from('campagnes_sociales_distributions').insert({
      campagne_id: selected.id, ...newDist,
      foyer_id: newDist.foyer_id||null, membre_id: newDist.membre_id||null,
      quantite: parseFloat(newDist.quantite)||1,
      valeur_estimee: newDist.valeur_estimee?parseFloat(newDist.valeur_estimee):null,
    });
    setNewDist({ foyer_id:'', membre_id:'', nom_beneficiaire:'', produit:'', quantite:'1', unite:'unité', valeur_estimee:'' });
    setShowAddBenef(false);
    await loadDist(selected.id);
    await supabase.from('campagnes_sociales').update({ nb_beneficiaires: distributions.length+1 }).eq('id', selected.id);
  };

  const toggleDistribue = async (id: string, distribue: boolean) => {
    await supabase.from('campagnes_sociales_distributions').update({ distribue: !distribue, date_distribution: !distribue ? new Date().toISOString() : null, agent:'Agent Fokontany' }).eq('id', id);
    await loadDist(selected!.id);
  };

  const benefSearch = foyers.filter(f =>
    searchBenef.length > 1 && (f.code_menage.toLowerCase().includes(searchBenef.toLowerCase()) ||
    membres.find(m=>m.foyer_id===f.id&&m.is_chef&&`${m.nom} ${m.prenom}`.toLowerCase().includes(searchBenef.toLowerCase())))
  ).slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Gift className="h-3.5 w-3.5"/>Campagnes sociales</h3>
          <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg"><Plus className="h-4 w-4"/>Nouvelle campagne</button>
        </div>
        {loading ? <div className="text-center py-10"><Loader2 className="h-6 w-6 text-emerald-600 animate-spin mx-auto"/></div>
        : campagnes.length === 0 ? <div className="text-center py-12 text-slate-400"><Gift className="h-8 w-8 mx-auto mb-2 opacity-30"/><p className="text-sm font-semibold">Aucune campagne</p></div>
        : <table className="w-full text-xs"><thead><tr className="bg-slate-50 border-b">
            <th className="p-3 text-left text-slate-500">Nom</th>
            <th className="p-3 text-left text-slate-500">Type d'aide</th>
            <th className="p-3 text-left text-slate-500">Début</th>
            <th className="p-3 text-left text-slate-500">Lieu</th>
            <th className="p-3 text-center text-slate-500">Bénéficiaires</th>
            <th className="p-3 text-center text-slate-500">Statut</th>
            <th className="p-3 text-center text-slate-500">Action</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {campagnes.map(c=>(
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="p-3 font-semibold text-slate-800">{c.nom}</td>
                <td className="p-3 text-slate-500">{c.type_aide}</td>
                <td className="p-3 text-slate-500">{fmt(c.date_debut)}</td>
                <td className="p-3 text-slate-500">{c.lieu||'—'}</td>
                <td className="p-3 text-center font-semibold text-slate-700">{c.nb_beneficiaires}</td>
                <td className="p-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.statut==='En cours'?'bg-amber-100 text-amber-700':c.statut==='Terminée'?'bg-emerald-100 text-emerald-700':'bg-blue-100 text-blue-700'}`}>{c.statut}</span></td>
                <td className="p-3 text-center"><button onClick={()=>{setSelected(c);loadDist(c.id);}} className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-600"><Eye className="h-3.5 w-3.5"/></button></td>
              </tr>
            ))}
          </tbody></table>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Nouvelle campagne sociale</h2><button onClick={()=>setShowForm(false)}><X className="h-5 w-5 text-slate-400"/></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Nom *</label><input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Type d'aide *</label>
                <select value={form.type_aide} onChange={e=>setForm({...form,type_aide:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                  <option value="">-- Choisir --</option>{TYPES_AIDE.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Organisme partenaire</label><input value={form.organisme_partenaire} onChange={e=>setForm({...form,organisme_partenaire:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Date début *</label><input type="date" value={form.date_debut} onChange={e=>setForm({...form,date_debut:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Date fin</label><input type="date" value={form.date_fin} onChange={e=>setForm({...form,date_fin:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Lieu</label><input value={form.lieu} onChange={e=>setForm({...form,lieu:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Responsable</label><input value={form.responsable} onChange={e=>setForm({...form,responsable:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Annuler</button>
              <button onClick={creer} disabled={saving} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dossier campagne */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
              <div><h2 className="font-bold text-slate-900">{selected.nom}</h2><p className="text-xs text-slate-400">{selected.type_aide} · {fmt(selected.date_debut)}</p></div>
              <div className="flex items-center gap-2"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700`}>{selected.statut}</span><button onClick={()=>setSelected(null)}><X className="h-5 w-5 text-slate-400"/></button></div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[['Organisme',selected.organisme_partenaire||'—'],['Responsable',selected.responsable||'—'],['Bénéficiaires',String(distributions.length)]].map(([k,v])=>(
                  <div key={k} className="bg-slate-50 rounded-lg p-3"><p className="text-[10px] text-slate-400 font-bold uppercase">{k}</p><p className="text-sm font-semibold text-slate-800">{v}</p></div>
                ))}
              </div>
              {/* Stats distribution */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-emerald-700">{distributions.filter(d=>d.distribue).length}</p>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase">Distribués</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-amber-600">{distributions.filter(d=>!d.distribue).length}</p>
                  <p className="text-[10px] text-amber-600 font-bold uppercase">En attente</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-indigo-700">{Math.round(distributions.length>0?distributions.filter(d=>d.distribue).length/distributions.length*100:0)}%</p>
                  <p className="text-[10px] text-indigo-600 font-bold uppercase">Taux distrib.</p>
                </div>
              </div>
              {/* Liste distributions */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-xs font-bold text-slate-500 uppercase">Liste des bénéficiaires</h3>
                  <button onClick={()=>setShowAddBenef(true)} className="flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:underline"><Plus className="h-3.5 w-3.5"/>Ajouter</button>
                </div>
                {showAddBenef && (
                  <div className="p-4 border-b border-slate-100 bg-emerald-50 space-y-3">
                    <div className="relative"><Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none"/>
                      <input value={searchBenef} onChange={e=>setSearchBenef(e.target.value)} placeholder="Rechercher ménage ou membre..." className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none bg-white"/>
                      {searchBenef.length>1 && benefSearch.length>0 && (
                        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1">
                          {benefSearch.map(f=>{
                            const chef=membres.find(m=>m.foyer_id===f.id&&m.is_chef);
                            const nom=chef?`${chef.nom} ${chef.prenom}`:f.code_menage;
                            return <button key={f.id} onMouseDown={()=>{setNewDist({...newDist,foyer_id:f.id,nom_beneficiaire:nom});setSearchBenef('');}} className="w-full text-left px-3 py-2 hover:bg-emerald-50 flex gap-2 text-xs">
                              <span className="font-mono text-emerald-600">{f.code_menage}</span><span>{nom}</span>
                            </button>;
                          })}
                        </div>
                      )}
                    </div>
                    {newDist.nom_beneficiaire && <p className="text-xs font-semibold text-emerald-700">Bénéficiaire : {newDist.nom_beneficiaire}</p>}
                    <div className="grid grid-cols-3 gap-2">
                      <input value={newDist.produit} onChange={e=>setNewDist({...newDist,produit:e.target.value})} placeholder="Produit *" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"/>
                      <input type="number" value={newDist.quantite} onChange={e=>setNewDist({...newDist,quantite:e.target.value})} placeholder="Qté" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"/>
                      <input value={newDist.unite} onChange={e=>setNewDist({...newDist,unite:e.target.value})} placeholder="Unité" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"/>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>setShowAddBenef(false)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-xs">Annuler</button>
                      <button onClick={ajouterDistribution} disabled={!newDist.produit||!newDist.nom_beneficiaire} className="flex-1 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg disabled:bg-slate-200">Ajouter</button>
                    </div>
                  </div>
                )}
                <table className="w-full text-xs"><thead><tr className="bg-slate-50 border-b">
                  <th className="p-2 text-left text-slate-500">Bénéficiaire</th>
                  <th className="p-2 text-left text-slate-500">Produit</th>
                  <th className="p-2 text-center text-slate-500">Qté</th>
                  <th className="p-2 text-center text-slate-500">Distribué</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {distributions.map(d=>(
                    <tr key={d.id} className={`hover:bg-slate-50 ${d.distribue?'bg-emerald-50/30':''}`}>
                      <td className="p-2 text-slate-700">{d.nom_beneficiaire}</td>
                      <td className="p-2 text-slate-600">{d.produit}</td>
                      <td className="p-2 text-center text-slate-600">{d.quantite} {d.unite}</td>
                      <td className="p-2 text-center">
                        <button onClick={()=>toggleDistribue(d.id,d.distribue)} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.distribue?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>
                          {d.distribue?'✓ Remis':'En attente'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {distributions.length===0 && <tr><td colSpan={4} className="text-center text-slate-400 py-6">Aucun bénéficiaire.</td></tr>}
                </tbody></table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SOUS-MODULE SUIVI SOCIAL ──────────────────────────────────────
function SuiviSocialTab({ foyers, membres }: Props) {
  const [suivis, setSuivis] = useState<SuiviSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtreCategorie, setFiltreCategorie] = useState('');
  const [form, setForm] = useState({ foyer_id:'', membre_id:'', categorie:'', motif:'', niveau_vulnerabilite:'Moyen', recommandations:'' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('suivi_social').select('*').order('date_ouverture', { ascending: false });
    setSuivis((data||[]) as SuiviSocial[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const creer = async () => {
    if (!form.foyer_id||!form.categorie) { alert('Ménage et catégorie obligatoires.'); return; }
    setSaving(true);
    await supabase.from('suivi_social').insert({ ...form, foyer_id:form.foyer_id||null, membre_id:form.membre_id||null, statut:'Actif' });
    setShowForm(false);
    setForm({ foyer_id:'', membre_id:'', categorie:'', motif:'', niveau_vulnerabilite:'Moyen', recommandations:'' });
    await load();
    setSaving(false);
  };

  const VULN_COLOR: Record<string,string> = { 'Faible':'bg-blue-100 text-blue-700','Moyen':'bg-amber-100 text-amber-700','Élevé':'bg-orange-100 text-orange-700','Critique':'bg-red-100 text-red-700' };

  const filtres = suivis.filter(s => !filtreCategorie || s.categorie === filtreCategorie);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Heart className="h-3.5 w-3.5"/>Dossiers de suivi social</h3>
            <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-lg"><Plus className="h-4 w-4"/>Nouveau dossier</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={filtreCategorie} onChange={e=>setFiltreCategorie(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white outline-none">
              <option value="">Toutes les catégories</option>
              {CATS_SUIVI.map(c=><option key={c}>{c}</option>)}
            </select>
            <div className="flex justify-end items-center text-xs text-slate-500 font-semibold">{filtres.length} dossier{filtres.length>1?'s':''}</div>
          </div>
        </div>

        {loading ? <div className="text-center py-10"><Loader2 className="h-6 w-6 text-pink-600 animate-spin mx-auto"/></div>
        : filtres.length === 0 ? <div className="text-center py-12 text-slate-400"><Heart className="h-8 w-8 mx-auto mb-2 opacity-30"/><p className="text-sm font-semibold">Aucun dossier de suivi</p></div>
        : <table className="w-full text-xs"><thead><tr className="bg-slate-50 border-b">
            <th className="p-3 text-left text-slate-500">Ménage</th>
            <th className="p-3 text-left text-slate-500">Catégorie</th>
            <th className="p-3 text-left text-slate-500">Motif</th>
            <th className="p-3 text-center text-slate-500">Vulnérabilité</th>
            <th className="p-3 text-left text-slate-500">Ouverture</th>
            <th className="p-3 text-center text-slate-500">Statut</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {filtres.map(s=>{
              const foyer=foyers.find(f=>f.id===s.foyer_id);
              const chef=membres.find(m=>m.foyer_id===s.foyer_id&&m.is_chef);
              return <tr key={s.id} className="hover:bg-slate-50">
                <td className="p-3"><p className="font-mono text-pink-600 font-bold">{foyer?.code_menage||'—'}</p>{chef&&<p className="text-slate-500">{chef.nom} {chef.prenom}</p>}</td>
                <td className="p-3 text-slate-600">{s.categorie}</td>
                <td className="p-3 text-slate-500 max-w-32 truncate">{s.motif||'—'}</td>
                <td className="p-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${VULN_COLOR[s.niveau_vulnerabilite]||'bg-slate-100'}`}>{s.niveau_vulnerabilite}</span></td>
                <td className="p-3 text-slate-500">{fmt(s.date_ouverture)}</td>
                <td className="p-3 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.statut==='Actif'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{s.statut}</span></td>
              </tr>;
            })}
          </tbody></table>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Nouveau dossier de suivi</h2><button onClick={()=>setShowForm(false)}><X className="h-5 w-5 text-slate-400"/></button></div>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-500 block mb-1">Ménage *</label>
                <select value={form.foyer_id} onChange={e=>setForm({...form,foyer_id:e.target.value,membre_id:''})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                  <option value="">-- Choisir un ménage --</option>{foyers.map(f=><option key={f.id} value={f.id}>{f.code_menage}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Personne concernée</label>
                <select value={form.membre_id} onChange={e=>setForm({...form,membre_id:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                  <option value="">-- Ménage entier --</option>
                  {membres.filter(m=>!form.foyer_id||m.foyer_id===form.foyer_id).map(m=><option key={m.id} value={m.id}>{m.nom} {m.prenom}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Catégorie *</label>
                <select value={form.categorie} onChange={e=>setForm({...form,categorie:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                  <option value="">-- Choisir --</option>{CATS_SUIVI.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Niveau de vulnérabilité</label>
                <select value={form.niveau_vulnerabilite} onChange={e=>setForm({...form,niveau_vulnerabilite:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                  {NIVEAUX_VULN.map(n=><option key={n}>{n}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500 block mb-1">Motif</label><textarea value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none resize-none"/></div>
              <div><label className="text-xs text-slate-500 block mb-1">Recommandations initiales</label><textarea value={form.recommandations} onChange={e=>setForm({...form,recommandations:e.target.value})} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none resize-none"/></div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Annuler</button>
              <button onClick={creer} disabled={saving} className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Ouvrir le dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SOUS-MODULE SMS ───────────────────────────────────────────────
function SMSTab({ foyers, membres }: Props) {
  const [sms, setSms] = useState<SMS[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ objet:'', contenu:'', type_destinataires:'tous', agent:'Agent Fokontany' });

  const MODELES = [
    { label:'Convocation réunion', contenu:'Objet: Convocation à la réunion communautaire\n\nMonsieur/Madame,\nVous êtes convoqué(e) à une réunion communautaire organisée par le Fokontany.\nDate: [DATE] à [HEURE]\nLieu: [LIEU]\nVotre présence est obligatoire.\n\nChef Fokontany' },
    { label:'Distribution d\'aide', contenu:'Vous êtes informé(e) que le Fokontany organise une distribution d\'aide.\nDate: [DATE]\nLieu: [LIEU]\nMerci de vous présenter avec votre pièce d\'identité.\n\nFokontany' },
    { label:'Information générale', contenu:'Le Fokontany vous informe que [MESSAGE].\nPour toute question, contactez le bureau du Fokontany.\n\nChef Fokontany' },
  ];

  const DEST_OPTIONS = [
    { value:'tous', label:'Tous les ménages', nb: foyers.length },
    { value:'chefs', label:'Chefs de ménage seulement', nb: membres.filter(m=>m.is_chef).length },
    { value:'vulnerables', label:'Familles vulnérables', nb: foyers.filter(f=>membres.some(m=>m.foyer_id===f.id&&m.est_vulnerable)).length },
    { value:'adultes', label:'Adultes (18+)', nb: membres.filter(m=>m.date_naissance&&new Date().getFullYear()-new Date(m.date_naissance).getFullYear()>=18).length },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('sms_envoyes').select('*').order('created_at', { ascending: false });
    setSms((data||[]) as SMS[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const envoyer = async () => {
    if (!form.contenu.trim()) { alert('Le contenu du message est obligatoire.'); return; }
    setSaving(true);
    const dest = DEST_OPTIONS.find(d=>d.value===form.type_destinataires);
    await supabase.from('sms_envoyes').insert({ ...form, nb_destinataires: dest?.nb||0, statut:'Envoyé' });
    setShowForm(false);
    setForm({ objet:'', contenu:'', type_destinataires:'tous', agent:'Agent Fokontany' });
    await load();
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Radio className="h-3.5 w-3.5"/>Communication citoyenne</h3>
          <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-lg"><Send className="h-3.5 w-3.5"/>Nouveau message</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 p-4 border-b border-slate-100">
          {DEST_OPTIONS.map(d=>(
            <div key={d.value} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-slate-800">{d.nb}</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{d.label}</p>
            </div>
          ))}
        </div>

        {loading ? <div className="text-center py-10"><Loader2 className="h-6 w-6 text-cyan-600 animate-spin mx-auto"/></div>
        : sms.length === 0 ? <div className="text-center py-12 text-slate-400"><Radio className="h-8 w-8 mx-auto mb-2 opacity-30"/><p className="text-sm font-semibold">Aucun message envoyé</p></div>
        : <table className="w-full text-xs"><thead><tr className="bg-slate-50 border-b">
            <th className="p-3 text-left text-slate-500">Date</th>
            <th className="p-3 text-left text-slate-500">Objet</th>
            <th className="p-3 text-left text-slate-500">Destinataires</th>
            <th className="p-3 text-center text-slate-500">Nb</th>
            <th className="p-3 text-center text-slate-500">Statut</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {sms.map(s=>(
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="p-3 text-slate-500">{fmtDT(s.created_at)}</td>
                <td className="p-3 font-semibold text-slate-800">{s.objet||'(Sans objet)'}</td>
                <td className="p-3 text-slate-500">{DEST_OPTIONS.find(d=>d.value===s.type_destinataires)?.label||s.type_destinataires}</td>
                <td className="p-3 text-center font-semibold text-slate-700">{s.nb_destinataires}</td>
                <td className="p-3 text-center"><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{s.statut}</span></td>
              </tr>
            ))}
          </tbody></table>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Nouveau message</h2><button onClick={()=>setShowForm(false)}><X className="h-5 w-5 text-slate-400"/></button></div>
            <div>
              <label className="text-xs text-slate-500 block mb-2">Modèle rapide</label>
              <div className="flex flex-wrap gap-2">
                {MODELES.map(m=><button key={m.label} onClick={()=>setForm({...form,contenu:m.contenu,objet:m.label})} className="text-xs px-2.5 py-1.5 border border-cyan-300 text-cyan-700 rounded-lg hover:bg-cyan-50">{m.label}</button>)}
              </div>
            </div>
            <div><label className="text-xs text-slate-500 block mb-1">Objet</label><input value={form.objet} onChange={e=>setForm({...form,objet:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
            <div><label className="text-xs text-slate-500 block mb-1">Destinataires *</label>
              <select value={form.type_destinataires} onChange={e=>setForm({...form,type_destinataires:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none">
                {DEST_OPTIONS.map(d=><option key={d.value} value={d.value}>{d.label} ({d.nb} pers.)</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-500 block mb-1">Message *</label><textarea value={form.contenu} onChange={e=>setForm({...form,contenu:e.target.value})} rows={6} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:border-cyan-400"/></div>
            <div><label className="text-xs text-slate-500 block mb-1">Agent</label><input value={form.agent} onChange={e=>setForm({...form,agent:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"/></div>
            <div className="flex gap-3">
              <button onClick={()=>setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">Annuler</button>
              <button onClick={envoyer} disabled={saving||!form.contenu.trim()} className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                {saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TABLEAU DE BORD ───────────────────────────────────────────────
function TableauDeBord() {
  const [stats, setStats] = useState({ doleances:0, mediations:0, evenements:0, campagnes:0, suivis:0, sms:0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ count: d }, { count: e }, { count: c }, { count: s }, { count: sm }] = await Promise.all([
        supabase.from('doleances').select('*', { count:'exact', head:true }).neq('statut','Clôturée'),
        supabase.from('evenements').select('*', { count:'exact', head:true }).in('statut',['Planifié','En cours']),
        supabase.from('campagnes_sociales').select('*', { count:'exact', head:true }).in('statut',['Planifiée','En cours']),
        supabase.from('suivi_social').select('*', { count:'exact', head:true }).eq('statut','Actif'),
        supabase.from('sms_envoyes').select('*', { count:'exact', head:true }),
      ]);
      setStats({ doleances:d||0, mediations:0, evenements:e||0, campagnes:c||0, suivis:s||0, sms:sm||0 });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label:'Doléances ouvertes', val:stats.doleances, color:'bg-rose-50 border-rose-200 text-rose-700', icon:MessageSquare },
    { label:'Événements planifiés', val:stats.evenements, color:'bg-violet-50 border-violet-200 text-violet-700', icon:Calendar },
    { label:'Campagnes actives', val:stats.campagnes, color:'bg-emerald-50 border-emerald-200 text-emerald-700', icon:Gift },
    { label:'Dossiers suivi social', val:stats.suivis, color:'bg-pink-50 border-pink-200 text-pink-700', icon:Heart },
    { label:'Messages envoyés', val:stats.sms, color:'bg-cyan-50 border-cyan-200 text-cyan-700', icon:Radio },
  ];

  return loading ? <div className="text-center py-12"><Loader2 className="h-7 w-7 text-indigo-600 animate-spin mx-auto"/></div>
  : <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
    {cards.map(c => (
      <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
        <c.icon className="h-5 w-5 mb-2 opacity-70"/>
        <p className="text-2xl font-black">{c.val}</p>
        <p className="text-xs font-semibold mt-1 opacity-80">{c.label}</p>
      </div>
    ))}
  </div>;
}

// ── COMPOSANT PRINCIPAL ───────────────────────────────────────────
type Tab = 'dashboard' | 'doleances' | 'evenements' | 'campagnes' | 'suivi' | 'sms';

const TABS: { key: Tab; label: string; icon: any; color: string }[] = [
  { key:'dashboard',  label:'Tableau de bord',    icon:BarChart2,       color:'text-indigo-600' },
  { key:'doleances',  label:'Doléances',           icon:MessageSquare,   color:'text-rose-600' },
  { key:'evenements', label:'Événements',          icon:Calendar,        color:'text-violet-600' },
  { key:'campagnes',  label:'Aides & Distributions',icon:Gift,           color:'text-emerald-600' },
  { key:'suivi',      label:'Suivi social',        icon:Heart,           color:'text-pink-600' },
  { key:'sms',        label:'Communication',       icon:Radio,           color:'text-cyan-600' },
];

export default function VieCommunautaireModule({ foyers, membres }: Props) {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-indigo-600 p-2.5 rounded-xl"><Users className="h-5 w-5 text-white"/></div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Vie Communautaire & Action Sociale</h2>
            <p className="text-xs text-slate-500">Planification, suivi et coordination des activités communautaires</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <t.icon className="h-3.5 w-3.5"/>{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'dashboard'  && <TableauDeBord />}
      {tab === 'doleances'  && <DoleancesTab foyers={foyers} membres={membres}/>}
      {tab === 'evenements' && <EvenementsTab foyers={foyers} membres={membres}/>}
      {tab === 'campagnes'  && <CampagnesSocialesTab foyers={foyers} membres={membres}/>}
      {tab === 'suivi'      && <SuiviSocialTab foyers={foyers} membres={membres}/>}
      {tab === 'sms'        && <SMSTab foyers={foyers} membres={membres}/>}
    </div>
  );
}
