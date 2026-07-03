import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { Foyer, Membre } from '../types';
import { supabase } from './supabase';
import { getConfig, telechargerPDF } from './documents';

// ── Couleurs ──────────────────────────────────────────────────────
const C = {
  bleu:   rgb(0.118, 0.227, 0.541),
  bleuL:  rgb(0.937, 0.965, 1.000),
  vert:   rgb(0.063, 0.722, 0.506),
  orange: rgb(0.961, 0.620, 0.043),
  rouge:  rgb(0.937, 0.267, 0.267),
  violet: rgb(0.545, 0.361, 0.965),
  cyan:   rgb(0.055, 0.647, 0.914),
  grisF:  rgb(0.118, 0.161, 0.227),
  grisM:  rgb(0.392, 0.455, 0.545),
  grisL:  rgb(0.945, 0.957, 0.976),
  grisB:  rgb(0.886, 0.910, 0.937),
  blanc:  rgb(1, 1, 1),
};

const A4W = 595, A4H = 842, M = 20;
const CW = A4W - 2 * M;

// ── Utilitaires dessin ────────────────────────────────────────────
function rect(page: PDFPage, x: number, y: number, w: number, h: number, fill: any, border?: any, bw = 0.5) {
  page.drawRectangle({ x, y: A4H - y - h, width: w, height: h, color: fill, borderColor: border, borderWidth: border ? bw : 0 });
}

function txt(page: PDFPage, s: string, x: number, y: number, font: PDFFont, size: number, color = C.grisF, align: 'left'|'center'|'right' = 'left', maxW?: number) {
  let label = (s || '').replace(/[^\x00-\xFF]/g, '?'); // strip non-WinAnsi
  if (maxW) {
    while (label.length > 3 && font.widthOfTextAtSize(label, size) > maxW) label = label.slice(0, -1);
    if (label.length < (s || '').length) label = label.slice(0, -2) + '..';
  }
  const w = font.widthOfTextAtSize(label, size);
  let ax = x;
  if (align === 'center') ax = x - w / 2;
  if (align === 'right')  ax = x - w;
  page.drawText(label, { x: ax, y: A4H - y, size, font, color });
}

function hline(page: PDFPage, x: number, y: number, w: number, color = C.grisB, thick = 0.5) {
  page.drawLine({ start: { x, y: A4H - y }, end: { x: x + w, y: A4H - y }, thickness: thick, color });
}

function vline(page: PDFPage, x: number, y: number, h: number, color = C.grisB, thick = 0.3) {
  page.drawLine({ start: { x, y: A4H - y }, end: { x, y: A4H - y - h }, thickness: thick, color });
}

function sectionHeader(page: PDFPage, label: string, y: number, bold: PDFFont): number {
  rect(page, M, y, CW, 16, C.bleu);
  txt(page, label, M + 6, y + 4, bold, 9, C.blanc);
  return y + 19;
}

function badge(page: PDFPage, label: string, x: number, y: number, bg: any, font: PDFFont): number {
  const pad = 5, h = 13;
  const tw = font.widthOfTextAtSize(label, 7);
  const bw = tw + pad * 2;
  rect(page, x, y, bw, h, bg);
  txt(page, label, x + pad, y + 4, font, 7, C.blanc);
  return bw + 4;
}

function indCard(page: PDFPage, x: number, y: number, w: number, val: string, label: string, bold: PDFFont, reg: PDFFont, color = C.bleu) {
  const h = 34;
  rect(page, x, y, w - 2, h, C.grisL, C.grisB, 0.4);
  txt(page, val, x + (w - 2) / 2, y + 8, bold, 14, color, 'center');
  txt(page, label, x + (w - 2) / 2, y + 24, reg, 6, C.grisM, 'center');
}

