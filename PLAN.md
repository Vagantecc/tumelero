# PLAN.md — Desdobrador de Peças Adobe (HOC × Tumelero)

> Marco **M0**. Este documento cobre a leitura dos inputs, a arquitetura, os riscos e o plano de marcos.
> **Nenhum código foi escrito ainda.** Aguardando o seu ok para começar o M1.

---

## 1. Leitura dos inputs: o que foi recebido e o que foi confirmado

| Arquivo esperado | Status | O que verifiquei |
|---|---|---|
| `MIV_Tumelero_2026_-_v4.pdf` | ✅ recebido | 30 págs, 1920×1080 pt, gerado no InDesign 22.0 (Mac). Texto extraído e páginas 6–11 conferidas visualmente. Bate com a seção 2.1 do prompt. |
| `MIV_Tumelero_2026_-_v4.indd` | ✅ recebido (13,8 MB) | Análise estática (XMP) confirma as fontes **Objektiv Mk3**, Mk1, Cabinet Grotesk, Poppins, Raleway, Open Sans, Open Sauce One e também **Minion Pro** (não estava na lista do prompt; uso só no guia). Geometria, swatches e layers só podem ser lidos com o InDesign aberto: o INDD é binário. |
| `cubo-04mx04m_cada_face.indd` | ✅ recebido | Swatches `c0m100y100k0`, `Ciano`, `Preto`, `Papel`, `Registro` (de processo, como o prompt previa). Layers: `Layer 1`, `Layer 2`, `Camada 3`. Fontes: Objektiv Mk3 Black/Black Italic e Myriad Pro Black Cond (provavelmente nas legendas técnicas da faca). |
| `triedro.indd` | ✅ recebido | Só os swatches básicos (Preto/Papel/Registro). Um único layer: `Camada 1`. Mesmas fontes do cubo. A faca deve estar em traço preto no layer único, mas isso só se confirma com o script no M1. |
| `Banner_L.png` | ⚠️ recebido como **imagem colada** (salva como `inputs/Banner_L_ref.webp`) | 1920×1080 RGBA. A medição por alfa confirma a **janela transparente de 1378×773 px** em (0,0). Basta como gabarito. |
| `TUMELERO-2236_ANIVERSARIO_BLACK.txt` | ❌ **não recebido** | Necessário para a estrutura de seções/peças da apresentação e para popular o `campaign.yaml` de exemplo. |
| KV-mestre da campanha (.psd/.ai/.indd + assets) | ❌ **não recebido** | Bloqueia o M2 (ingestão) e os golden tests reais. Até lá uso um **KV sintético** de teste, feito por mim, sem arte de cliente. |

### Divergências e observações já registradas (vão para o relatório do M1)
1. **Laranja RGB**: o PDF publicado diz 229-**121**-63 e o INDD tem 229-**120**-63. Adoto **229-121-63 / #E5793F**.
2. **Minion Pro** aparece no INDD do MIV, além das fontes listadas. Não afeta as peças (só Mk3).
3. **Logo ≠ Objektiv digitada**: a p. 7 diz que o lettering do logo é *baseado* na Mk3, com tamanhos alterados e cantos arredondados. Logo sempre é vetor oficial e nunca é recomposto com texto. O validador precisa excluir o logo da checagem de fontes, porque ele não tem fonte.
4. **Slogan** nas aplicações (p. 11): existem versões **com e sem slogan** para cada cor. Proponho tratar como duas variantes de arquivo (`logo_h_colorida.pdf` e `logo_h_colorida_slogan.pdf`), em vez de compor o slogan com texto.
5. **Variações de cor reais** (p. 11): colorida sobre branco, branca+casa laranja sobre azul, **branca+casa azul sobre laranja**, positiva (preto) e negativa (branco sobre preto). A tabela de escolha automática usa essas cinco.
6. **Área de segurança** (p. 8): o X é a casa inteira, na mesma escala da casa do logo. A medida exata sai do vetor no M1.
7. Posicionamento (p. 26): "A Tumelero facilita a **tua obra / tua casa / tua vida**" serve como banco de assinaturas para o validador de linguagem.
8. Locução masculina, segura e animada (p. 27): fora do escopo das peças gráficas. Registro só para RÁDIO/VT.

