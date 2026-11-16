import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const raiz = path.resolve(import.meta.dirname, '..');
const git = (...a) => execFileSync('git', a, { cwd: raiz, maxBuffer: 1 << 28 });
const lerTxt = rel => fs.readFileSync(path.join(raiz, rel), 'utf8');
const arquivos = [];
const addTxt = (n, d) => arquivos.push({ n, t: 't', d });
const addBin = (n, buf) => arquivos.push({ n, t: 'b', d: buf.toString('base64') });

const commit = git('rev-parse', 'HEAD').toString().trim();
const sujo = git('status', '--porcelain').toString().trim();
if (sujo) throw new Error('há alterações sem commit; faça o commit antes de gerar a base');

const tracked = git('ls-files', '-z').toString().split('\0').filter(Boolean);
for (const rel of tracked) {
  const buf = fs.readFileSync(path.join(raiz, rel));
  if (/\.(png|ico|jpg|jpeg|gif|webp)$/i.test(rel)) addBin('codigo/' + rel, buf); else addTxt('codigo/' + rel, buf.toString('utf8'));
}
const tmpBundle = '/tmp/p67241-leve.bundle';
git('bundle', 'create', tmpBundle, 'HEAD');
addBin('historico/repo.bundle', fs.readFileSync(tmpBundle));
fs.unlinkSync(tmpBundle);
addTxt('historico/commits.txt', git('log', '--date=iso', '--pretty=format:%H | %ad | %an | %s').toString() + '\n');
addTxt('ESCOPO.md', lerTxt('ESCOPO.md'));
addTxt('README_DO_APP.md', fs.existsSync(path.join(raiz, 'README.md')) ? lerTxt('README.md') : lerTxt('frontend/README.md'));

const motor = lerTxt('backend/sf/motor.js');
const livroGerar = lerTxt('backend/sf/livroGerar.js');
const exportarGerar = lerTxt('backend/sf/exportarGerar.js');
const etiquetas = lerTxt('frontend/src/lib/etiquetas.ts');
const funcoesTela = lerTxt('backend/funcoes-tela.mjs');
const criarFuncoes = lerTxt('backend/criar-funcoes.mjs');

const funcao = (src, nome) => {
  const i = src.search(new RegExp('\\n(async )?function ' + nome + '\\('));
  if (i < 0) return '(NÃO ENCONTRADA no código: ' + nome + ')';
  const j = src.indexOf('\n}\n', i + 1);
  return src.slice(i + 1, j + 2).trim();
};
const constante = (src, nome) => { const m = src.match(new RegExp('^const ' + nome + ' = .*$', 'm')); return m ? m[0] : '(NÃO ENCONTRADA: ' + nome + ')'; };
const linhasDe = (src, nomes) => src.split('\n').filter(l => nomes.some(n => l.startsWith("  S('" + n + "'"))).join('\n');
const bloco = (txt, lang) => '```' + (lang || '') + '\n' + txt + '\n```';
const numeradas = (src, re) => src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => re.test(l)).map(([i, l]) => i + ': ' + l).join('\n');

const R = [];
R.push('# Regras de classificação do Monitor de Canais do YouTube', '',
  'Escrito a partir do código publicado (commit ' + commit.slice(0, 7) + '), não de memória. Os trechos de código abaixo são cópias literais dos arquivos em `codigo/`. Onde não há evidência está escrito **NÃO SEI**.', '',
  '## 0. Visão geral', '',
  '- Quem classifica é o `motor` (`codigo/backend/sf/motor.js`), uma Server Function agendada de hora em hora (cron `0 5 * * * *`, ver DEPENDENCIAS_MITRA.md) que também se reencadeia com `modo: continuar`.',
  '- Toda chamada ao Gemini passa pela função `gemini()` (seção 1). O modelo, a lista de conexões e a lista de modelos vêm da tabela `CONFIG`.',
  '- O motor processa, em ordem, por execução: carga e checagem de canais, estudo de vídeos (transcrição, resumo, temas, mentores, práticas), conferência de mentores, etiquetas das práticas (jeito, serve, quando, conselho), leitura de práticas pendentes, leitura de livros indicados e, de madrugada, o Livro Vivo.',
  '- Os vídeos só entram na classificação com `DURACAO_SEG` maior que `CONFIG.DURACAO_MIN_SEG` (padrão 600). Os demais viram `FORA_DO_FILTRO`.', '',
  '## 1. Chamada ao Gemini (rodízio de conexões e modelos)', '',
  '- Conexões: lista em `CONFIG.GEMINI_CONEXOES` (separada por vírgula). Modelos: `CONFIG.MODELO_ANALISE` para análise e `CONFIG.MODELO_TRANSCRICAO` para transcrição, também em lista separada por vírgula.',
  '- Endpoint: `POST /v1beta/models/<modelo>:generateContent` pela integração do Mitra (`callIntegrationMitra`). Para cada conexão, tenta cada modelo na ordem; o primeiro que devolve texto vale.',
  '- Erro 429: se a mensagem não for "por dia" e pedir espera de até 40 s, espera uma vez e repete. Se for "por dia" (`PerDay`), marca aquela combinação conexão+modelo como esgotada até o fim da execução. Se algo esgotou e nada respondeu, o motor marca `IA_SEM_COTA` e grava `CONFIG.IA_PAUSADA_ATE` para as 08:00 UTC seguintes.',
  '- O JSON de resposta é lido por `jsonDe()`, que tenta `JSON.parse`, depois remove vírgulas sobrando e junta objetos colados, e por fim recorta o primeiro objeto balanceado.', '',
  bloco(funcao(motor, 'gemini'), 'js'), '', bloco(funcao(motor, 'jsonDe'), 'js'), '');

