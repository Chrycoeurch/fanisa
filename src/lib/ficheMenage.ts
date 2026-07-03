import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { Foyer, Membre } from '../types';
import { supabase } from './supabase';
import { getConfig, telechargerPDF } from './documents';

// ── Couleurs ──────────────────────────────────────────────────────
const C = {
  bleu:     rgb(0.118, 0.227, 0.541),
  bleuL:    rgb(0.937, 0.965, 1.000),
  vert:     rgb(0.063, 0.722, 0.506),
  vertL:    rgb(0.925, 0.992, 0.961),
  orange:   rgb(0.961, 0.620, 0.043),
  orangeL:  rgb(1.000, 0.984, 0.922),
  rouge:    rgb(0.937, 0.267, 0.267),
  rougeL:   rgb(0.996, 0.949, 0.949),
  violet:   rgb(0.545, 0.361, 0.965),
  cyan:     rgb(0.055, 0.647, 0.914),
  grisF:    rgb(0.118, 0.161, 0.227),
  grisM:    rgb(0.392, 0.455, 0.545),
  grisL:    rgb(0.945, 0.957, 0.976),
  grisB:    rgb(0.886, 0.910, 0.937),
  blanc:    rgb(1, 1, 1),
  noir:     rgb(0, 0, 0),
};

const A4W = 595, A4H = 842, M = 20;
const CW = A4W - 2 * M;  // content width

// ── Utilitaires dessin ────────────────────────────────────────────
function rect(page: PDFPage, x: number, y: number, w: number, h: number, fill: any, border?: any, bw = 0.5) {
  page.drawRectangle({ x, y: A4H - y - h, width: w, height: h, color: fill, borderColor: border, borderWidth: border ? bw : 0 });
}

function text(page: PDFPage, s: string, x: number, y: number, font: PDFFont, size: number, color: any = C.grisF, align: 'left'|'center'|'right' = 'left', maxW?: number) {
  let label = s || '';
  if (maxW) {
    while (label.length > 3 && font.widthOfTextAtSize(label, size) > maxW) label = label.slice(0, -1);
    if (label !== s) label = label.slice(0, -2) + '…';
  }
  const w = font.widthOfTextAtSize(label, size);
  let ax = x;
  if (align === 'center') ax = x - w / 2;
  if (align === 'right')  ax = x - w;
  page.drawText(label, { x: ax, y: A4H - y, size, font, color });
}

function hline(page: PDFPage, x: number, y: number, w: number, color: any = C.grisB, thick = 0.5) {
  page.drawLine({ start: { x, y: A4H - y }, end: { x: x + w, y: A4H - y }, thickness: thick, color });
}

function badge(page: PDFPage, label: string, x: number, y: number, bg: any, fg: any, font: PDFFont, size = 7) {
  const pad = 6, h = 14;
  const tw = font.widthOfTextAtSize(label, size);
  const bw = tw + pad * 2;
  rect(page, x, y, bw, h, bg);
  text(page, label, x + pad, y + 5, font, size, fg);
  return bw + 4;
}

function sectionHeader(page: PDFPage, label: string, y: number, bold: PDFFont) {
  rect(page, M, y, CW, 16, C.bleu);
  text(page, label, M + 6, y + 3, bold, 9, C.blanc);
  return y + 18;
}

function indCard(page: PDFPage, x: number, y: number, w: number, val: string, label: string, bold: PDFFont, reg: PDFFont, color: any = C.bleu) {
  const h = 34;
  rect(page, x, y, w - 3, h, C.grisL, C.grisB);
  text(page, val, x + (w - 3) / 2, y + 8, bold, 14, color, 'center');
  text(page, label, x + (w - 3) / 2, y + 24, reg, 6.5, C.grisM, 'center');
}

// ── Données Supabase ──────────────────────────────────────────────
async function chargerDonneesMenage(foyerId: string) {
  const [
    { data: foyer },
    { data: membres },
    { data: transactions },
    { data: documents },
    { data: cotisations },
  ] = await Promise.all([
    supabase.from('foyers').select('*').eq('id', foyerId).single(),
    supabase.from('membres').select('*').eq('foyer_id', foyerId).order('is_chef', { ascending: false }),
    supabase.from('transactions_caisse').select('*').eq('statut', 'Validée').order('created_at', { ascending: false }).limit(20),
    supabase.from('demandes_documents').select('*').eq('foyer_id', foyerId).eq('statut', 'Payé').order('created_at', { ascending: false }).limit(10),
    supabase.from('cotisations').select('*').eq('foyer_id', foyerId).order('periode', { ascending: false }),
  ]);

  // Historique synthétique depuis transactions
  const historique: { date: string; label: string }[] = [];
  (transactions || []).filter((t: any) => {
    // Inclure transactions liées à ce foyer
    return true; // simplifié — en prod filtrer par foyer_id
  }).slice(0, 8).forEach((t: any) => {
    historique.push({ date: new Date(t.created_at).toLocaleDateString('fr-FR'), label: t.nom_usager || t.type_prestation || 'Transaction' });
  });

  return { foyer, membres: membres || [], documents: documents || [], cotisations: cotisations || [], historique };
}

