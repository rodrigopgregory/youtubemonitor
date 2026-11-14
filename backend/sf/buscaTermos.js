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
const cfg = {}; ((await sql('configLer', {})).rows || []).forEach(r => { cfg[r.CHAVE] = r.VALOR; });
const temas = ((await sql('temasNomes', {})).rows || []).map(r => r.NOME).filter(n => !String(n).startsWith('mentor: ')).slice(0, 200);
const prompt = 'Uma pessoa vai pesquisar o tema "' + tema + '" numa base de transcricoes de videos de espiritualidade em portugues. Devolva so JSON {"termos":["..."]} com 2 a 5 termos de UMA ou DUAS palavras, do jeito que alguem falaria num video: sinonimos e palavras muito proximas do tema (ex.: para "protecao" use "protecao", "blindagem", "defesa energetica"). Nao inclua o proprio tema. Nao fuja do assunto. Temas que ja existem na base (use quando forem sinonimos): ' + temas.join('; ');
for (const conexao of String(cfg.GEMINI_CONEXOES || 'gemini').split(',').map(x => x.trim()).filter(Boolean))
for (const modelo of String(cfg.MODELO_ANALISE).split(',').map(x => x.trim()).filter(Boolean)) {
  try {
    const r = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body: {
      contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } } });
    const b = (r.result ? r.result.body : r.body) || {};
    const st = r.result ? r.result.statusCode : r.statusCode;
    if ((st && st >= 400) || b.error) continue;
    const txt = ((((b.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').trim();
    if (!txt) continue;
    const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    const sem = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const vistos = new Set([sem(tema)]);
    const extras = (j.termos || []).map(x => String(x).trim().slice(0, 60)).filter(x => x && !vistos.has(sem(x)) && vistos.add(sem(x))).slice(0, 4);
    return { ok: true, termos: [tema, ...extras] };
  } catch (e) {}
}
return { ok: true, termos: [tema], semIA: true };