R.push('## 2. Transcrição (tabela TRECHOS)', '',
  '- Tabela e colunas: `TRECHOS(VIDEO_ID, SEGUNDO, TEXTO)`, com índices `UQ_TR`, `IX_TR_VIDEO` e FULLTEXT `FT_TR` em `TEXTO`.',
  '- Função: `transcreverAudio` no `motor`. Gatilho: vídeo na fila (`STATUS = FILA`) sem legenda utilizável e `CONFIG.AUDIO_LIGADO` diferente de 0. Trabalha em blocos de `CONFIG.BLOCO_SEG` segundos (padrão 900 no código, 300 na configuração atual) e para ao passar de `CONFIG.ORCAMENTO_SEG` (padrão 230 s) por execução, retomando de `VIDEOS.PROGRESSO_SEG`.',
  '- Modelo: `CONFIG.MODELO_TRANSCRICAO`. Temperatura 0. Formato: JSON (`responseMimeType: application/json`). O vídeo é passado ao Gemini pela URL do YouTube (`fileData.fileUri`) com `videoMetadata.startOffset/endOffset`.',
  '- Prompt, completo (a parte de texto; o vídeo vai como a parte anterior):', '',
  bloco('Transcreva em portugues tudo o que e falado neste trecho do video. Responda so JSON: {"trechos":[{"s":<segundo do inicio no video inteiro>,"t":"texto"}]} com um item a cada 20 a 40 segundos. Nao resuma, nao invente.'), '',
  '- Validação: se o JSON vier quebrado (`SyntaxError`) e o bloco tiver 120 s ou mais, o bloco é dividido em 3 partes e repetido. Detalhes no código abaixo.', '',
  bloco(funcao(motor, 'transcreverAudio'), 'js'), '');

