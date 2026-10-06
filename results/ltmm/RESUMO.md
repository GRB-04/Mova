# Alarmes falsos em vida real: LTMM (idosos em casa, ~3 dias, sensor na lombar)

Registros analisados: **35** (21 CO = sem histórico de quedas, 14 FL = com histórico de quedas), 1567,5 h de uso (65,3 dias). Excluídos: 36 (lista no fim). Métodos: `docs/METODOLOGIA_ANALISES.md`, seção 3.

A LTMM não tem quedas anotadas: **todo alarme é contado como falso**. "Por dia" = por 24 h de uso (sem os períodos detectados de não uso).

## Alarmes falsos por dia

| Grupo | Algoritmo | Alarmes (total) | Taxa agregada/dia (IC 95% bootstrap por pessoa) | Mediana por pessoa (IIQ) | Mín.–máx. por pessoa | Pessoas com 0 alarmes |
|---|---|---|---|---|---|---|
| Todos | Mova antigo | 1008 | 15,4 (11,6–19,6) | 11,2 (7,7–21,0) | 2,5–53,3 | 0 |
| Todos | Kangas | 1419 | 21,7 (14,3–31,9) | 13,2 (7,2–28,1) | 3,8–118,9 | 0 |
| Todos | Kangas (eixo z) | 699 | 10,7 (4,0–20,1) | 3,2 (1,9–5,8) | 0,7–106,2 | 0 |
| Todos | Bourke3 | 272 | 4,2 (2,9–5,8) | 2,7 (1,7–4,9) | 0,5–26,6 | 0 |
| Todos | PIPTO (tempo real) | 1070 | 16,4 (10,6–24,2) | 10,2 (6,8–17,2) | 2,1–117,7 | 0 |
| CO | Mova antigo | 635 | 15,9 (11,5–21,6) | 11,2 (7,7–19,8) | 3,6–53,3 | 0 |
| CO | Kangas | 760 | 19,1 (11,4–29,1) | 11,2 (7,0–24,9) | 3,8–118,9 | 0 |
| CO | Kangas (eixo z) | 407 | 10,2 (3,4–20,1) | 3,3 (2,4–5,1) | 1,2–106,2 | 0 |
| CO | Bourke3 | 183 | 4,6 (2,8–7,3) | 2,8 (2,0–4,8) | 0,5–26,6 | 0 |
| CO | PIPTO (tempo real) | 653 | 16,4 (9,9–27,1) | 9,8 (7,9–17,0) | 5,2–117,7 | 0 |
| FL | Mova antigo | 373 | 14,6 (8,7–21,6) | 10,5 (6,7–20,9) | 2,5–37,0 | 0 |
| FL | Kangas | 659 | 25,9 (12,8–44,4) | 16,5 (10,1–28,8) | 4,3–114,2 | 0 |
| FL | Kangas (eixo z) | 292 | 11,5 (2,4–28,7) | 2,6 (1,2–9,3) | 0,7–99,4 | 0 |
| FL | Bourke3 | 89 | 3,5 (2,1–5,4) | 2,4 (1,5–4,9) | 0,5–11,5 | 0 |
| FL | PIPTO (tempo real) | 417 | 16,4 (7,7–26,8) | 10,8 (4,9–19,6) | 2,1–50,3 | 0 |

### Análise de sensibilidade (definida DEPOIS de ver a checagem de qualidade)

Alguns registros têm a vertical estimada longe do eixo v do sensor (até 76,4°), o que pode indicar sensor mal posicionado ou erro na estimativa. Repetição só com registros a ≤ 30° (30 de 35):

| Grupo | Algoritmo | Alarmes (total) | Taxa agregada/dia (IC 95% bootstrap por pessoa) | Mediana por pessoa (IIQ) | Mín.–máx. por pessoa | Pessoas com 0 alarmes |
|---|---|---|---|---|---|---|
| Vertical ≤ 30° | Mova antigo | 724 | 13,1 (10,1–16,9) | 11,0 (7,5–17,1) | 2,5–53,3 | 0 |
| Vertical ≤ 30° | Kangas | 927 | 16,8 (11,1–24,7) | 11,3 (7,1–17,8) | 3,8–118,9 | 0 |
| Vertical ≤ 30° | Kangas (eixo z) | 463 | 8,4 (3,4–15,8) | 3,2 (1,9–5,1) | 0,7–106,2 | 0 |
| Vertical ≤ 30° | Bourke3 | 202 | 3,7 (2,4–5,6) | 2,4 (1,6–4,7) | 0,5–26,6 | 0 |
| Vertical ≤ 30° | PIPTO (tempo real) | 781 | 14,1 (9,0–22,5) | 9,6 (6,5–15,7) | 2,1–117,7 | 0 |

