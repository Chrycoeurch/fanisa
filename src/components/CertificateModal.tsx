import React, { useRef, useMemo, useState } from 'react';
import { Habitant, Transaction } from '../types';
import { Printer, Download, X, Award, ShieldAlert, Check } from 'lucide-react';

interface CertificateModalProps {
  resident: Habitant;
  onClose: () => void;
  onLoggedAction: (action: 'Certificat généré', details: string) => void;
  onAddTransaction?: (newTx: Omit<Transaction, 'id'>) => void;
}

type DocType = 'residence' | 'fiche' | 'celibat';

export default function CertificateModal({ resident, onClose, onLoggedAction, onAddTransaction }: CertificateModalProps) {
  const [docType, setDocType] = useState<DocType>('residence');
  const [collectRights, setCollectRights] = useState(true);
  const [rightsAmount, setRightsAmount] = useState(2000);

  const printRef = useRef<HTMLDivElement>(null);

  const serialNumber = useMemo(() => {
    return `${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;
  }, [resident.id]);

  const receiptSerial = useMemo(() => {
    return `REC-ACTE-26-${Math.floor(1000 + Math.random() * 9000)}`;
  }, [serialNumber]);

  const handlePrint = () => {
    onLoggedAction(
      'Certificat généré', 
      `Certificat de ${docType === 'residence' ? 'résidence' : docType === 'celibat' ? 'célibat' : 'renseignements'} Nº ${serialNumber} délivré pour ${resident.nom} ${resident.prenom}`
    );

    if (collectRights && onAddTransaction) {
      onAddTransaction({
        date: new Date().toISOString(),
        type: 'recette',
        montant: rightsAmount,
        categorie: 'Droits administratifs',
        description: `Droits de Secrétariat - ${docType === 'residence' ? 'Certificat de Résidence' : docType === 'celibat' ? 'Certificat de Célibat' : 'Fiche Individuelle'} - ${resident.nom} ${resident.prenom} (Réf: ${receiptSerial})`,
        responsable: 'Chef Fokontany (Admin)'
      });
    }
    
    // Create print window or print specific iframe block safely
    const printContent = printRef.current?.innerHTML;
    const originalContent = document.body.innerHTML;

    if (printContent) {
      // In web applet environment, we can open a beautiful printable styled tab or just inform/trigger print
      const style = document.createElement('style');
      style.innerHTML = `
        @media print {
          body { background: white; color: black; font-family: sans-serif; }
          .no-print { display: none !important; }
          .print-container { padding: 40px; border: none; max-width: 100%; width: 100%; box-shadow: none; }
        }
      `;
      document.head.appendChild(style);
      window.print();
      document.head.removeChild(style);
    }
  };

  const calculateAge = (dateN: string) => {
    const birthday = new Date(dateN);
    const ageDifMs = Date.now() - birthday.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  return (
    <div id="certificate-modal" className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row h-[90vh] md:h-[85vh]">
        
        {/* Document Switcher Toolbar */}
        <div id="cert-sidebar" className="bg-slate-50 border-b md:border-b-0 md:border-r border-slate-100 p-6 flex flex-col justify-between w-full md:w-80">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Actes Administratifs</h3>
              <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 md:hidden">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <button 
                onClick={() => setDocType('residence')}
                className={`w-full text-left p-3 rounded-lg text-xs font-medium transition-all duration-150 border ${
                  docType === 'residence' 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Certificat de Résidence
              </button>

              <button 
                onClick={() => setDocType('fiche')}
                className={`w-full text-left p-3 rounded-lg text-xs font-medium transition-all duration-150 border ${
                  docType === 'fiche' 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Fiche Renseignements Individuelle
              </button>

              <button 
                onClick={() => setDocType('celibat')}
                className={`w-full text-left p-3 rounded-lg text-xs font-medium transition-all duration-150 border ${
                  docType === 'celibat' 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Certificat de Célibat / Vie Libre
              </button>
            </div>

            <div className="bg-amber-50 p-4 border border-amber-200 rounded-lg text-[11px] text-amber-800 leading-relaxed font-sans space-y-2">
              <div className="flex items-center space-x-1.5 font-bold">
                <Award className="h-3.5 w-3.5 shrink-0" />
                <span>Notice d'administration</span>
              </div>
              <p>
                Ce certificat officiel est généré au nom du Fokontany de <strong>{resident.residence.fokontany}</strong> en se basant sur le numéro de ménage enregistré <strong>({resident.famille.codeMenage})</strong>.
              </p>
              <p className="font-mono text-[10px]">
                Statut actuel : {resident.statut === 'Actif' ? '🟢 Actif en règle' : '🔴 Non actif-résident'}
              </p>
            </div>

            {/* Secrétariat Fee collector widget */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-3xs select-none">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-sans font-bold text-slate-500 uppercase tracking-widest block">Frais de Secrétariat</span>
                <span className="text-[8px] font-mono font-bold bg-indigo-50 border border-indigo-150 text-indigo-700 rounded px-1">{receiptSerial}</span>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="collect-rights-checkbox" 
                  checked={collectRights}
                  onChange={(e) => setCollectRights(e.target.checked)}
                  className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-505 cursor-pointer"
                />
                <label htmlFor="collect-rights-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer select-none">Percevoir les Droits d'Acte</label>
              </div>
              {collectRights && (
                <div className="space-y-1.5 animate-fadeIn text-[11px] font-sans">
                  <label className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Montant perçu (Ariary)</label>
                  <input 
                    type="number" 
                    value={rightsAmount}
                    onChange={(e) => setRightsAmount(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded p-1.5 font-mono text-right text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
                  />
                  <span className="text-[9px] text-slate-400 block italic leading-normal">Crée une recette budgétaire d'état civil après impression.</span>
                </div>
              )}
            </div>

          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-col gap-2">
            <button 
              onClick={handlePrint}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-sans font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 shadow-xs transition duration-150"
            >
              <Printer className="h-4 w-4" />
              <span>Imprimer l'Acte</span>
            </button>
            <button 
              onClick={onClose}
              className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-sans font-semibold py-2.5 px-4 rounded-lg transition duration-150"
            >
              Fermer l'éditeur
            </button>
          </div>
        </div>

        {/* Paper A4 Preview Area */}
        <div id="cert-paper-scope" className="flex-1 bg-slate-100 p-6 overflow-y-auto flex justify-center">
          <div 
            ref={printRef}
            className="bg-white p-12 border border-slate-300 w-full max-w-[21cm] min-h-[29.7cm] shadow-xl text-slate-950 font-serif leading-relaxed text-sm print-container relative"
          >
            {/* Header stamps */}
            <div className="flex justify-between items-start text-xs font-sans">
              <div className="space-y-1 font-semibold uppercase tracking-wider text-[10px]">
                <p>PROVINCE : ANTANANARIVO</p>
                <p>DISTRICT : {resident.residence.district.toUpperCase()}</p>
                <p>COMMUNE : {resident.residence.commune.toUpperCase()}</p>
                <p>FOKONTANY : {resident.residence.fokontany.toUpperCase()}</p>
              </div>

              <div className="text-center space-y-1">
                <p className="font-bold tracking-widest text-[11px]">REPOBLIKAN'I MADAGASIKARA</p>
                <p className="italic text-[9px] text-slate-600 font-sans">"Fitiavana - Tanindrazana - Fandrosoana"</p>
                <p className="text-[10px] uppercase font-mono font-bold pt-1.5 border-t border-dotted border-slate-300">Nº {serialNumber} / RE / FKT</p>
              </div>
            </div>

            {/* Main horizontal line decoration */}
            <div className="my-8 border-t-2 border-double border-slate-900"></div>

            {/* Document Content Render */}
            {docType === 'residence' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="text-xl font-bold tracking-wide uppercase underline underline-offset-4 decoration-1">
                    CERTIFICAT DE RESIDENCE
                  </h1>
                </div>

                <div className="pt-6 space-y-4 text-justify">
                  <p>
                    Le Chef du Fokontany de <strong>{resident.residence.fokontany}</strong> soussigné, certifie après vérification des registres de la population de l'administration du Fokontany que :
                  </p>

                  <div className="pl-6 pt-2 space-y-2 font-mono text-[13px] border-l-2 border-slate-200">
                    <p>Madame / Monsieur : <strong className="text-base font-serif uppercase tracking-normal">{resident.nom} {resident.prenom}</strong></p>
                    <p>Sexe : {resident.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
                    <p>Né(e) le : {new Date(resident.dateNaissance).toLocaleDateString('fr-FR')} (Âge : {calculateAge(resident.dateNaissance)} ans)</p>
                    <p>À : {resident.lieuNaissance}</p>
                    {resident.cin && (
                      <p>Titulaire de la CIN Nº : {resident.cin} {resident.dateCin && `délivrée le ${new Date(resident.dateCin).toLocaleDateString('fr-FR')}`}</p>
                    )}
                    <p>Code Ménage enregistré : {resident.famille.codeMenage}</p>
                    <p>Profession déclarée : {resident.economie.profession}</p>
                  </div>

                  <p>
                    Demeure actuellement à l'adresse suivante : <strong>{resident.residence.adresse}</strong>, Fokontany de <strong>{resident.residence.fokontany}</strong>, Commune de <strong>{resident.residence.commune}</strong>.
                  </p>

                  <p>
                    Le présent certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit, notamment pour des formalités administratives.
                  </p>
                </div>
              </div>
            )}

            {docType === 'fiche' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="text-xl font-bold tracking-wide uppercase underline underline-offset-4">
                    FICHE INDIVIDUELLE DE RENSEIGNEMENTS
                  </h1>
                  <p className="text-xs font-sans text-slate-500">Registre du Bureau Local d'Administration Fokontany</p>
                </div>

                <div className="pt-4 grid grid-cols-2 gap-y-4 text-xs font-mono border border-slate-200 rounded p-4 bg-slate-50/20">
                  <div className="col-span-2 border-b border-slate-100 pb-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block">IDENTITÉ CIVILE</span>
                    <strong className="text-sm font-semibold font-serif uppercase tracking-normal">{resident.nom} {resident.prenom}</strong>
                  </div>
                  
                  <div>
                    <span className="text-slate-500 block">Identité (CIN) :</span>
                    <strong>{resident.cin || 'Non enregistrée'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Sexe :</span>
                    <strong>{resident.sexe === 'M' ? 'Masculin (M)' : 'Féminin (F)'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Date de Naissance :</span>
                    <strong>{new Date(resident.dateNaissance).toLocaleDateString('fr-FR')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Lieu de Naissance :</span>
                    <strong>{resident.lieuNaissance}</strong>
                  </div>

                  <div className="col-span-2 border-b border-b-slate-100 pb-1 pt-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block">RÉSIDENCE</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Numéro Ménage :</span>
                    <strong>{resident.famille.codeMenage}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Rôle :</span>
                    <strong>{resident.famille.isChefMenage ? 'Chef de ménage' : 'Répertorié'}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Adresse Localisée :</span>
                    <strong>{resident.residence.adresse}, {resident.residence.fokontany}</strong>
                  </div>

                  <div className="col-span-2 border-b border-b-slate-100 pb-1 pt-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block">ÉDUCATION & PROFESSION</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Profession :</span>
                    <strong>{resident.economie.profession}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Secteur :</span>
                    <strong>{resident.economie.secteur}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Scolarité :</span>
                    <strong>{resident.education.niveauEtude}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Diplômes :</span>
                    <strong>{resident.education.diplome || 'Non renseigné'}</strong>
                  </div>

                  <div className="col-span-2 border-b border-b-slate-100 pb-1 pt-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest block">SANTÉ & SURVEILLANCE</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Groupe Sanguin :</span>
                    <strong>{resident.sante.groupeSanguin || 'Inconnu'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Hypertension :</span>
                    <strong>{resident.sante.hypertension}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Diabète :</span>
                    <strong>{resident.sante.diabete}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Vaccins pris :</span>
                    <strong className="text-[10px] leading-tight block">{resident.sante.vaccination.join(', ') || 'Néant'}</strong>
                  </div>
                </div>
              </div>
            )}

            {docType === 'celibat' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="text-xl font-bold tracking-wide uppercase underline underline-offset-4">
                    CERTIFICAT DE CELIBAT & VIE LIBRE
                  </h1>
                </div>

                <div className="pt-6 space-y-4 text-justify">
                  <p>
                    Le Chef du Fokontany de <strong>{resident.residence.fokontany}</strong> certifie en outre que d'après l'enquête d'usage de l'état civil de notre juridiction, le ou la citoyen(ne) ci-dessous :
                  </p>

                  <div className="pl-6 pt-2 space-y-2 font-mono text-[13px] border-l-2 border-slate-200">
                    <p>Madame / Monsieur : <strong className="text-base font-serif uppercase tracking-normal">{resident.nom} {resident.prenom}</strong></p>
                    <p>Sexe : {resident.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
                    <p>Né(e) le : {new Date(resident.dateNaissance).toLocaleDateString('fr-FR')}</p>
                    <p>À : {resident.lieuNaissance}</p>
                    {resident.cin && <p>CIN : {resident.cin}</p>}
                    <p>Adresse : {resident.residence.adresse}</p>
                  </div>

                  <p>
                    Est actuellement de statut civil <strong>célibataire, non marié(e)</strong> selon nos registres locaux de vie collective et de recensement. L'intéressé(e) n'a souscrit aucun pacte civil de solidarité ou mariage devant la présente commission locale.
                  </p>

                  <p>
                    Le présent acte est consenti pour servir et valoir administrativement à toutes fins d'enregistrement d'état civil légal.
                  </p>
                </div>
              </div>
            )}

            {/* Official Date & Stamp Imprint bottom */}
            <div className="mt-16 flex justify-between items-center text-xs font-sans">
              
              {/* Fake round Administration stamp */}
              <div className="relative w-28 h-28 border-2 border-dashed border-red-500/60 rounded-full flex items-center justify-center text-center text-[8px] font-bold text-red-500/70 uppercase select-none transform -rotate-12">
                <div className="absolute inset-2 border border-dotted border-red-400/50 rounded-full"></div>
                <div className="p-1 px-1.5 leading-tight select-none">
                  FOKONTANY<br />
                  {resident.residence.fokontany.toUpperCase()}<br />
                  <span className="text-[6px] tracking-widest text-red-500/50">COMMUNE ANTANANARIVO</span>
                </div>
              </div>

              {/* Date and Signature column */}
              <div className="text-right space-y-4">
                <p>Fait à {resident.residence.fokontany}, le {new Date().toLocaleDateString('fr-FR')}</p>
                <div className="pt-2 h-16">
                  <p className="font-bold underline text-[11px] uppercase tracking-wider text-slate-800">Le Chef de Fokontany</p>
                  <p className="italic text-slate-400 text-[10px] mt-6">(Signé Ravelomanantsoa)</p>
                </div>
              </div>

            </div>

            {/* Administrative Receipt Coupon (Only prints if collected) */}
            {collectRights && (
              <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-300 font-sans space-y-2 block text-slate-800" id="receipt-coupon-printable">
                <div className="flex justify-between items-start text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                  <span>Coupe-Volet Bénéficiaire (Droit de Secrétariat)</span>
                  <span className="text-indigo-700">Reçu Officiel Nº {receiptSerial}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-lg border border-slate-200 font-sans text-[11px]">
                  <div className="space-y-1 text-left leading-relaxed">
                    <p className="font-extrabold uppercase text-[9.5px] text-indigo-900">Reçu d'administration & Droits de Greffe</p>
                    <p className="text-slate-450 text-[8.5px] leading-tight">Délivré en contrepartie de la délivrance de l'acte administratif d'état civil ci-dessus.</p>
                    <p className="font-mono text-[9px] text-slate-700">Acte d'état civil : <strong>{docType === 'residence' ? 'Certificat de Résidence' : docType === 'celibat' ? 'Certificat de Célibat / Vie Libre' : 'Fiche de Renseignements Individuelle'}</strong></p>
                    <p className="font-mono text-[9px] text-slate-700">Titulaire civile : <span className="uppercase font-sans font-bold text-slate-850">{resident.nom} {resident.prenom}</span></p>
                  </div>
                  <div className="text-right space-y-1 border-l border-slate-200 pl-4 shrink-0 font-sans">
                    <span className="text-[8px] uppercase font-bold text-slate-400 block font-sans">Droit Fixe Perçu</span>
                    <strong className="text-xs font-mono font-black text-emerald-800 block">{rightsAmount.toLocaleString('fr-FR')} Ar</strong>
                    <span className="text-[7.5px] font-mono text-slate-400 block">Sceau Fokontany Certifié</span>
                  </div>
                </div>
              </div>
            )}

            {/* General Administrative footer print only */}
            <div className="absolute bottom-6 left-12 right-12 text-center text-[9px] font-sans text-slate-400 border-t border-dotted border-slate-200 pt-3">
              Registre numérisé de Fokontany - Repoblikan'i Madagasikara © 2026. Toute contrefaçon expose son auteur à des poursuites judiciaires.
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