R.push('## 3. Resumo, temas e mentores (função analisar)', '',
  '- Destino: `VIDEOS.RESUMO` (texto), `TEMAS(ID, NOME)` e `VIDEO_TEMAS(VIDEO_ID, TEMA_ID, ORIGEM, MOMENTOS, VERIFICADO)`. Mentores são temas cujo nome começa com `mentor: `.',
  '- Função: `analisar` (`motor.js`). Gatilho: dentro de `estudar()`, depois da transcrição, para cada vídeo da fila. A mesma chamada devolve resumo, temas, mentores e práticas.',
  '- Modelo: `CONFIG.MODELO_ANALISE`. Temperatura 0,2; se o JSON vier inválido (`SyntaxError`), repete com temperatura 0. Formato: JSON.',
  '- Montagem do prompt, na ordem: (1) abertura com o título do vídeo; (2) formato JSON esperado; (3) `PROMPT_PRATICAS` (seção 4); (4) se o canal tem `TEM_MENTOR`, o parágrafo sobre mentores; (5) lista de categorias de tema permitidas (os `TEMAS` já existentes sem o prefixo `mentor: `, até 300, separados por `; `); (6) regra dos momentos; (7) a transcrição `[mm:ss] texto`, cortada em 600.000 caracteres. O código abaixo é o texto exato.',
  '- Validação dos temas: o nome da IA é normalizado (sem acento, minúsculas, só letras e números) e trocado pelo nome oficial existente em `TEMAS`; nomes fora da lista são descartados; repetidos são removidos; no máximo 10 temas; no máximo 6 momentos por tema, e só os que estão entre 0 e `DURACAO_SEG`.',
  '- Validação dos mentores: no máximo 3 por vídeo; o nome precisa aparecer escrito no título ou na transcrição (forma normalizada); passa por apelidos (`ALIAS` no código mais `MENTOR_REGRAS` tipo APELIDO), por uma lista de nomes que nunca são mentor (`NAO_MENTOR` no código mais `MENTOR_REGRAS` tipo NAO) e, se o nome não está no título, por uma segunda pergunta ao Gemini (`mentorConduz`, abaixo). Se o título do vídeo traz um mentor conhecido, só os mentores do título ficam.',
  '- Valores permitidos: temas = linhas de `TEMAS` (vêm do próprio banco, função `temasNomes`); mentores = `mentor: <nome>`, com nomes de `MENTOR_REGRAS` (tipo MENTOR e destinos de APELIDO), do `ALIAS` do código e dos que já existem em `TEMAS`.', '',
  bloco(funcao(motor, 'analisar'), 'js'), '',
  '### 3.1 Conferência do mentor (função mentorConduz e conferirMentor)', '',
  'Gatilho: `CONFIG.CONFERIR_MENTOR` diferente de 0 e existir `VIDEO_TEMAS` de mentor com `ORIGEM = IA` e `VERIFICADO` nulo (`mentorConferirFila`). Temperatura 0, formato JSON, `MODELO_ANALISE`. Se não conduz, o vínculo vai para `VIDEO_TEMAS_BKP_MENTORES` e é apagado.', '',
  bloco(constante(motor, 'NAO_MENTOR'), 'js'), '', bloco(funcao(motor, 'regrasMentor'), 'js'), '', bloco(funcao(motor, 'mentorConduz'), 'js'), '', bloco(funcao(motor, 'conferirMentor'), 'js'), '');

R.push('## 4. Práticas: mantra, exercício e demais tipos', '',
  '- Tabela: `PRATICAS(ID, VIDEO_ID, TIPO, TITULO, INSTRUCAO, SEGUNDO, CRIADO_EM, FINALIDADES, FINALIDADE_EM, JEITO, SERVE, QUANDO, CONSELHO, REVISADA_EM)`. `FINALIDADES` e `FINALIDADE_EM` são de uma versão antiga; hoje valem `JEITO`, `SERVE`, `QUANDO`, `CONSELHO`.',
  '- **Mantra** e **exercício** não são tabelas separadas: mantra é `TIPO = \'mantra e decreto\'`; todo o resto é exercício (regra aplicada nas telas e na exportação pesada, linha `const mantra = p.tipo === \'mantra e decreto\'` em `exportarGerar.js`).',
  '- Funções: `analisar` (junto com o resumo, ao estudar um vídeo novo) e `lerPraticas` (vídeos já estudados sem leitura de práticas, `VIDEOS.PRATICAS_EM` nulo, fila `praticasFila`; liga/desliga em `CONFIG.PRATICAS_LIGADO`). Gravação por `gravarPraticas` (apaga as do vídeo e regrava).',
  '- Modelo `CONFIG.MODELO_ANALISE`. Temperatura: 0,2 em `analisar` (0 no segundo tentativa) e 0,2 em `lerPraticas`. Formato JSON.',
  '- Validação (`limparPraticas`): no máximo 15 por vídeo; `tipo` normalizado contra `TIPOS_PRATICA`, e o que não casa vira `outra prática`; `titulo` até 290 caracteres; `instrucao` até 3900; `momento` em mm:ss vira segundos e só vale entre 0 e a duração (senão 0).',
  '- Erros: `VIDEOS.PRATICAS_ERROS` e `PRATICAS_ERRO` contam e guardam o último erro; o vídeo vai para o fim da fila.', '',
  '### 4.1 Valores permitidos de TIPO e onde ficam', '', bloco(constante(motor, 'TIPOS_PRATICA'), 'js'), '',
  'Ficam no código (`motor.js`); não há tabela de tipos. A tela lê os tipos presentes por `praticasTipos`.', '',
  '### 4.2 Prompt exato (PROMPT_PRATICAS)', '', 'É usado dentro do prompt de `analisar` (seção 3) e de `lerPraticas`, que monta assim: abertura com o título do vídeo, o formato JSON `{"praticas":[...]}`, `PROMPT_PRATICAS`, a frase `Use so a transcricao.` e a transcrição.', '',
  bloco(constante(motor, 'PROMPT_PRATICAS'), 'js'), '', bloco(funcao(motor, 'limparPraticas'), 'js'), '', bloco(funcao(motor, 'gravarPraticas'), 'js'), '', bloco(funcao(motor, 'lerPraticas'), 'js'), '');

