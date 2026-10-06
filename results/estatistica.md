# Comparação estatística entre os algoritmos (SisFall)

Casos pareados: 1744 quedas (24 participantes com quedas) e 2652 ADLs (38 participantes). Todos os algoritmos foram avaliados nos MESMOS arquivos.
Métodos e justificativas: `docs/METODOLOGIA_ANALISES.md`, seção 1.

## 1. Sensibilidade (SE) e especificidade (SP) com dois intervalos de confiança

O IC de Wilson trata cada arquivo como independente. O IC por bootstrap de participante reamostra PESSOAS e é o mais honesto quando há várias tentativas por pessoa. Quando o segundo é bem mais largo, a precisão real é menor do que o número de arquivos sugere.

| Algoritmo | SE % | IC Wilson | IC bootstrap (participante) | SP % | IC Wilson | IC bootstrap (participante) |
|---|---|---|---|---|---|---|
| Mova antigo | 67.5 | 65.3–69.7 | 64.6–70.3 | 82.2 | 80.7–83.6 | 79.7–84.8 |
| Kangas | 92.9 | 91.6–94.0 | 90.3–95.4 | 98.6 | 98.0–99.0 | 97.7–99.3 |
| Kangas (eixo z) | 30.0 | 27.9–32.2 | 27.0–32.8 | 98.0 | 97.4–98.5 | 96.7–99.1 |
| Bourke3 | 57.9 | 55.6–60.2 | 52.3–63.8 | 99.8 | 99.5–99.9 | 99.4–100.0 |
| PIPTO (original) | 80.9 | 79.0–82.7 | 75.3–85.9 | 88.6 | 87.3–89.7 | 86.3–90.7 |
| PIPTO (tempo real) | 84.3 | 82.5–85.9 | 78.7–89.2 | 82.4 | 80.9–83.8 | 79.4–85.3 |

## 2. Teste global (Q de Cochran): os algoritmos diferem entre si?

- Quedas (SE): Q = 2391.5, gl = 5, p < 0,001
- ADLs (SP): Q = 1488.7, gl = 5, p < 0,001

## 3. Comparações par a par: sensibilidade (quedas)

"Só A acertou" = quedas que A detectou e B não. Correção de Holm sobre as 30 comparações (15 pares × 2 métricas).
A conclusão exige que o McNemar (corrigido) e o IC por participante concordem.

| A | B | A − B (pontos %) | IC 95% bootstrap por participante | só A acertou | só B acertou | p McNemar exato | p Holm | Conclusão |
|---|---|---|---|---|---|---|---|---|
| Mova antigo | Kangas | -25.3 | -27.7 a -23.0 | 49 | 491 | < 0,001 | < 0,001 | **Kangas melhor** |
| Mova antigo | Kangas (eixo z) | 37.6 | 32.9 a 42.3 | 838 | 183 | < 0,001 | < 0,001 | **Mova antigo melhor** |
| Mova antigo | Bourke3 | 9.6 | 5.2 a 14.2 | 439 | 271 | < 0,001 | < 0,001 | **Mova antigo melhor** |
| Mova antigo | PIPTO (original) | -13.4 | -17.0 a -9.4 | 166 | 399 | < 0,001 | < 0,001 | **PIPTO (original) melhor** |
| Mova antigo | PIPTO (tempo real) | -16.7 | -20.3 a -12.8 | 112 | 404 | < 0,001 | < 0,001 | **PIPTO (tempo real) melhor** |
| Kangas | Kangas (eixo z) | 62.9 | 58.8 a 66.9 | 1116 | 19 | < 0,001 | < 0,001 | **Kangas melhor** |
| Kangas | Bourke3 | 35.0 | 30.5 a 39.2 | 627 | 17 | < 0,001 | < 0,001 | **Kangas melhor** |
| Kangas | PIPTO (original) | 12.0 | 8.4 a 15.7 | 261 | 52 | < 0,001 | < 0,001 | **Kangas melhor** |
| Kangas | PIPTO (tempo real) | 8.6 | 5.2 a 12.5 | 202 | 52 | < 0,001 | < 0,001 | **Kangas melhor** |
| Kangas (eixo z) | Bourke3 | -27.9 | -34.0 a -21.3 | 216 | 703 | < 0,001 | < 0,001 | **Bourke3 melhor** |
| Kangas (eixo z) | PIPTO (original) | -50.9 | -56.3 a -44.1 | 60 | 948 | < 0,001 | < 0,001 | **PIPTO (original) melhor** |
| Kangas (eixo z) | PIPTO (tempo real) | -54.3 | -59.7 a -47.8 | 55 | 1002 | < 0,001 | < 0,001 | **PIPTO (tempo real) melhor** |
| Bourke3 | PIPTO (original) | -23.0 | -27.3 a -18.6 | 84 | 485 | < 0,001 | < 0,001 | **PIPTO (original) melhor** |
| Bourke3 | PIPTO (tempo real) | -26.4 | -30.7 a -22.1 | 62 | 522 | < 0,001 | < 0,001 | **PIPTO (tempo real) melhor** |
| PIPTO (original) | PIPTO (tempo real) | -3.4 | -4.2 a -2.6 | 0 | 59 | < 0,001 | < 0,001 | **PIPTO (tempo real) melhor** |

