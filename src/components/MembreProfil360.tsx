import React, { useState } from 'react';
import { Membre, Foyer } from '../types';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { X, Download, Loader2, FileText, User, Home as HomeIcon, GraduationCap, HeartPulse, ShieldAlert, Building2, Check, Printer } from 'lucide-react';
import { imprimerFicheIndividuelle } from '../lib/ficheIndividuelle';

interface Props {
  membre: Membre;
  foyer: Foyer;
  allMembres: Membre[];
  onClose: () => void;
}

type SectionKey = 'identite' | 'foyer' | 'famille' | 'education' | 'sante' | 'vulnerabilite' | 'foncier';

const SECTIONS: { key: SectionKey; label: string; icon: any; defaultOn: boolean }[] = [
  { key: 'identite', label: 'Identité civile', icon: User, defaultOn: true },
  { key: 'foyer', label: 'Foyer & Adresse', icon: HomeIcon, defaultOn: true },
  { key: 'famille', label: 'Liens familiaux', icon: User, defaultOn: true },
  { key: 'education', label: 'Éducation & Économie', icon: GraduationCap, defaultOn: true },
  { key: 'sante', label: 'Santé', icon: HeartPulse, defaultOn: true },
  { key: 'vulnerabilite', label: 'Vulnérabilité', icon: ShieldAlert, defaultOn: true },
  { key: 'foncier', label: 'Foncier (logement)', icon: Building2, defaultOn: false },
];

const C = {
  indigo: rgb(0.31, 0.27, 0.90), dark: rgb(0.07, 0.09, 0.17), mid: rgb(0.29, 0.33, 0.43),
  light: rgb(0.57, 0.63, 0.72), bg: rgb(0.97, 0.98, 1.00), green: rgb(0.09, 0.53, 0.22),
  greenBg: rgb(0.86, 0.99, 0.91), red: rgb(0.73, 0.11, 0.11), redBg: rgb(1.00, 0.93, 0.93),
  amber: rgb(0.63, 0.31, 0.00), amberBg: rgb(1.00, 0.97, 0.86), white: rgb(1, 1, 1), border: rgb(0.88, 0.91, 0.95),
};

function clean(text: string | undefined | null): string {
  if (!text) return '-';
  return text
    .replace(/[\u00e0-\u00e2]/g, 'a').replace(/[\u00e8-\u00ea]/g, 'e')
    .replace(/[\u00ec-\u00ee]/g, 'i').replace(/[\u00f2-\u00f4]/g, 'o')
    .replace(/[\u00f9-\u00fb]/g, 'u').replace(/\u00e7/g, 'c')
    .replace(/[\u00c0-\u00c2]/g, 'A').replace(/[\u00c8-\u00ca]/g, 'E')
    .replace(/[\u00cc-\u00ce]/g, 'I').replace(/[\u00d2-\u00d4]/g, 'O')
    .replace(/[\u00d9-\u00db]/g, 'U').replace(/\u00c7/g, 'C')
    .replace(/\u00e9/g, 'e').replace(/\u00c9/g, 'E')
    .replace(/\u00ef/g, 'i').replace(/\u00eb/g, 'e')
    .replace(/\u0153/g, 'oe').replace(/\u0152/g, 'OE')
    .replace(/[\u2014\u2013]/g, '-').replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"').replace(/[\u202f\u00a0\u2009\u200b]/g, ' ')
    .replace(/[^\x20-\xFF]/g, ' ').trim() || '-';
}

