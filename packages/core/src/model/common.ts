import { z } from 'zod';

const pct = z.number().min(0).max(100);
const byte = z.number().int().min(0).max(255);

export const Cmyk = z.tuple([pct, pct, pct, pct]);
export const Rgb = z.tuple([byte, byte, byte]);
export const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'HEX no formato #RRGGBB');

export const Rect = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  descricao: z.string().optional(),
});

export const ARCHETYPES = ['ultra-horizontal', 'horizontal', 'quase-quadrado', 'vertical', 'ultravertical'] as const;
export const Archetype = z.enum(ARCHETYPES);
export type Archetype = z.infer<typeof Archetype>;

export type CmykT = z.infer<typeof Cmyk>;
export type RgbT = z.infer<typeof Rgb>;
export type RectT = z.infer<typeof Rect>;
