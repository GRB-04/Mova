# Metodologia das análises: estatística, robustez do celular e vida real (LTMM)

Registro do **processo científico** de cada análise:
- a pergunta;
- o que foi decidido **antes** de ver os resultados;
- as alternativas consideradas e por que foram rejeitadas;
- as suposições;
- as checagens de sanidade;
- as limitações.

Resultados: `results/estatistica.md`, `results/robustez/RESUMO.md` e `results/ltmm/RESUMO.md`. Achados consolidados: `docs/ACHADOS.md`.

## 0. Princípios que valem para todas as análises

1. **Desenho pareado.** Todos os algoritmos são avaliados nos **mesmos** arquivos, nas mesmas condições. Por isso as comparações usam testes pareados, que têm mais poder e são mais corretos do que comparar números de amostras diferentes.
2. **Sem ajuste dos algoritmos.** Nenhum limiar foi mudado para "melhorar" resultados. As condições de robustez mudam o **sinal** (taxa, faixa, orientação), nunca o algoritmo. Versões ajustadas, se houver, serão relatadas separadamente (ver `PLANO_ARTIGO.md`, C10).
3. **Relatar tudo.** Todas as condições planejadas aparecem nas tabelas, inclusive as que não mostram diferença.
4. **Reprodutibilidade.** Sementes aleatórias fixas (bootstrap e rotações), scripts versionados e entradas públicas.
5. **Ordem dos eventos (honestidade).** Os critérios da seção 1 e a escolha das condições da seção 2 foram definidos antes de rodar. Houve **uma** mudança depois de um teste-piloto com 60 arquivos, no modelo da taxa de amostragem (seção 2.1). Ela foi motivada pelo funcionamento do `expo-sensors`, não pelo resultado, e está registrada lá. Os critérios da LTMM (seção 3) foram fixados antes de processar os registros. O único registro olhado antes (CO010) serviu para medir o tempo de execução e não alterou nenhum critério.

---

## 1. Estatística: "o algoritmo X é melhor que o Y?"

Script: `scripts/stats_sisfall.ts`. Funções: `scripts/lib/stats.ts`, com testes unitários contra valores tabelados em `scripts/__tests__/stats.test.ts`.

### 1.1 Unidade de análise e desfecho
- **Unidade:** a tentativa, isto é, um arquivo da SisFall.
- **Desfecho:** binário.
  - Numa **queda**, acerto = pelo menos um alarme. Isso define a sensibilidade (SE).
  - Numa **ADL**, acerto = nenhum alarme. Isso define a especificidade (SP).
- SE e SP são analisadas **separadamente**. Um índice único (acurácia, F1) mistura as duas e depende da proporção quedas/ADLs da base (o artigo do PIPTO alerta para isso).

### 1.2 Teste principal: McNemar exato (binomial)
- **Por quê:** os mesmos arquivos passam por todos os algoritmos. Comparar a SE de A e de B é comparar duas **proporções pareadas**. O McNemar usa só os casos **discordantes**: os que só A acertou e os que só B acertou. Os casos em que os dois acertam ou os dois erram não informam qual é melhor.
- **Por que a versão exata:** com poucos discordantes, a aproximação qui-quadrado é ruim. A exata (Binomial(n, ½)) vale para qualquer n e não tem custo relevante.
- **Alternativas rejeitadas:**

| Alternativa | Por que não |
|---|---|
| Olhar se os ICs se sobrepõem | Não é um teste; é conservador demais e ignora o pareamento |
| Qui-quadrado ou Fisher para duas proporções | Supõe amostras **independentes**; aqui elas são pareadas, então perde poder e fica incorreto |
| McNemar assintótico (χ² com correção de continuidade) | Aproximação desnecessária quando a versão exata é barata |
| Regressão logística mista ou GEE (efeito aleatório por participante) | Seria a modelagem mais completa, mas exige um pacote estatístico (R ou statsmodels) que não está no projeto, e acrescenta suposições (forma da função de ligação, estrutura de correlação). Fica como verificação opcional; o bootstrap por participante (1.5) cobre a mesma preocupação com menos suposições |

### 1.3 Teste global antes dos pares: Q de Cochran
- É a extensão do McNemar para k algoritmos (H0: todos têm a mesma taxa de acerto).
- Serve como "porteiro": só faz sentido olhar os pares se houver alguma diferença global. Evita a "pescaria" de diferenças.

