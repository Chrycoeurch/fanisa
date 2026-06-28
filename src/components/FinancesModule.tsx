import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, Users, Settings,
  Plus, X, Save, Loader2, Search, ChevronDown, Download,
  CreditCard, Banknote, Smartphone, FileText, CheckCircle,
  AlertCircle, Clock, Gift, BarChart2, RefreshCw, Printer
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

// ── Constantes ────────────────────────────────────────────────
const MODES_PAIEMENT = ['Espèces', 'Mobile Money', 'Virement bancaire'];
const CATEGORIES_DEPENSE = ['Fournitures administratives', 'Entretien des locaux', 'Sécurité', 'Carburant', 'Manifestations communautaires', 'Aides d\'urgence', 'Autres dépenses'];
const SOURCES_DON = ['Commune', 'District', 'Région', 'ONG', 'Association', 'Particulier', 'Autre'];
const TYPES_DON = ['Financier', 'Matériel - Riz', 'Matériel - Huile', 'Matériel - Tôles', 'Matériel - Ciment', 'Matériel - Médicaments', 'Matériel - Scolaire', 'Autre matériel'];
const DOCS_TARIFS = [
  { code: 'CR',  label: 'Certificat de Résidence',       key: 'tarif_cr'  },
  { code: 'CVI', label: 'Certificat de Vie Individuelle', key: 'tarif_cvi' },
  { code: 'CVC', label: 'Certificat de Vie Collective',   key: 'tarif_cvc' },
  { code: 'CEL', label: 'Certificat de Célibat',          key: 'tarif_cel' },
  { code: 'BC',  label: 'Bonne Conduite',                 key: 'tarif_bc'  },
  { code: 'FAS', label: 'Attestation de Travail',         key: 'tarif_fas' },
  { code: 'FFD', label: 'Déclaration de Décès',           key: 'tarif_ffd' },
  { code: 'PCG', label: 'Prise en Charge et Garde',       key: 'tarif_pcg' },
  { code: 'CM',  label: 'Composition du Ménage',          key: 'tarif_cm'  },
  { code: 'FM',  label: 'Fiche Ménage',                   key: 'tarif_fm'  },
  { code: 'JOR', label: 'JOROLAVA',                       key: 'tarif_jor' },
  { code: 'COT', label: "Certificat d'Occupation",        key: 'tarif_cot' },
  { code: 'ADF', label: 'Attestation Détention Foncière', key: 'tarif_adf' },
  { code: 'APB', label: 'Attestation Propriété Bâtiment', key: 'tarif_apb' },
  { code: 'AMV', label: 'Attestation Mise en Valeur',     key: 'tarif_amv' },
  { code: 'FP',  label: 'Fiche Parcellaire',              key: 'tarif_fp'  },
  { code: 'FB',  label: 'Fiche Bâtiment',                 key: 'tarif_fb'  },
  { code: 'DRF', label: 'Demande Régularisation',         key: 'tarif_drf' },
  { code: 'IFT', label: 'Ticket IFT',                     key: 'tarif_ift' },
];

type SubMenu = 'dashboard' | 'encaissement' | 'cotisations' | 'documents' | 'recettes' | 'depenses' | 'caisse' | 'dons' | 'rapports' | 'parametres';

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
const today = () => new Date().toISOString().split('T')[0];

async function genRefRecu(prefixe: string): Promise<string> {
  const annee = new Date().getFullYear();
  const { data } = await supabase.from('encaissements').select('reference').like('reference', `${prefixe}-${annee}-%`).order('created_at', { ascending: false }).limit(1);
  const last = data?.[0]?.reference;
  const num = last ? parseInt(last.split('-').pop() || '0') + 1 : 1;
  return `${prefixe}-${annee}-${String(num).padStart(4, '0')}`;
}

// ── Carte stat ────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: any; color: string; sub?: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
        <Icon className="h-4 w-4 opacity-60" />
      </div>
      <p className="text-xl font-black">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Modal Encaissement ────────────────────────────────────────
