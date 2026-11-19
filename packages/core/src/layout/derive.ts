import type { Archetype } from '../model/common.js';
import type { Catalog, Format } from '../model/catalog.js';

const CM_PER_UNIT = { cm: 1, mm: 0.1, px: NaN } as const;

/** Arquétipo pela proporção largura ÷ altura (seção 6.1). */
export function archetypeForRatio(ratio: number): Archetype {
  if (ratio > 4) return 'ultra-horizontal';
  if (ratio >= 1.4) return 'horizontal';
  if (ratio >= 0.8) return 'quase-quadrado';
  if (ratio >= 0.4) return 'vertical';
  return 'ultravertical';
}

/**
 * Área de composição: a área útil/segura quando declarada (o conteúdo crítico mora ali),
 * senão o formato inteiro.
 */
export function compositionArea(f: Format): { w: number; h: number } {
  const r = f.area_conteudo ?? f.area_segura;
  return r ? { w: r.w, h: r.h } : { w: f.medida.w, h: f.medida.h };
}

export function archetypeFor(f: Format): Archetype | 'banner-l' {
  if (f.arquetipo) return f.arquetipo;
  const a = compositionArea(f);
  return archetypeForRatio(a.w / a.h);
}

/** Escala do documento: 1:10 se algum lado final ≥ limite (impressos). Digitais sempre 1. */
export function docScale(f: Format, c: Catalog): number {
  if (f.unidade === 'px') return 1;
  const k = CM_PER_UNIT[f.unidade];
  const maxCm = Math.max(f.medida.w, f.medida.h) * k;
  return maxCm >= c.regras.escala.se_algum_lado_cm_maior_ou_igual ? c.regras.escala.reduzida : 1;
}

export interface PrintGeometry {
  finalMm: { w: number; h: number };
  scale: number;
  docMm: { w: number; h: number };
  bleedDocMm: number;
  safeDocMm: number;
  foldDocMm: number | null;
}

/** Geometria do documento InDesign: tudo (inclusive sangria e margens) dividido pela escala. */
export function printGeometry(f: Format, c: Catalog): PrintGeometry {
  if (f.unidade === 'px') throw new Error(`${f.id} é digital`);
  const toMm = CM_PER_UNIT[f.unidade] * 10;
  const scale = docScale(f, c);
  const finalMm = { w: f.medida.w * toMm, h: f.medida.h * toMm };
  return {
    finalMm,
    scale,
    docMm: { w: round(finalMm.w * scale), h: round(finalMm.h * scale) },
    bleedDocMm: round((f.sangria_mm ?? 0) * scale),
    safeDocMm: round((f.margem_seguranca_mm ?? 0) * scale),
    foldDocMm: f.margem_dobra_mm != null ? round(f.margem_dobra_mm * scale) : null,
  };
}

/** ppi efetivo exigido no documento: o InDesign mede no tamanho do doc, a regra vale no final. */
export function requiredPpi(f: Format, c: Catalog): { finalMin: number; finalIdeal: number; docMin: number; docIdeal: number } | null {
  if (!f.ppi_tier) return null;
  const t = c.regras.ppi[f.ppi_tier];
  if (!t) return null;
  const s = docScale(f, c);
  return { finalMin: t.minimo, finalIdeal: t.ideal, docMin: t.minimo / s, docIdeal: t.ideal / s };
}

/** Pixels mínimos/ideais de um link colocado com `placedCm` no tamanho final (para links_faltando.md). */
export function requiredPixels(placedCm: { w: number; h: number }, ppi: number): { w: number; h: number } {
  return { w: Math.ceil((placedCm.w / 2.54) * ppi), h: Math.ceil((placedCm.h / 2.54) * ppi) };
}

/** Altura mínima de caixa-alta (mm, tamanho final) para a distância máxima de leitura. */
export function minCapHeightMm(f: Format, c: Catalog): { principal: number; apoio: number } | null {
  if (!f.distancia_leitura_m) return null;
  const principal = (f.distancia_leitura_m.max / 10) * c.regras.legibilidade.caixa_alta_mm_por_10m;
  return { principal: round(principal), apoio: round(principal * c.regras.legibilidade.apoio_fracao) };
}

/** Sufixo de medida para nomes de arquivo: 100x120cm, 300x250px. */
export function sizeLabel(f: Format): string {
  return `${trim(f.medida.w)}x${trim(f.medida.h)}${f.unidade}`;
}

/** TUM_<CAMPANHA>_<FASE>_<PECA>_<LxA><un>[_F|_V][_E1-10]_v<NN>.<ext> (seção 7.4) */
export function outputName(o: {
  prefix: string;
  campaign: string;
  phase: string;
  format: Format;
  catalog: Catalog;
  face?: 'F' | 'V';
  version: number;
  ext: string;
}): string {
  const up = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const piece = up(o.format.id.replace(/-\d+x\d+$/, '').replace(/-\d+$/, ''));
  const parts = [o.prefix, up(o.campaign), up(o.phase), piece, sizeLabel(o.format)];
  if (o.face) parts.push(o.face);
  if (docScale(o.format, o.catalog) !== 1) parts.push(o.catalog.regras.escala.sufixo.replace(/^_/, ''));
  parts.push(`v${String(o.version).padStart(2, '0')}`);
  return `${parts.join('_')}.${o.ext}`;
}

/** Título do slide: "Banner 100x120cm / Frente/Verso". */
export function presentationTitle(f: Format): string {
  const faces = f.faces === 2 ? ' / Frente/Verso' : f.partes ? ` / ${f.partes} faces` : '';
  return `${f.nome_apresentacao} ${sizeLabel(f)}${faces}`;
}

/** Duração de cada frame em centésimos (unidade do GIF). O catálogo já garante a soma de 10 s. */
export function gifDelaysCs(frames: { duracao_s: number }[]): number[] {
  return frames.map((f) => Math.round(f.duracao_s * 100));
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const trim = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','));
