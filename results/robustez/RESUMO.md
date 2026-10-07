# Robustez às condições do celular (SisFall)

4396 arquivos da SisFall; os mesmos arquivos em todas as condições (comparação pareada). Métodos: `docs/METODOLOGIA_ANALISES.md`, seção 2.

## 1. Taxa de amostragem entregue pelo celular (referência: 50 Hz)

**Sensibilidade (% de quedas detectadas)**

| Algoritmo | 10 Hz | 25 Hz | 50 Hz | 100 Hz |
|---|---|---|---|---|
| Mova antigo | 67.3 | 67.4 | 67.3 | 67.3 |
| Kangas | 72.6 ▼ | 91.2 ▼ | 92.9 | 92.9 |
| Kangas (eixo z) | 22.2 ▼ | 29.2 | 30.2 | 30.2 |
| Bourke3 | 39.3 ▼ | 59.8 | 58.5 | 57.9 |
| PIPTO (original) | 46.0 ▼ | 78.7 ▼ | 81.3 | 81.3 |
| PIPTO (tempo real) | 47.8 ▼ | 80.7 ▼ | 84.6 | 84.6 |

**Especificidade (% de ADLs sem alarme)**

| Algoritmo | 10 Hz | 25 Hz | 50 Hz | 100 Hz |
|---|---|---|---|---|
| Mova antigo | 81.1 | 83.2 ▲ | 81.1 | 81.1 |
| Kangas | 99.6 ▲ | 98.8 | 98.4 | 98.4 |
| Kangas (eixo z) | 99.2 ▲ | 98.4 ▲ | 97.9 | 97.9 |
| Bourke3 | 100.0 | 99.9 | 99.8 | 99.8 |
| PIPTO (original) | 90.5 ▲ | 89.9 ▲ | 87.7 | 87.1 |
| PIPTO (tempo real) | 88.1 ▲ | 84.3 ▲ | 81.3 | 81.3 |

▲/▼ = melhor/pior que a referência, com McNemar exato corrigido por Holm < 0,05 **e** IC 95% (bootstrap por participante) da diferença sem o zero.

<details><summary>Testes pareados contra a referência</summary>