---

## 2. Restrição de ambiente (decisão importante)

Esta sessão roda num **container Linux na nuvem, sem InDesign, Photoshop ou Illustrator**. O prompt pressupõe **macOS com os apps Adobe** (ponte `osascript`). Consequências:

| O que dá para fazer e testar aqui | O que só roda na sua máquina (Mac com Adobe) |
|---|---|
| Monorepo, CLI, modelo de dados, schemas YAML | Execução real dos `.jsx` (InDesign/Illustrator/Photoshop) |
| Motor de layout + arquétipos + `--dry-run` em SVG | Extração dos vetores do MIV e das facas (M1, parte script) |
| Pós-processo: sharp, gifsicle, ffmpeg (já instalado), qpdf/pdfcpu | PDF/X-1a real, `packageForPrint`, preflight `.idpp` |
| Validador (cores, ΔE, contraste, peso, ffprobe, linguagem) sobre arquivos | Conversão RGB→CMYK no Photoshop + relink |
| Escrita dos `.jsx` (geração por template) e testes unitários deles com mocks | Detecção de fontes ativas (Objektiv via Adobe Fonts) |

**Três caminhos possíveis (preciso da sua escolha, pergunta Q1 abaixo):**
- **A — Desenvolver aqui e rodar no seu Mac** (recomendado). Eu escrevo e testo tudo o que dá aqui; os `.jsx` rodam quando você conectar o Mac a esta sessão (Remote Control do app Claude, pasta compartilhada) ou quando você mesmo executar `desdobrador ...` localmente e me mandar os JSON de resultado.
- **B — Firefly Services (InDesign API / Photoshop API) headless**: precisa de credenciais Adobe para empresas. Cobre parte do fluxo (render, data merge, PSD). Não cobre tudo (Illustrator, `packageForPrint`, preflight completo).
- **C — Só o `--dry-run`** até haver máquina: entrega o motor e o validador, mas nenhum INDD/PSD real.

---

## 3. Arquitetura

### 3.1 Stack
- **TypeScript / Node 22**, monorepo **pnpm workspaces** + **turbo**. Testes com **vitest**. Validação de config com **zod** (gera JSON Schema para os YAMLs).
- Imagem: **sharp** (libvips) para raster; **resvg-js** para renderizar o SVG do dry-run; **gifsicle**, **ffmpeg/ffprobe**, **qpdf** + **pdfcpu** (ou `pdf-lib`) para checagens de PDF.
- Cor: **lcms2** via `little-cms` (binding) ou `colorjs.io` para ΔE2000; os perfis ICC (sRGB IEC61966-2.1, Coated FOGRA39) ficam em `packages/export/icc/`. Atenção: a licença do FOGRA39 da Adobe só permite redistribuir junto com o app, então o arquivo não vai pro repositório e o caminho é configurável.
- Fila: **fila local em SQLite** (better-sqlite3) com jobs idempotentes; chave de cache = `sha256(assets do papel + formato + fase + versão do template + versão do adapter)`.
- UI: Vite + React. MCP: `@modelcontextprotocol/sdk` (stdio).

### 3.2 Estrutura (como no prompt, com estes acréscimos)
```
desdobrador/                    (= raiz deste repo)
  apps/cli  apps/ui  apps/mcp
  packages/core/
    model/        # tipos + schemas zod (brand, campaign, catalog, job, result)
    layout/       # arquétipos, slots, solver, escolha de logo, tipografia por distância
    jobs/         # fila, cache, log por job
    plan/         # expande "run --formats grupo:pdv" em jobs concretos
  packages/adapters/
    _bridge/      # AppAdapter: interface + runner osascript/cscript + leitura de resultado JSON
    indesign/ illustrator/ photoshop/   # templates .jsx (ES3) gerados com params embutidos
    firefly-services/
    svg-dryrun/   # adapter "falso" que renderiza o layout em SVG → PNG (usado em testes e --dry-run)
  packages/export/ packages/validator/ packages/slides/
  brands/tumelero/  campaigns/<slug>/  formats/catalog.yaml  dielines/
  tests/ (unit, golden, spec)   inputs/ (gitignored)   outputs/ (gitignored)
```

