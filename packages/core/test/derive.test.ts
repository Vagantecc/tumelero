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
  requiredPixelsDoc,
  diretrizFor,
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

describe('escala 1:10 e geometria (cliente 20/11: todo impresso em 1:10)', () => {
  it('todo impresso sai em 1:10; digitais em 1:1', () => {
    for (const x of cat.formatos) expect(docScale(x, cat), x.id).toBe(x.unidade === 'px' ? 1 : 0.1);
  });

  it('sangria e margens também dividem por 10', () => {
    const g = printGeometry(f('lona-600x70'), cat);
    expect(g.docMm).toEqual({ w: 600, h: 70 });
    expect(g.bleedDocMm).toBe(3);
    expect(g.safeDocMm).toBe(5);
    const b = printGeometry(f('banner-100x120'), cat);
    expect(b.docMm).toEqual({ w: 100, h: 120 });
    expect(b.bleedDocMm).toBe(0.5);
  });

  it('ppi: 300 no documento = 30 no final; alerta contra a referência final', () => {
    const lona = requiredPpi(f('lona-800x80'), cat)!;
    expect(lona).toMatchObject({ docMin: 300, docIdeal: 300, finalMin: 30, finalIdeal: 30 });
    expect(lona.referenciaFinal).toEqual({ minimo: 72, ideal: 100 });
    expect(lona.abaixoReferencia).toBe(false); // lona vista a 8–15 m: sem alerta
    expect(requiredPpi(f('banner-100x120'), cat)?.abaixoReferencia).toBe(true);
    expect(requiredPpi(f('ret-medio'), cat)).toBeNull();
  });

  it('pixels de link a 300 ppi no documento 1:10', () => {
    expect(requiredPixels({ w: 254, h: 127 }, 100)).toEqual({ w: 10000, h: 5000 });
    // banner 101×121 cm final → 10,1×12,1 cm no doc → 300 ppi
    expect(requiredPixelsDoc({ w: 101, h: 121 }, 0.1, 300)).toEqual({ w: 1193, h: 1430 });
  });

  it('peça-diretriz por arquétipo', () => {
    expect(diretrizFor(f('lona-300x70'), cat)).toBe('lona-800x80');
    expect(diretrizFor(f('portico-130x50'), cat)).toBe('lona-420x130');
    expect(diretrizFor(f('mobile-50x50'), cat)).toBe('banner-100x120');
    expect(diretrizFor(f('triedro-40x160'), cat)).toBe('big-tower');
    expect(diretrizFor(f('banner-l'), cat)).toBe('lona-420x130');
    expect(new Set(Object.values(cat.diretrizes)).size).toBe(4);
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
    ).toBe('TUM_ANIVERSARIO-BLACK-2026_BLACK_BANNER_100x120cm_V_E1-10_v03.png');
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

describe('cadastro de tamanhos e campanhas', async () => {
  const { mkdtempSync, cpSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { addFormat, createCampaign, loadCampaign } = await import('../src/index.js');
  const root = new URL('../../..', import.meta.url).pathname;
  const sandbox = () => {
    const d = mkdtempSync(join(tmpdir(), 'desdobrador-'));
    cpSync(join(root, 'formats'), join(d, 'formats'), { recursive: true });
    cpSync(join(root, 'brands'), join(d, 'brands'), { recursive: true });
    return resolvePaths(d);
  };

  it('novo tamanho herda specs da base, preserva comentários e é validado', () => {
    const p = sandbox();
    const nf = addFormat(p, { base: 'lona-300x70', nome_apresentacao: 'Lona', w: 500, h: 60 });
    expect(nf.id).toBe('lona-500x60');
    expect(nf.sangria_mm).toBe(30);
    const c = loadCatalog(p);
    const got = c.formatos.find((x) => x.id === 'lona-500x60')!;
    expect(archetypeFor(got)).toBe('ultra-horizontal');
    expect(docScale(got, c)).toBe(0.1);
    expect(readFileSync(join(p.root, 'formats', 'catalog.yaml'), 'utf8')).toContain('# Peças-diretriz');
  });

  it('recusa id duplicado e base inexistente', () => {
    const p = sandbox();
    expect(() => addFormat(p, { base: 'lona-300x70', nome_apresentacao: 'Lona', w: 300, h: 70 })).toThrow(/já existe/);
    expect(() => addFormat(p, { base: 'nao-existe', nome_apresentacao: 'X', w: 1, h: 1 })).toThrow(/não existe/);
  });

  it('novo tamanho digital a partir de um GIF', () => {
    const p = sandbox();
    const nf = addFormat(p, { base: 'ret-medio', nome_apresentacao: 'Half Page', w: 300, h: 600, id: 'half-page' });
    expect(nf).toMatchObject({ id: 'half-page', unidade: 'px', limite_bytes: 153600 });
  });

  it('nova campanha cria rascunho válido e não sobrescreve', () => {
    const p = sandbox();
    const c = createCampaign(p, { nome: 'Inverno Tumelero', brand: 'tumelero', phases: ['Lançamento', 'Saldão'] });
    expect(c.slug).toBe('inverno-tumelero');
    expect(c.phases).toEqual(['lancamento', 'saldao']);
    expect(loadCampaign(p, 'inverno-tumelero').status).toBe('rascunho');
    expect(() => createCampaign(p, { nome: 'Inverno Tumelero', brand: 'tumelero' })).toThrow(/já existe/);
    expect(() => createCampaign(p, { nome: 'X', brand: 'marca-inexistente' })).toThrow();
  });
});