function wrap(text: string, maxChars: number): string[] {
  const t = clean(text);
  if (t === '-') return ['-'];
  const words = t.split(' ');
  const lines: string[] = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : ['-'];
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, fill: ReturnType<typeof rgb>, radius = 0) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill, borderRadius: radius });
}
function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  page.drawText(clean(text), { x, y, size, font, color });
}
function field(page: PDFPage, label: string, value: string, x: number, y: number, bold: PDFFont, reg: PDFFont, maxW = 160) {
  drawText(page, label.toUpperCase(), x, y, reg, 6.5, C.light);
  const lines = wrap(value || '-', Math.floor(maxW / 5.5));
  lines.forEach((l, i) => drawText(page, l, x, y - 12 - i * 10, bold, 8.5, C.dark));
  return 12 + lines.length * 10;
}
function sectionTitle(page: PDFPage, title: string, y: number, bold: PDFFont, W: number, margin: number) {
  drawRect(page, margin, y - 1, W - margin * 2, 16, C.bg, 3);
  page.drawLine({ start: { x: margin, y: y - 1 }, end: { x: margin + 3, y: y - 1 }, thickness: 16, color: C.indigo });
  drawText(page, title.toUpperCase(), margin + 10, y + 3, bold, 7.5, C.indigo);
  return 24;
}

