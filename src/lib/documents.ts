import { supabase } from './supabase';
import { Membre, Foyer } from '../types';
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';

// ── Config Fokontany ─────────────────────────────────────────
export interface ConfigFokontany {
  code_fokontany: string;
  code_quartier: string;
  code_carreau: string;
  nom_fokontany: string;
  nom_quartier: string;
  nom_commune: string;
  nom_district: string;
  chef_fokontany: string;
}

export async function getConfig(): Promise<ConfigFokontany> {
  const { data } = await supabase.from('config_fokontany').select('*').single();
  return data || {
    code_fokontany: 'AMB', code_quartier: 'TSA', code_carreau: 'C01',
    nom_fokontany: 'Ambodisaina', nom_quartier: 'Tsararivotra',
    nom_commune: 'Toamasina', nom_district: 'Toamasina II',
    chef_fokontany: 'Chef du Fokontany',
  };
}

export async function updateConfig(config: Partial<ConfigFokontany>) {
  await supabase.from('config_fokontany').update(config).eq('id', 1);
}

// ── Génération de la référence séquentielle ──────────────────
export async function genererReference(codeType: string, config: ConfigFokontany): Promise<{ reference: string; numero: number }> {
  const annee = new Date().getFullYear();
  const prefix = `${config.code_fokontany}-${config.code_quartier}-${config.code_carreau}-${codeType}-${annee}`;

  // Trouver le dernier numéro pour ce type+année
  const { data } = await supabase
    .from('documents_generes')
    .select('numero_sequentiel')
    .eq('code_type', codeType)
    .eq('annee', annee)
    .order('numero_sequentiel', { ascending: false })
    .limit(1);

  const dernier = data?.[0]?.numero_sequentiel || 0;
  const numero = dernier + 1;
  const reference = `${prefix}-${String(numero).padStart(4, '0')}`;
  return { reference, numero };
}

export async function enregistrerDocument(
  codeType: string,
  reference: string,
  numero: number,
  membreId?: string,
  foyerId?: string,
  snapshot?: any
) {
  await supabase.from('documents_generes').insert({
    reference,
    code_type: codeType,
    membre_id: membreId || null,
    foyer_id: foyerId || null,
    annee: new Date().getFullYear(),
    numero_sequentiel: numero,
    donnees_snapshot: snapshot || null,
  });
}

// ── Helpers PDF ───────────────────────────────────────────────
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
  const words = t.split(' ');
  const lines: string[] = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : ['-'];
}

const C = {
  indigo: rgb(0.31, 0.27, 0.90), dark: rgb(0.07, 0.09, 0.17),
  mid: rgb(0.29, 0.33, 0.43), light: rgb(0.57, 0.63, 0.72),
  bg: rgb(0.97, 0.98, 1.00), white: rgb(1, 1, 1),
  border: rgb(0.88, 0.91, 0.95), red: rgb(0.8, 0.1, 0.1),
  green: rgb(0.09, 0.53, 0.22),
};

function dt(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color: ReturnType<typeof rgb>) {
  page.drawText(clean(text), { x, y, size, font, color });
}

function drawHeader(page: PDFPage, config: ConfigFokontany, bold: PDFFont, reg: PDFFont, W: number, codeDoc: string, nomDoc: string, reference: string) {
  // Bandeau haut
  page.drawRectangle({ x: 0, y: 820, width: W, height: 22, color: C.indigo });
  dt(page, 'REPOBLIKAN\'I MADAGASIKARA', W / 2 - 80, 827, bold, 8, C.white);

  // Logo hexagone simple
  page.drawRectangle({ x: 36, y: 770, width: 50, height: 50, color: C.bg, borderColor: C.indigo, borderWidth: 1.5 });
  dt(page, 'F', 55, 790, bold, 20, C.indigo);

  // Titre principal
  dt(page, `FOKONTANY ${clean(config.nom_fokontany).toUpperCase()}`, 100, 808, bold, 10, C.dark);
  dt(page, `Quartier ${clean(config.nom_quartier)} - Carreau ${clean(config.code_carreau)}`, 100, 795, reg, 8, C.mid);
  dt(page, `Commune de ${clean(config.nom_commune)} - District de ${clean(config.nom_district)}`, 100, 783, reg, 8, C.mid);

  // Référence à droite
  dt(page, 'Ref.:', W - 155, 808, bold, 7, C.mid);
  dt(page, reference, W - 155, 796, bold, 7.5, C.indigo);
  dt(page, `Date: ${new Date().toLocaleDateString('fr-FR')}`, W - 155, 784, reg, 7, C.mid);

  // Titre document
  page.drawRectangle({ x: 36, y: 755, width: W - 72, height: 22, color: C.indigo, borderRadius: 3 });
  dt(page, `[${codeDoc}] ${nomDoc.toUpperCase()}`, W / 2 - (nomDoc.length * 3.5), 762, bold, 10, C.white);
  page.drawLine({ start: { x: 36, y: 752 }, end: { x: W - 36, y: 752 }, thickness: 0.5, color: C.border });
}

function drawField(page: PDFPage, label: string, value: string, x: number, y: number, reg: PDFFont, bold: PDFFont, maxW = 200) {
  dt(page, `${label} :`, x, y, reg, 8, C.mid);
  const lines = wrap(value, Math.floor(maxW / 5.5));
  lines.forEach((l, i) => dt(page, l, x + label.length * 5 + 12, y - i * 10, bold, 9, C.dark));
  return 12 + (lines.length - 1) * 10;
}

function drawBox(page: PDFPage, label: string, value: string, x: number, y: number, w: number, reg: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x, y: y - 20, width: w, height: 24, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 3 });
  dt(page, label.toUpperCase(), x + 4, y + 0, reg, 6, C.light);
  dt(page, clean(value), x + 4, y - 12, bold, 9, C.dark);
}

function drawSignatures(page: PDFPage, config: ConfigFokontany, reg: PDFFont, bold: PDFFont, W: number, y: number) {
  page.drawLine({ start: { x: 36, y: y + 10 }, end: { x: W - 36, y: y + 10 }, thickness: 0.5, color: C.border });
  // Zone signature droite
  const sx = W - 200;
  dt(page, `Ambodisaina, le ${new Date().toLocaleDateString('fr-FR')}`, sx, y, reg, 8, C.mid);
  dt(page, 'Le Chef du Fokontany', sx + 20, y - 12, bold, 8.5, C.dark);
  dt(page, clean(config.chef_fokontany), sx + 20, y - 24, reg, 8, C.mid);
  page.drawLine({ start: { x: sx, y: y - 55 }, end: { x: W - 36, y: y - 55 }, thickness: 0.5, color: C.border });
  dt(page, '(Signature et cachet)', sx + 30, y - 65, reg, 7, C.light);
  // Bas de page
  dt(page, 'Document officiel - Fokontany Local Ledger v2.0', 36, 20, reg, 7, C.light);
}

// ── Générateurs de documents ──────────────────────────────────