| Condição | Algoritmo | Métrica | Diferença (pontos %) | IC 95% | só a referência acertou | só a condição acertou | p McNemar | p Holm |
|---|---|---|---|---|---|---|---|---|
| 10 Hz | Mova antigo | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| 10 Hz | Mova antigo | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| 10 Hz | Kangas | SE | -20.4 | -23.0 a -17.6 | 364 | 9 | < 0,001 | < 0,001 |
| 10 Hz | Kangas | SP | 1.2 | 0.6 a 1.9 | 1 | 32 | < 0,001 | < 0,001 |
| 10 Hz | Kangas (eixo z) | SE | -8.0 | -9.6 a -6.4 | 149 | 10 | < 0,001 | < 0,001 |
| 10 Hz | Kangas (eixo z) | SP | 1.3 | 0.6 a 2.2 | 0 | 34 | < 0,001 | < 0,001 |
| 10 Hz | Bourke3 | SE | -19.2 | -22.6 a -15.7 | 462 | 127 | < 0,001 | < 0,001 |
| 10 Hz | Bourke3 | SP | 0.1 | 0.0 a 0.3 | 0 | 3 | 0,250 | 1,000 |
| 10 Hz | PIPTO (original) | SE | -35.3 | -38.9 a -31.7 | 676 | 61 | < 0,001 | < 0,001 |
| 10 Hz | PIPTO (original) | SP | 2.9 | 1.4 a 4.3 | 126 | 202 | < 0,001 | < 0,001 |
| 10 Hz | PIPTO (tempo real) | SE | -36.9 | -40.8 a -32.9 | 674 | 31 | < 0,001 | < 0,001 |
| 10 Hz | PIPTO (tempo real) | SP | 6.7 | 5.1 a 8.4 | 31 | 210 | < 0,001 | < 0,001 |
| 25 Hz | Mova antigo | SE | 0.1 | -1.6 a 1.6 | 93 | 94 | 1,000 | 1,000 |
| 25 Hz | Mova antigo | SP | 2.1 | 1.5 a 2.8 | 9 | 65 | < 0,001 | < 0,001 |
| 25 Hz | Kangas | SE | -1.8 | -2.6 a -0.9 | 42 | 11 | < 0,001 | < 0,001 |
| 25 Hz | Kangas | SP | 0.3 | 0.1 a 0.7 | 1 | 10 | 0,012 | 0,223 |
| 25 Hz | Kangas (eixo z) | SE | -0.9 | -1.6 a -0.3 | 22 | 6 | 0,004 | 0,074 |
| 25 Hz | Kangas (eixo z) | SP | 0.5 | 0.2 a 0.9 | 0 | 13 | < 0,001 | 0,005 |
| 25 Hz | Bourke3 | SE | 1.3 | 0.1 a 2.7 | 56 | 79 | 0,058 | 0,984 |
| 25 Hz | Bourke3 | SP | 0.0 | 0.0 a 0.1 | 0 | 1 | 1,000 | 1,000 |
| 25 Hz | PIPTO (original) | SE | -2.6 | -4.1 a -0.9 | 87 | 42 | < 0,001 | 0,002 |
| 25 Hz | PIPTO (original) | SP | 2.3 | 1.4 a 3.1 | 31 | 91 | < 0,001 | < 0,001 |
| 25 Hz | PIPTO (tempo real) | SE | -4.0 | -5.1 a -2.8 | 87 | 18 | < 0,001 | < 0,001 |
| 25 Hz | PIPTO (tempo real) | SP | 3.0 | 2.1 a 3.8 | 17 | 96 | < 0,001 | < 0,001 |
| 100 Hz | Mova antigo | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| 100 Hz | Mova antigo | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| 100 Hz | Kangas | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| 100 Hz | Kangas | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| 100 Hz | Kangas (eixo z) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| 100 Hz | Kangas (eixo z) | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| 100 Hz | Bourke3 | SE | -0.6 | -1.4 a 0.3 | 32 | 22 | 0,220 | 1,000 |
| 100 Hz | Bourke3 | SP | -0.1 | -0.2 a 0.0 | 2 | 0 | 0,500 | 1,000 |
| 100 Hz | PIPTO (original) | SE | -0.1 | -1.0 a 0.8 | 26 | 25 | 1,000 | 1,000 |
| 100 Hz | PIPTO (original) | SP | -0.6 | -1.1 a -0.1 | 31 | 15 | 0,026 | 0,466 |
| 100 Hz | PIPTO (tempo real) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| 100 Hz | PIPTO (tempo real) | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |

</details>

## 2. Faixa do acelerômetro (referência: ±8 g)

**Sensibilidade (% de quedas detectadas)**

| Algoritmo | ±2 g | ±4 g | principal (taxa nativa, ±8 g) | sem saturação (±16 g da SisFall) |
|---|---|---|---|---|
| Mova antigo | 47.7 ▼ | 67.5 | 67.5 | 67.5 |
| Kangas | 92.8 | 92.9 | 92.9 | 92.9 |
| Kangas (eixo z) | 29.8 | 30.0 | 30.0 | 30.0 |
| Bourke3 | 47.1 ▼ | 57.9 | 57.9 | 57.9 |
| PIPTO (original) | 34.8 ▼ | 80.9 | 80.9 | 80.9 |
| PIPTO (tempo real) | 36.9 ▼ | 84.2 | 84.3 | 84.3 |

**Especificidade (% de ADLs sem alarme)**

| Algoritmo | ±2 g | ±4 g | principal (taxa nativa, ±8 g) | sem saturação (±16 g da SisFall) |
|---|---|---|---|---|
| Mova antigo | 93.0 ▲ | 82.2 | 82.2 | 82.2 |
| Kangas | 98.5 | 98.6 | 98.6 | 98.6 |
| Kangas (eixo z) | 98.0 | 98.0 | 98.0 | 98.0 |
| Bourke3 | 100.0 | 99.8 | 99.8 | 99.8 |
| PIPTO (original) | 98.6 ▲ | 88.6 | 88.6 | 88.6 |
| PIPTO (tempo real) | 97.3 ▲ | 82.4 | 82.4 | 82.4 |