### 3.3 Interface `AppAdapter` (núcleo da ponte)
```ts
interface AppAdapter {
  app: 'indesign' | 'illustrator' | 'photoshop';
  detect(): Promise<{ version: string; fonts: FontInfo[] } | null>;
  run<T>(script: ScriptId, params: object, opts: { timeoutMs: number }): Promise<ScriptResult<T>>;
}
```
- Cada `.jsx` é um template ES3 com um único bloco `var PARAMS = {...}` injetado, um `try/catch` global e escrita de `result.json` (status, erros, artefatos, métricas). Nunca usamos o retorno do `do script`, porque é frágil.
- O runner macOS executa `osascript -e 'tell application id "com.adobe.InDesign" to do script POSIX file "<jsx>" language javascript'`, com timeout, e coloca `app.scriptPreferences.userInteractionLevel = NEVER_INTERACT` no topo de todo script.
- Primeira coisa de cada job: checar se a fonte está ativa (`app.fonts.item("Objektiv Mk3\tBlack").status == FontStatus.INSTALLED`). Se não estiver → `FONT_MISSING`, e o job falha.

### 3.4 Fluxo de um `run`
```
plan (formatos × fase) → resolve arquétipo → solver de layout (slots → caixas em mm/px)
  → layout.json (independente de app)  ──┬─→ svg-dryrun  (prévia rápida / testes)
                                          └─→ adapter Adobe (constrói o doc nativo)
  → pré-export (fontes, links, RGB→CMYK, faca) → export → pós-processo (export pkg)
  → validador → validacao.json → (se OK/ALERTA) entra na apresentação
```
O **`layout.json`** é o contrato central: descreve cada peça em unidades físicas, com slots resolvidos, assets, textos, cores por nome de swatch e faca. Os adapters só "desenham" o layout.json. Por isso o dry-run e o app real produzem a mesma composição, e os golden tests comparam a mesma coisa.

---

## 4. Modelo de dados (resumo das decisões)

- **`brand.yaml`**: cores com `{pantone, cmyk, rgb, hex, role, share}`; `logo.files[versão][cor][slogan]` → `{pdf, svg, ai, sha256, variante: cmyk|rgb}`; `logo.safe_area_x_ratio` (X ÷ altura do logo); `logo.min_size` `{print_mm, digital_px}`; `logo.rules_by_archetype`; tabela `logo.color_by_background` (luminância/ΔE do fundo → variante); `type.family`, `type.allowed_styles` (10 estilos); `language.{pronoun:"tu", keywords[], forbidden_phrases[], proprietary_terms[], signatures[]}`.
- **`campaign.yaml`**: igual à seção 4.2 do prompt, mais `dominance_by_phase` (ex.: `black: preto`) para o validador 60/30/10 e `cube_art: continuous|per_face`.
- **`catalog.yaml`**: todos os formatos das seções 5.1 e 5.2, com `scale` (`1` ou `0.1`), `ppi_rule`, `distancia_leitura`, `variants` (pedágio: Sika, Hydronorth, Garthen, Lynus), `frames` (GIF) e `safe_zone` (Facebook 640×360, Parallax in Text 700×350, Banner L janela 1378×773).
- Validação de todos os YAMLs por schema na carga, com erros que apontam linha e campo.

---

## 5. Motor de layout — abordagem

