# Desdobrador de peças Adobe — HOC

Desdobra uma campanha a partir do KV-mestre em todas as peças impressas e digitais,
valida contra o MIV da marca e monta a apresentação de aprovação. Plano completo: [`PLAN.md`](PLAN.md).

## Uso rápido
```bash
pnpm install
pnpm desdobrador check --campaign aniversario-black-2026   # valida as configs
pnpm desdobrador formats                                   # catálogo com escala, ppi e arquétipo
pnpm desdobrador swatches                                  # gera os .ase da marca
pnpm desdobrador formato-novo --base lona-300x70 --nome Lona --largura 500 --altura 60
pnpm desdobrador campanha-nova --nome "Inverno" --fases "lancamento,saldao"
pnpm test
pnpm ui                                                     # interface local → http://localhost:5173
```

Para a interface mostrar o KV: `python3 tools/ingest_psd.py <kv.psd> <campanha>` (requer `pip install psd-tools`).

Inputs (KV, MIV, facas) ficam fora do git, numa pasta do Google Drive. Aponte com
`DESDOBRADOR_INPUTS` (ver `.env.example`). Os scripts Adobe rodam num Mac com
InDesign/Photoshop/Illustrator e a Objektiv Mk3 ativa.
