# Achados do estudo (registro para o artigo)

Lista única de tudo que foi verificado até agora: o que descobrimos, de onde veio a evidência e o que muda no artigo. Atualize a cada novo achado. Numeração estável: cite como "Achado N".

Fontes de cada evidência:
- **[Bagalà]** Bagalà et al. 2012, PLoS ONE 7(5):e37062, texto completo (XML).
- **[PIPTO]** Moutsis et al. 2023, *Sensors* 23(18):7951, texto completo (XML).
- **[SisFall]** Sucerquia et al. 2017, *Sensors* 17(1):198, texto completo (XML).
- **[código PIPTO]** `github.com/smoutsis/fall_detection_through_acceleration_data`, commit `c0f7aa2`, `python/def_fall.py`.
- **[Guardian]** porte do Kangas, `altermarkive/guardian/Detector.kt` (MIT).
- **[expo-sensors]** código-fonte do `expo-sensors` 57.0.x instalado no projeto.
- **[replay]** nossos resultados: `results/RESUMO.md`, `results/sisfall_*.md`, `results/pipto_equivalencia.md`.

---

## A. Sobre o PIPTO

### Achado 1: o PIPTO nunca foi avaliado na SisFall
- **O que é:** o pipeline citava "acurácia > 97% na SisFall", de fonte secundária. No artigo original, a **validação** usa UR + 20% da KFall e o **teste** usa MMsys + 80% da KFall. A SisFall não aparece.
- **Evidência:** [PIPTO] seção 4.1 ("UR and KFall are selected for validation … MMsys is adopted for testing along with KFall") e Tabela 4.
- **Números publicados:**
  - KFall: SE 91,56%, SP 85,90%, acurácia 88,51%, precisão 84,79%.
  - MMsys, sensor no peito: SE 90,40%, SP 93,96%.
  - MMsys, sensor na coxa: SE 62,28%, SP 81,28%.
- **Implicação:** compare com a **KFall**, que repete o protocolo de atividades da SisFall. **Não** escreva "o PIPTO relata 97% na SisFall".

### Achado 2: o código público do PIPTO não faz tudo o que o artigo descreve
- **O que é:** o artigo descreve `dist_1` e `dist_2` (= 100) como "a distância em *entries* antes e depois da queda onde o algoritmo deve procurar picos". No código, os laços que deveriam limitar essa janela testam uma condição que **não depende da variável do laço** e é **sempre falsa**. Resultado: a janela vira a **gravação inteira** e `dist_1`/`dist_2` não têm efeito.
- **Evidência:** [PIPTO] Tabela 1 (linhas 6 e 7) × [código PIPTO], "Check 3": `if new_fall[i][0] < t1` com `t1 = new_fall[i][0] - 1 - dist_1`.
- **Outros comportamentos do código que o artigo não menciona:**
  - a lista `v_after_fall` **não é zerada** entre candidatos da mesma gravação e vai acumulando;
  - se a queda começa na amostra 0, o código lê `v[-1]`, que é a **última** amostra da gravação (índice negativo do Python);
  - a variável `indexx` do "Check 1" persiste entre iterações.
- **Implicação:** é um achado típico de replicação ("a implementação de referência difere da descrição"). Nosso porte reproduz o **código**, não o texto, para ficar comparável aos números publicados. Isso deve ser declarado.

### Achado 3: o porte do PIPTO é equivalente ao código original
- **O que é:** o porte em TypeScript e o `def_fall.py` original, rodado sem modificações, dão os mesmos alarmes em **4396 de 4396** arquivos da SisFall, a 50 Hz (sinal simulado de celular) e a 200 Hz (nativo).
- **Evidência:** [replay] `results/pipto_equivalencia.md`.
- **Implicação:** qualquer diferença de desempenho em relação ao publicado **não** é erro de reimplementação.

### Achado 4: na SisFall o PIPTO erra nas mesmas atividades em que erra na KFall
| Atividade | Autores (KFall) | Nós (SisFall, 50 Hz) |
|---|---|---|
| Sensibilidade geral | 91,6% | 80,9% |
| Especificidade geral | 85,9% | 88,6% |
| Pular de leve (D19): % de alarmes falsos | 82,5% | 62,9% |
| Tentar levantar e desabar na cadeira (D11) | 69,2% | 38,5% |
| Tropeçar andando (D18) | 49,6% | 76,9% |
| Queda correndo por tropeço (F05): % detectadas | 38,4% | 37,8% |
- **Evidência:** [PIPTO] Tabela 6 × [replay] `sisfall_pipto.md`.
- **Implicação:** o comportamento se reproduz em outra base. A SE cerca de 10 pontos menor deve ser discutida considerando três diferenças:
  - a base usada (KFall × SisFall);
  - a pontuação: os autores contam cada detecção extra numa série como FP adicional, e nós pontuamos por arquivo (ver o Achado 5);
  - os limiares, que os autores escolheram com 20% da própria KFall.

