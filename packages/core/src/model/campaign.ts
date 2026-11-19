import { z } from 'zod';
import { Cmyk, Rgb } from './common.js';

const Asset = z.string().min(1);
const HV = z.object({ horizontal: Asset.nullable().optional(), vertical: Asset.nullable().optional() });

export const Campaign = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    brand: z.string(),
    nome: z.string(),
    status: z.enum(['rascunho', 'confirmado']).default('rascunho'),
    proprietaria: z.boolean().default(true),
    phases: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1),
    dominancia_por_fase: z.record(z.string(), z.string()).default({}),
    extra_colors: z
      .array(z.object({ name: z.string(), cmyk: Cmyk, rgb: Rgb, phases: z.array(z.string()).min(1) }))
      .default([]),
    cubo_arte: z.enum(['continua', 'por_face']).default('continua'),
    roles: z
      .object({
        fundo: z.object({ file: Asset.nullable(), variants: HV.optional(), extensible: z.boolean().default(true) }).nullable(),
        imagem_principal: z.object({ file: Asset.nullable(), focal_point: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]) }).nullable(),
        elementos_apoio: z.array(z.object({ file: Asset, nome: z.string(), recortavel: z.boolean().default(true) })),
        gimmick: HV.nullable(),
        lettering: HV.extend({ by_phase: z.record(z.string(), HV).default({}) }).nullable(),
        conceito_tipografico: z.object({ text: z.string(), style: z.string() }).nullable(),
        logo: z.object({ auto: z.boolean() }),
        produtos: z.array(z.object({ file: Asset, nome: z.string(), preco: z.string().nullable(), condicao: z.string().nullable() })),
        selos: z.array(z.string()),
      })
      .partial({ elementos_apoio: true, produtos: true, selos: true }),
    copy: z.object({
      titulo: z.string().nullable(),
      subtitulo: z.string().nullable(),
      cta: z.string().nullable(),
      contexto: z.string().nullable().optional(),
    }),
    pendencias: z.array(z.string()).default([]),
  })
  .superRefine((c, ctx) => {
    const phases = new Set(c.phases);
    c.extra_colors.forEach((col, i) =>
      col.phases.forEach((p, j) => {
        if (!phases.has(p)) ctx.addIssue({ code: 'custom', message: `fase "${p}" não declarada`, path: ['extra_colors', i, 'phases', j] });
      }),
    );
    for (const p of Object.keys(c.dominancia_por_fase)) {
      if (!phases.has(p)) ctx.addIssue({ code: 'custom', message: `fase "${p}" não declarada`, path: ['dominancia_por_fase', p] });
    }
    for (const p of Object.keys(c.roles.lettering?.by_phase ?? {})) {
      if (!phases.has(p)) ctx.addIssue({ code: 'custom', message: `fase "${p}" não declarada`, path: ['roles', 'lettering', 'by_phase', p] });
    }
  });

export type Campaign = z.infer<typeof Campaign>;
