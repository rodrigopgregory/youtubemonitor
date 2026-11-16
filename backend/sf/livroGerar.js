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
const JEITOS = { med: 'Meditação e mantras', vis: 'Visualização', saida: 'Técnicas de saída do corpo', resp: 'Respiração', energia: 'Exercícios de energia e chakras', prece: 'Preces, orações e decretos', banho: 'Banhos', defum: 'Defumação e velas', agua: 'Água, sal e cristais', chas: 'Chás, florais, óleos e remédios naturais', alim: 'Alimentação e receitas', corpo: 'Cuidados com o corpo', reflexao: 'Reflexão e autoconhecimento', ritual: 'Rituais e oferendas', musica: 'Músicas e sons', percepcao: 'Treinos de percepção e clarividência', outra: 'Outras' };
const GRUPOS = Object.values(JEITOS);
const temaId = Number(event.temaId || 0);
if (!temaId) return { ok: false, erro: 'Escolha um tema.' };
const info = ((await sql('livroTemaInfo', { temaId })).rows || [])[0];
if (!info) return { ok: false, erro: 'Tema sem vídeos estudados.' };
const resumos = (await sql('livroResumos', { temaId })).rows || [];
const prats = (await sql('livroPraticas', { temaId })).rows || [];
if (!resumos.length) return { ok: false, erro: 'Tema sem vídeos estudados.' };
const fonte = 'RESUMOS DOS VIDEOS:\n' + resumos.map(v => '- [' + v.CANAL + '] "' + v.TITULO + '": ' + v.RESUMO).join('\n') +
  '\n\nPRATICAS ENSINADAS (numeradas):\n' + prats.map((p, i) => 'P' + (i + 1) + ' [' + p.CANAL + ' / ' + (JEITOS[p.JEITO] || p.TIPO) + '] ' + (p.TITULO || '') + ': ' + (p.INSTRUCAO || '')).join('\n');
const prompt = 'Voce escreve um capitulo do "Livro Vivo", um livro de estudo que reune os ensinamentos de canais espiritualistas do YouTube (Wagner Borges, Monica de Medeiros - Casa do Consolador, Saulo Calderon). O capitulo e sobre o tema "' + info.NOME + '".\n' +
  'Use SOMENTE o material abaixo. Nao invente nada de fora.\n' +
  'Responda so JSON: {"texto":"...","praticas":[{"grupo":"...","titulo":"...","quando":"...","passos":"...","fontes":[1,2]}]}\n' +
  '"texto": o capitulo em portugues, de 4 a 10 paragrafos, organizado em secoes com subtitulos (linhas que comecam com "## "). Agrupe o que os canais ensinam em ideias principais, mostre onde concordam e o que cada um acrescenta, citando o canal pelo nome. Separe paragrafos com linha em branco.\n' +
  '"praticas": junte as praticas parecidas numa so (ex.: varias receitas para dor de cabeca viram uma receita), no maximo 25. Para cada uma: "grupo" (escolha SO desta lista: ' + GRUPOS.join('; ') + '), "titulo" curto, "quando" (para que serve, 1 frase), "passos" (o passo a passo unificado: ingredientes, quantidades, horario, o que falar ou mentalizar; ate 10 frases) e "fontes" (os numeros das praticas P usadas, sem o P). Lista vazia se nao houver praticas.\n\nMATERIAL:\n' + fonte.slice(0, 400000);
const cfg = {}; ((await sql('configLer', {})).rows || []).forEach(r => { cfg[r.CHAVE] = r.VALOR; });
const modelos = String(cfg.MODELO_ANALISE || 'gemini-3.1-flash-lite').split(',').map(x => x.trim()).filter(Boolean);
let ultimo = '', j = null;
for (const conexao of String(cfg.GEMINI_CONEXOES || 'gemini').split(',').map(x => x.trim()).filter(Boolean)) {
  for (const modelo of modelos) {
    try {
      const r = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body: {
        contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: 'application/json', maxOutputTokens: 30000 } } });
      const b = (r.result ? r.result.body : r.body) || {};
      const st = r.result ? r.result.statusCode : r.statusCode;
      if ((st && st >= 400) || b.error) { ultimo = String((b.error && b.error.message) || st); continue; }
      const txt = ((((b.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').trim();
      try { j = JSON.parse(txt); } catch (e) { const a = txt.indexOf('{'), z = txt.lastIndexOf('}'); try { j = JSON.parse(txt.slice(a, z + 1)); } catch (e2) { j = null; } }
      if (j && j.texto) break;
      ultimo = 'resposta sem texto'; j = null;
    } catch (e) { ultimo = String(e.message || e); }
  }
  if (j) break;
}
if (!j) return { ok: false, erro: 'Não consegui escrever o capítulo agora. Tente de novo em instantes.', detalhe: ultimo.slice(0, 200) };
const praticas = (Array.isArray(j.praticas) ? j.praticas : []).slice(0, 30).map(p => ({
  grupo: GRUPOS.includes(p.grupo) ? p.grupo : 'Outras',
  titulo: String(p.titulo || '').slice(0, 200), quando: String(p.quando || '').slice(0, 500), passos: String(p.passos || '').slice(0, 4000),
  fontes: (Array.isArray(p.fontes) ? p.fontes : []).map(n => prats[Number(n) - 1]).filter(Boolean).filter((x, i, a) => a.findIndex(y => y.YT === x.YT) === i).slice(0, 8)
    .map(x => ({ video: x.VIDEO, canal: x.CANAL, yt: x.YT, seg: Number(x.SEGUNDO || 0) })),
}));
await sql('livroGravar', { temaId, tema: info.NOME, texto: String(j.texto).slice(0, 60000), praticas: JSON.stringify(praticas), videos: Number(info.QTD) });
return { ok: true, tema: info.NOME, praticas: praticas.length };
