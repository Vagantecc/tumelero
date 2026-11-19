import { describe, expect, it } from 'vitest';
import {
  Brand,
  Catalog,
  chooseLogoColor,
  chooseLogoVersion,
  contrastRatio,
  deltaE2000,
  digitalSwatches,
  loadBrand,
  loadCampaign,
  needsSlogan,
  printSwatches,
  readAse,
  resolvePaths,
  writeAse,
} from '../src/index.js';

const paths = resolvePaths(new URL('../../..', import.meta.url).pathname);
const brand = loadBrand(paths, 'tumelero');
const camp = loadCampaign(paths, 'aniversario-black-2026');

describe('brand.yaml Tumelero (MIV)', () => {
  it('cores oficiais do MIV', () => {
    expect(brand.cores.azul).toMatchObject({ pantone: 'PANTONE 2145 C', cmyk: [100, 89, 0, 19], rgb: [7, 43, 171], hex: '#072BAB' });
    expect(brand.cores.laranja).toMatchObject({ pantone: 'PANTONE 152 C', cmyk: [7, 67, 100, 0], rgb: [229, 121, 63], hex: '#E5793F' });
  });

  it('só Objektiv Mk3 com os 10 estilos permitidos', () => {
    expect(brand.tipografia.familia).toBe('Objektiv Mk3');
    expect(brand.tipografia.estilos_permitidos).toHaveLength(10);
    expect(brand.tipografia.estilos_permitidos).not.toContain('Light');
  });

  it('schema rejeita logo vertical em arquétipo horizontal', () => {
    const bad = structuredClone(brand);
    bad.logo.por_arquetipo['quase-quadrado'] = { permitidas: ['horizontal', 'vertical'] };
    expect(Brand.safeParse(bad).success).toBe(false);
  });

  it('schema rejeita HEX que não bate com RGB', () => {
    const bad = structuredClone(brand);
    bad.cores.laranja!.hex = '#E5783F';
    const r = Brand.safeParse(bad);
    expect(r.success).toBe(false);
  });
});

describe('escolha de logo', () => {
  it('vertical nunca em horizontal / 1:1', () => {
    expect(chooseLogoVersion(brand, 'quase-quadrado', false)).toBe('horizontal');
    expect(chooseLogoVersion(brand, 'ultra-horizontal', false)).toBe('horizontal');
  });
  it('vertical comum prefere horizontal', () => {
    expect(chooseLogoVersion(brand, 'vertical', true)).toBe('horizontal');
  });
  it('ultravertical usa vertical só se a horizontal ficar abaixo do mínimo', () => {
    expect(chooseLogoVersion(brand, 'ultravertical', true)).toBe('horizontal');
    expect(chooseLogoVersion(brand, 'ultravertical', false)).toBe('vertical');
  });

  it.each([
    [[255, 255, 255], 'colorida'],
    [[7, 43, 171], 'branca_azul'],
    [[20, 50, 160], 'branca_azul'],
    [[229, 121, 63], 'branca_laranja'],
    [[0, 0, 0], 'negativa'],
    [[40, 40, 40], 'negativa'],
    [[235, 235, 225], 'colorida'],
  ] as const)('fundo %j → %s', (bg, v) => {
    expect(chooseLogoColor(brand, [...bg] as [number, number, number]).variante).toBe(v);
  });

  it('slogan só se a frase ainda não estiver na peça', () => {
    expect(needsSlogan(brand, ['Aniversário Tumelero'])).toBe(true);
    expect(needsSlogan(brand, ['NINGUÉM FACILITA TANTO!'])).toBe(false);
    expect(needsSlogan(brand, ['ninguem facilita tanto'])).toBe(false);
  });
});

describe('cor', () => {
  it('contraste WCAG', () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 1);
    expect(contrastRatio([255, 255, 255], [7, 43, 171])).toBeGreaterThan(4.5);
  });
  it('ΔE2000 — par de referência de Sharma et al. (2005)', () => {
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
    expect(deltaE2000([50, 0, 0], [50, -1, 2])).toBeCloseTo(2.3669, 3);
  });
});

describe('swatches .ase', () => {
  it('impressão: Pantone como PROCESSO com CMYK do MIV + Faca/Vinco spot', () => {
    const sw = readAse(writeAse('Tumelero impressão', printSwatches(brand, camp, 'black')));
    expect(sw.find((s) => s.name === 'PANTONE 2145 C')).toEqual({ name: 'PANTONE 2145 C', model: 'CMYK', values: [100, 89, 0, 19], type: 'global' });
    expect(sw.find((s) => s.name === 'PANTONE 152 C')?.values).toEqual([7, 67, 100, 0]);
    expect(sw.find((s) => s.name === 'Faca')?.type).toBe('spot');
    expect(sw.find((s) => s.name === 'Vinco')?.type).toBe('spot');
    expect(sw.filter((s) => s.type === 'spot').map((s) => s.name)).toEqual(['Faca', 'Vinco']);
    expect(sw.find((s) => s.name === 'preto-black')).toBeTruthy();
  });
  it('extra da campanha só na fase declarada', () => {
    expect(printSwatches(brand, camp, 'aniversario').find((s) => s.name === 'preto-black')).toBeUndefined();
  });
  it('digital em RGB', () => {
    const sw = readAse(writeAse('d', digitalSwatches(brand)));
    expect(sw.every((s) => s.model === 'RGB')).toBe(true);
    expect(sw.find((s) => s.name.includes('laranja'))?.values).toEqual([229, 121, 63]);
  });
});

describe('catálogo: schema', () => {
  it('rejeita impresso sem sangria', async () => {
    const { loadCatalog } = await import('../src/index.js');
    const cat = structuredClone(loadCatalog(paths));
    delete (cat.formatos[0] as { sangria_mm?: number }).sangria_mm;
    expect(Catalog.safeParse(cat).success).toBe(false);
  });
});

describe('regras de composição da campanha Verão', async () => {
  const { compositionRuleFor } = await import('../src/index.js');
  const verao = loadCampaign(paths, 'verao-2026');
  it('lonas ultra-horizontais usam o bloco azul', () => {
    for (const id of ['lona-300x70', 'lona-600x70', 'lona-800x80', 'lona-800x100']) {
      expect(compositionRuleFor(verao.regras_composicao, id)?.fundo, id).toEqual({ cor: 'azul' });
    }
  });
  it('lona 250x260 e banner seguem o padrão (foto)', () => {
    expect(compositionRuleFor(verao.regras_composicao, 'lona-250x260')).toBeUndefined();
    expect(compositionRuleFor(verao.regras_composicao, 'banner-100x120')).toBeUndefined();
  });
  it('a cor do bloco existe na paleta', () => {
    for (const r of verao.regras_composicao) if ('cor' in r.fundo) expect(brand.cores[r.fundo.cor]).toBeTruthy();
  });
});

describe('Verão: lona grande = bloco azul + foto no canto', () => {
  it('foto no canto esquerdo, logo livre na direita', () => {
    const r = loadCampaign(paths, 'verao-2026').regras_composicao[0]!;
    expect(r.imagem_principal).toBe('canto');
    expect(r.canto).toBe('esquerda');
  });
});
