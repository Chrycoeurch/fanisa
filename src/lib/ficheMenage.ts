/**
 * FICHE MENAGE — Générateur PDF fidèle au template officiel FANISA
 * Layout A4 calculé section par section, pas de cursor flottant
 */
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { Foyer, Membre } from '../types';
import { supabase } from './supabase';
import { telechargerPDF } from './documents';

// ── Palette ───────────────────────────────────────────────────────
const C = {
  bleu:   rgb(0.118, 0.227, 0.541),
  bleuL:  rgb(0.937, 0.965, 1.000),
  vert:   rgb(0.063, 0.722, 0.506),
  vertL:  rgb(0.925, 0.992, 0.961),
  orange: rgb(0.961, 0.620, 0.043),
  rouge:  rgb(0.937, 0.267, 0.267),
  violet: rgb(0.545, 0.361, 0.965),
  cyan:   rgb(0.055, 0.647, 0.914),
  grisF:  rgb(0.118, 0.161, 0.227),
  grisM:  rgb(0.450, 0.510, 0.580),
  grisL:  rgb(0.945, 0.957, 0.976),
  grisB:  rgb(0.820, 0.840, 0.870),
  blanc:  rgb(1, 1, 1),
};

// A4 = 595 x 842 pt — marges 15pt
const W = 595, H = 842, ML = 15, MR = 15, MT = 12;
const CW = W - ML - MR; // 565

// ── Primitives ────────────────────────────────────────────────────
// y = depuis le HAUT de la page (on convertit en bas en interne)
const top = (y: number) => H - y;

function fillRect(p: PDFPage, x: number, y: number, w: number, h: number, fill: any, strokeColor?: any, sw = 0.4) {
  p.drawRectangle({ x, y: top(y + h), width: w, height: h, color: fill, borderColor: strokeColor, borderWidth: strokeColor ? sw : 0 });
}

function line(p: PDFPage, x1: number, y1: number, x2: number, y2: number, color = C.grisB, thickness = 0.5) {
  p.drawLine({ start: { x: x1, y: top(y1) }, end: { x: x2, y: top(y2) }, thickness, color });
}

function safe(s: any): string {
  return String(s || '—').replace(/[^\x00-\xFF]/g, '?').replace(/[\x80-\x9F]/g, '?');
}

function drawText(p: PDFPage, s: any, x: number, y: number, font: PDFFont, size: number, color = C.grisF, align: 'left'|'center'|'right' = 'left', maxW?: number) {
  let label = safe(s);
  if (maxW && font.widthOfTextAtSize(label, size) > maxW) {
    while (label.length > 2 && font.widthOfTextAtSize(label + '..', size) > maxW) label = label.slice(0, -1);
    label += '..';
  }
  const tw = font.widthOfTextAtSize(label, size);
  let dx = x;
  if (align === 'center') dx = x - tw / 2;
  if (align === 'right')  dx = x - tw;
  p.drawText(label, { x: dx, y: top(y), size, font, color });
}

// Texte multi-lignes, retourne la hauteur utilisée
function multiLine(p: PDFPage, s: any, x: number, y: number, font: PDFFont, size: number, color: any, maxW: number, leading: number): number {
  const words = safe(s).split(' ');
  let line2 = '', cy = y;
  for (const w of words) {
    const test = line2 ? line2 + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) > maxW && line2) {
      drawText(p, line2, x, cy, font, size, color);
      line2 = w; cy += leading;
    } else line2 = test;
  }
  if (line2) { drawText(p, line2, x, cy, font, size, color); cy += leading; }
  return cy - y;
}

// Section header — barre bleue avec titre blanc
function sectionBar(p: PDFPage, y: number, label: string, B: PDFFont, h = 15): number {
  fillRect(p, ML, y, CW, h, C.bleu);
  drawText(p, label, ML + 5, y + 4, B, 8.5, C.blanc);
  return y + h + 2; // retourne le y suivant
}

