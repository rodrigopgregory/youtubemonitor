# Monitor de canais do YouTube — Escopo Técnico Funcional

| Campo | Valor |
|---|---|
| Projeto | Monitor de canais do YouTube |
| Versão | 3.0 |
| Data | 16/11/2026 |
| Elaborado por | Agent (Mitra), em entrevista com sledt1006p01@imersao.mitralab.io |
| Status | Em uso, atualizado com o que o app faz hoje |

## 2. Objetivo

Criar uma base de conhecimento interna a partir de um conjunto fechado de canais públicos do YouTube sobre espiritualidade, escolhidos pela pessoa (hoje: Wagner Borges e Mônica de Medeiros). O sistema estuda cada vídeo desses canais: guarda os dados do vídeo, a transcrição do que foi falado, um resumo e os temas tratados.

O sistema monitora os canais todos os dias e estuda os vídeos novos que ainda não foram estudados. Quando um canal entra na lista, o sistema estuda também todo o histórico dele, do vídeo mais antigo ao mais recente.

Com a base pronta, a pessoa pesquisa por um tema (por exemplo, técnica de meditação, chakra coronário, saída do corpo, banhos de ervas). O sistema responde quais vídeos e lives tratam do tema, com o link para assistir ao vídeo completo, e um resumo do que foi falado, usando somente as transcrições desses canais. A base também alimenta o Livro Vivo, um livro escrito pela IA com um capítulo por tema, e o mapa de Práticas, onde a pessoa registra as práticas que fez e como se sentiu.

## 3. Atores e personas

| Persona | Responsabilidade | Interação com o sistema |
|---|---|---|
| Dona da base (usuária única, por enquanto) | Escolhe os canais, usa a base para estudar e, no futuro, para compilar um livro. | Cadastra canais pela tela do produto, acompanha os vídeos estudados e faz as buscas por tema na tela do produto. |
| Rotina automática do sistema | Manter a base atualizada sem ação da pessoa. | Faz a carga histórica de cada canal novo e a checagem diária; transcreve, resume e marca os temas de cada vídeo. |

## 4. Pré-condições