Referências publicadas (vida real/ADL contínuas): Bourke3 original 0,6/dia (Bourke 2010, via Bagalà); Bourke3 no Bagalà ≈ 5/dia; Kangas no Bagalà < 9/dia; faixa dos 13 algoritmos no Bagalà: 3–85 por 24 h.

## Comparação entre algoritmos (mesmas pessoas: Wilcoxon pareado, correção de Holm)

| A | B | Mediana de (A − B) alarmes/dia | p Wilcoxon | p Holm |
|---|---|---|---|---|
| Mova antigo | Kangas | -3,2 | 0,051 | 0,103 |
| Mova antigo | Kangas (eixo z) | 6,5 | 0,003 | 0,013 |
| Mova antigo | Bourke3 | 9,2 | < 0,001 | < 0,001 |
| Mova antigo | PIPTO (tempo real) | 1,1 | 0,527 | 0,527 |
| Kangas | Kangas (eixo z) | 7,6 | < 0,001 | < 0,001 |
| Kangas | Bourke3 | 10,9 | < 0,001 | < 0,001 |
| Kangas | PIPTO (tempo real) | 3,4 | 0,009 | 0,037 |
| Kangas (eixo z) | Bourke3 | 0,9 | 0,032 | 0,096 |
| Kangas (eixo z) | PIPTO (tempo real) | -5,6 | < 0,001 | 0,002 |
| Bourke3 | PIPTO (tempo real) | -6,5 | < 0,001 | < 0,001 |

## Checagens de qualidade por registro

| Registro | Grupo | Idade | Horas gravadas | Horas de uso | Vertical estimada: ângulo até o eixo v | Segundos de caminhada usados | Mova antigo | Kangas | Kangas (eixo z) | Bourke3 | PIPTO (tempo real) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO001 | CO | 75.17 | 47,6 | 42,6 | 42,0° | 18474 | 77 | 60 | 9 | 21 | 31 |
| CO002 | CO | 82.92 | 75,0 | 63,5 | 6,6° | 22835 | 41 | 15 | 8 | 4 | 25 |
| CO010 | CO | 81.77 | 75,0 | 60,3 | 24,3° | 11104 | 27 | 39 | 3 | 12 | 26 |
| CO012 | CO | 81.09 | 75,0 | 70,0 | 5,5° | 14459 | 69 | 18 | 11 | 3 | 37 |
| CO013 | CO | 76.22 | 75,0 | 53,0 | 1,3° | 12836 | 19 | 16 | 3 | 1 | 14 |
| CO017 | CO | 75.88 | 75,0 | 51,5 | 16,3° | 16799 | 24 | 14 | 7 | 8 | 19 |
| CO018 | CO | 84.41 | 70,6 | 51,1 | 6,6° | 7822 | 16 | 8 | 4 | 5 | 16 |
| CO020 | CO | 78.49 | 75,0 | 55,8 | 14,3° | 17328 | 13 | 18 | 7 | 5 | 12 |
| CO022 | CO | 66.09 | 71,8 | 40,6 | 9,2° | 12684 | 13 | 19 | 2 | 3 | 14 |
| CO023 | CO | 70.8 | 74,0 | 51,3 | 8,3° | 10113 | 29 | 15 | 6 | 6 | 21 |
| CO024 | CO | — | 73,6 | 30,1 | 9,0° | 6256 | 5 | 9 | 6 | 1 | 8 |
| CO029 | CO | 76.64 | 75,0 | 52,8 | 25,0° | 7430 | 8 | 15 | 7 | 6 | 15 |
| CO032 | CO | 81.94 | 68,5 | 36,5 | 17,4° | 13073 | 17 | 20 | 3 | 3 | 12 |
| CO035 | CO | 77.03 | 73,4 | 42,4 | 5,0° | 16847 | 35 | 29 | 7 | 4 | 31 |
| CO036 | CO | 80.44 | 72,9 | 26,4 | 12,4° | 4397 | 30 | 46 | 43 | 9 | 25 |
| CO037 | CO | 77.51 | 71,4 | 29,9 | 11,5° | 11953 | 21 | 11 | 5 | 6 | 10 |
| CO038 | CO | 82.57 | 67,2 | 26,4 | 11,1° | 7027 | 35 | 131 | 117 | 17 | 69 |
| CO039 | CO | 80.48 | 73,2 | 38,8 | 7,4° | 11391 | 86 | 129 | 130 | 43 | 190 |
| CO040 | CO | 77.12 | 74,8 | 46,3 | 76,4° | 13896 | 38 | 78 | 14 | 8 | 30 |
| CO041 | CO | 82.19 | 75,0 | 50,3 | 27,8° | 8560 | 16 | 32 | 5 | 9 | 22 |
| CO044 | CO | 81.51 | 72,9 | 36,7 | 11,3° | 6353 | 16 | 38 | 10 | 9 | 26 |
| FL004 | FL | 81.99 | 72,0 | 42,0 | 22,8° | 5743 | 26 | 26 | 9 | 7 | 20 |
| FL005 | FL | 77.96 | 67,3 | 39,1 | 49,0° | 5565 | 15 | 33 | 3 | 11 | 11 |
| FL006 | FL | 84.46 | 75,0 | 47,0 | 7,7° | 3524 | 12 | 19 | 3 | 2 | 7 |
| FL011 | FL | 78.24 | 75,0 | 42,0 | 16,1° | 13269 | 10 | 14 | 2 | 3 | 8 |
| FL014 | FL | 80.74 | 75,0 | 48,5 | 7,0° | 8527 | 9 | 23 | 8 | 5 | 10 |
| FL016 | FL | 72.46 | 75,0 | 63,5 | 36,1° | 13886 | 98 | 83 | 3 | 6 | 133 |
| FL020 | FL | 80.12 | 75,0 | 44,5 | 13,4° | 10144 | 21 | 8 | 6 | 4 | 19 |
| FL022 | FL | 85.11 | 75,0 | 68,0 | 9,4° | 8939 | 7 | 15 | 3 | 4 | 6 |
| FL026 | FL | 73 | 69,8 | 22,4 | 14,4° | 6380 | 33 | 68 | 12 | 1 | 40 |
| FL028 | FL | 79 | 49,4 | 22,4 | 10,5° | 4051 | 9 | 17 | 10 | 4 | 15 |
| FL031 | FL | 65 | 56,3 | 35,9 | 25,0° | 14222 | 33 | 56 | 1 | 9 | 31 |
| FL033 | FL | 83.27 | 75,0 | 50,0 | 35,8° | 29377 | 56 | 238 | 207 | 24 | 84 |
| FL035 | FL | 83.57 | 75,0 | 37,8 | 9,3° | 4694 | 27 | 33 | 21 | 8 | 23 |
| FL036 | FL | 79.55 | 72,1 | 48,6 | 7,4° | 12283 | 17 | 26 | 4 | 1 | 10 |