// Mini badge coloré
function pill(p: PDFPage, label: string, x: number, y: number, bg: any, font: PDFFont, h = 12): number {
  const pad = 5, size = 7;
  const tw = font.widthOfTextAtSize(label, size);
  const bw = tw + pad * 2;
  fillRect(p, x, y, bw, h, bg);
  drawText(p, label, x + pad, y + 3, font, size, C.blanc);
  return bw + 3;
}

// Indicateur card
function indCard(p: PDFPage, x: number, y: number, w: number, h: number, val: string, label: string, B: PDFFont, R: PDFFont, valColor: any) {
  fillRect(p, x + 1, y, w - 2, h, C.grisL, C.grisB, 0.3);
  drawText(p, val, x + w / 2, y + 7, B, 13, valColor, 'center');
  drawText(p, label, x + w / 2, y + 23, R, 6, C.grisM, 'center');
}

// Card situation (santé/habitat/education/economie)
function sitCard(p: PDFPage, x: number, y: number, w: number, h: number, title: string, items: [string,string][], titleColor: any, B: PDFFont, R: PDFFont) {
  fillRect(p, x, y, w, h, C.blanc, C.grisB, 0.4);
  line(p, x, y + 13, x + w, y + 13, titleColor, 1.5);
  drawText(p, title, x + 5, y + 4, B, 8, titleColor);
  items.forEach(([k, v], i) => {
    drawText(p, k + ': ' + v, x + 5, y + 16 + i * 11, R, 7.5, C.grisF, 'left', w - 8);
  });
}

// ── Données ───────────────────────────────────────────────────────
async function loadHistorique(foyerId: string): Promise<{date: string; label: string}[]> {
  const hist: {date: string; label: string; ts: string}[] = [];

  const { data: docs } = await supabase.from('demandes_documents')
    .select('created_at, nom_document').eq('foyer_id', foyerId)
    .in('statut', ['Payé', 'Archivé']).order('created_at', { ascending: false }).limit(5);
  (docs || []).forEach((d: any) => hist.push({ ts: d.created_at, date: new Date(d.created_at).toLocaleDateString('fr-FR'), label: `${d.nom_document} - delivre` }));

  const { data: cots } = await supabase.from('cotisations')
    .select('date_paiement, periode').eq('foyer_id', foyerId)
    .not('date_paiement', 'is', null).order('date_paiement', { ascending: false }).limit(4);
  (cots || []).forEach((c: any) => {
    if (c.date_paiement) hist.push({ ts: c.date_paiement, date: new Date(c.date_paiement).toLocaleDateString('fr-FR'), label: `Cotisation ${c.periode} - payee` });
  });

  hist.sort((a, b) => b.ts.localeCompare(a.ts));
  return hist.slice(0, 7).map(h => ({ date: h.date, label: h.label }));
}

function scoreOf(foyer: Foyer, membres: Membre[]): number {
  let s = 0, t = 0;
  const add = (c: boolean, p: number) => { t += p; if (c) s += p; };
  add(!!foyer.adresse, 5); add(!!foyer.type_logement, 5); add(!!foyer.eau_source, 10);
  add(foyer.a_electricite === true, 5); add(!!foyer.statut_occupant, 5);
  add((foyer.materiaux_mur || []).length > 0 || !!foyer.materiau_mur, 5);
  add(membres.some(m => m.is_chef), 10); add(membres.length > 0, 10);
  add(membres.some(m => !!m.cin), 15); add(membres.some(m => !!m.profession), 10);
  add(membres.some(m => (m.vaccination || []).length > 0), 10); add(membres.length >= 2, 10);
  return t > 0 ? Math.round((s / t) * 100) : 0;
}

function ageOf(m: Membre): number {
  return m.date_naissance ? new Date().getFullYear() - new Date(m.date_naissance).getFullYear() : 0;
}