| ID | Descrição | Tipo |
|---|---|---|
| PC-01 | Lista de canais públicos do YouTube a monitorar, informada pela pessoa pelo link do canal. Canais até agora: Wagner Borges (https://www.youtube.com/@WagnerBorges/videos) e Mônica de Medeiros. | Obrigatória |
| PC-02 | Os canais, vídeos e lives precisam ser públicos, com título, data de publicação, duração e link acessíveis. | Obrigatória |
| PC-03 | Uma forma de transcrever o áudio dos vídeos que não têm transcrição no YouTube. | Obrigatória |
| PC-04 | A transcrição pronta do YouTube, quando existir, para acelerar o estudo. | Desejável |

## 5. Glossário

| Termo | Definição |
|---|---|
| Canal monitorado | Canal público do YouTube cadastrado pela pessoa para entrar na base. |
| Vídeo elegível | Vídeo ou live gravada de um canal monitorado com mais de 10 minutos. |
| Live | Transmissão ao vivo que ficou gravada no canal; entra na base como um vídeo. |
| Vídeo estudado | Vídeo elegível com título, link, data, duração, tipo, transcrição, resumo e temas guardados na base. |
| Carga histórica | O estudo de todos os vídeos já publicados de um canal, feito quando ele é cadastrado. |
| Checagem diária | A conferência feita uma vez por dia em cada canal monitorado, em busca de vídeos ainda não estudados. |
| Transcrição | O texto de tudo o que foi falado no vídeo, do YouTube ou feito a partir do áudio. |
| Resumo do vídeo | Texto curto com o que foi falado no vídeo, feito a partir da transcrição. |
| Tema | Palavra-chave de um assunto tratado nos vídeos (ex.: mantras, chakra coronário). |
| Base de conhecimento | O conjunto de todos os vídeos estudados, com transcrições, resumos e temas. |
| Busca por tema | A pesquisa da pessoa por um tema, feita na tela do produto. |
| Base fechada | Regra de que as respostas usam somente o conteúdo dos canais monitorados. |

## 6. Regras de negócio

**RN-01 — Carga histórica do canal.** Quando a pessoa cadastra um canal novo, o sistema levanta todos os vídeos e lives já publicados nele e os estuda em ordem de data de publicação, do mais antigo até o mais recente. Exemplo: um canal com 600 vídeos publicados tem os 600 avaliados.

**RN-02 — Filtro de duração.** Entram na base os vídeos e as lives gravadas com mais de 10 minutos. Exemplo: um vídeo de 8:30 fica fora; uma live de 1:45:00 entra; um vídeo de 12:10 entra.

**RN-03 — Checagem diária.** Uma vez por dia, o sistema confere cada canal cadastrado e estuda os vídeos e lives que passam no filtro da RN-02 e ainda não foram estudados.

**RN-04 — Vídeo estudado.** Um vídeo está estudado quando a base guarda o título, o link, a data de publicação, a duração, o tipo (vídeo ou live), a transcrição com a marcação de tempo, o resumo e os temas dele. Um vídeo estudado não é estudado de novo.

**RN-05 — Transcrição.** Todo vídeo estudado tem a transcrição do que foi falado, com a marcação do minuto de cada trecho. Quando o YouTube não oferece transcrição do vídeo, o sistema transcreve a partir do áudio. Nenhum vídeo elegível fica fora da base por falta de legenda.

**RN-06 — Resumo do vídeo.** Para cada vídeo estudado, o sistema gera um resumo do que foi falado, a partir da transcrição.

**RN-07 — Temas sugeridos e editáveis.** A partir da transcrição, o sistema sugere os temas (palavras-chave) de cada vídeo e agrupa os vídeos por tema. A pessoa pode editar os temas de um vídeo: acrescentar, tirar ou renomear. O tema que a pessoa editou vale sobre a sugestão e não é desfeito pelo sistema. Exemplos de temas: saída do corpo, iniciação, práticas, mantras, técnica de meditação, chakra coronário, pretos velhos, limpeza, banhos de ervas, ensinamentos.

**RN-08 — Busca por tema.** Na tela do produto, a pessoa pesquisa um tema e o sistema devolve a lista de vídeos e lives que tratam dele, cada um com o link para assistir completo e os minutos em que o tema aparece, e um resumo do que foi falado sobre o tema nesses vídeos. Exemplo: a busca "chakra coronário" traz um vídeo com o tema nos minutos 12:40 e 37:15, e o link abre o vídeo já em 12:40.

**RN-09 — Ordem dos resultados.** Na busca, a pessoa escolhe a ordem dos vídeos: por relevância (os que mais tratam do tema primeiro) ou por mais recentes (data de publicação, do mais novo ao mais antigo). A ordem padrão é por relevância.

**RN-10 — Base fechada.** As respostas da busca usam somente as transcrições dos canais cadastrados. Nada de fonte de fora da base.

**RN-11 — Usuária única, sem login.** Só a pessoa dona da base usa o produto. O app abre sem login e pode ser instalado no celular e no computador (botão Instalar app).

**RN-12 — Avisos.** A cada vídeo novo captado na checagem diária, o sininho do topo acende com o número de avisos não lidos. A pessoa marca como lido ou não lido e arquiva. Não há aviso por e-mail nem pelo Telegram.

**RN-13 — Canais separados.** Vídeos, busca e pesquisa podem ser filtrados por canal. As playlists de cada canal são lidas uma vez por dia e servem de filtro. O botão Buscar vídeos novos procura vídeos na hora, sem esperar a checagem diária.

**RN-14 — Ordem de estudo.** O estudo alterna os canais. Primeiro vêm os vídeos com legenda do YouTube, depois os sem legenda, que são transcritos pelo áudio e ganham a etiqueta Transcrito pelo áudio.

**RN-15 — Temas fixos.** Os temas são 32 categorias fixas, e o estudo escolhe só entre elas. Vídeos que não tratam de espiritualidade vão para a área Fora do tema espiritualidade, com botão para mover e trazer de volta.

**RN-16 — Mentores.** Nas lives com incorporação (canal da Mônica), o sistema marca o mentor que conduz a live. O nome no título manda. Sem nome no título, a IA confere na transcrição. A aba Mentores cadastra, renomeia, junta e marca quem não é mentor, e o estudo segue essas regras.

**RN-17 — Pesquisar.** Busca e chat ficam numa aba só, Pesquisar. A resposta usa só a base, entende sinônimos, aceita ditado por voz e continua funcionando sem a IA quando a cota acaba (aí prioriza o termo mais raro).

**RN-18 — Vídeos e filtros.** A tela de vídeos tem filtros combinados (temas, mentores, playlists, práticas, canal e "Meus": Favoritos, Já assisti, Não assisti). Cada vídeo tem estrela de favorito e olho de já assisti. O botão Exportar planilha leva os filtros da tela.

**RN-19 — Práticas.** O sistema lê nas transcrições as práticas ensinadas (técnicas, preces, ervas e velas, receitas e saúde, autoconhecimento). A tela Práticas mostra o mapa por finalidade, o jeito de fazer e o passo a passo, e a IA marca a finalidade de cada prática.

**RN-20 — Minhas práticas.** Em cada prática, o botão Fiz hoje conta num toque e mostra o contador e a data da última vez. Desfazer apaga o último registro. O lápis abre o registro para anotar o humor (1 a 5), o que sentiu e o dia. A tela Minhas práticas mostra os números, o Diário e a visão Por prática, com editar e apagar em cada registro.

**RN-21 — Livro Vivo.** A aba Livro Vivo tem um capítulo por tema, escrito pela IA a partir dos ensinamentos e práticas. A IA escreve sozinha até 2 capítulos por madrugada, entre 1h e 7h, quando há cota. Os capítulos entram no Exportar tudo.

**RN-22 — Exportar.** Em Configurações ficam o Exportar tudo (ZIP com código, esquema do banco e todos os dados) e o Exportar para o NotebookLM (transcrições juntas em arquivos por canal, abaixo do limite de uma fonte). Também há exportação de temas em planilha e de transcrições por canal.

**RN-23 — Cota da IA.** O estudo usa a cota grátis do Gemini, com várias chaves que se revezam. Quando a cota diária acaba, os vídeos ficam na fila e o estudo continua no dia seguinte. A tela avisa quando a IA está em pausa.

**RN-24 — Aparência.** Modo escuro como padrão, com a escolha guardada. No celular e no tablet, o menu vira uma gaveta lateral.

## 7. Fluxo principal (caminho feliz)

| Passo | Descrição |
|---|---|
| 1 | Na tela do produto, a pessoa cadastra o link de um canal público do YouTube. |
| 2 | O sistema levanta todos os vídeos e lives publicados no canal, em ordem de data de publicação. |
| 3 | O sistema separa os vídeos e lives com mais de 10 minutos. |
| 4 | Para cada vídeo, o sistema guarda o título, o link, a data de publicação, a duração e o tipo (vídeo ou live). |
| 5 | O sistema obtém a transcrição com a marcação de tempo; sem transcrição no YouTube, transcreve a partir do áudio. |
| 6 | O sistema gera o resumo do vídeo a partir da transcrição. |
| 7 | O sistema sugere os temas do vídeo e o agrupa com os outros vídeos dos mesmos temas. |
| 8 | O vídeo fica marcado como estudado na base de conhecimento. |
| 9 | Se quiser, a pessoa edita os temas de um vídeo. |
| 10 | Todo dia, o sistema confere os canais cadastrados e estuda os vídeos novos (passos 3 a 8). |
| 11 | Na tela do produto, a pessoa pesquisa um tema, por exemplo "banhos de ervas", e escolhe a ordem: relevância ou mais recentes. |
| 12 | O sistema mostra os vídeos que tratam do tema, com o link e os minutos em que o tema aparece, e um resumo do que foi falado sobre ele. |
| 13 | A pessoa abre o vídeo pelo link, já no minuto do tema, ou desde o começo. |

## 8. Fluxos alternativos e exceções

| ID | Cenário | Comportamento esperado |
|---|---|---|
| FA-01 | Vídeo ou live com 10 minutos ou menos | O vídeo não entra na base e não é transcrito. |
| FA-02 | Vídeo sem transcrição no YouTube | O sistema transcreve a partir do áudio e segue o estudo normalmente. |
| FA-03 | Falha ao transcrever ou resumir um vídeo | O vídeo fica marcado como pendente, com o motivo, e o sistema tenta de novo na próxima checagem diária. |
| FA-04 | Link de canal inválido ou canal inexistente | O cadastro é recusado com uma mensagem clara para a pessoa. |
| FA-05 | Canal já cadastrado | O sistema avisa que o canal já está na lista e não duplica os vídeos. |
| FA-06 | Live ainda em andamento na checagem | A live só é estudada depois de terminar e ficar gravada no canal. |
| FA-07 | Vídeo estudado que foi removido ou ficou privado no YouTube | O vídeo continua na base com a transcrição e o resumo, marcado como indisponível no YouTube. |
| FA-08 | Busca por um tema sem vídeo correspondente | O sistema informa que nenhum vídeo da base trata do tema e não inventa resposta. |
| FA-09 | Dia sem vídeo novo | A checagem diária termina sem mudanças na base. |

## 9. Critérios de aceite

| ID | Critério |
|---|---|
| CA-01 | A pessoa cadastra um canal pelo link na tela do produto e ele aparece na lista de canais monitorados. |
| CA-02 | Após o cadastro do canal Wagner Borges, todos os vídeos e lives dele com mais de 10 minutos entram na base, do mais antigo ao mais recente. |
| CA-03 | Um vídeo de 8:30 do canal não aparece na base. |
| CA-04 | Uma live gravada de mais de 10 minutos aparece na base, marcada como live. |
| CA-05 | Cada vídeo estudado mostra título, link, data de publicação, duração, transcrição, resumo e temas. |
| CA-06 | Um vídeo sem transcrição no YouTube aparece na base com a transcrição feita a partir do áudio. |
| CA-07 | Um vídeo publicado hoje no canal aparece estudado na base até a checagem diária seguinte. |
| CA-08 | Nenhum vídeo aparece duas vezes na base, mesmo depois de várias checagens diárias. |
| CA-09 | A busca "chakra coronário" na tela do produto devolve a lista de vídeos que tratam do tema, com o link de cada um. |
| CA-10 | A busca traz um resumo do que foi falado sobre o tema, com base só nos vídeos da base. |
| CA-11 | Cada vídeo na busca mostra os minutos em que o tema aparece, e clicar num minuto abre o vídeo no YouTube já nesse ponto. |
| CA-12 | Uma busca por um tema que nenhum vídeo trata informa que não há resultado, sem inventar resposta. |
| CA-13 | Os vídeos aparecem agrupados pelos temas sugeridos pelo sistema. |
| CA-14 | Um vídeo que falhou na transcrição aparece como pendente, com o motivo, e é tentado de novo no dia seguinte. |
| CA-15 | Cadastrar o mesmo canal duas vezes mostra um aviso e não duplica nada. |
| CA-16 | A pessoa acrescenta, tira e renomeia um tema de um vídeo, e o vídeo passa a aparecer nas buscas pelo tema novo. |
| CA-17 | Um tema editado pela pessoa continua igual depois das checagens diárias seguintes. |
| CA-18 | A busca abre ordenada por relevância e, ao trocar para mais recentes, os vídeos aparecem do mais novo ao mais antigo. |
| CA-19 | Depois de uma checagem diária que estudou 3 vídeos novos, a tela do produto mostra o aviso "3 vídeos novos" com a lista deles, marcado como não lido. |
| CA-20 | Ao abrir o aviso, ele passa a lido; num dia sem vídeo novo, nenhum aviso novo aparece. |

## 10. Telas do app

| Tela | Para que serve |
|---|---|
| Pesquisar | Pergunta por tema, com resposta só da base e os vídeos com os minutos. |
| Vídeos e temas | Lista dos vídeos estudados com filtros, favoritos, já assisti e exportar planilha. |
| Práticas | Mapa das práticas por finalidade, com passo a passo e o botão Fiz hoje. |
| Minhas práticas | Diário das práticas feitas, com humor e anotações. |
| Canais | Cadastro dos canais e andamento do estudo. |
| Mentores | Cadastro e ajuste dos mentores. |
| Livro Vivo | Capítulos do livro, um por tema. |
| Configurações | Mentores, estudo e exportações. |

## 11. Andamento (16/11/2026)

- Leitura de práticas: 1.237 de 3.703 vídeos.
- Finalidade das práticas marcada pela IA: cerca de 115 de 1.640.
- Livro Vivo: 7 de 32 capítulos.

## 12. Pontos em aberto

Nenhum ponto em aberto.