// CR - Certificat de Résidence
export async function genererCR(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('CR', config);

  drawHeader(page, config, bold, reg, W, 'CR', 'Certificat de Residence', reference);

  let y = 735;
  // Formule d'intro
  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)}, Quartier ${clean(config.nom_quartier)}, certifie que la personne dont l'identite est mentionnee ci-dessous reside bien dans le ressort du Fokontany.`;
  const introLines = wrap(intro, 95);
  introLines.forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 8;

  // Infos identité
  const age = membre.date_naissance ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970) : null;
  const boxes = [
    { l: 'Nom', v: membre.nom, w: 180 },
    { l: 'Prenom(s)', v: membre.prenom, w: 180 },
    { l: 'Sexe', v: membre.sexe === 'M' ? 'Masculin' : 'Feminin', w: 100 },
    { l: 'Date de naissance', v: membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '-', w: 160 },
    { l: 'Lieu de naissance', v: membre.lieu_naissance || '-', w: 200 },
    { l: 'Numero CIN', v: membre.cin || '-', w: 200 },
    { l: 'Age', v: age ? `${age} ans` : '-', w: 100 },
  ];

  page.drawRectangle({ x: 36, y: y - boxes.length * 28 - 10, width: W - 72, height: boxes.length * 28 + 20, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  boxes.forEach((b, i) => {
    const col = i % 2 === 0 ? 46 : W / 2 + 10;
    const row = y - Math.floor(i / 2) * 30 - 10;
    drawBox(page, b.l, b.v, col, row, b.w, reg, bold);
  });
  y -= Math.ceil(boxes.length / 2) * 30 + 20;

  // Adresse
  y -= 10;
  page.drawRectangle({ x: 36, y: y - 30, width: W - 72, height: 34, color: rgb(0.93, 0.97, 1), borderColor: C.indigo, borderWidth: 0.5, borderRadius: 4 });
  dt(page, 'ADRESSE DE RESIDENCE', 46, y - 2, bold, 7, C.indigo);
  const adresse = [foyer.adresse, foyer.identification_logement ? `LOT ${foyer.identification_logement}${foyer.numero_maison ? '-' + foyer.numero_maison : ''}` : '', `Fokontany ${config.nom_fokontany}`, config.nom_commune].filter(Boolean).join(' - ');
  dt(page, adresse, 46, y - 16, bold, 9, C.dark);
  y -= 44;

  // Code ménage
  y -= 8;
  dt(page, `Code menage : `, 36, y, reg, 9, C.mid);
  dt(page, foyer.code_menage, 120, y, bold, 9, C.indigo);
  y -= 20;

  // Formule finale
  const finale = `En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.`;
  dt(page, finale, 36, y, reg, 9, C.dark);
  y -= 20;

  drawSignatures(page, config, reg, bold, W, y - 20);
  await enregistrerDocument('CR', reference, numero, membre.id, foyer.id, { nom: membre.nom, prenom: membre.prenom, cin: membre.cin });
  return await pdf.save();
}

// CVI - Certificat de Vie Individuelle
export async function genererCVI(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('CVI', config);

  drawHeader(page, config, bold, reg, W, 'CVI', 'Certificat de Vie Individuelle', reference);
  let y = 735;

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} certifie que la personne ci-apres mentionnee est bien en vie et reside dans notre Fokontany a la date de delivrance du present certificat.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 15;

  const age = membre.date_naissance ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970) : null;

  // Grande zone identité avec photo
  page.drawRectangle({ x: 36, y: y - 140, width: W - 72, height: 150, color: C.bg, borderColor: C.border, borderWidth: 1, borderRadius: 5 });

  // Zone photo
  page.drawRectangle({ x: 46, y: y - 130, width: 80, height: 100, color: C.white, borderColor: C.border, borderWidth: 1 });
  dt(page, 'PHOTO', 63, y - 75, reg, 7, C.light);
  dt(page, "D'IDENTITE", 60, y - 87, reg, 7, C.light);

  // Infos à droite de la photo
  const fx = 140;
  dt(page, 'NOM ET PRENOM', fx, y - 20, reg, 7, C.light);
  dt(page, `${membre.nom} ${membre.prenom}`, fx, y - 32, bold, 11, C.dark);
  dt(page, 'DATE ET LIEU DE NAISSANCE', fx, y - 48, reg, 7, C.light);
  dt(page, `${membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '-'} a ${clean(membre.lieu_naissance)}`, fx, y - 60, bold, 9, C.dark);
  dt(page, 'NUMERO CIN', fx, y - 76, reg, 7, C.light);
  dt(page, membre.cin || 'Non disponible', fx, y - 88, bold, 9, C.dark);
  dt(page, 'AGE', fx, y - 104, reg, 7, C.light);
  dt(page, age ? `${age} ans` : '-', fx, y - 116, bold, 9, C.dark);
  dt(page, 'STATUT', W - 200, y - 20, reg, 7, C.light);
  dt(page, membre.statut, W - 200, y - 32, bold, 9, membre.statut === 'Actif' ? C.green : C.mid);
  y -= 160;

  // Adresse
  page.drawRectangle({ x: 36, y: y - 28, width: W - 72, height: 32, color: rgb(0.93, 0.97, 1), borderColor: C.indigo, borderWidth: 0.5, borderRadius: 4 });
  dt(page, 'ADRESSE :', 46, y - 6, reg, 8, C.mid);
  const adresse = [foyer.adresse, `Fokontany ${config.nom_fokontany}`, config.nom_commune].filter(Boolean).join(', ');
  dt(page, adresse, 110, y - 6, bold, 9, C.dark);
  dt(page, `Code menage : ${foyer.code_menage}`, 46, y - 20, reg, 8, C.mid);
  y -= 44;

  dt(page, `En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.`, 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('CVI', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// CVC - Certificat de Vie Collective
export async function genererCVC(foyer: Foyer, membres: Membre[], config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('CVC', config);
  const chef = membres.find(m => m.is_chef);

  drawHeader(page, config, bold, reg, W, 'CVC', 'Certificat de Vie Collective', reference);
  let y = 735;

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} certifie que les personnes ci-apres mentionnees cohabitent ensemble et constituent un menage au sein du Fokontany.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 10;

  // Info chef de ménage
  page.drawRectangle({ x: 36, y: y - 35, width: W - 72, height: 40, color: rgb(0.93, 0.97, 1), borderColor: C.indigo, borderWidth: 1, borderRadius: 4 });
  dt(page, 'CHEF DE MENAGE', 46, y - 4, bold, 7.5, C.indigo);
  dt(page, chef ? `${chef.nom} ${chef.prenom}` : 'Non defini', 46, y - 18, bold, 11, C.dark);
  dt(page, `Code menage : ${foyer.code_menage}`, W - 180, y - 4, reg, 8, C.mid);
  const adresse = [foyer.adresse, `Fkt ${config.nom_fokontany}`].filter(Boolean).join(' - ');
  dt(page, `Adresse : ${adresse}`, 46, y - 30, reg, 8, C.mid);
  y -= 50;

  // Liste membres
  dt(page, 'COMPOSITION DU MENAGE', 36, y, bold, 9, C.indigo);
  y -= 15;

  // En-tête tableau
  const cols = [36, 60, 220, 320, 400, 480];
  page.drawRectangle({ x: 36, y: y - 14, width: W - 72, height: 16, color: C.indigo, borderRadius: 2 });
  ['N°', 'Nom et Prenom', 'Naissance', 'Relation', 'Statut', 'CIN'].forEach((h, i) => {
    dt(page, h, cols[i] + 3, y - 4, bold, 7.5, C.white);
  });
  y -= 16;

  // Lignes membres (chef en premier)
  const membresOrdonnes = [...membres.filter(m => m.is_chef), ...membres.filter(m => !m.is_chef)];
  membresOrdonnes.forEach((m, idx) => {
    const bg = idx % 2 === 0 ? C.bg : C.white;
    page.drawRectangle({ x: 36, y: y - 14, width: W - 72, height: 16, color: bg });
    const dn = m.date_naissance ? new Date(m.date_naissance).toLocaleDateString('fr-FR') : '-';
    [
      String(idx + 1),
      `${m.nom} ${m.prenom}`,
      dn,
      m.relation_chef,
      m.statut,
      m.cin || '-',
    ].forEach((val, i) => {
      dt(page, clean(val), cols[i] + 3, y - 4, idx === 0 ? bold : reg, idx === 0 ? 8 : 7.5, C.dark);
    });
    // Ligne séparatrice
    page.drawLine({ start: { x: 36, y: y - 14 }, end: { x: W - 36, y: y - 14 }, thickness: 0.3, color: C.border });
    y -= 16;
    if (y < 150) { /* TODO: nouvelle page */ }
  });

  page.drawRectangle({ x: 36, y: y - 14, width: W - 72, height: 16, color: rgb(0.93, 0.97, 1) });
  dt(page, `Total : ${membres.length} membre(s)`, 40, y - 4, bold, 8, C.indigo);
  y -= 30;

  dt(page, `En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.`, 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('CVC', reference, numero, chef?.id, foyer.id);
  return await pdf.save();
}

// CEL - Certificat de Célibat
export async function genererCEL(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('CEL', config);

  drawHeader(page, config, bold, reg, W, 'CEL', 'Certificat de Celibat', reference);
  let y = 735;

  const age = membre.date_naissance ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970) : null;
  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} atteste sur l'honneur que la personne dont l'identite figure ci-dessous est celibataire a ce jour et n'est pas engage(e) dans les liens du mariage a notre connaissance.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 15;

  page.drawRectangle({ x: 36, y: y - 120, width: W - 72, height: 130, color: C.bg, borderColor: C.border, borderWidth: 1, borderRadius: 5 });
  const pairs = [
    ['Nom', membre.nom], ['Prenom(s)', membre.prenom],
    ['Date de naissance', membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '-'],
    ['Lieu de naissance', membre.lieu_naissance || '-'],
    ['Age', age ? `${age} ans` : '-'],
    ['Numero CIN', membre.cin || 'Non disponible'],
    ['Adresse', foyer.adresse || '-'],
    ['Fokontany', config.nom_fokontany],
  ];
  pairs.forEach(([l, v], i) => {
    const col = i % 2 === 0 ? 46 : W / 2 + 10;
    const row = y - Math.floor(i / 2) * 28 - 12;
    drawBox(page, l, v, col, row, 220, reg, bold);
  });
  y -= 140;

  dt(page, `En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.`, 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('CEL', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// BC - Certificat de Bonne Conduite
export async function genererBC(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('BC', config);

  drawHeader(page, config, bold, reg, W, 'BC', 'Certificat de Bonne Conduite', reference);
  let y = 735;

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} atteste que la personne dont l'identite figure ci-dessous est connue dans notre Fokontany comme une personne de bonne vie et moeurs, et n'a fait l'objet d'aucune plainte portee a notre connaissance.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 15;

  page.drawRectangle({ x: 36, y: y - 110, width: W - 72, height: 120, color: C.bg, borderColor: C.border, borderWidth: 1, borderRadius: 5 });
  const pairs = [
    ['Nom', membre.nom], ['Prenom(s)', membre.prenom],
    ['Date de naissance', membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '-'],
    ['Lieu de naissance', membre.lieu_naissance || '-'],
    ['Numero CIN', membre.cin || 'Non disponible'],
    ['Adresse', foyer.adresse || '-'],
  ];
  pairs.forEach(([l, v], i) => {
    const col = i % 2 === 0 ? 46 : W / 2 + 10;
    const row = y - Math.floor(i / 2) * 28 - 12;
    drawBox(page, l, v, col, row, 220, reg, bold);
  });
  y -= 130;

  dt(page, `En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.`, 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('BC', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// CM - Composition du Ménage
export async function genererCM(foyer: Foyer, membres: Membre[], config: ConfigFokontany): Promise<Uint8Array> {
  return genererCVC(foyer, membres, config); // Même structure, code différent
}

// FM - Fiche Ménage complète
export async function genererFM(foyer: Foyer, membres: Membre[], config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('FM', config);
  const chef = membres.find(m => m.is_chef);

  drawHeader(page, config, bold, reg, W, 'FM', 'Fiche Menage Complete', reference);
  let y = 735;
  const col = (W - 72) / 3;

  // Identité foyer
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, '1. IDENTIFICATION DU FOYER', 46, y - 4, bold, 8, C.white);
  y -= 22;
  const idBoxes = [
    { l: 'Code menage', v: foyer.code_menage },
    { l: 'Fokontany', v: config.nom_fokontany },
    { l: 'Statut', v: foyer.statut },
    { l: 'Adresse', v: foyer.adresse || '-' },
    { l: 'LOT / Identification', v: foyer.identification_logement ? `LOT ${foyer.identification_logement}${foyer.numero_maison ? '-' + foyer.numero_maison : ''}` : '-' },
    { l: 'Chef de menage', v: chef ? `${chef.nom} ${chef.prenom}` : '-' },
  ];
  idBoxes.forEach((b, i) => {
    drawBox(page, b.l, b.v, 36 + (i % 3) * col + 4, y - Math.floor(i / 3) * 28 - 4, col - 8, reg, bold);
  });
  y -= Math.ceil(idBoxes.length / 3) * 28 + 12;

  // Logement
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, '2. CARACTERISTIQUES DU LOGEMENT', 46, y - 4, bold, 8, C.white);
  y -= 22;
  const logBoxes = [
    { l: 'Type logement', v: foyer.type_logement || '-' },
    { l: 'Pieces', v: foyer.nombre_pieces?.toString() || '-' },
    { l: 'Superficie', v: foyer.superficie_maison ? `${foyer.superficie_maison} m2` : '-' },
    { l: 'Toiture', v: (foyer.materiaux_toiture || [foyer.materiau_toiture]).filter(Boolean).join(', ') || '-' },
    { l: 'Mur', v: (foyer.materiaux_mur || [foyer.materiau_mur]).filter(Boolean).join(', ') || '-' },
    { l: 'Statut occupant', v: foyer.statut_occupant || '-' },
  ];
  logBoxes.forEach((b, i) => {
    drawBox(page, b.l, b.v, 36 + (i % 3) * col + 4, y - Math.floor(i / 3) * 28 - 4, col - 8, reg, bold);
  });
  y -= Math.ceil(logBoxes.length / 3) * 28 + 12;

  // Membres
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, `3. MEMBRES DU MENAGE (${membres.length})`, 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 14, width: W - 72, height: 16, color: rgb(0.93, 0.97, 1) });
  const hcols = [40, 60, 215, 310, 380, 450];
  ['N°', 'Nom et Prenom', 'Naissance', 'Relation', 'Statut', 'Profession'].forEach((h, i) => dt(page, h, hcols[i], y - 4, bold, 7, C.indigo));
  y -= 16;
  const membresOrdonnes = [...membres.filter(m => m.is_chef), ...membres.filter(m => !m.is_chef)];
  membresOrdonnes.forEach((m, idx) => {
    page.drawRectangle({ x: 36, y: y - 13, width: W - 72, height: 14, color: idx % 2 === 0 ? C.bg : C.white });
    [String(idx + 1), `${m.nom} ${m.prenom}`, m.date_naissance ? new Date(m.date_naissance).toLocaleDateString('fr-FR') : '-', m.relation_chef, m.statut, m.profession || '-']
      .forEach((v, i) => dt(page, clean(v), hcols[i], y - 4, idx === 0 ? bold : reg, 7.5, C.dark));
    page.drawLine({ start: { x: 36, y: y - 13 }, end: { x: W - 36, y: y - 13 }, thickness: 0.3, color: C.border });
    y -= 14;
  });
  y -= 10;

  // Eau & Assainissement résumé
  if (y > 150) {
    page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
    dt(page, '4. CONDITIONS DE VIE', 46, y - 4, bold, 8, C.white);
    y -= 22;
    const condBoxes = [
      { l: 'Source eau', v: foyer.eau_source || '-' },
      { l: 'Eau potable', v: foyer.eau_potable === true ? 'Oui' : foyer.eau_potable === false ? 'Non' : '-' },
      { l: 'Electricite', v: foyer.a_electricite === true ? 'Oui' : 'Non' },
      { l: 'Toilette', v: foyer.toilette_type || '-' },
      { l: 'Dechets', v: foyer.dechets_mode || '-' },
      { l: 'Internet', v: foyer.acces_internet === true ? 'Oui' : 'Non' },
    ];
    condBoxes.forEach((b, i) => {
      drawBox(page, b.l, b.v, 36 + (i % 3) * col + 4, y - Math.floor(i / 3) * 28 - 4, col - 8, reg, bold);
    });
    y -= Math.ceil(condBoxes.length / 3) * 28 + 10;
  }

  if (y > 120) drawSignatures(page, config, reg, bold, W, y - 20);
  await enregistrerDocument('FM', reference, numero, chef?.id, foyer.id);
  return await pdf.save();
}

// FFD - Déclaration de décès
export async function genererFFD(membre: Membre, foyer: Foyer, config: ConfigFokontany, datesDeces?: string, lieuDeces?: string, declarant?: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('FFD', config);

  drawHeader(page, config, bold, reg, W, 'FFD', 'Fanambarana Fahafatesana - Declaration de Deces', reference);
  let y = 720;

  // Alerte décès
  page.drawRectangle({ x: 36, y: y - 16, width: W - 72, height: 20, color: rgb(0.95, 0.95, 0.95), borderColor: C.mid, borderWidth: 0.5, borderRadius: 3 });
  dt(page, 'DECLARATION OFFICIELLE DE DECES', W / 2 - 80, y - 3, bold, 9, C.dark);
  y -= 30;

  const intro = `Nous soussigne Chef du Fokontany ${clean(config.nom_fokontany)} declarons avoir enregistre le deces de la personne dont l'identite figure ci-dessous.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 10;

  const age = membre.date_naissance ? Math.abs(new Date(Date.now() - new Date(membre.date_naissance).getTime()).getUTCFullYear() - 1970) : null;
  const boxes = [
    ['Nom du defunt', membre.nom], ['Prenom(s)', membre.prenom],
    ['Date de naissance', membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '-'],
    ['Lieu de naissance', membre.lieu_naissance || '-'],
    ['Age au deces', age ? `${age} ans` : '-'],
    ['CIN', membre.cin || '-'],
    ['Adresse', foyer.adresse || '-'],
    ['Date du deces', datesDeces || 'A preciser'],
    ['Lieu du deces', lieuDeces || 'A preciser'],
    ['Declarant', declarant || 'A preciser'],
  ];
  page.drawRectangle({ x: 36, y: y - 160, width: W - 72, height: 170, color: C.bg, borderColor: C.border, borderWidth: 1, borderRadius: 4 });
  boxes.forEach(([l, v], i) => {
    const col = i % 2 === 0 ? 46 : W / 2 + 10;
    const row = y - Math.floor(i / 2) * 30 - 12;
    drawBox(page, l, v, col, row, 220, reg, bold);
  });
  y -= 175;

  dt(page, `En foi de quoi, la presente declaration est etablie pour servir et valoir ce que de droit.`, 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('FFD', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// FAS - Attestation de travail
export async function genererFAS(membre: Membre, foyer: Foyer, config: ConfigFokontany): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('FAS', config);

  drawHeader(page, config, bold, reg, W, 'FAS', 'Fanamarinana Asa - Attestation de Travail', reference);
  let y = 735;

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} atteste que la personne dont l'identite figure ci-dessous exerce une activite professionnelle dans notre Fokontany.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 15;

  const boxes = [
    ['Nom', membre.nom], ['Prenom(s)', membre.prenom],
    ['Date de naissance', membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '-'],
    ['CIN', membre.cin || '-'],
    ['Profession / Activite', membre.profession || '-'],
    ['Statut professionnel', membre.statut_professionnel || '-'],
    ['Employeur', membre.employeur || '-'],
    ['Adresse activite', foyer.adresse || '-'],
  ];
  page.drawRectangle({ x: 36, y: y - 130, width: W - 72, height: 140, color: C.bg, borderColor: C.border, borderWidth: 1, borderRadius: 4 });
  boxes.forEach(([l, v], i) => {
    const col = i % 2 === 0 ? 46 : W / 2 + 10;
    const row = y - Math.floor(i / 2) * 30 - 12;
    drawBox(page, l, v, col, row, 220, reg, bold);
  });
  y -= 145;

  dt(page, `En foi de quoi, la presente attestation est delivree pour servir et valoir ce que de droit.`, 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('FAS', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// PCG - Prise en charge et garde
export async function genererPCG(membre: Membre, foyer: Foyer, config: ConfigFokontany, responsable?: Membre): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('PCG', config);

  drawHeader(page, config, bold, reg, W, 'PCG', 'Prise en Charge et Garde', reference);
  let y = 720;

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} atteste que la personne designee ci-dessous est prise en charge et placee sous la garde du responsable mentionne dans le present document.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 10;

  // Personne prise en charge
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'PERSONNE PRISE EN CHARGE', 46, y - 4, bold, 8, C.white);
  y -= 22;
  const pcBoxes = [
    ['Nom', membre.nom], ['Prenom(s)', membre.prenom],
    ['Date de naissance', membre.date_naissance ? new Date(membre.date_naissance).toLocaleDateString('fr-FR') : '-'],
    ['CIN', membre.cin || 'N/A'], ['Adresse', foyer.adresse || '-'], ['Relation', membre.relation_chef],
  ];
  page.drawRectangle({ x: 36, y: y - 100, width: W - 72, height: 110, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  pcBoxes.forEach(([l, v], i) => {
    drawBox(page, l, v, 36 + (i % 2 === 0 ? 4 : (W - 72) / 2 + 4), y - Math.floor(i / 2) * 30 - 12, (W - 80) / 2, reg, bold);
  });
  y -= 115;

  // Responsable
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'RESPONSABLE / GARDIEN', 46, y - 4, bold, 8, C.white);
  y -= 22;
  if (responsable) {
    const respBoxes = [
      ['Nom', responsable.nom], ['Prenom(s)', responsable.prenom],
      ['CIN', responsable.cin || '-'], ['Telephone', responsable.telephone || '-'],
      ['Lien de parente', responsable.relation_chef], ['Adresse', foyer.adresse || '-'],
    ];
    page.drawRectangle({ x: 36, y: y - 100, width: W - 72, height: 110, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
    respBoxes.forEach(([l, v], i) => {
      drawBox(page, l, v, 36 + (i % 2 === 0 ? 4 : (W - 72) / 2 + 4), y - Math.floor(i / 2) * 30 - 12, (W - 80) / 2, reg, bold);
    });
    y -= 115;
  } else {
    page.drawRectangle({ x: 36, y: y - 60, width: W - 72, height: 65, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
    dt(page, 'Responsable a definir', 46, y - 30, reg, 9, C.light);
    y -= 70;
  }

  dt(page, `En foi de quoi, le present acte est delivre pour servir et valoir ce que de droit.`, 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('PCG', reference, numero, membre.id, foyer.id);
  return await pdf.save();
}

// Télécharger le PDF
export async function telechargerPDF(bytes: Uint8Array, nomFichier: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

export const DOCUMENTS_ADMIN = [
  { code: 'CR', nom: 'Certificat de Résidence', description: 'Atteste la résidence d\'une personne', icon: '🏠', niveau: 'membre' },
  { code: 'CVI', nom: 'Certificat de Vie Individuelle', description: 'Atteste qu\'une personne est en vie', icon: '✅', niveau: 'membre' },
  { code: 'CVC', nom: 'Certificat de Vie Collective', description: 'Atteste qu\'un ménage vit ensemble', icon: '👨‍👩‍👧‍👦', niveau: 'foyer' },
  { code: 'CEL', nom: 'Certificat de Célibat', description: 'Atteste le célibat d\'une personne', icon: '💍', niveau: 'membre' },
  { code: 'BC', nom: 'Certificat de Bonne Conduite', description: 'Atteste la bonne moralité', icon: '⭐', niveau: 'membre' },
  { code: 'CM', nom: 'Composition du Ménage', description: 'Liste officielle des membres du ménage', icon: '📋', niveau: 'foyer' },
  { code: 'FM', nom: 'Fiche Ménage', description: 'Fiche détaillée complète du ménage', icon: '📄', niveau: 'foyer' },
  { code: 'FFD', nom: 'Déclaration de Décès', description: 'Fanambarana Fahafatesana', icon: '🕊️', niveau: 'membre' },
  { code: 'FAS', nom: 'Attestation de Travail', description: 'Fanamarinana Asa', icon: '💼', niveau: 'membre' },
  { code: 'PCG', nom: 'Prise en Charge et Garde', description: 'Atteste la garde d\'une personne', icon: '🤝', niveau: 'membre' },
] as const;

// ═══════════════════════════════════════════════════════════
// DOCUMENTS FONCIERS — Phase 2
// ═══════════════════════════════════════════════════════════

import type { Parcelle, Batiment, TitulaireFoncier, Detenteur, MiseEnValeur } from '../types';

// COT — Certificat d'Occupation de Terrain
export async function genererCOT(
  parcelle: Parcelle, detenteur: Detenteur, config: ConfigFokontany,
  anciennete?: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('COT', config);

  drawHeader(page, config, bold, reg, W, 'COT', 'Certificat d\'Occupation de Terrain', reference);
  let y = 730;

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} certifie que la personne designee ci-dessous occupe le terrain dont les caracteristiques sont mentionnees dans le present certificat.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 10;

  // Terrain
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'CARACTERISTIQUES DU TERRAIN', 46, y - 4, bold, 8, C.white);
  y -= 22;
  const col = (W - 80) / 3;
  const tBoxes = [
    { l: 'Numero de lot', v: parcelle.numero_lot },
    { l: 'Superficie', v: parcelle.superficie_m2 ? `${parcelle.superficie_m2} m2` : '-' },
    { l: 'Usage', v: parcelle.usage || '-' },
    { l: 'Adresse', v: parcelle.adresse || '-' },
    { l: 'Fokontany', v: parcelle.fokontany || config.nom_fokontany },
    { l: 'GPS', v: parcelle.gps_lat ? `${parcelle.gps_lat?.toFixed(4)}, ${parcelle.gps_lng?.toFixed(4)}` : '-' },
  ];
  page.drawRectangle({ x: 36, y: y - 75, width: W - 72, height: 80, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  tBoxes.forEach((b, i) => {
    drawBox(page, b.l, b.v, 36 + (i % 3) * col + 4, y - Math.floor(i / 3) * 32 - 8, col - 8, reg, bold);
  });
  y -= 90;

  // Occupant
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'OCCUPANT RECONNU', 46, y - 4, bold, 8, C.white);
  y -= 22;
  const oBoxes = [
    { l: 'Nom', v: detenteur.nom || '-' }, { l: 'Prenom', v: detenteur.prenom || '-' },
    { l: 'CIN', v: detenteur.cin || '-' }, { l: 'Telephone', v: detenteur.telephone || '-' },
    { l: 'Type de detention', v: detenteur.type_detention },
    { l: 'Anciennete', v: anciennete || (detenteur.date_debut_occupation ? `Depuis ${new Date(detenteur.date_debut_occupation).toLocaleDateString('fr-FR')}` : '-') },
  ];
  page.drawRectangle({ x: 36, y: y - 75, width: W - 72, height: 80, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  oBoxes.forEach((b, i) => {
    drawBox(page, b.l, b.v, 36 + (i % 3) * col + 4, y - Math.floor(i / 3) * 32 - 8, col - 8, reg, bold);
  });
  y -= 90;

  dt(page, 'En foi de quoi, le present certificat est delivre pour servir et valoir ce que de droit.', 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('COT', reference, numero, undefined, undefined, { lot: parcelle.numero_lot });
  return await pdf.save();
}

// JOR — JOROLAVA
export async function genererJOR(
  parcelle: Parcelle, detenteur: Detenteur, config: ConfigFokontany
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('JOR', config);

  drawHeader(page, config, bold, reg, W, 'JOR', 'JOROLAVA - Reconnaissance Locale d\'Occupation', reference);
  let y = 720;

  // Bandeau officiel JOROLAVA
  page.drawRectangle({ x: 36, y: y - 20, width: W - 72, height: 24, color: rgb(0.95, 0.90, 0.75), borderColor: rgb(0.7, 0.5, 0.1), borderWidth: 1, borderRadius: 3 });
  dt(page, 'JOROLAVA - Document de reconnaissance locale d\'occupation et de detention fonciere', 46, y - 4, bold, 8, rgb(0.5, 0.3, 0.0));
  dt(page, 'Ce document ne constitue pas un titre de propriete mais une reconnaissance locale.', 46, y - 14, reg, 7, rgb(0.6, 0.4, 0.1));
  y -= 34;

  const intro = `Nous, Chef du Fokontany ${clean(config.nom_fokontany)}, reconnaissons par le present document que la personne ci-dessous est reconnue localement comme detenteur du terrain identifie dans le present acte.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 10;

  const col = (W - 80) / 2;

  // Terrain
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, '1. IDENTIFICATION DU TERRAIN', 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 70, width: W - 72, height: 75, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  [
    { l: 'Numero de lot', v: parcelle.numero_lot },
    { l: 'Superficie', v: parcelle.superficie_m2 ? `${parcelle.superficie_m2} m2` : '-' },
    { l: 'Adresse', v: parcelle.adresse || '-' },
    { l: 'Usage', v: parcelle.usage || '-' },
  ].forEach((b, i) => drawBox(page, b.l, b.v, 36 + (i % 2) * col + 4, y - Math.floor(i / 2) * 32 - 8, col - 8, reg, bold));
  y -= 85;

  // Détenteur
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, '2. DETENTEUR RECONNU', 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 100, width: W - 72, height: 105, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  [
    { l: 'Nom', v: detenteur.nom || '-' }, { l: 'Prenom', v: detenteur.prenom || '-' },
    { l: 'CIN', v: detenteur.cin || '-' }, { l: 'Telephone', v: detenteur.telephone || '-' },
    { l: 'Type de detention', v: detenteur.type_detention },
    { l: 'Document detenu', v: detenteur.document_detenu || '-' },
  ].forEach((b, i) => drawBox(page, b.l, b.v, 36 + (i % 2) * col + 4, y - Math.floor(i / 2) * 32 - 8, col - 8, reg, bold));
  y -= 115;

  // Ancienneté
  if (detenteur.date_debut_occupation) {
    page.drawRectangle({ x: 36, y: y - 28, width: W - 72, height: 32, color: rgb(0.95, 0.90, 0.75), borderColor: rgb(0.7, 0.5, 0.1), borderWidth: 0.5, borderRadius: 4 });
    dt(page, 'ANCIENNETE D\'OCCUPATION :', 46, y - 8, bold, 8.5, rgb(0.5, 0.3, 0.0));
    dt(page, `Depuis le ${new Date(detenteur.date_debut_occupation).toLocaleDateString('fr-FR')}`, 220, y - 8, bold, 10, C.dark);
    y -= 42;
  }

  if (detenteur.notes) {
    const noteLines = wrap(detenteur.notes, 90);
    dt(page, 'Observations :', 36, y - 2, bold, 8, C.mid);
    y -= 13;
    noteLines.forEach(l => { dt(page, l, 36, y, reg, 8.5, C.dark); y -= 12; });
    y -= 5;
  }

  dt(page, 'En foi de quoi, le present JOROLAVA est delivre pour servir et valoir ce que de droit.', 36, y - 10, reg, 9, C.dark);
  y -= 20;
  dt(page, 'Ce document est valable dans les limites du Fokontany et ne peut se substituer a un titre foncier officiel.', 36, y - 5, reg, 7.5, C.light);
  drawSignatures(page, config, reg, bold, W, y - 35);
  await enregistrerDocument('JOR', reference, numero, undefined, undefined, { lot: parcelle.numero_lot });
  return await pdf.save();
}

// ADF — Attestation de Détention Foncière
export async function genererADF(
  parcelle: Parcelle, detenteur: Detenteur, config: ConfigFokontany
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('ADF', config);

  drawHeader(page, config, bold, reg, W, 'ADF', 'Attestation de Detention Fonciere', reference);
  let y = 730;
  const col = (W - 80) / 2;

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} atteste par le present document que la personne ci-dessous est reconnue comme detenteur du terrain identifie, en vertu des documents en sa possession et de la reconnaissance locale.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 10;

  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'TERRAIN CONCERNE', 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 70, width: W - 72, height: 75, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  [
    { l: 'Lot', v: parcelle.numero_lot }, { l: 'Superficie', v: parcelle.superficie_m2 ? `${parcelle.superficie_m2} m2` : '-' },
    { l: 'Adresse', v: parcelle.adresse || '-' }, { l: 'Titre foncier', v: parcelle.titre_foncier || 'Non titre' },
  ].forEach((b, i) => drawBox(page, b.l, b.v, 36 + (i % 2) * col + 4, y - Math.floor(i / 2) * 32 - 8, col - 8, reg, bold));
  y -= 85;

  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'DETENTEUR RECONNU', 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 100, width: W - 72, height: 105, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  [
    { l: 'Nom', v: detenteur.nom || '-' }, { l: 'Prenom', v: detenteur.prenom || '-' },
    { l: 'CIN', v: detenteur.cin || '-' }, { l: 'Telephone', v: detenteur.telephone || '-' },
    { l: 'Qualite', v: detenteur.type_detention }, { l: 'Document detenu', v: detenteur.document_detenu || '-' },
  ].forEach((b, i) => drawBox(page, b.l, b.v, 36 + (i % 2) * col + 4, y - Math.floor(i / 2) * 32 - 8, col - 8, reg, bold));
  y -= 115;

  dt(page, 'En foi de quoi, la presente attestation est delivree pour servir et valoir ce que de droit.', 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('ADF', reference, numero);
  return await pdf.save();
}

// APB — Attestation de Propriété de Bâtiment
export async function genererAPB(
  parcelle: Parcelle, batiment: Batiment, proprietaire: { nom?: string; prenom?: string; cin?: string; telephone?: string; lien?: string },
  config: ConfigFokontany
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('APB', config);

  drawHeader(page, config, bold, reg, W, 'APB', 'Attestation de Propriete de Batiment', reference);
  let y = 730;
  const col = (W - 80) / 2;

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} atteste que la personne ci-dessous est reconnue comme proprietaire declare du batiment dont les caracteristiques sont mentionnees.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 10;

  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'BATIMENT CONCERNE', 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 85, width: W - 72, height: 90, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  [
    { l: 'Reference batiment', v: batiment.reference_batiment },
    { l: 'Type', v: batiment.type_batiment },
    { l: 'Etat', v: batiment.etat },
    { l: 'Superficie', v: batiment.superficie_m2 ? `${batiment.superficie_m2} m2` : '-' },
    { l: 'Lot parcelle', v: parcelle.numero_lot },
    { l: 'Adresse', v: parcelle.adresse || '-' },
  ].forEach((b, i) => drawBox(page, b.l, b.v, 36 + (i % 2) * col + 4, y - Math.floor(i / 2) * 32 - 8, col - 8, reg, bold));
  y -= 100;

  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'PROPRIETAIRE DECLARE', 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 85, width: W - 72, height: 90, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  [
    { l: 'Nom', v: proprietaire.nom || '-' }, { l: 'Prenom', v: proprietaire.prenom || '-' },
    { l: 'CIN', v: proprietaire.cin || '-' }, { l: 'Telephone', v: proprietaire.telephone || '-' },
    { l: 'Lien avec parcelle', v: proprietaire.lien || '-' },
  ].forEach((b, i) => drawBox(page, b.l, b.v, 36 + (i % 2) * col + 4, y - Math.floor(i / 2) * 32 - 8, col - 8, reg, bold));
  y -= 100;

  page.drawRectangle({ x: 36, y: y - 22, width: W - 72, height: 26, color: rgb(0.97, 0.97, 0.75), borderColor: rgb(0.7, 0.7, 0.1), borderWidth: 0.5, borderRadius: 3 });
  dt(page, 'Note : Ce document atteste la propriete declaree du batiment et non du terrain sous-jacent.', 46, y - 5, reg, 8, rgb(0.5, 0.5, 0.0));
  dt(page, 'La propriete fonciere peut appartenir a une personne differente.', 46, y - 16, reg, 7.5, rgb(0.5, 0.5, 0.0));
  y -= 32;

  dt(page, 'En foi de quoi, la presente attestation est delivree pour servir et valoir ce que de droit.', 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('APB', reference, numero);
  return await pdf.save();
}

// AMV — Attestation de Mise en Valeur
export async function genererAMV(
  parcelle: Parcelle, valeur: MiseEnValeur, detenteur: Detenteur, config: ConfigFokontany
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('AMV', config);

  drawHeader(page, config, bold, reg, W, 'AMV', 'Attestation de Mise en Valeur - Taratasy Fanamaintisa-Momaly', reference);
  let y = 710;

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} atteste que le terrain identifie ci-dessous a fait l'objet d'investissements et de mises en valeur par son detenteur reconnu.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 10;

  // Parcelle
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'TERRAIN', 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 40, width: W - 72, height: 45, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  drawBox(page, 'Lot', parcelle.numero_lot, 46, y - 8, 120, reg, bold);
  drawBox(page, 'Superficie', parcelle.superficie_m2 ? `${parcelle.superficie_m2} m2` : '-', 200, y - 8, 120, reg, bold);
  drawBox(page, 'Adresse', parcelle.adresse || '-', 350, y - 8, 195, reg, bold);
  y -= 55;

  // Détenteur
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'DETENTEUR / INVESTISSEUR', 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 40, width: W - 72, height: 45, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  drawBox(page, 'Nom et Prenom', `${detenteur.nom || '-'} ${detenteur.prenom || ''}`, 46, y - 8, 220, reg, bold);
  drawBox(page, 'CIN', detenteur.cin || '-', 300, y - 8, 140, reg, bold);
  drawBox(page, 'Depuis', detenteur.date_debut_occupation ? new Date(detenteur.date_debut_occupation).toLocaleDateString('fr-FR') : '-', 470, y - 8, 80, reg, bold);
  y -= 55;

  // Investissements
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, 'ELEMENTS DE MISE EN VALEUR CONSTATES', 46, y - 4, bold, 8, C.white);
  y -= 22;

  const elements = [
    { k: 'maison', l: 'Maison / Batiment', icon: '🏠' },
    { k: 'cloture', l: 'Cloture', icon: '🧱' },
    { k: 'cultures', l: 'Cultures / Agriculture', icon: '🌾' },
    { k: 'elevage', l: 'Elevage', icon: '🐄' },
    { k: 'eau', l: 'Installation eau', icon: '💧' },
    { k: 'electricite', l: 'Installation electrique', icon: '⚡' },
    { k: 'commerce', l: 'Activite commerciale', icon: '🏪' },
  ];

  const eW = (W - 80) / 2;
  elements.forEach((el, i) => {
    const present = !!(valeur as any)[el.k];
    const ex = 36 + (i % 2) * eW + 4;
    const ey = y - Math.floor(i / 2) * 22 - 8;
    page.drawRectangle({ x: ex, y: ey - 14, width: eW - 8, height: 16, color: present ? C.greenBg : rgb(0.97, 0.97, 0.97), borderColor: present ? C.green : C.border, borderWidth: 0.5, borderRadius: 2 });
    dt(page, `${present ? '[OUI]' : '[NON]'}  ${el.l}`, ex + 6, ey - 4, present ? bold : reg, 8, present ? C.green : C.light);
  });
  y -= Math.ceil(elements.length / 2) * 22 + 12;

  if (valeur.annee_debut) {
    page.drawRectangle({ x: 36, y: y - 20, width: W - 72, height: 24, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 3 });
    dt(page, `Debut des mises en valeur : ${valeur.annee_debut}`, 46, y - 6, bold, 9, C.dark);
    y -= 30;
  }
  if (valeur.description) {
    wrap(valeur.description, 95).forEach(l => { dt(page, l, 36, y, reg, 8.5, C.dark); y -= 12; });
    y -= 5;
  }

  dt(page, 'En foi de quoi, la presente attestation est delivree pour servir et valoir ce que de droit.', 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('AMV', reference, numero);
  return await pdf.save();
}