async function generatePDF(membre: Membre, foyer: Foyer, allMembres: Membre[], sections: Set<SectionKey>) {
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842, margin = 36;
  const page = pdfDoc.addPage([W, H]);
  let y = H - margin;
  let sectionNum = 1;

  const conjoint = allMembres.find(m => m.id === membre.conjoint_id);
  const pere = allMembres.find(m => m.id === membre.pere_id);
  const mere = allMembres.find(m => m.id === membre.mere_id);
  const enfants = allMembres.filter(m => m.pere_id === membre.id || m.mere_id === membre.id);
  const age = membre.date_naissance ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970) : null;

  // HEADER (toujours présent)
  drawRect(page, 0, y - 70, W, 80, C.indigo, 0);
  drawRect(page, margin, y - 62, 52, 62, rgb(0.5, 0.5, 0.8), 6);
  drawText(page, `${membre.prenom?.charAt(0) || ''}${membre.nom?.charAt(0) || ''}`, margin + 14, y - 35, bold, 22, C.white);
  drawText(page, `${membre.nom} ${membre.prenom}`, margin + 62, y - 18, bold, 18, C.white);
  drawText(page, `${membre.sexe === 'M' ? 'Masculin' : 'Feminin'} - ${age !== null ? age + ' ans' : 'Age inconnu'} - ${membre.relation_chef}`, margin + 62, y - 32, reg, 9, rgb(0.8, 0.8, 1.0));
  drawText(page, `Foyer ${foyer.code_menage}`, margin + 62, y - 44, reg, 8.5, rgb(0.7, 0.7, 0.95));
  drawRect(page, margin + 62, y - 58, 52, 11, rgb(1, 1, 1), 3);
  drawText(page, membre.statut.toUpperCase(), margin + 65, y - 56, bold, 7, membre.statut === 'Actif' ? C.green : C.amber);
  drawText(page, 'FOKONTANY LOCAL LEDGER', W - margin - 130, y - 20, bold, 7, rgb(0.8, 0.8, 1));
  drawText(page, 'REPUBLIQUE DE MADAGASCAR', W - margin - 130, y - 30, reg, 6.5, rgb(0.7, 0.7, 0.9));
  drawText(page, `Imprime le ${new Date().toLocaleDateString('fr-FR')}`, W - margin - 130, y - 40, reg, 6.5, rgb(0.7, 0.7, 0.9));
  y -= 82;

  const col = (W - margin * 2) / 3;

  // IDENTITÉ
  if (sections.has('identite')) {
    y -= 8;
    y -= sectionTitle(page, `${sectionNum++}. Identite civile`, y, bold, W, margin);
    const fields1 = [
      ['Date de naissance', membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '-'],
      ['Lieu de naissance', membre.lieu_naissance || '-'],
      ['Numero CIN', membre.cin || '-'],
      ['Date CIN', membre.date_cin ? new Date(membre.date_cin).toLocaleDateString('fr-FR') : '-'],
      ['Telephone', membre.telephone || '-'],
      ['Email', membre.email || '-'],
    ];
    for (let i = 0; i < fields1.length; i += 3) {
      if (fields1[i]) field(page, fields1[i][0], fields1[i][1], margin, y, bold, reg, col - 8);
      if (fields1[i + 1]) field(page, fields1[i + 1][0], fields1[i + 1][1], margin + col, y, bold, reg, col - 8);
      if (fields1[i + 2]) field(page, fields1[i + 2][0], fields1[i + 2][1], margin + col * 2, y, bold, reg, col - 8);
      y -= 32;
    }
  }

  // FOYER
  if (sections.has('foyer')) {
    y -= 4;
    y -= sectionTitle(page, `${sectionNum++}. Foyer et Adresse`, y, bold, W, margin);
    drawRect(page, margin, y - 28, W - margin * 2, 32, C.bg, 4);
    field(page, 'Code menage', foyer.code_menage, margin + 8, y - 6, bold, reg, 100);
    field(page, 'Adresse', foyer.adresse || '-', margin + 115, y - 6, bold, reg, 160);
    field(page, 'Fokontany', foyer.fokontany || '-', margin + 295, y - 6, bold, reg, 100);
    field(page, 'Commune', foyer.commune || '-', margin + 405, y - 6, bold, reg, 100);
    y -= 44;
  }

  // FAMILLE
  if (sections.has('famille')) {
    const familles = [
      conjoint && { l: 'Conjoint', n: `${conjoint.nom} ${conjoint.prenom}` },
      (pere || membre.pere_nom) && { l: 'Pere', n: pere ? `${pere.nom} ${pere.prenom}` : `${membre.pere_nom} (hors registre)` },
      (mere || membre.mere_nom) && { l: 'Mere', n: mere ? `${mere.nom} ${mere.prenom}` : `${membre.mere_nom} (hors registre)` },
      ...enfants.map(e => ({ l: e.sexe === 'M' ? 'Fils' : 'Fille', n: `${e.nom} ${e.prenom}` })),
    ].filter(Boolean) as { l: string; n: string }[];
    if (familles.length > 0) {
      y -= 4;
      y -= sectionTitle(page, `${sectionNum++}. Liens familiaux`, y, bold, W, margin);
      let lx = margin;
      for (const f of familles) {
        const w = Math.max(f.l.length, f.n.length) * 5 + 20;
        if (lx + w > W - margin) { lx = margin; y -= 20; }
        drawRect(page, lx, y - 14, w, 16, C.bg, 3);
        drawText(page, f.l.toUpperCase(), lx + 5, y - 4, bold, 6, C.light);
        drawText(page, f.n, lx + 5, y - 11, bold, 7.5, C.dark);
        lx += w + 6;
      }
      y -= 28;
    }
  }

  // ÉDUCATION & ÉCONOMIE
  if (sections.has('education')) {
    y -= 4;
    y -= sectionTitle(page, `${sectionNum++}. Education et Situation economique`, y, bold, W, margin);
    const fields2 = [
      ["Niveau d'instruction", membre.niveau_etude || '-'],
      ['Diplome', membre.diplome || '-'],
      ['Activite principale', membre.profession || '-'],
      ['Statut professionnel', membre.statut_professionnel || '-'],
      ['Employeur', membre.employeur || '-'],
      ['Revenu mensuel', membre.revenu_fourchette || '-'],
    ];
    for (let i = 0; i < fields2.length; i += 3) {
      if (fields2[i]) field(page, fields2[i][0], fields2[i][1], margin, y, bold, reg, col - 8);
      if (fields2[i + 1]) field(page, fields2[i + 1][0], fields2[i + 1][1], margin + col, y, bold, reg, col - 8);
      if (fields2[i + 2]) field(page, fields2[i + 2][0], fields2[i + 2][1], margin + col * 2, y, bold, reg, col - 8);
      y -= 30;
    }
    if (membre.langues?.length) {
      drawText(page, 'LANGUES', margin, y, reg, 6.5, C.light); y -= 10;
      let lx2 = margin;
      for (const l of membre.langues.map(clean)) {
        const w = l.length * 5 + 12; drawRect(page, lx2, y - 3, w, 11, C.bg, 2);
        drawText(page, l, lx2 + 4, y, reg, 7, C.mid); lx2 += w + 4;
      }
      y -= 16;
    }
  }

  // SANTÉ
  if (sections.has('sante')) {
    y -= 4;
    y -= sectionTitle(page, `${sectionNum++}. Sante`, y, bold, W, margin);
    const hta = membre.hypertension, diab = membre.diabete;
    const htaC = hta === 'Prioritaire' ? C.red : hta === 'Surveillance' ? C.amber : C.green;
    const diabC = diab === 'Prioritaire' ? C.red : diab === 'Surveillance' ? C.amber : C.green;
    const htaBg = hta === 'Prioritaire' ? C.redBg : hta === 'Surveillance' ? C.amberBg : C.greenBg;
    const diabBg = diab === 'Prioritaire' ? C.redBg : diab === 'Surveillance' ? C.amberBg : C.greenBg;
    field(page, 'Groupe sanguin', membre.groupe_sanguin || 'Inconnu', margin, y, bold, reg, 90);
    drawRect(page, margin + 100, y - 3, 80, 13, htaBg, 3);
    drawText(page, `HTA: ${hta}`, margin + 104, y, bold, 7.5, htaC);
    drawRect(page, margin + 190, y - 3, 80, 13, diabBg, 3);
    drawText(page, `Diabete: ${diab}`, margin + 194, y, bold, 7.5, diabC);
    if (membre.handicap_oui) { drawRect(page, margin + 285, y - 3, 90, 13, C.amberBg, 3); drawText(page, 'Handicap: Oui', margin + 289, y, bold, 7.5, C.amber); }
    y -= 24;
    if (membre.vaccination?.length) {
      drawText(page, 'VACCINATIONS', margin, y, reg, 6.5, C.light); y -= 10;
      let vx = margin;
      for (const v of membre.vaccination.map(clean)) {
        const w = v.length * 4.5 + 16;
        if (vx + w > W - margin) { vx = margin; y -= 14; }
        drawRect(page, vx, y - 3, w, 11, C.greenBg, 2);
        drawText(page, v, vx + 4, y, reg, 7, C.green); vx += w + 4;
      }
      y -= 16;
    }
    if (membre.allergies?.length && !membre.allergies.includes('Aucune')) {
      drawText(page, 'ALLERGIES', margin, y, reg, 6.5, C.light); y -= 10;
      let ax = margin;
      for (const a of membre.allergies.map(clean)) {
        const w = a.length * 4.5 + 16;
        drawRect(page, ax, y - 3, w, 11, C.redBg, 2);
        drawText(page, a, ax + 4, y, reg, 7, C.red); ax += w + 4;
      }
      y -= 16;
    }
  }

  // VULNÉRABILITÉ
  if (sections.has('vulnerabilite') && membre.est_vulnerable) {
    y -= 8;
    drawRect(page, margin, y - 6, W - margin * 2, 14, C.redBg, 3);
    drawText(page, `VULNERABILITE - Priorite : ${membre.niveau_priorite}`, margin + 8, y - 1, bold, 8, C.red);
    y -= 18;
    if (membre.vulnerabilite_categories?.length) {
      let vx = margin;
      for (const c of membre.vulnerabilite_categories.map(clean)) {
        const w = c.length * 4.5 + 12;
        drawRect(page, vx, y - 3, w, 11, rgb(1, 0.95, 0.96), 2);
        drawText(page, c, vx + 4, y, reg, 7, C.red); vx += w + 4;
      }
      y -= 16;
    }
    if (membre.vulnerabilite_description) {
      const lines = wrap(membre.vulnerabilite_description, 85);
      lines.forEach(l => { drawText(page, l, margin, y, reg, 7.5, C.mid); y -= 10; });
    }
  }

  // FONCIER
  if (sections.has('foncier')) {
    y -= 4;
    y -= sectionTitle(page, `${sectionNum++}. Foncier et Logement`, y, bold, W, margin);
    const fieldsF = [
      ['Type de logement', foyer.type_logement || '-'],
      ['Statut occupant', foyer.statut_occupant || '-'],
      ['Materiau toiture', foyer.materiau_toiture || '-'],
      ['Materiau mur', foyer.materiau_mur || '-'],
      ['Nombre de pieces', foyer.nombre_pieces?.toString() || '-'],
      ['Superficie', foyer.superficie_maison ? `${foyer.superficie_maison} m2` : '-'],
    ];
    for (let i = 0; i < fieldsF.length; i += 3) {
      if (fieldsF[i]) field(page, fieldsF[i][0], fieldsF[i][1], margin, y, bold, reg, col - 8);
      if (fieldsF[i + 1]) field(page, fieldsF[i + 1][0], fieldsF[i + 1][1], margin + col, y, bold, reg, col - 8);
      if (fieldsF[i + 2]) field(page, fieldsF[i + 2][0], fieldsF[i + 2][1], margin + col * 2, y, bold, reg, col - 8);
      y -= 30;
    }
  }

  // SIGNATURES
  y -= 16;
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.5, color: C.border });
  y -= 20;
  const sigW = (W - margin * 2 - 20) / 3;
  for (let i = 0; i < 3; i++) {
    const sx = margin + i * (sigW + 10);
    page.drawLine({ start: { x: sx, y }, end: { x: sx + sigW, y }, thickness: 0.5, color: C.border });
    const labels = ['Le declarant', 'Chef Fokontany', 'Cachet officiel'];
    drawText(page, labels[i], sx + sigW / 2 - labels[i].length * 2, y - 10, reg, 7, C.light);
  }
  drawText(page, `Fokontany Local Ledger v2.0 - Document officiel - ${new Date().toLocaleDateString('fr-FR')}`, margin, 20, reg, 7, C.light);
  drawText(page, `Page 1/1`, W - margin - 30, 20, reg, 7, C.light);

  return await pdfDoc.save();
}

