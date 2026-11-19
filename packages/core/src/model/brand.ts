import { z } from 'zod';
import { Archetype, Cmyk, Hex, Rgb } from './common.js';

export const BrandColor = z
  .object({
    pantone: z.string().nullable(),
    cmyk: Cmyk,
    rgb: Rgb,
    hex: Hex,
    papel: z.string(),
    proporcao: z.number().min(0).max(100),
  })
  .superRefine((c, ctx) => {
    const hex = '#' + c.rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    if (hex !== c.hex.toUpperCase()) {
      ctx.addIssue({ code: 'custom', message: `HEX ${c.hex} não bate com RGB ${c.rgb.join('-')} (${hex})`, path: ['hex'] });
    }
  });

const LogoVariantColor = z.object({
  lettering: z.string(),
  casa: z.string(),
  t_casa: z.string(),
  slogan: z.string(),
  fundos: z.array(z.string()).min(1),
});

export const LOGO_VERSIONS = ['horizontal', 'vertical'] as const;
const LogoVersion = z.enum(LOGO_VERSIONS);

const LogoFile = z.object({
  versao: LogoVersion,
  variante: z.string(),
  slogan: z.boolean(),
  espaco: z.enum(['cmyk', 'rgb']),
  formato: z.enum(['pdf', 'svg', 'ai']),
  arquivo: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

const Size = z.object({ impresso_mm: z.number().positive(), digital_px: z.number().positive() });

export const Brand = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    nome: z.string(),
    fonte_miv: z.string(),
    site: z.string().optional(),
    prefixo_arquivo: z.string().regex(/^[A-Z0-9]{2,6}$/),
    cores: z.record(z.string(), BrandColor),
    regras_cor: z.object({
      proporcao_padrao: z.record(z.string(), z.number()),
      campanha_proprietaria_dominante: z.string(),
      tolerancia_delta_e: z.number().positive(),
      preto_texto_pequeno: Cmyk,
      preto_rico_fundo: Cmyk,
      divergencias: z.array(z.record(z.string(), z.unknown())).default([]),
    }),
    tipografia: z.object({
      familia: z.string(),
      adobe_fonts: z.string().url().optional(),
      estilos_permitidos: z.array(z.string()).min(1),
      nome_campanha: z.object({ estilo: z.string(), caixa: z.enum(['alta', 'baixa', 'livre']) }),
      hierarquia: z.array(z.string()),
      preco: z.record(z.string(), z.record(z.string(), z.unknown())),
      percentual: z.record(z.string(), z.record(z.string(), z.unknown())),
      fontes_so_no_guia: z.array(z.string()).default([]),
    }),
    logo: z.object({
      observacao: z.string().optional(),
      versao_principal: LogoVersion,
      slogan: z.object({ texto: z.string(), regra: z.string() }),
      variantes_cor: z.record(z.string(), LogoVariantColor),
      escolha_cor: z.object({
        delta_e_limite: z.number().positive(),
        prioridade_fundo_claro: z.array(z.string()).min(1),
        prioridade_fundo_escuro: z.array(z.string()).min(1),
        contraste_minimo: z.number().positive(),
      }),
      por_arquetipo: z.record(
        Archetype,
        z.object({
          permitidas: z.array(LogoVersion).min(1),
          preferida: LogoVersion.optional(),
          vertical_se: z.string().optional(),
        }),
      ),
      area_seguranca: z.object({
        unidade: z.literal('casa'),
        x_sobre_altura_logo_h: z.number().positive().nullable(),
        x_sobre_altura_logo_v: z.number().positive().nullable(),
      }),
      tamanho_minimo: z.object({ horizontal: Size, vertical: Size, fonte: z.string() }),
      proporcoes: z.object({ horizontal: z.number().positive().nullable(), vertical: z.number().positive().nullable() }),
      arquivos: z.array(LogoFile),
      paginas_miv: z.record(z.string(), z.number().int().positive()),
    }),
    elementos: z.object({
      icones: z.object({ estilo: z.string(), cores_permitidas: z.array(z.string()), arquivos: z.array(z.unknown()) }),
      casa: z.object({ descricao: z.string(), arquivos: z.array(z.unknown()) }),
    }),
    fotografia: z.object({ diretrizes: z.array(z.string()), nao_usar: z.string().optional() }),
    linguagem: z.object({
      tratamento: z.string(),
      pronomes_preferidos: z.array(z.string()),
      pronomes_alerta: z.array(z.string()),
      termos_proprietarios: z.array(z.string()).min(1),
      palavras_chave: z.record(z.string(), z.array(z.string())),
      assinaturas: z.array(z.string()),
      frases_proibidas: z.array(z.string()),
      exemplos_bons: z.array(z.string()).default([]),
    }),
  })
  .superRefine((b, ctx) => {
    const colors = new Set(Object.keys(b.cores));
    // Toda cor referenciada nas variantes do logo precisa existir na paleta.
    for (const [name, v] of Object.entries(b.logo.variantes_cor)) {
      for (const key of ['lettering', 'casa', 't_casa', 'slogan'] as const) {
        if (!colors.has(v[key])) {
          ctx.addIssue({ code: 'custom', message: `cor "${v[key]}" não existe em cores`, path: ['logo', 'variantes_cor', name, key] });
        }
      }
      v.fundos.forEach((f, i) => {
        if (!colors.has(f)) ctx.addIssue({ code: 'custom', message: `fundo "${f}" não existe em cores`, path: ['logo', 'variantes_cor', name, 'fundos', i] });
      });
    }
    const variants = new Set(Object.keys(b.logo.variantes_cor));
    for (const list of ['prioridade_fundo_claro', 'prioridade_fundo_escuro'] as const) {
      b.logo.escolha_cor[list].forEach((v, i) => {
        if (!variants.has(v)) ctx.addIssue({ code: 'custom', message: `variante "${v}" não existe`, path: ['logo', 'escolha_cor', list, i] });
      });
    }
    // Regra do MIV: vertical proibida em horizontais e 1:1.
    for (const a of ['ultra-horizontal', 'horizontal', 'quase-quadrado'] as const) {
      if (b.logo.por_arquetipo[a]?.permitidas.includes('vertical')) {
        ctx.addIssue({ code: 'custom', message: `MIV proíbe logo vertical em ${a}`, path: ['logo', 'por_arquetipo', a] });
      }
    }
    const total = Object.values(b.regras_cor.proporcao_padrao).reduce((s, n) => s + n, 0);
    if (total !== 100) ctx.addIssue({ code: 'custom', message: `proporcao_padrao soma ${total}, esperado 100`, path: ['regras_cor', 'proporcao_padrao'] });
    if (!colors.has(b.regras_cor.campanha_proprietaria_dominante)) {
      ctx.addIssue({ code: 'custom', message: 'cor dominante inexistente', path: ['regras_cor', 'campanha_proprietaria_dominante'] });
    }
  });

export type Brand = z.infer<typeof Brand>;
