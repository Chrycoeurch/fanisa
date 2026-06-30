import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Foyer, Membre } from '../types';
import { getConfig } from '../lib/documents';
import {
  Wallet, Search, User, Home, Receipt, Trash2, CheckCircle,
  Loader2, X, Printer, ShoppingCart, Building2, FileText,
  CreditCard, Banknote, Smartphone, ChevronDown, ChevronLeft, ChevronRight, AlertCircle,
  Package, BarChart2, Clock, Calendar, RotateCcw, Filter, Users, Hourglass
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; onDataChange?: () => void; }

const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';
const PAGE_SIZE = 10;
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
const MODE_COLORS: Record<string, string> = {
  'Espèces': 'bg-green-100 text-green-700',
  'Mobile Money': 'bg-blue-100 text-blue-700',
  'Virement bancaire': 'bg-purple-100 text-purple-700',
};

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

interface TransactionCaisse {
  id: string;
  numero_recu: string;
  nom_usager: string;
  membre_id: string | null;
  foyer_id: string | null;
  montant_total: number;
  mode_paiement: string;
  agent: string;
  statut: string;
  motif_annulation: string | null;
  annule_par: string | null;
  annule_le: string | null;
  created_at: string;
}

type CaisseTab = 'encaissement' | 'historique' | 'statistiques';