▲/▼ = melhor/pior que a referência, com McNemar exato corrigido por Holm < 0,05 **e** IC 95% (bootstrap por participante) da diferença sem o zero.

<details><summary>Testes pareados contra a referência</summary>

| Condição | Algoritmo | Métrica | Diferença (pontos %) | IC 95% | só a referência acertou | só a condição acertou | p McNemar | p Holm |
|---|---|---|---|---|---|---|---|---|
| ±2 g | Mova antigo | SE | -19.8 | -21.9 a -17.8 | 346 | 0 | < 0,001 | < 0,001 |
| ±2 g | Mova antigo | SP | 10.8 | 8.5 a 12.8 | 0 | 287 | < 0,001 | < 0,001 |
| ±2 g | Kangas | SE | -0.1 | -0.4 a 0.1 | 3 | 1 | 0,625 | 1,000 |
| ±2 g | Kangas | SP | -0.0 | -0.1 a 0.0 | 1 | 0 | 1,000 | 1,000 |
| ±2 g | Kangas (eixo z) | SE | -0.2 | -0.4 a 0.0 | 3 | 0 | 0,250 | 1,000 |
| ±2 g | Kangas (eixo z) | SP | 0.0 | 0.0 a 0.1 | 0 | 1 | 1,000 | 1,000 |
| ±2 g | Bourke3 | SE | -10.8 | -12.7 a -8.8 | 199 | 11 | < 0,001 | < 0,001 |
| ±2 g | Bourke3 | SP | 0.2 | 0.0 a 0.4 | 0 | 5 | 0,063 | 1,000 |
| ±2 g | PIPTO (original) | SE | -46.1 | -51.2 a -41.6 | 810 | 6 | < 0,001 | < 0,001 |
| ±2 g | PIPTO (original) | SP | 10.0 | 7.9 a 12.1 | 12 | 277 | < 0,001 | < 0,001 |
| ±2 g | PIPTO (tempo real) | SE | -47.4 | -52.5 a -43.0 | 830 | 3 | < 0,001 | < 0,001 |
| ±2 g | PIPTO (tempo real) | SP | 15.0 | 12.2 a 17.5 | 9 | 406 | < 0,001 | < 0,001 |
| ±4 g | Mova antigo | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| ±4 g | Mova antigo | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| ±4 g | Kangas | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| ±4 g | Kangas | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| ±4 g | Kangas (eixo z) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| ±4 g | Kangas (eixo z) | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| ±4 g | Bourke3 | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| ±4 g | Bourke3 | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| ±4 g | PIPTO (original) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| ±4 g | PIPTO (original) | SP | 0.0 | -0.1 a 0.2 | 3 | 4 | 1,000 | 1,000 |
| ±4 g | PIPTO (tempo real) | SE | -0.1 | -0.2 a 0.0 | 1 | 0 | 1,000 | 1,000 |
| ±4 g | PIPTO (tempo real) | SP | 0.1 | -0.1 a 0.3 | 4 | 6 | 0,754 | 1,000 |
| sem saturação (±16 g da SisFall) | Mova antigo | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | Mova antigo | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | Kangas | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | Kangas | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | Kangas (eixo z) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | Kangas (eixo z) | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | Bourke3 | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | Bourke3 | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | PIPTO (original) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | PIPTO (original) | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | PIPTO (tempo real) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| sem saturação (±16 g da SisFall) | PIPTO (tempo real) | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |

</details>

## 3. Orientação do celular (referência: orientação original da SisFall)

**Sensibilidade (% de quedas detectadas)**

