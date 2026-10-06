# Etapa 1: conferência dos parâmetros nos artigos

Situação em 06/10/2026. Conferido no texto completo (XML/JATS) de três artigos:
- **Bagalà 2012**: PLoS ONE 7(5):e37062.
- **PIPTO**: Moutsis et al., *Sensors* 23(18):7951, 2023.
- **SisFall**: Sucerquia et al., *Sensors* 17(1):198, 2017.

**Ainda faltam:**
- a **Tabela S1 do Bagalà**, que é um DOCX separado e não vem no XML. Baixe em journals.plos.org, na seção "Supporting information";
- os PDFs originais de **Kangas 2008** e **Bourke 2010**, que são pagos (via Periódicos CAPES ou biblioteca).

Legenda: ✅ confere com o implementado · ⚠️ diverge ou exige ajuste no texto do artigo · ❓ não está no texto lido.

## Bagalà 2012

| Item | Implementado / suposto | No artigo | Status |
|---|---|---|---|
| Kangas 1a–1d: sinais de impacto | SV_TOT, SV_D, SV_MaxMin, Z2 | "sum vector, dynamic sum vector (HPF), sliding sum vector and vertical acceleration, respectively" | ✅ |
| Kangas: postura | 2 s após o impacto, LPF vertical, média de 0,4 s, ≤ 0,5 g | idem | ✅ |
| Kangas 2a/2b: início da queda | SV_TOT < 0,6 g e impacto em até 1 s | idem | ✅ |
| Qual sinal é o 2a e qual é o 2b | 2b = Z2 | O símbolo some no XML também. A Discussão confirma: "Kangas1d, Kangas2b, Kangas3b … vertical acceleration" | ✅ 2b = Z2 · ❓ 2a (ver Tabela S1) |
| Kangas: desempenho original | SE 76–97%, SP 100% | "sensitivity … of the different eight algorithms at the waist varied from 76% to 97% and the specificity was 100%" | ✅ |
| Kangas no Bagalà | SE < 55%, < 9 alarmes falsos/dia | "Kangas' algorithms generated less than 9 false alarms, but sensitivity was lower than 55%" | ✅ |
| Bourke3: LFT / UFT | 0,65 / 2,8 g | idem | ✅ |
| Bourke3: bordas | 600 ms / 350 ms | idem | ✅ |
| Bourke3: velocidade | ≤ −0,7 m/s; ∫(SV − 1 g) desde o último cruzamento de 1 g | "numerical integration of the SV signal with the gravity component subtracted". **A janela de integração não é descrita** | ✅ método · ❓ janela (ver Bourke 2010) |
| Bourke3: postura | ângulo > 60° em mais de 75% de t+1..t+3 s | idem | ✅ |
| Bourke3: desempenho original | SE 100%, SP 100%, 0,6 FP/dia | "100% sensitivity and specificity … lowest false-positive rate (0.6 false positive per day)"; base de 240 quedas simuladas, 52,4 h de ADL de idosos | ✅ |
| Bourke3 no Bagalà | SE 82,8%, SP 96,7%, ~5 FP/dia | "SE (83%) and SP (97%) … about 5 false alarms per day"; ACC 96,3%, PPV 38,1% | ✅ |
| Média dos 13 algoritmos | SE 57,0 ± 27,3%, SP 83,0 ± 30,3% | idem; PPV médio 19,3 ± 9,7% | ✅ |
| Sensor do Bagalà | cintura | **lombar** (DynaPort MiniMod, cinto), eixos x = vertical; faixa de ±2 g ou ±6 g; a taxa de amostragem some no XML | ⚠️ escrever "lombar" |
| Pontuação do Bagalà | — | janelas de 60 s; ADL = janelas "ativas" (amplitude > 1,01 g), total de 1170 janelas | ❓ diferente da nossa (por arquivo) |

## PIPTO (Moutsis et al. 2023)