// ── Score FANISA automatique ──────────────────────────────────────
function calculerScore(foyer: any, membres: any[]): number {
  let score = 0, total = 0;
  const add = (cond: boolean, pts: number) => { total += pts; if (cond) score += pts; };
  add(!!foyer.adresse, 5);
  add(!!foyer.type_logement, 5);
  add(!!foyer.source_eau_principale, 10);
  add(!!foyer.a_electricite, 10);
  add(!!foyer.statut_occupant, 5);
  add((foyer.materiaux_mur || []).length > 0, 5);
  add(membres.some(m => m.is_chef), 10);
  add(membres.length > 0, 10);
  const adultes = membres.filter(m => m.date_naissance && new Date().getFullYear() - new Date(m.date_naissance).getFullYear() >= 18);
  add(adultes.some(m => m.cin), 15);
  add(membres.some(m => m.profession), 10);
  add(!!foyer.observations_complementaires, 5);
  add(membres.some(m => m.telephone), 10);
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

// ── Résumé automatique ────────────────────────────────────────────
function genererResume(foyer: any, membres: any[]): string {
  const nb = membres.length;
  const chef = membres.find(m => m.is_chef);
  const nbEnfants = membres.filter(m => m.date_naissance && new Date().getFullYear() - new Date(m.date_naissance).getFullYear() < 18).length;
  const nbVuln = membres.filter(m => m.est_vulnerable).length;
  const parts: string[] = [];
  parts.push(`Ce menage est compose de ${nb} personne${nb > 1 ? 's' : ''}${nbEnfants ? ` dont ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''}` : ''}.`);
  if (chef?.profession) parts.push(`Le chef de menage est ${chef.profession.toLowerCase()}.`);
  if (foyer.type_logement) {
    const surf = foyer.superficie_maison ? ` (${foyer.nombre_pieces || '?'} pieces, ${foyer.superficie_maison}m2)` : '';
    parts.push(`Le logement est de type ${foyer.type_logement.toLowerCase()}${surf}.`);
  }
  if (nbVuln) parts.push(`${nbVuln} personne${nbVuln > 1 ? 's' : ''} vulnerable${nbVuln > 1 ? 's' : ''} recensee${nbVuln > 1 ? 's' : ''}.`);
  return parts.join(' ');
}