### Achado 5: a pontuação dos autores do PIPTO é diferente da nossa
- **O que é:** no PIPTO, "if more events are identified in a time series … the FPs increase accordingly". Uma série de queda com 2 detecções conta como 1 VP + 1 FP. Nós contamos por arquivo (≥ 1 alarme = VP; numa ADL, ≥ 1 alarme = 1 FP).
- **Evidência:** [PIPTO] seção 4.3.
- **Implicação:** declarar no artigo. Opcionalmente, recalcular nossas métricas também no critério dos autores.

### Achado 6: o eixo de tempo do PIPTO ("entry") equivale a ≈ 10 ms por unidade, qualquer que seja a taxa
- **O que é:** `entry[i] = (t[i] − t[i−1])/10 + entry[i−1] + 100/Hz`. Com o tempo em segundos, o 1º termo é desprezível, então os limites valem: `sub_1 = 50` ≈ 0,5 s, `fall_duration = 105` ≈ 1,05 s, `fall_limitation = 85` ≈ 0,85 s.
- **Evidência:** [PIPTO] seção 4.2 ("50 (≃0.5 s)", "100, which corresponds to about one second") e o script de teste dos autores, que gera o tempo em segundos.
- **Implicação:** os limites de tempo podem ser usados a 50 Hz no celular sem reescalar. Já o critério "> 20 amostras" depende da taxa.

### Achado 7: a adaptação do PIPTO para tempo real piora a especificidade
- **O que é:** o original olha a gravação inteira (média global e picos vizinhos de toda a série). No app isso não existe: usamos janela deslizante de 10 s. A SP cai de 88,6% para 82,4%, e a piora se concentra em corrida (D03, D04) e escada rápida (D06).
- **Evidência:** [replay] `sisfall_pipto.md` × `sisfall_pipto-streaming.md`.
- **Implicação:** é um custo real de levar o algoritmo para o celular e entra em Resultados e Discussão.

## B. Sobre Kangas e Bourke3

### Achado 8: Kangas 2b usa a aceleração vertical (Z2)
- **Evidência:** [Bagalà] Discussão: "The algorithms related to the vertical acceleration (Kangas1d, Kangas2b, Kangas3b)". O símbolo do 2a se perdeu no XML; precisa da Tabela S1.
- **Implicação:** a variante `kangas-faithful-Z2` é o 2b (SE 76,3%, SP 99,9%).

### Achado 9: a janela de integração da velocidade do Bourke3 não está descrita no Bagalà, e é o que mais derruba o Bourke3
- **O que é:** o Bagalà só diz "numerical integration of the SV signal with the gravity component subtracted", sem dizer a janela. No nosso funil, o estágio de velocidade elimina **466 quedas** (1548 → 1082). Com janela fixa de 1 s a SE sobe de 57,9% para 64,5%.
- **Evidência:** [Bagalà] seção "The algorithms"; [replay] `sisfall_bourke3*.md`.
- **Implicação:** é o **parâmetro mais importante a conferir** no PDF do Bourke 2010. Enquanto isso, é uma adaptação ⚠️.

### Achado 10: Kangas foi melhor na SisFall do que nas quedas reais do Bagalà
- **O que é:** SE 92,9% / SP 98,6% na SisFall, contra SE < 55% no Bagalà. Na SisFall, as quedas simuladas terminam deitadas. Nas reais, o idoso muitas vezes não deita ("subjects who fell on their buttocks, knees, or against a table … did not lie on the floor").
- **Evidência:** [Bagalà] Discussão; [replay].
- **Implicação:** quedas simuladas superestimam algoritmos que dependem da postura. É uma limitação central.

### Achado 11: a checagem de postura é o estágio que elimina os falsos positivos
- **O que é:** no Kangas, as ADLs que chegam à postura caem de 792 para 38. No Bourke3, de 463 para 6. O PIPTO não tem checagem de orientação e deixa passar 303 ADLs.
- **Evidência:** [replay] funis em `RESUMO.md`.
- **Implicação:** é o principal argumento técnico da Discussão.

### Achado 12: a postura pelo eixo z (porte Guardian) depende da orientação do aparelho
- **O que é:** com a regra "eixo z do LPF > 0,5 g" a SE cai para 30% na SisFall, porque o eixo z da SisFall aponta para a frente do corpo. A regra só funciona com o celular numa orientação específica.
- **Evidência:** [replay] `sisfall_kangas-guardian.md`; [SisFall] orientação dos eixos.
- **Implicação:** no bolso, com orientação variável, a calibração "em pé" é obrigatória. Antecipa o problema do celular no bolso.

