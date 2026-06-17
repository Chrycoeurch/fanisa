import React, { useState } from 'react';
import { Habitant, HistoriqueLog } from '../types';
import { 
  X, Shield, Heart, GraduationCap, Briefcase, MapPin, 
  Calendar, FileText, Edit, User, UserCheck, 
  ArrowRight, Phone, Mail, Award, Compass, HeartPulse,
  Printer, PlusCircle, Sparkles, AlertTriangle, History
} from 'lucide-react';

interface ResidentDetailModalProps {
  resident: Habitant;
  allResidents: Habitant[];
  onClose: () => void;
  onEdit: (resident: Habitant) => void;
  onGenerateCertificate: (resident: Habitant) => void;
  onNavigateToResident: (resident: Habitant) => void;
  onQuickStatusChange: (residentId: string, newStatus: Habitant['statut']) => void;
  onAddFamilyMember: (foyerReference: Habitant) => void; // Added callback
  logs?: HistoriqueLog[];
}

export default function ResidentDetailModal({
  resident,
  allResidents,
  onClose,
  onEdit,
  onGenerateCertificate,
  onNavigateToResident,
  onQuickStatusChange,
  onAddFamilyMember,
  logs = []
}: ResidentDetailModalProps) {
  
  // State for administrative printing transcript template
  const [isPrintFriendly, setIsPrintFriendly] = useState(false);

  // Fetch linked family members
  const spouse = resident.famille.conjointId 
    ? allResidents.find(r => r.id === resident.famille.conjointId) 
    : undefined;

  const father = resident.famille.pereId 
    ? allResidents.find(r => r.id === resident.famille.pereId) 
    : undefined;

  const mother = resident.famille.mereId 
    ? allResidents.find(r => r.id === resident.famille.mereId) 
    : undefined;

  const children = (resident.famille.enfantsIds || [])
    .map(childId => allResidents.find(r => r.id === childId))
    .filter((child): child is Habitant => !!child);

  // Household members (sharing codeMenage)
  const householdMembers = allResidents.filter(
    r => r.famille.codeMenage === resident.famille.codeMenage && r.id !== resident.id
  );

  // Filter logs for this individual
  const individualLogs = logs.filter(log => 
    log.habitantId === resident.id || 
    (log.details && (log.details.toLowerCase().includes(resident.nom.toLowerCase()) || log.details.includes(resident.id)))
  );

  const calculateAge = (dateN: string) => {
    const birthday = new Date(dateN);
    const ageDifMs = Date.now() - birthday.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const getAvatarBg = () => {
    if (resident.statut === 'Décédé') return 'bg-slate-200 text-slate-500 border-slate-300';
    if (resident.statut === 'Déménagé') return 'bg-amber-100 text-amber-700 border-amber-200';
    return resident.sexe === 'M' 
      ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
      : 'bg-pink-100 text-pink-700 border-pink-200';
  };

  const age = calculateAge(resident.dateNaissance);

  // 1. DYNAMIC 360 DEGREE PROFILE SCORE METER
  const getCompletenessScore = () => {
    const checks = {
      name: !!resident.nom && !!resident.prenom,
      birth: !!resident.dateNaissance && !!resident.lieuNaissance,
      cin: !!resident.cin && resident.cin.length === 12,
      phone: !!resident.telephone && resident.telephone.trim() !== '',
      email: !!resident.email && resident.email.trim() !== '',
      address: !!resident.residence.adresse && resident.residence.adresse.trim() !== 'Lot III A' && resident.residence.adresse.trim() !== '',
      gps: !!resident.residence.gps,
      skills: !!resident.education.competences && resident.education.competences.length > 0,
      income: !!resident.economie.revenuEstime && resident.economie.revenuEstime > 0,
      vaccines: !!resident.sante.vaccination && resident.sante.vaccination.length > 0,
      blood: !!resident.sante.groupeSanguin
    };

    const keys = Object.keys(checks);
    const score = Object.values(checks).filter(Boolean).length;
    const pct = Math.round((score / keys.length) * 100);

    let status = 'Fiche basique';
    let color = 'bg-rose-500';
    let textColor = 'text-rose-650';
    let bgLight = 'bg-rose-50/50 border-rose-100';

    if (pct >= 80) {
      status = 'Dossier Complet 360°';
      color = 'bg-emerald-600';
      textColor = 'text-emerald-700';
      bgLight = 'bg-emerald-50/40 border-emerald-100';
    } else if (pct >= 45) {
      status = 'Dossier Moyen';
      color = 'bg-amber-500';
      textColor = 'text-amber-700';
      bgLight = 'bg-amber-50/40 border-amber-100';
    }

    return { pct, status, color, textColor, bgLight, checks };
  };

  const completeness = getCompletenessScore();

  // 2. CONSOLIDATED HOUSEHOLD STATS
  const consolidatedHouseholdIncome = allResidents
    .filter(r => r.famille.codeMenage === resident.famille.codeMenage)
    .reduce((acc, curr) => acc + (curr.economie.revenuEstime || 0), 0);

  const householdCount = allResidents.filter(
    r => r.famille.codeMenage === resident.famille.codeMenage
  ).length;

  return (
    <div id="resident-detail-overlay" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {resident.photoUrl ? (
              <img 
                src={resident.photoUrl} 
                alt={`${resident.nom} ${resident.prenom}`} 
                className="w-10 h-10 object-cover rounded-full border border-slate-300 shadow-xs shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full font-mono font-bold text-xs flex items-center justify-center border ${getAvatarBg()}`}>
                {resident.nom.charAt(0)}{resident.prenom.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-extrabold text-slate-950 uppercase font-sans leading-none tracking-tight">
                  {resident.nom} {resident.prenom}
                </h2>
                <span className={`text-[10px] uppercase font-mono tracking-wider font-semibold px-2 py-0.5 rounded-sm ${
                  resident.statut === 'Actif' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                  resident.statut === 'Décédé' ? 'bg-slate-200 text-slate-800 border border-slate-300' :
                  'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {resident.statut}
                </span>
                {resident.famille.isChefMenage && (
                  <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-sm flex items-center font-mono border border-indigo-100">
                    <Shield className="h-2.5 w-2.5 mr-0.5 text-indigo-500" />
                    Chef de ménage
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-1">Identifiant : <span className="font-bold text-slate-850">{resident.id}</span> • Foyer : <span className="font-bold text-slate-850">{resident.famille.codeMenage}</span></p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPrintFriendly(!isPrintFriendly)}
              className="p-1 px-2.5 hover:bg-slate-100 text-indigo-600 hover:text-indigo-800 rounded-lg text-xs font-sans font-bold transition flex items-center space-x-1 border border-indigo-200"
              title="Formater pour l'impression A4 municipale"
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              <span>{isPrintFriendly ? "Mode Écran" : "Fiche A4 Imprimable"}</span>
            </button>
            <button 
              onClick={onClose}
              className="p-1 px-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg text-xs font-mono font-bold transition flex items-center space-x-1 border border-slate-200"
            >
              <span>ESC</span>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE TRANSCRIPT MODE ACTIVE */}
        {isPrintFriendly ? (
          <div className="p-8 overflow-y-auto flex-1 space-y-6 bg-white font-serif max-w-4xl mx-auto border-x border-dashed border-slate-300 selection:bg-slate-100">
            {/* Stamp / Official Header */}
            <div className="border border-double border-slate-800 p-4 text-center text-xs space-y-1 bg-white">
              <h2 className="font-sans font-bold uppercase tracking-widest text-sm text-slate-950">Repoblikan'i Madagasikara</h2>
              <p className="italic text-[10px]">"Fitiavana - Tanindrazana - Fandrosoana"</p>
              <div className="w-16 h-0.5 bg-slate-800 mx-auto my-1.5 font-sans"></div>
              <p className="font-sans font-bold uppercase text-[11px] text-slate-800">COMMUNE D'ASSIGNATION : {resident.residence.commune.toUpperCase()}</p>
              <p className="font-sans font-bold uppercase text-[11px] text-slate-800">MEMBRE DU FOKONTANY : {resident.residence.fokontany.toUpperCase()}</p>
              <p className="text-[10px]">ID SÉCURISÉ : {resident.id} • ZONE RECRUTEMENT : {resident.residence.district}</p>
            </div>

            <div className="text-center py-2">
              <h1 className="text-lg font-bold font-sans uppercase underline tracking-wide text-slate-900">FICHE SOCIALE INDIVIDUELLE DE RECENSEMENT 360°</h1>
              <p className="text-[10px] font-mono italic mt-1 text-slate-500">Document certifié conforme issu du registre numérique en date du {new Date().toLocaleDateString('fr-FR')}</p>
            </div>

            {/* Print Grid Table */}
            <div className="border border-slate-600 rounded-sm text-xs divide-y divide-slate-600 bg-white">
              
              {/* Section 1: Civil */}
              <div className="grid grid-cols-2 divide-x divide-slate-600 p-2.5">
                <div className="space-y-1">
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">NOM DE FAMILLE :</span>
                  <p className="font-bold text-slate-900 uppercase">{resident.nom}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">PRÉNOMS DÉCLARÉS :</span>
                  <p className="font-bold text-slate-900">{resident.prenom}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-600 p-2.5">
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">DATE DE NAISSANCE :</span>
                  <p>{new Date(resident.dateNaissance).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">LIEU DE NAISSANCE :</span>
                  <p>{resident.lieuNaissance}</p>
                </div>
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">SEXE / ÂGE :</span>
                  <p>{resident.sexe === 'M' ? 'Masculin' : 'Féminin'} ({age} ans)</p>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-600 p-2.5">
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">CARTE D'IDENTITÉ NATIONALE (CIN) :</span>
                  <p className="font-mono font-bold">{resident.cin || "NÉANT / MINEUR"}</p>
                </div>
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">DATE ET LIEU D'ÉTABLISSEMENT :</span>
                  <p>{resident.dateCin ? new Date(resident.dateCin).toLocaleDateString('fr-FR') : "N/A"}</p>
                </div>
              </div>

              {/* Section 2: Residence & Contacts */}
              <div className="grid grid-cols-2 divide-x divide-slate-600 p-2.5">
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">ADRESSE PHYSIQUE COMPLÈTE :</span>
                  <p className="font-bold">{resident.residence.adresse}, FKT {resident.residence.fokontany}</p>
                </div>
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">COORDONNÉES DE CONTACT :</span>
                  <p className="font-mono">Tél: {resident.telephone || "NON COMMUNIQUÉ"}</p>
                  <p className="font-mono text-[10px]">{resident.email || ""}</p>
                </div>
              </div>

              {/* Section 3: Economy & Education */}
              <div className="grid grid-cols-2 divide-x divide-slate-600 p-2.5">
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">INSTRUCTION & COMPÉTENCES :</span>
                  <p>Niveau : {resident.education.niveauEtude} {resident.education.diplome ? `(${resident.education.diplome})` : ''}</p>
                  <p className="text-[11px] text-slate-700 italic">Savoir-faire : {resident.education.competences.join(', ') || 'Néant'}</p>
                </div>
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">PROFESSION & REVENUE :</span>
                  <p>{resident.economie.profession} ({resident.economie.secteur})</p>
                  <p className="font-mono text-xs font-bold text-slate-900 bg-slate-100 py-0.5 px-1 inline-block mt-0.5">
                    {resident.economie.revenuEstime ? `${resident.economie.revenuEstime.toLocaleString('fr-FR')} Ariary/mois` : 'Non déclaré'}
                  </p>
                </div>
              </div>

              {/* Section 4: Health */}
              <div className="grid grid-cols-3 divide-x divide-slate-600 p-2.5">
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">GROUPE SANGUIN :</span>
                  <p className="font-bold text-rose-700">{resident.sante.groupeSanguin || 'Inconnu'}</p>
                </div>
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">SITUATION HANDICAP :</span>
                  <p>{resident.sante.handicap || 'Aucun handicap déclaré'}</p>
                </div>
                <div>
                  <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">MALADIES CHRONIQUES :</span>
                  <p>HTA : {resident.sante.hypertension} • Diabète : {resident.sante.diabete}</p>
                </div>
              </div>

              {/* Section 5: Vulnerability Diagnostic */}
              <div className="p-2.5 space-y-1">
                <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">DIAGNOSTIC DE VULNÉRABILITÉ DU SOCIAL ET INTERVENTIONS :</span>
                {resident.vulnerabilite?.estVulnerable ? (
                  <div className="space-y-1 text-slate-800">
                    <p className="font-bold text-rose-700 font-sans text-[10px]">CRITÈRES DE PRÉCARITÉ : <span className="underline">{resident.vulnerabilite.categories.join(', ')}</span></p>
                    <p className="font-bold font-sans text-[10px]">DEGRÉ D'URGENCE INTERNE : <span className="text-red-700">{resident.vulnerabilite.niveauPriorite.toUpperCase()}</span></p>
                    <p className="italic text-slate-750 font-serif">" {resident.vulnerabilite.description || 'Pas de note complémentaire.'} "</p>
                    <p className="font-bold text-emerald-800 text-[10px] font-sans">AIDES MUNICIPALES PERCUES : {resident.vulnerabilite.aidesObtenues.join(', ') || 'Aucune aide reçue'}</p>
                  </div>
                ) : (
                  <p className="italic text-slate-500">Sujet stable. Aucun indicateur d'indigence ou de vulnérabilité majeure n'a été recensé sur cet individu à ce jour.</p>
                )}
              </div>

              {/* Section 6: Family Hierarchy */}
              <div className="p-2.5 space-y-1.5">
                <span className="font-sans text-[9px] text-slate-500 uppercase block font-bold">MEMBRES COMPOSANT LE FOYER ({resident.famille.codeMenage}) :</span>
                <div className="grid grid-cols-2 gap-4 text-[11px] font-sans">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold">CHEF / CONJOINT :</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {resident.famille.isChefMenage ? (
                        <li className="font-semibold text-slate-950">{resident.nom} {resident.prenom} (Moi - Chef)</li>
                      ) : (
                        <li>Chef de Famille rattaché</li>
                      )}
                      {spouse && (
                        <li>{spouse.nom} {spouse.prenom} (Conjoint(e))</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold">DESCENTE EN CHARGE DIRECTE ({children.length}) :</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {children.map(child => (
                        <li key={child.id}>{child.nom} {child.prenom} ({calculateAge(child.dateNaissance)} ans)</li>
                      ))}
                      {children.length === 0 && <span className="text-slate-400 italic">Néant</span>}
                    </ul>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer with Signatures representation */}
            <div className="pt-12 grid grid-cols-2 text-center text-xs font-sans gap-8">
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-wider text-slate-700">L'Enquêteur Fokontany</p>
                <div className="h-16"></div>
                <p className="italic text-[10px] text-slate-400">Signature et visa numérique</p>
              </div>
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-wider text-slate-700">Le Chef Fokontany</p>
                <div className="h-16"></div>
                <p className="font-bold underline text-indigo-700 font-mono text-[10px]">Sceau d'Authenticité Appliqué</p>
              </div>
            </div>

            <div className="text-center pt-8 font-sans">
              <button
                onClick={() => window.print()}
                className="bg-slate-900 text-white text-xs font-bold py-2 px-5 rounded hover:bg-slate-800 transition shadow-md"
              >
                Lancer l'impression Papier / Exporter PDF officiel
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD FULL 360 WORKSPACE VIEW */
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
            
            {/* Top row: Unified Actions & Quick Statuses */}
            <div className="flex flex-wrap items-center justify-between gap-3.5 bg-white p-4 border border-slate-250 shadow-2xs rounded-xl">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onEdit(resident)}
                  className="bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-3xs transition"
                >
                  <Edit className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Modifier la fiche</span>
                </button>
                
                <button
                  onClick={() => onGenerateCertificate(resident)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs transition"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Délivrer un Certificat</span>
                </button>

                {/* ADD FAMILY MEMBER EXCLUSIVE TRIGGER IN 360° */}
                <button
                  onClick={() => onAddFamilyMember(resident)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center space-x-1.5 shadow-xs transition"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Inscrire un membre à ce foyer</span>
                </button>
              </div>

              <div className="flex items-center space-x-1 text-xs border-l border-slate-200 pl-3.5 flex-wrap gap-y-1">
                <span className="text-[11px] text-slate-400 mr-1.5 uppercase font-mono">Statut Réel :</span>
                {resident.statut !== 'Actif' && (
                  <button 
                    onClick={() => onQuickStatusChange(resident.id, 'Actif')}
                    className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-sm"
                  >
                    Déclarer Actif
                  </button>
                )}
                {resident.statut !== 'Décédé' && (
                  <button 
                    onClick={() => onQuickStatusChange(resident.id, 'Décédé')}
                    className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-sm"
                  >
                    Déclarer Décès
                  </button>
                )}
                {resident.statut !== 'Déménagé' && (
                  <button 
                    onClick={() => onQuickStatusChange(resident.id, 'Déménagé')}
                    className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-sm"
                  >
                    Déclarer Départ
                  </button>
                )}
              </div>
            </div>

            {/* Quick 360 Summary row containing Completeness indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* Completeness assessment score card */}
              <div className={`p-4 border rounded-xl flex items-center shadow-3xs space-x-4 bg-white ${completeness.bgLight}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-white ${completeness.color} shadow-xs`}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-widest text-slate-450 uppercase block">Complétude 360°</span>
                    <span className={`text-[9px] font-semibold uppercase px-1 rounded ${completeness.textColor} bg-white border`}>{completeness.status}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className={`h-2 rounded-full ${completeness.color}`} style={{ width: `${completeness.pct}%` }}></div>
                    </div>
                    <span className="text-xs font-extrabold text-slate-800">{completeness.pct}%</span>
                  </div>
                </div>
              </div>

              {/* Household aggregate details */}
              <div className="p-4 bg-white border border-slate-250 rounded-xl flex items-center shadow-3xs space-x-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-indigo-50 border border-indigo-150 text-indigo-700 shadow-3xs">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] font-mono tracking-widest text-slate-450 uppercase block font-semibold">Ménage Recensé</span>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-xl font-extrabold text-slate-900 leading-none">{householdCount}</span>
                    <span className="text-xs text-slate-500">habitant(s) rattaché(s)</span>
                  </div>
                  <p className="text-[10px] font-mono text-indigo-650 bg-indigo-50/50 inline-block px-1.5 py-0.5 rounded border border-indigo-100">Foyer ID : {resident.famille.codeMenage}</p>
                </div>
              </div>

              {/* Consolidated Household income summary */}
              <div className="p-4 bg-white border border-slate-250 rounded-xl flex items-center shadow-3xs space-x-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 border border-emerald-150 text-emerald-700 shadow-3xs">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] font-mono tracking-widest text-slate-450 uppercase block font-semibold font-sans">Budget Mensuel Foyer</span>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-base font-black text-slate-900 font-mono leading-none">{consolidatedHouseholdIncome.toLocaleString('fr-FR')}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Ariary</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Revenu global consolidé déclaré</p>
                </div>
              </div>

            </div>

            {/* 360 DETAIL DIAGNOSTIC MATRIX GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* PRIMARY LEFT PANEL: CIVIL DETAILS, GPS, EDUCATION */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* 1. CIVIL CARD */}
                <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-3xs space-y-4">
                  <h3 className="text-xs font-extrabold font-mono text-slate-450 uppercase tracking-widest flex items-center pb-2 border-b border-slate-100">
                    <User className="h-4 w-4 mr-2 text-indigo-500" />
                    1. État civil et données d'identité
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Nom complet</span>
                      <p className="font-extrabold text-slate-950 uppercase text-sm font-sans leading-none">{resident.nom}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Prénoms</span>
                      <p className="font-extrabold text-slate-800 text-sm leading-none">{resident.prenom}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Naissance</span>
                      <p className="font-semibold text-slate-800 flex items-center">
                        <Calendar className="h-3.5 w-3.5 text-slate-350 mr-1 shrink-0" />
                        {new Date(resident.dateNaissance).toLocaleDateString('fr-FR')} à {resident.lieuNaissance} ({age} ans)
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Carte d'Identité Nationale (CIN)</span>
                      {resident.cin ? (
                        <p className="font-mono font-bold text-slate-905 border border-slate-150 p-1 px-2 rounded bg-slate-50 inline-block text-[11px]">
                          {resident.cin} {resident.dateCin && <span className="text-xs text-slate-400 font-normal font-sans">(éditée le {new Date(resident.dateCin).toLocaleDateString('fr-FR')})</span>}
                        </p>
                      ) : (
                        <p className="text-slate-400 italic">Mineur (sans CIN) ou non-déclarée</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Coordonnées Téléphone</span>
                      <p className="text-slate-700 font-semibold flex items-center font-mono">
                        <Phone className="h-3.5 w-3.5 text-indigo-400 mr-2" />
                        {resident.telephone || 'Non renseignée'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Adresse E-mail</span>
                      <p className="text-slate-700 font-bold flex items-center">
                        <Mail className="h-3.5 w-3.5 text-indigo-400 mr-2" />
                        {resident.email || 'Aucune adresse e-mail rattachée'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. ADRESSE & GEOLOCALISATION */}
                <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-3xs space-y-4">
                  <h3 className="text-xs font-extrabold font-mono text-slate-450 uppercase tracking-widest flex items-center pb-2 border-b border-slate-100">
                    <MapPin className="h-4 w-4 mr-2 text-emerald-500" />
                    2. Résidence fokontany & Données de géolocalisation
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1 col-span-2">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Adresse physique (Lot/Villa/Parcelle)</span>
                      <p className="font-bold text-slate-800 text-sm">{resident.residence.adresse}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Fokontany local</span>
                      <p className="font-extrabold text-indigo-650">{resident.residence.fokontany}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Commune assignée</span>
                      <p className="font-semibold text-slate-700">{resident.residence.commune}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">District administratif d'action</span>
                      <p className="font-semibold text-slate-700">{resident.residence.district}</p>
                    </div>

                    {resident.residence.carreau && (
                      <div className="space-y-1">
                        <span className="text-slate-400 text-[10px] uppercase block font-bold">Secteur / Carreau</span>
                        <p className="font-extrabold text-slate-800">{resident.residence.carreau} {resident.residence.numCarreau ? `(N° ${resident.residence.numCarreau})` : ''}</p>
                      </div>
                    )}

                    {resident.residence.nombrePieces && (
                      <div className="space-y-1">
                        <span className="text-slate-400 text-[10px] uppercase block font-bold">Maisonnette / Habitat</span>
                        <p className="font-semibold text-slate-700">{resident.residence.nombrePieces} pièces {resident.residence.superficieMaison ? `• ${resident.residence.superficieMaison} m²` : ''}</p>
                      </div>
                    )}

                    {resident.residence.gps ? (
                      <div className="border border-emerald-100 rounded-lg p-3 bg-emerald-50/20 text-xs flex items-center justify-between col-span-2">
                        <div className="flex items-center space-x-2 text-emerald-900 font-semibold">
                          <Compass className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="font-mono">Lat: {resident.residence.gps.lat}, Lng: {resident.residence.gps.lng}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-mono font-bold uppercase">SIG Fokontany d'Analakely branché</span>
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-200 rounded-lg p-3 text-slate-400 italic bg-slate-50 text-[11px] col-span-2">
                        Aucun point GPS enregistré pour localiser cette maisonnette.
                      </div>
                    )}

                    {resident.residence.photoMaisonUrl && (
                      <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 col-span-2 flex items-center space-x-3.5">
                        <img 
                          src={resident.residence.photoMaisonUrl} 
                          alt="Photo de la maison" 
                          className="w-24 h-16 object-cover rounded-lg border border-slate-300 shadow-3xs shrink-0" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="text-left">
                          <span className="text-[9px] font-mono uppercase bg-indigo-50 border border-indigo-120 text-indigo-700 px-1.5 py-0.5 rounded font-extrabold block w-max">Photo de la Propriété</span>
                          <p className="text-[10px] text-slate-550 leading-normal mt-1 font-medium">Vue extérieure cadastrale de la maison du citoyen.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. EDUCATION & METIERS */}
                <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-3xs space-y-4">
                  <h3 className="text-xs font-extrabold font-mono text-slate-450 uppercase tracking-widest flex items-center pb-2 border-b border-slate-100">
                    <GraduationCap className="h-4 w-4 mr-2 text-cyan-500" />
                    3. Profil académique & Activités socioprofessio-économiques
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Niveau d'Instruction</span>
                      <p className="font-bold text-slate-800 bg-slate-100 p-2 rounded inline-block">
                        {resident.education.niveauEtude} {resident.education.diplome && `— Diplôme : ${resident.education.diplome}`}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Langues maîtrisées</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {resident.education.langues.map(lang => (
                          <span key={lang} className="bg-sky-50 text-sky-800 text-[9px] font-bold px-2 py-0.5 rounded border border-sky-100 uppercase">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1 col-span-2">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Savoir-faire, Techniques & Métiers d'Art</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {resident.education.competences && resident.education.competences.length > 0 ? (
                          resident.education.competences.map(skill => (
                            <span key={skill} className="bg-slate-100 text-slate-800 text-[10px] px-2.5 py-1 rounded border border-slate-250 font-bold">
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Aucun savoir-faire répertorié.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Profession déclarée</span>
                      <p className="font-bold text-slate-800">
                        {resident.economie.profession}
                      </p>
                      <p className="text-[10px] text-slate-450 leading-none mt-0.5">Secteur : {resident.economie.secteur}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] uppercase block font-bold">Revenu Mensuel Personnel Estimé</span>
                      <p className="font-mono text-xs font-black text-emerald-800 bg-emerald-50/50 py-1.5 px-3 rounded-lg border border-emerald-100 inline-block mt-0.5">
                        {resident.economie.revenuEstime ? `${resident.economie.revenuEstime.toLocaleString('fr-FR')} Ariary` : 'Non déclaré / Sans emploi actif'}
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT PANEL: SOCIAL CLASSIFICATION, STAKEHOLDER GRAPHS */}
              <div className="space-y-6 col-span-1">
                
                {/* 4. EXCLUSIVE SOCIAL VULNERABILITY PORTFOLIO CARD */}
                <div className={`border rounded-xl p-5 shadow-3xs space-y-4 bg-white ${resident.vulnerabilite?.estVulnerable ? 'relative overflow-hidden border-rose-300 bg-rose-50/5' : 'border-slate-205'}`}>
                  {resident.vulnerabilite?.estVulnerable && (
                    <div className="absolute right-0 top-0 bg-rose-600 text-white text-[9px] font-black font-mono uppercase px-3.5 py-1 rotate-45 translate-x-7 translate-y-3 shadow-xs select-none">
                      URGENT
                    </div>
                  )}

                  <h3 className="text-xs font-black font-mono text-slate-450 uppercase tracking-widest flex items-center pb-1 border-b border-slate-100">
                    <AlertTriangle className={`h-4 w-4 mr-2 ${resident.vulnerabilite?.estVulnerable ? 'text-rose-500' : 'text-slate-400'}`} />
                    4. Précarité et Vulnérabilité
                  </h3>

                  {resident.vulnerabilite?.estVulnerable ? (
                    <div className="space-y-3.5 text-xs">
                      
                      {/* Priority rating alert box */}
                      <div className={`p-3 rounded-lg border flex items-center justify-between font-sans font-extrabold ${
                        resident.vulnerabilite.niveauPriorite === 'Critique' 
                          ? 'bg-rose-100/60 border-rose-200 text-rose-800' 
                          : 'bg-amber-100/50 border-amber-200 text-amber-850'
                      }`}>
                        <span className="text-[10px] uppercase">Priorité Sociale d'Urgence :</span>
                        <strong className="text-xs uppercase font-mono tracking-wider">{resident.vulnerabilite.niveauPriorite}</strong>
                      </div>

                      {/* Risk category tag listing */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Foyers à risque et vulnérabilités :</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {resident.vulnerabilite.categories.map(cat => (
                            <span key={cat} className="bg-rose-100 border border-rose-200 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full select-none">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Diagnostic Comments */}
                      {resident.vulnerabilite.description && (
                        <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-slate-700 italic font-serif leading-relaxed text-[11px]">
                          " {resident.vulnerabilite.description} "
                        </div>
                      )}

                      {/* Financial aid and items list */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Aides publiques de secours perçues :</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {resident.vulnerabilite.aidesObtenues.length > 0 ? (
                            resident.vulnerabilite.aidesObtenues.map(aid => {
                              const labelText = aid === 'Vivres' ? 'Kit Nourriture Fokontany' :
                                                aid === 'Aide financière' ? 'Monétaire (Vatsy direct)' :
                                                aid === 'Soins gratuits' ? 'Soins de Base Gratuits' :
                                                'Bourse Scolatire de soutien';
                              return (
                                <span key={aid} className="bg-emerald-50 text-emerald-800 border border-emerald-250 text-[9.5px] font-bold px-2 py-0.5 rounded flex items-center font-mono">
                                  ✓  {labelText}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-slate-400 italic text-[11px] block pl-1">Aucune aide recensée. En attente de fonds communaux.</span>
                          )}
                        </div>
                      </div>

                    </div>
                  ) : (
                    /* Stable profile representation */
                    <div className="text-center py-6 text-slate-400 text-xs italic space-y-2">
                      <Shield className="h-10 w-10 text-slate-300 mx-auto" />
                      <p className="font-semibold block text-[11px]">Profil Social Stable</p>
                      <p className="text-[10px] text-slate-400 leading-tight">Aucun indicateur d'indigence, d'exclusion ou de précarité active dans nos registres Fokontany.</p>
                    </div>
                  )}
                </div>

                {/* 5. CLINICAL BLOOD & HEALTH ALERT STATUSES */}
                <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-3xs space-y-4">
                  <h3 className="text-xs font-extrabold font-mono text-slate-450 uppercase tracking-widest flex items-center pb-2 border-b border-slate-100">
                    <HeartPulse className="h-4 w-4 mr-2 text-rose-500" />
                    5. Diagnostics Cliniques & Vaccins
                  </h3>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Groupe Sanguin</span>
                      <strong className="bg-rose-50 text-rose-700 px-2.5 py-0.5 border border-rose-150 rounded font-mono text-xs">
                        {resident.sante.groupeSanguin || 'Inconnu'}
                      </strong>
                    </div>

                    {resident.sante.poids && (
                      <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-100">
                        <span className="text-slate-500">Poids de l'enfant</span>
                        <strong className="text-slate-800 font-mono text-xs bg-slate-100 py-0.5 px-2 rounded">
                          {resident.sante.poids} kg
                        </strong>
                      </div>
                    )}

                    {resident.sante.taille && (
                      <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-100">
                        <span className="text-slate-550">Taille de l'enfant</span>
                        <strong className="text-slate-800 font-mono text-xs bg-slate-100 py-0.5 px-2 rounded">
                          {resident.sante.taille} cm
                        </strong>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Vaccinations Administrées</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {resident.sante.vaccination && resident.sante.vaccination.length > 0 ? (
                          resident.sante.vaccination.map(vaccine => (
                            <span key={vaccine} className="bg-indigo-50 text-indigo-800 border border-indigo-150 text-[9px] font-bold px-1.5 py-0.5 rounded leading-tight">
                              {vaccine.split('(')[0].trim()}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Aucune vaccination enregistrée.</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Suivis Cardiovasculaires / Diabète</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 p-2 rounded border border-slate-150 text-center space-y-0.5">
                          <span className="text-slate-500 text-[10px] block">Hypertension</span>
                          <span className={`text-[10px] font-extrabold font-mono p-0.5 px-1.5 rounded uppercase ${
                            resident.sante.hypertension === 'Normal' ? 'bg-emerald-50 text-emerald-800' :
                            resident.sante.hypertension === 'Surveillance' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-600 text-white'
                          }`}>
                            {resident.sante.hypertension}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-150 text-center space-y-0.5">
                          <span className="text-slate-500 text-[10px] block">Diabète</span>
                          <span className={`text-[10px] font-extrabold font-mono p-0.5 px-1.5 rounded uppercase ${
                            resident.sante.diabete === 'Normal' ? 'bg-emerald-50 text-emerald-800' :
                            resident.sante.diabete === 'Surveillance' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-600 text-white'
                          }`}>
                            {resident.sante.diabete}
                          </span>
                        </div>
                      </div>
                    </div>

                    {resident.sante.handicap && (
                      <div className="p-2.5 border border-orange-100 bg-orange-50/20 text-orange-950 rounded text-[11px] font-bold leading-tight">
                        <strong>Situation Handicap : </strong> {resident.sante.handicap}
                      </div>
                    )}

                  </div>
                </div>

                {/* 6. CO-RESIDANCE FAMILY MEMBERS TREE CHART */}
                <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-3xs space-y-4">
                  <h3 className="text-xs font-extrabold font-mono text-slate-450 uppercase tracking-widest flex items-center pb-2 border-b border-slate-100">
                    <UserCheck className="h-4 w-4 mr-2 text-indigo-500" />
                    6. Structure familiale & Graphes de co-habitants
                  </h3>

                  <div className="flex items-center justify-between pb-1">
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Membres affiliés au code de ménage <strong className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded border border-indigo-120">{resident.famille.codeMenage}</strong> :
                    </p>
                    <button
                      onClick={() => {
                        if (onAddFamilyMember) {
                          onAddFamilyMember(resident);
                        }
                      }}
                      className="p-1 px-2 border border-indigo-200 hover:border-indigo-300 bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-750 hover:text-indigo-900 rounded font-sans font-extrabold text-[10px] tracking-tight transition duration-150 flex items-center space-x-1 shadow-3xs cursor-pointer select-none"
                      title="Ajouter un nouveau membre de la famille co-habitant dans ce foyer"
                    >
                      <PlusCircle className="h-3 w-3" />
                      <span>Ajouter membre</span>
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    
                    {/* Epoux Conjoint */}
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-1">CONJOINT DIRECT COMPAGNON(E)</span>
                      {spouse ? (
                        <div 
                          onClick={() => onNavigateToResident(spouse)}
                          className="bg-purple-50/30 hover:bg-purple-50 border border-purple-100 p-2 rounded-lg flex items-center justify-between cursor-pointer group transition"
                        >
                          <div>
                            <strong className="text-purple-950 block font-sans uppercase text-[11px]">{spouse.nom} {spouse.prenom}</strong>
                            <span className="text-[9px] text-purple-650 font-mono">ID: {spouse.id}</span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-purple-400 group-hover:translate-x-0.5 transition" />
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px] pl-1.5">— Aucun conjoint officiel répertorié.</span>
                      )}
                    </div>

                    {/* Parents ascendants */}
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-1">PÈRE ASCENDANT</span>
                        {father ? (
                          <div 
                            onClick={() => onNavigateToResident(father)}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2 rounded-lg text-left truncate cursor-pointer transition flex justify-between items-center"
                          >
                            <span className="font-bold text-slate-800 text-[10px] uppercase truncate mr-1">{father.nom} {father.prenom.charAt(0)}.</span>
                            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                          </div>
                        ) : resident.famille.pereNom ? (
                          <div className="bg-slate-50/50 border border-slate-150 p-1.5 px-2.5 rounded-lg text-left">
                            <span className="font-bold text-slate-700 text-[10px] block truncate uppercase" title={resident.famille.pereNom}>{resident.famille.pereNom}</span>
                            <span className="text-[8px] text-slate-400 italic">Hors registre fokontany</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic pl-1">Non inscrit</span>
                        )}
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-1">MÈRE ASCENDANTE</span>
                        {mother ? (
                          <div 
                            onClick={() => onNavigateToResident(mother)}
                            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2 rounded-lg text-left truncate cursor-pointer transition flex justify-between items-center"
                          >
                            <span className="font-bold text-slate-800 text-[10px] uppercase truncate mr-1">{mother.nom} {mother.prenom.charAt(0)}.</span>
                            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                          </div>
                        ) : resident.famille.mereNom ? (
                          <div className="bg-slate-50/50 border border-slate-150 p-1.5 px-2.5 rounded-lg text-left">
                            <span className="font-bold text-slate-700 text-[10px] block truncate uppercase" title={resident.famille.mereNom}>{resident.famille.mereNom}</span>
                            <span className="text-[8px] text-slate-400 italic">Hors registre fokontany</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic pl-1">Non inscrite</span>
                        )}
                      </div>
                    </div>

                    {/* Children elements */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[9px] text-slate-400 font-bold block mb-1">ENFANTS À CHARGE DÉCLARÉS ({children.length})</span>
                      {children.length > 0 ? (
                        <div className="space-y-1 mt-1">
                          {children.map(child => (
                            <div 
                              key={child.id}
                              onClick={() => onNavigateToResident(child)}
                              className="bg-teal-50/20 hover:bg-teal-50/50 border border-teal-100 p-2 rounded-lg flex items-center justify-between cursor-pointer group transition"
                            >
                              <div>
                                <span className="font-bold text-teal-900 uppercase block text-[11px] leading-tight">{child.nom} {child.prenom}</span>
                                <span className="text-[9px] font-mono text-teal-650">{calculateAge(child.dateNaissance)} ans • ID: {child.id}</span>
                              </div>
                              <ArrowRight className="h-3.5 w-3.5 text-teal-400 group-hover:translate-x-0.5 transition" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px] pl-1.5">— Aucun enfant enregistré à charge.</span>
                      )}
                    </div>

                    {/* Co-habitants - other household inhabitants list */}
                    {householdMembers.length > children.length + (spouse ? 1 : 0) && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[9px] text-slate-400 font-bold block mb-1">CO-RÉSIDENTS DE LA MAISONNÉE</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {householdMembers
                            .filter(h => h.id !== spouse?.id && !resident.famille.enfantsIds.includes(h.id) && h.id !== father?.id && h.id !== mother?.id)
                            .map(cohab => (
                              <span 
                                key={cohab.id}
                                onClick={() => onNavigateToResident(cohab)}
                                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded cursor-pointer select-none"
                              >
                                {cohab.nom} {cohab.prenom.charAt(0)}. ➔
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* 7. INDIVIDUAL ACTION LOGS HISTORY */}
                <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-3xs space-y-4">
                  <h3 className="text-xs font-extrabold font-mono text-slate-400 uppercase tracking-widest flex items-center pb-2 border-b border-slate-105 transition">
                    <History className="h-4 w-4 mr-2 text-indigo-500" />
                    7. Historique des actions de l'individu
                  </h3>

                  {individualLogs.length > 0 ? (
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                      {individualLogs.map((log) => (
                        <div key={log.id} className="relative pl-4 border-l-2 border-slate-100 last:border-0 pb-1 text-xs">
                          <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
                          <div className="flex justify-between items-start">
                            <span className="font-mono text-[9px] text-slate-400">
                              {new Date(log.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="text-[8px] font-mono font-bold bg-slate-100 border border-slate-150 text-slate-600 rounded px-1 uppercase">
                              {log.action}
                            </span>
                          </div>
                          <p className="mt-1 font-sans text-slate-700 leading-normal font-medium">{log.details}</p>
                          <p className="text-[9px] text-slate-400 italic">Opérateur : {log.utilisateur}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 bg-slate-50/50 rounded-lg border border-slate-100">
                      <span className="text-slate-400 text-xs italic">Aucune action répertoriée pour cet individu.</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
