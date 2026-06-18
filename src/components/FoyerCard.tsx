import React from 'react';
import { Foyer, Membre } from '../types';
import { Home, Users, MapPin, ChevronRight, UserCheck, AlertTriangle } from 'lucide-react';

interface Props {
  foyer: Foyer;
  membres: Membre[];
  onClick: () => void;
}

export default function FoyerCard({ foyer, membres, onClick }: Props) {
  const chef = membres.find(m => m.is_chef);
  const vulnerables = membres.filter(m => m.est_vulnerable).length;
  const alertes = membres.filter(m => m.hypertension !== 'Normal' || m.diabete !== 'Normal').length;

  return (
    <div onClick={onClick} className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition cursor-pointer group">
      {/* Header foyer */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${foyer.statut === 'Actif' ? 'bg-indigo-50' : 'bg-slate-100'}`}>
              <Home className={`h-5 w-5 ${foyer.statut === 'Actif' ? 'text-indigo-600' : 'text-slate-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{foyer.code_menage}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${foyer.statut === 'Actif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : foyer.statut === 'Dissous' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{foyer.statut}</span>
              </div>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{chef ? `${chef.nom} ${chef.prenom}` : 'Chef non défini'}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition mt-1 shrink-0" />
        </div>
      </div>

      {/* Infos */}
      <div className="p-4 space-y-3">
        {/* Adresse */}
        {(foyer.adresse || foyer.fokontany) && (
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
            <span>{[foyer.adresse, foyer.fokontany].filter(Boolean).join(' · ')}</span>
          </div>
        )}

        {/* Membres */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-600"><strong>{foyer.nombre_membres}</strong> membre{foyer.nombre_membres > 1 ? 's' : ''}</span>
          </div>
          <div className="flex gap-2">
            {vulnerables > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" />{vulnerables} vulnérable{vulnerables > 1 ? 's' : ''}
              </span>
            )}
            {alertes > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                ⚕ {alertes} alerte{alertes > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Aperçu membres */}
        {membres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-50">
            {membres.slice(0, 5).map(m => (
              <span key={m.id} className={`text-[10px] font-medium px-2 py-1 rounded-full ${m.is_chef ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                {m.is_chef && <UserCheck className="h-2.5 w-2.5 inline mr-1" />}{m.prenom} {m.nom.charAt(0)}.
              </span>
            ))}
            {membres.length > 5 && <span className="text-[10px] text-slate-400 px-2 py-1">+{membres.length - 5}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
