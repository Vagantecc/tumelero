/**
 * Escritor de Adobe Swatch Exchange (.ase) — formato binário big-endian, v1.0.
 * Usado para gerar os swatches de impressão (CMYK do MIV, como processo) e digitais (RGB).
 */
export interface AseSwatch {
  name: string;
  model: 'CMYK' | 'RGB';
  /** CMYK em 0–100, RGB em 0–255 */
  values: number[];
  type: 'global' | 'spot' | 'process';
}

const TYPE_CODE = { global: 0, spot: 1, process: 2 } as const;

function nameBytes(name: string): Buffer {
  const b = Buffer.alloc((name.length + 1) * 2);
  for (let i = 0; i < name.length; i++) b.writeUInt16BE(name.charCodeAt(i), i * 2);
  return b; // termina com 0x0000
}

function colorBlock(s: AseSwatch): Buffer {
  const nb = nameBytes(s.name);
  const vals = s.model === 'CMYK' ? s.values.map((v) => v / 100) : s.values.map((v) => v / 255);
  const body = Buffer.alloc(2 + nb.length + 4 + vals.length * 4 + 2);
  let o = 0;
  o = body.writeUInt16BE(s.name.length + 1, o);
  nb.copy(body, o);
  o += nb.length;
  o += body.write(s.model === 'CMYK' ? 'CMYK' : 'RGB ', o, 'ascii');
  for (const v of vals) o = body.writeFloatBE(v, o);
  body.writeUInt16BE(TYPE_CODE[s.type], o);
  const head = Buffer.alloc(6);
  head.writeUInt16BE(0x0001, 0);
  head.writeUInt32BE(body.length, 2);
  return Buffer.concat([head, body]);
}

function groupStart(name: string): Buffer {
  const nb = nameBytes(name);
  const body = Buffer.alloc(2 + nb.length);
  body.writeUInt16BE(name.length + 1, 0);
  nb.copy(body, 2);
  const head = Buffer.alloc(6);
  head.writeUInt16BE(0xc001, 0);
  head.writeUInt32BE(body.length, 2);
  return Buffer.concat([head, body]);
}

const groupEnd = () => Buffer.from([0xc0, 0x02, 0, 0, 0, 0]);

export function writeAse(group: string, swatches: AseSwatch[]): Buffer {
  const blocks = [groupStart(group), ...swatches.map(colorBlock), groupEnd()];
  const head = Buffer.alloc(12);
  head.write('ASEF', 0, 'ascii');
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(0, 6);
  head.writeUInt32BE(blocks.length, 8);
  return Buffer.concat([head, ...blocks]);
}

/** Leitor mínimo (para testes e para o validador conferir os .ase gerados). */
export function readAse(buf: Buffer): AseSwatch[] {
  if (buf.toString('ascii', 0, 4) !== 'ASEF') throw new Error('não é um arquivo ASE');
  const n = buf.readUInt32BE(8);
  const out: AseSwatch[] = [];
  let o = 12;
  for (let i = 0; i < n; i++) {
    const type = buf.readUInt16BE(o);
    const len = buf.readUInt32BE(o + 2);
    const start = o + 6;
    if (type === 0x0001) {
      const nlen = buf.readUInt16BE(start);
      let name = '';
      for (let k = 0; k < nlen - 1; k++) name += String.fromCharCode(buf.readUInt16BE(start + 2 + k * 2));
      let p = start + 2 + nlen * 2;
      const model = buf.toString('ascii', p, p + 4).trim() as 'CMYK' | 'RGB';
      p += 4;
      const count = model === 'CMYK' ? 4 : 3;
      const scale = model === 'CMYK' ? 100 : 255;
      const values: number[] = [];
      for (let k = 0; k < count; k++) values.push(Math.round(buf.readFloatBE(p + k * 4) * scale * 100) / 100);
      p += count * 4;
      const t = buf.readUInt16BE(p);
      out.push({ name, model, values, type: t === 0 ? 'global' : t === 1 ? 'spot' : 'process' });
    }
    o = start + len;
  }
  return out;
}
