import React, { useState } from 'react';
import { Membre, Foyer } from '../types';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { X, Download, Loader2, FileText } from 'lucide-react';

interface Props {
  membre: Membre;
  foyer: Foyer;
  allMembres: Membre[];
  onClose: () => void;
}

// ── Helpers PDF ─────────────────────────────────────────────────
const C = {
  indigo:  rgb(0.31, 0.27, 0.90),
  dark:    rgb(0.07, 0.09, 0.17),
  mid:     rgb(0.29, 0.33, 0.43),
  light:   rgb(0.57, 0.63, 0.72),
  bg:      rgb(0.97, 0.98, 1.00),
  green:   rgb(0.09, 0.53, 0.22),
  greenBg: rgb(0.86, 0.99, 0.91),
  red:     rgb(0.73, 0.11, 0.11),
  redBg:   rgb(1.00, 0.93, 0.93),
  amber:   rgb(0.63, 0.31, 0.00),
  amberBg: rgb(1.00, 0.97, 0.86),
  white:   rgb(1, 1, 1),
  border:  rgb(0.88, 0.91, 0.95),
};

function wrap(text: string, maxChars: number): string[] {
  if (!text) return ['—'];
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : ['—'];
}

function drawRect(page: PDFPage, x: number, y: number, w: number, h: number, fill: ReturnType<typeof rgb>, radius = 0) {
  page.drawRectangle({ x, y, width: w, height: h, color: fill, borderRadius: radius });
}

function drawText(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  page.drawText(text || '—', { x, y, size, font, color });
}

function badge(page: PDFPage, text: string, x: number, y: number, bg: ReturnType<typeof rgb>, fg: ReturnType<typeof rgb>, font: PDFFont) {
  const w = text.length * 4.5 + 10;
  drawRect(page, x, y - 2, w, 13, bg, 3);
  drawText(page, text, x + 5, y, font, 7, fg);
  return w + 6;
}

function field(page: PDFPage, label: string, value: string, x: number, y: number, bold: PDFFont, reg: PDFFont, maxW = 160) {
  drawText(page, label.toUpperCase(), x, y, reg, 6.5, C.light);
  const lines = wrap(value || '—', Math.floor(maxW / 5.5));
  lines.forEach((l, i) => drawText(page, l, x, y - 12 - i * 10, bold, 8.5, C.dark));
  return 12 + lines.length * 10;
}

function sectionTitle(page: PDFPage, title: string, y: number, bold: PDFFont, W: number, margin: number) {
  drawRect(page, margin, y - 1, W - margin * 2, 16, C.bg, 3);
  page.drawLine({ start: { x: margin, y: y - 1 }, end: { x: margin + 3, y: y - 1 }, thickness: 16, color: C.indigo });
  drawText(page, title.toUpperCase(), margin + 10, y + 3, bold, 7.5, C.indigo);
  return 24;
}

