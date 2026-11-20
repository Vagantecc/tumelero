import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMap, isScalar, isSeq, LineCounter, parseDocument, stringify, YAMLMap, YAMLSeq } from 'yaml';
import { Campaign } from '../model/campaign.js';
import { Catalog, type Format } from '../model/catalog.js';
import { ConfigError, loadBrand, type Paths } from './load.js';

export interface NewFormatInput {
  /** formato existente cujas especificações (app, cor, sangria, ppi, saídas…) são copiadas */
  base: string;
  nome_apresentacao: string;
  w: number;
  h: number;
  /** opcional: gerado como <base sem medida>-<w>x<h> */
  id?: string;
  grupo?: string;
  faces?: 1 | 2;
  observacao?: string;
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const fmt = (n: number) => String(n).replace('.', '_');

function zodIssues(file: string, err: { issues: { path: PropertyKey[]; message: string }[] }): ConfigError {
  return new ConfigError(file, err.issues.map((i) => ({ path: i.path.map(String).join('.') || '(raiz)', message: i.message })));
}

/**
 * Cadastra um novo tamanho no catalog.yaml a partir de um formato-base, preservando os
 * comentários do arquivo. Valida o catálogo inteiro antes de gravar; nada é escrito se falhar.
 */
export function addFormat(p: Paths, input: NewFormatInput): Format {
  const file = join(p.root, 'formats', 'catalog.yaml');
  const doc = parseDocument(readFileSync(file, 'utf8'), { merge: true, lineCounter: new LineCounter() });
  const current = Catalog.parse(doc.toJS({ maxAliasCount: -1 }));
  const base = current.formatos.find((f) => f.id === input.base);
  if (!base) throw new Error(`formato-base "${input.base}" não existe no catálogo`);
  if (!(input.w > 0 && input.h > 0)) throw new Error('largura e altura precisam ser maiores que zero');

  const id = input.id ? slugify(input.id) : `${base.id.replace(/-\d+(x\d+)?$/, '')}-${fmt(input.w)}x${fmt(input.h)}`;
  if (current.formatos.some((f) => f.id === id)) throw new Error(`já existe um formato com id "${id}"`);

  // copia a base, mas descarta o que depende da geometria específica dela
  const { janela_transparente, zonas, area_segura, area_conteudo, arquetipo, ...specs } = base;
  void janela_transparente; void zonas; void area_segura; void area_conteudo; void arquetipo;
  const novo: Format = {
    ...specs,
    id,
    nome_apresentacao: input.nome_apresentacao.trim(),
    medida: { w: input.w, h: input.h },
    ...(input.grupo ? { grupo: input.grupo } : {}),
    ...(input.faces ? { faces: input.faces } : {}),
    observacao: input.observacao ?? `cadastrado a partir de ${base.id}`,
  };

  const candidate = { ...current, formatos: [...current.formatos, novo] };
  const check = Catalog.safeParse(candidate);
  if (!check.success) throw zodIssues(file, check.error);

  const seq = doc.get('formatos') as YAMLSeq;
  const node = doc.createNode(novo) as YAMLMap;
  // coleções pequenas em estilo compacto ({ w: 500, h: 60 }, [pdf-x1a, pacote]) como no resto do arquivo
  for (const pair of node.items) {
    const v = pair.value;
    if ((isMap(v) || isSeq(v)) && v.items.length <= 6 && v.items.every((i) => isScalar(isMap(v) ? (i as { value: unknown }).value : i))) v.flow = true;
  }
  seq.add(node);
  writeFileSync(file, doc.toString({ lineWidth: 0 }));
  return check.data.formatos.at(-1)!;
}

export interface NewCampaignInput {
  slug?: string;
  nome: string;
  brand: string;
  phases?: string[];
  proprietaria?: boolean;
  titulo?: string | null;
  subtitulo?: string | null;
  cta?: string | null;
}

/** Cria campaigns/<slug>/campaign.yaml (rascunho) a partir do zero. Não sobrescreve. */
export function createCampaign(p: Paths, input: NewCampaignInput) {
  loadBrand(p, input.brand); // a marca precisa existir e ser válida
  const slug = slugify(input.slug || input.nome);
  if (!slug) throw new Error('nome da campanha inválido');
  const dir = join(p.root, 'campaigns', slug);
  const file = join(dir, 'campaign.yaml');
  if (existsSync(file)) throw new Error(`a campanha "${slug}" já existe`);
  const phases = (input.phases?.length ? input.phases : [slug]).map(slugify).filter(Boolean);

  const data = {
    slug,
    brand: input.brand,
    nome: input.nome.trim(),
    status: 'rascunho' as const,
    proprietaria: input.proprietaria ?? true,
    phases,
    extra_colors: [],
    cubo_arte: 'continua' as const,
    roles: {
      fundo: null,
      imagem_principal: null,
      elementos_apoio: [],
      gimmick: null,
      lettering: null,
      conceito_tipografico: null,
      logo: { auto: true, slogan: true },
      produtos: [],
      selos: [],
    },
    copy: { titulo: input.titulo ?? null, subtitulo: input.subtitulo ?? null, cta: input.cta ?? null, contexto: null },
    regras_composicao: [],
    pendencias: ['KV-mestre (.psd/.ai/.indd) — rodar a ingestão para preencher os papéis', 'Peças-diretriz (uma por arquétipo)'],
  };
  const check = Campaign.safeParse(data);
  if (!check.success) throw zodIssues(file, check.error);
  mkdirSync(dir, { recursive: true });
  const header = `# campaign.yaml — RASCUNHO criado pelo desdobrador. Os papéis do sistema visual\n# são preenchidos pela ingestão do KV-mestre e confirmados antes do desdobramento.\n`;
  writeFileSync(file, header + stringify(data, { lineWidth: 0 }));
  return check.data;
}
