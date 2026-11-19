# Práticas

Arquivo `praticas.csv`: uma linha por prática ensinada nos vídeos estudados (8499 linhas). Colunas:

- `tipo`: um dos 19 tipos de `TIPOS_PRATICA` (ver REGRAS_DE_CLASSIFICACAO.md, seção 4). Mantra é o tipo `mantra e decreto`; as demais são exercícios.
- `titulo`, `instrucao`: texto da prática como a IA anotou da fala do vídeo.
- `jeito`, `serve`, `quando`, `conselho`: etiquetas da IA (seção 5 das regras). `conselho = 1` marca o que não é prática para fazer em casa.
- `inicio_seg`, `inicio_hms`, `link_com_tempo`: onde a prática começa no vídeo. O fim não existe no banco.
- `video_yt`, `video_titulo`, `canal`: de onde vem.

As transcrições não vão neste pacote.