- **Arquétipo = template paramétrico** em YAML/TS: lista de slots (`lettering`, `imagem`, `selo`, `oferta`, `cta`, `logo`, `apoio[]`, `fundo`) com âncora, caixa relativa (% da área segura), prioridade, `croppable`, `min_size` e regra de *drop* (o que sai primeiro quando não cabe).
- **Solver** determinístico em duas passadas: (1) aloca as caixas pela proporção e pela prioridade; (2) ajusta a tipografia pelo **tamanho mínimo** (distância → altura de caixa-alta ≥ 25 mm a cada 10 m, apoio ≥ 60%, digital ≥ 10 px). Se não couber, remove slots pela ordem de prioridade. Nunca reduz abaixo do mínimo.
- **Logo**: escolhe a versão (H/V) pelo arquétipo e pelo tamanho mínimo. A cor sai da amostragem do fundo real sob a caixa do logo, com contraste WCAG e as 5 variantes. Inclui a área de segurança X e o slogan, a menos que "Ninguém facilita tanto" já esteja nos textos (normalização sem acento e sem caixa).
- **Medidas físicas sempre em mm** no layout.json. A escala 1:10 é aplicada só na hora de construir o documento (e o validador volta para o tamanho final).
- **Contraste**: o solver pede ao adapter, ou ao dry-run, uma amostra do fundo sob cada caixa de texto. Abaixo de 4,5:1 (ou 3:1 para texto grande), aplica a correção nesta ordem: trocar a cor do texto → faixa sólida da marca → sombra sutil.

---

## 6. Pontos técnicos de risco e como trato cada um

| Risco | Tratamento |
|---|---|
| **PDF/X-1a + transparência**: o achatamento pode rasterizar texto/vetor | Predefinição de achatador de alta resolução + "converter todo texto em contorno" **desligado**; depois do export, checagem com pdfcpu/qpdf de que as fontes estão incorporadas e de que não existem imagens no lugar do texto do lettering (heurística por área). |
| **Pantone como processo com o CMYK do MIV** | Swatches criados por script com `model=PROCESS`, `space=CMYK`, valores do brand.yaml. O Ink Manager não é usado. O validador lê os operadores de cor do PDF (qpdf `--qdf`) e confere os valores com ΔE ≤ 2. |
| **Faca em spot sobreimpressa** | Swatches `Faca`/`Vinco` spot, `overprintStroke=true`, layer `FACA` travado e no topo. Checagem no PDF: separação `Faca` presente e `/OP true` no ExtGState. |
| **ppi efetivo em escala 1:10** | O validador lê `link.effectivePpi` no INDD e multiplica pela escala → ppi final. Nunca faz upscale. Se ficar abaixo do mínimo, gera `links_faltando.md` com os pixels necessários. |
| **GIF ≤ 150 KB com 10 s** | Busca em níveis: `--lossy` 20→200, depois cores 256→32 e, por último, remoção de frames intermediários (o último frame, com marca e oferta, nunca sai). Delays em centésimos que somam exatamente 1000. |
| **Pedágio MP4** | ffmpeg com a linha de comando do prompt; frames montados como 4s/3s/3s via concat demuxer; o `ffprobe` valida 300 frames, 10,0 s, 30 fps, H.264 High e ~8000 kbps. |
| **Prévia ≤ 30 MB** | Busca binária no ppi com o encode PNG real (sharp, compressão 9), com piso de 2000 px no maior lado. |
| **Adobe Fonts não empacotáveis** | Aviso fixo no relatório do pacote + checagem de status da fonte antes do job. |
| **Revisão visual (validador item 8)** | Feita por modelo de visão (API Claude) sobre a prévia, com rubrica fixa e saída JSON (notas + nota 0–10). Opcional, ligada por flag, porque exige chave de API em `.env`. |
| **Móbile: faca especial** | Illustrator: silhueta do gimmick+lettering → `Pathfinder Unite` → `Offset Path` 3–5 mm (configurável) com junção redonda → simplificação. Checagem de ângulo mínimo de 30° e largura mínima de istmo feita em TS (biblioteca `clipper2`/`polygon-clipping`) sobre o SVG exportado. O verso espelha só o path. |

---

## 7. Plano de marcos (detalhado)

