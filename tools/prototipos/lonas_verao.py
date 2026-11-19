# PROTÓTIPO (raster, sem Adobe): valida a composição das lonas ultra-horizontais do Verão.
# Vai virar o arquétipo ultra-horizontal do motor de layout (M3). Requer: pip install psd-tools numpy pillow
# Rascunho v3: foto expandida (Adobe Generative Expand) no canto, VERÃO sobre a imagem,
# conceito em 2 linhas + logo no bloco azul. Sem slogan (orientação 19/11).
from psd_tools import PSDImage
from PIL import Image
import numpy as np
import os; ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT=os.path.join(ROOT,'outputs/verao-2026/_rascunho'); os.makedirs(OUT, exist_ok=True)
psd = PSDImage.open(os.path.join(os.environ.get('DESDOBRADOR_INPUTS', os.path.join(ROOT,'inputs')),'kv/kv.psd'))
letter = psd[3].composite().convert('RGBA')
logo = psd[5].composite().convert('RGBA')
concept = psd[4].composite().convert('RGBA')
photo = Image.open(os.path.join(ROOT,'campaigns/verao-2026/assets/foto_cena_expandida_adobe.png')).convert('RGB')
MASCOT_X = (1500 + 0.53*4330) / photo.width      # mascote na foto expandida
AZUL = (7, 43, 171)

def trim(im):
    return im.crop(im.getbbox())

def two_lines(im):
    a = np.array(im)[:, :, 3].sum(axis=0)
    gaps, run = [], None
    for x, v in enumerate(a):
        if v == 0 and run is None: run = x
        if v != 0 and run is not None:
            if x - run > im.height*0.28: gaps.append((run + x)//2)   # só espaços entre palavras
            run = None
    mid = im.width/2
    g = min(gaps, key=lambda x: abs(x - mid))
    l1, l2 = trim(im.crop((0, 0, g, im.height))), trim(im.crop((g, 0, im.width, im.height)))
    lead = int(l1.height*0.45)
    out = Image.new('RGBA', (max(l1.width, l2.width), l1.height + l2.height + lead), (0,0,0,0))
    out.paste(l1, ((out.width-l1.width)//2, 0), l1)
    out.paste(l2, ((out.width-l2.width)//2, l1.height+lead), l2)
    return out

letter, logo, concept = trim(letter), trim(logo), trim(concept)
concept2 = two_lines(concept)
rs = lambda im, h: im.resize((max(1,int(im.width*h/im.height)), max(1,int(h))), Image.LANCZOS)

def lona(name, w_cm, h_cm, ppc):
    W, H = int(w_cm*ppc), int(h_cm*ppc)
    m = H*0.12
    img = Image.new('RGB', (W, H), AZUL)
    ratio_w = W/H
    pw = int(min(W*(0.42 if ratio_w > 6 else 0.38), H*photo.width/photo.height))
    # recorte da foto: mascote a ~38% da largura do canto (o lettering cobre a borda direita)
    ch = photo.height; cw = int(ch*pw/H)
    cx0 = int(MASCOT_X*photo.width - 0.38*cw); cx0 = max(0, min(cx0, photo.width-cw))
    img.paste(photo.crop((cx0, 0, cx0+cw, ch)).resize((pw, H), Image.LANCZOS), (0, 0))
    over = 0.45 if ratio_w > 6 else 0.22    # quanto do lettering avança sobre a foto
    cap = 0.78 if ratio_w > 6 else 0.62
    for lh_f in [0.78, 0.72, 0.66, 0.6, 0.55, 0.5, 0.45, 0.4]:
        if lh_f > cap: continue
        lt = rs(letter, H*lh_f)
        lx = int(pw - lt.width*over)
        x_free = lx + lt.width + m
        lg = rs(logo, min(H*0.30, lt.width*0.62*logo.height/logo.width))
        zone = W - m*1.5 - x_free
        # lado a lado: conceito (2 linhas) + logo
        ch2 = rs(concept2, min(H*0.46, lt.height*0.62))
        if ch2.width + m + lg.width <= zone:
            layout = 'linha'; break
        # empilhado: logo em cima, conceito em 1 linha embaixo, ambos dimensionados pela zona livre
        la_logo = logo.width/logo.height
        gh = min(H*0.36, zone*0.72/la_logo)
        lg = rs(logo, gh)
        cw = min(zone*0.95, lg.width*1.3)
        c1 = concept.resize((int(cw), max(1, int(cw*concept.height/concept.width))), Image.LANCZOS)
        if c1.height < H*0.06:   # 1 linha fina demais → conceito em 2 linhas
            cw2 = min(zone*0.95, lg.width*1.05)
            c1 = concept2.resize((int(cw2), max(1, int(cw2*concept2.height/concept2.width))), Image.LANCZOS)
        if lg.height + c1.height + m*0.8 <= H - 2*m:
            layout = 'pilha'; break
    img.paste(lt, (lx, int((H-lt.height)/2)), lt)
    if layout == 'linha':
        gap = (zone - ch2.width - lg.width)/3
        cx = x_free + gap
        img.paste(ch2, (int(cx), int((H-ch2.height)/2)), ch2)
        img.paste(lg, (int(W - m*1.5 - lg.width), int((H-lg.height)/2)), lg)
    else:
        bh = lg.height + c1.height + m*0.8; y = (H-bh)/2
        cxz = x_free + (zone - max(lg.width, c1.width))/2
        img.paste(lg, (int(cxz + (max(lg.width,c1.width)-lg.width)/2), int(y)), lg)
        img.paste(c1, (int(cxz + (max(lg.width,c1.width)-c1.width)/2), int(y+lg.height+m*0.8)), c1)
    img.save(f'{OUT}/{name}.png'); print(name, layout, 'lettering', lh_f, 'foto', round(pw/W*100), '%')

lona('lona-800x80_rascunho_v5', 800, 80, 5)
lona('lona-600x70_rascunho_v5', 600, 70, 6)
lona('lona-300x70_rascunho_v5', 300, 70, 10)