R.push('## 5. Etiquetas das práticas: jeito, serve, quando e conselho', '',
  '- Destino: `PRATICAS.JEITO` (1 código), `SERVE` (1 a 3 códigos separados por vírgula), `QUANDO` (0 a 2) e `CONSELHO` (0 ou 1); `REVISADA_EM` e `FINALIDADE_EM` recebem a data.',
  '- Função `marcarFinalidades`. Gatilho: no `motor`, quando `CONFIG.GEMINI_OK`, `PRATICAS_LIGADO` e `FINALIDADE_LIGADO` não são 0 e há práticas com `REVISADA_EM` nulo (`finFila`: 40 por vez, instrução cortada em 400 caracteres). Grava por `finGravar`.',
  '- Modelo `CONFIG.MODELO_ANALISE`, temperatura 0,1, formato JSON. Prompt: abertura, as 4 definições (jeito, serve, quando, conselho), o formato JSON e a lista `#id [tipo] titulo: instrucao` (uma por linha).',
  '- Validação: cada código precisa estar nas listas abaixo (`ok()` pega a palavra antes do primeiro espaço); jeito vazio vira `outra`; `serve` até 3, `quando` até 2; `conselho` só vale 1 se vier exatamente 1.',
  '- Onde ficam os valores permitidos: nas constantes do `motor.js` (abaixo) e, espelhadas para os filtros das telas, em `frontend/src/lib/etiquetas.ts` (seção 9). As duas listas precisam ser mantidas iguais à mão; não há checagem automática. **NÃO SEI** se já divergiram.', '',
  bloco(constante(motor, 'JEITOS_ET'), 'js'), '', bloco(constante(motor, 'SERVE_ET'), 'js'), '', bloco(constante(motor, 'QUANDO_ET'), 'js'), '', bloco(funcao(motor, 'marcarFinalidades'), 'js'), '');

R.push('## 6. Livros indicados', '',
  '- Tabela `LIVROS_INDICADOS(ID, VIDEO_ID, TITULO, AUTOR, TRECHO, SEGUNDO, CRIADO_EM)`; marcação em `VIDEOS.LIVROS_EM`, `LIVROS_ERROS`, `LIVROS_ERRO`.',
  '- Função `lerLivros`. Gatilho: `CONFIG.LIVROS_LIGADO` diferente de 0 e vídeos `ESTUDADO` com `LIVROS_EM` nulo (`livrosFila`). Modelo `MODELO_ANALISE`, temperatura 0,2, formato JSON.',
  '- Validação (`limparLivros`): até 30 livros por vídeo, título obrigatório (até 290), autor até 190, trecho até 3900, momento em segundos entre 0 e a duração, e sem repetir o par título+segundo. A tela agrupa por título; a regra de agrupamento está em `livrosRelacao` (`funcoes-tela.mjs`).', '',
  bloco(constante(motor, 'PROMPT_LIVROS'), 'js'), '', bloco(funcao(motor, 'limparLivros'), 'js'), '', bloco(funcao(motor, 'lerLivros'), 'js'), '');

