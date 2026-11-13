const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = __SF__;
async function sql(nome, input) {
  const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF[nome], input: input || {} });
  const res = r.result || r;
  if (res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res.error).slice(0, 300));
  let o = res.output; if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) {} }
  return o;
}
const rows = o => (o && o.rows) || [];
const capMentor = s => String(s || '').trim().replace(/\s+/g, ' ').split(' ').map((w, i) => { const lw = w.toLowerCase(); if (i > 0 && ['de', 'da', 'do', 'das', 'dos', 'e', 'd'].includes(lw)) return lw; return lw.charAt(0).toLocaleUpperCase('pt-BR') + lw.slice(1); }).join(' ');
const limpa0 = s => String(s || '').replace(/['"\\]/g, '’').trim().replace(/\s+/g, ' ').replace(/^mentor:\s*/i, '').slice(0, 140);
const limpa = s => capMentor(limpa0(s));
const sem = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const acao = String(event.acao || '');
const porId = async id => rows(await sql('mentorTemaPorId', { id: Number(id) || 0 }))[0];
async function juntar(origem, destino) {
  await sql('mentorBackup', { temaId: origem.ID });
  await sql('mentorMover', { origem: origem.ID, destino: destino.ID });
  await sql('mentorDesligar', { temaId: origem.ID });
  await sql('mentorTemaApagar', { temaId: origem.ID });
  if (sem(origem.NOME) !== sem(destino.NOME)) await sql('mentorRegraGravar', { nome: origem.NOME, tipo: 'APELIDO', destino: destino.NOME });
  return { ok: true, msg: '"' + origem.NOME + '" foi juntado em "' + destino.NOME + '".' };
}
if (acao === 'criar') {
  const nome = limpa(event.nome);
  if (nome.length < 2) return { ok: false, erro: 'Escreva o nome do mentor.' };
  await sql('mentorRegraGravar', { nome, tipo: 'MENTOR', destino: '' });
  await sql('temaGarantir', { nome: 'mentor: ' + nome });
  const t = rows(await sql('mentorTemaPorNome', { nome: 'mentor: ' + nome }))[0];
  let n = 0;
  if (t && event.marcarTitulos) { const r = await sql('mentorMarcarTitulos', { temaId: t.ID, nome }); n = Number((r && (r.rowsAffected ?? r.affectedRows)) || 0); }
  return { ok: true, msg: 'Mentor "' + nome + '" cadastrado.' + (event.marcarTitulos ? ' Marcado em ' + n + ' vídeo(s) com o nome no título.' : ''), temaId: t && t.ID };
}
if (acao === 'renomear') {
  const t = await porId(event.temaId); const novo = limpa(event.novo);
  if (!t) return { ok: false, erro: 'Mentor não encontrado.' };
  if (novo.length < 2) return { ok: false, erro: 'Escreva o novo nome.' };
  const ja = rows(await sql('mentorTemaPorNome', { nome: 'mentor: ' + novo }))[0];
  if (ja && ja.ID !== t.ID) return juntar(t, ja);
  await sql('mentorTemaRenomear', { temaId: t.ID, nome: 'mentor: ' + novo });
  if (sem(t.NOME) !== sem(novo)) await sql('mentorRegraGravar', { nome: t.NOME, tipo: 'APELIDO', destino: novo });
  await sql('mentorRegraApagarNome', { nome: novo }).catch(() => {});
  await sql('mentorRegraGravar', { nome: novo, tipo: 'MENTOR', destino: '' });
  return { ok: true, msg: 'Renomeado para "' + novo + '".' };
}
if (acao === 'juntar') {
  const o = await porId(event.temaId), d = await porId(event.destinoId);
  if (!o || !d || o.ID === d.ID) return { ok: false, erro: 'Escolha dois mentores diferentes.' };
  return juntar(o, d);
}
if (acao === 'naoMentor') {
  const t = await porId(event.temaId);
  if (!t) return { ok: false, erro: 'Mentor não encontrado.' };
  await sql('mentorBackup', { temaId: t.ID });
  await sql('mentorDesligar', { temaId: t.ID });
  await sql('mentorTemaApagar', { temaId: t.ID });
  await sql('mentorRegraGravar', { nome: t.NOME, tipo: 'NAO', destino: '' });
  return { ok: true, msg: '"' + t.NOME + '" saiu dos mentores e não volta nos próximos estudos.' };
}
if (acao === 'naoMentorNome') {
  const nome = limpa(event.nome);
  if (nome.length < 2) return { ok: false, erro: 'Escreva o nome.' };
  await sql('mentorRegraGravar', { nome, tipo: 'NAO', destino: '' });
  return { ok: true, msg: '"' + nome + '" não será marcado como mentor.' };
}
if (acao === 'apagarRegra') {
  await sql('mentorRegraApagar', { id: Number(event.id) || 0 });
  return { ok: true, msg: 'Regra apagada.' };
}
return { ok: false, erro: 'Ação desconhecida.' };