export default function CaisseModule({ foyers, membres, onDataChange }: Props) {
  const [tab, setTab] = useState<CaisseTab>('encaissement');
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // ── Recherche usager (Encaissement) ──────────────────────────
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'nom' | 'cin' | 'menage'>('nom');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedUsager, setSelectedUsager] = useState<{ membre?: Membre; foyer?: Foyer } | null>(null);
  const [operationsEnAttente, setOperationsEnAttente] = useState<OperationCaisse[]>([]);
  const [panier, setPanier] = useState<Set<string>>(new Set());
  const [modePaiement, setModePaiement] = useState('Espèces');
  const [agent, setAgent] = useState('Agent Fokontany');
  const [validating, setValidating] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditMotif, setCreditMotif] = useState('');
  const [creditDateLimite, setCreditDateLimite] = useState('');
  const [creditResponsable, setCreditResponsable] = useState('');
  const [creditProcessing, setCreditProcessing] = useState(false);

  // ── Historique des transactions ───────────────────────────────
  const [transactions, setTransactions] = useState<TransactionCaisse[]>([]);
  const [loadingHisto, setLoadingHisto] = useState(false);
  const [pageHisto, setPageHisto] = useState(1);
  const [filtreModule, setFiltreModule] = useState('');
  const [filtreAgent, setFiltreAgent] = useState('');
  const [filtreMode, setFiltreMode] = useState('');
  const [filtreUsager, setFiltreUsager] = useState('');
  const [filtreRecu, setFiltreRecu] = useState('');
  const [filtreDateDebut, setFiltreDateDebut] = useState('');
  const [filtreDateFin, setFiltreDateFin] = useState('');
  const [transactionModules, setTransactionModules] = useState<Record<string, string[]>>({});
  const [transactionNbOps, setTransactionNbOps] = useState<Record<string, number>>({});

  // Annulation
  const [showAnnulModal, setShowAnnulModal] = useState<TransactionCaisse | null>(null);
  const [motifAnnulation, setMotifAnnulation] = useState('');
  const [annulePar, setAnnulePar] = useState('Agent Fokontany');
  const [annulingId, setAnnulingId] = useState<string | null>(null);

  // ── Statistiques ───────────────────────────────────────────────
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsTransactions, setStatsTransactions] = useState<TransactionCaisse[]>([]);
  const [statsOperations, setStatsOperations] = useState<OperationCaisse[]>([]);

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
    setPanier(new Set((data || []).map((o: any) => o.id)));
    setLoading(false);
  }, []);

  // Charge TOUTES les opérations en attente, tous usagers confondus (vue tableau)
  const [toutesOperationsAttente, setToutesOperationsAttente] = useState<OperationCaisse[]>([]);
  const [loadingToutes, setLoadingToutes] = useState(false);
  const loadToutesOperations = useCallback(async () => {
    setLoadingToutes(true);
    const { data } = await supabase.from('operations_caisse').select('*').eq('statut', 'En attente de paiement').order('created_at', { ascending: false });
    setToutesOperationsAttente((data || []) as OperationCaisse[]);
    setLoadingToutes(false);
  }, []);

  const loadHistorique = useCallback(async () => {
    setLoadingHisto(true);
    const { data } = await supabase.from('transactions_caisse').select('*').order('created_at', { ascending: false });
    const txs = (data || []) as TransactionCaisse[];
    setTransactions(txs);
    // Charger les modules + nb opérations par transaction
    if (txs.length > 0) {
      const ids = txs.map(t => t.id);
      const { data: ops } = await supabase.from('operations_caisse').select('transaction_id, module_origine').in('transaction_id', ids);
      const modMap: Record<string, Set<string>> = {};
      const cntMap: Record<string, number> = {};
      (ops || []).forEach((o: any) => {
        if (!modMap[o.transaction_id]) modMap[o.transaction_id] = new Set();
        modMap[o.transaction_id].add(o.module_origine);
        cntMap[o.transaction_id] = (cntMap[o.transaction_id] || 0) + 1;
      });
      const modResult: Record<string, string[]> = {};
      Object.entries(modMap).forEach(([k, v]) => { modResult[k] = [...v]; });
      setTransactionModules(modResult);
      setTransactionNbOps(cntMap);
    }
    setLoadingHisto(false);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const [{ data: txs }, { data: ops }] = await Promise.all([
      supabase.from('transactions_caisse').select('*').eq('statut', 'Validée'),
      supabase.from('operations_caisse').select('*').eq('statut', 'Payé'),
    ]);
    setStatsTransactions((txs || []) as TransactionCaisse[]);
    setStatsOperations((ops || []) as OperationCaisse[]);
    setStatsLoading(false);
  }, []);

  useEffect(() => { loadConfig(); setLoading(false); }, [loadConfig]);
  useEffect(() => { if (tab === 'encaissement' && !selectedUsager) loadToutesOperations(); }, [tab, selectedUsager, loadToutesOperations]);
  useEffect(() => { if (tab === 'historique') loadHistorique(); }, [tab, loadHistorique]);
  useEffect(() => { if (tab === 'statistiques') loadStats(); }, [tab, loadStats]);

  // ── Recherche usager ───────────────────────────────────────────
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
    setPanier(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const operationsSelectionnees = operationsEnAttente.filter(o => panier.has(o.id));

  // Groupement de toutes les opérations en attente par usager (foyer ou membre)
  const groupesParUsager = (() => {
    const groupes = new Map<string, { membre?: Membre; foyer?: Foyer; nom: string; ops: OperationCaisse[]; total: number }>();
    toutesOperationsAttente.forEach(op => {
      const key = op.membre_id || op.foyer_id || op.nom_beneficiaire;
      if (!groupes.has(key)) {
        const membre = op.membre_id ? membres.find(m => m.id === op.membre_id) : undefined;
        const foyer = op.foyer_id ? foyers.find(f => f.id === op.foyer_id) : (membre ? foyers.find(f => f.id === membre.foyer_id) : undefined);
        groupes.set(key, { membre, foyer, nom: op.nom_beneficiaire, ops: [], total: 0 });
      }
      const g = groupes.get(key)!;
      g.ops.push(op);
      g.total += op.montant * (op.quantite || 1);
    });
    return [...groupes.values()].sort((a, b) => b.ops.length - a.ops.length);
  })();
  const totalAPayer = operationsSelectionnees.reduce((s, o) => s + (o.montant * (o.quantite || 1)), 0);
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
      const qte = o.quantite || 1;
      const label = qte > 1 ? `${o.type_prestation} (${new Intl.NumberFormat('fr-MG').format(o.montant)} × ${qte})` : o.type_prestation;
      w.document.write(`<div class="row"><span>${label}</span><span>${new Intl.NumberFormat('fr-MG').format(o.montant * qte)} Ar</span></div>`);
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
    if ((op.quantite || 1) > 1) {
      w.document.write(`<div class="r"><span>Prix unitaire:</span><span>${new Intl.NumberFormat('fr-MG').format(op.montant)} Ar</span></div>`);
      w.document.write(`<div class="r"><span>Quantité:</span><span>× ${op.quantite}</span></div>`);
    }
    w.document.write(`<div class="r"><span>Montant:</span><span><strong>${new Intl.NumberFormat('fr-MG').format(op.montant * (op.quantite || 1))} Ar</strong></span></div>`);
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

    const { data: transaction, error: errTransaction } = await supabase.from('transactions_caisse').insert({
      numero_recu: numeroRecu, nom_usager: usagerNom,
      membre_id: selectedUsager.membre?.id || null,
      foyer_id: selectedUsager.foyer?.id || selectedUsager.membre?.foyer_id || null,
      montant_total: totalAPayer, mode_paiement: modePaiement, agent, statut: 'Validée',
    }).select().single();

    if (errTransaction || !transaction) {
      console.error('Erreur création transaction_caisse:', errTransaction);
      alert(`Échec de la validation du paiement.\n\n${errTransaction?.message || 'Erreur inconnue.'}`);
      setValidating(false);
      return;
    }

    {
      const ids = operationsSelectionnees.map(o => o.id);
      const { error: errUpdateOps } = await supabase.from('operations_caisse').update({ statut: 'Payé', transaction_id: transaction.id }).in('id', ids);
      if (errUpdateOps) console.error('Erreur mise à jour operations_caisse:', errUpdateOps);
      // Mettre à jour les demandes de documents liées (module Documents)
      const demandeIds = operationsSelectionnees.filter(o => o.metadata?.demande_document_id).map(o => o.metadata.demande_document_id);
      if (demandeIds.length > 0) {
        const { error: errUpdateDemandes } = await supabase.from('demandes_documents').update({ statut: 'Payé', transaction_id: transaction.id }).in('id', demandeIds);
        if (errUpdateDemandes) { console.error('Erreur mise à jour demandes_documents:', errUpdateDemandes); alert(`Le paiement a été validé mais la mise à jour des demandes de documents a échoué.\n\n${errUpdateDemandes.message}\n\nContactez le support technique.`); }
      }
      // Mettre à jour les cotisations liées (module Cotisations) — passage en statut "À jour"
      const cotisationsAMettreAJour = operationsSelectionnees.filter(o => o.module_origine === 'Cotisations' && o.foyer_id && o.metadata?.periode);
      for (const op of cotisationsAMettreAJour) {
        const { error: errUpdateCot } = await supabase.from('cotisations')
          .update({ statut: 'À jour', montant_paye: op.montant * (op.quantite || 1), date_paiement: new Date().toISOString() })
          .eq('foyer_id', op.foyer_id)
          .eq('periode', op.metadata.periode);
        if (errUpdateCot) { console.error('Erreur mise à jour cotisations:', errUpdateCot); alert(`Le paiement a été validé mais la mise à jour de la cotisation a échoué.\n\n${errUpdateCot.message}\n\nContactez le support technique.`); }
      }
      await supabase.from('journal_caisse').insert({
        type_evenement: 'validation_paiement', transaction_id: transaction.id, utilisateur: agent,
        details: { numero_recu: numeroRecu, montant: totalAPayer, nb_operations: ids.length, poste: navigator.userAgent.slice(0, 60) },
      });
      if (isUniquementDocuments) {
        operationsSelectionnees.forEach(op => printJustificatifCertificat(numeroRecu, usagerNom, op, agent));
      } else {
        printRecuGlobal(numeroRecu, usagerNom, operationsSelectionnees, totalAPayer, modePaiement, agent);
      }
      await loadOperations(selectedUsager); await loadToutesOperations(); onDataChange?.();
    }
    setValidating(false);
  };

  // ── Délivrance à crédit (réservée — pas de recette enregistrée) ──
  const handleDelivrerACredit = async () => {
    if (!creditMotif.trim() || !creditDateLimite || !creditResponsable.trim()) { alert('Motif, date limite et responsable sont obligatoires.'); return; }
    if (operationsSelectionnees.length === 0 || !selectedUsager) return;
    setCreditProcessing(true);
    const usagerNom = selectedUsager.membre
      ? `${selectedUsager.membre.nom} ${selectedUsager.membre.prenom}`
      : (membres.find(m => m.foyer_id === selectedUsager.foyer?.id && m.is_chef)
          ? `${membres.find(m => m.foyer_id === selectedUsager.foyer?.id && m.is_chef)!.nom} ${membres.find(m => m.foyer_id === selectedUsager.foyer?.id && m.is_chef)!.prenom}`
          : selectedUsager.foyer?.code_menage || 'Usager');

    const ids = operationsSelectionnees.map(o => o.id);
    // Marquer les opérations comme "Délivré à crédit" — aucune transaction financière créée
    await supabase.from('operations_caisse').update({ statut: 'Délivré à crédit' }).in('id', ids);

    // Mettre à jour les demandes de documents liées
    const demandeIds = operationsSelectionnees.filter(o => o.metadata?.demande_document_id).map(o => o.metadata.demande_document_id);
    if (demandeIds.length > 0) {
      await supabase.from('demandes_documents').update({
        statut: 'Délivré à crédit', credit_motif: creditMotif, credit_date_limite: creditDateLimite, credit_responsable: creditResponsable,
        credit_montant_restant: totalAPayer,
      }).in('id', demandeIds);
    }

    // Créer la créance dans Finance
    await supabase.from('creances').insert({
      demande_document_id: demandeIds[0] || null,
      nom_debiteur: usagerNom,
      foyer_id: selectedUsager.foyer?.id || selectedUsager.membre?.foyer_id || null,
      membre_id: selectedUsager.membre?.id || null,
      montant: totalAPayer,
      motif: creditMotif,
      date_limite: creditDateLimite,
      responsable: creditResponsable,
      statut: 'Non soldée',
    });

    // Journal
    await supabase.from('journal_caisse').insert({
      type_evenement: 'delivrance_credit', utilisateur: creditResponsable,
      details: { motif: creditMotif, date_limite: creditDateLimite, montant: totalAPayer, nb_operations: ids.length, poste: navigator.userAgent.slice(0, 60) },
    });

    setShowCreditModal(false);
    setCreditMotif(''); setCreditDateLimite(''); setCreditResponsable('');
    setCreditProcessing(false);
    await loadOperations(selectedUsager); await loadToutesOperations(); onDataChange?.();
  };

  // ── Annulation de transaction ──────────────────────────────────
  const handleAnnuler = async () => {
    if (!showAnnulModal || !motifAnnulation.trim()) { alert('Le motif d\'annulation est obligatoire.'); return; }
    setAnnulingId(showAnnulModal.id);
    // 1. Remettre toutes les opérations liées en attente
    await supabase.from('operations_caisse').update({ statut: 'En attente de paiement', transaction_id: null }).eq('transaction_id', showAnnulModal.id);
    // 2. Marquer la transaction comme annulée (jamais supprimée)
    await supabase.from('transactions_caisse').update({
      statut: 'Annulée', motif_annulation: motifAnnulation, annule_par: annulePar, annule_le: new Date().toISOString(),
    }).eq('id', showAnnulModal.id);
    // 3. Journal
    await supabase.from('journal_caisse').insert({
      type_evenement: 'annulation_transaction', transaction_id: showAnnulModal.id, utilisateur: annulePar,
      details: { motif: motifAnnulation, numero_recu: showAnnulModal.numero_recu, poste: navigator.userAgent.slice(0, 60) },
    });
    setShowAnnulModal(null);
    setMotifAnnulation('');
    setAnnulingId(null);
    await loadHistorique();
    onDataChange?.();
  };

  // ── Historique filtré + paginé ──────────────────────────────────
  const filteredTransactions = transactions.filter(t => {
    if (filtreUsager && !t.nom_usager.toLowerCase().includes(filtreUsager.toLowerCase())) return false;
    if (filtreAgent && !t.agent.toLowerCase().includes(filtreAgent.toLowerCase())) return false;
    if (filtreMode && t.mode_paiement !== filtreMode) return false;
    if (filtreRecu && !t.numero_recu.toLowerCase().includes(filtreRecu.toLowerCase())) return false;
    if (filtreModule && !(transactionModules[t.id] || []).includes(filtreModule)) return false;
    if (filtreDateDebut && t.created_at < filtreDateDebut) return false;
    if (filtreDateFin && t.created_at > filtreDateFin + 'T23:59:59') return false;
    return true;
  });
  const totalPagesHisto = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const histoPage = filteredTransactions.slice((pageHisto - 1) * PAGE_SIZE, pageHisto * PAGE_SIZE);
  const totalFiltre = filteredTransactions.filter(t => t.statut === 'Validée').reduce((s, t) => s + t.montant_total, 0);

  const resetFiltresHisto = () => {
    setFiltreModule(''); setFiltreAgent(''); setFiltreMode(''); setFiltreUsager(''); setFiltreRecu('');
    setFiltreDateDebut(''); setFiltreDateFin(''); setPageHisto(1);
  };

  // ── Statistiques calculées ──────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const moisActuel = new Date().toISOString().slice(0, 7);
  const txValidees = statsTransactions.filter(t => t.statut === 'Validée');
  const totalJour = txValidees.filter(t => t.created_at.startsWith(today)).reduce((s, t) => s + t.montant_total, 0);
  const totalMois = txValidees.filter(t => t.created_at.startsWith(moisActuel)).reduce((s, t) => s + t.montant_total, 0);
  const totalGlobal = txValidees.reduce((s, t) => s + t.montant_total, 0);
  const nbTransactions = txValidees.length;
  const nbOperations = statsOperations.length;
  const montantMoyen = nbTransactions > 0 ? totalGlobal / nbTransactions : 0;

  const parModule: Record<string, number> = {};
  statsOperations.forEach(o => { parModule[o.module_origine] = (parModule[o.module_origine] || 0) + (o.montant * (o.quantite || 1)); });

  const parAgent: Record<string, number> = {};
  txValidees.forEach(t => { parAgent[t.agent] = (parAgent[t.agent] || 0) + t.montant_total; });

  const parMode: Record<string, number> = {};
  txValidees.forEach(t => { parMode[t.mode_paiement] = (parMode[t.mode_paiement] || 0) + t.montant_total; });

  const TABS: { key: CaisseTab; label: string; icon: any }[] = [
    { key: 'encaissement', label: 'Encaissement', icon: ShoppingCart },
    { key: 'historique',   label: 'Historique',   icon: Clock },
    { key: 'statistiques', label: 'Statistiques', icon: BarChart2 },
  ];

  return (
    <div className="space-y-5">
      {/* Header + sous-tabs internes */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-emerald-600 p-2.5 rounded-xl"><Wallet className="h-5 w-5 text-white" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Caisse — Facturation & Encaissement</h2>
            <p className="text-xs text-slate-500">Point unique d'encaissement de toutes les prestations FANISA</p>
          </div>
        </div>
        <div className="flex gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tab === key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ ENCAISSEMENT ══════════ */}
      {tab === 'encaissement' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
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
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">{r.label.charAt(0)}</div>
                      <div><p className="text-sm font-semibold text-slate-800">{r.label}</p><p className="text-xs text-slate-400">{r.sub}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedUsager ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
                  <button onClick={() => { setSelectedUsager(null); setOperationsEnAttente([]); loadToutesOperations(); }} className="text-slate-400 hover:text-red-500"><X className="h-5 w-5" /></button>
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
                          <Receipt className="h-3.5 w-3.5 shrink-0 mt-0.5" />Multi-module : un reçu global sera imprimé en plus des justificatifs.
                        </div>
                      )}
                      {isUniquementDocuments && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-3 text-[11px] text-indigo-700 flex items-start gap-1.5">
                          <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />Documents uniquement : justificatif intégré à chaque certificat.
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
                      {modulesImpliques.includes('Documents') && (
                        <button onClick={() => setShowCreditModal(true)} className="w-full mt-2 py-2.5 border-2 border-purple-300 hover:bg-purple-50 text-purple-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition">
                          <CreditCard className="h-3.5 w-3.5" />Délivrer à crédit
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Hourglass className="h-4 w-4 text-amber-500" />Tous les usagers en attente de paiement ({groupesParUsager.length})</h3>
                <button onClick={loadToutesOperations} className="text-xs text-emerald-600 font-semibold hover:underline">Rafraîchir</button>
              </div>
              {loadingToutes ? (
                <div className="text-center py-12"><Loader2 className="h-7 w-7 text-emerald-600 animate-spin mx-auto" /></div>
              ) : groupesParUsager.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold">Aucune opération en attente</p>
                  <p className="text-xs mt-1">Toutes les prestations sont réglées.</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 border-b">
                    <th className="p-3 text-left text-slate-500">Usager</th>
                    <th className="p-3 text-left text-slate-500">Ménage</th>
                    <th className="p-3 text-left text-slate-500">Prestations</th>
                    <th className="p-3 text-right text-slate-500">Total à payer</th>
                    <th className="p-3 text-center text-slate-500">Action</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {groupesParUsager.map((g, i) => (
                      <tr key={i} className="hover:bg-emerald-50/50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-[11px] shrink-0">{g.nom.charAt(0)}</div>
                            <span className="font-semibold text-slate-800">{g.nom}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-indigo-600">{g.foyer?.code_menage || '-'}</td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            {[...new Set(g.ops.map(o => o.module_origine))].map(m => (
                              <span key={m} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${moduleColor(m)}`}>{m}</span>
                            ))}
                            <span className="text-slate-400">{g.ops.length} opération{g.ops.length > 1 ? 's' : ''}</span>
                          </div>
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">{fmt(g.total)}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => selectUsager({ membre: g.membre, foyer: g.foyer })} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition">
                            Encaisser
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════ HISTORIQUE ══════════ */}
      {tab === 'historique' && (
        <div className="space-y-4">
          {/* Filtres */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Filter className="h-3.5 w-3.5" />Filtres</h3>
              <button onClick={resetFiltresHisto} className="text-xs text-slate-400 hover:text-red-500 font-semibold flex items-center gap-1"><RotateCcw className="h-3 w-3" />Réinitialiser</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <input value={filtreUsager} onChange={e => { setFiltreUsager(e.target.value); setPageHisto(1); }} placeholder="Usager..." className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500" />
              <input value={filtreRecu} onChange={e => { setFiltreRecu(e.target.value); setPageHisto(1); }} placeholder="N° reçu (RC-...)..." className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-mono" />
              <input value={filtreAgent} onChange={e => { setFiltreAgent(e.target.value); setPageHisto(1); }} placeholder="Agent..." className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500" />
              <select value={filtreMode} onChange={e => { setFiltreMode(e.target.value); setPageHisto(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white">
                <option value="">Tous modes paiement</option>
                {MODES_PAIEMENT.map(m => <option key={m.v} value={m.v}>{m.v}</option>)}
              </select>
              <select value={filtreModule} onChange={e => { setFiltreModule(e.target.value); setPageHisto(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white">
                <option value="">Tous modules</option>
                {Object.keys(MODULE_COLORS).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="date" value={filtreDateDebut} onChange={e => { setFiltreDateDebut(e.target.value); setPageHisto(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500" />
              <input type="date" value={filtreDateFin} onChange={e => { setFiltreDateFin(e.target.value); setPageHisto(1); }} className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500" />
              <div className="flex items-center justify-end text-xs text-slate-500 font-semibold">{filteredTransactions.length} résultat{filteredTransactions.length > 1 ? 's' : ''} · <span className="text-emerald-600 ml-1">{fmt(totalFiltre)}</span></div>
            </div>
          </div>

          {/* Tableau historique */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loadingHisto ? (
              <div className="text-center py-12"><Loader2 className="h-7 w-7 text-emerald-600 animate-spin mx-auto" /></div>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50 border-b">
                  <th className="p-3 text-left text-slate-500">N° Reçu</th>
                  <th className="p-3 text-left text-slate-500">Usager</th>
                  <th className="p-3 text-left text-slate-500">Modules</th>
                  <th className="p-3 text-center text-slate-500">Opérations</th>
                  <th className="p-3 text-right text-slate-500">Total</th>
                  <th className="p-3 text-left text-slate-500">Mode</th>
                  <th className="p-3 text-left text-slate-500">Agent</th>
                  <th className="p-3 text-left text-slate-500">Date</th>
                  <th className="p-3 text-center text-slate-500">Statut</th>
                  <th className="p-3 text-center text-slate-500">⋯</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {histoPage.map(t => (
                    <tr key={t.id} className={`hover:bg-slate-50 ${t.statut === 'Annulée' ? 'opacity-50' : ''}`}>
                      <td className="p-3 font-mono text-emerald-600 font-bold">{t.numero_recu}</td>
                      <td className="p-3 text-slate-700">{t.nom_usager}</td>
                      <td className="p-3"><div className="flex gap-1 flex-wrap">{(transactionModules[t.id] || []).map(m => <span key={m} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${moduleColor(m)}`}>{m}</span>)}</div></td>
                      <td className="p-3 text-center text-slate-500">{transactionNbOps[t.id] || '-'}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{fmt(t.montant_total)}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${MODE_COLORS[t.mode_paiement] || 'bg-slate-100'}`}>{t.mode_paiement}</span></td>
                      <td className="p-3 text-slate-500">{t.agent}</td>
                      <td className="p-3 text-slate-400">{new Date(t.created_at).toLocaleDateString('fr-FR')} {new Date(t.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="p-3 text-center">
                        {t.statut === 'Validée' ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Validée</span> : <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full" title={t.motif_annulation || ''}>Annulée</span>}
                      </td>
                      <td className="p-3 text-center">
                        {t.statut === 'Validée' && (
                          <button onClick={() => setShowAnnulModal(t)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition" title="Annuler la transaction"><Trash2 className="h-3.5 w-3.5" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {histoPage.length === 0 && <tr><td colSpan={10} className="text-center text-slate-400 py-10">Aucune transaction trouvée</td></tr>}
                </tbody>
              </table>
            )}
            {totalPagesHisto > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <button onClick={() => setPageHisto(p => Math.max(1, p - 1))} disabled={pageHisto === 1} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Précédent</button>
                <span className="text-xs text-slate-500">Page {pageHisto} / {totalPagesHisto}</span>
                <button onClick={() => setPageHisto(p => Math.min(totalPagesHisto, p + 1))} disabled={pageHisto === totalPagesHisto} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-40">Suivant<ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ STATISTIQUES ══════════ */}
      {tab === 'statistiques' && (
        statsLoading ? (
          <div className="text-center py-16"><Loader2 className="h-8 w-8 text-emerald-600 animate-spin mx-auto" /></div>
        ) : (
        <div className="space-y-4">
          {/* Cards principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border-2 border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Encaissé aujourd'hui</p>
              <p className="text-2xl font-black text-emerald-600">{fmt(totalJour)}</p>
            </div>
            <div className="bg-white border-2 border-indigo-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Encaissé ce mois</p>
              <p className="text-2xl font-black text-indigo-600">{fmt(totalMois)}</p>
            </div>
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Nombre de transactions</p>
              <p className="text-2xl font-black text-slate-700">{nbTransactions}</p>
            </div>
            <div className="bg-white border-2 border-amber-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Montant moyen / transaction</p>
              <p className="text-2xl font-black text-amber-600">{fmt(Math.round(montantMoyen))}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total encaissé (global)</p>
              <p className="text-xl font-black text-slate-800">{fmt(totalGlobal)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Opérations encaissées</p>
              <p className="text-xl font-black text-slate-800">{nbOperations}</p>
            </div>
          </div>

          {/* Répartition par module */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />Répartition des recettes par module</h3>
            <div className="space-y-2">
              {Object.entries(parModule).sort((a, b) => b[1] - a[1]).map(([mod, montant]) => {
                const pct = totalGlobal > 0 ? (montant / Object.values(parModule).reduce((s, v) => s + v, 0)) * 100 : 0;
                return (
                  <div key={mod}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-bold px-2 py-0.5 rounded-full border ${moduleColor(mod)}`}>{mod}</span>
                      <span className="font-bold text-slate-700">{fmt(montant)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
              {Object.keys(parModule).length === 0 && <p className="text-center text-slate-400 text-sm py-4">Aucune donnée</p>}
            </div>
          </div>

          {/* Répartition par mode de paiement */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" />Répartition par mode de paiement</h3>
            <div className="grid grid-cols-3 gap-3">
              {MODES_PAIEMENT.map(({ v, icon: Icon }) => (
                <div key={v} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                  <Icon className="h-5 w-5 text-slate-400 mx-auto mb-1" />
                  <p className="text-sm font-black text-slate-800">{fmt(parMode[v] || 0)}</p>
                  <p className="text-[10px] text-slate-400">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Répartition par agent */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Users className="h-3.5 w-3.5" />Total encaissé par agent</h3>
            <div className="space-y-1.5">
              {Object.entries(parAgent).sort((a, b) => b[1] - a[1]).map(([ag, montant]) => (
                <div key={ag} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-700">{ag}</span>
                  <span className="font-bold text-emerald-600">{fmt(montant)}</span>
                </div>
              ))}
              {Object.keys(parAgent).length === 0 && <p className="text-center text-slate-400 text-sm py-4">Aucune donnée</p>}
            </div>
          </div>
        </div>
        )
      )}

      {/* Modal crédit */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-xl"><CreditCard className="h-5 w-5 text-purple-600" /></div>
              <div>
                <h3 className="font-bold text-slate-900">Délivrance à crédit</h3>
                <p className="text-xs text-slate-500">Fonction réservée aux utilisateurs autorisés</p>
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-700">
              <p>Le document sera autorisé à être imprimé. Une créance de <strong>{fmt(totalAPayer)}</strong> sera créée dans le module Finance. Aucune recette ne sera enregistrée.</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Motif du crédit *</label>
              <textarea value={creditMotif} onChange={e => setCreditMotif(e.target.value)} rows={2} placeholder="Raison de la délivrance à crédit..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-400 resize-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Date limite de paiement *</label>
              <input type="date" value={creditDateLimite} onChange={e => setCreditDateLimite(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Responsable ayant autorisé *</label>
              <input value={creditResponsable} onChange={e => setCreditResponsable(e.target.value)} placeholder="Nom du responsable..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-400" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowCreditModal(false); setCreditMotif(''); setCreditDateLimite(''); setCreditResponsable(''); }} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Annuler</button>
              <button onClick={handleDelivrerACredit} disabled={creditProcessing || !creditMotif.trim() || !creditDateLimite || !creditResponsable.trim()} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
                {creditProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}Confirmer le crédit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal annulation */}
      {showAnnulModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-xl"><AlertCircle className="h-5 w-5 text-red-600" /></div>
              <div>
                <h3 className="font-bold text-slate-900">Annuler la transaction</h3>
                <p className="text-xs text-slate-500 font-mono">{showAnnulModal.numero_recu}</p>
              </div>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Toutes les opérations liées ({transactionNbOps[showAnnulModal.id] || 0}) reviendront au statut "En attente de paiement". La transaction sera conservée dans l'historique avec le statut "Annulée".
            </p>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Motif de l'annulation *</label>
              <textarea value={motifAnnulation} onChange={e => setMotifAnnulation(e.target.value)} rows={3} placeholder="Expliquez la raison de l'annulation..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-400 resize-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Annulé par</label>
              <input value={annulePar} onChange={e => setAnnulePar(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-red-400" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowAnnulModal(null); setMotifAnnulation(''); }} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Annuler</button>
              <button onClick={handleAnnuler} disabled={annulingId === showAnnulModal.id || !motifAnnulation.trim()} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
                {annulingId === showAnnulModal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Confirmer l'annulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
