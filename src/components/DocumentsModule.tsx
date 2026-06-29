import React, { useState, useEffect } from 'react';
import { Membre, Foyer } from '../types';
import { supabase } from '../lib/supabase';
import {
  getConfig, updateConfig, ConfigFokontany,
  genererCR, genererCVI, genererCVC, genererCEL, genererBC,
  genererCM, genererFM, genererFFD, genererFAS, genererPCG,
  telechargerPDF, DOCUMENTS_ADMIN,
  genererCOT, genererJOR, genererADF, genererAPB, genererAMV,
  genererFP, genererFB, genererDRF, genererIFT, DOCUMENTS_FONCIERS
} from '../lib/documents';
import { Parcelle, Batiment, Detenteur, TitulaireFoncier, MiseEnValeur } from '../types';
import {
  FileText, Settings, Download, Clock, CheckCircle, Loader2, X,
  ChevronDown, User, Home, AlertCircle, Eye, Receipt, Printer,
  Search, CreditCard
} from 'lucide-react';

interface Props { foyers: Foyer[]; membres: Membre[]; }

interface DocGenere {
  id: string; reference: string; code_type: string;
  genere_le: string; foyer_id: string; membre_id: string;
}

// ── Modal Aperçu + Encaissement ───────────────────────────────
interface PreviewState {
  code: string;
  nom: string;
  format: string;
  icon: string;
  foyer?: Foyer;
  membre?: Membre;
  parcelle?: Parcelle;
  bytes?: Uint8Array;
  fileName?: string;
  tarif: number;
  extraData?: any;
}