| Algoritmo | principal (taxa nativa, ±8 g) | orientação aleatória, COM calibração | orientação aleatória, SEM calibração |
|---|---|---|---|
| Mova antigo | 67.5 | 67.5 | 67.5 |
| Kangas | 92.9 | 92.9 | 73.3 ▼ |
| Kangas (eixo z) | 30.0 | 22.6 ▼ | 22.6 ▼ |
| Bourke3 | 57.9 | 57.9 | 48.1 ▼ |
| PIPTO (original) | 80.9 | 80.9 | 80.9 |
| PIPTO (tempo real) | 84.3 | 84.3 | 84.3 |

**Especificidade (% de ADLs sem alarme)**

| Algoritmo | principal (taxa nativa, ±8 g) | orientação aleatória, COM calibração | orientação aleatória, SEM calibração |
|---|---|---|---|
| Mova antigo | 82.2 | 82.2 | 82.2 |
| Kangas | 98.6 | 98.6 | 77.2 ▼ |
| Kangas (eixo z) | 98.0 | 92.7 ▼ | 92.7 ▼ |
| Bourke3 | 99.8 | 99.8 | 87.5 ▼ |
| PIPTO (original) | 88.6 | 88.6 | 88.6 |
| PIPTO (tempo real) | 82.4 | 82.4 | 82.4 |

▲/▼ = melhor/pior que a referência, com McNemar exato corrigido por Holm < 0,05 **e** IC 95% (bootstrap por participante) da diferença sem o zero.

<details><summary>Testes pareados contra a referência</summary>

| Condição | Algoritmo | Métrica | Diferença (pontos %) | IC 95% | só a referência acertou | só a condição acertou | p McNemar | p Holm |
|---|---|---|---|---|---|---|---|---|
| orientação aleatória, COM calibração | Mova antigo | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, COM calibração | Mova antigo | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, COM calibração | Kangas | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, COM calibração | Kangas | SP | 0.0 | 0.0 a 0.1 | 0 | 1 | 1,000 | 1,000 |
| orientação aleatória, COM calibração | Kangas (eixo z) | SE | -7.3 | -11.0 a -3.6 | 409 | 281 | < 0,001 | < 0,001 |
| orientação aleatória, COM calibração | Kangas (eixo z) | SP | -5.3 | -6.8 a -3.5 | 178 | 37 | < 0,001 | < 0,001 |
| orientação aleatória, COM calibração | Bourke3 | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, COM calibração | Bourke3 | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, COM calibração | PIPTO (original) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, COM calibração | PIPTO (original) | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, COM calibração | PIPTO (tempo real) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, COM calibração | PIPTO (tempo real) | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, SEM calibração | Mova antigo | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, SEM calibração | Mova antigo | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, SEM calibração | Kangas | SE | -19.6 | -21.9 a -17.1 | 363 | 21 | < 0,001 | < 0,001 |
| orientação aleatória, SEM calibração | Kangas | SP | -21.4 | -23.8 a -18.7 | 574 | 7 | < 0,001 | < 0,001 |
| orientação aleatória, SEM calibração | Kangas (eixo z) | SE | -7.3 | -11.1 a -3.6 | 409 | 281 | < 0,001 | < 0,001 |
| orientação aleatória, SEM calibração | Kangas (eixo z) | SP | -5.3 | -6.8 a -3.6 | 178 | 37 | < 0,001 | < 0,001 |
| orientação aleatória, SEM calibração | Bourke3 | SE | -9.8 | -11.9 a -7.4 | 221 | 50 | < 0,001 | < 0,001 |
| orientação aleatória, SEM calibração | Bourke3 | SP | -12.3 | -14.2 a -10.4 | 328 | 2 | < 0,001 | < 0,001 |
| orientação aleatória, SEM calibração | PIPTO (original) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, SEM calibração | PIPTO (original) | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, SEM calibração | PIPTO (tempo real) | SE | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |
| orientação aleatória, SEM calibração | PIPTO (tempo real) | SP | 0.0 | 0.0 a 0.0 | 0 | 0 | 1,000 | 1,000 |

</details>