R.push('## 7. Livro Vivo', '',
  '- Tabela `LIVRO_CAPITULOS(ID, TEMA_ID, TEMA, TEXTO, PRATICAS_JSON, VIDEOS, GERADO_EM)`, um capítulo por tema (chave única por `TEMA_ID`; `livroGravar` usa `ON DUPLICATE KEY UPDATE`).',
  '- Função `livroGerar`. Disparo: (a) pela tela, com `temaId`; (b) pelo `motor`, de madrugada (hora de Brasília entre 1 e 7), no máximo `CONFIG.LIVRO_POR_NOITE` por dia (padrão 2), espaçado de 25 min por `CONFIG.LIVRO_TENTOU_EM`, só se `LIVRO_LIGADO` não for 0, `LIVRO_PAUSA_ATE` e `IA_PAUSADA_ATE` não estiverem no futuro e não houver `IA_SEM_COTA`. O próximo tema é o de `livroProximo`: sem capítulo ainda, não-mentor, com 5 vídeos estudados ou mais, o de mais vídeos primeiro.',
  '- Material enviado: resumos dos vídeos do tema (`livroResumos`) e práticas do tema sem `CONSELHO` (`livroPraticas`), numeradas P1, P2, ...; cortado em 400.000 caracteres.',
  '- Modelo `MODELO_ANALISE` (lista, na ordem), temperatura 0,3, `maxOutputTokens` 30000, formato JSON. Validação: precisa vir `texto`; até 30 práticas; `grupo` precisa estar em `GRUPOS` (os nomes de `JEITOS` do arquivo), senão `Outras`; `fontes` viram vídeo, canal, yt e segundo das práticas P citadas (até 8, sem repetir vídeo); texto cortado em 60.000 caracteres.',
  '- Valores permitidos de `grupo`: o objeto `JEITOS` do arquivo abaixo (é uma cópia de nomes, separada de `etiquetas.ts`).', '',
  bloco(livroGerar, 'js'), '');

R.push('## 8. Busca e chat (não gravam categoria)', '',
  'Não escrevem em tabela de classificação. Prompts e temperaturas (linhas literais dos arquivos):', '',
  bloco(['// buscaTermos.js', numeradas(lerTxt('backend/sf/buscaTermos.js'), /prompt|temperature|text:/i), '', '// resumoBusca.js', numeradas(lerTxt('backend/sf/resumoBusca.js'), /prompt|temperature|text:/i), '', '// chatBusca.js', numeradas(lerTxt('backend/sf/chatBusca.js'), /prompt|temperature|text:|system/i)].join('\n'), 'js'), '');

const iniMin = exportarGerar.indexOf('  const fimDe =');
const fimMin = exportarGerar.indexOf('return { cn, fim, link };', iniMin);
R.push('## 9. Minutagem, fim_calculado e filtros das telas', '',
  '- **Início**: `PRATICAS.SEGUNDO`, `LIVROS_INDICADOS.SEGUNDO` e `TRECHOS.SEGUNDO` são o segundo de início no vídeo inteiro (a IA devolve `mm:ss`, o código converte e descarta o que passa da duração). `VIDEO_TEMAS.MOMENTOS` é uma lista de segundos separados por vírgula (até 6).',
  '- **Fim**: o banco **não guarda fim**. O `fim_calculado` só existe na exportação pesada (`exportarGerar.js`): é o início do próximo trecho da transcrição depois do início do item; se não houver próximo, é a duração do vídeo (ou o próprio início, se a duração for menor). Vem sempre marcado `fim_calculado = 1`. Nesta exportação leve ele não é calculado (a tabela TRECHOS não entra). Código:', '',
  bloco(iniMin >= 0 ? exportarGerar.slice(iniMin, fimMin + 26) : '(NÃO ENCONTRADO)', 'js'), '',
  '- **Link com tempo**: `https://youtu.be/<YT_VIDEO_ID>?t=<segundo>`.',
  '- **Filtros das telas**: vêm de três lugares. (1) Listas fixas de jeito, serve e quando em `frontend/src/lib/etiquetas.ts` (abaixo). (2) Tipos de prática, temas e canais lidos do banco por Server Functions (`praticasTipos`, `temasListar`, `canaisNomes`, `mentoresListar`). (3) Contagens por filtro em `praticasJeitos`, `praticasServe`, `praticasQuando`, `praticasTotais`. Os filtros salvos da pessoa **NÃO SEI** onde ficam: não achei tabela nem função de filtro salvo no código; os filtros ativos vivem no estado da tela.', '',
  bloco(etiquetas, 'ts'), '', bloco(linhasDe(funcoesTela, ['praticasTipos', 'praticasJeitos', 'praticasServe', 'praticasQuando', 'praticasTotais', 'temasListar', 'canaisNomes']), 'js'), '');

