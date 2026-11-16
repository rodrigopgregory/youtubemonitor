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
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const diaOk = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && String(d) <= hoje ? String(d) : hoje;
const humorOk = v => { const h = Math.floor(Number(v || 0)); return h >= 1 && h <= 5 ? h : 0; };
const textoOk = v => String(v || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 2000).replace(/\{\{/g, '{ {');
async function contagem(praticaId) {
  const c = ((await sql('diarioContagem', { praticaId })).rows || [{}])[0] || {};
  return { vezes: Number(c.VEZES || 0), ultima: c.ULTIMA || null };
}
async function doRegistro(id) {
  return ((await sql('diarioUm', { id })).rows || [])[0];
}
if (acao === 'apagar' || acao === 'editar') {
  const id = Math.floor(Number(event.id));
  if (!(id > 0)) return { ok: false, erro: 'Registro não informado.' };
  const reg = await doRegistro(id);
  if (!reg) return { ok: false, erro: 'Registro não encontrado.' };
  if (acao === 'apagar') await sql('diarioApagar', { id });
  else await sql('diarioAtualizar', { id, dia: diaOk(event.dia), humor: humorOk(event.humor), sentiu: textoOk(event.sentiu) });
  return { ok: true, praticaId: Number(reg.PRATICA_ID), ...(await contagem(Number(reg.PRATICA_ID))) };
}
if (acao !== 'fiz') return { ok: false, erro: 'Ação desconhecida.' };
const praticaId = Math.floor(Number(event.praticaId));
if (!(praticaId > 0)) return { ok: false, erro: 'Prática não informada.' };
const r = await sql('diarioInserir', { praticaId, dia: diaOk(event.dia), humor: humorOk(event.humor), sentiu: textoOk(event.sentiu) });
if (!r || !r.affectedRows) return { ok: false, erro: 'Prática não encontrada.' };
const u = ((await sql('diarioUltimo', { praticaId })).rows || [{}])[0] || {};
return { ok: true, id: Number(u.ID || 0), praticaId, vezes: Number(u.VEZES || 0), ultima: u.ULTIMA || null };
