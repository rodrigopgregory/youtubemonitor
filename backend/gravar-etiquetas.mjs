import fs from 'fs';
import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const linhas = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(l => l.split(';'));
const q = v => v ? `'${v.replace(/'/g, "''")}'` : 'NULL';
const agora = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
for (let i = 0; i < linhas.length; i += 50) {
  const p = linhas.slice(i, i + 50);
  const caso = (k) => 'CASE ID ' + p.map(l => `WHEN ${Number(l[0])} THEN ${k(l)}`).join(' ') + ' END';
  const sql = `UPDATE PRATICAS SET JEITO = ${caso(l => q(l[1]))}, SERVE = ${caso(l => q(l[2]))}, QUANDO = ${caso(l => q(l[3]))}, CONSELHO = ${caso(l => l[4] === '1' ? 1 : 0)}, REVISADA_EM = '${agora}' WHERE ID IN (${p.map(l => Number(l[0])).join(',')})`;
  const r = await sdk.runDmlMitra({ projectId, sql });
  console.log(i, JSON.stringify(r).slice(0, 100));
}
