/**
 * UI local do desdobrador (v1, leitura). Servidor HTTP sem dependências que expõe as
 * configurações (marca, catálogo, campanhas), a ingestão do KV e as prévias geradas.
 *   pnpm ui            → http://localhost:5173
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, relative, sep } from 'node:path';
import {
  ConfigError,
  addFormat,
  createCampaign,
  diretrizFor,
  archetypeFor,
  compositionRuleFor,
  docScale,
  loadBrand,
  loadCampaign,
  loadCatalog,
  minCapHeightMm,
  presentationTitle,
  printGeometry,
  requiredPpi,
  resolvePaths,
  sizeLabel,
} from '@desdobrador/core';

const PORT = Number(process.env.PORT ?? 5173);
const HOST = process.env.HOST ?? '127.0.0.1'; // só local: a UI grava arquivos de configuração
const paths = resolvePaths(process.env.DESDOBRADOR_ROOT ?? join(import.meta.dirname, '..', '..', '..'));
const PUBLIC = join(import.meta.dirname, '..', 'public');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.pdf': 'application/pdf',
};

const json = (res: ServerResponse, body: unknown, status = 200) => {
  res.writeHead(status, { 'content-type': MIME['.json']!, 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const errorBody = (e: unknown) =>
  e instanceof ConfigError ? { erro: e.message, issues: e.issues } : { erro: e instanceof Error ? e.message : String(e) };

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function listCampaigns() {
  const dir = join(paths.root, 'campaigns');
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, 'campaign.yaml')))
    .map((slug) => {
      try {
        const c = loadCampaign(paths, slug);
        return { slug, nome: c.nome, status: c.status, fases: c.phases, ok: true };
      } catch (e) {
        return { slug, ok: false, ...errorBody(e) };
      }
    });
}

function campaignDetail(slug: string) {
  const c = loadCampaign(paths, slug);
  const ingestFile = join(paths.root, 'campaigns', slug, '_ingest', 'layers.json');
  const ingest = existsSync(ingestFile) ? JSON.parse(readFileSync(ingestFile, 'utf8')) : null;
  // papel de cada layer: varre os roles atrás de referências "kv.psd#<i>"
  const roleByLayer: Record<number, string[]> = {};
  const scan = (v: unknown, path: string) => {
    if (typeof v === 'string') {
      const m = v.match(/#(\d+)$/);
      if (m) (roleByLayer[Number(m[1])] ??= []).push(path);
    } else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) scan(x, path ? `${path}.${k}` : k);
  };
  scan(c.roles, '');
  return { campanha: c, ingest, papeis_por_layer: roleByLayer };
}

function catalogRows(slug?: string) {
  const cat = loadCatalog(paths);
  const camp = slug ? loadCampaign(paths, slug) : undefined;
  const previews = slug ? walk(join(paths.root, 'outputs', slug)).filter((p) => /\.(png|jpg|gif|mp4)$/i.test(p)) : [];
  return cat.formatos.map((f) => {
    const isPrint = f.unidade !== 'px';
    const g = isPrint ? printGeometry(f, cat) : null;
    const ppi = requiredPpi(f, cat);
    const cap = minCapHeightMm(f, cat);
    const rule = camp ? compositionRuleFor(camp.regras_composicao, f.id) : undefined;
    const files = previews
      .filter((p) => p.split(sep).pop()!.startsWith(f.id + '_') || p.split(sep).pop()!.startsWith(f.id + '.'))
      .map((p) => '/files/' + relative(paths.root, p).split(sep).join('/'));
    return {
      id: f.id,
      titulo: presentationTitle(f),
      grupo: f.grupo,
      secao: cat.grupos[f.grupo]?.secao_apresentacao ?? f.grupo,
      medida: sizeLabel(f),
      w: f.medida.w,
      h: f.medida.h,
      unidade: f.unidade,
      arquetipo: archetypeFor(f),
      app: f.app,
      cor: f.colorspace,
      saidas: f.saidas,
      escala: docScale(f, cat) === 1 ? '1:1' : '1:10',
      documento: g ? `${g.docMm.w}×${g.docMm.h} mm` : `${f.medida.w}×${f.medida.h} px`,
      sangria: g ? `${f.sangria_mm} mm (${g.bleedDocMm} no doc)` : null,
      ppi: ppi ? `${ppi.docMin} no doc (${ppi.finalMin} final)` : null,
      ppi_alerta: ppi?.abaixoReferencia ? `abaixo da referência final de ${ppi.referenciaFinal?.minimo} ppi` : null,
      diretriz: diretrizFor(f, cat),
      e_diretriz: Object.values(cat.diretrizes).includes(f.id),
      caixa_alta: cap ? `${cap.principal} mm` : null,
      limite: f.limite_bytes ? `${Math.round(f.limite_bytes / 1024)} KB` : null,
      faca: f.faca ? (f.faca.tipo === 'gabarito' ? `gabarito ${f.faca.id}` : 'especial') : null,
      regra: rule ? rule.nome : null,
      previas: files,
      status: files.length ? 'rascunho' : 'pendente',
    };
  });
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error('requisição grande demais');
  }
  return raw ? JSON.parse(raw) : {};
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function serveFile(res: ServerResponse, base: string, rel: string) {
  const p = normalize(join(base, rel));
  if (!p.startsWith(base) || !existsSync(p) || statSync(p).isDirectory()) {
    res.writeHead(404).end('não encontrado');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(p).toLowerCase()] ?? 'application/octet-stream' });
  res.end(readFileSync(p));
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (seg[0] === 'api' && req.method === 'POST') {
      const b = await readBody(req);
      if (seg[1] === 'formatos') {
        const f = addFormat(paths, {
          base: String(b.base ?? ''), nome_apresentacao: String(b.nome_apresentacao ?? ''),
          w: Number(b.w), h: Number(b.h), id: str(b.id), grupo: str(b.grupo),
          faces: b.faces ? (Number(b.faces) as 1 | 2) : undefined,
        });
        return json(res, { ok: true, formato: f }, 201);
      }
      if (seg[1] === 'campanhas') {
        const c = createCampaign(paths, {
          nome: String(b.nome ?? ''), brand: str(b.brand) ?? 'tumelero', slug: str(b.slug),
          phases: str(b.fases)?.split(',').map((x) => x.trim()), titulo: str(b.titulo), subtitulo: str(b.subtitulo), cta: str(b.cta),
        });
        return json(res, { ok: true, campanha: c }, 201);
      }
      return json(res, { erro: 'rota inexistente' }, 404);
    }
    if (seg[0] === 'api') {
      if (seg[1] === 'campanhas') return json(res, listCampaigns());
      if (seg[1] === 'campanha' && seg[2]) return json(res, campaignDetail(seg[2]));
      if (seg[1] === 'catalogo') return json(res, catalogRows(url.searchParams.get('campanha') ?? undefined));
      if (seg[1] === 'marca') return json(res, loadBrand(paths, seg[2] ?? 'tumelero'));
      return json(res, { erro: 'rota inexistente' }, 404);
    }
    if (seg[0] === 'files' && (seg[1] === 'campaigns' || seg[1] === 'outputs' || seg[1] === 'brands')) {
      // nunca serve inputs/ nem arquivos fora dessas pastas
      return serveFile(res, join(paths.root, seg[1]), seg.slice(2).join('/'));
    }
    return serveFile(res, PUBLIC, seg.length ? seg.join('/') : 'index.html');
  } catch (e) {
    return json(res, errorBody(e), req.method === 'POST' ? 400 : 500);
  }
}).listen(PORT, HOST, () => console.log(`desdobrador UI → http://localhost:${PORT}`));
