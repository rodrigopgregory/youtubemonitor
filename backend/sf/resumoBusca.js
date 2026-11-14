const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = __SF__;
async function sql(nome, input) {
  const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF[nome], input: input || {} });
  const res = r.result || r;
  if (res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res.error).slice(0, 300));
  return res.output;
}
const tema = String(event.tema || '').trim().slice(0, 150);
if (!tema) return { ok: false, erro: 'Escreva um tema.' };
const vazio = { ok: true, vazio: true, resumo: 'Nenhum vídeo da base trata do tema "' + tema + '".' };
const termos = [tema, ...(Array.isArray(event.termos) ? event.termos : []).map(x => String(x).trim().slice(0, 60)).filter(Boolean)].filter((x, i, a) => a.indexOf(x) === i).slice(0, 5);
const tr = [], vids = [], vistosT = new Set(), vistosV = new Set();
for (const t of termos) {
  for (const x of ((await sql('buscaTrechos', { tema: t, canalId: Number(event.canalId || 0) })).rows || [])) { const k = x.TITULO + '|' + x.SEGUNDO; if (!vistosT.has(k) && tr.length < 150) { vistosT.add(k); tr.push(x); } }
  for (const x of ((await sql('buscaResumos', { tema: t, canalId: Number(event.canalId || 0) })).rows || [])) { if (!vistosV.has(x.TITULO) && vids.length < 30) { vistosV.add(x.TITULO); vids.push(x); } }
}
if (!tr.length && !vids.length) return vazio;
const mmss = s => { const h = Math.floor(s / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60; return (h ? h + ':' + String(mi).padStart(2, '0') : mi) + ':' + String(se).padStart(2, '0'); };
const fonte = vids.map(v => 'VIDEO "' + v.TITULO + '" (resumo): ' + v.RESUMO).join('\n\n') + '\n\n' + tr.map(x => '[' + x.TITULO + ' ' + mmss(x.SEGUNDO) + '] ' + x.TEXTO).join('\n');
const cfg = {}; ((await sql('configLer', {})).rows || []).forEach(r => { cfg[r.CHAVE] = r.VALOR; });
let ultimo = '';
for (const conexao of String(cfg.GEMINI_CONEXOES || 'gemini').split(',').map(x => x.trim()).filter(Boolean))
for (const modelo of String(cfg.MODELO_ANALISE).split(',').map(x => x.trim()).filter(Boolean)) {
  try {
    const r = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body: {
      contents: [{ parts: [{ text: 'Use SOMENTE o material abaixo, tirado das transcricoes de videos de uma base de estudo. Escreva em portugues um resumo de 1 a 3 paragrafos do que foi falado sobre o tema "' + tema + '" (termos procurados: ' + termos.join(', ') + '), citando o titulo do video quando ajudar. Nao acrescente nada de fora do material. Se o material nao tratar do tema, responda exatamente: NENHUM.\n\nMATERIAL:\n' + fonte.slice(0, 200000) }] }],
      generationConfig: { temperature: 0.2 } } });
    const b = (r.result ? r.result.body : r.body) || {};
    const st = r.result ? r.result.statusCode : r.statusCode;
    if ((st && st >= 400) || b.error) { ultimo = String((b.error && b.error.message) || st); continue; }
    const txt = ((((b.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').trim();
    if (!txt) continue;
    if (/^NENHUM\.?$/i.test(txt)) return vazio;
    return { ok: true, resumo: txt };
  } catch (e) { ultimo = String(e.message || e); }
}
return { ok: false, erro: 'Não consegui gerar o resumo agora. Tente de novo em instantes.', detalhe: ultimo.slice(0, 200) };
