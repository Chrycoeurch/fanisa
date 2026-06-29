import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, Users,
  Settings, Save, Loader2, CheckCircle, AlertCircle,
  Clock, Gift, BarChart2, ChevronLeft, ChevronRight,
  Search, Calendar, Printer
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const ANNEE_COURANTE = new Date().getFullYear();
const ANNEES = [ANNEE_COURANTE - 1, ANNEE_COURANTE, ANNEE_COURANTE + 1];

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: any; color: string; sub?: string }) {
  const colors: Record<string, string> = {
    green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
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

type SubMenu = 'dashboard' | 'cotisations' | 'decaissements' | 'dons' | 'parametres';

export default function FinancesModule({ foyers, membres }: Props) {
  const [subMenu, setSubMenu] = useState<SubMenu>('dashboard');
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Data
  const [encaissements, setEncaissements] = useState<any[]>([]);
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [decaissements, setDecaissements] = useState<any[]>([]);
  const [dons, setDons] = useState<any[]>([]);

  // Cotisations UI
  const [anneeSelCot, setAnneeSelCot] = useState(ANNEE_COURANTE);
  const [savingCot, setSavingCot] = useState<string | null>(null);
  const [searchCot, setSearchCot] = useState('');

  // Historique pagination + filtre dates
  const [pageEnc, setPageEnc] = useState(1);
  const [pageDec, setPageDec] = useState(1);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [dateDebutDec, setDateDebutDec] = useState('');
  const [dateFinDec, setDateFinDec] = useState('');
  const PAGE_SIZE = 10;

  // Dépenses (décaissements)
  const [newDec, setNewDec] = useState({ categorie: '', description: '', montant: '', beneficiaire: '', agent: 'Agent' });
  const [savingDec, setSavingDec] = useState(false);
  const CATEGORIES_DEC = ['Fournitures administratives', 'Entretien des locaux', 'Sécurité', 'Carburant', 'Manifestations communautaires', 'Aides d\'urgence', 'Autres'];

  // Dons
  const [newDon, setNewDon] = useState({ source: '', type_don: 'Financier', description: '', montant: '', affectation: '' });
  const [savingDon, setSavingDon] = useState(false);
  const SOURCES_DON = ['Commune', 'District', 'Région', 'ONG', 'Association', 'Particulier', 'Autre'];

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cfg, enc, cot, dec, don] = await Promise.all([
      supabase.from('config_finances').select('*').single(),
      supabase.from('encaissements').select('*, encaissement_lignes(*)').order('created_at', { ascending: false }),
      supabase.from('cotisations').select('*'),
      supabase.from('depenses').select('*').order('created_at', { ascending: false }),
      supabase.from('dons').select('*').order('date_reception', { ascending: false }),
    ]);
    setConfig(cfg.data || {});
    setEncaissements(enc.data || []);
    setCotisations(cot.data || []);
    setDecaissements(dec.data || []);
    setDons(don.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Calculs ───────────────────────────────────────────────
  const totalRecettes = encaissements.reduce((s, e) => s + (e.montant_total || 0), 0);
  const totalDec = decaissements.reduce((s, d) => s + (d.montant || 0), 0);
  const totalDons = dons.filter(d => d.type_don === 'Financier').reduce((s, d) => s + (d.montant || 0), 0);
  const solde = (config.solde_initial || 0) + totalRecettes + totalDons - totalDec;
  const today = new Date().toISOString().split('T')[0];
  const recettesJour = encaissements.filter(e => e.created_at?.startsWith(today)).reduce((s, e) => s + (e.montant_total || 0), 0);
  const decJour = decaissements.filter(d => d.created_at?.startsWith(today)).reduce((s, d) => s + (d.montant || 0), 0);

  // ── Cotisations — grille foyers × mois ───────────────────
  const getCotStatut = (foyerId: string, mois: number): 'paye' | 'non_paye' => {
    const periode = `${MOIS[mois - 1]} ${anneeSelCot}`;
    const found = cotisations.find(c => c.foyer_id === foyerId && c.periode === periode && c.statut === 'À jour');
    return found ? 'paye' : 'non_paye';
  };

  const printRecuCot = (foyer: Foyer, mois: number, annee: number, montant: number, ref: string) => {
    const chef = membres.find(m => m.foyer_id === foyer.id && m.is_chef);
    const periode = `${MOIS[mois - 1]} ${annee}`;
    const w = window.open('', '_blank', 'width=400,height=500');
    if (!w) return;
    w.document.write(`<html><head><title>Reçu ${ref}</title><style>body{font-family:monospace;font-size:12px;margin:20px;max-width:320px}.title{font-size:16px;font-weight:bold;text-align:center}.sub{text-align:center;font-size:11px;margin-bottom:12px}hr{border:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:4px 0}.total{font-weight:bold;font-size:14px;border-top:2px solid #000;padding-top:8px;margin-top:8px}.footer{text-align:center;margin-top:16px;font-size:10px}</style></head><body>`);
    w.document.write(`<div class="title">FOKONTANY FANISA</div><div class="sub">REÇU DE COTISATION</div><hr>`);
    w.document.write(`<div class="row"><span>Réf.:</span><span>${ref}</span></div>`);
    w.document.write(`<div class="row"><span>Date:</span><span>${new Date().toLocaleDateString('fr-FR')}</span></div>`);
    w.document.write(`<div class="row"><span>Ménage:</span><span>${foyer.code_menage}</span></div>`);
    if (chef) w.document.write(`<div class="row"><span>Chef:</span><span>${chef.nom} ${chef.prenom}</span></div>`);
    w.document.write(`<hr><div class="row"><span>Cotisation mensuelle</span><span></span></div>`);
    w.document.write(`<div class="row"><span>Période :</span><span>${periode}</span></div>`);
    w.document.write(`<div class="total"><div class="row"><span>TOTAL</span><span>${new Intl.NumberFormat('fr-MG').format(montant)} Ar</span></div></div>`);
    w.document.write(`<div class="row"><span>Mode:</span><span>Espèces</span></div>`);
    w.document.write(`<div class="footer">Généré automatiquement par FANISA<br>Merci pour votre paiement</div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleCocherCotisation = async (foyer: Foyer, moisNum: number) => {
    const periode = `${MOIS[moisNum - 1]} ${anneeSelCot}`;
    const key = `${foyer.id}-${periode}`;
    const already = cotisations.find(c => c.foyer_id === foyer.id && c.periode === periode && c.statut === 'À jour');
    if (already) return; // déjà payé

    setSavingCot(key);
    const montant = config.cotisation_mensuelle || 5000;

    // Générer référence encaissement
    const annee = new Date().getFullYear();
    const { data: last } = await supabase.from('encaissements').select('reference').like('reference', `${config.prefixe_recu || 'REC'}-${annee}-%`).order('created_at', { ascending: false }).limit(1);
    const num = last?.[0]?.reference ? parseInt(last[0].reference.split('-').pop() || '0') + 1 : 1;
    const ref = `${config.prefixe_recu || 'REC'}-${annee}-${String(num).padStart(4, '0')}`;

    const chef = membres.find(m => m.foyer_id === foyer.id && m.is_chef);
    const { data: enc } = await supabase.from('encaissements').insert({
      reference: ref, foyer_id: foyer.id,
      nom_beneficiaire: chef ? `${chef.nom} ${chef.prenom}` : foyer.code_menage,
      code_menage: foyer.code_menage, montant_total: montant,
      mode_paiement: 'Espèces', agent: 'Agent Fokontany',
    }).select().single();

    if (enc) {
      await supabase.from('encaissement_lignes').insert({
        encaissement_id: enc.id, categorie: 'Cotisation',
        description: `Cotisation Mensuelle`, montant, periode,
      });
      await supabase.from('cotisations').insert({
        foyer_id: foyer.id, encaissement_id: enc.id,
        type_cotisation: 'Mensuelle', periode,
        montant_du: montant, montant_paye: montant,
        statut: 'À jour', date_paiement: new Date().toISOString(),
      });
      printRecuCot(foyer, moisNum, anneeSelCot, montant, ref);
      await loadAll();
    }
    setSavingCot(null);
  };

  const handleDecocherCotisation = async (foyer: Foyer, moisNum: number) => {
    const periode = `${MOIS[moisNum - 1]} ${anneeSelCot}`;
    if (!confirm(`Annuler le paiement de ${periode} pour ${foyer.code_menage} ?`)) return;
    await supabase.from('cotisations').delete().eq('foyer_id', foyer.id).eq('periode', periode);
    await loadAll();
  };

  // ── Historique filtré + paginé ────────────────────────────
  const filteredEnc = encaissements.filter(e => {
    if (dateDebut && e.created_at < dateDebut) return false;
    if (dateFin && e.created_at > dateFin + 'T23:59:59') return false;
    return true;
  });
  const filteredDec = decaissements.filter(d => {
    if (dateDebutDec && d.created_at < dateDebutDec) return false;
    if (dateFinDec && d.created_at > dateFinDec + 'T23:59:59') return false;
    return true;
  });
  const totalPagesEnc = Math.max(1, Math.ceil(filteredEnc.length / PAGE_SIZE));
  const totalPagesDec = Math.max(1, Math.ceil(filteredDec.length / PAGE_SIZE));
  const encPage = filteredEnc.slice((pageEnc - 1) * PAGE_SIZE, pageEnc * PAGE_SIZE);
  const decPage = filteredDec.slice((pageDec - 1) * PAGE_SIZE, pageDec * PAGE_SIZE);

  const handleSaveDec = async () => {
    if (!newDec.categorie || !newDec.montant) { alert('Catégorie et montant obligatoires.'); return; }
    setSavingDec(true);
    const annee = new Date().getFullYear();
    const { data: last } = await supabase.from('depenses').select('reference').like('reference', `DEP-${annee}-%`).order('created_at', { ascending: false }).limit(1);
    const num = last?.[0]?.reference ? parseInt(last[0].reference.split('-').pop() || '0') + 1 : 1;
    await supabase.from('depenses').insert({ ...newDec, reference: `DEP-${annee}-${String(num).padStart(4, '0')}`, montant: parseFloat(newDec.montant) });
    setNewDec({ categorie: '', description: '', montant: '', beneficiaire: '', agent: 'Agent' });
    setSavingDec(false);
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

  const MENUS: { key: SubMenu; label: string; icon: any }[] = [
    { key: 'dashboard',      label: 'Tableau de bord', icon: BarChart2 },
    { key: 'cotisations',    label: 'Cotisations',     icon: Users },
    { key: 'decaissements',  label: 'Décaissements',   icon: TrendingDown },
    { key: 'dons',           label: 'Dons',            icon: Gift },
    { key: 'parametres',     label: 'Paramètres',      icon: Settings },
  ];

  // Foyers filtrés pour cotisations
  const foyersCot = foyers.filter(f => {
    if (!searchCot) return true;
    const q = searchCot.toLowerCase();
    const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
    return f.code_menage.toLowerCase().includes(q) || (chef ? `${chef.nom} ${chef.prenom}`.toLowerCase().includes(q) : false);
  });

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
        </div>
        <div className="flex gap-1 flex-wrap">
          {MENUS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setSubMenu(key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${subMenu === key ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-center py-16"><Loader2 className="h-8 w-8 text-green-600 animate-spin mx-auto" /></div> : <>

      {/* ── TABLEAU DE BORD ── */}
      {subMenu === 'dashboard' && (
        <div className="space-y-4">
          {/* Solde caisse mis en avant */}
          <div className={`rounded-2xl p-6 text-white flex items-center justify-between ${solde >= 0 ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' : 'bg-gradient-to-r from-red-600 to-red-700'}`}>
            <div>
              <p className="text-sm opacity-80 font-semibold uppercase tracking-wider">Solde de caisse</p>
              <p className="text-4xl font-black mt-1">{fmt(Math.abs(solde))}</p>
              <p className="text-sm opacity-70 mt-1">{solde >= 0 ? 'Excédentaire' : 'Déficitaire'} · Solde initial : {fmt(config.solde_initial || 0)}</p>
            </div>
            <Wallet className="h-16 w-16 opacity-20" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Recettes du jour" value={fmt(recettesJour)} icon={TrendingUp} color="green" sub={new Date().toLocaleDateString('fr-FR')} />
            <StatCard label="Dépenses du jour" value={fmt(decJour)} icon={TrendingDown} color="red" sub={new Date().toLocaleDateString('fr-FR')} />
            <StatCard label="Total recettes" value={fmt(totalRecettes)} icon={TrendingUp} color="indigo" sub={`${encaissements.length} encaissements`} />
            <StatCard label="Total dépenses" value={fmt(totalDec)} icon={TrendingDown} color="amber" sub={`${decaissements.length} opérations`} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Dons reçus" value={fmt(totalDons)} icon={Gift} color="purple" sub={`${dons.length} dons`} />
            <StatCard label="Ménages à jour" value={String([...new Set(cotisations.filter(c => c.statut === 'À jour').map(c => c.foyer_id))].length)} icon={CheckCircle} color="green" sub="cotisation mensuelle" />
            <StatCard label="Non payés" value={String(Math.max(0, foyers.length - [...new Set(cotisations.filter(c => c.statut === 'À jour').map(c => c.foyer_id))].length))} icon={AlertCircle} color="red" sub="ce mois" />
          </div>

          {/* Historique encaissements */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Receipt className="h-4 w-4 text-green-600" />Derniers encaissements</h3>
              <button onClick={() => setSubMenu('cotisations')} className="text-xs text-green-600 font-semibold hover:underline">Gérer les cotisations →</button>
            </div>
            {encaissements.length === 0 ? <p className="text-center text-slate-400 text-sm py-6">Aucun encaissement</p> : (
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50"><th className="p-3 text-left font-semibold text-slate-500">Référence</th><th className="p-3 text-left font-semibold text-slate-500">Ménage</th><th className="p-3 text-left font-semibold text-slate-500">Bénéficiaire</th><th className="p-3 text-left font-semibold text-slate-500">Montant</th><th className="p-3 text-left font-semibold text-slate-500">Date</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {encaissements.slice(0, 10).map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-green-600 font-semibold">{e.reference}</td>
                      <td className="p-3 font-mono text-indigo-600">{e.code_menage}</td>
                      <td className="p-3 text-slate-700">{e.nom_beneficiaire}</td>
                      <td className="p-3 font-bold text-slate-900">{fmt(e.montant_total)}</td>
                      <td className="p-3 text-slate-400">{new Date(e.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── COTISATIONS — Grille foyers × mois ── */}
      {subMenu === 'cotisations' && (
        <div className="space-y-4">
          {/* Contrôles */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Année :</span>
              <div className="flex gap-1">
                {ANNEES.map(a => (
                  <button key={a} onClick={() => setAnneeSelCot(a)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${anneeSelCot === a ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{a}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-48">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input value={searchCot} onChange={e => setSearchCot(e.target.value)} placeholder="Rechercher un foyer..." className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500" />
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-emerald-500 inline-block" />Payé</span>
              <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-slate-100 border border-slate-200 inline-block" />Non payé</span>
            </div>
            <span className="text-xs text-slate-400 font-semibold ml-auto">Cotisation : {fmt(config.cotisation_mensuelle || 5000)}/mois</span>
          </div>

          {/* Grille */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800">
                  <th className="p-3 text-left font-semibold text-white sticky left-0 bg-slate-800 z-20 min-w-40">Ménage / Chef</th>
                  {MOIS.map((m, i) => (
                    <th key={m} className="p-2 text-center font-semibold text-white min-w-16">
                      <span className={`${new Date().getMonth() === i && new Date().getFullYear() === anneeSelCot ? 'text-emerald-300' : ''}`}>{m.slice(0, 3)}</span>
                    </th>
                  ))}
                  <th className="p-3 text-center font-semibold text-white min-w-16">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {foyersCot.length === 0 ? (
                  <tr><td colSpan={14} className="text-center text-slate-400 py-8">Aucun foyer trouvé</td></tr>
                ) : foyersCot.map((foyer, fi) => {
                  const chef = membres.find(m => m.foyer_id === foyer.id && m.is_chef);
                  const nbPayes = MOIS.filter((_, mi) => getCotStatut(foyer.id, mi + 1) === 'paye').length;
                  return (
                    <tr key={foyer.id} className={`hover:bg-slate-50 ${fi % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      <td className={`p-3 sticky left-0 z-10 ${fi % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-r border-slate-100`}>
                        <p className="font-mono font-bold text-indigo-600 text-xs">{foyer.code_menage}</p>
                        <p className="text-slate-600 text-[11px] truncate max-w-36">{chef ? `${chef.nom} ${chef.prenom}` : foyer.adresse || '—'}</p>
                      </td>
                      {MOIS.map((moisNom, mi) => {
                        const moisNum = mi + 1;
                        const statut = getCotStatut(foyer.id, moisNum);
                        const key = `${foyer.id}-${moisNom} ${anneeSelCot}`;
                        const isSaving = savingCot === key;
                        const isFutur = anneeSelCot > new Date().getFullYear() || (anneeSelCot === new Date().getFullYear() && moisNum > new Date().getMonth() + 1);
                        return (
                          <td key={moisNom} className="p-1 text-center">
                            {isFutur ? (
                              <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 inline-flex items-center justify-center text-slate-300 text-[10px]">—</span>
                            ) : isSaving ? (
                              <span className="w-8 h-8 rounded-lg bg-emerald-100 inline-flex items-center justify-center"><Loader2 className="h-4 w-4 text-emerald-500 animate-spin" /></span>
                            ) : statut === 'paye' ? (
                              <button onClick={() => handleDecocherCotisation(foyer, moisNum)} className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 inline-flex items-center justify-center transition" title={`${moisNom} — Annuler`}>
                                <CheckCircle className="h-4 w-4 text-white" />
                              </button>
                            ) : (
                              <button onClick={() => handleCocherCotisation(foyer, moisNum)} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-emerald-100 border border-slate-200 hover:border-emerald-300 inline-flex items-center justify-center transition" title={`${moisNom} — Marquer payé`}>
                                <span className="text-slate-400 hover:text-emerald-500 font-bold text-sm">+</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${nbPayes === 12 ? 'bg-emerald-100 text-emerald-700' : nbPayes > 0 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{nbPayes}/12</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Ligne totaux */}
              <tfoot className="sticky bottom-0">
                <tr className="bg-slate-800 border-t-2 border-slate-600">
                  <td className="p-3 text-white font-bold text-xs sticky left-0 bg-slate-800 z-10">Total payés</td>
                  {MOIS.map((moisNom, mi) => {
                    const count = foyers.filter(f => getCotStatut(f.id, mi + 1) === 'paye').length;
                    return (
                      <td key={moisNom} className="p-2 text-center">
                        <span className={`text-xs font-bold ${count > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>{count}</span>
                      </td>
                    );
                  })}
                  <td className="p-2 text-center text-white font-bold text-xs">{[...new Set(cotisations.filter(c => c.statut === 'À jour' && c.periode?.includes(anneeSelCot.toString())).map(c => c.foyer_id))].length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── DÉCAISSEMENTS ── */}
      {subMenu === 'decaissements' && (
        <div className="space-y-4">
          {/* Formulaire */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-700">Enregistrer un décaissement</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Catégorie *</label>
                <select value={newDec.categorie} onChange={e => setNewDec(p => ({ ...p, categorie: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-red-400">
                  <option value="">Choisir...</option>
                  {CATEGORIES_DEC.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Montant (Ar) *</label>
                <input type="number" value={newDec.montant} onChange={e => setNewDec(p => ({ ...p, montant: e.target.value }))} placeholder="Ex: 15000" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                <input value={newDec.description} onChange={e => setNewDec(p => ({ ...p, description: e.target.value }))} placeholder="Détails..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Bénéficiaire</label>
                <input value={newDec.beneficiaire} onChange={e => setNewDec(p => ({ ...p, beneficiaire: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-400" />
              </div>
            </div>
            <button onClick={handleSaveDec} disabled={savingDec} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
              {savingDec ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Save className="h-4 w-4" />Enregistrer le décaissement</>}
            </button>
          </div>

          {/* Filtre dates */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 flex-wrap">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">Du</label>
              <input type="date" value={dateDebutDec} onChange={e => { setDateDebutDec(e.target.value); setPageDec(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-red-400" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">Au</label>
              <input type="date" value={dateFinDec} onChange={e => { setDateFinDec(e.target.value); setPageDec(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-red-400" />
            </div>
            {(dateDebutDec || dateFinDec) && <button onClick={() => { setDateDebutDec(''); setDateFinDec(''); }} className="text-xs text-slate-500 hover:text-red-500 font-semibold">✕ Effacer</button>}
            <span className="ml-auto text-xs text-slate-400">{filteredDec.length} résultat{filteredDec.length > 1 ? 's' : ''} · Total : <strong className="text-red-600">{fmt(filteredDec.reduce((s, d) => s + (d.montant || 0), 0))}</strong></span>
          </div>

          {/* Tableau + pagination */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b"><th className="p-3 text-left text-slate-500">Référence</th><th className="p-3 text-left text-slate-500">Catégorie</th><th className="p-3 text-left text-slate-500">Description</th><th className="p-3 text-left text-slate-500">Bénéficiaire</th><th className="p-3 text-right text-slate-500">Montant</th><th className="p-3 text-left text-slate-500">Date</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {decPage.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-red-600 font-semibold">{d.reference}</td>
                    <td className="p-3 text-slate-600">{d.categorie}</td>
                    <td className="p-3 text-slate-700">{d.description}</td>
                    <td className="p-3 text-slate-500">{d.beneficiaire}</td>
                    <td className="p-3 text-right font-bold text-red-700">{fmt(d.montant)}</td>
                    <td className="p-3 text-slate-400">{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
                {decPage.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">Aucun décaissement</td></tr>}
              </tbody>
            </table>
            {totalPagesDec > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <button onClick={() => setPageDec(p => Math.max(1, p - 1))} disabled={pageDec === 1} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Précédent</button>
                <span className="text-xs text-slate-500">Page {pageDec} / {totalPagesDec}</span>
                <button onClick={() => setPageDec(p => Math.min(totalPagesDec, p + 1))} disabled={pageDec === totalPagesDec} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40">Suivant<ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
          </div>

          {/* Historique encaissements ici aussi */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-600" />Historique des encaissements</h4>
            <div className="flex items-center gap-4 flex-wrap mb-3">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500">Du</label>
                <input type="date" value={dateDebut} onChange={e => { setDateDebut(e.target.value); setPageEnc(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-green-400" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500">Au</label>
                <input type="date" value={dateFin} onChange={e => { setDateFin(e.target.value); setPageEnc(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-green-400" />
              </div>
              {(dateDebut || dateFin) && <button onClick={() => { setDateDebut(''); setDateFin(''); }} className="text-xs text-slate-500 hover:text-red-500 font-semibold">✕ Effacer</button>}
              <span className="ml-auto text-xs text-slate-400">{filteredEnc.length} résultat{filteredEnc.length > 1 ? 's' : ''} · Total : <strong className="text-green-600">{fmt(filteredEnc.reduce((s, e) => s + (e.montant_total || 0), 0))}</strong></span>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b"><th className="p-3 text-left text-slate-500">Référence</th><th className="p-3 text-left text-slate-500">Ménage</th><th className="p-3 text-left text-slate-500">Bénéficiaire</th><th className="p-3 text-right text-slate-500">Montant</th><th className="p-3 text-left text-slate-500">Mode</th><th className="p-3 text-left text-slate-500">Date</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {encPage.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-green-600 font-semibold">{e.reference}</td>
                    <td className="p-3 font-mono text-indigo-600">{e.code_menage}</td>
                    <td className="p-3 text-slate-700">{e.nom_beneficiaire}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{fmt(e.montant_total)}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${e.mode_paiement === 'Espèces' ? 'bg-green-100 text-green-700' : e.mode_paiement === 'Mobile Money' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{e.mode_paiement}</span></td>
                    <td className="p-3 text-slate-400">{new Date(e.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
                {encPage.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-6">Aucun encaissement</td></tr>}
              </tbody>
            </table>
            {totalPagesEnc > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50 mt-0">
                <button onClick={() => setPageEnc(p => Math.max(1, p - 1))} disabled={pageEnc === 1} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Précédent</button>
                <span className="text-xs text-slate-500">Page {pageEnc} / {totalPagesEnc}</span>
                <button onClick={() => setPageEnc(p => Math.min(totalPagesEnc, p + 1))} disabled={pageEnc === totalPagesEnc} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40">Suivant<ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DONS ── */}
      {subMenu === 'dons' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-700">Enregistrer un don / subvention</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Source *</label>
                <select value={newDon.source} onChange={e => setNewDon(p => ({ ...p, source: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-purple-400">
                  <option value="">Choisir...</option>
                  {SOURCES_DON.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Montant (Ar)</label>
                <input type="number" value={newDon.montant} onChange={e => setNewDon(p => ({ ...p, montant: e.target.value }))} placeholder="Si financier" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none" />
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Description</label>
                <input value={newDon.description} onChange={e => setNewDon(p => ({ ...p, description: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none" />
              </div>
              <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Affectation</label>
                <input value={newDon.affectation} onChange={e => setNewDon(p => ({ ...p, affectation: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none" />
              </div>
            </div>
            <button onClick={handleSaveDon} disabled={savingDon} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
              {savingDon ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Save className="h-4 w-4" />Enregistrer</>}
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Dons et subventions ({dons.length})</h3>
              <span className="text-sm font-bold text-purple-600">Total : {fmt(totalDons)}</span>
            </div>
            {dons.length === 0 ? <p className="text-center text-slate-400 text-sm py-8">Aucun don enregistré.</p> : (
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50 border-b"><th className="p-3 text-left text-slate-500">Source</th><th className="p-3 text-left text-slate-500">Description</th><th className="p-3 text-right text-slate-500">Montant</th><th className="p-3 text-left text-slate-500">Affectation</th><th className="p-3 text-left text-slate-500">Date</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {dons.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-700">{d.source}</td>
                      <td className="p-3 text-slate-600">{d.description}</td>
                      <td className="p-3 text-right font-bold text-purple-700">{d.montant ? fmt(d.montant) : '-'}</td>
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
          <h3 className="text-sm font-bold text-slate-700">⚙️ Paramètres financiers</h3>
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
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-500 block mb-1">Solde initial (Ar)</label>
              <input type="number" value={config.solde_initial||0} onChange={e=>setConfig((p:any)=>({...p,solde_initial:parseFloat(e.target.value)}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500" />
            </div>
            <div><label className="text-xs font-semibold text-slate-500 block mb-1">Préfixe des reçus</label>
              <input value={config.prefixe_recu||'REC'} onChange={e=>setConfig((p:any)=>({...p,prefixe_recu:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 font-mono" />
            </div>
          </div>
          <button onClick={async()=>{await supabase.from('config_finances').update(config).eq('id',1);alert('Configuration enregistrée !');}} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
            <Save className="h-4 w-4" />Enregistrer
          </button>
        </div>
      )}
      </>}
    </div>
  );
}