// FP — Fiche Parcellaire
export async function genererFP(
  parcelle: Parcelle, titulaire: TitulaireFoncier | null, detenteur: Detenteur | null,
  batiments: Batiment[], valeur: MiseEnValeur | null, config: ConfigFokontany
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('FP', config);
  const col = (W - 80) / 3;

  drawHeader(page, config, bold, reg, W, 'FP', 'Fiche Parcellaire Complete', reference);
  let y = 725;

  // Parcelle
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, '1. IDENTIFICATION DE LA PARCELLE', 46, y - 4, bold, 8, C.white);
  y -= 22;
  const pBoxes = [
    { l: 'Numero de lot', v: parcelle.numero_lot },
    { l: 'Titre foncier', v: parcelle.titre_foncier || 'Non titre' },
    { l: 'Cadastre', v: parcelle.cadastre_ref || '-' },
    { l: 'Superficie', v: parcelle.superficie_m2 ? `${parcelle.superficie_m2} m2` : '-' },
    { l: 'Usage', v: parcelle.usage || '-' },
    { l: 'Fokontany', v: parcelle.fokontany || config.nom_fokontany },
  ];
  page.drawRectangle({ x: 36, y: y - 70, width: W - 72, height: 75, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  pBoxes.forEach((b, i) => drawBox(page, b.l, b.v, 36 + (i % 3) * col + 4, y - Math.floor(i / 3) * 32 - 8, col - 8, reg, bold));
  y -= 85;
  if (parcelle.adresse) { dt(page, `Adresse : ${clean(parcelle.adresse)}`, 46, y, reg, 8.5, C.dark); y -= 15; }
  if (parcelle.gps_lat) { dt(page, `GPS : ${parcelle.gps_lat?.toFixed(5)}, ${parcelle.gps_lng?.toFixed(5)}`, 46, y, reg, 8.5, C.mid); y -= 15; }

  // Titulaire
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: rgb(0.6, 0.5, 0.1), borderRadius: 2 });
  dt(page, '2. TITULAIRE FONCIER', 46, y - 4, bold, 8, C.white);
  y -= 22;
  if (titulaire) {
    page.drawRectangle({ x: 36, y: y - 40, width: W - 72, height: 45, color: rgb(1, 0.98, 0.92), borderColor: rgb(0.8, 0.6, 0.1), borderWidth: 0.5, borderRadius: 4 });
    drawBox(page, 'Type', titulaire.type_titulaire, 46, y - 8, 140, reg, bold);
    drawBox(page, 'Nom', `${titulaire.nom || '-'} ${titulaire.prenom || ''}`, 210, y - 8, 180, reg, bold);
    drawBox(page, 'CIN', titulaire.cin || '-', 415, y - 8, 140, reg, bold);
  } else {
    dt(page, 'Titulaire non renseigne', 46, y - 15, reg, 8.5, C.light);
  }
  y -= 55;

  // Détenteur
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, '3. DETENTEUR JOROLAVA', 46, y - 4, bold, 8, C.white);
  y -= 22;
  if (detenteur) {
    page.drawRectangle({ x: 36, y: y - 40, width: W - 72, height: 45, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
    drawBox(page, 'Qualite', detenteur.type_detention, 46, y - 8, 140, reg, bold);
    drawBox(page, 'Nom', `${detenteur.nom || '-'} ${detenteur.prenom || ''}`, 210, y - 8, 180, reg, bold);
    drawBox(page, 'CIN', detenteur.cin || '-', 415, y - 8, 140, reg, bold);
  } else {
    dt(page, 'Detenteur non renseigne', 46, y - 15, reg, 8.5, C.light);
  }
  y -= 55;

  // Bâtiments
  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, `4. BATIMENTS (${batiments.length})`, 46, y - 4, bold, 8, C.white);
  y -= 22;
  if (batiments.length > 0) {
    page.drawRectangle({ x: 36, y: y - 14, width: W - 72, height: 16, color: rgb(0.93, 0.96, 1) });
    ['Reference', 'Type', 'Etat', 'Superficie', 'Niveaux', 'Construction'].forEach((h, i) => {
      dt(page, h, [40, 105, 200, 270, 345, 415][i], y - 4, bold, 7, C.indigo);
    });
    y -= 16;
    batiments.forEach((b, idx) => {
      page.drawRectangle({ x: 36, y: y - 13, width: W - 72, height: 14, color: idx % 2 === 0 ? C.bg : C.white });
      [b.reference_batiment, b.type_batiment, b.etat, b.superficie_m2 ? `${b.superficie_m2}m2` : '-', String(b.nombre_niveaux || 1), String(b.annee_construction || '-')]
        .forEach((v, i) => dt(page, clean(v), [40, 105, 200, 270, 345, 415][i], y - 4, reg, 7.5, C.dark));
      y -= 14;
    });
  } else { dt(page, 'Aucun batiment enregistre', 46, y - 12, reg, 8.5, C.light); }
  y -= 15;

  // Mise en valeur
  if (valeur) {
    page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
    dt(page, '5. MISE EN VALEUR', 46, y - 4, bold, 8, C.white);
    y -= 22;
    const elems = ['maison', 'cloture', 'cultures', 'elevage', 'eau', 'electricite', 'commerce'];
    page.drawRectangle({ x: 36, y: y - 20, width: W - 72, height: 24, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
    let vx = 46;
    elems.forEach(k => {
      const ok = !!(valeur as any)[k];
      dt(page, ok ? `[OK] ${k}` : `[-] ${k}`, vx, y - 6, ok ? bold : reg, 7.5, ok ? C.green : C.light);
      vx += 70;
    });
    y -= 30;
  }

  drawSignatures(page, config, reg, bold, W, y - 15);
  await enregistrerDocument('FP', reference, numero);
  return await pdf.save();
}

// FB — Fiche Bâtiment
export async function genererFB(
  parcelle: Parcelle, batiment: Batiment, config: ConfigFokontany
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('FB', config);
  const col = (W - 80) / 2;

  drawHeader(page, config, bold, reg, W, 'FB', 'Fiche Batiment Complete', reference);
  let y = 725;

  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, '1. IDENTIFICATION DU BATIMENT', 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 100, width: W - 72, height: 105, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  [
    { l: 'Reference', v: batiment.reference_batiment }, { l: 'Type', v: batiment.type_batiment },
    { l: 'Etat', v: batiment.etat }, { l: 'Superficie', v: batiment.superficie_m2 ? `${batiment.superficie_m2} m2` : '-' },
    { l: 'Niveaux', v: String(batiment.nombre_niveaux || 1) }, { l: 'Annee construction', v: String(batiment.annee_construction || '-') },
    { l: 'Materiaux mur', v: batiment.materiaux_mur || '-' }, { l: 'Materiaux toiture', v: batiment.materiaux_toiture || '-' },
  ].forEach((b, i) => drawBox(page, b.l, b.v, 36 + (i % 2) * col + 4, y - Math.floor(i / 2) * 26 - 8, col - 8, reg, bold));
  y -= 115;

  page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
  dt(page, '2. PARCELLE SUPPORT', 46, y - 4, bold, 8, C.white);
  y -= 22;
  page.drawRectangle({ x: 36, y: y - 40, width: W - 72, height: 45, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
  drawBox(page, 'Lot', parcelle.numero_lot, 46, y - 8, 140, reg, bold);
  drawBox(page, 'Adresse', parcelle.adresse || '-', 210, y - 8, 200, reg, bold);
  drawBox(page, 'Usage parcelle', parcelle.usage || '-', 440, y - 8, 110, reg, bold);
  y -= 55;

  if (batiment.notes) {
    page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
    dt(page, '3. OBSERVATIONS', 46, y - 4, bold, 8, C.white);
    y -= 22;
    wrap(batiment.notes, 90).forEach(l => { dt(page, l, 36, y, reg, 8.5, C.dark); y -= 12; });
    y -= 5;
  }

  // Zone photo bâtiment (placeholder)
  page.drawRectangle({ x: W - 150, y: y - 90, width: 110, height: 80, color: C.bg, borderColor: C.border, borderWidth: 1 });
  dt(page, 'PHOTO', W - 120, y - 45, reg, 8, C.light);
  dt(page, 'DU BATIMENT', W - 125, y - 57, reg, 8, C.light);

  drawSignatures(page, config, reg, bold, W, y - 100);
  await enregistrerDocument('FB', reference, numero);
  return await pdf.save();
}

// IFT — Ticket IFT (Impôt Foncier)
export async function genererIFT(
  parcelle: Parcelle, batiment: Batiment | null, titulaire: TitulaireFoncier | null,
  detenteur: Detenteur | null, config: ConfigFokontany
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 420; // Format A5 paysage
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('IFT', config);

  // Background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.white });
  page.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: C.indigo });
  dt(page, `TICKET IFT - ${config.code_fokontany}-${config.code_quartier}-${config.code_carreau}  |  Ref: ${reference}  |  ${new Date().toLocaleDateString('fr-FR')}`, 20, H - 19, bold, 8, C.white);

  // Ligne séparation verticale
  page.drawLine({ start: { x: W / 2, y: 20 }, end: { x: W / 2, y: H - 35 }, thickness: 0.5, color: C.border });

  let y = H - 45;

  // Côté gauche — Terrain
  dt(page, 'TERRAIN', 20, y, bold, 8, C.indigo);
  y -= 14;
  const tInfo = [
    ['Lot', parcelle.numero_lot],
    ['Superficie', parcelle.superficie_m2 ? `${parcelle.superficie_m2} m2` : '-'],
    ['Adresse', parcelle.adresse || '-'],
    ['Titre foncier', parcelle.titre_foncier || 'Non titre'],
  ];
  tInfo.forEach(([l, v]) => {
    dt(page, `${l} :`, 20, y, reg, 7.5, C.mid);
    dt(page, clean(v), 90, y, bold, 8, C.dark);
    y -= 13;
  });

  y = H - 45;
  // Côté droit — Propriétaire/Détenteur
  dt(page, 'DETENTEUR / PROPRIETAIRE', W / 2 + 10, y, bold, 8, C.indigo);
  y -= 14;
  const dInfo = detenteur ? [
    ['Nom', `${detenteur.nom || '-'} ${detenteur.prenom || ''}`],
    ['CIN', detenteur.cin || '-'],
    ['Qualite', detenteur.type_detention],
  ] : titulaire ? [
    ['Nom', `${titulaire.nom || '-'} ${titulaire.prenom || ''}`],
    ['CIN', titulaire.cin || '-'],
    ['Type', titulaire.type_titulaire],
  ] : [['Non renseigne', '-']];
  dInfo.forEach(([l, v]) => {
    dt(page, `${l} :`, W / 2 + 10, y, reg, 7.5, C.mid);
    dt(page, clean(v), W / 2 + 90, y, bold, 8, C.dark);
    y -= 13;
  });

  // Bâtiment si présent
  if (batiment) {
    y -= 5;
    dt(page, 'BATIMENT', W / 2 + 10, y, bold, 8, C.indigo);
    y -= 13;
    [['Ref.', batiment.reference_batiment], ['Type', batiment.type_batiment], ['Etat', batiment.etat]].forEach(([l, v]) => {
      dt(page, `${l} :`, W / 2 + 10, y, reg, 7.5, C.mid);
      dt(page, clean(v), W / 2 + 60, y, bold, 8, C.dark);
      y -= 13;
    });
  }

  // Statut JOROLAVA
  const hasJOR = !!detenteur;
  page.drawRectangle({ x: 20, y: 25, width: 150, height: 20, color: hasJOR ? C.greenBg : C.redBg, borderColor: hasJOR ? C.green : C.red, borderWidth: 0.5, borderRadius: 3 });
  dt(page, hasJOR ? 'STATUT JOROLAVA : OUI' : 'STATUT JOROLAVA : NON', 28, 33, bold, 8, hasJOR ? C.green : C.red);

  dt(page, `Fokontany Local Ledger v2.0 - ${config.nom_fokontany}`, 20, 8, reg, 6, C.light);
  await enregistrerDocument('IFT', reference, numero);
  return await pdf.save();
}

// DRF — Demande de Régularisation Foncière
export async function genererDRF(
  parcelle: Parcelle, detenteur: Detenteur | null, titulaire: TitulaireFoncier | null,
  batiments: Batiment[], valeur: MiseEnValeur | null, config: ConfigFokontany
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg  = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842;
  const page = pdf.addPage([W, H]);
  const { reference, numero } = await genererReference('DRF', config);
  const col = (W - 80) / 2;

  drawHeader(page, config, bold, reg, W, 'DRF', 'Demande de Regularisation Fonciere', reference);
  let y = 715;

  const intro = `Le soussigne Chef du Fokontany ${clean(config.nom_fokontany)} certifie l'exactitude des informations ci-dessous et appuie la demande de regularisation fonciere de la parcelle identifiee.`;
  wrap(intro, 95).forEach(l => { dt(page, l, 36, y, reg, 9, C.dark); y -= 13; });
  y -= 10;

  // Résumé complet
  const sections = [
    { title: '1. PARCELLE', boxes: [
      { l: 'Lot', v: parcelle.numero_lot }, { l: 'Superficie', v: parcelle.superficie_m2 ? `${parcelle.superficie_m2} m2` : '-' },
      { l: 'GPS', v: parcelle.gps_lat ? `${parcelle.gps_lat?.toFixed(4)}, ${parcelle.gps_lng?.toFixed(4)}` : '-' },
      { l: 'Adresse', v: parcelle.adresse || '-' },
    ]},
    { title: '2. TITULAIRE FONCIER', boxes: [
      { l: 'Type', v: titulaire?.type_titulaire || 'Inconnu' }, { l: 'Nom', v: titulaire ? `${titulaire.nom || '-'} ${titulaire.prenom || ''}` : 'Non renseigne' },
    ]},
    { title: '3. DETENTEUR', boxes: [
      { l: 'Nom', v: detenteur ? `${detenteur.nom || '-'} ${detenteur.prenom || ''}` : 'Non renseigne' },
      { l: 'Qualite', v: detenteur?.type_detention || '-' },
      { l: 'CIN', v: detenteur?.cin || '-' },
      { l: 'Depuis', v: detenteur?.date_debut_occupation ? new Date(detenteur.date_debut_occupation).toLocaleDateString('fr-FR') : '-' },
    ]},
  ];

  sections.forEach(s => {
    page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
    dt(page, s.title, 46, y - 4, bold, 8, C.white);
    y -= 22;
    const h = Math.ceil(s.boxes.length / 2) * 32 + 10;
    page.drawRectangle({ x: 36, y: y - h, width: W - 72, height: h + 5, color: C.bg, borderColor: C.border, borderWidth: 0.5, borderRadius: 4 });
    s.boxes.forEach((b, i) => drawBox(page, b.l, b.v, 36 + (i % 2) * col + 4, y - Math.floor(i / 2) * 32 - 8, col - 8, reg, bold));
    y -= h + 15;
  });

  // Bâtiments
  if (batiments.length > 0) {
    page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
    dt(page, `4. BATIMENTS (${batiments.length})`, 46, y - 4, bold, 8, C.white);
    y -= 22;
    batiments.slice(0, 3).forEach(b => {
      page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.bg, borderColor: C.border, borderWidth: 0.3, borderRadius: 2 });
      dt(page, `${b.reference_batiment} - ${b.type_batiment} - ${b.etat} ${b.superficie_m2 ? `- ${b.superficie_m2} m2` : ''}`, 46, y - 5, reg, 8, C.dark);
      y -= 22;
    });
    y -= 5;
  }

  // Mise en valeur
  if (valeur) {
    const mvItems = ['maison', 'cloture', 'cultures', 'elevage', 'eau', 'electricite', 'commerce'].filter(k => !!(valeur as any)[k]);
    if (mvItems.length > 0) {
      page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 20, color: C.indigo, borderRadius: 2 });
      dt(page, '5. MISE EN VALEUR', 46, y - 4, bold, 8, C.white);
      y -= 22;
      page.drawRectangle({ x: 36, y: y - 18, width: W - 72, height: 22, color: C.bg, borderColor: C.border, borderWidth: 0.3, borderRadius: 2 });
      dt(page, mvItems.join(', ') + (valeur.annee_debut ? ` (depuis ${valeur.annee_debut})` : ''), 46, y - 6, reg, 8.5, C.dark);
      y -= 28;
    }
  }

  dt(page, 'Je soussigne certifie l\'exactitude des informations ci-dessus et appuie la presente demande de regularisation.', 36, y - 10, reg, 9, C.dark);
  drawSignatures(page, config, reg, bold, W, y - 40);
  await enregistrerDocument('DRF', reference, numero);
  return await pdf.save();
}

