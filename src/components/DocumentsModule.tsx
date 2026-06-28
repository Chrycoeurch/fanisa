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
import { FileText, Settings, Search, Download, Clock, CheckCircle, Loader2, X, ChevronDown, User, Home, AlertCircle } from 'lucide-react';

interface Props {
  foyers: Foyer[];
  membres: Membre[];
}

interface DocGenere {
  id: string;
  reference: string;
  code_type: string;
  genere_le: string;
  foyer_id: string;
  membre_id: string;
}

export default function DocumentsModule({ foyers, membres }: Props) {
  const [config, setConfig] = useState<ConfigFokontany | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [docHistory, setDocHistory] = useState<DocGenere[]>([]);
  // Foncier
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [selectedParcelle, setSelectedParcelle] = useState<Parcelle | null>(null);
  const [parcelleDetails, setParcelleDetails] = useState<{ titulaire?: TitulaireFoncier; detenteur?: Detenteur; batiments?: Batiment[]; valeur?: MiseEnValeur } | null>(null);
  const [selectedBatiment, setSelectedBatiment] = useState<Batiment | null>(null);
  const [showParcelleSearch, setShowParcelleSearch] = useState(false);
  const [searchParcelle, setSearchParcelle] = useState('');
  const [searchFoyer, setSearchFoyer] = useState('');
  const [selectedFoyer, setSelectedFoyer] = useState<Foyer | null>(null);
  const [selectedMembre, setSelectedMembre] = useState<Membre | null>(null);
  const [showFoyerSearch, setShowFoyerSearch] = useState(false);
  const [showMembreSearch, setShowMembreSearch] = useState(false);
  const [activeSection, setActiveSection] = useState<'generer' | 'historique' | 'config'>('generer');
  // Champs supplémentaires pour certains docs
  const [datesDeces, setDatesDeces] = useState('');
  const [lieuDeces, setLieuDeces] = useState('');
  const [declarant, setDeclarant] = useState('');
  const [showExtraFields, setShowExtraFields] = useState<string | null>(null);

  useEffect(() => {
    getConfig().then(setConfig);
    loadHistory();
    supabase.from('parcelles').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setParcelles((data || []) as Parcelle[]));
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
    setParcelleDetails({ titulaire: t.data || undefined, detenteur: d.data || undefined, batiments: b.data || [], valeur: v.data || undefined });
    setSelectedBatiment(b.data?.[0] || null);
  };

  const handleGenererFoncier = async (code: string) => {
    if (!config || !selectedParcelle || !parcelleDetails) return;
    setGenerating(code);
    try {
      let bytes: Uint8Array;
      const { titulaire, detenteur, batiments, valeur } = parcelleDetails;
      const bat = selectedBatiment || batiments?.[0] || {} as Batiment;
      switch (code) {
        case 'COT': bytes = await genererCOT(selectedParcelle, detenteur!, config); break;
        case 'JOR': bytes = await genererJOR(selectedParcelle, detenteur!, config); break;
        case 'ADF': bytes = await genererADF(selectedParcelle, detenteur!, config); break;
        case 'APB': bytes = await genererAPB(selectedParcelle, bat, {}, config); break;
        case 'AMV': bytes = await genererAMV(selectedParcelle, valeur!, detenteur!, config); break;
        case 'FP':  bytes = await genererFP(selectedParcelle, titulaire || null, detenteur || null, batiments || [], valeur || null, config); break;
        case 'FB':  bytes = await genererFB(selectedParcelle, bat, config); break;
        case 'DRF': bytes = await genererDRF(selectedParcelle, detenteur || null, titulaire || null, batiments || [], valeur || null, config); break;
        case 'IFT': bytes = await genererIFT(selectedParcelle, bat || null, titulaire || null, detenteur || null, config); break;
        default: throw new Error('Document non implémenté');
      }
      await telechargerPDF(bytes, `${code}_LOT${selectedParcelle.numero_lot}_${new Date().getFullYear()}.pdf`);
      await loadHistory();
    } catch (e) { alert('Erreur : ' + e); }
    setGenerating(null);
  };

  const membresDuFoyer = selectedFoyer ? membres.filter(m => m.foyer_id === selectedFoyer.id) : [];
  const filteredFoyers = foyers.filter(f => {
    const q = searchFoyer.toLowerCase();
    const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
    return f.code_menage.toLowerCase().includes(q) || (chef && `${chef.nom} ${chef.prenom}`.toLowerCase().includes(q)) || (f.adresse || '').toLowerCase().includes(q);
  });

  const handleGenerer = async (code: string) => {
    if (!config) return;
    const docInfo = DOCUMENTS_ADMIN.find(d => d.code === code);
    if (!docInfo) return;

    // Vérifications
    if (docInfo.niveau === 'membre' && !selectedMembre) { alert('Sélectionnez un membre pour ce document.'); return; }
    if (docInfo.niveau === 'foyer' && !selectedFoyer) { alert('Sélectionnez un foyer pour ce document.'); return; }
    if ((code === 'FFD') && !datesDeces && showExtraFields !== code) { setShowExtraFields(code); return; }

    setGenerating(code);
    try {
      let bytes: Uint8Array;
      const foyer = selectedFoyer!;
      const membre = selectedMembre!;
      const chef = membresDuFoyer.find(m => m.is_chef);

      switch (code) {
        case 'CR': bytes = await genererCR(membre, foyer, config); break;
        case 'CVI': bytes = await genererCVI(membre, foyer, config); break;
        case 'CVC': bytes = await genererCVC(foyer, membresDuFoyer, config); break;
        case 'CEL': bytes = await genererCEL(membre, foyer, config); break;
        case 'BC': bytes = await genererBC(membre, foyer, config); break;
        case 'CM': bytes = await genererCM(foyer, membresDuFoyer, config); break;
        case 'FM': bytes = await genererFM(foyer, membresDuFoyer, config); break;
        case 'FFD': bytes = await genererFFD(membre, foyer, config, datesDeces, lieuDeces, declarant); break;
        case 'FAS': bytes = await genererFAS(membre, foyer, config); break;
        case 'PCG': bytes = await genererPCG(membre, foyer, config, chef); break;
        default: throw new Error('Document non implémenté');
      }

      const nom = selectedMembre ? `${selectedMembre.nom}_${selectedMembre.prenom}` : foyer.code_menage;
      await telechargerPDF(bytes, `${code}_${nom}_${new Date().getFullYear()}.pdf`);
      await loadHistory();
      setShowExtraFields(null);
    } catch (e) {
      alert('Erreur : ' + e);
    }
    setGenerating(null);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    await updateConfig(config);
    setShowConfig(false);
    alert('Configuration mise à jour !');
  };

  // Grouper docs par niveau
  const docsNiveauMembre = DOCUMENTS_ADMIN.filter(d => d.niveau === 'membre');
  const docsNiveauFoyer = DOCUMENTS_ADMIN.filter(d => d.niveau === 'foyer');

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
            {['generer', 'historique', 'config'].map(s => (
              <button key={s} onClick={() => setActiveSection(s as any)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${activeSection === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s === 'generer' ? '📄 Générer' : s === 'historique' ? '🕐 Historique' : '⚙️ Config'}
              </button>
            ))}
          </div>
        </div>

        {/* Sélection contexte */}
        {activeSection === 'generer' && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            {/* Foyer */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Foyer / Ménage</label>
              <div className="relative">
                <button onClick={() => setShowFoyerSearch(!showFoyerSearch)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition ${selectedFoyer ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                  <span className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    {selectedFoyer ? `${selectedFoyer.code_menage} · ${selectedFoyer.adresse || selectedFoyer.fokontany || ''}` : 'Sélectionner un foyer...'}
                  </span>
                  <div className="flex gap-1">
                    {selectedFoyer && <button type="button" onClick={e => { e.stopPropagation(); setSelectedFoyer(null); setSelectedMembre(null); }} className="text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
                {showFoyerSearch && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto">
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                      <input autoFocus value={searchFoyer} onChange={e => setSearchFoyer(e.target.value)} placeholder="Rechercher foyer..." className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg outline-none" />
                    </div>
                    {filteredFoyers.map(f => {
                      const chef = membres.find(m => m.foyer_id === f.id && m.is_chef);
                      return (
                        <button key={f.id} onClick={() => { setSelectedFoyer(f); setSelectedMembre(null); setShowFoyerSearch(false); setSearchFoyer(''); }} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition text-xs border-b border-slate-50">
                          <span className="font-mono font-bold text-indigo-600">{f.code_menage}</span>
                          <span className="text-slate-600 ml-2">{chef ? `${chef.nom} ${chef.prenom}` : ''}</span>
                          <span className="text-slate-400 ml-2">{f.adresse || f.fokontany}</span>
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
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {selectedMembre ? `${selectedMembre.nom} ${selectedMembre.prenom} (${selectedMembre.relation_chef})` : 'Sélectionner un membre...'}
                  </span>
                  <div className="flex gap-1">
                    {selectedMembre && <button type="button" onClick={e => { e.stopPropagation(); setSelectedMembre(null); }} className="text-slate-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
                {showMembreSearch && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto">
                    {membresDuFoyer.map(m => (
                      <button key={m.id} onClick={() => { setSelectedMembre(m); setShowMembreSearch(false); }} className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition text-xs border-b border-slate-50 flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${m.sexe === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>{m.prenom?.charAt(0)}</div>
                        <span className="font-semibold text-slate-800">{m.nom} {m.prenom}</span>
                        <span className="text-slate-400">{m.relation_chef}</span>
                        {m.is_chef && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">Chef</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section Générer */}
      {activeSection === 'generer' && (
        <div className="space-y-4">
          {/* Docs niveau membre */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><User className="h-3.5 w-3.5" />Documents individuels <span className="text-slate-400 font-normal normal-case">(nécessitent un membre sélectionné)</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {docsNiveauMembre.map(doc => (
                <div key={doc.code}>
                  <div className={`flex items-center justify-between p-3.5 rounded-xl border transition ${selectedMembre ? 'border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30' : 'border-slate-100 opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{doc.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">[{doc.code}] {doc.nom}</p>
                        <p className="text-xs text-slate-400">{doc.description}</p>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{(doc as any).format}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { if (doc.code === 'FFD') setShowExtraFields('FFD'); handleGenerer(doc.code); }}
                      disabled={!selectedMembre || generating === doc.code}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition shrink-0"
                    >
                      {generating === doc.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      {generating === doc.code ? '...' : 'Générer'}
                    </button>
                  </div>
                  {/* Champs extra pour FFD */}
                  {showExtraFields === 'FFD' && doc.code === 'FFD' && (
                    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-slate-600">Informations du décès</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div><label className="text-[10px] text-slate-400 uppercase block mb-1">Date du décès</label><input type="date" value={datesDeces} onChange={e => setDatesDeces(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400" /></div>
                        <div><label className="text-[10px] text-slate-400 uppercase block mb-1">Lieu du décès</label><input value={lieuDeces} onChange={e => setLieuDeces(e.target.value)} placeholder="Ex: Domicile" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400" /></div>
                        <div><label className="text-[10px] text-slate-400 uppercase block mb-1">Déclarant</label><input value={declarant} onChange={e => setDeclarant(e.target.value)} placeholder="Nom du déclarant" className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400" /></div>
                      </div>
                      <button onClick={() => handleGenerer('FFD')} disabled={generating === 'FFD'} className="w-full py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1.5">
                        {generating === 'FFD' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Générer la déclaration
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Docs niveau foyer */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Home className="h-3.5 w-3.5" />Documents du foyer <span className="text-slate-400 font-normal normal-case">(nécessitent un foyer sélectionné)</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {docsNiveauFoyer.map(doc => (
                <div key={doc.code} className={`flex items-center justify-between p-3.5 rounded-xl border transition ${selectedFoyer ? 'border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30' : 'border-slate-100 opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{doc.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">[{doc.code}] {doc.nom}</p>
                      <p className="text-xs text-slate-400">{doc.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleGenerer(doc.code)}
                    disabled={!selectedFoyer || generating === doc.code}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition shrink-0"
                  >
                    {generating === doc.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {generating === doc.code ? '...' : 'Générer'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {!selectedFoyer && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700">Sélectionnez d'abord un <strong>foyer</strong>, puis un <strong>membre</strong> pour pouvoir générer les documents.</p>
            </div>
          )}

          {/* Documents fonciers */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">🌍 Documents fonciers <span className="text-slate-400 font-normal normal-case">(nécessitent une parcelle sélectionnée)</span></h3>

            {/* Sélection parcelle */}
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Parcelle / Lot</label>
              <div className="relative">
                <button onClick={() => setShowParcelleSearch(!showParcelleSearch)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition ${selectedParcelle ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                  <span className="flex items-center gap-2">🌍 {selectedParcelle ? `LOT ${selectedParcelle.numero_lot} · ${selectedParcelle.adresse || selectedParcelle.fokontany || ''}` : 'Sélectionner une parcelle...'}</span>
                  {selectedParcelle && <button type="button" onClick={e => { e.stopPropagation(); setSelectedParcelle(null); setParcelleDetails(null); }} className="text-slate-400 hover:text-red-500 mr-1"><X className="h-3.5 w-3.5" /></button>}
                </button>
                {showParcelleSearch && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
                    <div className="p-2 border-b sticky top-0 bg-white"><input autoFocus value={searchParcelle} onChange={e => setSearchParcelle(e.target.value)} placeholder="Rechercher lot..." className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded-lg outline-none" /></div>
                    {parcelles.filter(p => (p.numero_lot || '').toLowerCase().includes(searchParcelle.toLowerCase()) || (p.adresse || '').toLowerCase().includes(searchParcelle.toLowerCase())).map(p => (
                      <button key={p.id} onClick={async () => { setSelectedParcelle(p); setShowParcelleSearch(false); await loadParcelleDetails(p); }} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-xs border-b border-slate-50">
                        <span className="font-mono font-bold text-indigo-600">LOT {p.numero_lot}</span>
                        <span className="text-slate-500 ml-2">{p.adresse || p.fokontany}</span>
                        <span className="text-slate-400 ml-2">{p.usage}</span>
                      </button>
                    ))}
                    {parcelles.length === 0 && <p className="text-center text-slate-400 text-xs py-4">Aucune parcelle — créez-en dans le module Foncier</p>}
                  </div>
                )}
              </div>
              {selectedParcelle && parcelleDetails && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {parcelleDetails.titulaire && <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🏛 Titulaire : {parcelleDetails.titulaire.nom}</span>}
                  {parcelleDetails.detenteur && <span className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full font-semibold">📜 Détenteur : {parcelleDetails.detenteur.nom}</span>}
                  {parcelleDetails.batiments?.length ? <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">🏠 {parcelleDetails.batiments.length} bâtiment(s)</span> : null}
                  {parcelleDetails.valeur && <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">🌿 Mise en valeur</span>}
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
                const canGenerate = manque.length === 0;
                return (
                  <div key={doc.code} className={`flex items-center justify-between p-3.5 rounded-xl border transition ${canGenerate ? 'border-slate-200 hover:border-indigo-200' : 'border-slate-100 opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{doc.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">[{doc.code}] {doc.nom}</p>
                        <p className="text-xs text-slate-400">{doc.description}</p>
                        {!canGenerate && <p className="text-[10px] text-amber-600 mt-0.5">Manque : {manque.join(', ')}</p>}
                      </div>
                    </div>
                    <button onClick={() => handleGenererFoncier(doc.code)} disabled={!canGenerate || generating === doc.code}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition shrink-0">
                      {generating === doc.code ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      {generating === doc.code ? '...' : 'Générer'}
                    </button>
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
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Clock className="h-4 w-4 text-indigo-600" />Documents générés récemment</h3>
            <button onClick={loadHistory} className="text-xs text-indigo-600 font-semibold hover:underline">Rafraîchir</button>
          </div>
          {docHistory.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">Aucun document généré pour le moment.</p>
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 border-b border-slate-100"><th className="p-3 text-left font-semibold text-slate-500 uppercase text-[10px]">Référence</th><th className="p-3 text-left font-semibold text-slate-500 uppercase text-[10px]">Type</th><th className="p-3 text-left font-semibold text-slate-500 uppercase text-[10px]">Date</th></tr></thead>
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
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Settings className="h-4 w-4 text-indigo-600" />Configuration du Fokontany</h3>
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: 'code_fokontany', l: 'Code Fokontany', ph: 'AMB' },
                { k: 'code_quartier', l: 'Code Quartier', ph: 'TSA' },
                { k: 'code_carreau', l: 'Code Carreau', ph: 'C01' },
              ].map(({ k, l, ph }) => (
                <div key={k}>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{l}</label>
                  <input value={(config as any)[k]} onChange={e => setConfig({ ...config, [k]: e.target.value })} placeholder={ph} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none font-mono uppercase" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: 'nom_fokontany', l: 'Nom du Fokontany', ph: 'Ambodisaina' },
                { k: 'nom_quartier', l: 'Nom du Quartier', ph: 'Tsararivotra' },
                { k: 'nom_commune', l: 'Commune', ph: 'Toamasina' },
                { k: 'nom_district', l: 'District', ph: 'Toamasina II' },
                { k: 'chef_fokontany', l: 'Nom du Chef Fokontany', ph: 'Nom Prénom' },
              ].map(({ k, l, ph }) => (
                <div key={k}>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{l}</label>
                  <input value={(config as any)[k]} onChange={e => setConfig({ ...config, [k]: e.target.value })} placeholder={ph} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none" />
                </div>
              ))}
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2">
              <p className="text-xs text-indigo-700 font-mono font-semibold">Format référence : {config.code_fokontany}-{config.code_quartier}-{config.code_carreau}-[CODE]-{new Date().getFullYear()}-0001</p>
            </div>
            <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition">
              <CheckCircle className="h-4 w-4" />Enregistrer la configuration
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