export default function MembreProfil360({ membre, foyer, allMembres, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingFiche, setLoadingFiche] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selected, setSelected] = useState<Set<SectionKey>>(new Set(SECTIONS.filter(s => s.defaultOn).map(s => s.key)));

  const toggle = (key: SectionKey) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleFicheOfficielle = async () => {
    setLoadingFiche(true);
    try { await imprimerFicheIndividuelle(membre, foyer); }
    catch (e) { alert('Erreur génération fiche : ' + e); }
    setLoadingFiche(false);
  };

  const handleDownload = async () => {
    if (selected.size === 0) { alert('Sélectionnez au moins une section.'); return; }
    setLoading(true);
    try {
      const bytes = await generatePDF(membre, foyer, allMembres, selected);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Profil_${membre.nom}_${membre.prenom}_${foyer.code_menage}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erreur génération PDF : ' + e);
    }
    setLoading(false);
  };

  const age = membre.date_naissance ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970) : null;
  const conjoint = allMembres.find(m => m.id === membre.conjoint_id);
  const pere = allMembres.find(m => m.id === membre.pere_id);
  const mere = allMembres.find(m => m.id === membre.mere_id);
  const enfants = allMembres.filter(m => m.pere_id === membre.id || m.mere_id === membre.id);

  // ── Vue Aperçu ────────────────────────────────────────────
  if (showPreview) {
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-900">Aperçu de la fiche</h2>
              <p className="text-xs text-slate-500">{selected.size} section{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowPreview(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">← Modifier les sections</button>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-xl mx-auto">
              {/* Header fiche */}
              <div className="bg-indigo-600 p-5 flex items-center gap-4">
                {membre.photo_url
                  ? <img src={membre.photo_url} alt="" className="w-16 h-20 rounded-lg object-cover border-2 border-white/30 shrink-0" />
                  : <div className="w-16 h-20 rounded-lg bg-white/20 flex items-center justify-center text-2xl font-bold text-white shrink-0">{membre.prenom?.charAt(0)}{membre.nom?.charAt(0)}</div>
                }
                <div className="flex-1 text-white">
                  <p className="text-lg font-bold">{membre.nom} {membre.prenom}</p>
                  <p className="text-xs text-indigo-100">{membre.sexe === 'M' ? 'Masculin' : 'Féminin'} · {age !== null ? `${age} ans` : ''} · {membre.relation_chef}</p>
                  <p className="text-xs text-indigo-200 mt-0.5">Foyer {foyer.code_menage}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full bg-white ${membre.statut === 'Actif' ? 'text-emerald-700' : 'text-amber-700'}`}>{membre.statut}</span>
              </div>

              <div className="p-5 space-y-4 text-sm">
                {selected.has('identite') && (
                  <div className="border-b border-slate-100 pb-3">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Identité civile</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-400">Naissance:</span> <span className="font-medium text-slate-700">{membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '—'}</span></div>
                      <div><span className="text-slate-400">Lieu:</span> <span className="font-medium text-slate-700">{membre.lieu_naissance || '—'}</span></div>
                      <div><span className="text-slate-400">CIN:</span> <span className="font-medium text-slate-700 font-mono">{membre.cin || '—'}</span></div>
                      <div><span className="text-slate-400">Tél:</span> <span className="font-medium text-slate-700">{membre.telephone || '—'}</span></div>
                    </div>
                  </div>
                )}
                {selected.has('foyer') && (
                  <div className="border-b border-slate-100 pb-3">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Foyer & Adresse</p>
                    <p className="text-xs text-slate-700">{[foyer.adresse, foyer.fokontany, foyer.commune].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                )}
                {selected.has('famille') && (conjoint || pere || mere || enfants.length > 0) && (
                  <div className="border-b border-slate-100 pb-3">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Liens familiaux</p>
                    <div className="flex flex-wrap gap-1.5">
                      {conjoint && <span className="bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full text-[11px] font-medium">💑 {conjoint.prenom} {conjoint.nom}</span>}
                      {pere && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[11px] font-medium">👨 {pere.prenom} {pere.nom}</span>}
                      {mere && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[11px] font-medium">👩 {mere.prenom} {mere.nom}</span>}
                      {enfants.map(e => <span key={e.id} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[11px] font-medium">{e.sexe === 'M' ? '👦' : '👧'} {e.prenom}</span>)}
                    </div>
                  </div>
                )}
                {selected.has('education') && (
                  <div className="border-b border-slate-100 pb-3">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Éducation & Économie</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-400">Niveau:</span> <span className="font-medium text-slate-700">{membre.niveau_etude || '—'}</span></div>
                      <div><span className="text-slate-400">Activité:</span> <span className="font-medium text-slate-700">{membre.profession || '—'}</span></div>
                      <div><span className="text-slate-400">Statut pro:</span> <span className="font-medium text-slate-700">{membre.statut_professionnel || '—'}</span></div>
                      <div><span className="text-slate-400">Revenu:</span> <span className="font-medium text-slate-700">{membre.revenu_fourchette || '—'}</span></div>
                    </div>
                  </div>
                )}
                {selected.has('sante') && (
                  <div className="border-b border-slate-100 pb-3">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Santé</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-medium">🩸 {membre.groupe_sanguin || 'Inconnu'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${membre.hypertension === 'Prioritaire' ? 'bg-red-100 text-red-700' : membre.hypertension === 'Surveillance' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>HTA: {membre.hypertension}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${membre.diabete === 'Prioritaire' ? 'bg-red-100 text-red-700' : membre.diabete === 'Surveillance' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>Diabète: {membre.diabete}</span>
                    </div>
                  </div>
                )}
                {selected.has('vulnerabilite') && membre.est_vulnerable && (
                  <div className="border-b border-slate-100 pb-3">
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-2">⚠ Vulnérabilité</p>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold text-white ${membre.niveau_priorite === 'Critique' ? 'bg-red-600' : 'bg-amber-500'}`}>{membre.niveau_priorite}</span>
                  </div>
                )}
                {selected.has('foncier') && (
                  <div>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Foncier & Logement</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-400">Type:</span> <span className="font-medium text-slate-700">{foyer.type_logement || '—'}</span></div>
                      <div><span className="text-slate-400">Statut:</span> <span className="font-medium text-slate-700">{foyer.statut_occupant || '—'}</span></div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 pt-2 text-center text-[10px] text-slate-300">
                  <div className="border-t border-slate-200 pt-1">Le déclarant</div>
                  <div className="border-t border-slate-200 pt-1">Chef Fokontany</div>
                  <div className="border-t border-slate-200 pt-1">Cachet officiel</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 shrink-0">
            <button onClick={handleDownload} disabled={loading} className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition">
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" />Génération en cours…</> : <><Download className="h-5 w-5" />Télécharger le PDF</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Vue Sélection de sections ────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-xl"><FileText className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Profil 360°</h2>
              <p className="text-xs text-slate-500">{membre.nom} {membre.prenom} · {foyer.code_menage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleFicheOfficielle} disabled={loadingFiche} title="Fiche individuelle officielle PDF" className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white text-xs font-bold rounded-lg transition">
              {loadingFiche ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              {loadingFiche ? 'Génération…' : 'Fiche officielle'}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Aperçu avec photo */}
          <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            {membre.photo_url
              ? <img src={membre.photo_url} alt="" className="w-16 h-20 rounded-lg object-cover border-2 border-indigo-200 shrink-0" />
              : <div className="w-16 h-20 rounded-lg bg-indigo-200 flex items-center justify-center text-2xl font-bold text-indigo-700 shrink-0">{membre.prenom?.charAt(0)}{membre.nom?.charAt(0)}</div>
            }
            <div>
              <p className="font-bold text-slate-900 text-lg">{membre.nom} {membre.prenom}</p>
              <p className="text-xs text-slate-500">{membre.relation_chef} · {age !== null ? `${age} ans` : ''} · {membre.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${membre.statut === 'Actif' ? 'bg-emerald-100 text-emerald-700' : membre.statut === 'Décédé' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{membre.statut}</span>
                {membre.est_vulnerable && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">⚠ Vulnérable</span>}
                {!membre.photo_url && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Pas de photo</span>}
              </div>
            </div>
          </div>

          {/* Filtre de sections */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sections à inclure dans le PDF</p>
            <div className="space-y-1.5">
              {SECTIONS.map(({ key, label, icon: Icon }) => {
                const isOn = selected.has(key);
                return (
                  <label key={key} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${isOn ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <span className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 ${isOn ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className={`text-sm font-medium ${isOn ? 'text-indigo-900' : 'text-slate-600'}`}>{label}</span>
                    </span>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${isOn ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {isOn && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={isOn} onChange={() => toggle(key)} />
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setSelected(new Set(SECTIONS.map(s => s.key)))} className="text-[11px] text-indigo-600 font-semibold hover:underline">Tout sélectionner</button>
              <span className="text-slate-300">·</span>
              <button type="button" onClick={() => setSelected(new Set())} className="text-[11px] text-slate-500 font-semibold hover:underline">Tout désélectionner</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 shrink-0">
          <button onClick={() => { if (selected.size === 0) { alert('Sélectionnez au moins une section.'); return; } setShowPreview(true); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition">
            <FileText className="h-5 w-5" />Aperçu de la fiche ({selected.size} section{selected.size > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}
