const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = __SF__;
async function sql(nome, input) {
  const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF[nome], input: input || {} });
  const res = r.result || r;
  if (res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res.error).slice(0, 300));
  return res.output;
}
const cfg = {}; ((await sql('configLer', {})).rows || []).forEach(r => { cfg[r.CHAVE] = r.VALOR; });
async function gemini(prompt, json) {
  let ultimo = '';
  for (const conexao of String(cfg.GEMINI_CONEXOES || 'gemini').split(',').map(x => x.trim()).filter(Boolean))
  for (const modelo of String(cfg.MODELO_ANALISE).split(',').map(x => x.trim()).filter(Boolean)) {
    try {
      const r = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: Object.assign({ temperature: 0.2 }, json ? { responseMimeType: 'application/json' } : {}) } });
      const b = (r.result ? r.result.body : r.body) || {};
      const st = r.result ? r.result.statusCode : r.statusCode;
      if ((st && st >= 400) || b.error) { ultimo = String((b.error && b.error.message) || st); continue; }
      const txt = ((((b.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').trim();
      if (txt) return txt;
    } catch (e) { ultimo = String(e.message || e); }
  }
  throw new Error(ultimo || 'sem resposta');
}
const mmss = s => { const h = Math.floor(s / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60; return (h ? h + ':' + String(mi).padStart(2, '0') : mi) + ':' + String(se).padStart(2, '0'); };
const hist = (Array.isArray(event.mensagens) ? event.mensagens : []).slice(-8).map(x => ({ papel: x.papel === 'agente' ? 'agente' : 'pessoa', texto: String(x.texto || '').slice(0, 1500) }));
const pedido = String(event.texto || '').trim().slice(0, 1500);
if (!pedido) return { ok: false, erro: 'Escreva o que você quer buscar.' };
const conversa = hist.map(x => (x.papel === 'agente' ? 'ASSISTENTE: ' : 'PESSOA: ') + x.texto).join('\n');

let plano;
try {
  const temas = ((await sql('temasNomes', {})).rows || []).map(r => r.NOME).slice(0, 200);
  const canaisLista = ((await sql('canaisNomes', {})).rows || []);
  plano = JSON.parse(await gemini(
    'Voce ajuda uma pessoa a pesquisar uma base de transcricoes de videos de espiritualidade (canais do YouTube). Leia o pedido e devolva so JSON:\n' +
    '{"tipo":"busca"|"estudar"|"andamento"|"fora","termos":["..."],"ordem":"relevancia"|"recentes","somenteLives":true|false,"quantidade":<numero>,"canalId":<numero ou 0>}\n- canalId tambem vale para "busca": se a pessoa citar um canal no pedido (ex.: "o que a Monica fala sobre..."), use o ID dele; senao 0.\n' +
    '- tipo "estudar": a pessoa pede para estudar/rodar/processar/carregar mais videos (ex.: "roda mais 50 videos", "estuda mais 200 do Wagner"). quantidade = o numero pedido (se nao disser, 50; se pedir todos, 2000). canalId = o ID do canal citado, ou 0 para todos. Canais: ' + canaisLista.map(c => c.ID + '=' + c.NOME).join(', ') + '\n' +
    '- tipo "andamento": a pessoa pergunta quantos videos ja foram estudados, como esta o estudo, o que falta.\n' +
    '- termos: de 2 a 6 termos de UMA ou DUAS palavras cada, em portugues, do jeito que alguem falaria num video (o assunto pedido, sinonimos e palavras-chave; ex.: para "protecao contra energias negativas" use "protecao", "energia negativa", "obsessor", "defesa energetica"). Use a conversa anterior para entender pedidos como "e sobre isso nas lives?".\n' +
    '- ordem: "recentes" se a pessoa pedir os mais novos/recentes/ultimos; senao "relevancia".\n' +
    '- tipo "fora" so se o pedido nao tiver nada a ver com procurar assuntos nos videos.\n' +
    'Temas que ja existem na base (use quando servir): ' + temas.join('; ') + '\n\nCONVERSA ANTERIOR:\n' + (conversa || '(nenhuma)') + '\n\nPEDIDO: ' + pedido, true));
} catch (e) { return { ok: false, erro: 'Não consegui entender o pedido agora. Tente de novo em instantes.' }; }

if (plano.tipo === 'andamento') {
  const linhas = ((await sql('estudoAndamento', {})).rows || []);
  const txt = linhas.map(c => { const sem = Number(c.SEM_LEGENDA || 0), comLeg = Number(c.FILA || 0) - sem; return c.NOME + ': ' + Number(c.ESTUDADOS || 0) + ' vídeos estudados, ' + comLeg + ' com legenda na fila' + (sem ? ', ' + sem + ' sem legenda aguardando' : '') + (Number(c.PENDENTES || 0) ? ', ' + c.PENDENTES + ' pendentes (tentados de novo na próxima checagem)' : '') + '.' + (comLeg === 0 && sem ? ' Todos os vídeos com legenda já foram estudados.' : ''); }).join('\n');
  return { ok: true, resposta: (txt || 'Nenhum canal cadastrado ainda.') + '\n\nPara estudar mais, peça por exemplo: "estude mais 100 vídeos".', videos: [], termos: [] };
}
if (plano.tipo === 'estudar') {
  const quantidade = Math.min(2000, Math.max(1, Math.floor(Number(plano.quantidade) || 50)));
  const canaisLista = ((await sql('canaisNomes', {})).rows || []);
  const canal = canaisLista.find(c => Number(c.ID) === (Number(plano.canalId) || Number(event.canalId || 0)));
  if (!canaisLista.length) return { ok: true, resposta: 'Ainda não há canal cadastrado. Cadastre um na tela Canais.', videos: [], termos: [] };
  const onde = canal ? 'do canal ' + canal.NOME : (canaisLista.length === 1 ? 'do canal ' + canaisLista[0].NOME : 'de cada canal');
  return { ok: true, resposta: 'Posso colocar mais ' + quantidade + ' vídeos ' + onde + ' na fila de estudo, seguindo dos mais recentes para os mais antigos que ainda não foram estudados. Isso usa a cota do Gemini da sua chave. Confirma?', videos: [], termos: [],
    acao: { tipo: 'estudar', quantidade, canalId: canal ? Number(canal.ID) : 0, rotulo: 'Estudar mais ' + quantidade + ' vídeos' } };
}
if (plano.tipo === 'fora') return { ok: true, resposta: 'Eu busco assuntos dentro dos vídeos dos canais cadastrados. Diga um tema ou uma pergunta, por exemplo: "o que ele fala sobre chakra coronário?" ou "lives mais recentes sobre mantras".', videos: [], termos: [] };
const termos = [...new Set((plano.termos || []).map(t => String(t).trim().toLowerCase()).filter(t => t.length >= 3))].slice(0, 5);
if (!termos.length) return { ok: true, resposta: 'Não entendi qual assunto buscar. Pode dizer o tema com outras palavras?', videos: [], termos: [] };
const ordem = plano.ordem === 'recentes' ? 'recentes' : 'relevancia';
const canalBusca = Math.floor(Number(event.canalId || 0)) || Math.floor(Number(plano.canalId || 0)) || 0;

const vids = {}; const trechos = []; const resumos = {};
for (const tema of termos) {
  for (const v of ((await sql('buscarTema', { tema, ordem: 'relevancia', limit: 30, offset: 0, canalId: canalBusca })).rows || [])) {
    if (plano.somenteLives && v.TIPO !== 'LIVE') continue;
    const a = vids[v.ID] || (vids[v.ID] = Object.assign({}, v, { SCORE: 0, MOMS: '' }));
    a.SCORE += Number(v.SCORE || 0); a.MOMS = [a.MOMS, v.MOMS].filter(Boolean).join(',');
  }
  for (const t of ((await sql('buscaTrechos', { tema, canalId: canalBusca })).rows || []).slice(0, 25)) trechos.push(t);
  for (const r of ((await sql('buscaResumos', { tema, canalId: canalBusca })).rows || [])) resumos[r.TITULO] = r.RESUMO;
}
let lista = Object.values(vids);
lista.sort((a, b) => ordem === 'recentes' ? String(b.PUBLICADO_EM || '').localeCompare(String(a.PUBLICADO_EM || '')) || b.SCORE - a.SCORE : b.SCORE - a.SCORE || String(b.PUBLICADO_EM || '').localeCompare(String(a.PUBLICADO_EM || '')));
lista = lista.slice(0, 15);
const titulos = new Set(lista.map(v => v.TITULO));
if (!lista.length) return { ok: true, vazio: true, resposta: 'Nenhum vídeo da base trata disso' + (plano.somenteLives ? ' nas lives' : '') + (canalBusca ? ' neste canal' : '') + '. Procurei por: ' + termos.join(', ') + '.', videos: [], termos, ordem };

const vistos = new Set();
const material = Object.keys(resumos).filter(t => titulos.has(t)).map(t => 'RESUMO DO VIDEO "' + t + '": ' + resumos[t]).join('\n\n') + '\n\n' +
  trechos.filter(t => titulos.has(t.TITULO)).filter(t => { const k = t.TITULO + t.SEGUNDO; if (vistos.has(k)) return false; vistos.add(k); return true; })
    .slice(0, 80).map(t => '[' + t.TITULO + ' | ' + mmss(t.SEGUNDO) + '] ' + t.TEXTO).join('\n');
let resposta;
try {
  resposta = await gemini(
    'Responda ao pedido da pessoa em portugues usando SOMENTE o material abaixo, tirado das transcricoes dos videos da base dela. ' +
    'Nao use conhecimento de fora. Cite o titulo do video e o minuto de onde tirou cada ponto, copiando o tempo como aparece no material (ex.: 1:45:04). Seja direto: de 1 a 4 paragrafos curtos, sem markdown. ' +
    'Se o material nao responder ao pedido, diga isso claramente e nao invente.\n\nCONVERSA ANTERIOR:\n' + (conversa || '(nenhuma)') + '\n\nPEDIDO: ' + pedido + '\n\nMATERIAL:\n' + material.slice(0, 150000), false);
} catch (e) { resposta = 'Encontrei os vídeos abaixo, mas não consegui montar o resumo agora.'; }
return { ok: true, resposta: resposta.replace(/\*\*?/g, ''), videos: lista, termos, ordem };
