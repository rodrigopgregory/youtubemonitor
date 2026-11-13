const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const T0 = Date.now();
const SF = __SF__;
if (typeof URL === 'undefined') { global.URL = require('url').URL; }
const agora = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19);
const WEB = { clientName: 'WEB', clientVersion: '2.20251101.00.00', hl: 'pt', gl: 'BR' };
const ANDROID = { clientName: 'ANDROID', clientVersion: '20.10.38', hl: 'pt', gl: 'BR' };

async function sql(nome, input) {
  const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF[nome], input: input || {} });
  const res = r.result || r;
  if (res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res.error).slice(0, 300));
  let o = res.output; if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) {} }
  return o;
}
async function yt(ep, body, client) {
  const r = await m.callIntegrationMitra({ projectId: pid, connection: 'youtube-web', method: 'POST', endpoint: '/youtubei/v1/' + ep, body: Object.assign({ context: { client } }, body) });
  const st = r.result ? r.result.statusCode : r.statusCode;
  const b = r.result ? r.result.body : r.body;
  if (st && st >= 400) throw new Error('YouTube respondeu ' + st);
  return b;
}
async function lote(chave, lista) {
  await sql('loteApagar', { chave });
  await sql('loteGravar', { chave, json: JSON.stringify(lista) });
}
function parseDur(t) {
  if (!t || !/^\d+(:\d+){1,2}$/.test(t)) return null;
  return t.split(':').map(Number).reduce((a, b) => a * 60 + b, 0);
}
function lockups(o, acc) {
  if (!o || typeof o !== 'object') return acc;
  if (o.lockupViewModel) { acc.push(o.lockupViewModel); return acc; }
  for (const k in o) lockups(o[k], acc);
  return acc;
}
function contToken(o) {
  let t = null;
  const w = x => { if (!x || typeof x !== 'object' || t) return; if (x.continuationCommand && x.continuationCommand.token) t = x.continuationCommand.token; for (const k in x) w(x[k]); };
  w(o); return t;
}
function itemInfo(it) {
  const badges = [];
  const g = o => { if (!o || typeof o !== 'object') return; if (o.thumbnailBadgeViewModel) badges.push(o.thumbnailBadgeViewModel.text || ''); for (const k in o) g(o[k]); };
  g(it.contentImage);
  const meta = it.metadata && it.metadata.lockupMetadataViewModel;
  const rows = ((meta && meta.metadata && meta.metadata.contentMetadataViewModel && meta.metadata.contentMetadataViewModel.metadataRows) || [])
    .map(r => (r.metadataParts || []).map(p => p.text && p.text.content).join(' ')).join(' ');
  let dur = null; for (const b of badges) { const d = parseDur(b); if (d) dur = d; }
  return { yt: it.contentId, titulo: (meta && meta.title && meta.title.content) || '', dur, live: /transmitido/i.test(rows) };
}

async function listarPagina(canal, token) {
  return token ? yt('browse', { continuation: token }, WEB) : yt('browse', { browseId: 'VL' + canal.UPLOADS_PLAYLIST }, WEB);
}

async function cargaHistorica(canal, cfg, log) {
  const limite = Number(canal.LIMITE || cfg.LIMITE_CARGA || 0);
  let token = canal.CARGA_TOKEN || null;
  let pos = Number(canal.POS_BASE || 0);
  let total = Number(canal.ELEGIVEIS || 0);
  while (Date.now() - T0 < 150e3) {
    const b = await listarPagina(canal, token);
    const itens = lockups(b, []).map(itemInfo);
    let novos = itens.filter(x => x.dur && x.dur > Number(cfg.DURACAO_MIN_SEG || 600))
      .map(x => ({ yt: x.yt, titulo: x.titulo, dur: x.dur, tipo: x.live ? 'LIVE' : 'VIDEO', pos: 0, thumb: 'https://i.ytimg.com/vi/' + x.yt + '/hqdefault.jpg' }));
    if (limite > 0) novos = novos.slice(0, Math.max(0, limite - total));
    novos.forEach(x => { x.pos = --pos; });
    if (novos.length) {
      const chave = 'V:' + canal.ID;
      await lote(chave, novos);
      await sql('videosInserirLote', { chave, canalId: canal.ID, descoberta: 'HISTORICO' });
      await sql('loteApagar', { chave });
      total += novos.length;
    }
    token = contToken(b);
    const fim = !token || (limite > 0 && total >= limite);
    await sql('canalCargaAtualizar', { id: canal.ID, status: fim ? 'ESTUDANDO' : 'LISTANDO', token: fim ? '' : token, posBase: pos, msg: total + ' vídeos com mais de 10 minutos encontrados' });
    log.push('listou ' + itens.length + ' itens, ' + novos.length + ' elegíveis');
    if (fim) return true;
  }
  return false;
}