function ModalPreviewEncaissement({
  preview, config, membres, onClose, onConfirm
}: {
  preview: PreviewState;
  config: any;
  membres: Membre[];
  onClose: () => void;
  onConfirm: (bytes: Uint8Array, fileName: string, encaisser: boolean, modePaiement: string) => void;
}) {
  const [encaisser, setEncaisser] = useState(true);
  const [modePaiement, setModePaiement] = useState('Espèces');
  const [confirming, setConfirming] = useState(false);

  const chef = preview.foyer ? membres.find(m => m.foyer_id === preview.foyer!.id && m.is_chef) : null;
  const beneficiaire = preview.membre ? `${preview.membre.nom} ${preview.membre.prenom}` : chef ? `${chef.nom} ${chef.prenom}` : preview.foyer?.code_menage || '-';
  const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n) + ' Ar';

  const handleConfirm = async () => {
    if (!preview.bytes || !preview.fileName) return;
    setConfirming(true);
    if (encaisser && preview.tarif > 0) {
      // Enregistrer l'encaissement automatiquement
      const annee = new Date().getFullYear();
      const { data: last } = await supabase.from('encaissements').select('reference').like('reference', `${config.prefixe_recu || 'REC'}-${annee}-%`).order('created_at', { ascending: false }).limit(1);
      const num = last?.[0]?.reference ? parseInt(last[0].reference.split('-').pop() || '0') + 1 : 1;
      const ref = `${config.prefixe_recu || 'REC'}-${annee}-${String(num).padStart(4, '0')}`;
      const { data: enc } = await supabase.from('encaissements').insert({
        reference: ref,
        foyer_id: preview.foyer?.id || null,
        membre_id: preview.membre?.id || null,
        nom_beneficiaire: beneficiaire,
        code_menage: preview.foyer?.code_menage || '-',
        montant_total: preview.tarif,
        mode_paiement: modePaiement,
        agent: 'Agent Fokontany',
      }).select().single();
      if (enc) {
        await supabase.from('encaissement_lignes').insert({
          encaissement_id: enc.id,
          categorie: 'Document',
          description: `[${preview.code}] ${preview.nom}`,
          montant: preview.tarif,
        });
        // Imprimer reçu
        printRecu(ref, beneficiaire, preview.foyer?.code_menage || '-', preview.nom, preview.code, preview.tarif, modePaiement);
      }
    }
    onConfirm(preview.bytes, preview.fileName, encaisser, modePaiement);
    setConfirming(false);
  };

  const printRecu = (ref: string, beneficiaire: string, menage: string, nomDoc: string, code: string, montant: number, mode: string) => {
    const w = window.open('', '_blank', 'width=420,height=500');
    if (!w) return;
    w.document.write(`<html><head><title>Reçu ${ref}</title><style>body{font-family:monospace;font-size:12px;margin:20px;max-width:320px}.title{font-size:16px;font-weight:bold;text-align:center}.sub{text-align:center;font-size:11px;margin-bottom:12px}hr{border:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between;margin:4px 0}.total{font-weight:bold;font-size:14px;border-top:2px solid black;padding-top:8px;margin-top:8px}.footer{text-align:center;margin-top:16px;font-size:10px}</style></head><body>`);
    w.document.write(`<div class="title">FOKONTANY FANISA</div><div class="sub">REÇU OFFICIEL</div><hr>`);
    w.document.write(`<div class="row"><span>Réf.:</span><span>${ref}</span></div>`);
    w.document.write(`<div class="row"><span>Date:</span><span>${new Date().toLocaleDateString('fr-FR')}</span></div>`);
    w.document.write(`<div class="row"><span>Ménage:</span><span>${menage}</span></div>`);
    w.document.write(`<div class="row"><span>Bénéficiaire:</span><span>${beneficiaire}</span></div><hr>`);
    w.document.write(`<div class="row"><span>[${code}] ${nomDoc}</span><span>${new Intl.NumberFormat('fr-MG').format(montant)} Ar</span></div>`);
    w.document.write(`<div class="total"><div class="row"><span>TOTAL</span><span>${new Intl.NumberFormat('fr-MG').format(montant)} Ar</span></div></div>`);
    w.document.write(`<div class="row"><span>Mode:</span><span>${mode}</span></div>`);
    w.document.write(`<div class="footer">Généré automatiquement par FANISA<br>Merci pour votre paiement</div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{preview.icon}</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Aperçu du document</h2>
              <p className="text-xs text-indigo-600 font-mono font-bold">[{preview.code}] {preview.nom}</p>
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Aperçu document */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Informations du document</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-400">Type :</span> <span className="font-bold text-slate-800">[{preview.code}] {preview.nom}</span></div>
              <div><span className="text-slate-400">Format :</span> <span className="font-semibold text-slate-600">{preview.format}</span></div>
              {preview.foyer && <div><span className="text-slate-400">Ménage :</span> <span className="font-mono font-bold text-indigo-700">{preview.foyer.code_menage}</span></div>}
              {preview.membre && <div><span className="text-slate-400">Membre :</span> <span className="font-semibold text-slate-700">{preview.membre.nom} {preview.membre.prenom}</span></div>}
              {preview.parcelle && <div><span className="text-slate-400">Parcelle :</span> <span className="font-mono font-bold text-indigo-700">LOT {preview.parcelle.numero_lot}</span></div>}
              <div><span className="text-slate-400">Bénéficiaire :</span> <span className="font-semibold text-slate-700">{beneficiaire}</span></div>
              <div><span className="text-slate-400">Date :</span> <span className="font-semibold text-slate-600">{new Date().toLocaleDateString('fr-FR')}</span></div>
            </div>
            {/* Données extras FFD */}
            {preview.extraData?.dateDeces && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs border-t border-indigo-100 pt-2">
                <div><span className="text-slate-400">Date décès :</span> <span className="font-semibold">{preview.extraData.dateDeces}</span></div>
                <div><span className="text-slate-400">Lieu décès :</span> <span className="font-semibold">{preview.extraData.lieuDeces}</span></div>
                <div><span className="text-slate-400">Déclarant :</span> <span className="font-semibold">{preview.extraData.declarant}</span></div>
              </div>
            )}
          </div>

          {/* Encaissement */}
          <div className={`border-2 rounded-xl p-4 space-y-3 transition ${encaisser ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-2"><Receipt className="h-4 w-4 text-green-600" />Encaissement associé</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-slate-500">{encaisser ? 'Activer' : 'Désactiver'}</span>
                <div className={`w-10 h-5 rounded-full transition ${encaisser ? 'bg-green-500' : 'bg-slate-300'}`} onClick={() => setEncaisser(!encaisser)}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${encaisser ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </label>
            </div>

            {preview.tarif > 0 ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Tarif du document</p>
                  <p className="text-xl font-black text-green-700">{fmt(preview.tarif)}</p>
                </div>
                {encaisser && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Mode de paiement</p>
                    <div className="flex gap-1.5">
                      {['Espèces', 'Mobile Money', 'Virement'].map(m => (
                        <button key={m} onClick={() => setModePaiement(m)} className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition ${modePaiement === m ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-200'}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Ce document est gratuit — aucun encaissement requis.</p>
            )}

            {encaisser && preview.tarif > 0 && (
              <div className="bg-green-100 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800 flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                Le reçu sera imprimé automatiquement et l'encaissement enregistré dans le module Finances.
              </div>
            )}
            {!encaisser && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">⚠ Encaissement désactivé — le document sera généré sans enregistrement financier.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={handleConfirm} disabled={confirming} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition">
            {confirming ? <><Loader2 className="h-4 w-4 animate-spin" />Génération…</> : <><Download className="h-4 w-4" />Télécharger{encaisser && preview.tarif > 0 ? ' & Encaisser' : ''}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal champs extra (FFD) ──────────────────────────────────
function ModalExtraFields({ code, onConfirm, onClose }: { code: string; onConfirm: (data: any) => void; onClose: () => void }) {
  const [dateDeces, setDateDeces] = useState('');
  const [lieuDeces, setLieuDeces] = useState('');
  const [declarant, setDeclarant] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-900">Informations du décès</h3>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Date du décès</label>
          <input type="date" value={dateDeces} onChange={e => setDateDeces(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Lieu du décès</label>
          <input value={lieuDeces} onChange={e => setLieuDeces(e.target.value)} placeholder="Ex: Domicile, Hôpital..." className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Déclarant</label>
          <input value={declarant} onChange={e => setDeclarant(e.target.value)} placeholder="Nom du déclarant" className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600">Annuler</button>
          <button onClick={() => onConfirm({ dateDeces, lieuDeces, declarant })} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold">Continuer →</button>
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────
export default function DocumentsModule({ foyers, membres }: Props) {
  const [config, setConfig] = useState<any>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [docHistory, setDocHistory] = useState<DocGenere[]>([]);
  const [activeSection, setActiveSection] = useState<'generer' | 'historique' | 'config'>('generer');

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

  // Preview & extra
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [showExtraFields, setShowExtraFields] = useState<string | null>(null);
  const [extraData, setExtraData] = useState<any>(null);

  const membresDuFoyer = selectedFoyer ? membres.filter(m => m.foyer_id === selectedFoyer.id) : [];
  const filteredFoyers = foyers.filter(f => {
    const q = searchFoyer.toLowerCase();
    const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
    return f.code_menage.toLowerCase().includes(q) || (chef ? `${chef.nom} ${chef.prenom}`.toLowerCase().includes(q) : false) || (f.adresse || '').toLowerCase().includes(q);
  });

  useEffect(() => {
    getConfig().then(setConfig);
    loadHistory();
    supabase.from('parcelles').select('*').order('created_at', { ascending: false }).then(({ data }) => setParcelles((data || []) as Parcelle[]));
  }, []);

  const loadHistory = async () => {
    const { data } = await supabase.from('documents_generes').select('*').order('genere_le', { ascending: false }).limit(50);
    setDocHistory((data || []) as DocGenere[]);
  };

  const loadParcelleDetails = async (parcelle: Parcelle) => {
    const [t, d, b, v] = await Promise.all([
      supabase.from('titulaires_fonciers').select('*').eq('parcelle_id', parcelle.id).single(),
      supabase.from('detenteurs').select('*').eq('parcelle_id', parcelle.id).single(),
      supabase.from('batiments').select('*').eq('parcelle_id', parcelle.id),
      supabase.from('mises_en_valeur').select('*').eq('parcelle_id', parcelle.id).single(),
    ]);
    setParcelleDetails({ titulaire: t.data, detenteur: d.data, batiments: b.data || [], valeur: v.data });
    return { titulaire: t.data, detenteur: d.data, batiments: b.data || [], valeur: v.data };
  };

  // Obtenir le tarif depuis la config
  const getTarif = (code: string): number => {
    const key = `tarif_${code.toLowerCase()}`;
    return config[key] || 2000;
  };

  // Préparer le preview (génère les bytes en avance)
  const preparePreview = async (code: string, extraDataParam?: any) => {
    if (!config) return;
    const docAdmin = DOCUMENTS_ADMIN.find(d => d.code === code);
    const docFoncier = DOCUMENTS_FONCIERS.find(d => d.code === code);
    const doc = docAdmin || docFoncier;
    if (!doc) return;

    if (docAdmin?.niveau === 'membre' && !selectedMembre) { alert('Sélectionnez un membre.'); return; }
    if (docAdmin?.niveau === 'foyer' && !selectedFoyer) { alert('Sélectionnez un foyer.'); return; }
    if (docFoncier && !selectedParcelle) { alert('Sélectionnez une parcelle.'); return; }

    // Cas FFD — besoin des champs extra d'abord
    if (code === 'FFD' && !extraDataParam) { setShowExtraFields('FFD'); return; }

    setGenerating(code);
    try {
      let bytes: Uint8Array;
      const foyer = selectedFoyer!;
      const membre = selectedMembre!;
      const pdet = parcelleDetails || (selectedParcelle ? await loadParcelleDetails(selectedParcelle) : null);
      const bat = pdet?.batiments?.[0] || {} as Batiment;
      const ed = extraDataParam || extraData;

      switch (code) {
        case 'CR':  bytes = await genererCR(membre, foyer, config); break;
        case 'CVI': bytes = await genererCVI(membre, foyer, config); break;
        case 'CVC': bytes = await genererCVC(foyer, membresDuFoyer, config); break;
        case 'CEL': bytes = await genererCEL(membre, foyer, config); break;
        case 'BC':  bytes = await genererBC(membre, foyer, config); break;
        case 'CM':  bytes = await genererCM(foyer, membresDuFoyer, config); break;
        case 'FM':  bytes = await genererFM(foyer, membresDuFoyer, config); break;
        case 'FFD': bytes = await genererFFD(membre, foyer, config, ed?.dateDeces, ed?.lieuDeces, ed?.declarant); break;
        case 'FAS': bytes = await genererFAS(membre, foyer, config); break;
        case 'PCG': bytes = await genererPCG(membre, foyer, config, membresDuFoyer.find(m => m.is_chef)); break;
        case 'COT': bytes = await genererCOT(selectedParcelle!, pdet?.detenteur!, config); break;
        case 'JOR': bytes = await genererJOR(selectedParcelle!, pdet?.detenteur!, config); break;
        case 'ADF': bytes = await genererADF(selectedParcelle!, pdet?.detenteur!, config); break;
        case 'APB': bytes = await genererAPB(selectedParcelle!, bat, {}, config); break;
        case 'AMV': bytes = await genererAMV(selectedParcelle!, pdet?.valeur!, pdet?.detenteur!, config); break;
        case 'FP':  bytes = await genererFP(selectedParcelle!, pdet?.titulaire||null, pdet?.detenteur||null, pdet?.batiments||[], pdet?.valeur||null, config); break;
        case 'FB':  bytes = await genererFB(selectedParcelle!, bat, config); break;
        case 'DRF': bytes = await genererDRF(selectedParcelle!, pdet?.detenteur||null, pdet?.titulaire||null, pdet?.batiments||[], pdet?.valeur||null, config); break;
        case 'IFT': bytes = await genererIFT(selectedParcelle!, bat||null, pdet?.titulaire||null, pdet?.detenteur||null, config); break;
        default: throw new Error('Document non implémenté');
      }

      const nomFichier = docAdmin?.niveau === 'membre'
        ? `${code}_${membre.nom}_${membre.prenom}_${new Date().getFullYear()}.pdf`
        : docAdmin?.niveau === 'foyer'
        ? `${code}_${foyer.code_menage}_${new Date().getFullYear()}.pdf`
        : `${code}_LOT${selectedParcelle?.numero_lot}_${new Date().getFullYear()}.pdf`;

      setPreview({
        code,
        nom: doc.nom,
        format: (doc as any).format || 'A5 Paysage',
        icon: (doc as any).icon || '📄',
        foyer: selectedFoyer || undefined,
        membre: selectedMembre || undefined,
        parcelle: selectedParcelle || undefined,
        bytes,
        fileName: nomFichier,
        tarif: getTarif(code),
        extraData: ed,
      });
    } catch (e) {
      alert('Erreur génération : ' + e);
    }
    setGenerating(null);
  };

  const handleConfirmDownload = async (bytes: Uint8Array, fileName: string) => {
    await telechargerPDF(bytes, fileName);
    await loadHistory();
    setPreview(null);
  };

  // Bouton "Générer" → prépare l'aperçu
  const btnGenerer = (code: string, disabled: boolean) => (
    <button
      onClick={() => !disabled && preparePreview(code)}
      disabled={disabled || generating === code}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 ${disabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
    >
      {generating === code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
      {generating === code ? '...' : 'Aperçu'}
    </button>
  );

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
            {(['generer', 'historique', 'config'] as const).map(s => (
              <button key={s} onClick={() => setActiveSection(s)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${activeSection === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s === 'generer' ? '📄 Générer' : s === 'historique' ? '🕐 Historique' : '⚙️ Config'}
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

      {activeSection === 'generer' && (
        <div className="space-y-4">
          {/* Docs administratifs individuel */}
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
                        <span className="text-[10px] font-bold text-green-600">{new Intl.NumberFormat('fr-MG').format(config[`tarif_${doc.code.toLowerCase()}`] || 2000)} Ar</span>
                      </div>
                    </div>
                  </div>
                  {btnGenerer(doc.code, !selectedMembre)}
                </div>
              ))}
            </div>
          </div>

          {/* Docs foyer */}
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
                        <span className="text-[10px] font-bold text-green-600">{new Intl.NumberFormat('fr-MG').format(config[`tarif_${doc.code.toLowerCase()}`] || 2000)} Ar</span>
                      </div>
                    </div>
                  </div>
                  {btnGenerer(doc.code, !selectedFoyer)}
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
            {/* Sélecteur parcelle */}
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
                          <span className="text-[10px] font-bold text-green-600">{new Intl.NumberFormat('fr-MG').format(config[`tarif_${doc.code.toLowerCase()}`] || 2000)} Ar</span>
                        </div>
                        {manque.length > 0 && <p className="text-[10px] text-amber-600 mt-0.5">Manque : {manque.join(', ')}</p>}
                      </div>
                    </div>
                    {btnGenerer(doc.code, manque.length > 0)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Historique */}
      {activeSection === 'historique' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Clock className="h-4 w-4 text-indigo-600" />Documents générés ({docHistory.length})</h3>
            <button onClick={loadHistory} className="text-xs text-indigo-600 font-semibold hover:underline">Rafraîchir</button>
          </div>
          {docHistory.length === 0 ? <p className="text-center text-slate-400 text-sm py-10">Aucun document généré.</p> : (
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b border-slate-100"><th className="p-3 text-left font-semibold text-slate-500">Référence</th><th className="p-3 text-left font-semibold text-slate-500">Type</th><th className="p-3 text-left font-semibold text-slate-500">Date</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {docHistory.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-indigo-600 font-semibold">{d.reference}</td>
                    <td className="p-3"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold">{d.code_type}</span></td>
                    <td className="p-3 text-slate-500">{new Date(d.genere_le).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Config */}
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

      {/* Modal extra fields (FFD) */}
      {showExtraFields === 'FFD' && (
        <ModalExtraFields
          code="FFD"
          onConfirm={data => { setExtraData(data); setShowExtraFields(null); preparePreview('FFD', data); }}
          onClose={() => setShowExtraFields(null)}
        />
      )}

      {/* Modal aperçu + encaissement */}
      {preview && (
        <ModalPreviewEncaissement
          preview={preview}
          config={config}
          membres={membres}
          onClose={() => setPreview(null)}
          onConfirm={handleConfirmDownload}
        />
      )}
    </div>
  );
}
