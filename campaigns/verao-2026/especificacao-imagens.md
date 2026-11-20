# Especificação para o desdobramento — Verão

**Regra (cliente, 20/11):** todo impresso sai em **escala 1:10**, com links a **300 ppi medidos no documento**
(= 30 ppi no tamanho final). Os digitais saem por redução das mesmas imagens. Sem upscale.

## 1. Peças-diretriz (o que você diagrama)

Só 4 peças, uma por arquétipo. As outras 30 são derivadas delas pela ferramenta.

| Diretriz | Arquétipo | Deriva | Entrega |
|---|---|---|---|
| **Lona 800×80** | ultra-horizontal (> 4:1) | 14 formatos: lonas 300–800, adesivo, superbanners, megabanners, sticky desktop, mega billboard desktop, rodapé, A4 (cabeçalho) | INDD ou PSD em camadas, 1:10 (80×8 cm), 300 ppi |
| **Lona 420×130** | horizontal (1,4–4:1) | 9 formatos: pórtico, Banner L, capa Facebook, billboards, mega billboard mobile, sticky mobile, parallax desktop, parallax in text | idem (42×13 cm) |
| **Banner 100×120** | quase-quadrado (0,8–1,4) | 4 formatos: lona 250×260, móbile, cubo, retângulo médio | idem (10×12 cm) |
| **Big Tower 300×600** | vertical e ultravertical (< 0,8) | 3 formatos: triedro, parallax mobile, pedágio | PSD 300×600 px |

Em cada diretriz, mantenha as camadas nomeadas pelo papel (`@fundo`, `@imagem`, `@lettering-h`, `@conceito`, `@logo`, `@apoio-*`).
A ferramenta aprende posição, proporção e hierarquia de cada papel e aplica nos formatos derivados.

## 2. Imagens-base (o que alimenta todas as peças)

| # | Arquivo | Proporção | Mínimo (px) | Cobre |
|---|---|---|---|---|
| 1 | Cenário **horizontal** limpo (sem mascote) | 3:1 | **5.100 × 1.700** | lonas, pórtico, adesivo, cubo, todos os digitais horizontais (A4: 2.480 px) |
| 2 | Cenário **vertical** limpo (sem mascote) | 4:5 | **3.200 × 4.000** | banner, lona 250×260 (corte quadrado), triedro, móbile, digitais verticais |
| 3 | **Mascote + cortador recortados** (transparência, sombra em layer separado) | — | **2.000 de altura** | todas |
| 4 | **Lettering "VERÃO"** em vetor (AI), horizontal + vertical/compacto | — | vetor | todas |

Formato: PSD/TIFF RGB 8 bits, 300 ppi, **com perfil sRGB embutido**. Laterais e topo dos cenários sem
objetos cortados (são as áreas estendidas). Sem marcas de terceiros visíveis.

O KV atual (4.330 × 2.436) já cobre quase tudo; só fica curto na lona 420×130 (altura) e na lona 250×260.

## 3. Necessidade por peça (área da foto, com sangria)

| Peça | Final → documento 1:10 | px a 300 ppi |
|---|---|---|
| Banner 100×120 (foto cheia) | 101×121 cm → 10,1×12,1 cm | 1.193 × 1.430 |
| Lona 250×260 (foto cheia) | 256×266 cm → 25,6×26,6 cm | 3.024 × 3.142 |
| Lona 420×130 (foto cheia) | 426×136 cm → 42,6×13,6 cm | 5.032 × 1.607 |
| Pórtico 130×50 | 131×51 cm → 13,1×5,1 cm | 1.548 × 603 |
| Móbile 50×50 | 51×51 cm → 5,1×5,1 cm | 603 × 603 |
| Triedro, 3 faces contínuas | 121×161 cm → 12,1×16,1 cm | 1.430 × 1.902 |
| Cubo, 4 faces contínuas | 161×41 cm → 16,1×4,1 cm | 1.902 × 485 |
| Lona 800×100, foto no canto (42%) | 336×103 cm → 33,6×10,3 cm | 3.969 × 1.217 |
| Lona 800×80, foto no canto (42%) | 336×83 cm → 33,6×8,3 cm | 3.969 × 981 |
| Adesivo 700×150, foto no canto (42%) | 294×152 cm → 29,4×15,2 cm | 3.473 × 1.796 |
| Lona 300×70, foto no canto (38%) | 114×73 cm → 11,4×7,3 cm | 1.347 × 863 |

⚠ Peças vistas a menos de 5 m (banner, pórtico, móbile, cubo, triedro) ficam a 30 ppi no tamanho final,
abaixo da referência de 150 ppi. O validador marca ALERTA "ver de perto" nessas peças (não bloqueia).