function resume(foyer: Foyer, membres: Membre[], cotAJour: boolean): string {
  const nb = membres.length, chef = membres.find(m => m.is_chef);
  const nbE = membres.filter(m => ageOf(m) < 18).length;
  const nbV = membres.filter(m => m.est_vulnerable).length;
  let s = `Ce menage est compose de ${nb} personne${nb > 1 ? 's' : ''}`;
  if (nbE) s += ` dont ${nbE} enfant${nbE > 1 ? 's' : ''}`;
  s += '.';
  if (chef?.profession) s += ` Le chef de menage est ${safe(chef.profession).toLowerCase()}.`;
  if (foyer.type_logement) {
    s += ` Le logement est de type ${safe(foyer.type_logement).toLowerCase()}`;
    const p: string[] = [];
    if (foyer.nombre_pieces) p.push(`${foyer.nombre_pieces} pieces`);
    if (foyer.superficie_maison) p.push(`${foyer.superficie_maison}m2`);
    if (p.length) s += ` (${p.join(', ')})`;
    s += '.';
  }
  if (cotAJour) s += ' Les cotisations sont a jour.';
  if (nbV) s += ` ${nbV} personne${nbV > 1 ? 's' : ''} vulnerable${nbV > 1 ? 's' : ''} recensee${nbV > 1 ? 's' : ''}.`;
  return s;
}