| Item | Implementado / suposto | No artigo | Status |
|---|---|---|---|
| Limiares | 6,5; max(média, 20) + 10; 50; 105; 85; 100; 100; max_limit_2 = max_limit | Seção 4.5 e Tabela 1, idênticos | ✅ |
| Eixo "entry" | 1 unidade ≈ 10 ms | "sub_1 … 50 (≃0.5 s)", "fall_duration … 100, which corresponds to about one second" | ✅ |
| dist_1 / dist_2 | sem efeito no código (laço com condição sempre falsa) | Tabela 1: "the entry distance before and after the fall, where the algorithm should search for highs" | ⚠️ **o código de referência não faz o que o artigo descreve.** Vale registrar no nosso artigo |
| **Desempenho "> 97% na SisFall"** (do pipeline) | — | **O PIPTO não foi avaliado na SisFall.** Validação: UR + 20% da KFall; teste: MMsys + 80% da KFall | ⚠️ **corrigir: o número vinha de fonte secundária e está errado** |
| Desempenho publicado | — | KFall (teste): SE 91,56%, SP 85,90%, acurácia 88,51%, precisão 84,79%. MMsys (peito): SE 90,40%, SP 93,96%. MMsys (coxa): SE 62,28%, SP 81,28% | ✅ |
| Contradição "99% × SP 85,9%" | — | não existe no artigo; vinha da fonte secundária | ✅ resolvida |
| Sensor da KFall | — | LPMS-B2 na lombar, 100 Hz, g → m/s² com 9,807 | ✅ |
| Pontuação dos autores | por arquivo, binária | por série: cada detecção extra numa série conta como FP adicional | ⚠️ diferente; declarar |
| Classes fracas (KFall) | — | "Gently jump" 82,5% FP; "Collapse into a chair" 69,2% FP; "Stumble while walking" 49,6% FP; "Forward fall while jogging (trip)" só 38,4% detectadas | ✅ comparável à SisFall (ver `results/RESUMO.md`) |

## SisFall (Sucerquia et al. 2017)

| Item | Implementado / suposto | No artigo | Status |
|---|---|---|---|
| ADXL345 | ±16 g, 13 bits, g = raw·32/8192 | "ADXL345 accelerometer (configured for ± 16 g, 13 bits of ADC)" | ✅ |
| Taxa | 200 Hz | "original frequency sample of 200 Hz" | ✅ |
| Orientação do sensor | "em pé" = [0, −1, 0] | "positive y-axis in the gravity direction … z-axis forward … x-axis to the right" (y aponta para o chão, então lê −1 g em pé) | ✅ |
| Posição | cintura | "fixed to the waist … as a belt buckle" | ✅ |
| Participantes | 23 jovens + 15 idosos | 23 (19–30 anos) + 15 (60–75 anos); SE06 (60 anos, judoca) fez quedas | ✅ |
| Atividades dos idosos | — | idosos **não** fizeram D06, D13, D18, D19 | ⚠️ explica parte da SP alta no grupo SE; declarar |
| Quedas sobre colchão | — | "falls were simulated using safety landing mats" | ✅ (limitação) |
| Nº de tentativas | 4396 no espelho | **4510** no artigo | ⚠️ faltam 114 no espelho; declarar |
| Descrição de D01–D19 e F01–F15 | de memória | Tabelas 1 e 2, conferidas; D13 = "sentar, deitar rápido, esperar e sentar de novo" | ✅ |
| Desempenho de referência na SisFall | — | limiar treinado na própria base com validação cruzada de 10 partes: C8 ≈ 96% de acurácia; no limiar de SE máxima (T2), SP cai para 33–68% | ✅ útil na Discussão |
| Filtro | — | Butterworth de 4ª ordem a 5 Hz bastou; "a frequency sample of up to 11 Hz could be enough" | ✅ útil na Discussão |

## Kangas 2008 e Bourke 2010 (PDFs ainda não obtidos)

| Parâmetro | O que confirmar |
|---|---|
| Kangas: limiares de impacto (2,0 / 1,7 / 2,0 / 1,5 g) | Hoje vêm só do porte Guardian |
| Kangas: filtro (Butterworth 0,25 Hz?) e taxa | Idem |
| Bourke 2010: **janela de integração da velocidade** | É o que mais afeta o nosso resultado: o Bourke3 perde 466 quedas nesse estágio |
| Bourke 2010: estimativa do vetor gravidade e taxa | Hoje é suposição nossa |
| Bourke 2010: DOI | 10.1016/j.jbiomech.2010.07.005 (conferir) |