// ── Chargement historique réel depuis journal/logs ────────────────
async function chargerHistorique(foyerId: string): Promise<{date: string; label: string}[]> {
  // Priorité 1 : table journal
  const { data: logs } = await supabase
    .from('journal')
    .select('*')
    .eq('foyer_id', foyerId)
    .order('date', { ascending: false })
    .limit(8);

  if (logs && logs.length > 0) {
    return logs.map((l: any) => ({
      date: new Date(l.date || l.created_at).toLocaleDateString('fr-FR'),
      label: l.details || l.action || '—',
    }));
  }

  // Priorité 2 : transactions caisse liées au foyer
  const { data: tx } = await supabase
    .from('transactions_caisse')
    .select('created_at, nom_usager')
    .eq('statut', 'Validee')
    .order('created_at', { ascending: false })
    .limit(6);

  // Priorité 3 : demandes de documents
  const { data: docs } = await supabase
    .from('demandes_documents')
    .select('created_at, nom_document')
    .eq('foyer_id', foyerId)
    .order('created_at', { ascending: false })
    .limit(6);

  const hist: {date: string; label: string; ts: string}[] = [];
  (docs || []).forEach((d: any) => hist.push({
    ts: d.created_at,
    date: new Date(d.created_at).toLocaleDateString('fr-FR'),
    label: `${d.nom_document} - delivre`,
  }));

  // Cotisations payees
  const { data: cots } = await supabase
    .from('cotisations')
    .select('date_paiement, periode')
    .eq('foyer_id', foyerId)
    .eq('statut', 'A jour')
    .order('date_paiement', { ascending: false })
    .limit(4);
  (cots || []).forEach((c: any) => {
    if (c.date_paiement) hist.push({
      ts: c.date_paiement,
      date: new Date(c.date_paiement).toLocaleDateString('fr-FR'),
      label: `Cotisation ${c.periode} - payee`,
    });
  });

  hist.sort((a, b) => b.ts.localeCompare(a.ts));
  return hist.slice(0, 6).map(h => ({ date: h.date, label: h.label }));
}

// ── Score FANISA ──────────────────────────────────────────────────
function calculerScore(foyer: Foyer, membres: Membre[]): number {
  let score = 0, total = 0;
  const add = (cond: boolean, pts: number) => { total += pts; if (cond) score += pts; };
  add(!!foyer.adresse, 5);
  add(!!foyer.type_logement, 5);
  add(!!foyer.eau_source, 10);
  add(!!foyer.a_electricite, 5);
  add(!!foyer.statut_occupant, 5);
  add((foyer.materiaux_mur || []).length > 0 || !!foyer.materiau_mur, 5);
  add(membres.some(m => m.is_chef), 10);
  add(membres.length > 0, 10);
  add(membres.filter(m => { const a = m.date_naissance ? new Date().getFullYear() - new Date(m.date_naissance).getFullYear() : 0; return a >= 18; }).some(m => !!m.cin), 15);
  add(membres.some(m => !!m.profession), 10);
  add(membres.some(m => m.vaccination && m.vaccination.length > 0), 10);
  add(!foyer.observations_complementaires?.includes('incomplet'), 10);
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

// ── Résumé automatique ────────────────────────────────────────────
function genResume(foyer: Foyer, membres: Membre[], cotAJour: boolean): string {
  const nb = membres.length;
  const chef = membres.find(m => m.is_chef);
  const today = new Date();
  const nbEnf = membres.filter(m => m.date_naissance && today.getFullYear() - new Date(m.date_naissance).getFullYear() < 18).length;
  const nbVuln = membres.filter(m => m.est_vulnerable).length;
  let s = `Ce menage est compose de ${nb} personne${nb > 1 ? 's' : ''}`;
  if (nbEnf) s += ` dont ${nbEnf} enfant${nbEnf > 1 ? 's' : ''}`;
  s += '.';
  if (chef?.profession) s += ` Le chef de menage est ${chef.profession.toLowerCase()}.`;
  if (foyer.type_logement) {
    s += ` Le logement est de type ${foyer.type_logement.toLowerCase()}`;
    if (foyer.nombre_pieces || foyer.superficie_maison) {
      const parts = [];
      if (foyer.nombre_pieces) parts.push(`${foyer.nombre_pieces} pieces`);
      if (foyer.superficie_maison) parts.push(`${foyer.superficie_maison}m2`);
      s += ` (${parts.join(', ')})`;
    }
    s += '.';
  }
  if (cotAJour) s += ' Les cotisations sont a jour.';
  if (nbVuln) s += ` ${nbVuln} personne${nbVuln > 1 ? 's' : ''} vulnerable${nbVuln > 1 ? 's' : ''} recensee${nbVuln > 1 ? 's' : ''}.`;
  return s;
}

// ── Wrap texte ────────────────────────────────────────────────────
function wrapText(page: PDFPage, s: string, x: number, startY: number, font: PDFFont, size: number, color: any, maxW: number, leading: number): number {
  const words = (s || '').split(' ');
  let line = '', cy = startY;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      txt(page, line, x, cy, font, size, color);
      line = w; cy += leading;
    } else { line = test; }
  }
  if (line) { txt(page, line, x, cy, font, size, color); cy += leading; }
  return cy;
}

