#!/usr/bin/env -S npx tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import {
  ConfigError,
  addFormat,
  createCampaign,
  diretrizFor,
  archetypeFor,
  digitalSwatches,
  loadBrand,
  loadCampaign,
  loadCatalog,
  minCapHeightMm,
  printGeometry,
  printSwatches,
  requiredPpi,
  resolvePaths,
  sizeLabel,
  writeAse,
} from '@desdobrador/core';

const program = new Command();
program.name('desdobrador').description('Desdobrador de peças Adobe — HOC').version('0.1.0');

const paths = () => resolvePaths(process.env.DESDOBRADOR_ROOT ?? process.cwd());

function run(fn: () => void) {
  try {
    fn();
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(`✗ ${e.message}`);
      process.exit(2);
    }
    if (e instanceof Error) {
      console.error(`✗ ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

program
  .command('check')
  .description('valida brand.yaml, catalog.yaml e campaign.yaml contra os schemas')
  .option('--brand <slug>', 'marca', 'tumelero')
  .option('--campaign <slug>', 'campanha')
  .action((o: { brand: string; campaign?: string }) =>
    run(() => {
      const p = paths();
      const brand = loadBrand(p, o.brand);
      console.log(`✓ brands/${o.brand}/brand.yaml — ${Object.keys(brand.cores).length} cores, ${brand.logo.arquivos.length} arquivos de logo`);
      const cat = loadCatalog(p);
      console.log(`✓ formats/catalog.yaml — ${cat.formatos.length} formatos`);
      if (o.campaign) {
        const c = loadCampaign(p, o.campaign);
        if (c.brand !== o.brand) throw new Error(`campanha é da marca ${c.brand}`);
        console.log(`✓ campaigns/${o.campaign}/campaign.yaml — fases: ${c.phases.join(', ')} (${c.status})`);
        if (c.pendencias.length) console.log(`  pendências:\n${c.pendencias.map((x) => `   · ${x}`).join('\n')}`);
      }
      const pend: string[] = [];
      if (!brand.logo.arquivos.length) pend.push('logos não extraídos (rodar brand-extract no Mac)');
      if (brand.logo.area_seguranca.x_sobre_altura_logo_h == null) pend.push('módulo X da área de segurança não medido');
      if (pend.length) console.log(`  pendências da marca:\n${pend.map((x) => `   · ${x}`).join('\n')}`);
    }),
  );

program
  .command('formats')
  .description('lista o catálogo com arquétipo, escala, tamanho do documento e regras derivadas')
  .option('--group <grupo>', 'filtrar por grupo')
  .option('--json', 'saída JSON')
  .action((o: { group?: string; json?: boolean }) =>
    run(() => {
      const cat = loadCatalog(paths());
      const rows = cat.formatos
        .filter((f) => !o.group || f.grupo === o.group)
        .map((f) => {
          const base = { id: f.id, grupo: f.grupo, medida: sizeLabel(f), arquetipo: archetypeFor(f), diretriz: diretrizFor(f, cat) ?? '-', app: f.app, cor: f.colorspace };
          if (f.unidade === 'px') return { ...base, documento: `${f.medida.w}×${f.medida.h} px @${f.video?.dpi ?? cat.regras.digital.ppi_metadado}ppi`, escala: '1:1', ppi_doc: '-', caixa_alta: '-' };
          const g = printGeometry(f, cat);
          const ppi = requiredPpi(f, cat);
          const cap = minCapHeightMm(f, cat);
          return {
            ...base,
            documento: `${g.docMm.w}×${g.docMm.h} mm +${g.bleedDocMm} sangria`,
            escala: g.scale === 1 ? '1:1' : '1:10',
            ppi_doc: ppi ? `${ppi.docMin} (final ${ppi.finalMin})${ppi.abaixoReferencia ? ' ⚠' : ''}` : '-',
            caixa_alta: cap ? `${cap.principal} mm` : '-',
          };
        });
      if (o.json) console.log(JSON.stringify(rows, null, 2));
      else console.table(rows);
    }),
  );

program
  .command('swatches')
  .description('gera os .ase de impressão (CMYK do MIV, processo + Faca/Vinco spot) e digital (RGB)')
  .option('--brand <slug>', 'marca', 'tumelero')
  .option('--campaign <slug>', 'inclui as cores extras da campanha')
  .option('--phase <fase>', 'restringe as extras a uma fase')
  .action((o: { brand: string; campaign?: string; phase?: string }) =>
    run(() => {
      const p = paths();
      const brand = loadBrand(p, o.brand);
      const camp = o.campaign ? loadCampaign(p, o.campaign) : undefined;
      const dir = camp ? join(p.root, 'campaigns', camp.slug, 'swatches') : join(p.root, 'brands', o.brand, 'swatches');
      mkdirSync(dir, { recursive: true });
      const tag = [o.brand, camp?.slug, o.phase].filter(Boolean).join('_');
      const files = {
        [`${tag}_impressao_cmyk.ase`]: writeAse(`${brand.nome} impressão`, printSwatches(brand, camp, o.phase)),
        [`${tag}_digital_rgb.ase`]: writeAse(`${brand.nome} digital`, digitalSwatches(brand, camp, o.phase)),
      };
      for (const [name, buf] of Object.entries(files)) {
        writeFileSync(join(dir, name), buf);
        console.log(`✓ ${join(dir, name)}`);
      }
    }),
  );

program
  .command('formato-novo')
  .description('cadastra um novo tamanho no catálogo, copiando as especificações de um formato-base')
  .requiredOption('--base <id>', 'formato existente usado como base (ex.: lona-300x70, ret-medio)')
  .requiredOption('--nome <texto>', 'nome na apresentação (ex.: "Lona")')
  .requiredOption('--largura <n>', 'largura no tamanho final (mesma unidade da base: cm ou px)', Number)
  .requiredOption('--altura <n>', 'altura no tamanho final', Number)
  .option('--id <id>', 'id do formato (padrão: <base>-<L>x<A>)')
  .option('--grupo <grupo>', 'grupo/seção (padrão: o da base)')
  .option('--faces <n>', '1 ou 2 (frente e verso)', (v) => Number(v) as 1 | 2)
  .action((o: { base: string; nome: string; largura: number; altura: number; id?: string; grupo?: string; faces?: 1 | 2 }) =>
    run(() => {
      const p = paths();
      const f = addFormat(p, { base: o.base, nome_apresentacao: o.nome, w: o.largura, h: o.altura, id: o.id, grupo: o.grupo, faces: o.faces });
      const cat = loadCatalog(p);
      const nf = cat.formatos.find((x) => x.id === f.id)!;
      console.log(`✓ formato "${f.id}" cadastrado: ${sizeLabel(nf)}, ${archetypeFor(nf)}, diretriz ${diretrizFor(nf, cat) ?? '—'}`);
    }),
  );

program
  .command('campanha-nova')
  .description('cria uma nova campanha (rascunho) em campaigns/<slug>/campaign.yaml')
  .requiredOption('--nome <texto>', 'nome da campanha (ex.: "Inverno")')
  .option('--brand <slug>', 'marca', 'tumelero')
  .option('--slug <slug>', 'identificador (padrão: gerado do nome)')
  .option('--fases <lista>', 'fases separadas por vírgula (ex.: "lancamento,saldao")')
  .option('--titulo <texto>', 'título')
  .option('--subtitulo <texto>', 'subtítulo/conceito')
  .option('--cta <texto>', 'chamada para ação')
  .action((o: { nome: string; brand: string; slug?: string; fases?: string; titulo?: string; subtitulo?: string; cta?: string }) =>
    run(() => {
      const c = createCampaign(paths(), {
        nome: o.nome, brand: o.brand, slug: o.slug, phases: o.fases?.split(',').map((x) => x.trim()),
        titulo: o.titulo, subtitulo: o.subtitulo, cta: o.cta,
      });
      console.log(`✓ campanha "${c.slug}" criada (fases: ${c.phases.join(', ')}) → campaigns/${c.slug}/campaign.yaml`);
    }),
  );

for (const [name, desc, milestone] of [
  ['brand-extract', 'extrai logos/casa/ícones do MIV.indd (InDesign)', 'M1b'],
  ['dieline', 'extrai a geometria de uma faca (InDesign)', 'M1b'],
  ['ingest', 'ingere o KV-mestre e propõe o mapeamento de papéis', 'M2'],
  ['confirm', 'abre o mapping-preview para confirmar papéis', 'M2'],
  ['run', 'desdobra as peças', 'M3'],
  ['validate', 'roda o validador MIV', 'M5'],
  ['present', 'monta a apresentação no Google Slides', 'M6'],
  ['status', 'troca a tag de status de uma peça', 'M6'],
  ['relink', 'recebe links em alta e retoma jobs parados', 'M4'],
] as const) {
  program
    .command(name)
    .description(`${desc} — previsto no ${milestone}`)
    .allowUnknownOption()
    .action(() => {
      console.error(`"${name}" ainda não implementado (${milestone}).`);
      process.exit(1);
    });
}

program.parse();
