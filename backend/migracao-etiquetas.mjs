import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const ddls = [
  `ALTER TABLE PRATICAS ADD COLUMN JEITO VARCHAR(40) NULL COMMENT 'Jeito de fazer (codigo de um dos grupos: meditacao, visualizacao, saida_corpo...)'`,
  `ALTER TABLE PRATICAS ADD COLUMN SERVE VARCHAR(400) NULL COMMENT 'Para que serve: codigos grupo.detalhe separados por virgula (protecao.pessoal, sono.insonia...)'`,
  `ALTER TABLE PRATICAS ADD COLUMN QUANDO VARCHAR(200) NULL COMMENT 'Quando fazer: codigos separados por virgula (todo_dia, antes_dormir...); nulo = a pratica nao diz'`,
  `ALTER TABLE PRATICAS ADD COLUMN CONSELHO TINYINT NOT NULL DEFAULT 0 COMMENT '1 = conselho generico sem tecnica; fica escondido nas telas'`,
  `ALTER TABLE PRATICAS ADD COLUMN REVISADA_EM VARCHAR(19) NULL COMMENT 'Quando as etiquetas novas foram revisadas'`,
];
for (const sql of ddls) {
  try { const r = await sdk.runDdlMitra({ projectId, sql }); console.log(sql.slice(0, 50), '->', JSON.stringify(r).slice(0, 120)); }
  catch (e) { console.log(sql.slice(0, 50), 'ERRO', e.message, JSON.stringify(e.response?.data || '').slice(0, 300)); }
}
