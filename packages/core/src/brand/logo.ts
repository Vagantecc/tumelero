import type { Brand } from '../model/brand.js';
import type { Archetype, RgbT } from '../model/common.js';
import { contrastRatio, deltaERgb, relativeLuminance } from './color.js';

export type LogoVersion = 'horizontal' | 'vertical';

/**
 * Versão do logo (H/V) para o arquétipo. A vertical só entra quando é permitida E
 * (é a preferida OU a horizontal ficaria abaixo do tamanho mínimo).
 */
export function chooseLogoVersion(brand: Brand, archetype: Archetype, horizontalFitsMinimum: boolean): LogoVersion {
  const rule = brand.logo.por_arquetipo[archetype];
  if (!rule) return brand.logo.versao_principal;
  const allowsV = rule.permitidas.includes('vertical');
  const allowsH = rule.permitidas.includes('horizontal');
  if (!allowsV) return 'horizontal';
  if (!allowsH) return 'vertical';
  if (rule.preferida === 'vertical') return 'vertical';
  if (rule.vertical_se === 'horizontal_abaixo_minimo' && !horizontalFitsMinimum) return 'vertical';
  return 'horizontal';
}

/**
 * Variante de cor do logo a partir da cor média do fundo sob a caixa do logo.
 * 1) a cor-chave da marca mais próxima (ΔE2000 ≤ limite) define a variante declarada para esse fundo;
 * 2) senão, decide por luminância, respeitando o contraste mínimo.
 */
export function chooseLogoColor(brand: Brand, background: RgbT): { variante: string; motivo: string } {
  const { variantes_cor, escolha_cor } = brand.logo;
  let best: { cor: string; de: number } | null = null;
  for (const [nome, cor] of Object.entries(brand.cores)) {
    const de = deltaERgb(background, cor.rgb);
    if (!best || de < best.de) best = { cor: nome, de };
  }
  if (best && best.de <= escolha_cor.delta_e_limite) {
    const v = Object.entries(variantes_cor).find(([, vc]) => vc.fundos.includes(best!.cor));
    if (v) return { variante: v[0], motivo: `fundo ≈ ${best.cor} (ΔE ${best.de.toFixed(1)})` };
  }
  const light = relativeLuminance(background) > 0.4;
  const order = light ? escolha_cor.prioridade_fundo_claro : escolha_cor.prioridade_fundo_escuro;
  for (const nome of order) {
    const vc = variantes_cor[nome];
    if (!vc) continue;
    const lettering = brand.cores[vc.lettering]?.rgb;
    if (lettering && contrastRatio(lettering, background) >= escolha_cor.contraste_minimo) {
      return { variante: nome, motivo: `fundo ${light ? 'claro' : 'escuro'}, contraste ${contrastRatio(lettering, background).toFixed(1)}:1` };
    }
  }
  return { variante: order[order.length - 1]!, motivo: 'nenhuma variante atinge o contraste mínimo — aplicar faixa sólida' };
}

/** Slogan só entra se a frase ainda não estiver na peça (comparação sem acento/caixa/pontuação). */
export function needsSlogan(brand: Brand, texts: string[]): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const slogan = norm(brand.logo.slogan.texto);
  return !texts.some((t) => norm(t).includes(slogan));
}
