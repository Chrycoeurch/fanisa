import React, { useRef } from 'react';
import { Membre, Foyer } from '../types';
import { X, Printer, Download } from 'lucide-react';

interface Props {
  membre: Membre;
  foyer: Foyer;
  allMembres: Membre[];
  onClose: () => void;
}

export default function MembreProfil360({ membre, foyer, allMembres, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const conjoint = allMembres.find(m => m.id === membre.conjoint_id);
  const pere = allMembres.find(m => m.id === membre.pere_id);
  const mere = allMembres.find(m => m.id === membre.mere_id);
  const enfants = allMembres.filter(m => m.pere_id === membre.id || m.mere_id === membre.id);
  const age = membre.date_naissance
    ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970)
    : null;

  const handlePrint = () => {
    const content = printRef.current?.innerHTML || '';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>Profil 360° — ${membre.nom} ${membre.prenom}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: white; font-size: 11px; }
          .page { padding: 20mm 15mm; max-width: 210mm; margin: 0 auto; }
          .header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 16px; }
          .photo { width: 80px; height: 96px; border-radius: 8px; object-fit: cover; border: 2px solid #e2e8f0; }
          .avatar { width: 80px; height: 96px; border-radius: 8px; background: #eef2ff; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold; color: #4f46e5; border: 2px solid #c7d2fe; }
          .header-info h1 { font-size: 22px; font-weight: 800; color: #1e293b; }
          .header-info .sub { color: #64748b; font-size: 11px; margin-top: 4px; }
          .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; margin-right: 4px; }
          .badge-actif { background: #dcfce7; color: #166534; }
          .badge-deces { background: #f1f5f9; color: #475569; }
          .badge-depart { background: #fef3c7; color: #92400e; }
          .badge-chef { background: #eef2ff; color: #4338ca; }
          .badge-relation { background: #f8fafc; color: #334155; border: 1px solid #e2e8f0; }
          .watermark { position: fixed; bottom: 20px; right: 20px; font-size: 9px; color: #cbd5e1; }
          .section { margin-bottom: 14px; break-inside: avoid; }
          .section-title { font-size: 9px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e0e7ff; padding-bottom: 4px; margin-bottom: 8px; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
          .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 12px; }
          .field label { font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 1px; }
          .field span { font-size: 11px; color: #1e293b; font-weight: 500; }
          .field span.mono { font-family: monospace; }
          .tag { display: inline-block; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 8px; font-size: 10px; margin: 2px; }
          .tag-green { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
          .tag-red { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
          .tag-amber { background: #fffbeb; border-color: #fde68a; color: #92400e; }
          .tag-rose { background: #fff1f2; border-color: #fecdd3; color: #9f1239; }
          .lien { display: inline-flex; align-items: center; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 10px; font-size: 10px; margin: 2px; }
          .lien .lien-label { color: #94a3b8; font-weight: 600; }
          .lien .lien-nom { color: #1e293b; font-weight: 700; }
          .alert-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 8px 12px; }
          .foyer-box { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; padding: 8px 12px; display: flex; gap: 16px; }
          .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; color: #94a3b8; font-size: 9px; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { padding: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          ${content}
          <div class="footer">
            <span>REPUBLIQUE DE MADAGASCAR · Fokontany de ${foyer.fokontany || '—'}</span>
            <span>Imprimé le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</span>
          </div>
        </div>
        <div class="watermark">Document officiel · Fokontany Local Ledger v2.0</div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  const statutClass = membre.statut === 'Actif' ? 'badge-actif' : membre.statut === 'Décédé' ? 'badge-deces' : 'badge-depart';

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header modal */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Profil 360° — Fiche imprimable</h2>
            <p className="text-xs text-slate-500 mt-0.5">{membre.nom} {membre.prenom} · Foyer {foyer.code_menage}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
              <Printer className="h-4 w-4" />Imprimer / PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
          </div>
        </div>

        {/* Aperçu */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div ref={printRef} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5 text-sm">

            {/* Header fiche */}
            <div className="header flex items-center gap-4 border-b-2 border-indigo-600 pb-4">
              {membre.photo_url
                ? <img src={membre.photo_url} alt="" className="w-20 h-24 rounded-lg object-cover border-2 border-slate-200 shrink-0" />
                : <div className="w-20 h-24 rounded-lg bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center text-3xl font-bold text-indigo-600 shrink-0">{membre.prenom?.charAt(0)}{membre.nom?.charAt(0)}</div>
              }
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`badge ${statutClass}`}>{membre.statut}</span>
                  <span className="badge badge-chef">{membre.relation_chef}</span>
                  {membre.est_vulnerable && <span className="badge badge-rose">⚠ Vulnérable</span>}
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900">{membre.nom} {membre.prenom}</h1>
                <p className="text-slate-500 text-xs mt-1">{membre.sexe === 'M' ? '♂ Masculin' : '♀ Féminin'} · {age !== null ? `${age} ans` : 'Âge inconnu'} · Foyer <strong className="text-indigo-600 font-mono">{foyer.code_menage}</strong></p>
                <div className="foyer-box mt-2">
                  <div><span className="text-[10px] text-indigo-400 uppercase font-bold block">Adresse</span><span className="text-xs text-indigo-900 font-semibold">{foyer.adresse || '—'}</span></div>
                  <div><span className="text-[10px] text-indigo-400 uppercase font-bold block">Fokontany</span><span className="text-xs text-indigo-900 font-semibold">{foyer.fokontany || '—'}</span></div>
                  <div><span className="text-[10px] text-indigo-400 uppercase font-bold block">Commune</span><span className="text-xs text-indigo-900 font-semibold">{foyer.commune || '—'}</span></div>
                </div>
              </div>
            </div>

            {/* Identité */}
            <div className="section">
              <p className="section-title">Identité civile</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Date de naissance', val: membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '—' },
                  { label: 'Lieu de naissance', val: membre.lieu_naissance || '—' },
                  { label: 'Numéro CIN', val: membre.cin || '—', mono: true },
                  { label: 'Date CIN', val: membre.date_cin ? new Date(membre.date_cin).toLocaleDateString('fr-FR') : '—' },
                  { label: 'Téléphone', val: membre.telephone || '—' },
                  { label: 'Email', val: membre.email || '—' },
                ].map(f => (
                  <div key={f.label} className="field">
                    <label>{f.label}</label>
                    <span className={f.mono ? 'mono' : ''}>{f.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Famille */}
            {(conjoint || pere || mere || membre.pere_nom || membre.mere_nom || enfants.length > 0) && (
              <div className="section">
                <p className="section-title">Liens familiaux</p>
                <div className="flex flex-wrap gap-1.5">
                  {conjoint && <span className="lien"><span>💑</span><span className="lien-label">{membre.sexe === 'M' ? 'Épouse' : 'Époux'} :</span><span className="lien-nom">{conjoint.nom} {conjoint.prenom}</span></span>}
                  {pere && <span className="lien"><span>👨</span><span className="lien-label">Père :</span><span className="lien-nom">{pere.nom} {pere.prenom}</span></span>}
                  {!pere && membre.pere_nom && <span className="lien"><span>👨</span><span className="lien-label">Père :</span><span className="lien-nom">{membre.pere_nom}</span><span style={{color:'#94a3b8',fontSize:'9px'}}>(hors registre)</span></span>}
                  {mere && <span className="lien"><span>👩</span><span className="lien-label">Mère :</span><span className="lien-nom">{mere.nom} {mere.prenom}</span></span>}
                  {!mere && membre.mere_nom && <span className="lien"><span>👩</span><span className="lien-label">Mère :</span><span className="lien-nom">{membre.mere_nom}</span><span style={{color:'#94a3b8',fontSize:'9px'}}>(hors registre)</span></span>}
                  {enfants.map(e => <span key={e.id} className="lien"><span>{e.sexe === 'M' ? '👦' : '👧'}</span><span className="lien-label">{e.sexe === 'M' ? 'Fils' : 'Fille'} :</span><span className="lien-nom">{e.nom} {e.prenom}</span></span>)}
                </div>
              </div>
            )}

            {/* Éducation & Économie */}
            <div className="section">
              <p className="section-title">Éducation & Situation économique</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Niveau d'instruction", val: membre.niveau_etude || '—' },
                  { label: 'Diplôme', val: membre.diplome || '—' },
                  { label: 'Profession', val: membre.profession || '—' },
                  { label: 'Secteur', val: membre.secteur || '—' },
                  { label: 'Employeur', val: membre.employeur || '—' },
                  { label: 'Revenu estimé', val: membre.revenu_estime ? `${membre.revenu_estime.toLocaleString('fr-FR')} Ar` : '—' },
                ].map(f => (
                  <div key={f.label} className="field">
                    <label>{f.label}</label>
                    <span>{f.val}</span>
                  </div>
                ))}
              </div>
              {membre.langues?.length > 0 && (
                <div className="mt-2"><label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Langues</label>
                  {membre.langues.map(l => <span key={l} className="tag">{l}</span>)}</div>
              )}
              {membre.competences?.length > 0 && (
                <div className="mt-2"><label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Compétences</label>
                  {membre.competences.map(c => <span key={c} className="tag">{c}</span>)}</div>
              )}
            </div>

            {/* Santé */}
            <div className="section">
              <p className="section-title">Santé</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="field"><label>Groupe sanguin</label><span className="font-bold text-red-700">{membre.groupe_sanguin || 'Inconnu'}</span></div>
                <div className="field"><label>Hypertension</label>
                  <span className={membre.hypertension === 'Prioritaire' ? 'tag tag-red' : membre.hypertension === 'Surveillance' ? 'tag tag-amber' : 'tag tag-green'}>{membre.hypertension}</span>
                </div>
                <div className="field"><label>Diabète</label>
                  <span className={membre.diabete === 'Prioritaire' ? 'tag tag-red' : membre.diabete === 'Surveillance' ? 'tag tag-amber' : 'tag tag-green'}>{membre.diabete}</span>
                </div>
                {membre.handicap && <div className="field"><label>Handicap</label><span>{membre.handicap}</span></div>}
                {membre.poids && <div className="field"><label>Poids</label><span>{membre.poids} kg</span></div>}
                {membre.taille && <div className="field"><label>Taille</label><span>{membre.taille} cm</span></div>}
              </div>
              {membre.vaccination?.length > 0 && (
                <div><label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Vaccinations</label>
                  {membre.vaccination.map(v => <span key={v} className="tag tag-green">✓ {v}</span>)}</div>
              )}
            </div>

            {/* Vulnérabilité */}
            {membre.est_vulnerable && (
              <div className="section">
                <p className="section-title" style={{color:'#e11d48'}}>⚠ Vulnérabilité</p>
                <div className="alert-box">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className={`badge ${membre.niveau_priorite === 'Critique' ? 'badge-deces' : 'badge-depart'}`} style={{background: membre.niveau_priorite === 'Critique' ? '#dc2626' : '#f59e0b', color:'white'}}>Priorité : {membre.niveau_priorite}</span>
                    {membre.vulnerabilite_categories.map(c => <span key={c} className="tag tag-rose">{c}</span>)}
                  </div>
                  {membre.vulnerabilite_description && <p className="text-xs text-slate-600 italic">{membre.vulnerabilite_description}</p>}
                  {membre.aides_obtenues?.length > 0 && (
                    <div className="mt-2"><label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Aides obtenues</label>
                      {membre.aides_obtenues.map(a => <span key={a} className="tag tag-green">✓ {a}</span>)}</div>
                  )}
                </div>
              </div>
            )}

            {/* Signature */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-100 text-center text-xs">
              {['Le déclarant', 'Le Chef Fokontany', 'Cachet officiel'].map(s => (
                <div key={s}>
                  <div className="h-14 border-b border-slate-300 mb-1"></div>
                  <span className="text-slate-400">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