// ── Générateur PDF ───────────────────────────────────────────────
async function generatePDF(membre: Membre, foyer: Foyer, allMembres: Membre[]) {
  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const W = 595, H = 842, margin = 36;
  const page = pdfDoc.addPage([W, H]);
  let y = H - margin;

  const conjoint = allMembres.find(m => m.id === membre.conjoint_id);
  const pere     = allMembres.find(m => m.id === membre.pere_id);
  const mere     = allMembres.find(m => m.id === membre.mere_id);
  const enfants  = allMembres.filter(m => m.pere_id === membre.id || m.mere_id === membre.id);
  const age      = membre.date_naissance
    ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970)
    : null;

  // ── HEADER ──────────────────────────────────────────────────
  drawRect(page, 0, y - 70, W, 80, C.indigo, 0);
  // Avatar
  drawRect(page, margin, y - 62, 52, 62, rgb(0.5, 0.5, 0.8), 6);
  drawText(page, `${membre.prenom?.charAt(0) || ''}${membre.nom?.charAt(0) || ''}`, margin + 14, y - 35, bold, 22, C.white);
  // Nom
  drawText(page, `${membre.nom} ${membre.prenom}`, margin + 62, y - 18, bold, 18, C.white);
  drawText(page, `${membre.sexe === 'M' ? 'Masculin' : 'Féminin'} · ${age !== null ? age + ' ans' : 'Âge inconnu'} · ${membre.relation_chef}`, margin + 62, y - 32, reg, 9, rgb(0.8, 0.8, 1.0));
  drawText(page, `Foyer ${foyer.code_menage} · ${foyer.fokontany || ''}`, margin + 62, y - 44, reg, 8.5, rgb(0.7, 0.7, 0.95));
  // Statut badge
  const statColor = membre.statut === 'Actif' ? C.green : C.amber;
  drawRect(page, margin + 62, y - 58, 52, 11, rgb(1,1,1,), 3);
  drawText(page, membre.statut.toUpperCase(), margin + 65, y - 56, bold, 7, statColor);
  // Logo
  drawText(page, 'FOKONTANY LOCAL LEDGER', W - margin - 130, y - 20, bold, 7, rgb(0.8, 0.8, 1));
  drawText(page, 'REPUBLIQUE DE MADAGASCAR', W - margin - 130, y - 30, reg, 6.5, rgb(0.7, 0.7, 0.9));
  drawText(page, `Imprimé le ${new Date().toLocaleDateString('fr-FR')}`, W - margin - 130, y - 40, reg, 6.5, rgb(0.7, 0.7, 0.9));
  y -= 82;

  // ── IDENTITÉ ────────────────────────────────────────────────
  y -= 8;
  y -= sectionTitle(page, '1. Identité civile', y, bold, W, margin);

  // Grid 3 colonnes
  const col = (W - margin * 2) / 3;
  const fields1 = [
    ['Date de naissance', membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '—'],
    ['Lieu de naissance', membre.lieu_naissance || '—'],
    ['Numéro CIN', membre.cin || '—'],
    ['Date CIN', membre.date_cin ? new Date(membre.date_cin).toLocaleDateString('fr-FR') : '—'],
    ['Téléphone', membre.telephone || '—'],
    ['Email', membre.email || '—'],
  ];
  for (let i = 0; i < fields1.length; i += 3) {
    const rowH = Math.max(
      ...fields1.slice(i, i + 3).map(([l, v]) => field(page, l, v, margin + (i % 3 === 0 ? 0 : col), y, bold, reg, col - 8))
    );
    // Afficher les 3 colonnes
    if (fields1[i])     field(page, fields1[i][0], fields1[i][1], margin,         y, bold, reg, col - 8);
    if (fields1[i + 1]) field(page, fields1[i+1][0], fields1[i+1][1], margin + col,     y, bold, reg, col - 8);
    if (fields1[i + 2]) field(page, fields1[i+2][0], fields1[i+2][1], margin + col * 2, y, bold, reg, col - 8);
    y -= 32;
  }

  // ── FOYER ───────────────────────────────────────────────────
  y -= 4;
  y -= sectionTitle(page, '2. Foyer & Adresse', y, bold, W, margin);
  drawRect(page, margin, y - 28, W - margin * 2, 32, C.bg, 4);
  field(page, 'Code ménage',  foyer.code_menage, margin + 8, y - 6, bold, reg, 100);
  field(page, 'Adresse',      foyer.adresse || '—', margin + 115, y - 6, bold, reg, 160);
  field(page, 'Fokontany',    foyer.fokontany || '—', margin + 295, y - 6, bold, reg, 100);
  field(page, 'Commune',      foyer.commune || '—', margin + 405, y - 6, bold, reg, 100);
  y -= 44;

  // ── FAMILLE ─────────────────────────────────────────────────
  const familles = [
    conjoint && { emoji: 'Conjoint(e)', nom: `${conjoint.nom} ${conjoint.prenom}` },
    (pere || membre.pere_nom) && { emoji: 'Père', nom: pere ? `${pere.nom} ${pere.prenom}` : `${membre.pere_nom} (hors registre)` },
    (mere || membre.mere_nom) && { emoji: 'Mère', nom: mere ? `${mere.nom} ${mere.prenom}` : `${membre.mere_nom} (hors registre)` },
    ...enfants.map(e => ({ emoji: e.sexe === 'M' ? 'Fils' : 'Fille', nom: `${e.nom} ${e.prenom}` })),
  ].filter(Boolean) as { emoji: string; nom: string }[];

  if (familles.length > 0) {
    y -= 4;
    y -= sectionTitle(page, '3. Liens familiaux', y, bold, W, margin);
    let lx = margin;
    for (const f of familles) {
      const w = Math.max(f.emoji.length, f.nom.length) * 5 + 20;
      if (lx + w > W - margin) { lx = margin; y -= 20; }
      drawRect(page, lx, y - 14, w, 16, C.bg, 3);
      drawText(page, f.emoji.toUpperCase(), lx + 5, y - 4, bold, 6, C.light);
      drawText(page, f.nom, lx + 5, y - 11, bold, 7.5, C.dark);
      lx += w + 6;
    }
    y -= 28;
  }

  // ── ÉDUCATION & ÉCONOMIE ────────────────────────────────────
  y -= 4;
  y -= sectionTitle(page, '4. Éducation & Situation économique', y, bold, W, margin);
  const fields2 = [
    ["Niveau d'instruction", membre.niveau_etude || '—'],
    ['Diplôme', membre.diplome || '—'],
    ['Profession', membre.profession || '—'],
    ['Secteur', membre.secteur || '—'],
    ['Employeur', membre.employeur || '—'],
    ['Revenu estimé', membre.revenu_estime ? `${membre.revenu_estime.toLocaleString('fr-FR')} Ar` : '—'],
  ];
  for (let i = 0; i < fields2.length; i += 3) {
    if (fields2[i])     field(page, fields2[i][0],   fields2[i][1],   margin,           y, bold, reg, col - 8);
    if (fields2[i + 1]) field(page, fields2[i+1][0], fields2[i+1][1], margin + col,     y, bold, reg, col - 8);
    if (fields2[i + 2]) field(page, fields2[i+2][0], fields2[i+2][1], margin + col * 2, y, bold, reg, col - 8);
    y -= 30;
  }
  if (membre.langues?.length) {
    drawText(page, 'LANGUES', margin, y, reg, 6.5, C.light);
    y -= 10;
    let lx2 = margin;
    for (const l of membre.langues) {
      const w = l.length * 5 + 12; drawRect(page, lx2, y - 3, w, 11, C.bg, 2);
      drawText(page, l, lx2 + 4, y, reg, 7, C.mid); lx2 += w + 4;
    }
    y -= 16;
  }

  // ── SANTÉ ───────────────────────────────────────────────────
  y -= 4;
  y -= sectionTitle(page, '5. Santé', y, bold, W, margin);
  const hta  = membre.hypertension;
  const diab = membre.diabete;
  const htaC  = hta  === 'Prioritaire' ? C.red   : hta  === 'Surveillance' ? C.amber : C.green;
  const diabC = diab === 'Prioritaire' ? C.red   : diab === 'Surveillance' ? C.amber : C.green;
  const htaBg  = hta  === 'Prioritaire' ? C.redBg   : hta  === 'Surveillance' ? C.amberBg : C.greenBg;
  const diabBg = diab === 'Prioritaire' ? C.redBg   : diab === 'Surveillance' ? C.amberBg : C.greenBg;

  field(page, 'Groupe sanguin', membre.groupe_sanguin || 'Inconnu', margin, y, bold, reg, 90);
  // HTA badge
  drawRect(page, margin + 100, y - 3, 80, 13, htaBg, 3);
  drawText(page, `HTA: ${hta}`, margin + 104, y, bold, 7.5, htaC);
  // Diabète badge
  drawRect(page, margin + 190, y - 3, 80, 13, diabBg, 3);
  drawText(page, `Diabete: ${diab}`, margin + 194, y, bold, 7.5, diabC);
  if (membre.handicap) field(page, 'Handicap', membre.handicap, margin + 285, y, bold, reg, 100);
  y -= 24;

  if (membre.vaccination?.length) {
    drawText(page, 'VACCINATIONS', margin, y, reg, 6.5, C.light); y -= 10;
    let vx = margin;
    for (const v of membre.vaccination) {
      const w = v.length * 4.5 + 16;
      if (vx + w > W - margin) { vx = margin; y -= 14; }
      drawRect(page, vx, y - 3, w, 11, C.greenBg, 2);
      drawText(page, `✓ ${v}`, vx + 4, y, reg, 7, C.green); vx += w + 4;
    }
    y -= 16;
  }

  // ── VULNÉRABILITÉ ───────────────────────────────────────────
  if (membre.est_vulnerable) {
    y -= 8;
    drawRect(page, margin, y - 6, W - margin * 2, 14, C.redBg, 3);
    drawText(page, `⚠ VULNÉRABILITÉ · Priorité : ${membre.niveau_priorite}`, margin + 8, y - 1, bold, 8, C.red);
    y -= 18;
    if (membre.vulnerabilite_categories?.length) {
      let vx = margin;
      for (const c of membre.vulnerabilite_categories) {
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

  // ── SIGNATURES ──────────────────────────────────────────────
  y -= 16;
  page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.5, color: C.border });
  y -= 20;
  const sigW = (W - margin * 2 - 20) / 3;
  for (let i = 0; i < 3; i++) {
    const sx = margin + i * (sigW + 10);
    page.drawLine({ start: { x: sx, y }, end: { x: sx + sigW, y }, thickness: 0.5, color: C.border });
    const labels = ['Le déclarant', 'Chef Fokontany', 'Cachet officiel'];
    drawText(page, labels[i], sx + sigW / 2 - labels[i].length * 2, y - 10, reg, 7, C.light);
  }

  // ── PIED DE PAGE ────────────────────────────────────────────
  drawText(page, `Fokontany Local Ledger v2.0 · Document officiel · ${new Date().toLocaleDateString('fr-FR')}`,
    margin, 20, reg, 7, C.light);
  drawText(page, `Page 1/1`, W - margin - 30, 20, reg, 7, C.light);

  return await pdfDoc.save();
}