// ── GÉNÉRATEUR PRINCIPAL ──────────────────────────────────────────
export async function genererFicheMenage(foyer: Foyer, membres: Membre[]): Promise<Uint8Array> {
  // Chargement Supabase
  const [{ data: docs }, { data: cots }, hist] = await Promise.all([
    supabase.from('demandes_documents').select('nom_document, created_at').eq('foyer_id', foyer.id).in('statut', ['Payé','Archivé']).order('created_at', { ascending: false }),
    supabase.from('cotisations').select('statut, periode').eq('foyer_id', foyer.id),
    loadHistorique(foyer.id),
  ]);

  const cotAJour = (cots || []).some((c: any) => c.statut === 'A jour' || c.statut === '\u00c0 jour');
  const dernierDoc = (docs || [])[0];
  const nbDocs = (docs || []).length;

  // Tri membres : chef en premier
  const mems = [...membres].sort((a, b) => (a.is_chef ? -1 : b.is_chef ? 1 : 0));
  const chef = mems.find(m => m.is_chef);

  // Calculs
  const today = new Date();
  const nbEnf  = mems.filter(m => ageOf(m) < 18).length;
  const nbAges = mems.filter(m => ageOf(m) >= 60).length;
  const nbVuln = mems.filter(m => m.est_vulnerable).length;
  const nbSco  = mems.filter(m => { const p = (m.profession || '').toLowerCase(); return p.includes('eleve') || p.includes('etudiant'); }).length;
  const nbTrav = mems.filter(m => { const p = (m.profession || '').toLowerCase(); return p && !p.includes('eleve') && !p.includes('etudiant'); }).length;
  const nbAlpha = mems.filter(m => m.niveau_etude && m.niveau_etude !== 'Aucun' && m.niveau_etude !== 'Aucun').length;
  const niveaux = mems.map(m => m.niveau_etude).filter(Boolean);
  const niveauMoy = niveaux[Math.floor(niveaux.length / 2)] || '—';

  const murs = Array.isArray(foyer.materiaux_mur) && foyer.materiaux_mur.length > 0 ? foyer.materiaux_mur.join(', ') : foyer.materiau_mur || '—';
  const eau  = foyer.eau_source || '—';
  const elec = foyer.a_electricite === true ? 'Oui' : foyer.a_electricite === false ? 'Non' : '—';
  const chefVacc = (chef?.vaccination || []);
  const vaccStr  = chefVacc.length > 0 ? (chefVacc.length > 2 ? 'Complete' : chefVacc.join(', ')) : '—';
  const nbHandi  = mems.filter(m => m.handicap_oui || !!m.handicap).length;
  const nbSuivi  = mems.filter(m => m.suivi_medical).length;
  const revenu   = chef?.revenu_estime ? `${Number(chef.revenu_estime).toLocaleString('fr-FR')} Ar` : chef?.revenu_fourchette || '—';
  const hasAgri  = mems.some(m => (m.agr_types || []).some(a => a.toLowerCase().includes('agri')));
  const hasElev  = mems.some(m => (m.agr_types || []).some(a => a.toLowerCase().includes('elev')));

  const score      = scoreOf(foyer, mems);
  const scoreColor = score >= 70 ? C.vert : score >= 50 ? C.orange : C.rouge;
  const now        = today.toLocaleDateString('fr-FR') + ' - ' + today.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // ── PDF ──────────────────────────────────────────────────────────
  const pdf  = await PDFDocument.create();
  const B    = await pdf.embedFont(StandardFonts.HelveticaBold);
  const R    = await pdf.embedFont(StandardFonts.Helvetica);

  // Calculer la hauteur nécessaire
  const rowH    = 12; // hauteur ligne composition
  const nbRows  = mems.length;
  const compH   = 14 + nbRows * rowH; // header + lignes
  const maxSitItems = 4;
  const sitH    = 13 + maxSitItems * 11 + 4;
  const resumeTxt = resume(foyer, mems, cotAJour);
  // Estimation wrap resume (80 chars par ligne)
  const resumeLines = Math.max(2, Math.ceil(resumeTxt.length / 80));
  const resumeH = resumeLines * 11 + 12;
  const histH   = Math.max(14, hist.length * 12 + 4);
  const obsH    = Math.max(36, Math.ceil((foyer.observations_complementaires || '').length / 90) * 11 + 12);

  // Hauteurs fixes
  const Y_HEADER  = MT;            // 12
  const H_HEADER  = 30;            // 30 → y=42
  const Y_HLINE   = Y_HEADER + H_HEADER; // 42
  const Y_CHEF    = Y_HLINE + 4;   // 46
  const H_CHEF    = 60;            // 46+60=106
  const Y_IND     = Y_CHEF + H_CHEF + 2; // 108
  const H_IND1    = 36;
  const H_IND2    = 36;
  const H_INDGAP  = 3;
  const Y_RESUME  = Y_IND + H_IND1 + H_INDGAP + H_IND2 + 4; // 187
  const Y_COMP    = Y_RESUME + 17 + resumeH + 2;
  const Y_SIT     = Y_COMP + 17 + compH + 2;
  const Y_PAT     = Y_SIT + 17 + sitH + 2;
  const Y_DOCS    = Y_PAT + 17 + 14 + 2;
  const Y_HIST    = Y_DOCS + 17 + 14 + 2;
  const Y_OBS     = Y_HIST + 17 + histH + 2;
  const Y_SIG     = Y_OBS + 17 + obsH + 4;
  const Y_FOOT    = Y_SIG + 52;

  const totalH = Math.max(H, Y_FOOT + 14);
  const needsPage2 = totalH > H;

  const page = needsPage2 ? pdf.addPage([W, totalH]) : pdf.addPage([W, H]);

  // ═══════════════════════════════════════════════════════════════
  // EN-TÊTE
  // ═══════════════════════════════════════════════════════════════
  // FANISA à gauche
  drawText(page, 'FANISA', ML, Y_HEADER + 2, B, 18, C.bleu);
  drawText(page, 'Gestion du Fokontany', ML, Y_HEADER + 16, R, 7.5, C.grisM);

  // Titre centré
  drawText(page, 'FICHE MENAGE', W / 2, Y_HEADER + 2, B, 17, C.grisF, 'center');
  drawText(page, 'Document officiel - Usage administratif', W / 2, Y_HEADER + 18, R, 7.5, C.grisM, 'center');

  // QR + code ménage à droite
  fillRect(page, W - MR - 24, Y_HEADER, 22, 22, C.grisL, C.grisB, 0.5);
  drawText(page, 'QR', W - MR - 13, Y_HEADER + 8, B, 8, C.grisM, 'center');
  drawText(page, foyer.code_menage, W - MR, Y_HEADER + 2, B, 13, C.bleu, 'right');
  drawText(page, now, W - MR, Y_HEADER + 17, R, 7.5, C.grisM, 'right');

  // Ligne bleue épaisse
  line(page, ML, Y_HLINE, W - MR, Y_HLINE, C.bleu, 2);

  // ═══════════════════════════════════════════════════════════════
  // BLOC CHEF
  // ═══════════════════════════════════════════════════════════════
  fillRect(page, ML, Y_CHEF, CW, H_CHEF, C.grisL, C.grisB, 0.5);

  // Zone photo (32x50)
  fillRect(page, ML + 3, Y_CHEF + 4, 32, 50, C.blanc, C.grisB, 0.5);
  drawText(page, 'PHOTO', ML + 3 + 16, Y_CHEF + 30, R, 7, C.grisM, 'center');

  // Infos chef
  const IX = ML + 40;
  const nomChef = chef ? `${safe(chef.nom).toUpperCase()} ${safe(chef.prenom)}`.trim() : '—';
  drawText(page, nomChef, IX, Y_CHEF + 7, B, 13, C.grisF, 'left', CW - 95);
  drawText(page, `Chef de menage  |  ${safe(foyer.adresse)}`, IX, Y_CHEF + 19, R, 7.5, C.grisM, 'left', CW - 95);

  const adr2 = [foyer.fokontany && `Fokontany ${foyer.fokontany}`, foyer.commune && `Commune ${foyer.commune}`, foyer.district && `District ${foyer.district}`].filter(Boolean).join(' | ');
  drawText(page, adr2, IX, Y_CHEF + 29, R, 7, C.grisM, 'left', CW - 95);

  const telStr = [chef?.telephone && `Tel: ${chef.telephone}`, foyer.annee_installation && `Installe depuis: ${foyer.annee_installation}`].filter(Boolean).join('  |  ');
  if (telStr) drawText(page, telStr, IX, Y_CHEF + 39, R, 7, C.grisM, 'left', CW - 95);

  // Badges statut
  let bx = IX;
  bx += pill(page, '* Actif', bx, Y_CHEF + 50, C.vert, B);
  if ((foyer as any).note_agent_incomplete) bx += pill(page, '* A suivre', bx, Y_CHEF + 50, C.orange, B);
  bx += pill(page, cotAJour ? '* Cotisation a jour' : '* Cotisation en retard', bx, Y_CHEF + 50, cotAJour ? C.cyan : C.orange, B);

  // Score (cercle simulé avec carré arrondi)
  const SX = W - MR - 48, SY = Y_CHEF + 4;
  fillRect(page, SX, SY, 44, 50, C.blanc, scoreColor, 2);
  drawText(page, `${score}%`, SX + 22, SY + 16, B, 18, scoreColor, 'center');
  drawText(page, 'Score FANISA', SX + 22, SY + 38, R, 6.5, C.grisM, 'center');

  // ═══════════════════════════════════════════════════════════════
  // INDICATEURS CLÉS
  // ═══════════════════════════════════════════════════════════════
  const Y_IND1 = Y_IND;
  const Y_IND2 = Y_IND1 + H_IND1 + H_INDGAP;
  sectionBar(page, Y_IND, '  INDICATEURS CLES', B, 15);

  const iw = CW / 6;
  const inds1: [string,string,any][] = [
    [String(mems.length),    'Membres',     C.bleu],
    [String(foyer.nombre_pieces || '—'), 'Pieces', C.bleu],
    [foyer.superficie_maison ? `${foyer.superficie_maison}m2` : '—', 'Superficie', C.cyan],
    [String(nbEnf),  'Enfants',    C.orange],
    [String(nbAges), 'Pers. agees',C.violet],
    [String(nbVuln), 'Vulnerables',C.rouge],
  ];
  const inds2: [string,string,any][] = [
    [String(nbSco),  'Scolarises',  C.vert],
    [String(nbTrav), 'Travailleurs',C.vert],
    ['—', 'Activites', C.cyan],
    ['—', 'Terrain',   C.orange],
    ['—', 'Vehicule',  C.violet],
    ['—', 'Elevage',   C.orange],
  ];

  inds1.forEach(([v,l,c],i) => indCard(page, ML + i*iw, Y_IND1 + 17, iw, H_IND1, v, l, B, R, c));
  inds2.forEach(([v,l,c],i) => indCard(page, ML + i*iw, Y_IND2 + 0, iw, H_IND2, v, l, B, R, c));

  // ═══════════════════════════════════════════════════════════════
  // RÉSUMÉ
  // ═══════════════════════════════════════════════════════════════
  const resumeBodyY = sectionBar(page, Y_RESUME, '  RESUME INTELLIGENT FANISA', B);
  fillRect(page, ML, resumeBodyY, CW, resumeH, C.bleuL, C.grisB, 0.4);
  multiLine(page, resumeTxt, ML + 7, resumeBodyY + 8, R, 8, C.grisF, CW - 14, 11);

  // ═══════════════════════════════════════════════════════════════
  // COMPOSITION
  // ═══════════════════════════════════════════════════════════════
  const compBodyY = sectionBar(page, Y_COMP, '  COMPOSITION DU MENAGE', B);
  const cws = [CW*0.32, CW*0.14, CW*0.08, CW*0.28, CW*0.18];
  // Header tableau
  fillRect(page, ML, compBodyY, CW, 13, C.bleu);
  let hx = ML;
  ['Nom','Lien','Age','Profession','Statut'].forEach((h, i) => { drawText(page, h, hx + 3, compBodyY + 4, B, 8, C.blanc); hx += cws[i]; });
  // Lignes
  mems.forEach((m, idx) => {
    const rowY = compBodyY + 13 + idx * rowH;
    fillRect(page, ML, rowY, CW, rowH, idx % 2 === 0 ? C.blanc : C.grisL, C.grisB, 0.2);
    const fn = m.is_chef ? B : R;
    const a = ageOf(m);
    let cx = ML;
    [`${safe(m.nom).toUpperCase()} ${safe(m.prenom)}`.trim(), safe(m.relation_chef || (m.is_chef ? 'Chef' : '—')), a > 0 ? String(a) : '—', safe(m.profession), m.est_vulnerable ? 'Vulnerable' : safe(m.statut)]
      .forEach((v, i) => { drawText(page, v, cx + 3, rowY + 3.5, fn, 7.5, C.grisF, 'left', cws[i] - 4); cx += cws[i]; });
  });

  // ═══════════════════════════════════════════════════════════════
  // SITUATION DU MÉNAGE
  // ═══════════════════════════════════════════════════════════════
  const sitBodyY = sectionBar(page, Y_SIT, '  SITUATION DU MENAGE', B);
  const scw = (CW - 6) / 4;
  [
    { t:'Sante',     c:C.vert,   items:[['Vaccination',vaccStr.length>20?'Complete':vaccStr],['Chronique',nbHandi>0?`${nbHandi} cas`:'Aucune'],['Handicap',String(nbHandi)],['Suivi',nbSuivi>0?'Oui':'—']] as [string,string][] },
    { t:'Habitat',   c:C.bleu,   items:[['Type',safe(foyer.type_logement)],['Murs',murs.length>18?murs.slice(0,16)+'..':murs],['Eau',eau.length>18?eau.slice(0,16)+'..':eau],['Electricite',elec]] as [string,string][] },
    { t:'Education', c:C.orange, items:[['Eleves',String(nbSco)],['Niveau moy.',safe(niveauMoy)],['Abandon','0'],['Alphabetises',`${nbAlpha}/${mems.length}`]] as [string,string][] },
    { t:'Economie',  c:C.violet, items:[['Revenu',safe(revenu).length>20?safe(revenu).slice(0,18)+'..':safe(revenu)],['Agriculture',hasAgri?'Oui':'Non'],['Elevage',hasElev?'Oui':'Non']] as [string,string][] },
  ].forEach((s, i) => {
    sitCard(page, ML + i*(scw+2), sitBodyY, scw, sitH, s.t, s.items, s.c, B, R);
  });

  // ═══════════════════════════════════════════════════════════════
  // PATRIMOINE
  // ═══════════════════════════════════════════════════════════════
  const patBodyY = sectionBar(page, Y_PAT, '  PATRIMOINE', B);
  fillRect(page, ML, patBodyY, CW, 14, C.grisL, C.grisB, 0.4);
  const patStr = ['Terrain: —', 'Maison: —', 'Moto: —', 'TV: —', `Telephone: ${chef?.telephone ? '1' : '—'}`].join('  |  ');
  drawText(page, patStr, ML + 7, patBodyY + 5, R, 7.5, C.grisF);

  // ═══════════════════════════════════════════════════════════════
  // DOCUMENTS ADMINISTRATIFS
  // ═══════════════════════════════════════════════════════════════
  const docsBodyY = sectionBar(page, Y_DOCS, '  DOCUMENTS ADMINISTRATIFS', B);
  fillRect(page, ML, docsBodyY, CW, 14, C.grisL, C.grisB, 0.4);
  const docLabel = dernierDoc ? `${safe(dernierDoc.nom_document)} (${new Date(dernierDoc.created_at).toLocaleDateString('fr-FR')})` : '—';
  drawText(page, `Total: ${nbDocs} document${nbDocs>1?'s':''}  |  Dernier: ${docLabel}  |  Statut: Conforme`, ML + 7, docsBodyY + 5, R, 7.5, C.grisF, 'left', CW - 14);

  // ═══════════════════════════════════════════════════════════════
  // HISTORIQUE
  // ═══════════════════════════════════════════════════════════════
  const histBodyY = sectionBar(page, Y_HIST, '  HISTORIQUE DU MENAGE', B);
  if (hist.length === 0) {
    drawText(page, 'Aucun historique enregistre.', ML + 7, histBodyY + 5, R, 8, C.grisM);
  } else {
    hist.forEach((evt, i) => {
      drawText(page, '-', ML + 4, histBodyY + 4 + i * 12, B, 9, C.bleu);
      drawText(page, evt.date, ML + 14, histBodyY + 4 + i * 12, B, 8, C.grisF);
      drawText(page, evt.label, ML + 58, histBodyY + 4 + i * 12, R, 8, C.grisF, 'left', CW - 64);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // OBSERVATIONS
  // ═══════════════════════════════════════════════════════════════
  const obsBodyY = sectionBar(page, Y_OBS, '  OBSERVATIONS', B);
  const obs = foyer.observations_complementaires || 'Aucune observation.';
  fillRect(page, ML, obsBodyY, CW, obsH, C.blanc, C.grisB, 0.4);
  multiLine(page, obs, ML + 7, obsBodyY + 8, R, 7.5, C.grisF, CW - 14, 11);

  // ═══════════════════════════════════════════════════════════════
  // SIGNATURES
  // ═══════════════════════════════════════════════════════════════
  const sigY = Y_SIG;
  fillRect(page, ML, sigY, CW, 48, C.blanc, C.grisB, 0.5);
  const sw = CW / 3;
  ['Agent collecteur', 'Chef Fokontany', 'Cachet officiel'].forEach((s, i) => {
    const sx = ML + i * sw;
    if (i > 0) line(page, sx, sigY, sx, sigY + 48, C.grisB, 0.3);
    drawText(page, s, sx + sw / 2, sigY + 8, R, 8, C.grisM, 'center');
    line(page, sx + 8, sigY + 34, sx + sw - 8, sigY + 34, C.grisM, 0.5);
    drawText(page, 'Signature', sx + sw / 2, sigY + 40, R, 7.5, C.grisM, 'center');
  });

  // ═══════════════════════════════════════════════════════════════
  // PIED DE PAGE
  // ═══════════════════════════════════════════════════════════════
  const footY = Y_SIG + 52;
  line(page, ML, footY, W - MR, footY, C.grisB, 0.4);
  drawText(page, `FANISA v2.0  |  Document officiel  |  Ref. ${foyer.code_menage}  |  Page 1/1`, W / 2, footY + 6, R, 7, C.grisM, 'center');

  return await pdf.save();
}

export async function imprimerFicheMenage(foyer: Foyer, membres: Membre[]) {
  const bytes = await genererFicheMenage(foyer, membres);
  await telechargerPDF(bytes, `FICHE_MENAGE_${foyer.code_menage}.pdf`);
}
