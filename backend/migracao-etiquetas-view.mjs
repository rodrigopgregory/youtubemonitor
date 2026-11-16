import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const sql = `CREATE VIEW VW_LOTE_ETIQUETAS AS SELECT L.CHAVE, J.ID, J.JEITO, J.SERVE, J.QUANDO, J.CONSELHO FROM LOTES L JOIN JSON_TABLE(L.JSON_TXT, '$[*]' COLUMNS (ID INT PATH '$.id', JEITO VARCHAR(40) PATH '$.jeito', SERVE VARCHAR(400) PATH '$.serve', QUANDO VARCHAR(200) PATH '$.quando', CONSELHO INT PATH '$.conselho')) J`;
try { const r = await sdk.runDdlMitra({ projectId, sql }); console.log(JSON.stringify(r).slice(0, 150)); }
catch (e) { console.log('ERRO', e.message, JSON.stringify(e.response?.data || '').slice(0, 300)); }
