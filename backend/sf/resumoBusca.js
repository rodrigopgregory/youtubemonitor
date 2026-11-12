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
const tr = ((await sql('buscaTrechos', { tema, canalId: Number(event.canalId || 0) })).rows || []);
const vids = ((await sql('buscaResumos', { tema, canalId: Number(event.canalId || 0) })).rows || []);
if (!tr.length && !vids.length) return vazio;
const mmss = s => { const h = Math.floor(s / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60; return (h ? h + ':' + String(mi).padStart(2, '0') : mi) + ':' + String(se).padStart(2, '0'); };
const fonte = vids.map(v => 'VIDEO "' + v.TITULO + '" (resumo): ' + v.RESUMO).join('\n\n') + '\n\n' + tr.map(x => '[' + x.TITULO + ' ' + mmss(x.SEGUNDO) + '] ' + x.TEXTO).join('\n');
const cfg = {}; ((await sql('configLer', {})).rows || []).forEach(r => { cfg[r.CHAVE] = r.VALOR; });
let ultimo = '';
for (const modelo of String(cfg.MODELO_ANALISE).split(',').map(x => x.trim()).filter(Boolean)) {
  try {
    const r = await m.callIntegrationMitra({ projectId: pid, connection: 'gemini', method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body: {
      contents: [{ parts: [{ text: 'Use SOMENTE o material abaixo, tirado das transcricoes de videos de uma base de estudo. Escreva em portugues um resumo de 1 a 3 paragrafos do que foi falado sobre o tema "' + tema + '", citando o titulo do video quando ajudar. Nao acrescente nada de fora do material. Se o material nao tratar do tema, responda exatamente: NENHUM.\n\nMATERIAL:\n' + fonte.slice(0, 200000) }] }],
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