### 1.4 Muitas comparações: correção de Holm
- São 6 algoritmos, logo 15 pares, vezes 2 métricas: **30 testes**. Sem correção, a chance de pelo menos um falso "melhor" seria alta.
- **Holm** controla a probabilidade de qualquer falso positivo (FWER), como o Bonferroni, mas é sempre pelo menos tão poderoso e não supõe independência entre os testes.
- **Alternativa rejeitada:** Benjamini–Hochberg (controle da FDR). É adequado para triagem de muitas hipóteses; aqui são poucas comparações confirmatórias e queremos evitar **qualquer** afirmação falsa de superioridade.

### 1.5 O problema da dependência: várias tentativas por pessoa
- **Suposição violada:** o McNemar e o IC de Wilson tratam as 1744 quedas como independentes. Mas elas vêm de **24 pessoas**, cerca de 73 por pessoa, e o jeito de cair de uma pessoa se repete. Isso faz a precisão parecer maior do que é.
- **Correção:** **bootstrap por participante** (*cluster bootstrap*):
  - reamostra **pessoas** com reposição, 2000 vezes, com semente fixa;
  - recalcula a métrica (ou a diferença A − B) em cada reamostra;
  - o IC 95% é dado pelos percentis 2,5 e 97,5.
- **Regra de decisão (definida antes):** só se afirma "A é melhor que B" quando **as duas coisas** acontecem:
  - McNemar corrigido por Holm com p < 0,05;
  - IC 95% por participante da diferença sem o zero.

  Se discordarem, a conclusão é "inconclusivo". Isso evita que um p minúsculo, inflado pelo número de arquivos, decida sozinho.
- **Por que percentil e não BCa:** o percentil é simples e transparente. O BCa corrige viés e assimetria, mas com 24 a 38 clusters a diferença é pequena. Fica registrado como limitação.

### 1.6 Intervalo de uma única proporção: Wilson
- **Wald** (p ± 1,96·EP) falha perto de 0% ou 100%, que é onde estão nossas SPs (98–99,8%).
- **Clopper–Pearson** é conservador demais.
- **Wilson** tem boa cobertura nesses extremos.
- Também relatamos o IC por participante (1.5), que é o mais honesto.

### 1.7 Tamanho do efeito
- Toda comparação traz a **diferença em pontos percentuais** com IC, não só o p. "Kangas detecta 12 pontos a mais que o PIPTO (IC 8,4 a 15,7)" informa mais do que "p < 0,001".

### 1.8 Limitações desta análise
- A SE vem basicamente de **jovens** (23) e de **um** idoso judoca (SE06).
- Os resultados são da SisFall: quedas simuladas sobre colchão, sensor na cintura.
- **Pontuação por arquivo:** um alarme no fim de um arquivo de queda conta como acerto mesmo que tenha sido disparado por outro movimento. Na SisFall cada arquivo de queda tem 15 s e uma única queda, o que limita o problema.

---

## 2. Robustez às condições do celular

Script: `scripts/robustness.ts`. Mesmos 4396 arquivos em todas as condições. Testes: McNemar exato pareado **contra a condição de referência** de cada família, mais bootstrap por participante e Holm dentro de cada família. Símbolos ▲ e ▼ só quando os dois critérios da seção 1.5 concordam.

**Checagem do script:** a condição "principal" do script de robustez reproduz exatamente os números do replay (por exemplo, Kangas 92,9/98,6 e PIPTO 80,9/88,6). Ou seja, o novo código não alterou os resultados.

### 2.1 Taxa de amostragem (10, 25, 50, 100 Hz)
- **Pergunta:** e se o celular entregar menos amostras por segundo?
- **Níveis escolhidos:**
  - **10 Hz:** o que o detector antigo do Mova pedia (100 ms);
  - **25 Hz:** intermediário;
  - **50 Hz:** a meta do app e a **referência**;
  - **100 Hz:** a taxa nativa do Bourke3.
- **Modelo do celular:**
  - **Filtro fixo de 40 Hz**, que representa o filtro interno do acelerômetro (suposição; celulares costumam amostrar o sensor a ≥ 100 Hz com banda de algumas dezenas de Hz);
  - seguido de **descarte de amostras** até a taxa R.
