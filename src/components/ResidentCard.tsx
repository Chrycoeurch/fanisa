import React from 'react';
import { Habitant } from '../types';
import { Shield, Sparkles, MapPin, Contact, Activity, Heart, Award } from 'lucide-react';

interface ResidentCardProps {
  key?: React.Key;
  resident: Habitant;
  onSelect: (resident: Habitant) => void;
}

export default function ResidentCard({ resident, onSelect }: ResidentCardProps) {
  const getInitials = () => {
    return `${resident.nom.charAt(0)}${resident.prenom.charAt(0)}`.toUpperCase();
  };

  const getAvatarBg = () => {
    if (resident.statut === 'Décédé') return 'bg-slate-200 text-slate-500 border-slate-300';
    if (resident.statut === 'Déménagé') return 'bg-amber-100 text-amber-600 border-amber-200';
    return resident.sexe === 'M' 
      ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
      : 'bg-pink-50 text-pink-700 border-pink-200';
  };

  const calculateAge = (dateN: string) => {
    const birthday = new Date(dateN);
    const ageDifMs = Date.now() - birthday.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const age = calculateAge(resident.dateNaissance);

  return (
    <div 
      id={`resident-card-${resident.id}`}
      onClick={() => onSelect(resident)}
      className={`bg-white rounded-xl border p-5 cursor-pointer hover:shadow-md transition-all duration-200 ${
        resident.statut === 'Décédé' ? 'border-slate-100 opacity-70' :
        resident.statut === 'Déménagé' ? 'border-amber-200 bg-amber-50/10' :
        'border-slate-200 hover:border-indigo-300'
      }`}
    >
      <div className="flex items-start justify-between">
        {/* Avatar and Basic info */}
        <div className="flex items-center space-x-3.5">
          <div className="relative shrink-0">
            {resident.photoUrl ? (
              <img 
                src={resident.photoUrl} 
                alt={`${resident.nom} ${resident.prenom}`} 
                className="w-12 h-12 rounded-full object-cover border border-slate-300 shadow-xs"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-12 h-12 rounded-full border flex items-center justify-center font-bold text-sm tracking-wider font-mono ${getAvatarBg()}`}>
                {getInitials()}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-1.5 flex-wrap">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase">
                {resident.nom}
              </h3>
              <p className="text-sm font-medium text-slate-600 capitalize">
                {resident.prenom}
              </p>
            </div>
            
            {/* Status indicators */}
            <div className="flex items-center space-x-2 mt-1 flex-wrap gap-y-1">
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-semibold ${
                resident.sexe === 'M' ? 'bg-indigo-50 text-indigo-700' : 'bg-pink-50 text-pink-600'
              }`}>
                {resident.sexe === 'M' ? 'H' : 'F'}
              </span>
              <span className="text-[11px] font-mono font-medium text-slate-500">
                {age} ans
              </span>
              
              {resident.famille.isChefMenage && (
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded-sm font-semibold flex items-center">
                  <Shield className="h-2.5 w-2.5 mr-0.5" />
                  Chef
                </span>
              )}

              {resident.statut !== 'Actif' && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm font-semibold uppercase ${
                  resident.statut === 'Décédé' ? 'bg-slate-300 text-slate-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {resident.statut}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button Indicator */}
        <span className="text-[10px] font-mono bg-slate-50 text-slate-400 group-hover:text-indigo-600 border border-slate-100 px-2 py-0.5 rounded">
          {resident.famille.codeMenage}
        </span>
      </div>

      <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2 text-xs text-slate-500">
        {/* CIN details */}
        {resident.cin ? (
          <div className="flex items-center space-x-1.5">
            <Contact className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-mono text-[11px] text-slate-700 font-medium">CIN: {resident.cin}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Contact className="h-3.5 w-3.5" />
            <span className="italic font-mono text-[10px]">Aucune CIN enregistrée</span>
          </div>
        )}

        {/* Address Fokontany */}
        <div className="flex items-center space-x-1.5">
          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="truncate text-slate-600">{resident.residence.adresse}, <strong className="text-slate-800 font-normal">{resident.residence.fokontany}</strong></span>
        </div>

        {/* Profession */}
        <div className="flex justify-between items-center text-[11px] pt-1.5">
          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 truncate max-w-[170px]">
            {resident.economie.profession}
          </span>
          
          {/* Health status dots */}
          <div className="flex items-center space-x-1">
            {(resident.sante.hypertension === 'Prioritaire' || resident.sante.diabete === 'Prioritaire') ? (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" title="Santé prioritaire" />
            ) : (resident.sante.hypertension === 'Surveillance' || resident.sante.diabete === 'Surveillance') ? (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Santé surveillance" />
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Santé normale" />
            )}
            <span className="text-[10px] text-slate-400 font-mono">Médical</span>
          </div>
        </div>
      </div>
    </div>
  );
}
