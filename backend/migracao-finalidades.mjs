import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const ddls = [
  `ALTER TABLE PRATICAS ADD COLUMN FINALIDADES VARCHAR(400) NULL COMMENT 'Para que a pratica serve: lista de codigos separados por virgula (lucidez, emocional, negativos, protecao...)'`,
  `ALTER TABLE PRATICAS ADD COLUMN FINALIDADE_EM VARCHAR(19) NULL COMMENT 'Quando a IA marcou as finalidades; nulo = so pela busca de palavras'`,
  `CREATE VIEW VW_LOTE_FINALIDADES AS SELECT L.CHAVE, J.ID, J.FIN FROM LOTES L JOIN JSON_TABLE(L.JSON_TXT, '$[*]' COLUMNS (ID INT PATH '$.id', FIN VARCHAR(400) PATH '$.fin')) J`,
];
for (const sql of ddls) {
  try { const r = await sdk.runDdlMitra({ projectId, sql }); console.log(sql.slice(0, 50), '->', JSON.stringify(r).slice(0, 150)); }
  catch (e) { console.log(sql.slice(0, 50), 'ERRO', e.message, JSON.stringify(e.response?.data || '').slice(0, 300)); }
}
