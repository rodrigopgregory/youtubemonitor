import { sdk, projectId } from './lib.mjs';
import fs from 'fs';
if (projectId !== 67241) throw new Error('projeto errado');
const q = async (sql) => (await sdk.runQueryMitra({ projectId, sql })).result.rows;
const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "''");
for (const ddl of [
  "ALTER TABLE LIVROS_CATALOGO ADD COLUMN STATUS_LEITURA VARCHAR(12) NULL",
  "ALTER TABLE LIVROS_CATALOGO ADD COLUMN LOCALIZACAO VARCHAR(60) NULL",
  "ALTER TABLE LIVROS_CATALOGO ADD COLUMN IDIOMA VARCHAR(40) NULL",
]) { try { await sdk.runDdlMitra({ projectId, sql: ddl }); console.log('ok', ddl.slice(40)); } catch (e) { console.log('ddl', ddl.slice(40), String(e.message || JSON.stringify(e)).slice(0, 120)); } }
const rows = JSON.parse(fs.readFileSync('/tmp/anexos/biblioteca2.json', 'utf8')).slice(1).filter(r => r[1] && (r[12] || r[13]));
const mapa = { 'Lido': 'LIDO', 'Não lido': 'TENHO', 'Em andamento': 'LENDO' };
let atualizados = 0, novos = 0, semStatus = 0;
for (const r of rows) {
  const st = mapa[r[13]] || null; if (!st) semStatus++;
  const set = `STATUS_LEITURA = ${st ? "'" + st + "'" : 'NULL'}, LOCALIZACAO = NULLIF('${esc(r[12])}', ''), IDIOMA = NULLIF('${esc(r[14])}', '')`;
  const ja = await q(`SELECT ID FROM LIVROS_CATALOGO WHERE TITULO = '${esc(r[1]).slice(0, 300)}' COLLATE utf8mb4_0900_ai_ci LIMIT 1`);
  if (ja.length) { await sdk.runDmlMitra({ projectId, sql: `UPDATE LIVROS_CATALOGO SET ${set} WHERE ID = ${Number(ja[0].ID)}` }); atualizados++; }
  else {
    await sdk.runDmlMitra({ projectId, sql: `INSERT INTO LIVROS_CATALOGO (TITULO, AUTOR, SERIE, AREA, CATEGORIA, TEMA, GENERO, TOPICOS, ORIGEM, STATUS_LEITURA, LOCALIZACAO, IDIOMA, CRIADO_EM) VALUES ('${esc(r[1]).slice(0, 300)}', NULLIF('${esc(r[0]).slice(0, 200)}', ''), NULLIF('${esc(r[2]).slice(0, 200)}', ''), NULLIF('${esc(r[4])}', ''), NULLIF('${esc(r[5])}', ''), NULLIF('${esc(r[6])}', ''), NULLIF('${esc(r[10]).slice(0, 150)}', ''), NULLIF('${esc(r[11])}', ''), 'BIBLIOTECA', ${st ? "'" + st + "'" : 'NULL'}, NULLIF('${esc(r[12])}', ''), NULLIF('${esc(r[14])}', ''), DATE_FORMAT(NOW() - INTERVAL 3 HOUR, '%Y-%m-%dT%H:%i:%s'))` });
    novos++;
  }
}
console.log({ linhas: rows.length, atualizados, novos, semStatus });
console.log(await q("SELECT STATUS_LEITURA, COUNT(*) N FROM LIVROS_CATALOGO GROUP BY STATUS_LEITURA"));
