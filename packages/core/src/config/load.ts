import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseDocument, LineCounter } from 'yaml';
import type { z } from 'zod';
import { Brand } from '../model/brand.js';
import { Catalog } from '../model/catalog.js';
import { Campaign } from '../model/campaign.js';

export class ConfigError extends Error {
  constructor(
    public readonly file: string,
    public readonly issues: { path: string; line?: number; message: string }[],
  ) {
    super(`${file}: ${issues.length} erro(s)\n` + issues.map((i) => `  - ${i.path}${i.line ? ` (linha ${i.line})` : ''}: ${i.message}`).join('\n'));
    this.name = 'ConfigError';
  }
}

/** Lê um YAML (com merge keys `<<`), valida com o schema e aponta linha/campo nos erros. */
export function loadYaml<S extends z.ZodType>(file: string, schema: S): z.infer<S> {
  const text = readFileSync(file, 'utf8');
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { merge: true, lineCounter, prettyErrors: true });
  if (doc.errors.length) {
    throw new ConfigError(file, doc.errors.map((e) => ({ path: '(sintaxe)', line: e.linePos?.[0]?.line, message: e.message })));
  }
  const result = schema.safeParse(doc.toJS({ maxAliasCount: -1 }));
  if (result.success) return result.data;
  throw new ConfigError(
    file,
    result.error.issues.map((iss) => {
      const node = doc.getIn(iss.path as (string | number)[], true) as { range?: [number, number, number] } | undefined;
      const line = node?.range ? lineCounter.linePos(node.range[0]).line : undefined;
      return { path: iss.path.join('.') || '(raiz)', line, message: iss.message };
    }),
  );
}

export interface Paths {
  root: string;
  inputs: string;
}

export function resolvePaths(root = process.cwd()): Paths {
  const r = resolve(root);
  return { root: r, inputs: resolve(r, process.env.DESDOBRADOR_INPUTS ?? 'inputs') };
}

export const loadBrand = (p: Paths, slug: string) => loadYaml(join(p.root, 'brands', slug, 'brand.yaml'), Brand);
export const loadCatalog = (p: Paths) => loadYaml(join(p.root, 'formats', 'catalog.yaml'), Catalog);
export function loadCampaign(p: Paths, slug: string) {
  const file = join(p.root, 'campaigns', slug, 'campaign.yaml');
  if (!existsSync(file)) throw new Error(`campanha não encontrada: ${file}`);
  return loadYaml(file, Campaign);
}
