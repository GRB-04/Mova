# Plano para fechar o artigo

Situação em 06/10/2026, depois de conferir os textos completos de Bagalà 2012, PIPTO 2023 e SisFall 2017.

## 1. O que já temos

| Bloco | Situação |
|---|---|
| 3 algoritmos + detector antigo implementados, com testes | ✅ |
| Porte do PIPTO idêntico ao código dos autores (4396/4396) | ✅ |
| Avaliação na SisFall com simulação de celular (50/100 Hz, ±8 g) | ✅ `results/RESUMO.md` |
| Funil por estágio e taxa de erro por atividade | ✅ |
| Parâmetros conferidos em 3 dos 5 artigos | ✅ `docs/parametros_conferidos.md` |
| App de coleta com resultados e gráficos | ✅ compila; **não testado em aparelho** |

## 2. O que a leitura dos artigos mudou

1. **O PIPTO nunca foi avaliado na SisFall.** O "> 97% na SisFall" do pipeline estava errado. A comparação correta é com a **KFall**, que segue o mesmo protocolo de atividades. Lá os autores relatam SE 91,6% e SP 85,9%; nós obtivemos SE 81% e SP 89%, e **as mesmas atividades enganam o algoritmo**. O ganho é que agora a comparação é honesta e já é um resultado para o artigo.
2. **O código de referência do PIPTO não faz o que o artigo descreve** (`dist_1`/`dist_2`). É um achado de replicação e merece uma frase no artigo.
3. **Kangas e Bourke3:** os valores usados conferem com o Bagalà. **Continua em aberto a janela de integração da velocidade do Bourke3**, que só o PDF do Bourke 2010 resolve. Esse é o ponto que mais pesa no nosso resultado.
4. **SisFall:**
   - o artigo tem 4510 tentativas e o espelho tem 4396;
   - os idosos não fizeram as ADLs mais difíceis (D06, D13, D18, D19);
   - as quedas foram sobre colchão.

   Tudo isso entra em Limitações.

## 3. Decisão principal: o escopo do artigo

A pergunta do pipeline é "funciona **no celular**?". Há dois caminhos.

| | **Escopo A: replicação offline** | **Escopo B: replicação + celular** |
|---|---|---|
| Pergunta | Os algoritmos publicados mantêm o desempenho numa base pública independente, com o sinal degradado para a qualidade de um celular? | A mesma, mais o teste com o app num celular real |
| Dados | SisFall (pronto) + **UMAFall** (opcional: tem celular no bolso e sensor na cintura gravados juntos; acesso público no figshare) | SisFall + coleta com voluntários (Etapa 9) |
| Ética (CEP) | **Não precisa**: só dados públicos | Provavelmente precisa. **A aprovação no CEP costuma levar semanas ou meses** |
| Prazo | 1–2 semanas | Depende do CEP |
| Força | Média-alta: replicação + equivalência de código + análise por estágio | Alta: responde exatamente à pergunta do pipeline |

**Recomendação:** fechar o **Escopo A** agora, com UMAFall se der tempo, porque a UMAFall responde "celular no bolso" sem envolver pessoas. A coleta com voluntários fica como trabalho futuro, ou como 2ª versão se o CEP sair a tempo. O app de coleta já existe e entra no artigo como contribuição de método e ferramenta.

Testes que **não envolvem pessoas** e podem entrar mesmo no Escopo A:
- taxa de amostragem real do celular;
- celular parado na mesa;
- celular deixado cair no chão e jogado no sofá.

Os dois últimos são o falso positivo mais provável no mundo real. Confirmar com o orientador.

## 4. Tarefas, por seção do artigo

### Métodos
| Tarefa | Quem | Situação |
|---|---|---|
| Baixar **Kangas 2008** e **Bourke 2010** (CAPES) e conferir limiares e janela de velocidade | equipe | falta |
| Baixar a **Tabela S1 do Bagalà** (DOCX) e confirmar qual sinal é o Kangas 2a | equipe | falta |
| Atualizar o código se algum parâmetro divergir e rodar tudo de novo | agente | depende do item acima |
| Redigir a descrição dos algoritmos com as adaptações marcadas ⚠️ | agente (rascunho) + equipe | `docs/ALGORITMOS.md` já tem o conteúdo |
| Descrever a simulação do celular e a pontuação por arquivo | agente | conteúdo pronto |

### Resultados
| Tarefa | Quem | Situação |
|---|---|---|
| Tabela principal (publicado × Bagalà × SisFall) | agente | pronta no RESUMO; falta formatar |
| **Teste estatístico entre algoritmos** (McNemar pareado: os mesmos arquivos para todos) | agente | falta; pequeno |
| Figuras: funil por estágio, FP por atividade, exemplo de sinal (queda × "celular caiu") | agente | falta |
| (Opcional) Avaliação na UMAFall: celular no bolso × cintura | agente + equipe (download) | falta |
| (Escopo B) Resultados do celular | equipe + agente | depende do CEP |

### Discussão e limitações
| Ponto | Base |
|---|---|
| A postura é o estágio que elimina os FPs (Kangas 792 → 38) | nosso funil |
| A velocidade do Bourke3 derruba a SE em quedas simuladas | nosso funil + Bagalà (mesmo fenômeno no Kangas3) |
| O PIPTO falha nas mesmas atividades na KFall e na SisFall | PIPTO Tabela 6 × nosso RESUMO |
| O detector antigo do Mova: SP 82% e ≈ 46 alarmes/h em ADL roteirizada | nosso replay |
| Limitações: quedas simuladas por jovens sobre colchão; SisFall incompleta (4396/4510); idosos sem ADLs difíceis; sensor na cintura ≠ bolso; parâmetros ⚠️; app só em primeiro plano | artigos + implementação |

### Introdução e trabalhos relacionados
| Tarefa | Situação |
|---|---|
| Contexto (quedas em idosos, "long-lie", falsos alarmes) | o Bagalà e a SisFall têm boas referências |
| Trabalhos relacionados: Luque 2014, Aziz 2017 e outros do Apêndice A do pipeline | **conferir antes de citar** |

## 5. O que preciso da equipe para começar

1. **Escopo:** A ou B?
2. **Destino do artigo**, modelo e limite de páginas, **prazo**.
3. **PDFs:** Kangas 2008, Bourke 2010 e Tabela S1 do Bagalà.
4. (Se for incluir a UMAFall) **baixar o zip** do figshare (`UMA_ADL_FALL_Dataset.zip`), que está bloqueado no meu ambiente.
