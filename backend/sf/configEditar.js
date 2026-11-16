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
const PADRAO = { DURACAO_MIN_SEG: '600', HORA_CHECAGEM: '6', AUDIO_LIGADO: '1', PRATICAS_LIGADO: '1', CONFERIR_MENTOR: '1', FINALIDADE_LIGADO: '1', LIVRO_LIGADO: '1', LIVRO_POR_NOITE: '2', LIVRO_PAUSA_ATE: '', IA_PAUSADA_ATE: '' };
const agoraBR = (ms) => new Date(Date.now() + (ms || 0) - 3 * 3600e3).toISOString().slice(0, 19);
const liga = v => (v === true || v === 1 || v === '1') ? '1' : (v === false || v === 0 || v === '0') ? '0' : null;
const REGRA = {
  DURACAO_MIN_SEG: v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 7200 ? String(n) : null; },
  HORA_CHECAGEM: v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 23 ? String(n) : null; },
  AUDIO_LIGADO: liga, PRATICAS_LIGADO: liga, CONFERIR_MENTOR: liga, FINALIDADE_LIGADO: liga, LIVRO_LIGADO: liga,
  LIVRO_POR_NOITE: v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 && n <= 10 ? String(n) : null; },
  LIVRO_PAUSA_ATE: v => v === '24h' ? agoraBR(24 * 3600e3) : (v === '' || v === null || v === false) ? '' : null,
};
async function ler() {
  const cfg = Object.assign({}, PADRAO);
  rows(await sql('configTelaLer', {})).forEach(r => { cfg[r.CHAVE] = String(r.VALOR); });
  const canais = rows(await sql('canaisMentorLer', {})).map(c => ({ ID: c.ID, NOME: c.NOME, TEM_MENTOR: Number(c.TEM_MENTOR) ? 1 : 0 }));
  return { ok: true, config: cfg, canais, agora: agoraBR() };
}
const acao = String(event.acao || 'ler');
if (acao === 'ler') return ler();
if (acao === 'gravar') {
  const chave = String(event.chave || '');
  if (!REGRA[chave]) return { ok: false, erro: 'Ajuste desconhecido.' };
  const valor = REGRA[chave](event.valor);
  if (valor === null) return { ok: false, erro: chave === 'HORA_CHECAGEM' ? 'Escolha uma hora entre 0 e 23.' : chave === 'DURACAO_MIN_SEG' ? 'Use de 0 a 120 minutos.' : chave === 'LIVRO_POR_NOITE' ? 'Escolha de 1 a 10 capítulos.' : 'Valor inválido.' };
  await sql('configTelaGravar', { chave, valor });
  return Object.assign(await ler(), { msg: 'Salvo.' });
}
if (acao === 'canalMentor') {
  const id = Math.round(Number(event.canalId)), tem = liga(event.tem);
  if (!(id > 0) || tem === null) return { ok: false, erro: 'Valor inválido.' };
  await sql('canalMentorGravar', { id, tem: Number(tem) });
  return Object.assign(await ler(), { msg: 'Salvo.' });
}
return { ok: false, erro: 'Ação desconhecida.' };