function ModalEncaissement({ foyers, membres, config, onClose, onSave }: { foyers: Foyer[]; membres: Membre[]; config: any; onClose: () => void; onSave: () => void }) {
  const [search, setSearch] = useState('');
  const [selectedFoyer, setSelectedFoyer] = useState<Foyer | null>(null);
  const [lignes, setLignes] = useState<any[]>([]);
  const [mode, setMode] = useState('Espèces');
  const [agent, setAgent] = useState('Agent');
  const [saving, setSaving] = useState(false);
  const [showFoyerList, setShowFoyerList] = useState(false);

  const total = lignes.reduce((s, l) => s + (parseFloat(l.montant) || 0), 0);
  const filteredFoyers = foyers.filter(f => {
    const q = search.toLowerCase();
    const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
    return f.code_menage.toLowerCase().includes(q) || (chef ? `${chef.nom} ${chef.prenom}`.toLowerCase().includes(q) : false);
  });

  const addLigne = (categorie: string, description: string, montant: number, periode?: string) => {
    setLignes(prev => [...prev, { categorie, description, montant: montant.toString(), periode: periode || '' }]);
  };

  const handleSave = async () => {
    if (!selectedFoyer || lignes.length === 0 || total <= 0) { alert('Sélectionnez un foyer et ajoutez au moins une prestation.'); return; }
    setSaving(true);
    const chef = membres.find(m => m.foyer_id === selectedFoyer.id && m.is_chef);
    const ref = await genRefRecu(config.prefixe_recu || 'REC');
    const { data: enc } = await supabase.from('encaissements').insert({
      reference: ref, foyer_id: selectedFoyer.id,
      nom_beneficiaire: chef ? `${chef.nom} ${chef.prenom}` : selectedFoyer.code_menage,
      code_menage: selectedFoyer.code_menage,
      montant_total: total, mode_paiement: mode, agent,
    }).select().single();
    if (enc) {
      await supabase.from('encaissement_lignes').insert(lignes.map(l => ({ encaissement_id: enc.id, categorie: l.categorie, description: l.description, montant: parseFloat(l.montant) || 0, periode: l.periode })));
      // Mettre à jour cotisations si applicable
      const cotLignes = lignes.filter(l => l.categorie === 'Cotisation');
      for (const cl of cotLignes) {
        const existing = await supabase.from('cotisations').select('*').eq('foyer_id', selectedFoyer.id).eq('periode', cl.periode).single();
        if (existing.data) {
          const newPaye = (existing.data.montant_paye || 0) + (parseFloat(cl.montant) || 0);
          const statut = newPaye >= existing.data.montant_du ? 'À jour' : 'Paiement partiel';
          await supabase.from('cotisations').update({ montant_paye: newPaye, statut, date_paiement: new Date().toISOString(), encaissement_id: enc.id }).eq('id', existing.data.id);
        } else {
          await supabase.from('cotisations').insert({ foyer_id: selectedFoyer.id, encaissement_id: enc.id, type_cotisation: cl.description, periode: cl.periode, montant_du: parseFloat(cl.montant) || config.cotisation_mensuelle, montant_paye: parseFloat(cl.montant) || 0, statut: 'À jour', date_paiement: new Date().toISOString() });
        }
      }
      // Imprimer reçu
      printRecu({ reference: ref, foyer: selectedFoyer, chef, lignes, total, mode, agent });
    }
    setSaving(false);
    onSave();
  };

  const printRecu = ({ reference, foyer, chef, lignes, total, mode, agent }: any) => {
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return;
    w.document.write(`<html><head><title>Reçu ${reference}</title><style>body{font-family:monospace;font-size:12px;margin:20px;max-width:320px}.title{font-size:16px;font-weight:bold;text-align:center;margin-bottom:8px}.sub{text-align:center;margin-bottom:12px;font-size:11px}hr{border:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:4px 0}.total{font-weight:bold;font-size:14px;border-top:2px solid black;padding-top:8px;margin-top:8px}.footer{text-align:center;margin-top:16px;font-size:10px}</style></head><body>`);
    w.document.write(`<div class="title">FOKONTANY FANISA</div><div class="sub">RECU OFFICIEL</div><hr>`);
    w.document.write(`<div class="row"><span>Ref:</span><span>${reference}</span></div>`);
    w.document.write(`<div class="row"><span>Date:</span><span>${new Date().toLocaleDateString('fr-FR')}</span></div>`);
    w.document.write(`<div class="row"><span>Menage:</span><span>${foyer.code_menage}</span></div>`);
    w.document.write(`<div class="row"><span>Beneficiaire:</span><span>${chef ? `${chef.nom} ${chef.prenom}` : foyer.code_menage}</span></div><hr>`);
    lignes.forEach((l: any) => { w.document.write(`<div class="row"><span>${l.description}${l.periode ? ` (${l.periode})` : ''}</span><span>${new Intl.NumberFormat('fr-MG').format(parseFloat(l.montant))} Ar</span></div>`); });
    w.document.write(`<div class="total"><div class="row"><span>TOTAL</span><span>${new Intl.NumberFormat('fr-MG').format(total)} Ar</span></div></div>`);
    w.document.write(`<div class="row"><span>Paiement:</span><span>${mode}</span></div>`);
    w.document.write(`<div class="row"><span>Agent:</span><span>${agent}</span></div>`);
    w.document.write(`<div class="footer">Genere automatiquement par FANISA<br>Merci pour votre paiement</div>`);
    w.document.write(`</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const periodeActuelle = `${new Date().toLocaleString('fr-FR', { month: 'long' })} ${new Date().getFullYear()}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 p-2 rounded-xl"><Receipt className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Nouvel encaissement</h2>
              <p className="text-xs text-slate-500">Enregistrer un paiement et générer le reçu</p>
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Sélection foyer */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Ménage / Bénéficiaire *</label>
            <div className="relative">
              <input value={search} onChange={e => { setSearch(e.target.value); setShowFoyerList(true); }} onFocus={() => setShowFoyerList(true)} placeholder="Rechercher par code ménage ou nom chef..." className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none ${selectedFoyer ? 'border-green-400 bg-green-50' : 'border-slate-200 focus:border-green-500'}`} />
              {selectedFoyer && (
                <div className="flex items-center justify-between mt-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-mono font-bold text-green-700 text-sm">{selectedFoyer.code_menage}</span>
                    <span className="text-slate-600 text-sm ml-2">{membres.find(m => m.foyer_id === selectedFoyer.id && m.is_chef)?.nom} {membres.find(m => m.foyer_id === selectedFoyer.id && m.is_chef)?.prenom}</span>
                  </div>
                  <button onClick={() => { setSelectedFoyer(null); setSearch(''); }} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                </div>
              )}
              {showFoyerList && !selectedFoyer && search && (
                <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
                  {filteredFoyers.slice(0, 8).map(f => {
                    const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
                    return (
                      <button key={f.id} onClick={() => { setSelectedFoyer(f); setShowFoyerList(false); setSearch(''); }} className="w-full text-left px-3 py-2.5 hover:bg-green-50 text-xs border-b border-slate-50 flex items-center gap-2">
                        <span className="font-mono font-bold text-green-600">{f.code_menage}</span>
                        <span className="text-slate-600">{chef ? `${chef.nom} ${chef.prenom}` : ''}</span>
                        <span className="text-slate-400 ml-auto">{f.adresse || f.fokontany}</span>
                      </button>
                    );
                  })}
                  {filteredFoyers.length === 0 && <p className="text-center text-slate-400 text-xs py-4">Aucun foyer trouvé</p>}
                </div>
              )}
            </div>
          </div>

          {/* Prestations */}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Prestations</label>
            <div className="space-y-3">
              {/* Cotisations rapides */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Cotisations</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: 'Mensuelle', montant: config.cotisation_mensuelle || 5000, periode: periodeActuelle },
                    { label: 'Trimestrielle', montant: config.cotisation_trimestrielle || 14000, periode: `T${Math.ceil((new Date().getMonth()+1)/3)} ${new Date().getFullYear()}` },
                    { label: 'Annuelle', montant: config.cotisation_annuelle || 50000, periode: new Date().getFullYear().toString() },
                  ].map(c => (
                    <button key={c.label} onClick={() => addLigne('Cotisation', `Cotisation ${c.label}`, c.montant, c.periode)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 transition">
                      <Plus className="h-3 w-3" />{c.label} — {fmt(c.montant)}
                    </button>
                  ))}
                </div>
              </div>
              {/* Documents */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Documents administratifs</p>
                <div className="flex gap-2 flex-wrap">
                  {DOCS_TARIFS.slice(0, 10).map(d => (
                    <button key={d.code} onClick={() => addLigne('Document', `[${d.code}] ${d.label}`, config[d.key] || 2000)} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 transition">
                      <Plus className="h-3 w-3" />{d.code} — {fmt(config[d.key] || 2000)}
                    </button>
                  ))}
                  <button onClick={() => addLigne('Document', 'Document foncier', config.tarif_jor || 5000)} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 transition">
                    <Plus className="h-3 w-3" />Foncier
                  </button>
                </div>
              </div>
              {/* Autres */}
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Autres recettes</p>
                <div className="flex gap-2 flex-wrap">
                  {['Amende', 'Frais administratifs', 'Contribution exceptionnelle', 'Recette diverse'].map(r => (
                    <button key={r} onClick={() => addLigne('Autre', r, 0)} className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-medium text-amber-700 transition">
                      <Plus className="h-3 w-3" />{r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Lignes ajoutées */}
          {lignes.length > 0 && (
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Détail de l'encaissement</label>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {lignes.map((l, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-b-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{l.description}</p>
                      {l.periode && <p className="text-xs text-slate-400">{l.periode}</p>}
                    </div>
                    <input type="number" value={l.montant} onChange={e => setLignes(prev => prev.map((x, j) => j === i ? { ...x, montant: e.target.value } : x))} className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-right font-mono outline-none focus:border-green-500" />
                    <span className="text-xs text-slate-400">Ar</span>
                    <button onClick={() => setLignes(prev => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-3 bg-green-50 border-t-2 border-green-200">
                  <span className="font-bold text-slate-700">TOTAL</span>
                  <span className="font-black text-lg text-green-700">{fmt(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Mode paiement & agent */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Mode de paiement</label>
              <div className="flex gap-2">
                {MODES_PAIEMENT.map(m => (
                  <label key={m} className={`flex items-center gap-1 px-3 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition ${mode === m ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                    <input type="radio" className="hidden" checked={mode === m} onChange={() => setMode(m)} />{m}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Agent encaisseur</label>
              <input value={agent} onChange={e => setAgent(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-green-500" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={handleSave} disabled={saving || !selectedFoyer || lignes.length === 0} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Printer className="h-4 w-4" />Encaisser & Imprimer reçu</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────
export default function FinancesModule({ foyers, membres }: Props) {
  const [subMenu, setSubMenu] = useState<SubMenu>('dashboard');
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showEncaissement, setShowEncaissement] = useState(false);

  // Data
  const [encaissements, setEncaissements] = useState<any[]>([]);
  const [lignesMap, setLignesMap] = useState<Record<string, any[]>>({});
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [depenses, setDepenses] = useState<any[]>([]);
  const [dons, setDons] = useState<any[]>([]);

  // Forms
  const [newDepense, setNewDepense] = useState<any>({ categorie: '', description: '', montant: '', beneficiaire: '', agent: 'Agent', notes: '' });
  const [newDon, setNewDon] = useState<any>({ source: '', type_don: 'Financier', description: '', montant: '', affectation: '' });
  const [savingDepense, setSavingDepense] = useState(false);
  const [savingDon, setSavingDon] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cfg, enc, cot, dep, don] = await Promise.all([
      supabase.from('config_finances').select('*').single(),
      supabase.from('encaissements').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('cotisations').select('*').order('created_at', { ascending: false }),
      supabase.from('depenses').select('*').order('created_at', { ascending: false }),
      supabase.from('dons').select('*').order('date_reception', { ascending: false }),
    ]);
    setConfig(cfg.data || {});
    setEncaissements(enc.data || []);
    setCotisations(cot.data || []);
    setDepenses(dep.data || []);
    setDons(don.data || []);

    // Charger lignes pour les encaissements du jour
    if (enc.data?.length) {
      const ids = enc.data.slice(0, 20).map((e: any) => e.id);
      const { data: lignes } = await supabase.from('encaissement_lignes').select('*').in('encaissement_id', ids);
      const map: Record<string, any[]> = {};
      (lignes || []).forEach((l: any) => { if (!map[l.encaissement_id]) map[l.encaissement_id] = []; map[l.encaissement_id].push(l); });
      setLignesMap(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Calculs
  const todayStr = today();
  const recettesJour = encaissements.filter(e => e.created_at?.startsWith(todayStr)).reduce((s, e) => s + (e.montant_total || 0), 0);
  const depensesJour = depenses.filter(d => d.created_at?.startsWith(todayStr)).reduce((s, d) => s + (d.montant || 0), 0);
  const totalRecettes = encaissements.reduce((s, e) => s + (e.montant_total || 0), 0);
  const totalDepenses = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const totalDons = dons.filter(d => d.type_don === 'Financier').reduce((s, d) => s + (d.montant || 0), 0);
  const solde = (config.solde_initial || 0) + totalRecettes + totalDons - totalDepenses;
  const cotAJour = cotisations.filter(c => c.statut === 'À jour').length;
  const cotEnRetard = foyers.length - [...new Set(cotisations.filter(c => c.statut === 'À jour').map(c => c.foyer_id))].length;

  const handleSaveDepense = async () => {
    if (!newDepense.categorie || !newDepense.montant) { alert('Catégorie et montant obligatoires.'); return; }
    setSavingDepense(true);
    const annee = new Date().getFullYear();
    const { data: last } = await supabase.from('depenses').select('reference').like('reference', `DEP-${annee}-%`).order('created_at', { ascending: false }).limit(1);
    const num = last?.[0]?.reference ? parseInt(last[0].reference.split('-').pop() || '0') + 1 : 1;
    await supabase.from('depenses').insert({ ...newDepense, reference: `DEP-${annee}-${String(num).padStart(4, '0')}`, montant: parseFloat(newDepense.montant) });
    setNewDepense({ categorie: '', description: '', montant: '', beneficiaire: '', agent: 'Agent', notes: '' });
    setSavingDepense(false);
    loadAll();
  };

  const handleSaveDon = async () => {
    if (!newDon.source) { alert('Source obligatoire.'); return; }
    setSavingDon(true);
    await supabase.from('dons').insert({ ...newDon, montant: newDon.montant ? parseFloat(newDon.montant) : null });
    setNewDon({ source: '', type_don: 'Financier', description: '', montant: '', affectation: '' });
    setSavingDon(false);
    loadAll();
  };

  const saveConfig = async () => {
    await supabase.from('config_finances').update(config).eq('id', 1);
    alert('Configuration enregistrée !');
  };

  const MENUS: { key: SubMenu; label: string; icon: any }[] = [
    { key: 'dashboard',    label: 'Tableau de bord', icon: BarChart2 },
    { key: 'encaissement', label: 'Encaissements',   icon: Receipt },
    { key: 'cotisations',  label: 'Cotisations',     icon: Users },
    { key: 'depenses',     label: 'Dépenses',        icon: TrendingDown },
    { key: 'caisse',       label: 'Caisse',          icon: Wallet },
    { key: 'dons',         label: 'Dons & Subvent.', icon: Gift },
    { key: 'parametres',   label: 'Paramètres',      icon: Settings },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 p-2.5 rounded-xl"><Wallet className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Finances & Cotisations</h2>
              <p className="text-xs text-slate-500">Gestion financière du Fokontany</p>
            </div>
          </div>
          <button onClick={() => setShowEncaissement(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
            <Plus className="h-4 w-4" />Nouvel encaissement
          </button>
        </div>
        {/* Sous-menus */}
        <div className="flex gap-1 flex-wrap">
          {MENUS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSubMenu(key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${subMenu === key ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-center py-16"><Loader2 className="h-8 w-8 text-green-600 animate-spin mx-auto" /></div> : (
        <>
          {/* ── TABLEAU DE BORD ── */}
          {subMenu === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Solde de caisse" value={fmt(solde)} icon={Wallet} color={solde >= 0 ? 'green' : 'red'} sub="Situation actuelle" />
                <StatCard label="Recettes du jour" value={fmt(recettesJour)} icon={TrendingUp} color="blue" sub={new Date().toLocaleDateString('fr-FR')} />
                <StatCard label="Dépenses du jour" value={fmt(depensesJour)} icon={TrendingDown} color="red" sub={new Date().toLocaleDateString('fr-FR')} />
                <StatCard label="Total cotisations" value={fmt(encaissements.filter(e => lignesMap[e.id]?.some((l:any)=>l.categorie==='Cotisation')).reduce((s,e)=>s+e.montant_total,0))} icon={Users} color="indigo" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Documents délivrés" value={String(encaissements.length)} icon={FileText} color="purple" />
                <StatCard label="Ménages à jour" value={String([...new Set(cotisations.filter(c=>c.statut==='À jour').map(c=>c.foyer_id))].length)} icon={CheckCircle} color="green" />
                <StatCard label="En retard" value={String(cotEnRetard < 0 ? 0 : cotEnRetard)} icon={AlertCircle} color="amber" />
                <StatCard label="Dons reçus" value={fmt(totalDons)} icon={Gift} color="purple" />
              </div>

              {/* Derniers encaissements */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">Derniers encaissements</h3>
                  <button onClick={() => setSubMenu('encaissement')} className="text-xs text-green-600 font-semibold hover:underline">Voir tout</button>
                </div>
                {encaissements.length === 0 ? <p className="text-center text-slate-400 text-sm py-8">Aucun encaissement</p> : (
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50"><th className="p-3 text-left font-semibold text-slate-500">Réf.</th><th className="p-3 text-left font-semibold text-slate-500">Ménage</th><th className="p-3 text-left font-semibold text-slate-500">Bénéficiaire</th><th className="p-3 text-left font-semibold text-slate-500">Montant</th><th className="p-3 text-left font-semibold text-slate-500">Mode</th><th className="p-3 text-left font-semibold text-slate-500">Date</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {encaissements.slice(0, 8).map(e => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-green-600 font-semibold">{e.reference}</td>
                          <td className="p-3 font-mono text-indigo-600">{e.code_menage}</td>
                          <td className="p-3 text-slate-700">{e.nom_beneficiaire}</td>
                          <td className="p-3 font-bold text-slate-900">{fmt(e.montant_total)}</td>
                          <td className="p-3 text-slate-500">{e.mode_paiement}</td>
                          <td className="p-3 text-slate-400">{new Date(e.created_at).toLocaleDateString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── ENCAISSEMENTS ── */}
          {subMenu === 'encaissement' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">Historique des encaissements ({encaissements.length})</h3>
                <button onClick={() => setShowEncaissement(true)} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"><Plus className="h-3.5 w-3.5" />Nouvel encaissement</button>
              </div>
              {encaissements.length === 0 ? <p className="text-center text-slate-400 text-sm py-10">Aucun encaissement enregistré.</p> : (
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="p-3 text-left text-slate-500">Référence</th><th className="p-3 text-left text-slate-500">Ménage</th><th className="p-3 text-left text-slate-500">Bénéficiaire</th><th className="p-3 text-left text-slate-500">Montant</th><th className="p-3 text-left text-slate-500">Paiement</th><th className="p-3 text-left text-slate-500">Date</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {encaissements.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-green-600 font-bold">{e.reference}</td>
                        <td className="p-3 font-mono text-indigo-600">{e.code_menage}</td>
                        <td className="p-3">{e.nom_beneficiaire}</td>
                        <td className="p-3 font-bold text-slate-900">{fmt(e.montant_total)}</td>
                        <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${e.mode_paiement==='Espèces'?'bg-green-100 text-green-700':e.mode_paiement==='Mobile Money'?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>{e.mode_paiement}</span></td>
                        <td className="p-3 text-slate-400">{new Date(e.created_at).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── COTISATIONS ── */}
          {subMenu === 'cotisations' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="À jour" value={String([...new Set(cotisations.filter(c=>c.statut==='À jour').map(c=>c.foyer_id))].length)} icon={CheckCircle} color="green" />
                <StatCard label="Paiement partiel" value={String(cotisations.filter(c=>c.statut==='Paiement partiel').length)} icon={Clock} color="amber" />
                <StatCard label="Non recensés" value={String(Math.max(0, foyers.length - new Set(cotisations.map(c=>c.foyer_id)).size))} icon={AlertCircle} color="red" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700">Suivi des cotisations</h3>
                </div>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="p-3 text-left text-slate-500">Ménage</th><th className="p-3 text-left text-slate-500">Type</th><th className="p-3 text-left text-slate-500">Période</th><th className="p-3 text-left text-slate-500">Dû</th><th className="p-3 text-left text-slate-500">Payé</th><th className="p-3 text-left text-slate-500">Statut</th><th className="p-3 text-left text-slate-500">Date</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {cotisations.map(c => {
                      const foyer = foyers.find(f => f.id === c.foyer_id);
                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-indigo-600">{foyer?.code_menage || '-'}</td>
                          <td className="p-3">{c.type_cotisation}</td>
                          <td className="p-3">{c.periode}</td>
                          <td className="p-3">{fmt(c.montant_du)}</td>
                          <td className="p-3 font-bold">{fmt(c.montant_paye)}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.statut==='À jour'?'bg-green-100 text-green-700':c.statut==='Paiement partiel'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>{c.statut}</span></td>
                          <td className="p-3 text-slate-400">{c.date_paiement ? new Date(c.date_paiement).toLocaleDateString('fr-FR') : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {cotisations.length === 0 && <p className="text-center text-slate-400 text-sm py-8">Aucune cotisation enregistrée.</p>}
              </div>
            </div>
          )}

          {/* ── DÉPENSES ── */}
          {subMenu === 'depenses' && (
            <div className="space-y-4">
              {/* Formulaire nouvelle dépense */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Enregistrer une dépense</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Catégorie *</label>
                    <select value={newDepense.categorie} onChange={e => setNewDepense((p: any) => ({ ...p, categorie: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-red-400">
                      <option value="">Choisir...</option>
                      {CATEGORIES_DEPENSE.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Montant (Ar) *</label>
                    <input type="number" value={newDepense.montant} onChange={e => setNewDepense((p: any) => ({ ...p, montant: e.target.value }))} placeholder="Ex: 15000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-400" />
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                    <input value={newDepense.description} onChange={e => setNewDepense((p: any) => ({ ...p, description: e.target.value }))} placeholder="Détails..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-400" />
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Bénéficiaire</label>
                    <input value={newDepense.beneficiaire} onChange={e => setNewDepense((p: any) => ({ ...p, beneficiaire: e.target.value }))} placeholder="Nom..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-400" />
                  </div>
                </div>
                <button onClick={handleSaveDepense} disabled={savingDepense} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition">
                  {savingDepense ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Save className="h-4 w-4" />Enregistrer la dépense</>}
                </button>
              </div>
              {/* Liste dépenses */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">Historique des dépenses</h3>
                  <span className="text-sm font-bold text-red-600">Total : {fmt(totalDepenses)}</span>
                </div>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="p-3 text-left text-slate-500">Référence</th><th className="p-3 text-left text-slate-500">Catégorie</th><th className="p-3 text-left text-slate-500">Description</th><th className="p-3 text-left text-slate-500">Montant</th><th className="p-3 text-left text-slate-500">Date</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {depenses.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-red-600">{d.reference}</td>
                        <td className="p-3 text-slate-600">{d.categorie}</td>
                        <td className="p-3 text-slate-700">{d.description}</td>
                        <td className="p-3 font-bold text-red-700">{fmt(d.montant)}</td>
                        <td className="p-3 text-slate-400">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {depenses.length === 0 && <p className="text-center text-slate-400 text-sm py-8">Aucune dépense enregistrée.</p>}
              </div>
            </div>
          )}

          {/* ── CAISSE ── */}
          {subMenu === 'caisse' && (
            <div className="space-y-4">
              {/* Situation */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Solde initial" value={fmt(config.solde_initial || 0)} icon={Wallet} color="indigo" />
                <StatCard label="Total recettes" value={fmt(totalRecettes + totalDons)} icon={TrendingUp} color="green" sub={`Dont ${fmt(totalDons)} dons`} />
                <StatCard label="Total dépenses" value={fmt(totalDepenses)} icon={TrendingDown} color="red" />
                <StatCard label="Solde actuel" value={fmt(solde)} icon={Wallet} color={solde >= 0 ? 'green' : 'red'} sub={solde >= 0 ? 'Excédentaire' : 'Déficitaire'} />
              </div>
              {/* Journal */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700">Journal de caisse</h3>
                </div>
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50"><th className="p-3 text-left text-slate-500">Date</th><th className="p-3 text-left text-slate-500">Opération</th><th className="p-3 text-left text-slate-500">Référence</th><th className="p-3 text-right text-green-600">Entrée</th><th className="p-3 text-right text-red-600">Sortie</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...encaissements.map(e => ({ date: e.created_at, label: e.nom_beneficiaire, ref: e.reference, entree: e.montant_total, sortie: 0 })),
                      ...depenses.map(d => ({ date: d.created_at, label: d.categorie, ref: d.reference, entree: 0, sortie: d.montant }))
                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30).map((op, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-400">{new Date(op.date).toLocaleDateString('fr-FR')}</td>
                        <td className="p-3 text-slate-700">{op.label}</td>
                        <td className="p-3 font-mono text-slate-500">{op.ref}</td>
                        <td className="p-3 text-right font-bold text-green-600">{op.entree > 0 ? fmt(op.entree) : ''}</td>
                        <td className="p-3 text-right font-bold text-red-600">{op.sortie > 0 ? fmt(op.sortie) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DONS ── */}
          {subMenu === 'dons' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-700">Enregistrer un don ou une subvention</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Source *</label>
                    <select value={newDon.source} onChange={e => setNewDon((p: any) => ({ ...p, source: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-purple-400">
                      <option value="">Choisir...</option>
                      {SOURCES_DON.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Type</label>
                    <select value={newDon.type_don} onChange={e => setNewDon((p: any) => ({ ...p, type_don: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-purple-400">
                      {TYPES_DON.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Montant (Ar)</label>
                    <input type="number" value={newDon.montant} onChange={e => setNewDon((p: any) => ({ ...p, montant: e.target.value }))} placeholder="Si financier" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Affectation</label>
                    <input value={newDon.affectation} onChange={e => setNewDon((p: any) => ({ ...p, affectation: e.target.value }))} placeholder="Usage prévu..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                  </div>
                  <div className="col-span-2"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                    <input value={newDon.description} onChange={e => setNewDon((p: any) => ({ ...p, description: e.target.value }))} placeholder="Détails du don..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
                  </div>
                </div>
                <button onClick={handleSaveDon} disabled={savingDon} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
                  {savingDon ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Save className="h-4 w-4" />Enregistrer le don</>}
                </button>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">Dons et subventions reçus</h3>
                  <span className="text-sm font-bold text-purple-600">Total financier : {fmt(totalDons)}</span>
                </div>
                {dons.length === 0 ? <p className="text-center text-slate-400 text-sm py-8">Aucun don enregistré.</p> : (
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50"><th className="p-3 text-left text-slate-500">Source</th><th className="p-3 text-left text-slate-500">Type</th><th className="p-3 text-left text-slate-500">Description</th><th className="p-3 text-left text-slate-500">Montant</th><th className="p-3 text-left text-slate-500">Affectation</th><th className="p-3 text-left text-slate-500">Date</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {dons.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-700">{d.source}</td>
                          <td className="p-3"><span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">{d.type_don}</span></td>
                          <td className="p-3 text-slate-600">{d.description}</td>
                          <td className="p-3 font-bold text-purple-700">{d.montant ? fmt(d.montant) : '-'}</td>
                          <td className="p-3 text-slate-500">{d.affectation || '-'}</td>
                          <td className="p-3 text-slate-400">{new Date(d.date_reception).toLocaleDateString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── PARAMÈTRES ── */}
          {subMenu === 'parametres' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Settings className="h-4 w-4" />Paramètres financiers</h3>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Cotisations (Ar)</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[{k:'cotisation_mensuelle',l:'Mensuelle'},{k:'cotisation_trimestrielle',l:'Trimestrielle'},{k:'cotisation_annuelle',l:'Annuelle'}].map(({k,l})=>(
                    <div key={k}><label className="text-xs font-semibold text-slate-500 block mb-1">{l}</label>
                      <input type="number" value={config[k]||''} onChange={e=>setConfig((p:any)=>({...p,[k]:parseFloat(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500" />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Tarifs des documents (Ar)</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {DOCS_TARIFS.map(d => (
                    <div key={d.key}><label className="text-xs font-semibold text-slate-500 block mb-1">[{d.code}] {d.label}</label>
                      <input type="number" value={config[d.key]||''} onChange={e=>setConfig((p:any)=>({...p,[d.key]:parseFloat(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500" />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Paramètres généraux</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Solde initial (Ar)</label>
                    <input type="number" value={config.solde_initial||0} onChange={e=>setConfig((p:any)=>({...p,solde_initial:parseFloat(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500" />
                  </div>
                  <div><label className="text-xs font-semibold text-slate-500 block mb-1">Préfixe des reçus</label>
                    <input value={config.prefixe_recu||'REC'} onChange={e=>setConfig((p:any)=>({...p,prefixe_recu:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 font-mono" />
                  </div>
                </div>
              </div>
              <button onClick={saveConfig} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                <Save className="h-4 w-4" />Enregistrer la configuration
              </button>
            </div>
          )}
        </>
      )}

      {showEncaissement && (
        <ModalEncaissement foyers={foyers} membres={membres} config={config} onClose={() => setShowEncaissement(false)} onSave={() => { setShowEncaissement(false); loadAll(); }} />
      )}
    </div>
  );
}
