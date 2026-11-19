# Desdobrador de peças Adobe — HOC

Desdobra uma campanha a partir do KV-mestre em todas as peças impressas e digitais,
valida contra o MIV da marca e monta a apresentação de aprovação. Plano completo: [`PLAN.md`](PLAN.md).

## Uso rápido
```bash
pnpm install
pnpm desdobrador check --campaign aniversario-black-2026   # valida as configs
pnpm desdobrador formats                                   # catálogo com escala, ppi e arquétipo
pnpm desdobrador swatches                                  # gera os .ase da marca
pnpm test
```

Inputs (KV, MIV, facas) ficam fora do git, numa pasta do Google Drive. Aponte com
`DESDOBRADOR_INPUTS` (ver `.env.example`). Os scripts Adobe rodam num Mac com
InDesign/Photoshop/Illustrator e a Objektiv Mk3 ativa.
