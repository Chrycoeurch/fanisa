import React, { useState, useEffect } from 'react';
import { Membre, Foyer, Parcelle, Batiment, Detenteur, TitulaireFoncier, MiseEnValeur } from '../types';
import { supabase } from '../lib/supabase';
import {
  getConfig, updateConfig, ConfigFokontany,
  telechargerPDF, DOCUMENTS_ADMIN, DOCUMENTS_FONCIERS,
  genererDocumentParCode, genererReference, enregistrerDocument,
} from '../lib/documents';
import {
  FileText, Settings, Download, Clock, CheckCircle, Loader2, X,
  ChevronDown, ChevronLeft, ChevronRight, User, Home, AlertCircle, Eye, Receipt, Printer,
  Search, CreditCard, ArrowRight, ArrowLeft, Inbox, Wallet, Hourglass
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

interface DemandeDocument {
  id: string;
  code_document: string;
  nom_document: string;
  format_document: string | null;
  membre_id: string | null;
  foyer_id: string | null;
  parcelle_id: string | null;
  requerant_est_titulaire: boolean;
  requerant_nom: string | null;
  requerant_prenom: string | null;
  requerant_cin: string | null;
  requerant_lien: string | null;
  nombre_exemplaires: number;
  motif_demande: string | null;
  montant_unitaire: number;
  montant_total: number;
  statut: string; // 'En attente de paiement' | 'Payé' | 'Délivré à crédit' | 'Archivé'
  operation_caisse_id: string | null;
  transaction_id: string | null;
  credit_motif: string | null;
  credit_date_limite: string | null;
  credit_responsable: string | null;
  reference_document: string | null;
  numero_sequentiel: number | null;
  telecharge_le: string | null;
  created_at: string;
}

const MOTIFS_DEMANDE = ['Démarche administrative', 'Demande d\'emploi', 'Inscription scolaire', 'Dossier bancaire', 'Pièce justificative', 'Autre'];
const LIENS_REQUERANT = ['Conjoint(e)', 'Père', 'Mère', 'Fils/Fille', 'Frère/Sœur', 'Mandataire', 'Autre'];

const STATUT_BADGE: Record<string, string> = {
  'En attente de paiement': 'bg-amber-100 text-amber-700',
  'Payé': 'bg-emerald-100 text-emerald-700',
  'Délivré à crédit': 'bg-purple-100 text-purple-700',
  'Archivé': 'bg-slate-200 text-slate-600',
};

// ── Wizard de demande de document ───────────────────────────────
interface WizardProps {
  code: string; nom: string; format: string; icon: string;
  niveau: 'membre' | 'foyer' | 'parcelle';
  foyer?: Foyer; membre?: Membre; parcelle?: Parcelle;
  membres: Membre[];
  tarif: number;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

function WizardDemande({ code, nom, format, icon, niveau, foyer, membre, parcelle, membres, tarif, onClose, onSubmit }: WizardProps) {
  const [step, setStep] = useState(1);
  const [requerantEstTitulaire, setRequerantEstTitulaire] = useState(true);
  const [requerantNom, setRequerantNom] = useState('');
  const [requerantPrenom, setRequerantPrenom] = useState('');
  const [requerantCin, setRequerantCin] = useState('');
  const [requerantLien, setRequerantLien] = useState('');
  const [nbExemplaires, setNbExemplaires] = useState(1);
  const [motif, setMotif] = useState('');
  const [motifAutre, setMotifAutre] = useState('');
  const [extraData, setExtraData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = 5; // requérant, exemplaires, motif, vérif+aperçu, confirmation
  const montantTotal = tarif * nbExemplaires;

  // Vérifications automatiques (étape 4)
  const erreurs: string[] = [];
  if (niveau === 'membre' && !membre) erreurs.push('Titulaire manquant.');
  if (niveau === 'foyer' && !foyer) erreurs.push('Foyer manquant.');
  if (niveau === 'parcelle' && !parcelle) erreurs.push('Parcelle manquante.');
  if (!requerantEstTitulaire && (!requerantNom.trim() || !requerantPrenom.trim())) erreurs.push('Nom et prénom du requérant obligatoires.');
  if (nbExemplaires < 1) erreurs.push('Le nombre d\'exemplaires doit être au moins 1.');
  if (!motif && !motifAutre.trim()) erreurs.push('Le motif de la demande est obligatoire.');
  if (code === 'FFD' && (!extraData.dateDeces || !extraData.lieuDeces)) erreurs.push('Date et lieu du décès obligatoires pour une déclaration de décès.');
  const peutValider = erreurs.length === 0;

  const beneficiaireNom = membre ? `${membre.nom} ${membre.prenom}` : foyer ? (membres.find(m => m.foyer_id === foyer.id && m.is_chef)?.nom || foyer.code_menage) : parcelle ? `LOT ${parcelle.numero_lot}` : '-';

  const handleValiderDemande = async () => {
    setSubmitting(true);
    await onSubmit({
      motifFinal: motif === 'Autre' ? motifAutre : motif,
      requerantEstTitulaire, requerantNom, requerantPrenom, requerantCin, requerantLien,
      nbExemplaires, montantTotal, extraData,
    });
    setSubmitting(false);
    setStep(5);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Demande de document</h2>
              <p className="text-xs text-indigo-600 font-mono font-bold">[{code}] {nom}</p>
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        {/* Progress */}
        {step < 5 && (
          <div className="flex items-center gap-1 px-5 py-3 border-b border-slate-100 shrink-0">
            {['Requérant', 'Exemplaires', 'Motif', 'Vérification & Aperçu'].map((label, i) => (
              <div key={label} className="flex-1 flex items-center gap-1">
                <div className={`flex-1 h-1.5 rounded-full ${step > i ? 'bg-indigo-500' : 'bg-slate-100'}`} />
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── Étape 1: Requérant ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Étape 1 — Identification du requérant</h3>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                <p className="text-xs text-slate-500">Titulaire du document</p>
                <p className="text-sm font-bold text-indigo-800">{beneficiaireNom}</p>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase">Le requérant est-il le titulaire ?</p>
              <div className="flex gap-3">
                <button onClick={() => setRequerantEstTitulaire(true)} className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition ${requerantEstTitulaire ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>✅ Oui</button>
                <button onClick={() => setRequerantEstTitulaire(false)} className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition ${!requerantEstTitulaire ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500'}`}>❌ Non</button>
              </div>
              {!requerantEstTitulaire && (
                <div className="space-y-3 bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nom *</label><input value={requerantNom} onChange={e => setRequerantNom(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" /></div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Prénom *</label><input value={requerantPrenom} onChange={e => setRequerantPrenom(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" /></div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">CIN</label><input value={requerantCin} onChange={e => setRequerantCin(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" /></div>
                    <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Lien avec titulaire</label>
                      <select value={requerantLien} onChange={e => setRequerantLien(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500">
                        <option value="">Choisir...</option>
                        {LIENS_REQUERANT.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {code === 'FFD' && (
                <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">Informations du décès</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-slate-500 block mb-1">Date du décès *</label><input type="date" value={extraData.dateDeces || ''} onChange={e => setExtraData((p: any) => ({ ...p, dateDeces: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
                    <div><label className="text-xs text-slate-500 block mb-1">Lieu du décès *</label><input value={extraData.lieuDeces || ''} onChange={e => setExtraData((p: any) => ({ ...p, lieuDeces: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
                    <div className="col-span-2"><label className="text-xs text-slate-500 block mb-1">Déclarant</label><input value={extraData.declarant || ''} onChange={e => setExtraData((p: any) => ({ ...p, declarant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" /></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Étape 2: Exemplaires ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Étape 2 — Nombre d'exemplaires</h3>
              <div className="flex items-center justify-center gap-4 py-6">
                <button onClick={() => setNbExemplaires(n => Math.max(1, n - 1))} className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-2xl font-bold text-slate-600">−</button>
                <span className="text-4xl font-black text-indigo-600 w-20 text-center">{nbExemplaires}</span>
                <button onClick={() => setNbExemplaires(n => Math.min(20, n + 1))} className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-2xl font-bold text-slate-600">+</button>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-600 font-semibold">Tarif unitaire × {nbExemplaires}</p>
                  <p className="text-2xl font-black text-emerald-700">{new Intl.NumberFormat('fr-MG').format(montantTotal)} Ar</p>
                </div>
                <Receipt className="h-8 w-8 text-emerald-300" />
              </div>
            </div>
          )}

          {/* ── Étape 3: Motif ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Étape 3 — Motif de la demande</h3>
              <div className="grid grid-cols-2 gap-2">
                {MOTIFS_DEMANDE.map(m => (
                  <button key={m} onClick={() => setMotif(m)} className={`py-2.5 rounded-lg border text-xs font-semibold transition ${motif === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{m}</button>
                ))}
              </div>
              {motif === 'Autre' && (
                <input value={motifAutre} onChange={e => setMotifAutre(e.target.value)} placeholder="Précisez le motif..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
              )}
              <p className="text-[11px] text-slate-400">Ce motif sera enregistré dans l'historique du document.</p>
            </div>
          )}

          {/* ── Étape 4: Vérification + Aperçu ── */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-700">Étape 4 — Vérification & Aperçu</h3>

              {erreurs.length > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs font-bold text-red-600 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />Validation bloquée</p>
                  {erreurs.map((e, i) => <p key={i} className="text-xs text-red-500 pl-5">• {e}</p>)}
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" /><p className="text-xs font-bold text-emerald-700">Toutes les vérifications sont passées.</p>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Document</span><span className="font-semibold">[{code}] {nom}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Titulaire</span><span className="font-semibold">{beneficiaireNom}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Requérant</span><span className="font-semibold">{requerantEstTitulaire ? 'Le titulaire' : `${requerantNom} ${requerantPrenom} (${requerantLien || '-'})`}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Exemplaires</span><span className="font-semibold">{nbExemplaires}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Motif</span><span className="font-semibold">{motif === 'Autre' ? motifAutre : motif}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2"><span className="font-bold text-slate-700">Montant total</span><span className="font-black text-emerald-600 text-base">{new Intl.NumberFormat('fr-MG').format(montantTotal)} Ar</span></div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                <Hourglass className="h-4 w-4 shrink-0 mt-0.5" />
                Le document ne sera pas imprimé immédiatement. La demande sera transmise à la <strong>Caisse</strong> pour encaissement. Vous pourrez télécharger le document une fois le paiement validé (ou un crédit accordé).
              </div>
            </div>
          )}

          {/* ── Étape 5: Confirmation ── */}
          {step === 5 && (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto"><CheckCircle className="h-8 w-8 text-emerald-600" /></div>
              <h3 className="text-lg font-bold text-slate-800">Demande envoyée à la Caisse</h3>
              <p className="text-sm text-slate-500 px-6">La prestation est en attente de paiement. Rendez-vous dans le module <strong>Finances → Caisse</strong> pour l'encaisser, puis revenez dans <strong>Mes Demandes</strong> pour télécharger le document.</p>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex gap-3 p-5 border-t border-slate-100 shrink-0">
          {step < 5 ? (
            <>
              <button onClick={() => step === 1 ? onClose() : setStep(s => s - 1)} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 flex items-center justify-center gap-1.5">
                <ArrowLeft className="h-4 w-4" />{step === 1 ? 'Annuler' : 'Précédent'}
              </button>
              {step < 4 ? (
                <button onClick={() => setStep(s => s + 1)} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5">
                  Suivant<ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={handleValiderDemande} disabled={!peutValider || submitting} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-1.5">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  {submitting ? 'Envoi…' : 'Valider & Envoyer à la Caisse'}
                </button>
              )}
            </>
          ) : (
            <button onClick={onClose} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold">Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────
export default function DocumentsModule({ foyers, membres }: Props) {
  const [config, setConfig] = useState<any>({});
  const [activeSection, setActiveSection] = useState<'generer' | 'demandes' | 'config'>('generer');

  // Sélection
  const [searchFoyer, setSearchFoyer] = useState('');
  const [selectedFoyer, setSelectedFoyer] = useState<Foyer | null>(null);
  const [selectedMembre, setSelectedMembre] = useState<Membre | null>(null);
  const [showFoyerSearch, setShowFoyerSearch] = useState(false);
  const [showMembreSearch, setShowMembreSearch] = useState(false);

  // Parcelle
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [selectedParcelle, setSelectedParcelle] = useState<Parcelle | null>(null);
  const [parcelleDetails, setParcelleDetails] = useState<any>(null);
  const [showParcelleSearch, setShowParcelleSearch] = useState(false);
  const [searchParcelle, setSearchParcelle] = useState('');

  // Wizard
  const [wizardDoc, setWizardDoc] = useState<{ code: string; nom: string; format: string; icon: string; niveau: 'membre' | 'foyer' | 'parcelle' } | null>(null);

  // Mes demandes
  const [demandes, setDemandes] = useState<DemandeDocument[]>([]);
  const [loadingDemandes, setLoadingDemandes] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const membresDuFoyer = selectedFoyer ? membres.filter(m => m.foyer_id === selectedFoyer.id) : [];
  const filteredFoyers = foyers.filter(f => {
    const q = searchFoyer.toLowerCase();
    const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
    return f.code_menage.toLowerCase().includes(q) || (chef ? `${chef.nom} ${chef.prenom}`.toLowerCase().includes(q) : false) || (f.adresse || '').toLowerCase().includes(q);
  });

  useEffect(() => {
    getConfig().then(setConfig);
    supabase.from('parcelles').select('*').order('created_at', { ascending: false }).then(({ data }) => setParcelles((data || []) as Parcelle[]));
  }, []);

  useEffect(() => { if (activeSection === 'demandes') loadDemandes(); }, [activeSection]);

  const loadDemandes = async () => {
    setLoadingDemandes(true);
    const { data } = await supabase.from('demandes_documents').select('*').order('created_at', { ascending: false });
    setDemandes((data || []) as DemandeDocument[]);
    setLoadingDemandes(false);
  };

  const loadParcelleDetails = async (parcelle: Parcelle) => {
    const [t, d, b, v] = await Promise.all([
      supabase.from('titulaires_fonciers').select('*').eq('parcelle_id', parcelle.id).single(),
      supabase.from('detenteurs').select('*').eq('parcelle_id', parcelle.id).single(),
      supabase.from('batiments').select('*').eq('parcelle_id', parcelle.id),
      supabase.from('mises_en_valeur').select('*').eq('parcelle_id', parcelle.id).single(),
    ]);
    const result = { titulaire: t.data, detenteur: d.data, batiments: b.data || [], valeur: v.data };
    setParcelleDetails(result);
    return result;
  };

  const getTarif = (code: string): number => config[`tarif_${code.toLowerCase()}`] || 2000;

  // Soumission du wizard → crée la demande + l'opération en attente Caisse
  const handleWizardSubmit = async (formData: any) => {
    if (!wizardDoc) return;
    const { code, nom, format, niveau } = wizardDoc;
    const tarif = getTarif(code);
    const beneficiaireNom = niveau === 'membre' && selectedMembre ? `${selectedMembre.nom} ${selectedMembre.prenom}`
      : niveau === 'foyer' && selectedFoyer ? (membres.find(m => m.foyer_id === selectedFoyer.id && m.is_chef)?.nom || selectedFoyer.code_menage)
      : niveau === 'parcelle' && selectedParcelle ? `LOT ${selectedParcelle.numero_lot}` : '-';

    const { data: demande } = await supabase.from('demandes_documents').insert({
      code_document: code, nom_document: nom, format_document: format,
      membre_id: selectedMembre?.id || null, foyer_id: selectedFoyer?.id || null, parcelle_id: selectedParcelle?.id || null,
      requerant_est_titulaire: formData.requerantEstTitulaire,
      requerant_nom: formData.requerantEstTitulaire ? null : formData.requerantNom,
      requerant_prenom: formData.requerantEstTitulaire ? null : formData.requerantPrenom,
      requerant_cin: formData.requerantEstTitulaire ? null : formData.requerantCin,
      requerant_lien: formData.requerantEstTitulaire ? null : formData.requerantLien,
      nombre_exemplaires: formData.nbExemplaires,
      motif_demande: formData.motifFinal,
      montant_unitaire: tarif, montant_total: formData.montantTotal,
      statut: 'En attente de paiement',
      snapshot_data: formData.extraData || null,
    }).select().single();

    if (demande) {
      // Créer l'opération en attente à la Caisse
      const { data: operation } = await supabase.from('operations_caisse').insert({
        module_origine: 'Documents',
        type_prestation: `[${code}] ${nom}${formData.nbExemplaires > 1 ? ` ×${formData.nbExemplaires}` : ''}`,
        reference_document: demande.id,
        membre_id: selectedMembre?.id || null,
        foyer_id: selectedFoyer?.id || null,
        nom_beneficiaire: beneficiaireNom,
        montant: tarif,
        quantite: formData.nbExemplaires,
        statut: 'En attente de paiement',
        metadata: { demande_document_id: demande.id },
      }).select().single();

      if (operation) {
        await supabase.from('demandes_documents').update({ operation_caisse_id: operation.id }).eq('id', demande.id);
      }
    }
  };

  // Téléchargement final — uniquement si Payé ou Délivré à crédit
  const handleTelecharger = async (demande: DemandeDocument) => {
    if (demande.statut !== 'Payé' && demande.statut !== 'Délivré à crédit') {
      alert('Ce document ne peut pas encore être téléchargé : le paiement n\'a pas été validé.');
      return;
    }
    setDownloadingId(demande.id);
    try {
      const cfg = await getConfig();
      const membre = demande.membre_id ? membres.find(m => m.id === demande.membre_id) : undefined;
      const foyer = demande.foyer_id ? foyers.find(f => f.id === demande.foyer_id) : undefined;
      const membresDuFoyerD = foyer ? membres.filter(m => m.foyer_id === foyer.id) : [];
      let parcelle, detenteur, titulaire, batiments, valeur;
      if (demande.parcelle_id) {
        const { data: p } = await supabase.from('parcelles').select('*').eq('id', demande.parcelle_id).single();
        parcelle = p;
        const det = await loadParcelleDetails(p);
        detenteur = det.detenteur; titulaire = det.titulaire; batiments = det.batiments; valeur = det.valeur;
      }

      // Générer un numéro de référence si pas encore fait
      let reference = demande.reference_document;
      let numero = demande.numero_sequentiel;
      if (!reference) {
        const ref = await genererReference(demande.code_document, cfg);
        reference = ref.reference; numero = ref.numero;
        await supabase.from('demandes_documents').update({ reference_document: reference, numero_sequentiel: numero }).eq('id', demande.id);
      }

      const bytesArray: Uint8Array[] = [];
      for (let i = 0; i < demande.nombre_exemplaires; i++) {
        const bytes = await genererDocumentParCode(demande.code_document, cfg, {
          membre, foyer, membresDuFoyer: membresDuFoyerD, parcelle, detenteur, titulaire, batiments, valeur,
          extraData: demande.snapshot_data,
        });
        bytesArray.push(bytes);
      }
      // Télécharger chaque exemplaire
      for (let i = 0; i < bytesArray.length; i++) {
        const suffix = demande.nombre_exemplaires > 1 ? `_ex${i + 1}` : '';
        await telechargerPDF(bytesArray[i], `${demande.code_document}_${reference}${suffix}.pdf`);
      }
      await enregistrerDocument(demande.code_document, reference!, numero!, demande.membre_id || undefined, demande.foyer_id || undefined);
      await supabase.from('demandes_documents').update({ telecharge_le: new Date().toISOString(), statut: demande.statut === 'Payé' ? 'Archivé' : demande.statut }).eq('id', demande.id);
      await loadDemandes();
    } catch (e) {
      alert('Erreur téléchargement : ' + e);
    }
    setDownloadingId(null);
  };

  const ouvrirWizard = (code: string, nom: string, format: string, niveau: 'membre' | 'foyer' | 'parcelle', icon: string) => {
    setWizardDoc({ code, nom, format, icon, niveau });
  };

  const demandesFiltrees = demandes.filter(d => !filtreStatut || d.statut === filtreStatut);
  const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl"><FileText className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Générateur d'Actes & Documents</h2>
              {config && <p className="text-xs text-slate-500 font-mono">{config.code_fokontany}-{config.code_quartier}-{config.code_carreau} · {config.nom_fokontany}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {(['generer', 'demandes', 'config'] as const).map(s => (
              <button key={s} onClick={() => setActiveSection(s)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${activeSection === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s === 'generer' ? <><FileText className="h-3.5 w-3.5" />Générer</> : s === 'demandes' ? <><Inbox className="h-3.5 w-3.5" />Mes Demandes{demandes.filter(d => d.statut === 'Payé' || d.statut === 'Délivré à crédit').length > 0 && <span className="bg-emerald-500 text-white text-[10px] px-1.5 rounded-full ml-1">{demandes.filter(d => d.statut === 'Payé' || d.statut === 'Délivré à crédit').length}</span>}</> : <><Settings className="h-3.5 w-3.5" />Config</>}
              </button>
            ))}
          </div>
        </div>

        {activeSection === 'generer' && (
          <div className="grid grid-cols-2 gap-4">
            {/* Foyer */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Foyer / Ménage</label>
              <div className="relative">
                <button onClick={() => setShowFoyerSearch(!showFoyerSearch)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition ${selectedFoyer ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                  <span className="flex items-center gap-2"><Home className="h-4 w-4" />{selectedFoyer ? `${selectedFoyer.code_menage} · ${selectedFoyer.adresse || selectedFoyer.fokontany}` : 'Sélectionner un foyer...'}</span>
                  <div className="flex gap-1">
                    {selectedFoyer && <button type="button" onClick={e => { e.stopPropagation(); setSelectedFoyer(null); setSelectedMembre(null); }} className="text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
                {showFoyerSearch && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto">
                    <div className="p-2 border-b sticky top-0 bg-white">
                      <input autoFocus value={searchFoyer} onChange={e => setSearchFoyer(e.target.value)} placeholder="Rechercher..." className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg outline-none" />
                    </div>
                    {filteredFoyers.map(f => {
                      const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
                      return (
                        <button key={f.id} onClick={() => { setSelectedFoyer(f); setSelectedMembre(null); setShowFoyerSearch(false); setSearchFoyer(''); }} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-xs border-b border-slate-50">
                          <span className="font-mono font-bold text-indigo-600">{f.code_menage}</span>
                          <span className="text-slate-600 ml-2">{chef ? `${chef.nom} ${chef.prenom}` : ''}</span>
                        </button>
                      );
                    })}
                    {filteredFoyers.length === 0 && <p className="text-center text-slate-400 text-xs py-4">Aucun foyer trouvé</p>}
                  </div>
                )}
              </div>
            </div>
            {/* Membre */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Membre <span className="text-slate-400 normal-case font-normal">(pour docs individuels)</span></label>
              <div className="relative">
                <button onClick={() => selectedFoyer && setShowMembreSearch(!showMembreSearch)} disabled={!selectedFoyer} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition ${!selectedFoyer ? 'opacity-50 cursor-not-allowed bg-slate-50' : selectedMembre ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                  <span className="flex items-center gap-2"><User className="h-4 w-4" />{selectedMembre ? `${selectedMembre.nom} ${selectedMembre.prenom} (${selectedMembre.relation_chef})` : 'Sélectionner un membre...'}</span>
                  {selectedMembre && <button type="button" onClick={e => { e.stopPropagation(); setSelectedMembre(null); }} className="text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}
                </button>
                {showMembreSearch && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
                    {membresDuFoyer.map(m => (
                      <button key={m.id} onClick={() => { setSelectedMembre(m); setShowMembreSearch(false); }} className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 text-xs border-b border-slate-50 flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${m.sexe === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>{m.prenom?.charAt(0)}</div>
                        <span className="font-semibold">{m.nom} {m.prenom}</span>
                        <span className="text-slate-400">{m.relation_chef}</span>
                        {m.is_chef && <span className="ml-auto text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">Chef</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══════════ GÉNÉRER (catalogue) ══════════ */}
      {activeSection === 'generer' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><User className="h-3.5 w-3.5" />Documents individuels</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DOCUMENTS_ADMIN.filter(d => d.niveau === 'membre').map(doc => (
                <div key={doc.code} className={`flex items-center justify-between p-3.5 rounded-xl border transition ${selectedMembre ? 'border-slate-200 hover:border-indigo-200' : 'border-slate-100 opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{doc.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">[{doc.code}] {doc.nom}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{(doc as any).format}</span>
                        <span className="text-[10px] font-bold text-green-600">{fmt(getTarif(doc.code))}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => ouvrirWizard(doc.code, doc.nom, (doc as any).format, 'membre', doc.icon)} disabled={!selectedMembre} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${!selectedMembre ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                    <FileText className="h-3.5 w-3.5" />Demander
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Home className="h-3.5 w-3.5" />Documents du foyer</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DOCUMENTS_ADMIN.filter(d => d.niveau === 'foyer').map(doc => (
                <div key={doc.code} className={`flex items-center justify-between p-3.5 rounded-xl border transition ${selectedFoyer ? 'border-slate-200 hover:border-emerald-200' : 'border-slate-100 opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{doc.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">[{doc.code}] {doc.nom}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{(doc as any).format}</span>
                        <span className="text-[10px] font-bold text-green-600">{fmt(getTarif(doc.code))}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => ouvrirWizard(doc.code, doc.nom, (doc as any).format, 'foyer', doc.icon)} disabled={!selectedFoyer} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${!selectedFoyer ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                    <FileText className="h-3.5 w-3.5" />Demander
                  </button>
                </div>
              ))}
            </div>
          </div>

          {!selectedFoyer && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700">Sélectionnez un <strong>foyer</strong> en haut pour activer les documents.</p>
            </div>
          )}

          {/* Docs fonciers */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">🌍 Documents fonciers</h3>
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Parcelle / Lot</label>
              <div className="relative">
                <button onClick={() => setShowParcelleSearch(!showParcelleSearch)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition ${selectedParcelle ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                  <span>🌍 {selectedParcelle ? `LOT ${selectedParcelle.numero_lot} · ${selectedParcelle.adresse || selectedParcelle.fokontany}` : 'Sélectionner une parcelle...'}</span>
                  {selectedParcelle && <button type="button" onClick={e => { e.stopPropagation(); setSelectedParcelle(null); setParcelleDetails(null); }} className="text-slate-400 hover:text-red-500 mr-1"><X className="h-3.5 w-3.5" /></button>}
                </button>
                {showParcelleSearch && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
                    <div className="p-2 border-b sticky top-0 bg-white"><input autoFocus value={searchParcelle} onChange={e => setSearchParcelle(e.target.value)} placeholder="Rechercher lot..." className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg outline-none" /></div>
                    {parcelles.filter(p => (p.numero_lot || '').toLowerCase().includes(searchParcelle.toLowerCase()) || (p.adresse || '').toLowerCase().includes(searchParcelle.toLowerCase())).map(p => (
                      <button key={p.id} onClick={async () => { setSelectedParcelle(p); setShowParcelleSearch(false); await loadParcelleDetails(p); }} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-xs border-b border-slate-50">
                        <span className="font-mono font-bold text-indigo-600">LOT {p.numero_lot}</span><span className="text-slate-500 ml-2">{p.adresse || p.fokontany}</span>
                      </button>
                    ))}
                    {parcelles.length === 0 && <p className="text-center text-slate-400 text-xs py-4">Aucune parcelle — créez-en dans le module Foncier</p>}
                  </div>
                )}
              </div>
              {selectedParcelle && parcelleDetails && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {parcelleDetails.titulaire && <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🏛 {parcelleDetails.titulaire.nom}</span>}
                  {parcelleDetails.detenteur && <span className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-semibold">📜 {parcelleDetails.detenteur.nom}</span>}
                  {parcelleDetails.batiments?.length ? <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">🏠 {parcelleDetails.batiments.length} bât.</span> : null}
                  {parcelleDetails.valeur && <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">🌿 Mis en valeur</span>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DOCUMENTS_FONCIERS.map(doc => {
                const manque = doc.besoin.filter(b => {
                  if (b === 'parcelle') return !selectedParcelle;
                  if (b === 'detenteur') return !parcelleDetails?.detenteur;
                  if (b === 'batiment') return !parcelleDetails?.batiments?.length;
                  if (b === 'valeur') return !parcelleDetails?.valeur;
                  return false;
                });
                return (
                  <div key={doc.code} className={`flex items-center justify-between p-3.5 rounded-xl border transition ${manque.length === 0 ? 'border-slate-200 hover:border-indigo-200' : 'border-slate-100 opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{doc.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">[{doc.code}] {doc.nom}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{(doc as any).format}</span>
                          <span className="text-[10px] font-bold text-green-600">{fmt(getTarif(doc.code))}</span>
                        </div>
                        {manque.length > 0 && <p className="text-[10px] text-amber-600 mt-0.5">Manque : {manque.join(', ')}</p>}
                      </div>
                    </div>
                    <button onClick={() => ouvrirWizard(doc.code, doc.nom, (doc as any).format, 'parcelle', doc.icon)} disabled={manque.length > 0} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${manque.length > 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                      <FileText className="h-3.5 w-3.5" />Demander
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MES DEMANDES ══════════ */}
      {activeSection === 'demandes' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-2 flex-wrap">
            {['', 'En attente de paiement', 'Payé', 'Délivré à crédit', 'Archivé'].map(s => (
              <button key={s} onClick={() => setFiltreStatut(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filtreStatut === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s === '' ? `Toutes (${demandes.length})` : `${s} (${demandes.filter(d => d.statut === s).length})`}
              </button>
            ))}
            <button onClick={loadDemandes} className="ml-auto text-xs text-indigo-600 font-semibold hover:underline">Rafraîchir</button>
          </div>

          {loadingDemandes ? (
            <div className="text-center py-12"><Loader2 className="h-7 w-7 text-indigo-600 animate-spin mx-auto" /></div>
          ) : demandesFiltrees.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl py-16 text-center">
              <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-semibold">Aucune demande</p>
            </div>
          ) : (
            <div className="space-y-2">
              {demandesFiltrees.map(d => {
                const peutTelecharger = d.statut === 'Payé' || d.statut === 'Délivré à crédit';
                return (
                  <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-bold text-indigo-600 text-sm">[{d.code_document}] {d.nom_document}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_BADGE[d.statut] || 'bg-slate-100'}`}>{d.statut}</span>
                        {d.nombre_exemplaires > 1 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">×{d.nombre_exemplaires}</span>}
                      </div>
                      <p className="text-xs text-slate-500">
                        {d.motif_demande} · {fmt(d.montant_total)} · {new Date(d.created_at).toLocaleDateString('fr-FR')}
                        {d.reference_document && <span className="font-mono ml-2 text-indigo-500">{d.reference_document}</span>}
                      </p>
                      {d.statut === 'Délivré à crédit' && d.credit_date_limite && (
                        <p className="text-[11px] text-purple-600 mt-0.5">⏳ Échéance crédit : {new Date(d.credit_date_limite).toLocaleDateString('fr-FR')} — autorisé par {d.credit_responsable}</p>
                      )}
                    </div>
                    {peutTelecharger ? (
                      <button onClick={() => handleTelecharger(d)} disabled={downloadingId === d.id} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-xs font-bold rounded-lg transition shrink-0">
                        {downloadingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {downloadingId === d.id ? 'Génération…' : d.telecharge_le ? 'Re-télécharger' : 'Télécharger'}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-600 text-xs font-semibold rounded-lg shrink-0"><Hourglass className="h-3.5 w-3.5" />En attente Caisse</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ CONFIG ══════════ */}
      {activeSection === 'config' && config && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">⚙️ Configuration du Fokontany</h3>
          <form onSubmit={e => { e.preventDefault(); updateConfig(config); alert('Configuration mise à jour !'); }} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[{k:'code_fokontany',l:'Code Fkt',ph:'AMB'},{k:'code_quartier',l:'Code Quartier',ph:'TSA'},{k:'code_carreau',l:'Code Carreau',ph:'C01'}].map(({k,l,ph})=>(
                <div key={k}><label className="text-xs font-bold text-slate-500 uppercase block mb-1">{l}</label><input value={(config as any)[k]||''} onChange={e=>setConfig((p:any)=>({...p,[k]:e.target.value}))} placeholder={ph} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 font-mono uppercase" /></div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[{k:'nom_fokontany',l:'Nom Fokontany'},{k:'nom_quartier',l:'Nom Quartier'},{k:'nom_commune',l:'Commune'},{k:'nom_district',l:'District'},{k:'chef_fokontany',l:'Chef Fokontany'}].map(({k,l})=>(
                <div key={k}><label className="text-xs font-bold text-slate-500 uppercase block mb-1">{l}</label><input value={(config as any)[k]||''} onChange={e=>setConfig((p:any)=>({...p,[k]:e.target.value}))} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500" /></div>
              ))}
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2">
              <p className="text-xs text-indigo-700 font-mono font-semibold">Format : {config.code_fokontany}-{config.code_quartier}-{config.code_carreau}-[CODE]-{new Date().getFullYear()}-0001</p>
            </div>
            <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4" />Enregistrer la configuration
            </button>
          </form>
        </div>
      )}

      {/* Wizard de demande */}
      {wizardDoc && (
        <WizardDemande
          code={wizardDoc.code} nom={wizardDoc.nom} format={wizardDoc.format} icon={wizardDoc.icon} niveau={wizardDoc.niveau}
          foyer={selectedFoyer || undefined} membre={selectedMembre || undefined} parcelle={selectedParcelle || undefined}
          membres={membres} tarif={getTarif(wizardDoc.code)}
          onClose={() => { setWizardDoc(null); }}
          onSubmit={handleWizardSubmit}
        />
      )}
    </div>
  );
}