async function checagemDiaria(canal, cfg, log) {
  const conhecidos = new Set(((await sql('videosIdsCanal', { canalId: canal.ID })).rows || []).map(r => r.YT_VIDEO_ID));
  let token = null; const novos = [];
  for (let p = 0; p < 5; p++) {
    const b = await listarPagina(canal, token);
    const itens = lockups(b, []).map(itemInfo);
    let achouConhecido = false;
    for (const x of itens) {
      if (conhecidos.has(x.yt)) { achouConhecido = true; break; }
      if (x.dur && x.dur > Number(cfg.DURACAO_MIN_SEG || 600)) novos.push({ yt: x.yt, titulo: x.titulo, dur: x.dur, tipo: x.live ? 'LIVE' : 'VIDEO', pos: 0, thumb: 'https://i.ytimg.com/vi/' + x.yt + '/hqdefault.jpg' });
    }
    token = contToken(b);
    if (achouConhecido || !token) break;
  }
  if (novos.length) {
    const chave = 'D:' + canal.ID;
    await lote(chave, novos);
    await sql('videosInserirLote', { chave, canalId: canal.ID, descoberta: 'DIARIA' });
    await sql('loteApagar', { chave });
  }
  await sql('canalChecado', { id: canal.ID, quando: agora() });
  log.push('checagem ' + canal.NOME + ': ' + novos.length + ' novos');
}