## Registros excluídos

- CO003: faixa ±1.93 g < ±3.5 g
- CO004: faixa ±3.40 g < ±3.5 g
- CO005: queda relatada no diário de uso ("fall 11:40", dia 0)
- CO006: faixa ±1.93 g < ±3.5 g
- CO007: faixa ±1.93 g < ±3.5 g
- CO008: faixa ±2.97 g < ±3.5 g
- CO009: faixa ±1.93 g < ±3.5 g
- CO011: faixa ±1.93 g < ±3.5 g
- CO014: faixa ±1.93 g < ±3.5 g
- CO015: faixa ±1.93 g < ±3.5 g
- CO016: faixa ±1.93 g < ±3.5 g
- CO019: faixa ±1.93 g < ±3.5 g
- CO021: faixa ±3.43 g < ±3.5 g
- CO025: faixa ±2.87 g < ±3.5 g
- CO027: faixa ±1.95 g < ±3.5 g
- CO028: faixa ±2.41 g < ±3.5 g
- CO030: faixa ±2.58 g < ±3.5 g
- CO031: faixa ±3.03 g < ±3.5 g
- CO042: faixa ±3.12 g < ±3.5 g
- FL001: faixa ±1.93 g < ±3.5 g
- FL007: faixa ±2.54 g < ±3.5 g
- FL008: faixa ±1.93 g < ±3.5 g
- FL009: faixa ±1.52 g < ±3.5 g
- FL010: faixa ±2.93 g < ±3.5 g
- FL015: faixa ±2.02 g < ±3.5 g
- FL018: faixa ±3.49 g < ±3.5 g
- FL019: faixa ±1.34 g < ±3.5 g
- FL021: faixa ±2.68 g < ±3.5 g
- FL023: faixa ±2.62 g < ±3.5 g
- FL024: faixa ±2.36 g < ±3.5 g
- FL025: faixa ±2.97 g < ±3.5 g
- FL027: faixa ±0.86 g < ±3.5 g
- FL029: faixa ±2.62 g < ±3.5 g
- FL030: faixa ±2.60 g < ±3.5 g
- FL032: faixa ±3.22 g < ±3.5 g
- FL034: faixa ±2.84 g < ±3.5 g