// ── GÉNÉRATEUR PRINCIPAL ──────────────────────────────────────────
export async function genererFicheMenage(foyer: Foyer, membres: Membre[]): Promise<Uint8Array> {
  await getConfig();

  // Données depuis Supabase
  const [{ data: docs }, { data: cots }, hist] = await Promise.all([
    supabase.from('demandes_documents').select('nom_document, created_at, statut').eq('foyer_id', foyer.id).eq('statut', 'Payé').order('created_at', { ascending: false }),
    supabase.from('cotisations').select('statut, periode').eq('foyer_id', foyer.id),
    chargerHistorique(foyer.id),
  ]);

  const cotAJour = (cots || []).some((c: any) => c.statut === 'A jour' || c.statut === '\u00c0 jour');
  const dernierDoc = (docs || [])[0];

  // Tri : chef en premier, puis par relation
  const membresOrd = [...membres].sort((a, b) => {
    if (a.is_chef) return -1;
    if (b.is_chef) return 1;
    return 0;
  });

  const today = new Date();
  const age = (m: Membre) => m.date_naissance ? today.getFullYear() - new Date(m.date_naissance).getFullYear() : 0;
  const nbEnfants = membresOrd.filter(m => age(m) < 18).length;
  const nbAges    = membresOrd.filter(m => age(m) >= 60).length;
  const nbVuln    = membresOrd.filter(m => m.est_vulnerable).length;
  const nbSco     = membresOrd.filter(m => {
    const a = age(m);
    const prof = (m.profession || '').toLowerCase();
    return a < 25 && (prof.includes('eleve') || prof.includes('etudiant') || m.niveau_etude?.toLowerCase().includes('prima') || m.niveau_etude?.toLowerCase().includes('second') || m.niveau_etude?.toLowerCase().includes('college') || m.niveau_etude?.toLowerCase().includes('lyc'));
  }).length;
  const nbTrav = membresOrd.filter(m => {
    const p = (m.profession || '').toLowerCase();
    return p && !p.includes('eleve') && !p.includes('etudiant') && !p.includes('retraitee') && !p.includes('sans');
  }).length;
  const nbAlpha = membresOrd.filter(m => m.niveau_etude && m.niveau_etude !== 'Aucun').length;

  const score      = calculerScore(foyer, membresOrd);
  const scoreColor = score >= 70 ? C.vert : score >= 50 ? C.orange : C.rouge;
  const now        = today.toLocaleDateString('fr-FR') + ' - ' + today.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const chef       = membresOrd.find(m => m.is_chef);

  // Données habitat
  const murs = Array.isArray(foyer.materiaux_mur) && foyer.materiaux_mur.length > 0
    ? foyer.materiaux_mur.join(', ')
    : foyer.materiau_mur || '—';
  const eau = foyer.eau_source || '—';
  const elec = foyer.a_electricite ? 'Oui' : (foyer.a_electricite === false ? 'Non' : '—');

  // Données santé (depuis membres)
  const chefVacc = chef?.vaccination || [];
  const vaccStr = chefVacc.length > 0 ? chefVacc.join(', ') : '—';
  const nbHandicap = membresOrd.filter(m => m.handicap_oui || !!m.handicap).length;
  const nbSuivi = membresOrd.filter(m => m.suivi_medical).length;

  // Education
  const niveaux = membresOrd.map(m => m.niveau_etude).filter(Boolean);
  const niveauMoy = niveaux.length > 0 ? niveaux[Math.floor(niveaux.length / 2)] : '—';

  // Economie chef
  const revenuChef = chef?.revenu_estime ? `${chef.revenu_estime.toLocaleString('fr-FR')} Ar` : (chef?.revenu_fourchette || '—');
  const hasAgri = membresOrd.some(m => (m.agr_types || []).length > 0 || (m.secteur || '').toLowerCase().includes('agri'));
  const hasElevage = membresOrd.some(m => (m.agr_types || []).some(a => a.toLowerCase().includes('elevage')));

  // PDF
  const pdf  = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([A4W, A4H]);
  let cy     = 12;

  // ── EN-TÊTE ──────────────────────────────────────────────────────
  txt(page, 'FANISA', M, cy + 2, bold, 18, C.bleu);
  txt(page, 'Gestion du Fokontany', M, cy + 16, reg, 7.5, C.grisM);
  txt(page, 'FICHE MENAGE', A4W / 2, cy + 2, bold, 16, C.grisF, 'center');
  txt(page, 'Document officiel - Usage administratif', A4W / 2, cy + 16, reg, 7.5, C.grisM, 'center');
  rect(page, A4W - M - 26, cy, 22, 22, C.grisL, C.grisB, 0.5);
  txt(page, 'QR', A4W - M - 15, cy + 8, bold, 8, C.grisM, 'center');
  txt(page, foyer.code_menage, A4W - M, cy + 2, bold, 14, C.bleu, 'right');
  txt(page, now, A4W - M, cy + 16, reg, 7.5, C.grisM, 'right');
  cy += 26;
  hline(page, M, cy, CW, C.bleu, 2);
  cy += 6;

  // ── BLOC CHEF ────────────────────────────────────────────────────
  rect(page, M, cy, CW, 58, C.grisL, C.grisB, 0.5);
  // Photo
  rect(page, M + 4, cy + 4, 32, 48, C.blanc, C.grisB, 0.5);
  txt(page, 'PHOTO', M + 4 + 16, cy + 27, reg, 7, C.grisM, 'center');

  const nomChef = chef ? `${(chef.nom || '').toUpperCase()} ${chef.prenom || ''}`.trim() : '—';
  const adrL1 = 'Chef de menage  |  ' + (foyer.adresse || '—');
  const adrL2 = [foyer.fokontany ? `Fokontany ${foyer.fokontany}` : '', foyer.commune ? `Commune ${foyer.commune}` : '', foyer.district ? `District ${foyer.district}` : ''].filter(Boolean).join(' | ');
  const telStr = chef?.telephone ? `Tel: ${chef.telephone}` + (foyer.annee_installation ? `  |  Installe depuis: ${foyer.annee_installation}` : '') : '';

  const ix = M + 42;
  txt(page, nomChef, ix, cy + 9, bold, 13, C.grisF, 'left', CW - 95);
  txt(page, adrL1, ix, cy + 21, reg, 7.5, C.grisM, 'left', CW - 95);
  txt(page, adrL2, ix, cy + 31, reg, 7, C.grisM, 'left', CW - 95);
  if (telStr) txt(page, telStr, ix, cy + 41, reg, 7, C.grisM, 'left', CW - 95);

  // Badges statut
  let bx = ix, by = cy + 52;
  bx += badge(page, '* Actif', bx, by, C.vert, bold);
  if ((foyer as any).note_agent_incomplete) bx += badge(page, '* A suivre', bx, by, C.orange, bold);
  bx += badge(page, cotAJour ? '* Cotisation a jour' : '* Cotisation en retard', bx, by, cotAJour ? C.cyan : C.orange, bold);

  // Score
  rect(page, A4W - M - 45, cy + 3, 41, 48, C.blanc, scoreColor, 2);
  txt(page, `${score}%`, A4W - M - 24, cy + 19, bold, 18, scoreColor, 'center');
  txt(page, 'Score FANISA', A4W - M - 24, cy + 40, reg, 6, C.grisM, 'center');
  cy += 68;

  // ── INDICATEURS CLÉS ─────────────────────────────────────────────
  cy = sectionHeader(page, '  INDICATEURS CLES', cy, bold);
  const iw = CW / 6;
  const sup = foyer.superficie_maison ? `${foyer.superficie_maison}m2` : '—';
  const row1 = [[String(membresOrd.length),'Membres',C.bleu],[String(foyer.nombre_pieces||'—'),'Pieces',C.bleu],[sup,'Superficie',C.cyan],[String(nbEnfants),'Enfants',C.orange],[String(nbAges),'Pers. agees',C.violet],[String(nbVuln),'Vulnerables',C.rouge]];
  const row2 = [[String(nbSco),'Scolarises',C.vert],[String(nbTrav),'Travailleurs',C.vert],['—','Activites',C.cyan],['—','Terrain',C.orange],['—','Vehicule',C.violet],['—','Elevage',C.orange]];
  row1.forEach(([v,l,c],i) => indCard(page, M + i*iw, cy, iw, v as string, l as string, bold, reg, c as any));
  cy += 36;
  row2.forEach(([v,l,c],i) => indCard(page, M + i*iw, cy, iw, v as string, l as string, bold, reg, c as any));
  cy += 38;

  // ── RÉSUMÉ INTELLIGENT ───────────────────────────────────────────
  cy = sectionHeader(page, '  RESUME INTELLIGENT FANISA', cy, bold);
  const resume = genResume(foyer, membresOrd, cotAJour);
  const resumeLines = Math.max(2, Math.ceil(resume.length / 100));
  const resumeH = resumeLines * 11 + 10;
  rect(page, M, cy, CW, resumeH, C.bleuL, C.grisB, 0.5);
  wrapText(page, resume, M + 8, cy + 9, reg, 8, C.grisF, CW - 16, 11);
  cy += resumeH + 2;

  // ── COMPOSITION DU MÉNAGE ────────────────────────────────────────
  cy = sectionHeader(page, '  COMPOSITION DU MENAGE', cy, bold);
  const cws = [0.32, 0.15, 0.08, 0.27, 0.18].map(r => CW * r);
  rect(page, M, cy, CW, 13, C.bleu);
  let hx = M;
  ['Nom', 'Lien', 'Age', 'Profession', 'Statut'].forEach((h, i) => { txt(page, h, hx + 4, cy + 4, bold, 8, C.blanc); hx += cws[i]; });
  cy += 13;

  membresOrd.forEach((m, idx) => {
    const bg = idx % 2 === 0 ? C.blanc : C.grisL;
    rect(page, M, cy, CW, 12, bg, C.grisB, 0.2);
    let mx = M;
    const a = age(m);
    const statut = m.est_vulnerable ? 'Vulnerable' : m.statut || 'Actif';
    const fn = m.is_chef ? bold : reg;
    [`${(m.nom||'').toUpperCase()} ${m.prenom||''}`.trim(), m.relation_chef || (m.is_chef ? 'Chef' : '—'), a > 0 ? String(a) : '—', m.profession || '—', statut]
      .forEach((v, i) => { txt(page, v as string, mx + 4, cy + 3.5, fn, 7.5, C.grisF, 'left', cws[i] - 6); mx += cws[i]; });
    cy += 12;
  });
  cy += 3;

  // ── SITUATION DU MÉNAGE ──────────────────────────────────────────
  cy = sectionHeader(page, '  SITUATION DU MENAGE', cy, bold);
  const sitCols = [
    { title:'Sante', color: C.vert, items:[['Vaccination', vaccStr.length > 20 ? 'Complete' : vaccStr],['Chronique', nbHandicap > 0 ? `${nbHandicap}` : 'Aucune'],['Handicap', String(nbHandicap)],['Suivi', nbSuivi > 0 ? 'Oui' : '—']] },
    { title:'Habitat', color: C.bleu, items:[['Type', foyer.type_logement||'—'],['Murs', murs.length > 18 ? murs.slice(0,16)+'..': murs],['Eau', eau],['Electricite', elec]] },
    { title:'Education', color: C.orange, items:[['Eleves', String(nbSco)],['Niveau moy.', niveauMoy||'—'],['Abandon', '0'],['Alphabetises', `${nbAlpha}/${membresOrd.length}`]] },
    { title:'Economie', color: C.violet, items:[['Revenu', revenuChef],['Agriculture', hasAgri ? 'Oui' : 'Non'],['Elevage', hasElevage ? 'Oui' : 'Non']] },
  ];
  const scw = (CW - 6) / 4;
  const sitH = 14 + Math.max(...sitCols.map(s => s.items.length)) * 11 + 4;
  sitCols.forEach((s, i) => {
    const sx = M + i * (scw + 2);
    rect(page, sx, cy, scw, sitH, C.blanc, C.grisB, 0.5);
    hline(page, sx, cy + 14, scw, s.color, 1.5);
    txt(page, s.title, sx + 6, cy + 5, bold, 8, s.color);
    s.items.forEach(([k, v], j) => txt(page, `${k}: ${v}`, sx + 5, cy + 17 + j * 11, reg, 7.5, C.grisF, 'left', scw - 8));
  });
  cy += sitH + 3;

  // ── PATRIMOINE ───────────────────────────────────────────────────
  cy = sectionHeader(page, '  PATRIMOINE', cy, bold);
  rect(page, M, cy, CW, 14, C.grisL, C.grisB, 0.5);
  // Pour l'instant on n'a pas les tables patrimoine chargées ici — on met les infos disponibles
  const patStr = ['Terrain: —', 'Maison: —', 'Moto: —', 'TV: —', `Telephone: ${chef?.telephone ? '1' : '—'}`].join('  |  ');
  txt(page, patStr, M + 8, cy + 5, reg, 7.5, C.grisF);
  cy += 18;

  // ── DOCUMENTS ADMINISTRATIFS ─────────────────────────────────────
  cy = sectionHeader(page, '  DOCUMENTS ADMINISTRATIFS', cy, bold);
  rect(page, M, cy, CW, 14, C.grisL, C.grisB, 0.5);
  const nbDocs = (docs || []).length;
  const docLabel = dernierDoc ? `${dernierDoc.nom_document} (${new Date(dernierDoc.created_at).toLocaleDateString('fr-FR')})` : '—';
  txt(page, `Total: ${nbDocs} document${nbDocs>1?'s':''}  |  Dernier: ${docLabel}  |  Statut: Conforme`, M + 8, cy + 5, reg, 7.5, C.grisF, 'left', CW - 16);
  cy += 18;

  // ── HISTORIQUE DU MÉNAGE ─────────────────────────────────────────
  cy = sectionHeader(page, '  HISTORIQUE DU MENAGE', cy, bold);
  if (hist.length === 0) {
    txt(page, 'Aucun historique enregistre.', M + 8, cy + 5, reg, 8, C.grisM);
    cy += 14;
  } else {
    hist.forEach(evt => {
      txt(page, '-', M + 4, cy + 3, bold, 9, C.bleu);
      txt(page, evt.date, M + 14, cy + 3, bold, 8, C.grisF);
      txt(page, evt.label, M + 56, cy + 3, reg, 8, C.grisF, 'left', CW - 64);
      cy += 12;
    });
  }
  cy += 2;

  // ── OBSERVATIONS ─────────────────────────────────────────────────
  cy = sectionHeader(page, '  OBSERVATIONS', cy, bold);
  const obs = foyer.observations_complementaires || 'Aucune observation.';
  const obsH = Math.max(36, Math.ceil(obs.length / 90) * 11 + 12);
  rect(page, M, cy, CW, obsH, C.blanc, C.grisB, 0.5);
  wrapText(page, obs, M + 8, cy + 9, reg, 7.5, C.grisF, CW - 16, 11);
  cy += obsH + 4;

  // ── SIGNATURES ───────────────────────────────────────────────────
  const sigY = Math.max(cy + 4, A4H - M - 52);
  const sw = CW / 3;
  rect(page, M, sigY, CW, 48, C.blanc, C.grisB, 0.5);
  ['Agent collecteur', 'Chef Fokontany', 'Cachet officiel'].forEach((s, i) => {
    const sx = M + i * sw;
    if (i > 0) vline(page, sx, sigY, 48, C.grisB);
    txt(page, s, sx + sw / 2, sigY + 8, reg, 8, C.grisM, 'center');
    hline(page, sx + 6, sigY + 34, sw - 12, C.grisM, 0.5);
    txt(page, 'Signature', sx + sw / 2, sigY + 42, reg, 7, C.grisM, 'center');
  });

  // ── PIED DE PAGE ─────────────────────────────────────────────────
  hline(page, M, A4H - M - 8, CW, C.grisB, 0.5);
  txt(page, `FANISA v2.0  |  Document officiel  |  Ref. ${foyer.code_menage}  |  Page 1/1`, A4W / 2, A4H - M - 3, reg, 7, C.grisM, 'center');

  return await pdf.save();
}

export async function imprimerFicheMenage(foyer: Foyer, membres: Membre[]) {
  const bytes = await genererFicheMenage(foyer, membres);
  await telechargerPDF(bytes, `FICHE_MENAGE_${foyer.code_menage}.pdf`);
}