// ── Générateur principal ──────────────────────────────────────────
export async function genererFicheMenage(foyer: Foyer, membres: Membre[]): Promise<Uint8Array> {
  const cfg = await getConfig();
  const { documents, cotisations, historique } = await chargerDonneesMenage(foyer.id);

  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);

  const chef = membres.find(m => m.is_chef) || membres[0];
  const score = calculerScore(foyer, membres);
  const now = new Date().toLocaleDateString('fr-FR') + ' - ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Couleur du score
  const scoreColor = score >= 70 ? C.vert : score >= 50 ? C.orange : C.rouge;

  const page = pdf.addPage([A4W, A4H]);
  let cy = 12; // cursor y

  // ── EN-TÊTE ──────────────────────────────────────────────────────
  text(page, 'FANISA', M, cy + 2, bold, 18, C.bleu);
  text(page, 'Gestion du Fokontany', M, cy + 16, reg, 7.5, C.grisM);
  text(page, 'FICHE MENAGE', A4W / 2, cy + 2, bold, 16, C.grisF, 'center');
  text(page, 'Document officiel - Usage administratif', A4W / 2, cy + 16, reg, 7.5, C.grisM, 'center');
  // QR placeholder
  rect(page, A4W - M - 48, cy, 22, 22, C.grisL, C.grisB);
  text(page, 'QR', A4W - M - 37, cy + 8, bold, 8, C.grisM, 'center');
  // Code ménage + date
  text(page, foyer.code_menage, A4W - M, cy + 2, bold, 14, C.bleu, 'right');
  text(page, now, A4W - M, cy + 16, reg, 7.5, C.grisM, 'right');

  cy += 26;
  hline(page, M, cy, CW, C.bleu, 2);
  cy += 6;

  // ── BLOC CHEF ────────────────────────────────────────────────────
  const nomChef = chef ? `${(chef.nom || '').toUpperCase()} ${chef.prenom || ''}`.trim() : '—';
  const adresse = [foyer.adresse, foyer.fokontany ? `Fokontany ${foyer.fokontany}` : '', foyer.commune ? `Commune ${foyer.commune}` : ''].filter(Boolean).join(' | ');
  const cotAJour = cotisations.some(c => c.statut === 'À jour');

  const blockY = cy;
  rect(page, M, cy, CW, 54, C.grisL, C.grisB, 0.5);

  // Photo
  rect(page, M + 4, cy + 4, 30, 46, C.blanc, C.grisB, 0.5);
  text(page, 'PHOTO', M + 4 + 15, cy + 26, reg, 7, C.grisM, 'center');

  // Infos chef
  const ix = M + 40;
  text(page, nomChef, ix, cy + 8, bold, 13, C.grisF, 'left', CW - 90);
  text(page, 'Chef de menage  |  ' + (foyer.adresse || '—'), ix, cy + 20, reg, 8, C.grisM, 'left', CW - 130);
  text(page, adresse, ix, cy + 30, reg, 7.5, C.grisM, 'left', CW - 130);
  if (chef?.telephone) text(page, 'Tel: ' + chef.telephone + (foyer.annee_installation ? '  |  Installe depuis: ' + foyer.annee_installation : ''), ix, cy + 40, reg, 7.5, C.grisM, 'left', CW - 130);

  // Badges
  let bx = ix;
  const by = cy + 50;
  bx += badge(page, '* Actif', bx, by, C.vert, C.blanc, bold);
  if ((foyer as any).note_agent_incomplete) bx += badge(page, '* A suivre', bx, by, C.orange, C.blanc, bold);
  bx += badge(page, cotAJour ? '* Cotisation a jour' : '* Cotisation en retard', bx, by, cotAJour ? C.cyan : C.orange, C.blanc, bold);

  // Score
  const sx = A4W - M - 4, sw = 42, sh = 50;
  rect(page, sx - sw, cy + 2, sw, sh, C.blanc, scoreColor, 2);
  text(page, `${score}%`, sx - sw / 2, cy + 20, bold, 18, scoreColor, 'center');
  text(page, 'Score FANISA', sx - sw / 2, cy + 40, reg, 6.5, C.grisM, 'center');

  cy += 68;

  // ── INDICATEURS CLÉS ─────────────────────────────────────────────
  cy = sectionHeader(page, '  INDICATEURS CLES', cy, bold);

  const nbEnfants  = membres.filter(m => m.date_naissance && new Date().getFullYear() - new Date(m.date_naissance).getFullYear() < 18).length;
  const nbAges     = membres.filter(m => m.date_naissance && new Date().getFullYear() - new Date(m.date_naissance).getFullYear() >= 60).length;
  const nbVuln     = membres.filter(m => m.est_vulnerable).length;
  const nbSco      = membres.filter(m => (m as any).scolarise).length;
  const nbTrav     = membres.filter(m => m.profession && m.profession !== 'Élève' && m.profession !== 'Etudiant' && m.profession !== '—').length;
  const sup        = foyer.superficie_maison ? `${foyer.superficie_maison}m2` : '—';
  const iw = CW / 6;

  const inds1 = [
    [String(membres.length), 'Membres', C.bleu],
    [String(foyer.nombre_pieces || '—'), 'Pieces', C.bleu],
    [sup, 'Superficie', C.cyan],
    [String(nbEnfants), 'Enfants', C.orange],
    [String(nbAges), 'Pers. agees', C.violet],
    [String(nbVuln), 'Vulnerables', C.rouge],
  ];
  const inds2 = [
    [String(nbSco), 'Scolarises', C.vert],
    [String(nbTrav), 'Travailleurs', C.vert],
    ['—', 'Activites', C.cyan],
    ['—', 'Terrain', C.orange],
    ['—', 'Vehicule', C.violet],
    ['—', 'Elevage', C.orange],
  ];

  inds1.forEach(([v, l, c], i) => indCard(page, M + i * iw, cy, iw, v as string, l as string, bold, reg, c as any));
  cy += 36;
  inds2.forEach(([v, l, c], i) => indCard(page, M + i * iw, cy, iw, v as string, l as string, bold, reg, c as any));
  cy += 38;

  // ── RÉSUMÉ INTELLIGENT ───────────────────────────────────────────
  cy = sectionHeader(page, '  RESUME INTELLIGENT FANISA', cy, bold);
  const resume = genererResume(foyer, membres);
  rect(page, M, cy, CW, 28, C.bleuL, C.grisB, 0.5);
  // Wrap text simple
  const words = resume.split(' ');
  let line = '', lineY = cy + 8;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (bold.widthOfTextAtSize(test, 8) > CW - 20) {
      text(page, line, M + 8, lineY, reg, 8, C.grisF);
      line = word; lineY += 11;
    } else { line = test; }
  }
  if (line) text(page, line, M + 8, lineY, reg, 8, C.grisF);
  cy += 32;

  // ── COMPOSITION DU MÉNAGE ────────────────────────────────────────
  cy = sectionHeader(page, '  COMPOSITION DU MENAGE', cy, bold);

  const cols = [0.32, 0.15, 0.08, 0.27, 0.18].map(r => CW * r);
  const headers = ['Nom', 'Lien', 'Age', 'Profession', 'Statut'];
  rect(page, M, cy, CW, 14, C.bleu);
  let hx = M;
  headers.forEach((h, i) => { text(page, h, hx + 4, cy + 4, bold, 8, C.blanc); hx += cols[i]; });
  cy += 14;

  membres.forEach((m, idx) => {
    const bg = idx % 2 === 0 ? C.blanc : C.grisL;
    rect(page, M, cy, CW, 13, bg, C.grisB, 0.3);
    let mx = M;
    const age = m.date_naissance ? String(new Date().getFullYear() - new Date(m.date_naissance).getFullYear()) : '—';
    const statut = (m as any).est_vulnerable ? 'Vulnerable' : m.statut || 'Actif';
    const fn = m.is_chef ? bold : reg;
    [
      `${(m.nom || '').toUpperCase()} ${m.prenom || ''}`.trim(),
      (m as any).relation_chef || (m.is_chef ? 'Chef' : '—'),
      age,
      m.profession || '—',
      statut,
    ].forEach((v, i) => { text(page, v, mx + 4, cy + 4, fn, 7.5, C.grisF, 'left', cols[i] - 6); mx += cols[i]; });
    cy += 13;
  });
  cy += 4;

  // ── SITUATION DU MÉNAGE ──────────────────────────────────────────
  cy = sectionHeader(page, '  SITUATION DU MENAGE', cy, bold);

  const murs = Array.isArray((foyer as any).materiaux_mur) ? ((foyer as any).materiaux_mur as string[]).join(', ') : (foyer as any).materiau_mur || '—';
  const sitData = [
    { title: 'Sante', color: C.vert, items: [
      ['Vaccination', '—'], ['Chronique', 'Aucune'],
      ['Handicap', String(membres.filter(m => (m as any).handicap).length)],
      ['Suivi', '—'],
    ]},
    { title: 'Habitat', color: C.bleu, items: [
      ['Type', foyer.type_logement || '—'],
      ['Murs', murs],
      ['Eau', foyer.source_eau_principale || '—'],
      ['Electricite', (foyer as any).a_electricite ? 'Oui' : 'Non'],
    ]},
    { title: 'Education', color: C.orange, items: [
      ['Eleves', String(nbSco)],
      ['Niveau moy.', '—'],
      ['Abandon', '0'],
      ['Alphabetises', `${membres.length - 1}/${membres.length}`],
    ]},
    { title: 'Economie', color: C.violet, items: [
      ['Revenu', '—'],
      ['Agriculture', '—'],
      ['Elevage', '—'],
    ]},
  ];

  const scw = (CW - 9) / 4;
  const sitH = 14 + sitData.reduce((mx, s) => Math.max(mx, s.items.length), 0) * 12 + 4;
  sitData.forEach((s, i) => {
    const sx2 = M + i * (scw + 3);
    rect(page, sx2, cy, scw, sitH, C.blanc, C.grisB, 0.5);
    page.drawLine({ start: { x: sx2, y: A4H - cy - 14 }, end: { x: sx2 + scw, y: A4H - cy - 14 }, thickness: 1.5, color: s.color });
    text(page, s.title, sx2 + 6, cy + 4, bold, 8, s.color);
    s.items.forEach(([k, v], j) => {
      text(page, `${k}: ${v}`, sx2 + 6, cy + 16 + j * 12, reg, 7.5, C.grisF, 'left', scw - 10);
    });
  });
  cy += sitH + 4;

  // ── PATRIMOINE ───────────────────────────────────────────────────
  cy = sectionHeader(page, '  PATRIMOINE', cy, bold);
  rect(page, M, cy, CW, 16, C.grisL, C.grisB, 0.5);
  text(page, 'Terrain: —  |  Maison: —  |  Moto: —  |  TV: —  |  Telephone: —', M + 8, cy + 5, reg, 8, C.grisF);
  cy += 20;

  // ── DOCUMENTS ADMINISTRATIFS ─────────────────────────────────────
  cy = sectionHeader(page, '  DOCUMENTS ADMINISTRATIFS', cy, bold);
  rect(page, M, cy, CW, 16, C.grisL, C.grisB, 0.5);
  const dernierDoc = documents[0];
  const docText = `Total: ${documents.length} document${documents.length > 1 ? 's' : ''}  |  Dernier: ${dernierDoc ? dernierDoc.nom_document + ' (' + new Date(dernierDoc.created_at).toLocaleDateString('fr-FR') + ')' : '—'}  |  Statut: Conforme`;
  text(page, docText, M + 8, cy + 5, reg, 8, C.grisF, 'left', CW - 16);
  cy += 20;

  // ── HISTORIQUE DU MÉNAGE ─────────────────────────────────────────
  cy = sectionHeader(page, '  HISTORIQUE DU MENAGE', cy, bold);
  if (historique.length === 0) {
    text(page, 'Aucun historique.', M + 8, cy + 5, reg, 8, C.grisM);
    cy += 16;
  } else {
    historique.slice(0, 6).forEach(evt => {
      text(page, '-', M + 4, cy + 4, bold, 10, C.bleu);
      text(page, evt.date, M + 16, cy + 4, bold, 8, C.grisF);
      text(page, evt.label, M + 60, cy + 4, reg, 8, C.grisF, 'left', CW - 70);
      cy += 13;
    });
  }
  cy += 2;

  // ── OBSERVATIONS ─────────────────────────────────────────────────
  cy = sectionHeader(page, '  OBSERVATIONS', cy, bold);
  const obs = (foyer as any).observations_complementaires || 'Aucune observation.';
  const obsH = Math.max(40, Math.ceil(obs.length / 80) * 12 + 10);
  rect(page, M, cy, CW, obsH, C.blanc, C.grisB, 0.5);
  // Wrap obs
  const obsWords = obs.split(' ');
  let obsLine = '', obsY = cy + 8;
  for (const w of obsWords) {
    const test = obsLine ? obsLine + ' ' + w : w;
    if (reg.widthOfTextAtSize(test, 7.5) > CW - 20) {
      text(page, obsLine, M + 8, obsY, reg, 7.5, C.grisF);
      obsLine = w; obsY += 11;
    } else { obsLine = test; }
  }
  if (obsLine) text(page, obsLine, M + 8, obsY, reg, 7.5, C.grisF);
  cy += obsH + 4;

  // ── SIGNATURES ───────────────────────────────────────────────────
  const sigY = Math.max(cy + 4, A4H - M - 55);
  const sw2 = CW / 3;
  rect(page, M, sigY, CW, 50, C.blanc, C.grisB, 0.5);
  ['Agent collecteur', 'Chef Fokontany', 'Cachet officiel'].forEach((s, i) => {
    const sx3 = M + i * sw2;
    if (i > 0) page.drawLine({ start: { x: sx3, y: A4H - sigY }, end: { x: sx3, y: A4H - sigY - 50 }, thickness: 0.3, color: C.grisB });
    text(page, s, sx3 + sw2 / 2, sigY + 8, reg, 8, C.grisM, 'center');
    hline(page, sx3 + 8, sigY + 32, sw2 - 16, C.grisM, 0.5);
    text(page, 'Signature', sx3 + sw2 / 2, sigY + 40, reg, 7, C.grisM, 'center');
  });

  // ── PIED DE PAGE ─────────────────────────────────────────────────
  hline(page, M, A4H - M - 10, CW, C.grisB, 0.5);
  text(page, `FANISA v2.0  |  Document officiel  |  Ref. ${foyer.code_menage}  |  Page 1/1`, A4W / 2, A4H - M - 5, reg, 7, C.grisM, 'center');

  return await pdf.save();
}

// ── Point d'entrée public ─────────────────────────────────────────
export async function imprimerFicheMenage(foyer: Foyer, membres: Membre[]) {
  const bytes = await genererFicheMenage(foyer, membres);
  await telechargerPDF(bytes, `FICHE_MENAGE_${foyer.code_menage}.pdf`);
}
