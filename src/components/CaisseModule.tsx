import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import { getConfig } from '../lib/documents';
import {
  Wallet, Search, User, Home, Receipt, Trash2, CheckCircle,
  Loader2, X, Printer, ShoppingCart, Building2, FileText,
  CreditCard, Banknote, Smartphone, ChevronDown, AlertCircle,
  Package
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
const MODES_PAIEMENT = [
  { v: 'Espèces', icon: Banknote },
  { v: 'Mobile Money', icon: Smartphone },
  { v: 'Virement bancaire', icon: CreditCard },
];

const MODULE_COLORS: Record<string, string> = {
  'Documents':     'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Cotisations':   'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Foncier':       'bg-amber-100 text-amber-700 border-amber-200',
  'Légalisation':  'bg-purple-100 text-purple-700 border-purple-200',
  'Patrimoine':    'bg-rose-100 text-rose-700 border-rose-200',
};
const moduleColor = (m: string) => MODULE_COLORS[m] || 'bg-slate-100 text-slate-600 border-slate-200';

interface OperationCaisse {
  id: string;
  module_origine: string;
  type_prestation: string;
  reference_document: string | null;
  membre_id: string | null;
  foyer_id: string | null;
  nom_beneficiaire: string;
  montant: number;
  quantite: number;
  statut: string;
  transaction_id: string | null;
  metadata: any;
  created_at: string;
}

export default function CaisseModule({ foyers, membres }: Props) {
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Recherche usager
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'nom' | 'cin' | 'menage'>('nom');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedUsager, setSelectedUsager] = useState<{ membre?: Membre; foyer?: Foyer } | null>(null);

  // Opérations en attente
  const [operationsEnAttente, setOperationsEnAttente] = useState<OperationCaisse[]>([]);
  const [panier, setPanier] = useState<Set<string>>(new Set());

  // Paiement
  const [modePaiement, setModePaiement] = useState('Espèces');
  const [agent, setAgent] = useState('Agent Fokontany');
  const [validating, setValidating] = useState(false);

  const loadConfig = useCallback(async () => {
    const cfg = await getConfig();
    setConfig(cfg);
  }, []);

  const loadOperations = useCallback(async (usager: { membre?: Membre; foyer?: Foyer } | null) => {
    if (!usager) { setOperationsEnAttente([]); return; }
    setLoading(true);
    let query = supabase.from('operations_caisse').select('*').eq('statut', 'En attente de paiement');
    if (usager.membre) {
      query = query.or(`membre_id.eq.${usager.membre.id},foyer_id.eq.${usager.foyer?.id || usager.membre.foyer_id}`);
    } else if (usager.foyer) {
      query = query.eq('foyer_id', usager.foyer.id);
    }
    const { data } = await query.order('created_at', { ascending: false });
    setOperationsEnAttente((data || []) as OperationCaisse[]);
    setPanier(new Set((data || []).map((o: any) => o.id))); // tout sélectionné par défaut
    setLoading(false);
  }, []);

  useEffect(() => { loadConfig(); setLoading(false); }, [loadConfig]);

  // Résultats de recherche
  const searchResults = (() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const results: { membre?: Membre; foyer?: Foyer; label: string; sub: string }[] = [];

    if (searchMode === 'menage') {
      foyers.filter(f => f.code_menage.toLowerCase().includes(q)).slice(0, 8).forEach(f => {
        const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
        results.push({ foyer: f, label: f.code_menage, sub: chef ? `${chef.nom} ${chef.prenom}` : f.adresse || '' });
      });
    } else if (searchMode === 'cin') {
      membres.filter(m => m.cin && m.cin.toLowerCase().includes(q)).slice(0, 8).forEach(m => {
        const foyer = foyers.find(f => f.id === m.foyer_id);
        results.push({ membre: m, foyer, label: `${m.nom} ${m.prenom}`, sub: `CIN: ${m.cin}` });
      });
    } else {
      membres.filter(m => `${m.nom} ${m.prenom}`.toLowerCase().includes(q)).slice(0, 8).forEach(m => {
        const foyer = foyers.find(f => f.id === m.foyer_id);
        results.push({ membre: m, foyer, label: `${m.nom} ${m.prenom}`, sub: foyer?.code_menage || '' });
      });
    }
    return results;
  })();

  const selectUsager = (u: { membre?: Membre; foyer?: Foyer }) => {
    setSelectedUsager(u);
    setShowSearchResults(false);
    setSearch('');
    loadOperations(u);
  };

  const toggleOperation = (id: string) => {
    setPanier(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const operationsSelectionnees = operationsEnAttente.filter(o => panier.has(o.id));
  const totalAPayer = operationsSelectionnees.reduce((s, o) => s + (o.montant * (o.quantite || 1)), 0);

  // Modules impliqués dans la sélection
  const modulesImpliques = [...new Set(operationsSelectionnees.map(o => o.module_origine))];
  const isUniquementDocuments = modulesImpliques.length === 1 && modulesImpliques[0] === 'Documents';

  const genererNumeroRecu = async (): Promise<string> => {
    const annee = new Date().getFullYear();
    const { data } = await supabase.from('transactions_caisse').select('numero_recu')
      .like('numero_recu', `RC-${annee}-%`).order('created_at', { ascending: false }).limit(1);
    const num = data?.[0]?.numero_recu ? parseInt(data[0].numero_recu.split('-').pop() || '0') + 1 : 1;
    return `RC-${annee}-${String(num).padStart(6, '0')}`;
  };

  const printRecuGlobal = (numeroRecu: string, usagerNom: string, ops: OperationCaisse[], total: number, mode: string, agentNom: string) => {
    const w = window.open('', '_blank', 'width=480,height=650');
    if (!w) return;
    w.document.write(`<html><head><title>Reçu ${numeroRecu}</title><style>
      body{font-family:monospace;font-size:12px;margin:24px;max-width:380px}
      .title{font-size:18px;font-weight:bold;text-align:center}
      .sub{text-align:center;font-size:11px;margin-bottom:14px}
      hr{border:1px dashed #000;margin:10px 0}
      .row{display:flex;justify-content:space-between;margin:4px 0}
      .module{font-size:9px;color:#666;text-transform:uppercase}
      .tot{font-weight:bold;font-size:16px;border-top:2px solid #000;padding-top:10px;margin-top:10px}
      .footer{text-align:center;margin-top:20px;font-size:10px}
    </style></head><body>`);
    w.document.write(`<div class="title">FOKONTANY FANISA</div><div class="sub">REÇU GLOBAL DE PAIEMENT</div><hr>`);
    w.document.write(`<div class="row"><span>N° Reçu:</span><span><strong>${numeroRecu}</strong></span></div>`);
    w.document.write(`<div class="row"><span>Date:</span><span>${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}</span></div>`);
    w.document.write(`<div class="row"><span>Usager:</span><span>${usagerNom}</span></div><hr>`);
    ops.forEach(o => {
      w.document.write(`<div class="module">${o.module_origine}</div>`);
      w.document.write(`<div class="row"><span>${o.type_prestation}</span><span>${new Intl.NumberFormat('fr-MG').format(o.montant * (o.quantite || 1))} Ar</span></div>`);
    });
    w.document.write(`<div class="tot"><div class="row"><span>TOTAL PAYÉ</span><span>${new Intl.NumberFormat('fr-MG').format(total)} Ar</span></div></div>`);
    w.document.write(`<div class="row"><span>Mode de paiement:</span><span>${mode}</span></div>`);
    w.document.write(`<div class="row"><span>Agent caissier:</span><span>${agentNom}</span></div>`);
    w.document.write(`<div class="footer">Généré automatiquement par FANISA — Caisse Centrale<br>Merci pour votre paiement</div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const printJustificatifCertificat = (numeroRecu: string, usagerNom: string, op: OperationCaisse, agentNom: string) => {
    const w = window.open('', '_blank', 'width=400,height=400');
    if (!w) return;
    w.document.write(`<html><head><title>Justificatif</title><style>
      body{font-family:monospace;font-size:12px;margin:20px;max-width:320px}
      .t{font-size:15px;font-weight:bold;text-align:center}
      .s{text-align:center;font-size:10px;margin-bottom:10px}
      hr{border:1px dashed #000;margin:8px 0}
      .r{display:flex;justify-content:space-between;margin:4px 0}
      .f{text-align:center;margin-top:14px;font-size:9px}
    </style></head><body>`);
    w.document.write(`<div class="t">JUSTIFICATIF DE PAIEMENT</div><div class="s">${op.type_prestation}</div><hr>`);
    w.document.write(`<div class="r"><span>Transaction:</span><span>${numeroRecu}</span></div>`);
    w.document.write(`<div class="r"><span>Bénéficiaire:</span><span>${usagerNom}</span></div>`);
    w.document.write(`<div class="r"><span>Date paiement:</span><span>${new Date().toLocaleDateString('fr-FR')}</span></div>`);
    w.document.write(`<div class="r"><span>Montant:</span><span><strong>${new Intl.NumberFormat('fr-MG').format(op.montant)} Ar</strong></span></div>`);
    w.document.write(`<div class="r"><span>Agent:</span><span>${agentNom}</span></div>`);
    w.document.write(`<div class="f">Ce justificatif fait office de preuve de paiement<br>FANISA — Caisse Centrale</div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleValiderPaiement = async () => {
    if (operationsSelectionnees.length === 0 || !selectedUsager) return;
    setValidating(true);

    const numeroRecu = await genererNumeroRecu();
    const usagerNom = selectedUsager.membre
      ? `${selectedUsager.membre.nom} ${selectedUsager.membre.prenom}`
      : (membres.find(m => m.foyer_id === selectedUsager.foyer?.id && m.is_chef)
          ? `${membres.find(m => m.foyer_id === selectedUsager.foyer?.id && m.is_chef)!.nom} ${membres.find(m => m.foyer_id === selectedUsager.foyer?.id && m.is_chef)!.prenom}`
          : selectedUsager.foyer?.code_menage || 'Usager');

    // 1. Créer la transaction
    const { data: transaction } = await supabase.from('transactions_caisse').insert({
      numero_recu: numeroRecu,
      nom_usager: usagerNom,
      membre_id: selectedUsager.membre?.id || null,
      foyer_id: selectedUsager.foyer?.id || selectedUsager.membre?.foyer_id || null,
      montant_total: totalAPayer,
      mode_paiement: modePaiement,
      agent,
      statut: 'Validée',
    }).select().single();

    if (transaction) {
      // 2. Marquer toutes les opérations sélectionnées comme payées
      const ids = operationsSelectionnees.map(o => o.id);
      await supabase.from('operations_caisse').update({
        statut: 'Payé', transaction_id: transaction.id,
      }).in('id', ids);

      // 3. Journal
      await supabase.from('journal_caisse').insert({
        type_evenement: 'validation_paiement',
        transaction_id: transaction.id,
        utilisateur: agent,
        details: { numero_recu: numeroRecu, montant: totalAPayer, nb_operations: ids.length },
      });

      // 4. Impression selon la règle
      if (isUniquementDocuments) {
        // Justificatif par certificat (pas de reçu global)
        operationsSelectionnees.forEach(op => printJustificatifCertificat(numeroRecu, usagerNom, op, agent));
      } else {
        // Reçu global pour tout
        printRecuGlobal(numeroRecu, usagerNom, operationsSelectionnees, totalAPayer, modePaiement, agent);
      }

      // 5. Rafraîchir
      await loadOperations(selectedUsager);
    }
    setValidating(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-emerald-600 p-2.5 rounded-xl"><Wallet className="h-5 w-5 text-white" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Caisse — Facturation & Encaissement</h2>
            <p className="text-xs text-slate-500">Point unique d'encaissement de toutes les prestations FANISA</p>
          </div>
        </div>

        {/* Recherche usager */}
        <div className="flex gap-2 mb-2">
          {([['nom', 'Nom & Prénom', User], ['cin', 'CIN', FileText], ['menage', 'N° Ménage', Home]] as [string, string, any][]).map(([v, l, Icon]) => (
            <button key={v} onClick={() => setSearchMode(v as any)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${searchMode === v ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Icon className="h-3.5 w-3.5" />{l}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSearchResults(true); }}
            onFocus={() => setShowSearchResults(true)}
            placeholder={searchMode === 'cin' ? 'Rechercher par numéro CIN...' : searchMode === 'menage' ? 'Rechercher par code ménage (MEN-001)...' : 'Rechercher par nom et prénom...'}
            className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-emerald-500"
          />
          {showSearchResults && search && (
            <div className="absolute top-full left-0 right-0 z-30 bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-72 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-6">Aucun résultat</p>
              ) : searchResults.map((r, i) => (
                <button key={i} onClick={() => selectUsager(r)} className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-slate-50 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                    {r.label.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{r.label}</p>
                    <p className="text-xs text-slate-400">{r.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Usager sélectionné + opérations */}
      {selectedUsager ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Liste des opérations */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold">
                  {(selectedUsager.membre ? `${selectedUsager.membre.nom} ${selectedUsager.membre.prenom}` : selectedUsager.foyer?.code_menage || '?').charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800">
                    {selectedUsager.membre ? `${selectedUsager.membre.nom} ${selectedUsager.membre.prenom}` : (membres.find(m => m.foyer_id === selectedUsager.foyer?.id && m.is_chef)?.nom || selectedUsager.foyer?.code_menage)}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedUsager.foyer?.code_menage || foyers.find(f => f.id === selectedUsager.membre?.foyer_id)?.code_menage}
                    {selectedUsager.membre?.cin && ` · CIN: ${selectedUsager.membre.cin}`}
                  </p>
                </div>
              </div>
              <button onClick={() => { setSelectedUsager(null); setOperationsEnAttente([]); }} className="text-slate-400 hover:text-red-500"><X className="h-5 w-5" /></button>
            </div>

            {loading ? (
              <div className="text-center py-12"><Loader2 className="h-7 w-7 text-emerald-600 animate-spin mx-auto" /></div>
            ) : operationsEnAttente.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-semibold">Aucune opération en attente</p>
                <p className="text-xs mt-1">Toutes les prestations de cet usager sont réglées.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {operationsEnAttente.map(op => (
                  <label key={op.id} className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition ${panier.has(op.id) ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={panier.has(op.id)} onChange={() => toggleOperation(op.id)} className="w-4 h-4 accent-emerald-600 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${moduleColor(op.module_origine)}`}>{op.module_origine}</span>
                        <p className="text-sm font-semibold text-slate-800">{op.type_prestation}</p>
                      </div>
                      {op.reference_document && <p className="text-[11px] text-slate-400 font-mono mt-0.5">{op.reference_document}</p>}
                    </div>
                    <span className="font-bold text-slate-900 shrink-0">{fmt(op.montant * (op.quantite || 1))}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Panier de validation */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit sticky top-4">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-emerald-600" />Panier ({operationsSelectionnees.length})</h3>

            {operationsSelectionnees.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Sélectionnez au moins une prestation à encaisser.</p>
            ) : (
              <>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {operationsSelectionnees.map(op => (
                    <div key={op.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5">
                      <span className="text-slate-600 truncate">{op.type_prestation}</span>
                      <span className="font-semibold text-slate-800 shrink-0 ml-2">{fmt(op.montant)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-slate-600">TOTAL</span>
                    <span className="text-2xl font-black text-emerald-600">{fmt(totalAPayer)}</span>
                  </div>

                  {!isUniquementDocuments && modulesImpliques.length > 1 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 mb-3 text-[11px] text-purple-700 flex items-start gap-1.5">
                      <Receipt className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      Multi-module : un reçu global sera imprimé en plus des justificatifs.
                    </div>
                  )}
                  {isUniquementDocuments && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-3 text-[11px] text-indigo-700 flex items-start gap-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      Documents uniquement : justificatif intégré à chaque certificat.
                    </div>
                  )}

                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Mode de paiement</label>
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {MODES_PAIEMENT.map(({ v, icon: Icon }) => (
                      <button key={v} onClick={() => setModePaiement(v)} className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-semibold transition ${modePaiement === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                        <Icon className="h-3.5 w-3.5" />{v.split(' ')[0]}
                      </button>
                    ))}
                  </div>

                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Agent caissier</label>
                  <input value={agent} onChange={e => setAgent(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 mb-3" />

                  <button onClick={handleValiderPaiement} disabled={validating} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition">
                    {validating ? <><Loader2 className="h-4 w-4 animate-spin" />Validation…</> : <><Printer className="h-4 w-4" />Valider & Imprimer</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl py-16 text-center">
          <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-semibold">Recherchez un usager pour démarrer l'encaissement</p>
          <p className="text-xs text-slate-400 mt-1">Par nom, CIN ou numéro de ménage</p>
        </div>
      )}
    </div>
  );
}
