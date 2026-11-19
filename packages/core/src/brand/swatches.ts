import type { Brand } from '../model/brand.js';
import type { Campaign } from '../model/campaign.js';
import type { AseSwatch } from './ase.js';

/** Swatches técnicos de produção (nomes configuráveis no futuro por fornecedor). */
export const DIELINE_SWATCHES: AseSwatch[] = [
  { name: 'Faca', model: 'CMYK', values: [0, 100, 0, 0], type: 'spot' },
  { name: 'Vinco', model: 'CMYK', values: [100, 0, 0, 0], type: 'spot' },
];

/**
 * Swatches de impressão: cada cor com Pantone vira um swatch com o NOME do Pantone, mas
 * definido como PROCESSO com os CMYK do MIV (nunca pela conversão Lab do Ink Manager).
 */
export function printSwatches(brand: Brand, campaign?: Campaign, phase?: string): AseSwatch[] {
  const out: AseSwatch[] = Object.entries(brand.cores)
    .filter(([n]) => n !== 'branco')
    .map(([n, c]) => ({ name: c.pantone ?? `${brand.nome} ${n}`, model: 'CMYK', values: [...c.cmyk], type: 'global' }));
  for (const x of campaign?.extra_colors ?? []) {
    if (!phase || x.phases.includes(phase)) out.push({ name: x.name, model: 'CMYK', values: [...x.cmyk], type: 'global' });
  }
  return [...out, ...DIELINE_SWATCHES];
}

/** Swatches digitais: RGB do MIV. */
export function digitalSwatches(brand: Brand, campaign?: Campaign, phase?: string): AseSwatch[] {
  const out: AseSwatch[] = Object.entries(brand.cores).map(([n, c]) => ({ name: `${brand.nome} ${n} ${c.hex}`, model: 'RGB', values: [...c.rgb], type: 'global' }));
  for (const x of campaign?.extra_colors ?? []) {
    if (!phase || x.phases.includes(phase)) out.push({ name: x.name, model: 'RGB', values: [...x.rgb], type: 'global' });
  }
  return out;
}
