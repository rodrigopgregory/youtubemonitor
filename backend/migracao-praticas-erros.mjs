import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const ddls = [
  `ALTER TABLE VIDEOS ADD COLUMN PRATICAS_ERROS INT NOT NULL DEFAULT 0`,
  `ALTER TABLE VIDEOS ADD COLUMN PRATICAS_ERRO VARCHAR(300)`,
];
for (const sql of ddls) {
  try { const r = await sdk.runDdlMitra({ projectId, sql }); console.log(sql.slice(0, 60), '->', JSON.stringify(r).slice(0, 150)); }
  catch (e) { console.log(sql.slice(0, 60), 'ERRO', e.message, JSON.stringify(e.response?.data || '').slice(0, 300)); }
}