- **Por que esse modelo:** o `expo-sensors` não reamostra nem filtra. O `setUpdateInterval` só **descarta** eventos (comparação `>` no código nativo, Achado 19). Então, a 10 Hz, o app recebe amostras pontuais do sinal do sensor, com *aliasing* incluído.
- **Mudança registrada:** no piloto (60 arquivos), a primeira versão usava um anti-*aliasing* "ideal" a 0,4·R (4 Hz para R = 10). Foi trocada antes da rodada completa, porque não é o que o celular faz: suavizaria os picos de impacto além do real e seria pessimista para quem usa picos. A mudança veio do mecanismo do `expo-sensors`, não do resultado.
- **Todos os detectores recebem a mesma taxa R** e reamostram internamente para a taxa de cada um, por interpolação linear (como no app). Abaixo da taxa interna (por exemplo, Kangas a 50 Hz recebendo 10 Hz), a interpolação **não cria informação**. É exatamente esse o efeito que se quer medir.
- **Previsão (feita antes):**
  - acima de 50 Hz, nada muda para Kangas e PIPTO, que trabalham a 50 Hz internamente;
  - abaixo, os picos curtos de impacto se perdem.

  Confirmou-se: 50 e 100 Hz dão resultados idênticos para Kangas e PIPTO.
- **Limitações:** não modelamos o *jitter* (variação no intervalo entre amostras) do celular real, nem a banda real do filtro de cada aparelho.

### 2.2 Faixa do acelerômetro (±2, ±4, ±8 g, sem saturação)
- **Pergunta:** e se o celular for barato ou antigo e o sensor saturar em uma faixa menor?
- **Níveis:**
  - ±2 g: faixa mínima de muitos acelerômetros MEMS e a faixa de parte da LTMM e do Bagalà;
  - ±4 g;
  - ±8 g: **referência**;
  - sem saturação: os ±16 g da SisFall.
- **Saturação por eixo, depois do filtro.** É onde ela acontece num sensor real: no conversor, depois da filtragem analógica.
- **Limitação:** celulares reais podem mudar a faixa dinamicamente ou ter não linearidade perto do limite; isso não foi modelado.

### 2.3 Orientação ("celular em qualquer posição")
- **Pergunta:** e se o celular não estiver na orientação dos sensores dos artigos?
- **Método:**
  - cada arquivo recebe uma **rotação 3D aleatória uniforme** (método de Shoemake, com quatérnio unitário a partir de 3 números uniformes), com semente derivada do nome do arquivo (reprodutível);
  - a rotação é **fixa durante a tentativa**, o que supõe que o celular não gira dentro do bolso nos 15 s.
- **Dois braços:**
  - **com calibração:** a referência "em pé" é girada junto. É o que os 5 s de calibração do app produzem;
  - **sem calibração:** a referência continua a original. É o que acontece se o app supuser uma orientação fixa.
- **Por que rotação de dados de cintura, e não dados reais de bolso:**
  - a única base pública com bolso (UMAFall) está inacessível daqui;
  - a rotação **isola o fator orientação**, sem misturar com o movimento da coxa.
- **Previsões (feitas antes), usadas como checagem do método:**
  - Algoritmos que só usam a **magnitude** (Mova antigo, PIPTO) devem dar resultados **idênticos** com ou sem rotação, porque filtro e rotação comutam e a magnitude é invariante.
  - Com calibração, Kangas e Bourke3 também devem ficar idênticos.

  As duas previsões se confirmaram exatamente, o que valida a implementação.
- **Limitação importante:** no bolso da calça, a orientação **muda com a postura**: sentado, a coxa fica horizontal e "parece deitado". Essa análise **não** simula isso. Ela mostra só o efeito de uma orientação fixa desconhecida. O cenário real do bolso tende a ser **pior** e precisa de dados reais (UMAFall ou o teste no celular).

---

## 3. Vida real: alarmes falsos por dia (LTMM)

Script: `scripts/ltmm.ts`. Base: *Long Term Movement Monitoring Database* (PhysioNet), lida pelo espelho público em `s3.amazonaws.com/physionet-open/ltmm/1.0.0/`.

### 3.1 Por que a LTMM
- É a única base pública acessível daqui com **dias inteiros de vida real de idosos** (65–89 anos, ~3 dias por pessoa).
- **Sensor na lombar**, a 100 Hz, com eixos rotulados (vertical, médio-lateral, ântero-posterior). É uma posição parecida com a do Bagalà e do Bourke.
- Responde à pergunta prática "quantos alarmes falsos por dia o cuidador receberia?", que a SisFall não responde, porque as ADLs da SisFall são roteirizadas e curtas.

### 3.2 Desfecho
- A LTMM **não tem quedas anotadas**. **Todo alarme é tratado como falso.**
- **Suposição:** a chance de uma queda real em ~3 dias é baixa. O único registro com queda relatada no diário de uso (CO005, "fall 11:40") foi **excluído antes** da análise.
- Os alarmes não são inspecionados um a um. Um alarme "verdadeiro" (uma queda não relatada) inflaria a taxa de falsos, ou seja, o erro iria contra os algoritmos, de forma conservadora.