function playlistsDe(o, acc) {
  if (!o || typeof o !== 'object') return acc;
  if (o.lockupViewModel) {
    const l = o.lockupViewModel;
    if (l.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST' && l.contentId) {
      const n = (JSON.stringify(l.contentImage || {}).match(/"text":"([^"]*)"/) || [])[1] || '';
      const qtd = /^um /i.test(n) ? 1 : Number((n.replace(/\./g, '').match(/\d+/) || [0])[0]);
      acc.push({ id: l.contentId, titulo: (((l.metadata || {}).lockupMetadataViewModel || {}).title || {}).content || '', qtd });
    }
    return acc;
  }
  for (const k in o) playlistsDe(o[k], acc);
  return acc;
}
function videosDaPlaylist(o, acc) {
  if (!o || typeof o !== 'object') return acc;
  if (o.playlistVideoRenderer) { if (o.playlistVideoRenderer.videoId) acc.push(o.playlistVideoRenderer.videoId); return acc; }
  if (o.lockupViewModel) { const l = o.lockupViewModel; if (l.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' && l.contentId) acc.push(l.contentId); return acc; }
  for (const k in o) videosDaPlaylist(o[k], acc);
  return acc;
}
async function sincronizarPlaylists(canal, dia, log) {
  const lista = []; const vistos = new Set();
  let b = await yt('browse', { browseId: canal.YT_CHANNEL_ID, params: 'EglwbGF5bGlzdHPyBgQKAkIA' }, WEB);
  for (let p = 0; p < 30 && b; p++) {
    for (const x of playlistsDe(b, [])) if (!vistos.has(x.id) && !/^(UU|LL|WL)/.test(x.id)) { vistos.add(x.id); x.ordem = lista.length; lista.push(x); }
    const t = contToken(b); if (!t) break;
    b = await yt('browse', { continuation: t }, WEB);
  }
  const chave = 'P:' + canal.ID;
  if (lista.length) { await lote(chave, lista); await sql('playlistsGravar', { chave, canalId: canal.ID, sinc: dia }); await sql('loteApagar', { chave }); }
  const todos = [];
  for (const pl of lista) {
    if (Date.now() - T0 > 170e3) { log.push('playlists ' + canal.NOME + ': parou no meio, continua na próxima rodada'); return false; }
    const ja = new Set();
    let pb = await yt('browse', { browseId: 'VL' + pl.id }, WEB);
    for (let p = 0; p < 40 && pb; p++) {
      for (const id of videosDaPlaylist(pb, [])) if (!ja.has(id)) { ja.add(id); todos.push({ pid: pl.id, yt: id, pos: ja.size - 1 }); }
      const t = contToken(pb); if (!t) break;
      pb = await yt('browse', { continuation: t }, WEB);
    }
  }
  await sql('playlistVideosLimpar', { canalId: canal.ID });
  const ck = 'PV:' + canal.ID;
  for (let i = 0; i < todos.length; i += 2000) {
    await lote(ck, todos.slice(i, i + 2000));
    await sql('playlistVideosGravar', { chave: ck });
  }
  if (todos.length) await sql('loteApagar', { chave: ck });
  const nv = todos.length;
  await sql('playlistsSumidasVideos', { canalId: canal.ID, sinc: dia });
  await sql('playlistsSumidas', { canalId: canal.ID, sinc: dia });
  await sql('canalPlaylistsFeito', { id: canal.ID, dia });
  log.push('playlists ' + canal.NOME + ': ' + lista.length + ' playlists, ' + nv + ' vídeos');
  return true;
}

function agruparLegenda(j3) {
  const out = []; let cur = null;
  for (const ev of (j3.events || [])) {
    if (!ev.segs) continue;
    const txt = ev.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
    if (!txt) continue;
    const s = Math.floor((ev.tStartMs || 0) / 1000);
    if (!cur || s - cur.s >= 30) { cur = { s, t: txt }; out.push(cur); }
    else cur.t += ' ' + txt;
  }
  return out;
}

const ESGOTADO = new Set();
async function gemini(cfg, modelos, body) {
  let ultimo = '';
  const conexoes = String(cfg.GEMINI_CONEXOES || 'gemini').split(',').map(x => x.trim()).filter(Boolean);
  for (const conexao of conexoes) {
    for (const modelo of String(modelos).split(',').map(x => x.trim()).filter(Boolean)) {
      const k = conexao + '|' + modelo;
      if (ESGOTADO.has(k)) continue;
      try {
        const r = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body });
        const st = r.result ? r.result.statusCode : r.statusCode;
        const b = (r.result ? r.result.body : r.body) || {};
        if ((st && st >= 400) || b.error) {
          if (st === 429 || (b.error && b.error.code === 429)) ESGOTADO.add(k);
          ultimo = 'Gemini (' + modelo + '): ' + String((b.error && b.error.message) || st).slice(0, 200); continue;
        }
        const parts = (((b.candidates || [])[0] || {}).content || {}).parts || [];
        const txt = parts.map(p => p.text || '').join('');
        if (txt) return txt;
        ultimo = 'Gemini (' + modelo + ') respondeu vazio';
      } catch (e) { ultimo = 'Gemini (' + modelo + '): ' + String(e.message || e).slice(0, 200); }
    }
  }
  throw new Error(ultimo || 'Gemini sem resposta');
}
function jsonDe(txt) {
  const a = txt.indexOf('{');
  try { return JSON.parse(txt.slice(a, txt.lastIndexOf('}') + 1)); } catch (e) {
    let prof = 0, aspas = false, esc = false;
    for (let i = a; i < txt.length; i++) {
      const ch = txt[i];
      if (aspas) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') aspas = false; continue; }
      if (ch === '"') aspas = true; else if (ch === '{') prof++; else if (ch === '}' && --prof === 0) return JSON.parse(txt.slice(a, i + 1));
    }
    throw e;
  }
}
function mmss(s) { const h = Math.floor(s / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60; return (h ? h + ':' + String(mi).padStart(2, '0') : mi) + ':' + String(se).padStart(2, '0'); }

async function transcreverAudio(cfg, v) {
  const passo = Number(cfg.BLOCO_SEG || 900);
  let ini = Number(v.PROGRESSO_SEG || 0);
  while (ini < v.DURACAO_SEG) {
    if (Date.now() - T0 > Number(cfg.ORCAMENTO_SEG || 230) * 1000) return false;
    const fim = Math.min(v.DURACAO_SEG, ini + passo);
    const txt = await gemini(cfg, cfg.MODELO_TRANSCRICAO, {
      contents: [{ parts: [
        { fileData: { fileUri: 'https://www.youtube.com/watch?v=' + v.YT_VIDEO_ID } , videoMetadata: { startOffset: ini + 's', endOffset: fim + 's' } },
        { text: 'Transcreva em portugues tudo o que e falado neste trecho do video. Responda so JSON: {"trechos":[{"s":<segundo do inicio no video inteiro>,"t":"texto"}]} com um item a cada 20 a 40 segundos. Nao resuma, nao invente.' }
      ] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 }
    });
    const tr = (jsonDe(txt).trechos || []).map(x => ({ s: Math.max(ini, Math.min(fim, Math.round(Number(x.s) || ini))), t: String(x.t || '').slice(0, 4000) })).filter(x => x.t);
    const porSeg = {}; tr.forEach(x => { porSeg[x.s] = porSeg[x.s] ? porSeg[x.s] + ' ' + x.t : x.t; });
    tr.length = 0; Object.keys(porSeg).forEach(k => tr.push({ s: Number(k), t: porSeg[k] }));
    for (let i = 0; i < tr.length; i += 150) {
      const chave = 'T:' + v.ID; await lote(chave, tr.slice(i, i + 150)); await sql('trechosInserirLote', { chave, videoId: v.ID }); await sql('loteApagar', { chave });
    }
    ini = fim;
    await sql('videoProgresso', { id: v.ID, seg: ini });
  }
  return true;
}

const TIPOS_PRATICA = ['meditação', 'visualização', 'respiração', 'prece e oração', 'mantra e decreto', 'banho de ervas', 'velas', 'defumação', 'chás e ervas', 'água, sal e cristais', 'limpeza e proteção energética', 'projeção astral', 'chakras e exercício energético', 'ritual e oferenda', 'outra prática'];
const PROMPT_PRATICAS = 'Em "praticas" liste TODA instrucao de algo para a pessoa FAZER que aparece na fala: meditacao, visualizacao, exercicio de respiracao, prece ou oracao, mantra ou decreto, banho de ervas, uso de velas, defumacao, cha, agua, sal ou cristais, limpeza ou protecao energetica, tecnica de projecao astral, exercicio com chakras, ritual ou oferenda, ou qualquer outro trabalho espiritual ensinado. So o que e ensinado ou recomendado para fazer, nao o que e so comentado. Para cada uma: "tipo" (escolha SO desta lista, copiando o nome: ' + TIPOS_PRATICA.join('; ') + '), "titulo" (nome curto da pratica, ex.: "banho de arruda e guine para descarrego"), "instrucao" (o passo a passo como foi ensinado: ingredientes, quantidades, horario, o que falar ou mentalizar; ate 8 frases) e "momento" ("mm:ss" do trecho em que comeca). Lista vazia se o video nao ensina nenhuma pratica.\n';

function limparPraticas(lista, dur) {
  const seg = t => { const p = String(t || '').split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0); };
  const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const mapa = new Map(TIPOS_PRATICA.map(t => [norm(t), t]));
  return (Array.isArray(lista) ? lista : []).filter(p => p && (p.titulo || p.instrucao)).slice(0, 15).map(p => {
    const s = seg(p.momento);
    return { tipo: mapa.get(norm(p.tipo)) || 'outra prática', titulo: String(p.titulo || '').trim().slice(0, 290), instrucao: String(p.instrucao || '').trim().slice(0, 3900), seg: s >= 0 && s <= Number(dur || 1e9) ? s : 0 };
  });
}

async function gravarPraticas(v, lista) {
  const chave = 'P:' + v.ID;
  await sql('praticasLimpar', { videoId: v.ID });
  if (lista.length) { await lote(chave, lista); await sql('praticasGravar', { chave, videoId: v.ID }); await sql('loteApagar', { chave }); }
  await sql('videoPraticasFeito', { id: v.ID, quando: agora() });
}

async function lerPraticas(cfg, v) {
  const tr = ((await sql('trechosDoVideo', { videoId: v.ID, limit: 2000, offset: 0 })).rows || []);
  if (!tr.length) { await gravarPraticas(v, []); return 0; }
  const texto = tr.map(x => '[' + mmss(x.SEGUNDO) + '] ' + x.TEXTO).join('\n').slice(0, 600000);
  const txt = await gemini(cfg, cfg.MODELO_ANALISE, {
    contents: [{ parts: [{ text: 'Voce organiza uma base de estudo sobre espiritualidade. Abaixo esta a transcricao do video "' + v.TITULO + '" com o tempo de cada trecho.\nResponda so JSON: {"praticas":[{"tipo":"...","titulo":"...","instrucao":"...","momento":"mm:ss"}]}\n' + PROMPT_PRATICAS + 'Use so a transcricao.\n\nTRANSCRICAO:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
  });
  const lista = limparPraticas(jsonDe(txt).praticas, v.DURACAO_SEG);
  await gravarPraticas(v, lista);
  return lista.length;
}

const NAO_MENTOR = new Set(['shirlene', 'monicademedeiros', 'monica', 'maemaria', 'jesus', 'mariamadalena', 'chicoxavier', 'kardec', 'allankardec', 'emmanuel']);

async function analisar(cfg, v) {
  const tr = ((await sql('trechosDoVideo', { videoId: v.ID, limit: 2000, offset: 0 })).rows || []);
  const texto = tr.map(x => '[' + mmss(x.SEGUNDO) + '] ' + x.TEXTO).join('\n').slice(0, 600000);
  const temasExist = ((await sql('temasNomes', {})).rows || []).map(r => r.NOME);
  const txt = await gemini(cfg, cfg.MODELO_ANALISE, {
    contents: [{ parts: [{ text:
      'Voce organiza uma base de estudo sobre espiritualidade. Abaixo esta a transcricao do video "' + v.TITULO + '" com o tempo de cada trecho.\n' +
      'Responda so JSON: {"resumo":"resumo em portugues de 5 a 10 frases, so com o que foi falado","temas":[{"nome":"tema curto em minusculas","momentos":["mm:ss",...]}],"mentores":[{"nome":"nome do mentor","momentos":["mm:ss",...]}],"praticas":[{"tipo":"...","titulo":"...","instrucao":"...","momento":"mm:ss"}]}\n' + PROMPT_PRATICAS +
      (Number(v.TEM_MENTOR) ? 'Em "mentores" ponha SO o mentor (guia ou espirito) que conduz a live: quem se manifesta e fala pela medium. Normalmente o nome dele esta no titulo do video ("' + v.TITULO + '") ou e anunciado no comeco. Ex.: Veludo, Tupã, Pai Joaquim, Dr. Espanhol. So vale nome que aparece escrito no titulo ou falado na transcricao. A medium e pessoas vivas (ex.: Monica de Medeiros, Shirlene) NAO sao mentores, e Mae Maria tambem nao entra. Nomes que so sao citados ou comentados (ex.: Maria Madalena, Jesus, Chico Xavier, Emmanuel, Kardec) NAO sao mentores: se forem assunto importante, entram em "temas". Em geral ha 0 ou 1 mentor, no maximo 3; lista vazia se ninguem conduz como mentor. Se for um destes mentores ja usados, use a mesma grafia: ' + temasExist.filter(n => n.startsWith('mentor: ')).map(n => n.slice(8)).join('; ') + '\n' : 'Deixe "mentores" sempre como lista vazia.\n') +
      'De 2 a 6 temas, escolhidos SO desta lista de categorias (copie o nome exatamente como esta): ' + temasExist.filter(n => !n.startsWith('mentor: ')).slice(0, 300).join('; ') + '\n' +
      'Os momentos sao os tempos dos trechos em que o tema aparece (ate 6 por tema). Use so a transcricao.\n\nTRANSCRICAO:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
  });
  const j = jsonDe(txt);
  const seg = t => { const p = String(t).split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };
  const temas = (j.temas || []).filter(t => t && t.nome).slice(0, 10).map(t => ({ nome: String(t.nome).trim().toLowerCase().slice(0, 150), momentos: (t.momentos || []).map(seg).filter(n => n >= 0 && n <= Number(v.DURACAO_SEG || 1e9)).slice(0, 6).join(',') }));
  const sem0 = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cats = new Map(temasExist.filter(n => !n.startsWith('mentor: ')).map(n => [sem0(n), n]));
  if (cats.size) {
    const vistas = new Set();
    for (let i = temas.length - 1; i >= 0; i--) {
      const certo = cats.get(sem0(temas[i].nome));
      if (!certo || vistas.has(certo)) temas.splice(i, 1); else { temas[i].nome = certo; vistas.add(certo); }
    }
  }
  const nomes = new Set(temas.map(t => t.nome));
  const ALIAS = { 'tupan': 'tupã', 'shell y ann': 'shellyana', 'shelly ann': 'shellyana', 'shellyann': 'shellyana', 'shelly ana': 'shellyana', 'shel': 'shellyana', 'sheli': 'shellyana', 'shelly': 'shellyana', 'sheelian': 'shellyana', 'sheliane': 'shellyana', 'shellyanna': 'shellyana', 'sheliana': 'shellyana', 'shelyana': 'shellyana', 'tranqueira': 'tronqueira', 'dr espanhol': 'dr. espanhol', 'doutor espanhol': 'dr. espanhol' };
  for (const mt of (Number(v.TEM_MENTOR) ? (j.mentores || []) : []).filter(x => x && x.nome).slice(0, 3)) {
    const base = String(mt.nome).trim().toLowerCase().replace(/\s+/g, ' ');
    const sem = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const onde = sem(v.TITULO + ' ' + texto);
    const formas = [base, ALIAS[base] || base, ...Object.keys(ALIAS).filter(k => ALIAS[k] === (ALIAS[base] || base))].map(sem).filter(f => f.length >= 3);
    if (!formas.some(f => onde.includes(f))) continue;
    if (NAO_MENTOR.has(sem(ALIAS[base] || base))) continue;
    const nome = ('mentor: ' + (ALIAS[base] || base)).slice(0, 150);
    if (nomes.has(nome)) continue; nomes.add(nome);
    temas.push({ nome, momentos: (mt.momentos || []).map(seg).filter(n => n >= 0 && n <= Number(v.DURACAO_SEG || 1e9)).slice(0, 6).join(',') });
  }
  const chave = 'M:' + v.ID;
  await lote(chave, temas);
  await sql('temasGarantirLote', { chave });
  await sql('videoTemasIALimpar', { videoId: v.ID });
  await sql('videoTemasIA', { chave, videoId: v.ID });
  await sql('loteApagar', { chave });
  await sql('videoConcluir', { id: v.ID, resumo: String(j.resumo || '').slice(0, 20000), quando: agora() });
  await gravarPraticas(v, limparPraticas(j.praticas, v.DURACAO_SEG));
}

async function estudar(cfg, v, log) {
  try {
    const p = await yt('player', { videoId: v.YT_VIDEO_ID }, ANDROID);
    const pw = await yt('player', { videoId: v.YT_VIDEO_ID }, WEB);
    const st = p && p.playabilityStatus && p.playabilityStatus.status;
    const mf = pw && pw.microformat && pw.microformat.playerMicroformatRenderer;
    const vd = (p && p.videoDetails) || {};
    if (vd.isLive || vd.isUpcoming || (mf && mf.liveBroadcastDetails && mf.liveBroadcastDetails.isLiveNow)) {
      await sql('videoPendente', { id: v.ID, motivo: 'A live ainda não terminou; será estudada depois de ficar gravada.' });
      return;
    }
    if (st === 'ERROR' || st === 'LOGIN_REQUIRED') { await sql('videoIndisponivel', { id: v.ID }); await sql('videoPendente', { id: v.ID, motivo: 'Vídeo indisponível no YouTube (removido ou privado).' }); return; }
    const pub = mf && (mf.publishDate || mf.uploadDate);
    const dur = Number(vd.lengthSeconds || v.DURACAO_SEG || 0);
    await sql('videoDetalhes', { id: v.ID, publicado: pub ? new Date(new Date(pub).getTime() - 3 * 3600e3).toISOString().slice(0, 19) : '', duracao: dur, tipo: vd.isLiveContent ? 'LIVE' : v.TIPO });
    if (dur <= Number(cfg.DURACAO_MIN_SEG || 600)) { await sql('videoForaDoFiltro', { id: v.ID }); return; }
    v.DURACAO_SEG = dur;
    const completo = v.ORIGEM === 'YOUTUBE' || (v.ORIGEM === 'AUDIO' && Number(v.PROGRESSO_SEG || 0) >= dur);
    if (!completo) {
      let ok = false;
      if (v.ORIGEM !== 'AUDIO') {
        const tracks = (((p.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || [];
        const tk = tracks.find(t => /^pt/.test(t.languageCode) && t.kind !== 'asr') || tracks.find(t => /^pt/.test(t.languageCode));
        if (tk) {
          const u = new URL(tk.baseUrl);
          const params = {}; u.searchParams.forEach((val, k) => { params[k] = val; }); params.fmt = 'json3';
          const c = await m.callIntegrationMitra({ projectId: pid, connection: 'youtube-web', method: 'GET', endpoint: u.pathname, params });
          const cb = c.result ? c.result.body : c.body;
          const tr = cb && cb.events ? agruparLegenda(cb) : [];
          if (tr.length) {
            for (let i = 0; i < tr.length; i += 150) {
              const chave = 'T:' + v.ID; await lote(chave, tr.slice(i, i + 150)); await sql('trechosInserirLote', { chave, videoId: v.ID }); await sql('loteApagar', { chave });
            }
            await sql('videoOrigem', { id: v.ID, origem: 'YOUTUBE' });
            ok = true;
          }
        }
      }
      if (!ok) {
        if (!cfg.GEMINI_OK) { await sql('videoPendente', { id: v.ID, motivo: 'Sem legenda no YouTube e a transcrição pelo áudio ainda não está ligada.' }); return; }
        if (v.ORIGEM === 'AUDIO' && cfg.AUDIO_LIGADO !== '1') return;
        if (v.ORIGEM !== 'AUDIO') {
          await sql('videoOrigem', { id: v.ID, origem: 'AUDIO' }); v.PROGRESSO_SEG = 0;
          const comLegenda = Number((((await sql('filaComLegenda', {})).rows || [{}])[0] || {}).N || 0);
          if (cfg.AUDIO_LIGADO !== '1' || comLegenda > 0) { log.push(v.YT_VIDEO_ID + ': sem legenda, fica para o fim da fila'); return; }
        }
        const terminou = await transcreverAudio(cfg, v);
        if (!terminou) { log.push(v.YT_VIDEO_ID + ': transcrição pelo áudio continua na próxima rodada'); return; }
      }
    }
    if (!cfg.GEMINI_OK) { await sql('videoPendente', { id: v.ID, motivo: 'Transcrição pronta. Falta a chave do Gemini para gerar o resumo e os temas.' }); log.push(v.YT_VIDEO_ID + ': transcrito, aguardando IA'); return; }
    await analisar(cfg, v);
    log.push(v.YT_VIDEO_ID + ': estudado');
  } catch (e) {
    await sql('videoPendente', { id: v.ID, motivo: String(e.message || e).slice(0, 900) }).catch(() => {});
    log.push(v.YT_VIDEO_ID + ': erro ' + String(e.message || e).slice(0, 200));
  }
}

async function fecharAvisos(hoje) {
  const n = Number((((await sql('avisoPendentes', {})).rows || [{}])[0] || {}).N || 0);
  if (!n) return;
  let id = Number((((await sql('avisoHoje', { dia: hoje })).rows || [{}])[0] || {}).ID || 0);
  if (!id) { await sql('avisoCriar', { dia: hoje, quando: agora() }); id = Number((((await sql('avisoHoje', { dia: hoje })).rows || [{}])[0] || {}).ID || 0); }
  if (id) { await sql('avisoVincular', { id }); await sql('avisoRecontar', { id }); }
}

const log = [];
const ate = Date.now() + 300e3;
const trava = await sql('lockAdquirir', { ate: String(ate), agora: String(Date.now()) });
if (!trava || !trava.affectedRows) return { ocupado: true, msg: 'Outra rodada do motor já está trabalhando.' };
let resultado;
try {
  const cfg = {}; ((await sql('configLer', {})).rows || []).forEach(r => { cfg[r.CHAVE] = r.VALOR; });
  cfg.GEMINI_OK = cfg.GEMINI_OK === '1';
  const hojeBR = agora().slice(0, 10);
  const horaBR = Number(agora().slice(11, 13));
  const fazerDiaria = event.modo === 'diaria' || (horaBR >= Number(cfg.HORA_CHECAGEM || 6) && cfg.ULTIMA_CHECAGEM_DIA !== hojeBR);
  if (fazerDiaria) { await sql('videosRetentar', {}); await sql('configGravar', { chave: 'ULTIMA_CHECAGEM_DIA', valor: hojeBR }); }
  const canais = ((await sql('canaisParaMotor', {})).rows || []);
  for (const c of canais) {
    if (Date.now() - T0 > 150e3) break;
    try {
      if (c.CARGA_STATUS === 'LISTANDO') await cargaHistorica(c, cfg, log);
      else if (fazerDiaria) await checagemDiaria(c, cfg, log);
      if (c.CARGA_STATUS !== 'LISTANDO' && c.PLAYLISTS_EM !== hojeBR && Date.now() - T0 < 120e3) {
        try { await sincronizarPlaylists(c, hojeBR, log); } catch (e) { log.push('playlists ' + c.NOME + ': ' + String(e.message || e).slice(0, 200)); }
      }
    } catch (e) {
      log.push('canal ' + c.NOME + ': ' + String(e.message || e).slice(0, 200));
      await sql('canalCargaMsg', { id: c.ID, msg: ('Falha ao ler o canal no YouTube: ' + String(e.message || e)).slice(0, 480) }).catch(() => {});
    }
  }
  let estudados = 0; const vistos = new Set();
  while (Date.now() - T0 < Number(cfg.ORCAMENTO_SEG || 230) * 1000 - 60e3) {
    const fila = ((await sql('filaProximo', { canalId: Number(event.canalId || 0), audio: cfg.AUDIO_LIGADO === '1' ? 1 : 0 })).rows || []);
    if (!fila.length || vistos.has(fila[0].ID)) break;
    vistos.add(fila[0].ID);
    await estudar(cfg, fila[0], log);
    estudados++;
  }
  let praticasLidas = 0; const vistosP = new Set();
  if (cfg.GEMINI_OK && cfg.PRATICAS_LIGADO !== '0') {
    while (Date.now() - T0 < Number(cfg.ORCAMENTO_SEG || 230) * 1000 - 60e3) {
      const pf = ((await sql('praticasFila', {})).rows || []);
      if (!pf.length || vistosP.has(pf[0].ID)) break;
      vistosP.add(pf[0].ID);
      try { const n = await lerPraticas(cfg, pf[0]); praticasLidas++; log.push('praticas ' + pf[0].ID + ': ' + n); }
      catch (e) { log.push('praticas ' + pf[0].ID + ': erro ' + String(e.message || e).slice(0, 150)); break; }
    }
  }
  await fecharAvisos(hojeBR);
  await sql('canaisAtualizarStatus', {});
  const resta = Number((((await sql('filaContar', {})).rows || [{}])[0] || {}).N || 0);
  const restaPraticas = Number((((await sql('praticasResumo', {})).rows || [{}])[0] || {}).N || 0) - Number((((await sql('praticasResumo', {})).rows || [{}])[0] || {}).LIDOS || 0);
  resultado = { estudados, praticasLidas, resta, restaPraticas, log, ms: Date.now() - T0 };
} finally {
  await sql('lockLiberar', { ate: String(ate) }).catch(() => {});
}
if ((resultado.resta > 0 && resultado.estudados > 0 || resultado.restaPraticas > 0 && resultado.praticasLidas > 0) && !event.semContinuar && Number(event.rodada || 0) < 400) {
  await m.executeServerFunctionAsyncMitra({ projectId: pid, serverFunctionId: SF.motor, input: { modo: 'continuar', rodada: Number(event.rodada || 0) + 1 } });
}
return resultado;
