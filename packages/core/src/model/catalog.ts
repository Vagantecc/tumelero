import { z } from 'zod';
import { Archetype, Rect } from './common.js';

const Range = z
  .object({ min: z.number().positive(), max: z.number().positive() })
  .refine((r) => r.min <= r.max, 'min > max');

const PpiTier = z.enum(['pequeno', 'medio', 'grande']);

const Faca = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('gabarito'), id: z.string() }),
  z.object({
    tipo: z.literal('especial'),
    origem: z.array(z.string()).min(1),
    offset_mm: z.number().min(3).max(5),
    angulo_min_graus: z.number().positive(),
  }),
]);

const Frame = z.object({ id: z.string(), conteudo: z.string(), duracao_s: z.number().positive() });

const Video = z.object({
  codec: z.literal('h264'),
  perfil: z.string(),
  fps: z.number().int().positive(),
  bitrate_kbps: z.number().int().positive(),
  dpi: z.number().int().positive(),
  pix_fmt: z.string(),
  transicao: z.string(),
  telas: z.array(z.object({ id: z.string(), duracao_s: z.number().positive() })).min(1),
});

export const SAIDAS = ['pdf-x1a', 'pacote', 'previa-png', 'png', 'png-alfa', 'jpg', 'gif', 'mp4', 'png-telas'] as const;

export const Format = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    nome_apresentacao: z.string(),
    grupo: z.string(),
    unidade: z.enum(['cm', 'mm', 'px']),
    medida: z.object({ w: z.number().positive(), h: z.number().positive() }),
    colorspace: z.enum(['cmyk', 'rgb']),
    app: z.enum(['indesign', 'photoshop', 'illustrator']),
    saidas: z.array(z.enum(SAIDAS)).min(1),
    faces: z.union([z.literal(1), z.literal(2)]).default(1),
    partes: z.number().int().positive().optional(),
    sangria_mm: z.number().min(0).optional(),
    margem_seguranca_mm: z.number().min(0).optional(),
    margem_dobra_mm: z.number().min(0).optional(),
    ppi_tier: PpiTier.optional(),
    distancia_leitura_m: Range.optional(),
    palavras_max: z.number().int().positive().optional(),
    faca: Faca.optional(),
    espelhar: z.boolean().optional(),
    visto_dos_dois_lados: z.boolean().optional(),
    observacao: z.string().optional(),
    limite_bytes: z.number().int().positive().optional(),
    arquetipo: z.union([Archetype, z.literal('banner-l')]).optional(),
    janela_transparente: Rect.optional(),
    zonas: z.record(z.string(), Rect.extend({ conteudo: z.array(z.string()) })).optional(),
    area_segura: Rect.optional(),
    area_conteudo: Rect.optional(),
    frames: z.array(Frame).optional(),
    video: Video.optional(),
    variants: z.array(z.string()).optional(),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.colorspace === 'cmyk') {
      for (const k of ['sangria_mm', 'margem_seguranca_mm', 'ppi_tier', 'distancia_leitura_m'] as const) {
        if (f[k] === undefined) ctx.addIssue({ code: 'custom', message: `impresso exige ${k}`, path: [k] });
      }
      if (f.unidade === 'px') ctx.addIssue({ code: 'custom', message: 'impresso não pode ser em px', path: ['unidade'] });
      if (f.espelhar) ctx.addIssue({ code: 'custom', message: 'arte nunca é espelhada (só contorno de faca)', path: ['espelhar'] });
    } else {
      if (f.unidade !== 'px') ctx.addIssue({ code: 'custom', message: 'digital deve ser em px', path: ['unidade'] });
    }
    if (f.saidas.includes('gif') && !f.frames?.length) ctx.addIssue({ code: 'custom', message: 'GIF exige frames', path: ['frames'] });
    if (f.saidas.includes('mp4') && !f.video) ctx.addIssue({ code: 'custom', message: 'MP4 exige video', path: ['video'] });
    const inside = (r: z.infer<typeof Rect>, path: string) => {
      if (r.x < 0 || r.y < 0 || r.x + r.w > f.medida.w || r.y + r.h > f.medida.h) {
        ctx.addIssue({ code: 'custom', message: `${path} sai do formato`, path: [path] });
      }
    };
    if (f.janela_transparente) inside(f.janela_transparente, 'janela_transparente');
    if (f.area_segura) inside(f.area_segura, 'area_segura');
    if (f.area_conteudo) inside(f.area_conteudo, 'area_conteudo');
  });

export const Catalog = z
  .object({
    regras: z.object({
      escala: z.object({ reduzida: z.number().positive().max(1), se_algum_lado_cm_maior_ou_igual: z.number().positive(), sufixo: z.string() }),
      ppi: z.record(PpiTier, z.object({ minimo: z.number().positive(), ideal: z.number().positive() })),
      legibilidade: z.object({
        caixa_alta_mm_por_10m: z.number().positive(),
        apoio_fracao: z.number().positive().max(1),
        palavras_max_lona: z.number().int().positive(),
        digital_texto_min_px: z.number().positive(),
      }),
      digital: z.object({ ppi_metadado: z.number().positive(), supersampling: z.number().int().min(1).max(4) }),
      previa: z.object({ max_bytes: z.number().int().positive(), min_lado_maior_px: z.number().int().positive() }),
      gif: z.object({ duracao_total_s: z.number().positive(), loop: z.number().int().min(0), max_bytes: z.number().int().positive() }),
    }),
    grupos: z.record(z.string(), z.object({ secao_apresentacao: z.string() })),
    formatos: z.array(Format).min(1),
  })
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    c.formatos.forEach((f, i) => {
      if (seen.has(f.id)) ctx.addIssue({ code: 'custom', message: `id duplicado: ${f.id}`, path: ['formatos', i, 'id'] });
      seen.add(f.id);
      if (!c.grupos[f.grupo]) ctx.addIssue({ code: 'custom', message: `grupo inexistente: ${f.grupo}`, path: ['formatos', i, 'grupo'] });
      if (f.frames) {
        const total = f.frames.reduce((s, fr) => s + fr.duracao_s, 0);
        if (Math.abs(total - c.regras.gif.duracao_total_s) > 1e-9) {
          ctx.addIssue({ code: 'custom', message: `frames somam ${total}s, esperado ${c.regras.gif.duracao_total_s}s`, path: ['formatos', i, 'frames'] });
        }
      }
    });
  });

export type Format = z.infer<typeof Format>;
export type Catalog = z.infer<typeof Catalog>;
