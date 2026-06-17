import React, { useState, useMemo, useRef } from 'react';
import { Habitant, HistoriqueLog } from '../types';
import { Printer, FileText, Users, Award, ShieldAlert, Check, Search, Coins, Scale, FileSignature, FileHeart, ClipboardCheck } from 'lucide-react';

interface DocumentGeneratorProps {
  habitants: Habitant[];
  onLoggedAction: (action: HistoriqueLog['action'], details: string) => void;
}

type ExtendedDocType = 'residence' | 'fiche' | 'celibat' | 'indigence' | 'civisme' | 'menage_collectif';

export default function DocumentGenerator({ habitants, onLoggedAction }: DocumentGeneratorProps) {
  // Search state to locate resident
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');

  // Active document type
  const [docType, setDocType] = useState<ExtendedDocType>('residence');

  // Custom document parameters
  const [serialNumber, setSerialNumber] = useState(() => `${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`);
  const [purpose, setPurpose] = useState('Constitution de dossier administratif');
  const [authoritySignature, setAuthoritySignature] = useState('Ravelomanantsoa (Chef de Fokontany)');
  const [authorityTitle, setAuthorityTitle] = useState('Le Chef de Fokontany');
  const [stampFee, setStampFee] = useState('1 000 Ar');
  const [additionalNote, setAdditionalNote] = useState('');
  
  // Custom states for specfic docs
  const [indigenceReason, setIndigenceReason] = useState('Sans ressources suffisantes / En recherche de réinsertion');
  const [conductStatus, setConductStatus] = useState('Excellente - Citoyen engagé et respectueux des règlements locaux');

  // Printing reference
  const printRef = useRef<HTMLDivElement>(null);

  // Filter residents based on search query for auto-complete dropdown
  const searchedResidents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return habitants.filter(h => 
      h.nom.toLowerCase().includes(q) || 
      h.prenom.toLowerCase().includes(q) || 
      (h.cin && h.cin.includes(q)) ||
      h.famille.codeMenage.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [searchQuery, habitants]);

  // Find the selected resident
  const activeResident = useMemo(() => {
    return habitants.find(h => h.id === selectedResidentId) || null;
  }, [selectedResidentId, habitants]);

  // Calculate age helper
  const calculateAge = (dateN: string) => {
    const birthday = new Date(dateN);
    const ageDifMs = Date.now() - birthday.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  // Find other family members (for Document: Fiche de Ménage Collective)
  const householdMembers = useMemo(() => {
    if (!activeResident) return [];
    return habitants.filter(h => h.famille.codeMenage === activeResident.famille.codeMenage);
  }, [activeResident, habitants]);

  // Regenerate serial number
  const handleRegenerateSerial = () => {
    setSerialNumber(`${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`);
  };

  // Handle printing
  const handlePrint = () => {
    if (!activeResident) return;
    
    let docLabel = 'Certificat de Résidence';
    if (docType === 'fiche') docLabel = 'Fiche Individuelle';
    else if (docType === 'celibat') docLabel = 'Certificat de Célibat';
    else if (docType === 'indigence') docLabel = "Certificat d'Indigence";
    else if (docType === 'civisme') docLabel = 'Attestation de Civisme et Bonne Conduite';
    else if (docType === 'menage_collectif') docLabel = 'Fiche de Ménage Collective';

    onLoggedAction(
      'Certificat généré', 
      `Génération officielle de l'acte [${docLabel}] Nº ${serialNumber} pour ${activeResident.nom} ${activeResident.prenom} (Fokontany: ${activeResident.residence.fokontany}, Destination: ${purpose})`
    );

    // Apply quick print styled workflow
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body { 
          background: white !important; 
          color: black !important; 
          font-family: serif !important; 
        }
        .no-print { 
          display: none !important; 
        }
        .print-container { 
          padding: 30px !important; 
          border: none !important; 
          max-width: 100% !important; 
          width: 100% !important; 
          box-shadow: none !important; 
          margin: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  // Pre-fill purpose presets
  const purposePresets = [
    'Constitution de dossier administratif',
    "Dossier de demande d'emploi",
    'Demande de passeport',
    'Inscription scolaire / Universitaire',
    'Ouverture de compte bancaire',
    'Candidature officielle'
  ];

  return (
    <div id="document-generator-module" className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden min-h-[750px] flex flex-col xl:flex-row">
      
      {/* LEFT HAND: CONTROL SUITE PANEL */}
      <div id="doc-generator-controls" className="w-full xl:w-[420px] bg-slate-50 border-r border-slate-200 p-6 flex flex-col justify-between space-y-6 shrink-0">
        <div className="space-y-5">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center">
              <FileSignature className="h-4.5 w-4.5 text-indigo-600 mr-2 shrink-0" />
              <span>Générateur Officiel d'Actes</span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Sélectionnez un résident inscrit pour dresser un acte numérisé avec sceau officiel du Fokontany.
            </p>
          </div>

          {/* 1. RESIDENT SELECTOR */}
          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">1. Recherche de l'administré</label>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text"
                placeholder="Entrez le nom, prénom ou n° de CIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-hidden font-sans text-slate-800"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 font-bold text-xs"
                >
                  ×
                </button>
              )}
            </div>

            {/* Auto-complete suggestions */}
            {searchedResidents.length > 0 && (
              <div id="autocomplete-residents-results" className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {searchedResidents.map(res => (
                  <button
                    key={res.id}
                    onClick={() => {
                      setSelectedResidentId(res.id);
                      setSearchQuery('');
                    }}
                    className="w-full text-left p-2.5 px-3 hover:bg-indigo-50 text-xs transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{res.nom} {res.prenom}</p>
                      <p className="text-[10px] text-slate-500">Ménage : {res.famille.codeMenage} • Fokontany : {res.residence.fokontany}</p>
                    </div>
                    {res.cin && <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1 font-mono">{res.cin}</span>}
                  </button>
                ))}
              </div>
            )}

            {activeResident ? (
              <div id="active-selected-badge" className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between mt-2">
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-emerald-800 uppercase bg-emerald-100/70 border border-emerald-200/50 rounded px-1.5 py-0.5 tracking-wider select-none">Sélectionné</span>
                  <p className="text-xs font-bold text-slate-950 mt-1 truncate">{activeResident.nom} {activeResident.prenom}</p>
                  <p className="text-[10px] text-slate-500 font-mono">CIN : {activeResident.cin || 'Non enregistrée'}</p>
                </div>
                <button 
                  onClick={() => setSelectedResidentId('')}
                  className="p-1 text-slate-400 hover:text-red-500"
                  title="Désélectionner"
                >
                  <ShieldAlert className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-[11px] text-indigo-900 leading-relaxed font-sans mt-2">
                ✍️ Utilisez la zone ci-dessus pour chercher un citoyen résident du Fokontany.
              </div>
            )}
          </div>

          {/* 2. CHOOSE DOCUMENT TYPE */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">2. Type d'acte administratif</label>
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              <button 
                onClick={() => setDocType('residence')}
                disabled={!activeResident}
                className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-all border flex items-center space-x-2 ${
                  docType === 'residence' 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 disabled:opacity-40 disabled:hover:bg-white'
                }`}
              >
                <ClipboardCheck className="h-4 w-4 shrink-0" />
                <span>Certificat de Résidence</span>
              </button>

              <button 
                onClick={() => setDocType('fiche')}
                disabled={!activeResident}
                className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-all border flex items-center space-x-2 ${
                  docType === 'fiche' 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 disabled:opacity-40 disabled:hover:bg-white'
                }`}
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span>Fiche Individuelle</span>
              </button>

              <button 
                onClick={() => setDocType('celibat')}
                disabled={!activeResident}
                className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-all border flex items-center space-x-2 ${
                  docType === 'celibat' 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 disabled:opacity-40 disabled:hover:bg-white'
                }`}
              >
                <FileHeart className="h-4 w-4 shrink-0" />
                <span>Certificat de Célibat / Vie Libre</span>
              </button>

              <button 
                onClick={() => setDocType('indigence')}
                disabled={!activeResident}
                className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-all border flex items-center space-x-2 ${
                  docType === 'indigence' 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 disabled:opacity-40 disabled:hover:bg-white'
                }`}
              >
                <Coins className="h-4 w-4 shrink-0" />
                <span>Certificat d'Indigence</span>
              </button>

              <button 
                onClick={() => setDocType('civisme')}
                disabled={!activeResident}
                className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-all border flex items-center space-x-2 ${
                  docType === 'civisme' 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 disabled:opacity-40 disabled:hover:bg-white'
                }`}
              >
                <Scale className="h-4 w-4 shrink-0" />
                <span>Certificat de Civisme / Conduite</span>
              </button>

              <button 
                onClick={() => setDocType('menage_collectif')}
                disabled={!activeResident}
                className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition-all border flex items-center space-x-2 ${
                  docType === 'menage_collectif' 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 disabled:opacity-40 disabled:hover:bg-white'
                }`}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span>Fiche Collective de Ménage</span>
              </button>
            </div>
          </div>

          {/* 3. CUSTOMIZE PARAMETERS FORM */}
          {activeResident && (
            <div className="space-y-3.5 border-t border-slate-200 pt-4 text-xs">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">3. Informations d'expédition</label>
              
              {/* Act Serial and TIMBRE */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500">Nº de Série Acte</span>
                  <div className="flex">
                    <input 
                      type="text" 
                      value={serialNumber} 
                      onChange={e => setSerialNumber(e.target.value)} 
                      className="w-full text-[11px] p-1.5 border border-slate-250 bg-white rounded-l focus:border-indigo-500 outline-hidden font-mono"
                    />
                    <button 
                      onClick={handleRegenerateSerial}
                      title="Nouveau numéro"
                      className="bg-slate-200 hover:bg-slate-300 px-1.5 text-slate-700 font-bold border border-l-0 border-slate-250 rounded-r text-[10px]"
                    >
                      ↺
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500">Droit de Timbre</span>
                  <input 
                    type="text" 
                    value={stampFee} 
                    onChange={e => setStampFee(e.target.value)} 
                    className="w-full text-[11px] p-1.5 border border-slate-200 bg-white rounded focus:border-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Purpose / Objet de délivrance */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-500">Objet de délivrance</span>
                <input 
                  type="text" 
                  value={purpose} 
                  onChange={e => setPurpose(e.target.value)} 
                  className="w-full p-2 border border-slate-200 bg-white rounded text-xs focus:border-indigo-500 outline-hidden text-slate-800"
                />
                
                {/* Presets Row */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {purposePresets.map(preset => (
                    <button
                      key={preset}
                      onClick={() => setPurpose(preset)}
                      className="text-[9px] bg-slate-200 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded px-1.5 py-0.5 font-sans leading-relaxed"
                    >
                      {preset.split(' ').slice(0, 3).join(' ')}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional parameters depending on document type */}
              {docType === 'indigence' && (
                <div className="space-y-1 bg-amber-50/55 p-2 rounded border border-amber-200/50">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block tracking-wider">Option: Constat d'indigence</span>
                  <p className="text-[9px] text-slate-500 leading-tight">Motif de ressources extrêmement faibles certifié :</p>
                  <textarea 
                    value={indigenceReason} 
                    onChange={e => setIndigenceReason(e.target.value)}
                    rows={1.5}
                    className="w-full mt-1 p-1.5 border border-amber-250 bg-white rounded text-[11px] outline-hidden text-slate-800"
                  />
                </div>
              )}

              {docType === 'civisme' && (
                <div className="space-y-1 bg-indigo-50/30 p-2 rounded border border-indigo-150/50">
                  <span className="text-[10px] font-bold text-indigo-900 uppercase block tracking-wider">Option: Évaluation Civique</span>
                  <p className="text-[9px] text-slate-500 leading-tight">Mention du civisme et de la conduite générale :</p>
                  <textarea 
                    value={conductStatus} 
                    onChange={e => setConductStatus(e.target.value)}
                    rows={1.5}
                    className="w-full mt-1 p-1.5 border-slate-200 bg-white rounded text-[11px] outline-hidden text-slate-800"
                  />
                </div>
              )}

              {/* Authority Signature custom text */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500">Titre Signataire</span>
                  <input 
                    type="text" 
                    value={authorityTitle} 
                    onChange={e => setAuthorityTitle(e.target.value)} 
                    className="w-full p-2 border border-slate-200 bg-white rounded text-[11px] focus:border-indigo-500 outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 font-sans">Identité Signataire</span>
                  <input 
                    type="text" 
                    value={authoritySignature} 
                    onChange={e => setAuthoritySignature(e.target.value)} 
                    className="w-full p-2 border border-slate-200 bg-white rounded text-[11px] focus:border-indigo-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Extra notes */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-500">Mention administrative additionnelle (Facultative)</span>
                <textarea 
                  placeholder="Ex: Mentionner urgence de délivrance, statut invalidité..."
                  value={additionalNote}
                  onChange={e => setAdditionalNote(e.target.value)}
                  rows={2}
                  className="w-full p-2 border border-slate-200 bg-white rounded text-[11px] focus:border-indigo-500 outline-hidden text-slate-800"
                />
              </div>

            </div>
          )}
        </div>

        {/* BOTTOM ACTIONS BAR */}
        <div className="pt-4 border-t border-slate-200 space-y-2">
          {activeResident ? (
            <button 
              onClick={handlePrint}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-sans font-bold py-3 px-4 rounded-lg flex items-center justify-center space-x-2 shadow-xs transition duration-150"
            >
              <Printer className="h-4.5 w-4.5" />
              <span>Délivrer et Imprimer l'Acte</span>
            </button>
          ) : (
            <div className="text-center py-2 px-3 bg-slate-100 border border-slate-200 text-slate-400 font-semibold rounded-lg text-[11px]">
              Sélectionnez d'abord un habitant
            </div>
          )}
        </div>
      </div>

      {/* RIGHT HAND: PAPER A4 STYLE LIVE PREVIEW GRID */}
      <div id="doc-generator-paper-preview" className="flex-1 bg-slate-100 p-6 overflow-y-auto flex items-start justify-center min-h-[600px]">
        {activeResident ? (
          <div 
            ref={printRef}
            className="bg-white p-10 md:p-14 border border-slate-300 w-full max-w-[21cm] min-h-[29.7cm] shadow-md text-slate-950 font-serif leading-relaxed text-sm print-container relative"
          >
            {/* Header stamps */}
            <div className="flex justify-between items-start text-xs font-sans">
              <div className="space-y-1 font-semibold uppercase tracking-wider text-[10px]">
                <p>PROVINCE : ANTANANARIVO</p>
                <p>REGIONS : ANALAMANGA</p>
                <p>DISTRICT : {activeResident.residence.district.toUpperCase()}</p>
                <p>COMMUNE : {activeResident.residence.commune.toUpperCase()}</p>
                <p>FOKONTANY : {activeResident.residence.fokontany.toUpperCase()}</p>
              </div>

              <div className="text-center space-y-1">
                <p className="font-bold tracking-widest text-[11px]">REPOBLIKAN'I MADAGASIKARA</p>
                <p className="italic text-[9px] text-slate-600 font-sans">"Fitiavana - Tanindrazana - Fandrosoana"</p>
                <p className="text-[10px] uppercase font-mono font-bold pt-1.5 border-t border-dotted border-slate-300">Nº {serialNumber} / RE / FKT</p>
              </div>
            </div>

            {/* Main horizontal decorative separator */}
            <div className="my-6 border-t-2 border-double border-slate-900"></div>

            {/* 1. CERTIFICAT DE RESIDENCE */}
            {docType === 'residence' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="text-xl font-bold tracking-wide uppercase underline underline-offset-4 decoration-1">
                    CERTIFICAT DE RESIDENCE
                  </h1>
                </div>

                <div className="pt-4 space-y-4 text-justify">
                  <p>
                    {authorityTitle} du Fokontany de <strong>{activeResident.residence.fokontany}</strong> soussigné, certifie après vérification des registres de la population de l'administration locale du Fokontany que :
                  </p>

                  <div className="pl-6 pt-2 space-y-2 font-mono text-[13px] border-l-2 border-slate-300">
                    <p>Madame / Monsieur : <strong className="text-base font-serif uppercase tracking-normal">{activeResident.nom} {activeResident.prenom}</strong></p>
                    <p>Sexe : {activeResident.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
                    <p>Né(e) le : {new Date(activeResident.dateNaissance).toLocaleDateString('fr-FR')} (Âge : {calculateAge(activeResident.dateNaissance)} ans)</p>
                    <p>À : {activeResident.lieuNaissance}</p>
                    {activeResident.cin ? (
                      <p>Titulaire de la CIN Nº : {activeResident.cin} {activeResident.dateCin && `délivrée le ${new Date(activeResident.dateCin).toLocaleDateString('fr-FR')}`}</p>
                    ) : (
                      <p>Titulaire de la CIN Nº : Non enregistré ou mineur</p>
                    )}
                    <p>Code de ménage affilié : {activeResident.famille.codeMenage}</p>
                    <p>Profession : {activeResident.economie.profession} ({activeResident.economie.secteur})</p>
                  </div>

                  <p>
                    Demeure actuellement à l'adresse suivante : <strong>{activeResident.residence.adresse}</strong>, Fokontany de <strong>{activeResident.residence.fokontany}</strong>, Commune de <strong>{activeResident.residence.commune}</strong>.
                  </p>

                  <p>
                    Le présent certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit, sous le motif de : <strong className="italic">{purpose}</strong>.
                  </p>

                  {additionalNote && (
                    <div className="bg-slate-50 p-4 border border-slate-205 rounded font-sans text-xs italic space-y-1">
                      <p className="font-semibold text-slate-800 not-italic uppercase tracking-widest text-[9px]">Observation de l'administration :</p>
                      <p className="text-slate-700 leading-normal">{additionalNote}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. FICHE INDIVIDUELLE */}
            {docType === 'fiche' && (
              <div className="space-y-6">
                <div className="text-center space-y-1">
                  <h1 className="text-xl font-bold tracking-wide uppercase underline underline-offset-4">
                    FICHE INDIVIDUELLE DE RENSEIGNEMENTS
                  </h1>
                  <p className="text-xs font-sans text-slate-500">Registre du Bureau Local d'Administration Fokontany - Repoblikan'i Madagasikara</p>
                </div>

                <div className="pt-4 grid grid-cols-2 gap-y-4 text-xs font-mono border border-slate-350 rounded p-4 bg-slate-50/25">
                  <div className="col-span-2 border-b border-slate-200 pb-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-sans">IDENTITÉ CIVILE</span>
                    <strong className="text-sm font-semibold font-serif uppercase tracking-normal">{activeResident.nom} {activeResident.prenom}</strong>
                  </div>
                  
                  <div>
                    <span className="text-slate-550 block font-sans">Identité (CIN) :</span>
                    <strong className="text-slate-900">{activeResident.cin || 'Non enregistrée'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans font-sans">Sexe :</span>
                    <strong className="text-slate-900">{activeResident.sexe === 'M' ? 'Masculin (M)' : 'Féminin (F)'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans">Date de Naissance :</span>
                    <strong className="text-slate-900">{new Date(activeResident.dateNaissance).toLocaleDateString('fr-FR')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans font-sans">Lieu de Naissance :</span>
                    <strong className="text-slate-900">{activeResident.lieuNaissance}</strong>
                  </div>

                  <div className="col-span-2 border-b border-slate-250 pb-1 pt-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-sans">RÉSIDENCE ET ATTACHES FAMILIALES</span>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans">Numéro de Ménage :</span>
                    <strong className="text-indigo-900">{activeResident.famille.codeMenage}</strong>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans">Rôle Famille :</span>
                    <strong className="text-slate-900">{activeResident.famille.isChefMenage ? 'Chef de ménage' : 'Répertorié à charge'}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-550 block font-sans">Adresse Localisée :</span>
                    <strong className="text-slate-900">{activeResident.residence.adresse}, {activeResident.residence.fokontany}</strong>
                  </div>

                  <div className="col-span-2 border-b border-slate-250 pb-1 pt-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-sans">ÉDUCATION, PROFESSION ET REVENUS</span>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans">Profession :</span>
                    <strong className="text-slate-900">{activeResident.economie.profession}</strong>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans">Secteur :</span>
                    <strong className="text-slate-900">{activeResident.economie.secteur}</strong>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans font-sans">Niveau scolarité :</span>
                    <strong className="text-slate-900">{activeResident.education.niveauEtude}</strong>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans">Revenu mensuel estimé :</span>
                    <strong className="text-slate-900">{activeResident.economie.revenuEstime ? `${activeResident.economie.revenuEstime.toLocaleString('fr-FR')} Ar` : 'Non déclaré'}</strong>
                  </div>

                  <div className="col-span-2 border-b border-slate-250 pb-1 pt-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-sans">SANTÉ & SURVEILLANCE MÉDICALE</span>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans">Groupe Sanguine :</span>
                    <strong className="text-slate-900">{activeResident.sante.groupeSanguin || 'Inconnu'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-550 block font-sans font-sans">Diabète & Hypertension :</span>
                    <strong className="text-slate-900">HT: {activeResident.sante.hypertension} | Diabète: {activeResident.sante.diabete}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-550 block font-sans">Couverture vaccinale déclarée :</span>
                    <strong className="text-slate-700 leading-tight inline-block pt-1">{activeResident.sante.vaccination.join(', ') || 'Néant enregistré'}</strong>
                  </div>
                </div>

                {additionalNote && (
                  <div className="bg-slate-50 p-4 border border-slate-205 rounded text-xs font-sans italic">
                    <p className="font-semibold text-slate-800 not-italic uppercase tracking-widest text-[9px] mb-1">Notice additionnelle d'administration :</p>
                    <p>{additionalNote}</p>
                  </div>
                )}
              </div>
            )}

            {/* 3. CERTIFICAT DE CELIBAT */}
            {docType === 'celibat' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="text-xl font-bold tracking-wide uppercase underline underline-offset-4">
                    CERTIFICAT DE CELIBAT & DE VIE LIBRE
                  </h1>
                </div>

                <div className="pt-4 space-y-4 text-justify">
                  <p>
                    {authorityTitle} du Fokontany de <strong>{activeResident.residence.fokontany}</strong> certifie après vérification des fiches de contrôle de l'état civil de notre juridiction administrative locale que :
                  </p>

                  <div className="pl-6 pt-2 space-y-2 font-mono text-[13px] border-l-2 border-slate-300">
                    <p>Madame / Monsieur : <strong className="text-base font-serif uppercase tracking-normal">{activeResident.nom} {activeResident.prenom}</strong></p>
                    <p>Sexe : {activeResident.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
                    <p>Né(e) le : {new Date(activeResident.dateNaissance).toLocaleDateString('fr-FR')}</p>
                    <p>À : {activeResident.lieuNaissance}</p>
                    {activeResident.cin && <p>CIN : {activeResident.cin}</p>}
                    <p>Adresse : {activeResident.residence.adresse}</p>
                  </div>

                  <p>
                    Est parvenu(e) à notre connaissance comme étant de statut civil <strong>célibataire, non marié(e) et libre de tout engagement matrimonial</strong>. Nos registres de vie collective dans le Fokontany n'indiquent aucun acte d'état civil, signature de ménage légalisé ou PACS enregistré au nom du/de la citoyen(ne) susnommé(e).
                  </p>

                  <p>
                    Le présent acte est consenti à l'intéressé(e) pour servir et valoir administrativement à toutes fins utiles, sous le motif de : <strong className="italic">{purpose}</strong>.
                  </p>

                  {additionalNote && (
                    <div className="bg-slate-50 p-4 border border-slate-205 rounded font-sans text-xs italic">
                      <p className="font-semibold text-slate-800 not-italic uppercase tracking-widest text-[9px] mb-1">Note d'appui additionnelle :</p>
                      <p>{additionalNote}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. CERTIFICAT D'INDIGENCE */}
            {docType === 'indigence' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="text-xl font-bold tracking-wide uppercase underline underline-offset-4">
                    CERTIFICAT D'INDIGENCE / FAIBLES RESSOURCES
                  </h1>
                </div>

                <div className="pt-4 space-y-4 text-justify">
                  <p>
                    {authorityTitle} du Fokontany de <strong>{activeResident.residence.fokontany}</strong> certifie après enquête sociale approfondie et contrôle de ressources de l'administration collective locale que :
                  </p>

                  <div className="pl-6 pt-2 space-y-2 font-mono text-[13px] border-l-2 border-slate-300">
                    <p>Madame / Monsieur : <strong className="text-base font-serif uppercase">{activeResident.nom} {activeResident.prenom}</strong></p>
                    <p>Sexe : {activeResident.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
                    <p>Né(e) le : {new Date(activeResident.dateNaissance).toLocaleDateString('fr-FR')} (Âge : {calculateAge(activeResident.dateNaissance)} ans)</p>
                    <p>Adresse : {activeResident.residence.adresse}, Fokontany de {activeResident.residence.fokontany}</p>
                    <p>Profession déclarée : {activeResident.economie.profession || 'Sans emploi'}</p>
                    <p>Revenu mensuel repéré : {activeResident.economie.revenuEstime ? `${activeResident.economie.revenuEstime.toLocaleString('fr-FR')} Ar` : 'Néant d\'épargne ou irrégulier'}</p>
                  </div>

                  <p>
                    Se trouve actuellement dans une situation économique précaire déclarée d'intérêt local : <strong className="text-slate-900 underline underline-offset-2">{indigenceReason}</strong>. Ses faibles conditions de vie générale ne lui permettent pas de faire face à l'intégralité des obligations financières ou d'autres cotisations privées de premier plan.
                  </p>

                  <p>
                    Ce titre officiel d'indisponibilité financière est délivré à l'intéressé(e) afin de l'appuyer dans ses démarches réglementaires d'exonérations partielles ou d'aide matérielle, particulièrement pour : <strong className="italic">{purpose}</strong>.
                  </p>

                  {additionalNote && (
                    <div className="bg-slate-50 p-4 border border-amber-200 bg-amber-50/20 rounded font-sans text-xs italic">
                      <p className="font-semibold text-slate-800 not-italic uppercase tracking-widest text-[9px] mb-1">Mention sociale complémentaire :</p>
                      <p>{additionalNote}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. CERTIFICAT DE CIVISME */}
            {docType === 'civisme' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="text-xl font-bold tracking-wide uppercase underline underline-offset-4">
                    CERTIFICAT DE CIVISME ET DE BONNE CONDUITE
                  </h1>
                </div>

                <div className="pt-4 space-y-4 text-justify">
                  <p>
                    {authorityTitle} du Fokontany de <strong>{activeResident.residence.fokontany}</strong> certifie après audition publique et vérifications de moralité locale que :
                  </p>

                  <div className="pl-6 pt-2 space-y-2 font-mono text-[13px] border-l-2 border-slate-300">
                    <p>Madame / Monsieur : <strong className="text-base font-serif uppercase">{activeResident.nom} {activeResident.prenom}</strong></p>
                    <p>Né(e) le : {new Date(activeResident.dateNaissance).toLocaleDateString('fr-FR')} à {activeResident.lieuNaissance}</p>
                    {activeResident.cin && <p>Titulaire de la CIN Nº : {activeResident.cin}</p>}
                    <p>Demeurant actuellement à : {activeResident.residence.adresse}</p>
                    <p>Membre de la cellule familiale affiliée : {activeResident.famille.codeMenage}</p>
                  </div>

                  <p>
                    A fait preuve durant sa résidence au sein du Fokontany d'une conduite jugée : <strong className="text-indigo-900 underline underline-offset-2">{conductStatus}</strong>. L'intéressé(e) s'acquitte régulièrement de ses devoirs communautaires locaux et fait preuve de respect envers l'harmonie sociale et les lois de la République.
                  </p>

                  <p>
                    Cette attestation de civisme de bon aloi lui est remise en main propre pour valoir ce que de droit, exclusivement dans le cadre de : <strong className="italic">{purpose}</strong>.
                  </p>

                  {additionalNote && (
                    <div className="bg-slate-50 p-3 border border-slate-205 rounded font-sans text-xs italic">
                      <p className="font-semibold text-slate-800 not-italic uppercase tracking-widest text-[9px] mb-1">Renseignements de moralité supplémentaires :</p>
                      <p>{additionalNote}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 6. FICHE DE MENAGE COLLECTIVE */}
            {docType === 'menage_collectif' && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <h1 className="text-lg font-bold tracking-wide uppercase underline underline-offset-4">
                    FICHE COLLECTIVE DE MENAGE
                  </h1>
                  <p className="text-xs font-sans text-slate-500">Recensement des membres d'une même cellule familiale • Code {activeResident.famille.codeMenage}</p>
                </div>

                <div className="space-y-3 text-justify text-xs pt-2">
                  <p>
                    {authorityTitle} du Fokontany de <strong>{activeResident.residence.fokontany}</strong> certifie que le ménage identifié sous le code d'enregistrement <strong>{activeResident.famille.codeMenage}</strong> comporte les habitants officiellement recensés ci-dessous :
                  </p>

                  {/* Leader of chemical house */}
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 font-sans space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-800">Chef de Ménage Responsable :</p>
                    {householdMembers.find(m => m.famille.isChefMenage) ? (
                      (() => {
                        const leader = householdMembers.find(m => m.famille.isChefMenage)!;
                        return (
                          <div className="grid grid-cols-2 text-xs">
                            <p><strong>Nom :</strong> {leader.nom} {leader.prenom}</p>
                            <p><strong>CIN :</strong> {leader.cin || 'Néant ou mineur'}</p>
                            <p><strong>Profession :</strong> {leader.economie.profession}</p>
                            <p><strong>Sexe :</strong> {leader.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-amber-800 italic">Aucun chef de ménage explicitement identifié comme actif pour ce code.</p>
                    )}
                  </div>

                  {/* List of members table */}
                  <div className="border border-slate-300 rounded overflow-hidden mt-3">
                    <table className="w-full text-left text-[11px] font-sans border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 font-semibold text-slate-700">
                          <th className="p-2 border-r border-slate-300">Nom & Prénoms</th>
                          <th className="p-2 border-r border-slate-300 w-16 text-center">Sexe</th>
                          <th className="p-2 border-r border-slate-300 w-24">Date Naissance</th>
                          <th className="p-2 border-r border-slate-300 w-24">Grade / Parenté</th>
                          <th className="p-2">Profession</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {householdMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-slate-50/50">
                            <td className="p-2 border-r border-slate-200 font-medium text-slate-900">
                              {member.nom} {member.prenom} {member.id === activeResident.id && <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1 rounded border border-indigo-100">Déclarant</span>}
                            </td>
                            <td className="p-2 border-r border-slate-200 text-center">{member.sexe}</td>
                            <td className="p-2 border-r border-slate-200 font-mono text-[10px]">{new Date(member.dateNaissance).toLocaleDateString('fr-FR')}</td>
                            <td className="p-2 border-r border-slate-200 text-slate-700">
                              {member.famille.isChefMenage ? 'Chef de ménage' : (member.sexe === 'M' ? 'Fils / Rattaché' : 'Fille / Rattachée')}
                            </td>
                            <td className="p-2 text-slate-700 text-ellipsis truncate max-w-[120px]">{member.economie.profession || 'Sans emploi'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="pt-2">
                    L'adresse officielle rattachée à cette cellule de cohabitation est : <strong>{activeResident.residence.adresse}</strong>, Fokontany de <strong>{activeResident.residence.fokontany}</strong>.
                  </p>

                  <p>
                    Cette fiche exhaustive collective est rédigée et certifiée conforme aux fiches d'enquêtes parcellaires d'administration locale, délivrée pour : <strong className="italic">{purpose}</strong>.
                  </p>

                  {additionalNote && (
                    <div className="bg-slate-50 p-2 border border-slate-205 rounded font-sans text-[11px] italic">
                      <p className="font-semibold text-slate-800 not-italic uppercase tracking-widest text-[8px] mb-0.5">Observations collectives :</p>
                      <p>{additionalNote}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Official Date & Stamp Imprint bottom */}
            <div className="mt-14 flex justify-between items-center text-xs font-sans">
              
              {/* Fake round Administration stamp */}
              <div className="relative w-24 h-24 border-2 border-dashed border-red-500/60 rounded-full flex items-center justify-center text-center text-[7px] font-bold text-red-500/70 uppercase select-none transform -rotate-12 shrink-0">
                <div className="absolute inset-1.5 border border-dotted border-red-400/50 rounded-full"></div>
                <div className="p-1 px-1.5 leading-tight select-none">
                  FOKONTANY<br />
                  {activeResident.residence.fokontany.toUpperCase()}<br />
                  <span className="text-[5.5px] tracking-wider text-red-500/50">COMMUNE ANTANANARIVO</span>
                </div>
              </div>

              {/* Date and Signature column */}
              <div className="text-right space-y-4">
                <p>Fait à {activeResident.residence.fokontany}, le {new Date().toLocaleDateString('fr-FR')}</p>
                <div className="pt-1 h-14">
                  <p className="font-bold underline text-[10px] uppercase tracking-wider text-slate-800">{authorityTitle}</p>
                  <p className="italic text-slate-400 text-[9px] mt-4">(Sceau & Signature : {authoritySignature})</p>
                </div>
              </div>

            </div>

            {/* Timbre fiscal representation top/bottom */}
            <div className="absolute top-12 right-12 w-20 h-8 border border-indigo-200 bg-indigo-50/20 text-indigo-700 p-1 rounded text-center select-none rotate-3 opacity-80 flex flex-col justify-center items-center font-sans tracking-wide">
              <span className="text-[6px] uppercase tracking-widest font-bold">TIMBRE FISCAL</span>
              <span className="font-mono text-[9px] font-bold">{stampFee}</span>
            </div>

            {/* General Administrative footer print only */}
            <div className="absolute bottom-4 left-10 right-10 text-center text-[8px] font-sans text-slate-400 border-t border-dotted border-slate-200 pt-2 select-none">
              Registre numérisé de Fokontany - Repoblikan'i Madagasikara © 2026. Toute contrefaçon expose son auteur à des poursuites judiciaires.
            </div>

          </div>
        ) : (
          <div className="bg-white border rounded-xl py-20 px-8 text-center shadow-xs max-w-lg w-full flex flex-col justify-center items-center">
            <FileText className="h-12 w-12 text-slate-350 mb-3" />
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Aperçu du document</h3>
            <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
              Sélectionnez un résident actif dans le conteneur de recherche de gauche, puis choisissez le type d'acte pour faire apparaître sa maquette de prévisualisation certifiée A4.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