## 4. Comparações par a par: especificidade (ADLs)

"Só A acertou" = ADLs em que A NÃO deu alarme e B deu.

| A | B | A − B (pontos %) | IC 95% bootstrap por participante | só A acertou | só B acertou | p McNemar exato | p Holm | Conclusão |
|---|---|---|---|---|---|---|---|---|
| Mova antigo | Kangas | -16.4 | -18.9 a -13.4 | 31 | 466 | < 0,001 | < 0,001 | **Kangas melhor** |
| Mova antigo | Kangas (eixo z) | -15.8 | -18.5 a -12.8 | 40 | 460 | < 0,001 | < 0,001 | **Kangas (eixo z) melhor** |
| Mova antigo | Bourke3 | -17.6 | -20.1 a -15.1 | 1 | 468 | < 0,001 | < 0,001 | **Bourke3 melhor** |
| Mova antigo | PIPTO (original) | -6.4 | -7.8 a -5.0 | 111 | 281 | < 0,001 | < 0,001 | **PIPTO (original) melhor** |
| Mova antigo | PIPTO (tempo real) | -0.2 | -1.5 a 1.1 | 112 | 117 | 0,792 | 0,792 | sem diferença demonstrada |
| Kangas | Kangas (eixo z) | 0.6 | -0.5 a 1.6 | 34 | 19 | 0,053 | 0,107 | sem diferença demonstrada |
| Kangas | Bourke3 | -1.2 | -2.0 a -0.5 | 0 | 32 | < 0,001 | < 0,001 | **Bourke3 melhor** |
| Kangas | PIPTO (original) | 10.0 | 7.3 a 12.5 | 299 | 34 | < 0,001 | < 0,001 | **Kangas melhor** |
| Kangas | PIPTO (tempo real) | 16.2 | 12.8 a 19.3 | 464 | 34 | < 0,001 | < 0,001 | **Kangas melhor** |
| Kangas (eixo z) | Bourke3 | -1.8 | -3.0 a -0.8 | 0 | 47 | < 0,001 | < 0,001 | **Bourke3 melhor** |
| Kangas (eixo z) | PIPTO (original) | 9.4 | 6.7 a 12.0 | 292 | 42 | < 0,001 | < 0,001 | **Kangas (eixo z) melhor** |
| Kangas (eixo z) | PIPTO (tempo real) | 15.6 | 12.1 a 18.9 | 457 | 42 | < 0,001 | < 0,001 | **Kangas (eixo z) melhor** |
| Bourke3 | PIPTO (original) | 11.2 | 8.9 a 13.4 | 300 | 3 | < 0,001 | < 0,001 | **Bourke3 melhor** |
| Bourke3 | PIPTO (tempo real) | 17.4 | 14.4 a 20.1 | 465 | 3 | < 0,001 | < 0,001 | **Bourke3 melhor** |
| PIPTO (original) | PIPTO (tempo real) | 6.2 | 5.2 a 7.1 | 165 | 0 | < 0,001 | < 0,001 | **PIPTO (original) melhor** |
