import fs from 'fs';
import { garantirSF, exec, projectId, sdk } from './lib.mjs';
import { tela } from './funcoes-tela.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const S = (name, code, description) => ({ name, type: 'SQL', code, description });
export const sqls = [
  S('configLer', `SELECT CHAVE, VALOR FROM CONFIG`, 'Lê os parâmetros do monitor'),
  S('configGravar', `UPDATE CONFIG SET VALOR = '{{valor}}' WHERE CHAVE = '{{chave}}'`, 'Grava um parâmetro'),
  S('loteGravar', `INSERT INTO LOTES (CHAVE, JSON_TXT, CRIADO_EM) VALUES ('{{chave}}', '{{json}}', DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s'))`, 'Área de passagem de lotes'),
  S('loteApagar', `DELETE FROM LOTES WHERE CHAVE = '{{chave}}'`, 'Limpa a área de passagem'),
  S('videosInserirLote', `INSERT IGNORE INTO VIDEOS (CANAL_ID, YT_VIDEO_ID, TITULO, DURACAO_SEG, TIPO, THUMB, STATUS, ORDEM, DESCOBERTA, CRIADO_EM, ATUALIZADO_EM) SELECT {{canalId}}, YT, TITULO, DUR, TIPO, THUMB, 'FILA', POS, '{{descoberta}}', DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s'), DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s') FROM VW_LOTE_VIDEOS WHERE CHAVE = '{{chave}}'`, 'Insere vídeos novos na fila'),
  S('canalCargaAtualizar', `UPDATE CANAIS SET CARGA_STATUS = '{{status}}', CARGA_TOKEN = '{{token}}', POS_BASE = {{posBase}}, CARGA_MSG = '{{msg}}', ELEGIVEIS = (SELECT COUNT(*) FROM VIDEOS WHERE CANAL_ID = {{id}}) WHERE ID = {{id}}`, 'Andamento da carga histórica'),
  S('canalCargaMsg', `UPDATE CANAIS SET CARGA_MSG = '{{msg}}' WHERE ID = {{id}}`, 'Mensagem do canal'),
  S('videosIdsCanal', `SELECT YT_VIDEO_ID FROM VIDEOS WHERE CANAL_ID = {{canalId}}`, 'Vídeos já conhecidos'),
  S('canalChecado', `UPDATE CANAIS SET ULTIMA_CHECAGEM = '{{quando}}' WHERE ID = {{id}}`, 'Marca checagem diária'),
  S('trechosInserirLote', `INSERT IGNORE INTO TRECHOS (VIDEO_ID, SEGUNDO, TEXTO) SELECT {{videoId}}, S, T FROM VW_LOTE_TRECHOS WHERE CHAVE = '{{chave}}'`, 'Grava trechos da transcrição'),
  S('videoProgresso', `UPDATE VIDEOS SET PROGRESSO_SEG = {{seg}} WHERE ID = {{id}}`, 'Progresso da transcrição pelo áudio'),
  S('trechosDoVideo', `SELECT SEGUNDO, TEXTO FROM TRECHOS WHERE VIDEO_ID = {{videoId}} ORDER BY SEGUNDO LIMIT {{limit}} OFFSET {{offset}}`, 'Trechos de um vídeo'),
  S('temasNomes', `SELECT T.NOME FROM TEMAS T JOIN VIDEO_TEMAS VT ON VT.TEMA_ID = T.ID GROUP BY T.NOME ORDER BY (T.NOME LIKE 'mentor: %') DESC, COUNT(*) DESC LIMIT 400`, 'Temas já usados'),
  S('temasGarantirLote', `INSERT IGNORE INTO TEMAS (NOME) SELECT DISTINCT NOME FROM VW_LOTE_TEMAS WHERE CHAVE = '{{chave}}'`, 'Cria temas novos'),
  S('videoTemasIA', `INSERT INTO VIDEO_TEMAS (VIDEO_ID, TEMA_ID, ORIGEM, MOMENTOS) SELECT V.ID, T.ID, 'IA', L.MOM FROM VW_LOTE_TEMAS L JOIN TEMAS T ON T.NOME = L.NOME JOIN VIDEOS V ON V.ID = {{videoId}} AND V.TEMAS_EDITADOS = 0 WHERE L.CHAVE = '{{chave}}' ON DUPLICATE KEY UPDATE MOMENTOS = VALUES(MOMENTOS)`, 'Temas sugeridos pela IA (não mexe se a dona editou)'),
  S('videoConcluir', `UPDATE VIDEOS SET STATUS = 'ESTUDADO', RESUMO = '{{resumo}}', ESTUDADO_EM = '{{quando}}', ATUALIZADO_EM = '{{quando}}', MOTIVO = NULL WHERE ID = {{id}}`, 'Marca vídeo estudado'),
  S('videoPendente', `UPDATE VIDEOS SET STATUS = 'PENDENTE', MOTIVO = '{{motivo}}', TENTATIVAS = TENTATIVAS + 1, ATUALIZADO_EM = DATE_FORMAT(NOW(), '%Y-%m-%dT%H:%i:%s') WHERE ID = {{id}}`, 'Marca vídeo pendente com motivo'),
  S('videoIndisponivel', `UPDATE VIDEOS SET INDISPONIVEL = 1 WHERE ID = {{id}}`, 'Vídeo removido do YouTube'),
  S('videoDetalhes', `UPDATE VIDEOS SET PUBLICADO_EM = NULLIF('{{publicado}}', ''), DURACAO_SEG = {{duracao}}, TIPO = '{{tipo}}', INDISPONIVEL = 0 WHERE ID = {{id}}`, 'Detalhes do vídeo'),
  S('videoForaDoFiltro', `UPDATE VIDEOS SET STATUS = 'FORA', MOTIVO = 'Duração de até 10 minutos.' WHERE ID = {{id}}`, 'Vídeo curto'),
  S('videoOrigem', `UPDATE VIDEOS SET ORIGEM = '{{origem}}' WHERE ID = {{id}}`, 'Origem da transcrição'),
  S('videosRetentar', `UPDATE VIDEOS SET STATUS = 'FILA' WHERE STATUS = 'PENDENTE' AND TENTATIVAS < 10`, 'Recoloca pendentes na fila'),
  S('canaisParaMotor', `SELECT ID, NOME, UPLOADS_PLAYLIST, CARGA_STATUS, CARGA_TOKEN, POS_BASE, ELEGIVEIS, LIMITE FROM CANAIS ORDER BY ID`, 'Canais monitorados'),
  S('filaComLegenda', `SELECT COUNT(*) N FROM VIDEOS WHERE STATUS = 'FILA' AND (ORIGEM IS NULL OR ORIGEM <> 'AUDIO')`, 'Vídeos na fila ainda sem tentativa pelo áudio'),
  S('filaProximo', `SELECT ID, YT_VIDEO_ID, TITULO, DURACAO_SEG, TIPO, ORIGEM, PROGRESSO_SEG FROM (SELECT V.ID, V.YT_VIDEO_ID, V.TITULO, V.DURACAO_SEG, V.TIPO, V.ORIGEM, V.PROGRESSO_SEG, V.PRIORIDADE, V.ORDEM, ROW_NUMBER() OVER (PARTITION BY V.CANAL_ID ORDER BY V.PRIORIDADE DESC, V.ORDEM ASC) AS VEZ FROM VIDEOS V JOIN CANAIS C ON C.ID = V.CANAL_ID WHERE V.STATUS = 'FILA' AND C.CARGA_STATUS <> 'LISTANDO' AND ({{canalId}} = 0 OR V.CANAL_ID = {{canalId}})) X ORDER BY PRIORIDADE DESC, (ORIGEM = 'AUDIO') ASC, VEZ ASC, ORDEM ASC LIMIT 1`, 'Próximo vídeo da fila'),
  S('filaContar', `SELECT COUNT(*) N FROM VIDEOS WHERE STATUS = 'FILA'`, 'Tamanho da fila'),
  S('avisoPendentes', `SELECT COUNT(*) N FROM VIDEOS WHERE DESCOBERTA = 'DIARIA' AND STATUS = 'ESTUDADO' AND AVISO_ID IS NULL`, 'Vídeos novos sem aviso'),
  S('avisoHoje', `SELECT ID FROM AVISOS WHERE DIA = '{{dia}}' ORDER BY ID DESC LIMIT 1`, 'Aviso do dia'),
  S('avisoCriar', `INSERT INTO AVISOS (CRIADO_EM, QTD, LIDO, DIA) VALUES ('{{quando}}', 0, FALSE, '{{dia}}')`, 'Cria aviso'),
  S('avisoVincular', `UPDATE VIDEOS SET AVISO_ID = {{id}} WHERE DESCOBERTA = 'DIARIA' AND STATUS = 'ESTUDADO' AND AVISO_ID IS NULL`, 'Liga vídeos ao aviso'),
  S('avisoRecontar', `UPDATE AVISOS SET QTD = (SELECT COUNT(*) FROM VIDEOS WHERE AVISO_ID = {{id}}), LIDO = FALSE WHERE ID = {{id}}`, 'Reconta aviso'),
  S('canaisAtualizarStatus', `UPDATE CANAIS C SET CARGA_STATUS = CASE WHEN EXISTS (SELECT 1 FROM VIDEOS V WHERE V.CANAL_ID = C.ID AND V.STATUS = 'FILA') THEN 'ESTUDANDO' ELSE 'EM_DIA' END WHERE C.CARGA_STATUS IN ('ESTUDANDO', 'EM_DIA')`, 'Status do canal'),
  S('lockAdquirir', `UPDATE CONFIG SET VALOR = '{{ate}}' WHERE CHAVE = 'LOCK' AND (VALOR = '' OR CAST(VALOR AS UNSIGNED) < {{agora}})`, 'Trava do motor'),
  S('lockLiberar', `UPDATE CONFIG SET VALOR = '' WHERE CHAVE = 'LOCK' AND VALOR = '{{ate}}'`, 'Libera trava'),
];
const ids = {};
for (const f of [...sqls, ...tela]) ids[f.name] = await garantirSF(f);
const JS = ['motor', 'canalCadastrar', 'temaEditar', 'resumoBusca', 'chatBusca', 'estudarMais'];
for (const n of JS) ids[n] = await garantirSF({ name: n, type: 'JAVASCRIPT', code: 'return 1;' });
fs.writeFileSync('sf-ids.json', JSON.stringify(ids, null, 1));
const desc = { motor: 'Motor: carga histórica, checagem diária e estudo dos vídeos', canalCadastrar: 'Cadastra canal pelo link', temaEditar: 'Acrescenta, tira ou renomeia tema de um vídeo', resumoBusca: 'Resumo do tema feito só com a base', chatBusca: 'Chat de busca: entende o pedido e responde só com a base', estudarMais: 'Coloca mais vídeos na fila de estudo (pedido pelo chat)' };
for (const n of JS) await garantirSF({ name: n, type: 'JAVASCRIPT', code: fs.readFileSync('sf/' + n + '.js', 'utf8').replace('__SF__', JSON.stringify(ids)), description: desc[n] });
await sdk.updateServerFunctionMitra({ projectId, serverFunctionId: ids.motor, cronExpression: '0 5 * * * *', cronInputJson: JSON.stringify({ modo: 'agendado' }) });
const telaNomes = ['canalCadastrar', 'temaEditar', 'resumoBusca', 'chatBusca', 'estudarMais', 'trechosDoVideo', ...tela.map(f => f.name)];
fs.writeFileSync('sf-tela.json', JSON.stringify(Object.fromEntries(telaNomes.map(n => [n, ids[n]]))));
console.log('ok', Object.keys(ids).length);
const publicas = ['avisoMarcarLido', 'avisoVideos', 'avisosListar', 'buscarTema', 'canaisListar', 'canaisNomes', 'canalCadastrar', 'chatBusca', 'estudarMais', 'exportTrechos', 'exportVideos', 'painelResumo', 'resumoBusca', 'temaEditar', 'temasListar', 'trechosDoVideo', 'videoDetalhe', 'videoTemas', 'videosListar'];
for (const n of Object.keys(ids)) await sdk.togglePublicExecutionMitra({ projectId, serverFunctionId: ids[n], publicExecution: publicas.includes(n) });
console.log('públicas', publicas.length);
await sdk.setProfileServerFunctionsMitra({ projectId, profileId: 1, serverFunctionIds: Object.values(ids) });
console.log('perfil ok');