// ── Composant ───────────────────────────────────────────────────
export default function MembreProfil360({ membre, foyer, allMembres, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const bytes = await generatePDF(membre, foyer, allMembres);
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

  const age = membre.date_naissance
    ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-xl"><FileText className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Profil 360°</h2>
              <p className="text-xs text-slate-500">{membre.nom} {membre.prenom} · {foyer.code_menage}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        {/* Aperçu contenu */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            {membre.photo_url
              ? <img src={membre.photo_url} alt="" className="w-14 h-16 rounded-lg object-cover border-2 border-indigo-200 shrink-0" />
              : <div className="w-14 h-16 rounded-lg bg-indigo-200 flex items-center justify-center text-xl font-bold text-indigo-700 shrink-0">{membre.prenom?.charAt(0)}{membre.nom?.charAt(0)}</div>
            }
            <div>
              <p className="font-bold text-slate-900">{membre.nom} {membre.prenom}</p>
              <p className="text-xs text-slate-500">{membre.relation_chef} · {age !== null ? `${age} ans` : ''}</p>
              <div className="flex gap-1.5 mt-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${membre.statut === 'Actif' ? 'bg-emerald-100 text-emerald-700' : membre.statut === 'Décédé' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{membre.statut}</span>
                {membre.est_vulnerable && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">⚠ Vulnérable</span>}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
            Le PDF contiendra : identité civile, adresse du foyer, liens familiaux, éducation & économie, santé, vulnérabilité et zones de signature.
          </p>

          <button onClick={handleDownload} disabled={loading} className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition">
            {loading ? <><Loader2 className="h-5 w-5 animate-spin" />Génération en cours…</> : <><Download className="h-5 w-5" />Télécharger le PDF</>}
          </button>
        </div>
      </div>
    </div>
  );
}
