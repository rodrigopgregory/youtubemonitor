const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = __SF__;
async function sql(nome, input) {
  const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF[nome], input: input || {} });
  const res = r.result || r;
  if (res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res.error).slice(0, 300));
  return res.output;
}
const acao = String(event.acao || '');
if (acao === 'apagar') {
  const id = Math.floor(Number(event.id));
  if (!(id > 0)) return { ok: false, erro: 'Registro não informado.' };
  await sql('diarioApagar', { id });
  return { ok: true };
}
if (acao !== 'fiz') return { ok: false, erro: 'Ação desconhecida.' };
const praticaId = Math.floor(Number(event.praticaId));
if (!(praticaId > 0)) return { ok: false, erro: 'Prática não informada.' };
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(event.dia || '')) && String(event.dia) <= hoje ? String(event.dia) : hoje;
const h = Math.floor(Number(event.humor || 0));
const humor = h >= 1 && h <= 5 ? h : 0;
const sentiu = String(event.sentiu || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 2000).replace(/\{\{/g, '{ {');
const r = await sql('diarioInserir', { praticaId, dia, humor, sentiu });
if (!r || !r.affectedRows) return { ok: false, erro: 'Prática não encontrada.' };
return { ok: true };