| Marco | Entrega | Testável aqui? | Depende de |
|---|---|---|---|
| **M0** | Este PLAN.md | ✅ | — |
| **M1a** | Monorepo, schemas zod, `brand.yaml` Tumelero (cores, regras, linguagem, tipografia, tabela de logo), `catalog.yaml` completo (todos os formatos 5.1/5.2 + pedágio com variantes), `.idpp` de preflight, swatches `.ase` gerados do brand.yaml | ✅ | — |
| **M1b** | `brand-extract.jsx` (InDesign): logos por página/versão/cor → PDF+SVG+AI, remapeamento de cor CMYK/RGB, hash, medida do X; `dieline.jsx`: cubo e triedro → `dielines/*.json` + `*.svg` | ⚠️ escrita aqui, **execução no Mac** | Q1 |
| **M2** | `ingest` (PSD/AI/INDD → árvore de layers), classificador (convenção `@papel` + heurística), `campaign.yaml` rascunho, `mapping-preview.html`, `confirm` | ⚠️ classificador e preview testáveis com o KV sintético; extração real no Mac | KV real |
| **M3** | Motor de layout + 5 arquétipos + adapter svg-dryrun + adapters InDesign (impresso) e Photoshop (digital estático). Primeira rodada: banner 100×120, lona 300×70, ret. médio (estático), rodapé, Banner L | ✅ dry-run / ⚠️ apps no Mac | M1, M2 |
| **M4** | Facas (cubo, triedro, móbile via Illustrator), GIFs, pedágio MP4, frente/verso, 1:10, RGB→CMYK + relink | GIF/MP4 ✅ / facas e CMYK no Mac | M3 |
| **M5** | Validador completo (8 checagens) + `relatorio.html` | ✅ quase tudo | M3 |
| **M6** | Google Slides: cópia do template, leitura via `presentations.get`, seções, slides de peça, tags duplicadas da biblioteca, `status` | ✅ com credencial | Q3, txt da apresentação |
| **M7** | UI local, servidor MCP, README + guia "como cadastrar marca/campanha" | ✅ | — |

Ao fim de cada marco: saídas reais em `outputs/`, `pnpm test` verde, lista de pendências.

---

## 8. Dúvidas abertas

### Bloqueiam o início (preciso antes do M1)
- **Q1 — Onde os apps Adobe vão rodar?** (seção 2: A Mac via Remote Control / B Firefly Services / C só dry-run). Recomendo **A**. Se for A: qual Mac, com quais versões de InDesign/Illustrator/Photoshop, e a Objektiv Mk3 está ativa nele?
- **Q2 — Inputs no git?** Os inputs somam ~26 MB (o INDD do MIV tem 13,8 MB). Proposta: `inputs/` fica no `.gitignore`; os **derivados** pequenos (logos extraídos, facas em JSON/SVG) vão para o repositório. Alternativa: Git LFS. Os KVs de cliente nunca vão para o repositório. (Também não recebi o `.txt` da apresentação nem o PNG original do Banner L, só a imagem colada.)

### Pendentes da seção 13 do prompt (sigo com os padrões e pergunto na hora certa)
- **Q3** — Conta Google/Drive para o Slides (M6).
- **Q4** — Distâncias de leitura reais por peça de PDV.
- **Q5** — Acabamentos de fornecedor fora do padrão (bolsa para cano, ilhós).

### Novas, de baixo impacto (vou assumir o padrão abaixo se você não disser nada)
- **Q6** — Slogan: tratar logo com e sem slogan como **arquivos separados** extraídos do MIV (não compor com texto). *Padrão: sim.*
- **Q7** — Validador visual com modelo de visão (API Claude, chave em `.env`). *Padrão: opcional, desligado por padrão.*
- **Q8** — Perfil FOGRA39: não versionar o `.icc` (licença); caminho configurável, com padrão para o local de instalação do Adobe no Mac. *Padrão: sim.*
- **Q9** — `REVISAR` vs status `ALERTA`: alerta entra na apresentação com uma nota no rodapé do slide? *Padrão: entra, sem nota visível ao cliente; a nota fica só no relatório.*

---

## 9. Próximo passo
Com o seu ok (e respostas a Q1/Q2), começo o **M1a**: scaffold do monorepo, schemas, `brand.yaml`, `catalog.yaml` e testes, tudo verificável aqui. Em paralelo escrevo os `.jsx` do M1b, para rodar assim que a máquina com Adobe estiver disponível.