R.push('## 10. O que NÃO está no código nem nas tabelas', '',
  '- Configurações da conexão do Gemini feitas só no Mitra (chave, URL, cabeçalhos, qualquer limite ou política de segurança da conexão): **NÃO SEI**. O código nunca manda `safetySettings` nem `maxOutputTokens` (exceto o Livro Vivo), então valem os padrões do Gemini.',
  '- Qual modelo respondeu cada vez: **NÃO SEI**. Só se grava o texto; o modelo vem do rodízio da seção 1 e não é registrado.',
  '- Cotas, preços e limites das chaves Gemini: **NÃO SEI** (ficam na conta do Google).',
  '- Prompts de versões anteriores ao commit ' + commit.slice(0, 7) + ': estão só no histórico Git (`historico/repo.bundle`). Nenhum resultado guarda qual versão do prompt o gerou.',
  '- Tabela `TEMA_MAPA(ID, NOME, CATEGORIA, ...)`: existe e tem linhas, mas **NÃO SEI** o que a preenche nem quem a lê: não achei nenhuma referência a ela no código do app.',
  '- Tabela `MENTOR_REGRAS`: é editada pela tela de mentores (`mentorEditar`) e lida pelo motor; o conteúdo vai no ZIP porque é pequena.',
  '- Regras que valem só nas telas (textos, ordenação, cortes de tela) estão em `codigo/frontend/src`; não foram resumidas aqui.',
  '- Dados: transcrições (`TRECHOS`), vínculos e leituras completas não estão neste ZIP.', '');

addTxt('REGRAS_DE_CLASSIFICACAO.md', R.join('\n'));

const telas = {};
const sdkFront = {};
const andar = dir => { for (const nome of fs.readdirSync(dir)) { const cheio = path.join(dir, nome); if (fs.statSync(cheio).isDirectory()) andar(cheio); else if (/\.(ts|tsx)$/.test(nome)) {
  const rel = path.relative(raiz, cheio); const src = fs.readFileSync(cheio, 'utf8');
  for (const mm of src.matchAll(/(?:chamar|chamarDemorado|linhas)(?:<[^()]*>)?\(\s*'(\w+)'/g)) (telas[mm[1]] ||= new Set()).add(rel);
  for (const mm of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'mitra-interactions-sdk'/g)) (sdkFront[rel] ||= new Set()).add(mm[1].trim().replace(/\s+/g, ' '));
} } };
andar(path.join(raiz, 'frontend/src'));
const telasJson = Object.fromEntries(Object.entries(telas).map(([k, v]) => [k, [...v].sort()]));
const sdkJson = Object.fromEntries(Object.entries(sdkFront).map(([k, v]) => [k, [...v]]));

const repoFuncoes = {};
const iniSql = criarFuncoes.indexOf('export const sqls = [');
const fimSql = criarFuncoes.indexOf('\n];\n', iniSql);
const sqlsLista = new Function('S', 'return ' + criarFuncoes.slice(iniSql + 'export const sqls = '.length, fimSql + 3))((name, code, description) => ({ name, type: 'SQL', code, description }));
const telaFonte = funcoesTela.replace(/^export const tela = /m, 'const tela = ') + '\nreturn tela;';
const telaLista = new Function('S', telaFonte.replace(/^const S = .*$/m, ''))((name, code, description) => ({ name, type: 'SQL', code, description }));
for (const f of [...sqlsLista, ...telaLista]) repoFuncoes[f.name] = { type: 'SQL', code: f.code };
const jsList = criarFuncoes.match(/const JS = \[([^\]]*)\]/)[1].match(/'(\w+)'/g).map(x => x.slice(1, -1));
for (const n of jsList) repoFuncoes[n] = { type: 'JAVASCRIPT', code: lerTxt('backend/sf/' + n + '.js') };

const base = { geradoEm: new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19), commit, arquivos, repoFuncoes, telas: telasJson, sdkFront: sdkJson };
const json = JSON.stringify(base);
const blob = new Blob([json], { type: 'application/json' });
const up = await sdk.uploadFilePrivateMitra({ projectId, file: new File([blob], 'exportacao-leve-base.json', { type: 'application/json' }) });
const chave = up.result && up.result.key;
if (!chave) throw new Error('envio falhou: ' + JSON.stringify(up).slice(0, 200));
const sha = crypto.createHash('sha256').update(json).digest('hex');
await sdk.runDmlMitra({ projectId, sql: "INSERT INTO EXPORT_BASE (CHAVE_ARQUIVO, GERADO_EM, COMMIT_HASH, TAMANHO_BYTES, SHA256) VALUES ('" + chave.replace(/'/g, "''") + "','" + base.geradoEm + "','" + commit + "'," + Buffer.byteLength(json) + ",'" + sha + "')" });
console.log('base ok', arquivos.length, 'arquivos', Buffer.byteLength(json), 'bytes', 'funções no repo:', Object.keys(repoFuncoes).length, 'telas:', Object.keys(telasJson).length);
