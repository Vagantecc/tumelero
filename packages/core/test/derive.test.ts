import { describe, expect, it } from 'vitest';
import {
  archetypeFor,
  archetypeForRatio,
  docScale,
  gifDelaysCs,
  loadCatalog,
  minCapHeightMm,
  outputName,
  presentationTitle,
  printGeometry,
  requiredPixels,
  requiredPpi,
  resolvePaths,
} from '../src/index.js';

const cat = loadCatalog(resolvePaths(new URL('../../..', import.meta.url).pathname));
const f = (id: string) => {
  const x = cat.formatos.find((y) => y.id === id);
  if (!x) throw new Error(id);
  return x;
};

describe('arquétipos (seção 6.1)', () => {
  it.each([
    [10, 'ultra-horizontal'],
    [4.01, 'ultra-horizontal'],
    [4, 'horizontal'],
    [1.4, 'horizontal'],
    [1.39, 'quase-quadrado'],
    [0.8, 'quase-quadrado'],
    [0.79, 'vertical'],
    [0.4, 'vertical'],
    [0.39, 'ultravertical'],
  ])('ratio %s → %s', (r, a) => expect(archetypeForRatio(r)).toBe(a));

  it('formatos do catálogo', () => {
    expect(archetypeFor(f('lona-800x80'))).toBe('ultra-horizontal');
    expect(archetypeFor(f('banner-100x120'))).toBe('quase-quadrado');
    expect(archetypeFor(f('triedro-40x160'))).toBe('ultravertical');
    expect(archetypeFor(f('big-tower'))).toBe('vertical');
    expect(archetypeFor(f('banner-l'))).toBe('banner-l');
  });

  it('usa a área útil quando declarada (parallax in text 700×350 → horizontal)', () => {
    expect(archetypeFor(f('parallax-in-text'))).toBe('horizontal');
  });
});

describe('escala 1:10 e geometria', () => {
  it('1:10 para qualquer lado ≥ 2,5 m', () => {
    expect(docScale(f('lona-250x260'), cat)).toBe(0.1);
    expect(docScale(f('lona-300x70'), cat)).toBe(0.1);
    expect(docScale(f('adesivo-vitrine-700x150'), cat)).toBe(0.1);
    expect(docScale(f('banner-100x120'), cat)).toBe(1);
    expect(docScale(f('triedro-40x160'), cat)).toBe(1);
    expect(docScale(f('ret-medio'), cat)).toBe(1);
  });

  it('todas as lonas e o adesivo saem em 1:10', () => {
    for (const x of cat.formatos.filter((y) => y.id.startsWith('lona-') || y.id.startsWith('adesivo'))) {
      expect(docScale(x, cat), x.id).toBe(0.1);
    }
  });

  it('sangria e margens também dividem por 10', () => {
    const g = printGeometry(f('lona-600x70'), cat);
    expect(g.docMm).toEqual({ w: 600, h: 70 });
    expect(g.bleedDocMm).toBe(3);
    expect(g.safeDocMm).toBe(5);
    const b = printGeometry(f('banner-100x120'), cat);
    expect(b.docMm).toEqual({ w: 1000, h: 1200 });
    expect(b.bleedDocMm).toBe(5);
  });

  it('ppi exigido no documento é 10× em 1:10', () => {
    expect(requiredPpi(f('lona-300x70'), cat)).toEqual({ finalMin: 100, finalIdeal: 150, docMin: 1000, docIdeal: 1500 });
    expect(requiredPpi(f('lona-800x80'), cat)?.docMin).toBe(720);
    expect(requiredPpi(f('banner-100x120'), cat)?.docMin).toBe(150);
  });

  it('pixels mínimos para links_faltando.md', () => {
    expect(requiredPixels({ w: 254, h: 127 }, 100)).toEqual({ w: 10000, h: 5000 });
  });
});

describe('legibilidade por distância (seção 6.2)', () => {
  it('25 mm a cada 10 m, apoio 60%', () => {
    expect(minCapHeightMm(f('lona-800x100'), cat)).toEqual({ principal: 37.5, apoio: 22.5 });
    expect(minCapHeightMm(f('banner-100x120'), cat)).toEqual({ principal: 7.5, apoio: 4.5 });
    expect(minCapHeightMm(f('ret-medio'), cat)).toBeNull();
  });
});

describe('nomenclatura (seção 7.4) e apresentação', () => {
  it('nome com face e escala', () => {
    expect(outputName({ prefix: 'TUM', campaign: 'aniversario-black-2026', phase: 'black', format: f('lona-300x70'), catalog: cat, version: 1, ext: 'pdf' })).toBe(
      'TUM_ANIVERSARIO-BLACK-2026_BLACK_LONA_300x70cm_E1-10_v01.pdf',
    );
    expect(
      outputName({ prefix: 'TUM', campaign: 'aniversario-black-2026', phase: 'black', format: f('banner-100x120'), catalog: cat, face: 'V', version: 3, ext: 'png' }),
    ).toBe('TUM_ANIVERSARIO-BLACK-2026_BLACK_BANNER_100x120cm_V_v03.png');
  });

  it('título do slide', () => {
    expect(presentationTitle(f('banner-100x120'))).toBe('Banner 100x120cm / Frente/Verso');
    expect(presentationTitle(f('cubo-40'))).toBe('Cubo 40x40cm / 4 faces');
    expect(presentationTitle(f('ret-medio'))).toBe('Retângulo médio 300x250px');
  });
});

describe('catálogo: invariantes', () => {
  it('todo GIF dura 10 s (4/3/3) e tem limite de 150 KB', () => {
    for (const x of cat.formatos.filter((y) => y.saidas.includes('gif'))) {
      expect(gifDelaysCs(x.frames!).reduce((a, b) => a + b, 0), x.id).toBe(1000);
      expect(x.limite_bytes, x.id).toBe(150 * 1024);
    }
  });

  it('pedágio: 4+3+3 s, 30 fps = 300 frames, 8000 kbps', () => {
    const v = f('pedagio').video!;
    expect(v.telas.map((t) => t.duracao_s)).toEqual([4, 3, 3]);
    expect(v.telas.reduce((s, t) => s + t.duracao_s, 0) * v.fps).toBe(300);
    expect(v.bitrate_kbps).toBe(8000);
  });

  it('Banner L: janela transparente 1378×773 + coluna 542 + faixa 307', () => {
    const b = f('banner-l');
    expect(b.janela_transparente).toMatchObject({ x: 0, y: 0, w: 1378, h: 773 });
    expect(b.janela_transparente!.w + b.zonas!.coluna_direita!.w).toBe(1920);
    expect(b.janela_transparente!.h + b.zonas!.faixa_inferior!.h).toBe(1080);
  });

  it('sangrias padrão da seção 5.1', () => {
    expect(f('banner-100x120').sangria_mm).toBe(5);
    expect(f('adesivo-vitrine-700x150').sangria_mm).toBe(10);
    expect(f('lona-470x90').sangria_mm).toBe(30);
    expect(f('lona-470x90').margem_seguranca_mm).toBe(50);
    expect(f('cubo-40').margem_dobra_mm).toBe(15);
  });

  it('adesivo vitrine nunca espelhado', () => {
    expect(f('adesivo-vitrine-700x150').espelhar).toBe(false);
  });
});