### 3.3 Critérios de inclusão (definidos antes de processar)
- **Faixa do sensor ≥ ±3,5 g** nos três eixos.
  - Muitos registros têm faixa de **±1,93 g**, e alguns de ±0,86 g a ±1,52 g.
  - Os limiares de impacto vão de 1,7 g (Kangas SV_D) a ≈ 3,06 g (PIPTO).
  - Com a faixa abaixo do limiar, o algoritmo **nunca** dispara, o que daria uma taxa artificialmente baixa (viés a favor dos algoritmos).
  - O valor 3,5 g é o maior limiar com uma margem. O Bagalà excluiu quedas saturadas pelo mesmo motivo.
- **≥ 24 h de gravação** e **100 Hz**.
- **Todos** os registros que passam nos critérios são analisados (não é uma amostra). Assim não há viés de seleção nossa.

### 3.4 Tempo de uso (o denominador)
- O participante tira o sensor (banho, às vezes à noite). Contar essas horas subestimaria a taxa.
- **Critério de não uso do GGIR (van Hees et al.):**
  - janelas de 60 min, com passo de 15 min;
  - uma janela é "não uso" se ≥ 2 eixos tiverem desvio padrão < 13 mg **ou** ≥ 2 eixos tiverem amplitude < 50 mg;
  - alarmes em minutos de não uso são descartados e contados à parte.
- **Alternativa considerada:** o diário de uso (`ReportHome75h.xlsx`). Não é usado como critério principal porque é texto livre, incompleto e com horários marcados com "?". Pode servir de checagem de sensibilidade depois.
- **A conferir:** a citação exata do critério (van Hees et al. 2011/2013, implementado no pacote GGIR).

### 3.5 Referência "em pé" (vertical)
- Os detectores com postura precisam da vertical. Na lombar, o eixo "v" do sensor **não** é exatamente vertical: há inclinação da coluna e a fixação do cinto.
- **Método, análogo à calibração do app:**
  - escolher os segundos de **caminhada** durante o uso: média do SV entre 0,9 e 1,1 g e desvio padrão entre 0,08 e 0,6 g;
  - a vertical é a média normalizada do vetor gravidade nesses segundos.
- **Checagem de qualidade:** relatamos, por registro, o ângulo entre a vertical estimada e o eixo v, e quantos segundos de caminhada foram usados.
- **Alternativa rejeitada:** usar o eixo v puro. Seria o caso "sem calibração" da seção 2.3, que mostramos degradar Kangas e Bourke3.

### 3.6 Detectores e sinal
- Os mesmos da SisFall, com a mesma simulação de celular a partir dos 100 Hz da LTMM (filtro, decimação e ±8 g):
  - Mova antigo a 10 Hz;
  - Kangas e PIPTO a 50 Hz;
  - Bourke3 a 100 Hz.
- **Eixos do "aparelho":** x = vertical, y = médio-lateral, z = ântero-posterior. Isso só importa para o "Kangas (eixo z)".
- O **PIPTO original** (que olha a gravação inteira) **não** é aplicado. A média global de 75 h e o "contexto da gravação inteira" não fazem sentido em monitoramento contínuo. Só a versão em tempo real é usada.

### 3.7 Estatística
- **Taxa agregada por dia** (total de alarmes ÷ dias de uso), com **IC por bootstrap de pessoas**: cada pessoa conta como uma unidade, porque os alarmes de uma mesma pessoa não são independentes.
- **Mediana e IIQ por pessoa:** a distribuição costuma ser assimétrica, com poucas pessoas concentrando muitos alarmes.
- **Comparação entre algoritmos:** **Wilcoxon pareado** (postos sinalizados) sobre as taxas por pessoa, com correção de Holm.
  - **Por que Wilcoxon:** é pareado (as mesmas pessoas) e não supõe normalidade.
  - **Alternativa:** regressão de Poisson ou binomial negativa com efeito por pessoa. Exige pacote estatístico e suposições sobre a dispersão; fica como verificação opcional.

### 3.8 Limitações
- Lombar ≠ celular no bolso.
- A taxa depende do grupo (CO = sem histórico de quedas; FL = com histórico).
- Os participantes são de Israel (contexto da coleta original).
- A LTMM é usada só para **alarmes falsos**, nunca para sensibilidade.
