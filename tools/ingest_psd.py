# Ingestão de PSD (protótipo do M2): árvore de layers + miniaturas + prévia do KV.
# Uso: python3 tools/ingest_psd.py <arquivo.psd> <campanha>
# Saída: campaigns/<campanha>/_ingest/{layers.json, kv.jpg, layer_<i>.png}
import json, os, sys
from psd_tools import PSDImage

psd_path, slug = sys.argv[1], sys.argv[2]
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
out = os.path.join(root, 'campaigns', slug, '_ingest')
os.makedirs(out, exist_ok=True)
psd = PSDImage.open(psd_path)
kv = psd.composite().convert('RGB'); kv.thumbnail((1600, 1600)); kv.save(os.path.join(out, 'kv.jpg'), quality=85)
layers = []
for i, l in enumerate(psd):
    info = {'index': i, 'name': l.name, 'kind': l.kind, 'visible': l.visible, 'bbox': list(l.bbox)}
    if l.kind == 'type':
        try:
            info['text'] = str(l.text)
            info['fonts'] = [str(f['Name']) for f in l.resource_dict['FontSet'] if str(f['Name']) != 'AdobeInvisFont']
        except Exception:
            pass
    if l.kind == 'smartobject':
        so = l.smart_object
        info['smart_object'] = {'filename': str(so.filename), 'filetype': str(so.filetype)}
    try:
        if l.kind == 'smartobject' and l.bbox == (0, 0, psd.width, psd.height):
            keep = {id(psd[0]), id(l)}
            im = psd.composite(layer_filter=lambda x: id(x) in keep)
        else:
            im = l.composite()
        if im is not None:
            im.thumbnail((480, 480)); im.save(os.path.join(out, f'layer_{i}.png'))
            info['thumb'] = f'layer_{i}.png'
    except Exception as e:
        info['thumb_error'] = str(e)
    layers.append(info)
meta = {'file': os.path.basename(psd_path), 'width': psd.width, 'height': psd.height,
        'color_mode': str(psd.color_mode), 'depth': psd.depth, 'layers': layers}
json.dump(meta, open(os.path.join(out, 'layers.json'), 'w'), ensure_ascii=False, indent=2)
print(f'{len(layers)} layers → {out}')
