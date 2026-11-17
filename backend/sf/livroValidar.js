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
const id = Math.round(Number(event.id));
if (!(id > 0)) return { ok: false, erro: 'Livro inválido.' };
const um = rows(await sql('validarUm', { id }))[0];
if (!um) return { ok: false, erro: 'Não achei esse nome.' };
const cfg = {}; rows(await sql('configLer', {})).forEach(r => { cfg[r.CHAVE] = r.VALOR; });
const modelos = String(cfg.MODELO_ANALISE || 'gemini-3.1-flash-lite').split(',').map(x => x.trim()).filter(Boolean);
const prompt = 'Um nome de livro foi ouvido na transcricao de um video espirita/espiritualista e pode estar errado, truncado ou nem ser livro. PESQUISE NO GOOGLE se existe um livro real com esse nome ou parecido (em portugues).\nNome ouvido: "' + um.NOME + '"' + (um.AUTOR ? '\nAutor ouvido: ' + um.AUTOR : '') + (um.TRECHO ? '\nContexto: ' + String(um.TRECHO).slice(0, 300) : '') + '\nSe achar com seguranca, devolva o titulo oficial e o autor, com conf "alta". Se achar so algo parecido, conf "media" ou "baixa" e o palpite em titulo/autor. Se nao for livro ou nao achar nada, titulo vazio e conf "baixa".\nResponda so JSON: {"titulo":"...","autor":"...","conf":"alta|media|baixa","motivo":"uma frase"}';
let ultimo = '', j = null;
for (const conexao of String(cfg.GEMINI_CONEXOES || 'gemini').split(',').map(x => x.trim()).filter(Boolean)) {
  for (const modelo of modelos) {
    try {
      const r = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body: { contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } } });
      const b = (r.result ? r.result.body : r.body) || {};
      const st = r.result ? r.result.statusCode : r.statusCode;
      if ((st && st >= 400) || b.error) { ultimo = (st || '') + ' ' + String((b.error && b.error.message) || ''); continue; }
      const txt = ((((b.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').trim();
      const a = txt.indexOf('{'), z = txt.lastIndexOf('}');
      try { j = JSON.parse(txt.slice(a, z + 1)); } catch (e2) { j = null; }
      if (j) break;
      ultimo = 'resposta sem JSON';
    } catch (e) { ultimo = String(e.message || e); }
  }
  if (j) break;
}
if (!j) return { ok: false, erro: /429|rate|quota/i.test(ultimo) ? 'A IA está sem cota agora. Tente mais tarde ou valide manualmente.' : 'Não consegui validar agora. Tente de novo ou valide manualmente.', detalhe: ultimo.slice(0, 200) };
const item = { nome: String(um.NOME), titulo: String(j.titulo || '').slice(0, 300), autor: String(j.autor || '').slice(0, 200), conf: ['alta', 'media', 'baixa'].includes(j.conf) ? j.conf : 'baixa', motivo: String(j.motivo || '').slice(0, 300) };
if (!item.titulo) item.conf = 'baixa';
const chave = 'V:' + id + ':' + Date.now();
try {
  await sql('loteApagar', { chave });
  await sql('loteGravar', { chave, json: JSON.stringify([item]) });
  await sql('nomesCatalogoGravar', { chave }); await sql('nomesOkGravar', { chave }); await sql('nomesOkAtualizar', { chave });
  await sql('nomesPendGravar', { chave }); await sql('nomesPendAtualizar', { chave });
} finally { await sql('loteApagar', { chave }).catch(() => {}); }
const est = rows(await sql('nomeEstado', { id }))[0] || {};
return { ok: true, estado: est.ESTADO || 'PENDENTE', titulo: est.TITULO || est.SUGESTAO_TITULO || '', autor: est.AUTOR || est.SUGESTAO_AUTOR || '', motivo: est.MOTIVO || item.motivo };