export const DOCUMENTS_FONCIERS = [
  { code: 'COT', nom: "Certificat d'Occupation de Terrain", description: "Atteste l'occupation d'un terrain", icon: '🌍', besoin: ['parcelle', 'detenteur'] },
  { code: 'JOR', nom: 'JOROLAVA', description: "Reconnaissance locale d'occupation", icon: '📜', besoin: ['parcelle', 'detenteur'] },
  { code: 'ADF', nom: 'Attestation de Détention Foncière', description: 'Identifie le détenteur reconnu', icon: '🤝', besoin: ['parcelle', 'detenteur'] },
  { code: 'APB', nom: "Attestation de Propriété de Bâtiment", description: 'Propriétaire déclaré du bâtiment', icon: '🏗️', besoin: ['parcelle', 'batiment'] },
  { code: 'AMV', nom: 'Attestation de Mise en Valeur', description: 'Justifie les investissements réalisés', icon: '🌿', besoin: ['parcelle', 'detenteur', 'valeur'] },
  { code: 'FP', nom: 'Fiche Parcellaire', description: 'Fiche complète de la parcelle', icon: '📋', besoin: ['parcelle'] },
  { code: 'FB', nom: 'Fiche Bâtiment', description: 'Fiche complète du bâtiment', icon: '🏠', besoin: ['parcelle', 'batiment'] },
  { code: 'DRF', nom: 'Demande de Régularisation Foncière', description: 'Prépare le dossier de régularisation', icon: '📑', besoin: ['parcelle'] },
  { code: 'IFT', nom: 'Ticket IFT', description: 'Prépare la fiscalité foncière', icon: '🏷️', besoin: ['parcelle'] },
] as const;