### Achado 13: valores do Kangas e do Bourke3 confirmados no Bagalà
- Kangas: 0,6 g; 1 s; postura 2 s depois do impacto, média de 0,4 s, ≤ 0,5 g; SE original 76–97%, SP 100%.
- Bourke3: LFT 0,65 g; UFT 2,8 g; bordas de 600 e 350 ms; velocidade −0,7 m/s; postura > 60° em > 75% de t+1..t+3 s; original SE 100%, SP 100%, 0,6 FP/dia.
- **Ainda vêm só do Guardian:** os limiares de impacto do Kangas (2,0 / 1,7 / 2,0 / 1,5 g) e o filtro de 0,25 Hz.

## C. Sobre a SisFall

### Achado 14: o espelho usado está incompleto
- O artigo descreve **4510** tentativas; o espelho tem **4396** (faltam 114).
- **Implicação:** declarar e citar a fonte oficial.

### Achado 15: há arquivos com nome trocado no espelho
- A pasta `SA15` tem `D17_SE15_R01..R05` com conteúdo **diferente** dos arquivos de `SE15`. São as tentativas D17 do SA15 com o nome errado.
- **Implicação:** o loader tira o sujeito da pasta. Declarar.

### Achado 16: os idosos da SisFall não fizeram as ADLs mais difíceis, e só um idoso caiu
- Por recomendação médica, os idosos **não** fizeram D06, D13, D18 e D19. Só o SE06 (60 anos, **judoca**) simulou quedas.
- **Evidência:** [SisFall] seção 3.2.
- **Implicação:** a SP alta no grupo de idosos é inflada. A SE nos idosos vem de uma única pessoa, que não é representativa.

### Achado 17: quedas sobre colchão de segurança, sensor na cintura (fivela do cinto)
- **Evidência:** [SisFall] seções 3.3 e 3.4.
- **Implicação:** cintura ≠ bolso, e quedas amortecidas ≠ quedas reais. Ambos vão para Limitações.

### Achado 18: a referência de desempenho da própria SisFall é otimista
- Com o limiar treinado na própria base (validação cruzada), o atributo C8 chega a ≈ 96% de acurácia. No limiar que maximiza a SE, a SP cai para 33–68%. Um filtro de 5 Hz foi suficiente ("a frequency sample of up to 11 Hz could be enough").
- **Implicação:** contexto para a Discussão. Algoritmos ajustados na própria base parecem melhores do que algoritmos publicados aplicados a uma base nova.

## D. Sobre o celular e o app

### Achado 19: sem `HIGH_SAMPLING_RATE_SENSORS`, o Android entrega o acelerômetro devagar
- **O que é:** sem a permissão, o `expo-sensors` registra o sensor em `SENSOR_DELAY_NORMAL`. O intervalo de envio é um freio com comparação estrita (`>`) e padrão de 100 ms.
- **Evidência:** [expo-sensors] `SensorSubscription.kt`.
- **Implicação:** a permissão foi adicionada ao `app.json`. Medir a taxa real no aparelho é parte do protocolo.

### Achado 20: o detector antigo do Mova lia a ≤ 10 Hz e usava um único limiar
- **O que é:** `setUpdateInterval(100)` e alarme se |a| > 2,5 g. Na SisFall: SE 67,5%, SP 82,2%, ≈ 46 alarmes por hora de ADL roteirizada. Dispara em quase toda corrida, escada rápida e pulo.
- **Evidência:** `SeniorScreen.tsx` original; [replay] `sisfall_mova-legado.md`.
- **Implicação:** é a linha de base que motiva o estudo.

### Achado 21: saturar em ±8 g não muda nenhum resultado na SisFall
- 141 das 1744 quedas passam de 8 g num eixo depois do filtro, mas todos os limiares de decisão são ≤ 3,1 g.
- **Implicação:** a faixa do acelerômetro do celular (normalmente ±8 g ou mais) não é limitante para esses algoritmos.

### Achado 22: o `expo-sensors` não lê em segundo plano
- **Implicação:** o app do estudo precisa ficar aberto, com a tela ligada. Monitoramento real exigiria um módulo nativo com serviço em primeiro plano, que fica como trabalho futuro.

### Achado 23: o Bagalà usou sensor na lombar e pontuação por janelas de 60 s
- Sensor DynaPort MiniMod no cinto lombar, faixa de ±2 g ou ±6 g. Três quedas foram excluídas por saturação. As ADLs são janelas "ativas" de 60 s (amplitude > 1,01 g), 1170 janelas no total.
- **Implicação:** os números do Bagalà não são diretamente comparáveis aos nossos por arquivo. Declarar.

## F. Estatística e robustez (análises de 06/10/2026; métodos em `METODOLOGIA_ANALISES.md`)

### Achado 24: o Kangas detecta significativamente mais quedas que todos os outros; o Bourke3 tem a melhor especificidade
- **Teste global:** Cochran p < 0,001 para SE e SP.
- **Kangas × PIPTO (original):** SE +12,0 pontos (IC por participante 8,4 a 15,7).
- **Kangas × PIPTO (tempo real):** SE +8,6 (5,2 a 12,5).
- **Kangas × Bourke3:** SE +35,0 (30,5 a 39,2).
- **Bourke3 × Kangas em SP:** +1,2 ponto (0,5 a 2,0). A diferença é pequena, mas sólida.
- **PIPTO em tempo real × detector antigo do Mova em SP:** **sem diferença** (−0,2; −1,5 a 1,1). A adaptação do PIPTO para tempo real gera tantos alarmes falsos quanto o detector antigo.
- **Evidência:** `results/estatistica.md` (McNemar exato + Holm + bootstrap por participante).

### Achado 25: os intervalos "por arquivo" subestimam a incerteza
- PIPTO, SE de 80,9%:
  - IC de Wilson (arquivos tratados como independentes): 79,0–82,7;
  - IC por participante: **75,3–85,9**, quase o triplo da largura.
- **Implicação:** no artigo, relatar o IC por participante.

### Achado 26: abaixo de 50 Hz os algoritmos perdem quedas; acima de 50 Hz não ganham nada
- **A 10 Hz, perda de SE em relação a 50 Hz:**
  - Kangas: −20,4 pontos (92,9 → 72,6);
  - Bourke3: −19,2;
  - PIPTO: −35,3.
- **A 25 Hz:** o Kangas já perde 1,8 ponto (significativo).
- **A 100 Hz:** resultado idêntico ao de 50 Hz para Kangas e PIPTO, que trabalham a 50 Hz.
- **O detector antigo já lia a 10 Hz:** por isso não muda, e por isso era limitado.
- **Implicação:** o app **precisa garantir ≥ 50 Hz**. Isso confirma a importância da permissão `HIGH_SAMPLING_RATE_SENSORS` (Achado 19) e de medir a taxa real no celular.
- **Evidência:** `results/robustez/RESUMO.md`, seção 1.

### Achado 27: sensores de ±4 g bastam; ±2 g derruba PIPTO, Bourke3 e o detector antigo, mas não o Kangas
- **±4 g:** igual a ±8 g para todos os algoritmos.
- **±2 g, perda de SE:**
  - PIPTO: −46,1 pontos;
  - detector antigo: −19,8;
  - Bourke3: −10,8;
  - Kangas: **sem mudança** (92,8%).
- **Por que o Kangas resiste:** seus sinais de impacto são vetoriais (a soma de três eixos saturados em 2 g ainda passa de 2 g) e têm limiares de 1,5–2,0 g.
- **Implicação:** em celulares com sensor de ±2 g, só o Kangas se mantém. Também explica a exclusão desses registros na LTMM.

### Achado 28: sem calibração da posição "em pé", Kangas e Bourke3 perdem muito; com calibração, a orientação não importa
- **Orientação aleatória sem calibração:**
  - Kangas: SE −19,6 e **SP −21,4** pontos (98,6% → 77,2%);
  - Bourke3: SE −9,8 e SP −12,3.
- **Com calibração:** resultado idêntico ao original.
- **Detector antigo e PIPTO:** idênticos com ou sem rotação, porque só usam a magnitude. Isso também confirma que o método está certo.
- **Implicação:** a **calibração de 5 s em pé é indispensável** para os algoritmos com postura. Ela precisa estar no app final, não só no estudo.
- **Limitação:** a rotação é fixa. O bolso real muda de orientação ao sentar, o que deve ser pior.

## E. Recursos de dados verificados

| Base | Acesso deste ambiente | Uso possível |
|---|---|---|
| SisFall (espelho CSV) | ✅ (GitHub) | já usada |
| **LTMM** (PhysioNet, idosos em casa, até ~75 h por gravação, 100 Hz, tronco) | ✅ via S3 (`s3.amazonaws.com/physionet-open/ltmm/1.0.0/`) | **alarmes falsos por dia em vida real**, sem voluntários |
| UMAFall (celular no bolso + cintura, figshare) | ❌ bloqueado aqui; a equipe pode baixar | celular no bolso × cintura |
| KFall, MobiAct | exigem pedido de acesso aos autores | comparação direta com o PIPTO (KFall); celular no bolso (MobiAct) |
| FARSEEING (quedas reais) | acesso restrito | — |
