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
function certezaNome(nomeOuvido, autorOuvido, titulo, autor) {
  const sem = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const parada = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'um', 'uma', 'em', 'no', 'na', 'the', 'of', 'livro', 'livros']);
  const toks = t => sem(t).split(' ').filter(w => w && !parada.has(w));
  const nomes = t => sem(t).split(' ').filter(w => w.length >= 4);
  const bigramas = t => { const x = ' ' + sem(t) + ' '; const mp = new Map(); for (let i = 0; i < x.length - 1; i++) { const b = x.slice(i, i + 2); mp.set(b, (mp.get(b) || 0) + 1); } return mp; };
  const a = bigramas(nomeOuvido), b = bigramas(titulo); let comum = 0, ta = 0, tb = 0;
  for (const v of a.values()) ta += v;
  for (const v of b.values()) tb += v;
  for (const [k, v] of a) comum += Math.min(v, b.get(k) || 0);
  let simil = ta + tb ? (2 * comum) / (ta + tb) : 0;
  const t1 = toks(nomeOuvido), t2 = toks(titulo);
  if (t1.length && t2.length) {
    const par = t1.length <= t2.length ? [t1, t2] : [t2, t1];
    if (par[0].every(w => par[1].includes(w))) simil = Math.max(simil, par[0].length >= 2 || t1.length === t2.length ? 0.95 : 0.85);
  }
  const ouvido = nomes(autorOuvido); const cat = new Set(nomes(autor));
  const aut = !ouvido.length ? 0.5 : ouvido.some(w => cat.has(w)) ? 1 : 0;
  return Math.round(100 * (0.6 * simil + 0.4 * aut));
}
async function gravarCerteza(lista) {
  for (const x of lista) {
    if (!x.titulo || /['"\\]/.test(x.nome)) continue;
    try { const c = certezaNome(x.nome, x.autorOuvido, x.titulo, x.autor); await sql('nomesCertezaGravar', { nome: x.nome, certeza: x.verif ? c : Math.min(c, 94) }); } catch (e) {}
  }
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
  return novos.length;
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

let BUSCA_FALHOU = false;
const ESGOTADO = new Set();
let IA_RESPONDEU = false, IA_SEM_COTA = false;
const ESPEROU = new Set();
async function gemini(cfg, modelos, body, prioritarias) {
  let ultimo = '';
  const lista = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const conexoes = Array.from(new Set(lista(prioritarias).concat(lista(cfg.GEMINI_CONEXOES || 'gemini'))));
  for (const conexao of conexoes) {
    for (const modelo of String(modelos).split(',').map(x => x.trim()).filter(Boolean)) {
      const k = conexao + '|' + modelo;
      if (ESGOTADO.has(k)) continue;
      try {
        const r = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body });
        const st = r.result ? r.result.statusCode : r.statusCode;
        const b = (r.result ? r.result.body : r.body) || {};
        if ((st && st >= 400) || b.error) {
          if (st === 429 || (b.error && b.error.code === 429)) {
            const msg = JSON.stringify(b).slice(0, 3000);
            const porDia = /per day|PerDay/i.test(msg);
            const espera = Number((msg.match(/retry in ([\d.]+)s/) || [])[1] || 0);
            if (!porDia && espera > 0 && espera <= 40 && !ESPEROU.has(k)) {
              ESPEROU.add(k);
              await new Promise(res => setTimeout(res, (espera + 1) * 1000));
              const r2 = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body });
              const st2 = r2.result ? r2.result.statusCode : r2.statusCode;
              const b2 = (r2.result ? r2.result.body : r2.body) || {};
              if (!((st2 && st2 >= 400) || b2.error)) {
                ESPEROU.delete(k);
                const txt2 = ((((b2.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
                if (txt2) { IA_RESPONDEU = true; return txt2; }
              }
            }
            if (porDia) ESGOTADO.add(k);
          }
          ultimo = 'Gemini (' + modelo + '): ' + String((b.error && b.error.message) || st).slice(0, 200); continue;
        }
        const parts = (((b.candidates || [])[0] || {}).content || {}).parts || [];
        const txt = parts.map(p => p.text || '').join('');
        if (txt) { IA_RESPONDEU = true; return txt; }
        const porque = (b.promptFeedback && b.promptFeedback.blockReason) || (((b.candidates || [])[0] || {}).finishReason) || '';
        ultimo = 'Gemini (' + modelo + ') respondeu vazio' + (porque ? ' (' + porque + ')' : '');
      } catch (e) { ultimo = 'Gemini (' + modelo + '): ' + String(e.message || e).slice(0, 200); }
    }
  }
  if (ESGOTADO.size) IA_SEM_COTA = true;
  throw new Error(ultimo || 'Gemini sem resposta');
}
function jsonDe(txt) {
  const a = txt.indexOf('{');
  try { return JSON.parse(txt.slice(a, txt.lastIndexOf('}') + 1)); } catch (e0) {
  try { return JSON.parse(txt.slice(a, txt.lastIndexOf('}') + 1).replace(/,\s*([\]}])/g, '$1').replace(/}\s*{/g, '},{').replace(/"\s*\n\s*"/g, '","')); } catch (e) {
    let prof = 0, aspas = false, esc = false;
    for (let i = a; i < txt.length; i++) {
      const ch = txt[i];
      if (aspas) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') aspas = false; continue; }
      if (ch === '"') aspas = true; else if (ch === '{') prof++; else if (ch === '}' && --prof === 0) return JSON.parse(txt.slice(a, i + 1));
    }
    throw e0;
  }
  }
}
function mmss(s) { const h = Math.floor(s / 3600), mi = Math.floor(s % 3600 / 60), se = s % 60; return (h ? h + ':' + String(mi).padStart(2, '0') : mi) + ':' + String(se).padStart(2, '0'); }

async function transcreverAudio(cfg, v) {
  const passo = Number(cfg.BLOCO_SEG || 900);
  let ini = Number(v.PROGRESSO_SEG || 0);
  while (ini < v.DURACAO_SEG) {
    if (Date.now() - T0 > Number(cfg.ORCAMENTO_SEG || 230) * 1000) return false;
    const fim = Math.min(v.DURACAO_SEG, ini + passo);
    const pedir = async (a, b) => jsonDe(await gemini(cfg, cfg.MODELO_TRANSCRICAO, {
      contents: [{ parts: [
        { fileData: { fileUri: 'https://www.youtube.com/watch?v=' + v.YT_VIDEO_ID } , videoMetadata: { startOffset: a + 's', endOffset: b + 's' } },
        { text: 'Transcreva em portugues tudo o que e falado neste trecho do video. Responda so JSON: {"trechos":[{"s":<segundo do inicio no video inteiro>,"t":"texto"}]} com um item a cada 20 a 40 segundos. Nao resuma, nao invente.' }
      ] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 }
    })).trechos || [];
    let partes;
    try { partes = await pedir(ini, fim); }
    catch (e) {
      if (!(e instanceof SyntaxError) || fim - ini < 120) throw e;
      partes = [];
      const passoMenor = Math.max(60, Math.ceil((fim - ini) / 3));
      for (let a = ini; a < fim; a += passoMenor) {
        const b = Math.min(fim, a + passoMenor);
        try { partes.push(...await pedir(a, b)); }
        catch (e2) { if (!(e2 instanceof SyntaxError)) throw e2; log.push(v.YT_VIDEO_ID + ': trecho ' + mmss(a) + '-' + mmss(b) + ' sem transcrição'); }
      }
    }
    const tr = partes.map(x => ({ s: Math.max(ini, Math.min(fim, Math.round(Number(x.s) || ini))), t: String(x.t || '').slice(0, 4000) })).filter(x => x.t);
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

const TIPOS_PRATICA = ['meditação', 'visualização', 'respiração', 'prece e oração', 'mantra e decreto', 'banho de ervas', 'velas', 'defumação', 'chás e ervas', 'água, sal e cristais', 'limpeza e proteção energética', 'projeção astral', 'chakras e exercício energético', 'ritual e oferenda', 'alimentação e receitas', 'saúde e cuidados com o corpo', 'mediunidade e percepção', 'autoconhecimento e conduta', 'outra prática'];
const PROMPT_PRATICAS = 'Em "praticas" liste TODA instrucao de algo para a pessoa FAZER que aparece na fala: meditacao, visualizacao, exercicio de respiracao, prece ou oracao, mantra ou decreto, banho de ervas, uso de velas, defumacao, cha, agua, sal ou cristais, limpeza ou protecao energetica, tecnica de projecao astral, exercicio com chakras, ritual ou oferenda, alimentacao, receita ou energizacao de alimentos, cuidado com a saude e o corpo, homeopatia, medicacao ou suplemento indicado (traga o nome e a dose quando forem ditos), exercicio de mediunidade ou percepcao (psicografia, clarividencia, telepatia, passe), exercicio de autoconhecimento ou conduta (reflexao, perdao, gratidao, habitos), ou qualquer outro trabalho espiritual ensinado. So o que e ensinado ou recomendado para fazer, nao o que e so comentado. Para cada uma: "tipo" (escolha SO desta lista, copiando o nome: ' + TIPOS_PRATICA.join('; ') + '), "titulo" (nome curto da pratica, ex.: "banho de arruda e guine para descarrego"), "instrucao" (o passo a passo como foi ensinado: ingredientes, quantidades, horario, o que falar ou mentalizar; ate 8 frases) e "momento" ("mm:ss" do trecho em que comeca). Lista vazia se o video nao ensina nenhuma pratica.\n';

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

const JEITOS_ET = 'med (meditacao, silencio, mantras falados ou mentalizados); vis (visualizacao, mentalizar luz, cilindros, esferas); saida (tecnicas de projecao astral e saida do corpo); resp (exercicios de respiracao); energia (movimentacao de energia, chakras, passes, autopasse, irradiar energia); prece (preces, oracoes, decretos, evangelho no lar); banho (banhos de ervas, sal, chuveirada); defum (defumacao, incenso, aromatizador, velas); agua (agua fluidificada, sal grosso, cristais, objetos de protecao); chas (chas, florais, oleos essenciais, remedios naturais caseiros); homeo (homeopatia, medicacao, suplementos, vitaminas, minerais, fitoterapicos em capsula ou tintura, com a dose quando dita); alim (alimentacao e receitas); corpo (cuidados com o corpo, exercicio fisico, natureza, aterramento); reflexao (reflexao, autoconhecimento, conduta, habitos, perdao); ritual (rituais, oferendas, simpatias, patuas, espada de sao jorge); musica (musicas, cantos, sons); percepcao (treinos de percepcao, clarividencia, leitura energetica, mediunidade); outra';
const SERVE_ET = 'prot.pes (protecao pessoal), prot.aura (limpeza da aura), prot.laco (cortar lacos e energias de pessoas), prot.obs (obsessao e ataques espirituais), emo.ans (ansiedade, medo, panico), emo.tri (tristeza, desanimo), emo.rai (raiva), emo.neg (pensamentos negativos), emo.auto (autoestima, amor-proprio), con.men (mentores e amparadores), con.eu (eu interior), con.fe (fe e gratidao), con.med (mediunidade), men.foco (foco), men.mem (memoria), men.clar (clareza, discernimento), men.int (intuicao, percepcao), proj.prep (preparar para projetar), proj.saida (sair do corpo), proj.luc (lucidez fora do corpo), proj.lem (lembrar sonhos), proj.prot (protecao na projecao), casa.limp (limpar ambiente), casa.prot (proteger a casa), casa.harm (harmonizar o lar), sau.cura (cura), sau.dor (dores), sau.ener (energia e disposicao), sau.desint (desintoxicar), rel.fam (familia e filhos), rel.casal (casal), rel.perd (perdao e magoas), rel.car (ajudar e doar energia), rel.dist (ajudar a distancia e quem partiu), sono.dorm (dormir bem), sono.ins (insonia), sono.pes (pesadelos e protecao a noite), pros.din (dinheiro), pros.trab (trabalho), pros.cam (abrir caminhos)';
const QUANDO_ET = 'acordar (ao acordar), dia (todo dia), varias (varias vezes ao dia), dormir (antes de dormir), madrugada, semana (toda semana), vez (de vez em quando), precisa (quando precisar)';
const ok = t => new Set(t.split(/[;,]/).map(x => x.trim().split(' ')[0]).filter(Boolean));
const JEITO_OK = ok(JEITOS_ET), SERVE_OK = ok(SERVE_ET), QUANDO_OK = ok(QUANDO_ET);
async function marcarFinalidades(cfg) {
  const fila = ((await sql('finFila', {})).rows || []);
  if (!fila.length) return 0;
  const texto = fila.map(p => '#' + p.ID + ' [' + p.TIPO + '] ' + p.TITULO + ': ' + String(p.INSTRUCAO || '').replace(/\s+/g, ' ')).join('\n');
  const txt = await gemini(cfg, cfg.MODELO_ANALISE, {
    contents: [{ parts: [{ text: 'Voce organiza praticas espirituais ensinadas em videos. Para cada pratica abaixo de 3 etiquetas.\n' +
      '"jeito": o jeito de fazer, UM codigo desta lista: ' + JEITOS_ET + '.\n' +
      '"serve": para que serve, de 1 a 3 codigos SO desta lista: ' + SERVE_ET + '. Use so o que a pratica promete ou indica.\n' +
      '"quando": quando fazer, codigos desta lista (0 a 2): ' + QUANDO_ET + '. Lista vazia se a pratica nao diz quando.\n' +
      '"conselho": 1 se NAO e uma pratica para a pessoa fazer em casa: conselho generico sem tecnica (ex.: "mantenha a fe", "seja feliz"), encaminhamento para buscar ajuda fora (ir a um centro, pedir cirurgia espiritual, mandar nomes para tratamento, procurar grupo), assunto que nao e espiritual (higiene, golpes, financas, estoque de comida), causa ou evento pontual (abaixo-assinado, inscricao em evento), ou rito guiado por outra pessoa que nao da para repetir em casa. Senao 0.\n' +
      'Responda so JSON: {"itens":[{"id":123,"jeito":"med","serve":["emo.ans"],"quando":["dormir"],"conselho":0}]}\n\nPRATICAS:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
  });
  const j = jsonDe(txt);
  const lim = (v, okSet, n) => (Array.isArray(v) ? v : [v]).map(x => String(x || '').trim().toLowerCase()).filter(x => okSet.has(x)).filter((x, i, a) => a.indexOf(x) === i).slice(0, n).join(',');
  const porId = new Map((j.itens || []).map(x => [Number(x.id), x]));
  const lista = fila.filter(p => porId.has(Number(p.ID))).map(p => {
    const x = porId.get(Number(p.ID));
    return { id: Number(p.ID), jeito: lim(x.jeito, JEITO_OK, 1) || 'outra', serve: lim(x.serve, SERVE_OK, 3), quando: lim(x.quando, QUANDO_OK, 2), conselho: Number(x.conselho) === 1 ? 1 : 0 };
  });
  if (!lista.length) return 0;
  const chave = 'fin-' + Date.now();
  await lote(chave, lista); await sql('finGravar', { chave }); await sql('loteApagar', { chave });
  return lista.length;
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

const PROMPT_LIVROS = 'Em "livros" liste TODO livro que a pessoa que fala indica, recomenda, sugere ler ou cita como fonte de estudo (inclua obras espirituais, romances mediunicos, biografias e livros de autoria do proprio palestrante). Liste tambem, com o "tipo" certo, musicas, albuns e bandas ("musica"), filmes, series e documentarios ("audiovisual") e textos sagrados ou classicos como Biblia, Bhagavad Gita, Alcorao, Upanishads, Tao Te Ching e seus livros ou capitulos ("sagrado"), quando citados como referencia. Todo o resto e "livro". Nao inclua o que e so um nome solto sem ser uma obra. Para cada um: "titulo" (como foi dito), "autor" (autor, artista ou diretor se foi dito ou for evidente; senao vazio), "tipo" ("livro", "musica", "audiovisual" ou "sagrado"; na duvida use "livro"), "trecho" (o que foi dito, com as palavras do video, ate 3 frases) e "momento" ("mm:ss" em que e citado). Lista vazia se o video nao cita nenhuma obra.\n';

function limparLivros(lista, dur) {
  const seg = t => { const p = String(t || '').split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0); };
  const vistos = new Set();
  return (Array.isArray(lista) ? lista : []).filter(l => l && String(l.titulo || '').trim()).slice(0, 30).map(l => {
    const s = seg(l.momento);
    const tipo = ['musica', 'audiovisual', 'sagrado'].includes(String(l.tipo || '').toLowerCase()) ? String(l.tipo).toLowerCase() : 'livro';
    return { tipo, titulo: String(l.titulo).trim().slice(0, 290), autor: String(l.autor || '').trim().slice(0, 190), trecho: String(l.trecho || '').trim().slice(0, 3900), seg: s >= 0 && s <= Number(dur || 1e9) ? s : 0 };
  }).filter(l => { const k = l.titulo.toLowerCase() + '|' + l.seg; if (vistos.has(k)) return false; vistos.add(k); return true; });
}

async function gravarLivros(v, lista) {
  const chave = 'L:' + v.ID;
  await sql('livrosLimpar', { videoId: v.ID });
  if (lista.length) { await lote(chave, lista); await sql('livrosGravar', { chave, videoId: v.ID }); await sql('loteApagar', { chave }); }
  const estados = { musica: 'MUSICA', audiovisual: 'AUDIOVISUAL', sagrado: 'SAGRADO' };
  for (const x of lista) {
    if (!estados[x.tipo]) continue;
    const nome = String(x.titulo).replace(/['"\\{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 290);
    if (nome) await sql('nomeTipoIA', { nome, estado: estados[x.tipo] }).catch(() => {});
  }
  await sql('videoLivrosFeito', { id: v.ID, quando: agora() });
}

async function validarNomes(cfg, lista) {
  const itens = lista.map((x, i) => (i + 1) + '. "' + x.NOME + '"' + (x.AUTOR ? ' (autor ouvido: ' + x.AUTOR + ')' : '') + (x.TRECHO ? ' | contexto: ' + String(x.TRECHO).slice(0, 160) : '')).join('\n');
  const montar = (comBusca) => ({
    contents: [{ parts: [{ text: 'Os nomes abaixo foram ouvidos em transcricoes de videos espirituais e podem estar errados, truncados ou ser so tema/oracao. Para cada um, ' + (comBusca ? 'PESQUISE NO GOOGLE' : 'Sem acesso a busca: use so o que voce sabe com seguranca; na duvida, conf baixa') + ' se existe um livro real. Se existir, devolva o titulo oficial e o autor, e use o MESMO titulo oficial para variacoes do mesmo livro. Se nao achar com seguranca, conf baixa ou media e, se tiver palpite, coloque em titulo/autor. Se claramente nao for livro, titulo vazio e conf baixa.\nResponda so JSON: [{"nome":"exatamente como recebido","titulo":"...","autor":"...","conf":"alta|media|baixa","motivo":"uma frase"}]\n\n' + itens }] }],
    generationConfig: { temperature: 0 }
  });
  let txt, semBusca = BUSCA_FALHOU;
  if (!semBusca) {
    try { const c = montar(true); c.tools = [{ google_search: {} }]; txt = await gemini(cfg, cfg.MODELO_ANALISE, c, cfg.GEMINI_CONEXOES_LIVROS); }
    catch (e) { if (!/429/.test(String(e.message))) throw e; BUSCA_FALHOU = true; semBusca = true; }
  }
  if (semBusca) txt = await gemini(cfg, cfg.MODELO_ANALISE, montar(false), cfg.GEMINI_CONEXOES_LIVROS);
  const a = txt.indexOf('['), b = txt.lastIndexOf(']');
  const arr = JSON.parse(txt.slice(a, b + 1));
  const permitidos = new Set(lista.map(x => String(x.NOME)));
  return arr.filter(x => x && permitidos.has(String(x.nome))).map(x => ({ nome: String(x.nome), titulo: String(x.titulo || '').slice(0, 300), autor: String(x.autor || '').slice(0, 200), conf: ['alta', 'media', 'baixa'].includes(x.conf) ? (semBusca && x.conf === 'alta' ? 'media' : x.conf) : 'baixa', achouNaBusca: !semBusca && x.conf === 'alta', motivo: String(x.motivo || '').slice(0, 300) }));
}
async function conferirOutros(cfg, lista) {
  const rot = { MUSICA: 'musica', AUDIOVISUAL: 'audiovisual', SAGRADO: 'sagrado' };
  const itens = lista.map((x, i) => (i + 1) + '. "' + x.NOME + '" (classificado como ' + rot[x.ESTADO] + ')' + (x.AUTOR ? ' (autor ouvido: ' + x.AUTOR + ')' : '') + (x.TRECHO ? ' | contexto: ' + String(x.TRECHO).slice(0, 160) : '')).join('\n');
  const montar = (comBusca) => ({
    contents: [{ parts: [{ text: 'Os nomes abaixo foram ouvidos em transcricoes de videos espirituais e classificados como musica, audiovisual (filme, serie, video) ou texto sagrado. Podem estar errados, truncados ou na classe errada. Para cada um, ' + (comBusca ? 'PESQUISE NO GOOGLE' : 'Sem acesso a busca: use so o que voce sabe com seguranca; na duvida, conf baixa') + ' o que e de verdade. Devolva o titulo oficial, o autor (artista, diretor ou tradicao), o tipo certo (musica, audiovisual, sagrado ou livro) e conf (alta so se tiver certeza do nome e do tipo; media ou baixa se houver duvida).\nResponda so JSON: [{"nome":"exatamente como veio","titulo":"...","autor":"...","tipo":"musica|audiovisual|sagrado|livro","conf":"alta|media|baixa","motivo":"uma frase curta"}]\n\n' + itens }] }],
    generationConfig: { temperature: 0 }
  });
  let txt, semBusca = BUSCA_FALHOU;
  if (!semBusca) {
    try { const c = montar(true); c.tools = [{ google_search: {} }]; txt = await gemini(cfg, cfg.MODELO_ANALISE, c, cfg.GEMINI_CONEXOES_LIVROS); }
    catch (e) { if (!/429/.test(String(e.message))) throw e; BUSCA_FALHOU = true; semBusca = true; }
  }
  if (semBusca) throw new Error('busca do Google sem cota: conferência adiada');
  const arr = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
  const porNome = new Map(arr.filter(x => x && x.nome).map(x => [String(x.nome), x]));
  let ok = 0;
  for (const it of lista) {
    const x = porNome.get(String(it.NOME));
    const limpo = t => String(t || '').replace(/['"\\{}]/g, ' ').replace(/\s+/g, ' ').trim();
    const quem = x ? [limpo(x.titulo), limpo(x.autor)].filter(Boolean).join(' — ') : '';
    const tipoOk = x && rot[it.ESTADO] === x.tipo;
    const certo = x && !semBusca && x.conf === 'alta' && tipoOk;
    let nota = quem;
    if (!x) nota = 'A conferência não respondeu sobre este nome';
    else if (!tipoOk) nota = ('Pode ser ' + x.tipo + (quem ? ': ' + quem : '') + '. ' + limpo(x.motivo)).slice(0, 300);
    else if (!certo) nota = ((quem ? quem + '. ' : '') + (semBusca ? 'Sem busca do Google. ' : '') + limpo(x.motivo)).slice(0, 300);
    await sql('outrosConferirGravar', { id: it.ID, conferido: certo ? 'OK' : 'DUVIDA', nota });
    ok++;
  }
  return ok;
}
async function lerLivros(cfg, v) {
  const tr = ((await sql('trechosDoVideo', { videoId: v.ID, limit: 2000, offset: 0 })).rows || []);
  if (!tr.length) { await gravarLivros(v, []); return 0; }
  const texto = tr.map(x => '[' + mmss(x.SEGUNDO) + '] ' + x.TEXTO).join('\n').slice(0, 600000);
  const txt = await gemini(cfg, cfg.MODELO_ANALISE, {
    contents: [{ parts: [{ text: 'Voce organiza uma base de estudo sobre espiritualidade. Abaixo esta a transcricao do video "' + v.TITULO + '" com o tempo de cada trecho.\nResponda so JSON: {"livros":[{"titulo":"...","autor":"...","tipo":"livro|musica|audiovisual|sagrado","trecho":"...","momento":"mm:ss"}]}\n' + PROMPT_LIVROS + 'Use so a transcricao.\n\nTRANSCRICAO:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
  }, cfg.GEMINI_CONEXOES_LIVROS);
  const lista = limparLivros(jsonDe(txt).livros, v.DURACAO_SEG);
  await gravarLivros(v, lista);
  return lista.length;
}

const NAO_MENTOR = new Set(['shirlene', 'monicademedeiros', 'monica', 'maemaria', 'jesus', 'mariamadalena', 'chicoxavier', 'kardec', 'allankardec', 'emmanuel', 'margareteaquila', 'margarete', 'oxala', 'pava', 'freiluiz', 'marioschenberg', 'mario']);

const capMentor = s => String(s || '').trim().replace(/\s+/g, ' ').split(' ').map((w, i) => { const lw = w.toLowerCase(); if (i > 0 && ['de', 'da', 'do', 'das', 'dos', 'e', 'd'].includes(lw)) return lw; return lw.charAt(0).toLocaleUpperCase('pt-BR') + lw.slice(1); }).join(' ');
let REGRAS_MENTOR = null;
async function regrasMentor() {
  if (REGRAS_MENTOR) return REGRAS_MENTOR;
  const sm = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const r = { alias: {}, nao: new Set(), mentores: [] };
  try {
    for (const x of ((await sql('mentorRegrasMotor', {})).rows || [])) {
      if (x.TIPO === 'NAO') r.nao.add(sm(x.NOME));
      else if (x.TIPO === 'APELIDO' && x.DESTINO) r.alias[sm(x.NOME)] = x.DESTINO;
      else if (x.TIPO === 'MENTOR') { r.mentores.push(x.NOME); r.alias[sm(x.NOME)] = x.NOME; }
    }
  } catch (e) {}
  REGRAS_MENTOR = r;
  return r;
}

async function mentorConduz(cfg, titulo, texto, nome) {
  const txt = await gemini(cfg, cfg.MODELO_ANALISE, {
    contents: [{ parts: [{ text: 'Abaixo esta a transcricao do video "' + titulo + '". Pergunta: o mentor espiritual "' + nome + '" esta INCORPORADO num medium (ex.: Monica de Medeiros ou outro) e CONDUZ esta live, falando ele mesmo em primeira pessoa por boa parte do video? Responda NAO se ele so e citado, lembrado, se alguem le uma mensagem dele, se aparece so numa prece ou se fala so poucos minutos. Se o titulo do video traz o nome de OUTRO mentor, quem conduz e esse outro: responda NAO. Confira quem se apresenta e de onde diz que vem (ex.: Shell Y Ann fala do planeta natal dela, Tizeon). Na duvida, NAO. Responda so JSON: {"conduz":true|false,"motivo":"uma frase","momento":"mm:ss do trecho que comprova"}\n\nTRANSCRICAO:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 }
  });
  const j = jsonDe(txt);
  return { conduz: j.conduz === true, motivo: String(j.motivo || '').slice(0, 300) };
}

async function conferirMentor(cfg, x) {
  const tr = ((await sql('trechosDoVideo', { videoId: x.VIDEO_ID, limit: 2000, offset: 0 })).rows || []);
  if (!tr.length) { await sql('mentorConferido', { id: x.ID }); return 'sem transcricao'; }
  const texto = tr.map(t => '[' + mmss(t.SEGUNDO) + '] ' + t.TEXTO).join('\n').slice(0, 600000);
  const r = await mentorConduz(cfg, x.TITULO, texto, x.MENTOR);
  if (r.conduz) { await sql('mentorConferido', { id: x.ID }); return 'mantido: ' + r.motivo; }
  await sql('mentorDescartarBkp', { id: x.ID });
  await sql('mentorDescartar', { id: x.ID });
  return 'retirado: ' + r.motivo;
}

async function analisar(cfg, v) {
  const RM = await regrasMentor();
  const tr = ((await sql('trechosDoVideo', { videoId: v.ID, limit: 2000, offset: 0 })).rows || []);
  const texto = tr.map(x => '[' + mmss(x.SEGUNDO) + '] ' + x.TEXTO).join('\n').slice(0, 600000);
  const temasExist = ((await sql('temasNomes', {})).rows || []).map(r => r.NOME);
  const corpo = {
    contents: [{ parts: [{ text:
      'Voce organiza uma base de estudo sobre espiritualidade. Abaixo esta a transcricao do video "' + v.TITULO + '" com o tempo de cada trecho.\n' +
      'Responda so JSON: {"resumo":"resumo em portugues de 5 a 10 frases, so com o que foi falado","temas":[{"nome":"tema curto em minusculas","momentos":["mm:ss",...]}],"mentores":[{"nome":"nome do mentor","momentos":["mm:ss",...]}],"praticas":[{"tipo":"...","titulo":"...","instrucao":"...","momento":"mm:ss"}]}\n' + PROMPT_PRATICAS +
      (Number(v.TEM_MENTOR) ? 'Em "mentores" ponha SO o mentor (guia ou espirito) que conduz a live: quem se manifesta e fala pela medium. Olhe SEMPRE o titulo do video ("' + v.TITULO + '"): nos videos da Casa do Consolador o nome do mentor quase sempre esta no titulo; senao, e anunciado no comeco. Ex.: Veludo, Tupã, Pai Joaquim, Dr. Espanhol. So vale nome que aparece escrito no titulo ou falado na transcricao. A medium e pessoas vivas (ex.: Monica de Medeiros, Shirlene, Margarete Aquila, Pava) NAO sao mentores, e Mae Maria, Oxala, Frei Luiz e Mario Schenberg tambem nao entram. Nomes que so sao citados ou comentados (ex.: Maria Madalena, Jesus, Chico Xavier, Emmanuel, Kardec) NAO sao mentores: se forem assunto importante, entram em "temas". Em geral ha 0 ou 1 mentor, no maximo 3; lista vazia se ninguem conduz como mentor. Se for um destes mentores ja usados, use a mesma grafia: ' + [...new Set([...RM.mentores, ...temasExist.filter(n => n.startsWith('mentor: ')).map(n => n.slice(8))])].join('; ') + (RM.nao.size ? '. Estes NAO sao mentores, nunca ponha: ' + [...RM.nao].join('; ') : '') + '\n' : 'Deixe "mentores" sempre como lista vazia.\n') +
      'De 2 a 6 temas, escolhidos SO desta lista de categorias (copie o nome exatamente como esta): ' + temasExist.filter(n => !n.startsWith('mentor: ')).slice(0, 300).join('; ') + '\n' +
      'Os momentos sao os tempos dos trechos em que o tema aparece (ate 6 por tema). Use so a transcricao.\n\nTRANSCRICAO:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
  };
  let j;
  try { j = jsonDe(await gemini(cfg, cfg.MODELO_ANALISE, corpo)); }
  catch (e) { if (!(e instanceof SyntaxError)) throw e; corpo.generationConfig.temperature = 0; j = jsonDe(await gemini(cfg, cfg.MODELO_ANALISE, corpo)); }
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
  const ALIAS = { 'tupan': 'tupã', 'shellyana': 'Shell Y Ann', 'shell y ann': 'Shell Y Ann', 'shelly ann': 'Shell Y Ann', 'shellyann': 'Shell Y Ann', 'shelly ana': 'Shell Y Ann', 'shel': 'Shell Y Ann', 'sheli': 'Shell Y Ann', 'shelly': 'Shell Y Ann', 'sheelian': 'Shell Y Ann', 'sheliane': 'Shell Y Ann', 'shellyanna': 'Shell Y Ann', 'sheliana': 'Shell Y Ann', 'shelyana': 'Shell Y Ann', 'tranqueira': 'tronqueira', 'pai joaquim de angola': 'pai joaquim', 'pai joaquim d\'angola': 'pai joaquim', 'tamiris': 'tamires', 'tamires das sete rosas': 'tamires', 'tamiris das sete rosas': 'tamires', 'tamires das 7 rosas': 'tamires', 'dr espanhol': 'dr. espanhol', 'doutor espanhol': 'dr. espanhol' };
  const semA = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const k of Object.keys(ALIAS)) if (!RM.alias[semA(k)]) RM.alias[semA(k)] = ALIAS[k];
  for (const k of Object.keys(RM.alias)) ALIAS[k] = RM.alias[k];
  const doTitulo = new Set();
  for (const mt of (Number(v.TEM_MENTOR) ? (j.mentores || []) : []).filter(x => x && x.nome).slice(0, 3)) {
    const base0 = String(mt.nome).trim().toLowerCase().replace(/\s+/g, ' ');
    const base = RM.alias[semA(base0)] ? semA(base0) : base0;
    const sem = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const onde = sem(v.TITULO + ' ' + texto);
    const formas = [base, ALIAS[base] || base, ...Object.keys(ALIAS).filter(k => ALIAS[k] === (ALIAS[base] || base))].map(sem).filter(f => f.length >= 3);
    if (!formas.some(f => onde.includes(f))) continue;
    if (NAO_MENTOR.has(sem(ALIAS[base] || base)) || RM.nao.has(sem(ALIAS[base] || base)) || RM.nao.has(sem(base0))) continue;
    const nome = ('mentor: ' + capMentor(ALIAS[base] || base)).slice(0, 150);
    if (nomes.has(nome)) continue;
    const noTitulo = formas.filter(f => f.length >= 4).some(f => sem(v.TITULO).includes(f));
    if (!noTitulo) { try { if (!(await mentorConduz(cfg, v.TITULO, texto, nome.slice(8))).conduz) continue; } catch (e) { continue; } }
    nomes.add(nome); if (noTitulo) doTitulo.add(nome);
    temas.push({ nome, momentos: (mt.momentos || []).map(seg).filter(n => n >= 0 && n <= Number(v.DURACAO_SEG || 1e9)).slice(0, 6).join(',') });
  }
  if (Number(v.TEM_MENTOR)) {
    const pal = x => ' ' + String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    const tit = pal(v.TITULO);
    const conhecidos = [...new Set([...RM.mentores, ...temasExist.filter(n => n.startsWith('mentor: ')).map(n => n.slice(8))])];
    const formasT = [];
    for (const n of conhecidos) formasT.push([n, n]);
    for (const k of Object.keys(RM.alias)) formasT.push([k, RM.alias[k]]);
    for (const k of Object.keys(ALIAS)) formasT.push([k, ALIAS[k]]);
    for (const [forma, alvo] of formasT) {
      const f = pal(forma);
      if (f.trim().length < 4 || !tit.includes(f)) continue;
      if (RM.nao.has(semA(alvo)) || NAO_MENTOR.has(semA(alvo))) continue;
      const nome = ('mentor: ' + capMentor(alvo)).slice(0, 150);
      if ([...nomes].some(x => semA(x) === semA(nome))) continue;
      nomes.add(nome); doTitulo.add(nome); temas.push({ nome, momentos: '' });
    }
  }
  if (doTitulo.size) for (let i = temas.length - 1; i >= 0; i--) if (temas[i].nome.startsWith('mentor: ') && ![...doTitulo].some(d => semA(d) === semA(temas[i].nome))) temas.splice(i, 1);
  const chave = 'M:' + v.ID;
  await lote(chave, temas);
  await sql('temasGarantirLote', { chave });
  await sql('videoTemasIALimpar', { videoId: v.ID });
  await sql('videoTemasIA', { chave, videoId: v.ID });
  await sql('videoMentoresVerificados', { videoId: v.ID });
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
    const msg = String(e.message || e);
    if (/Gemini sem resposta|: 429|high demand|timed out/i.test(msg)) {
      await sql('videoCotaEspera', { id: v.ID, motivo: ('Aguardando cota da IA: ' + msg).slice(0, 900) }).catch(() => {});
      log.push(v.YT_VIDEO_ID + ': cota da IA, fica na fila');
      return 'cota';
    }
    await sql('videoPendente', { id: v.ID, motivo: msg.slice(0, 900) }).catch(() => {});
    log.push(v.YT_VIDEO_ID + ': erro ' + msg.slice(0, 200));
  }
}

async function fecharAvisos(hoje) {
  const n = Number((((await sql('avisoPendentes', {})).rows || [{}])[0] || {}).N || 0);
  if (!n) return;
  let id = Number((((await sql('avisoHoje', { dia: hoje })).rows || [{}])[0] || {}).ID || 0);
  if (!id) { await sql('avisoCriar', { dia: hoje, quando: agora() }); id = Number((((await sql('avisoHoje', { dia: hoje })).rows || [{}])[0] || {}).ID || 0); }
  if (id) { await sql('avisoVincular', { id }); await sql('avisoRecontar', { id }); }
}

if (event.modo === 'buscarNovos') {
  const cfgB = {}; ((await sql('configLer', {})).rows || []).forEach(r => { cfgB[r.CHAVE] = r.VALOR; });
  const logB = []; const canaisB = []; let totalB = 0;
  for (const c of ((await sql('canaisParaMotor', {})).rows || [])) {
    if (c.CARGA_STATUS === 'LISTANDO') { canaisB.push({ nome: c.NOME, novos: 0, msg: 'ainda levantando o acervo' }); continue; }
    try { const n = await checagemDiaria(c, cfgB, logB); totalB += n; canaisB.push({ nome: c.NOME, novos: n }); }
    catch (e) { canaisB.push({ nome: c.NOME, novos: 0, msg: 'não consegui ler o canal agora' }); }
  }
  if (totalB > 0) await m.executeServerFunctionAsyncMitra({ projectId: pid, serverFunctionId: SF.motor, input: { modo: 'continuar' } });
  return { ok: true, novos: totalB, canais: canaisB };
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
    if (await estudar(cfg, fila[0], log) === 'cota') break;
    estudados++;
  }
  let mentoresConferidos = 0; const vistosM = new Set();
  if (cfg.GEMINI_OK && cfg.CONFERIR_MENTOR !== '0') {
    while (Date.now() - T0 < Number(cfg.ORCAMENTO_SEG || 230) * 1000 - 60e3) {
      const mf = ((await sql('mentorConferirFila', {})).rows || []);
      if (!mf.length || vistosM.has(mf[0].ID)) break;
      vistosM.add(mf[0].ID);
      try { log.push('mentor ' + mf[0].MENTOR + ' / ' + mf[0].VIDEO_ID + ': ' + await conferirMentor(cfg, mf[0])); mentoresConferidos++; }
      catch (e) { log.push('mentor ' + mf[0].ID + ': erro ' + String(e.message || e).slice(0, 150)); break; }
    }
  }
  let finMarcadas = 0;
  if (cfg.GEMINI_OK && cfg.PRATICAS_LIGADO !== '0' && cfg.FINALIDADE_LIGADO !== '0') {
    for (let i = 0; i < 15 && Date.now() - T0 < Number(cfg.ORCAMENTO_SEG || 230) * 1000 - 60e3; i++) {
      try { const n = await marcarFinalidades(cfg); if (!n) break; finMarcadas += n; }
      catch (e) { log.push('finalidades: erro ' + String(e.message || e).slice(0, 150)); break; }
    }
  }
  let praticasLidas = 0; const vistosP = new Set(); let errosP = 0;
  if (cfg.GEMINI_OK && cfg.PRATICAS_LIGADO !== '0') {
    while (Date.now() - T0 < Number(cfg.ORCAMENTO_SEG || 230) * 1000 - 60e3) {
      const pf = ((await sql('praticasFila', { pular: [0, ...vistosP].join(',') })).rows || []);
      if (!pf.length || vistosP.has(pf[0].ID)) break;
      vistosP.add(pf[0].ID);
      try { const n = await lerPraticas(cfg, pf[0]); praticasLidas++; log.push('praticas ' + pf[0].ID + ': ' + n); }
      catch (e) { const motivo = String(e.message || e).slice(0, 150); log.push('praticas ' + pf[0].ID + ': erro ' + motivo); if (!IA_SEM_COTA) await sql('praticasErroAnotar', { id: pf[0].ID, motivo: agora() + ' ' + motivo.replace(/[^\w\s:().,-]/g, ' ') }).catch(() => {}); if (IA_SEM_COTA || ++errosP >= 5) break; }
    }
  }
  let livrosLidos = 0; const vistosL = new Set(); let errosL = 0;
  if (cfg.GEMINI_OK && cfg.LIVROS_LIGADO !== '0') {
    while (Date.now() - T0 < Number(cfg.ORCAMENTO_SEG || 230) * 1000 - 60e3) {
      const lf = ((await sql('livrosFila', { pular: [0, ...vistosL].join(',') })).rows || []);
      if (!lf.length || vistosL.has(lf[0].ID)) break;
      vistosL.add(lf[0].ID);
      try { const n = await lerLivros(cfg, lf[0]); livrosLidos++; log.push('livros ' + lf[0].ID + ': ' + n); }
      catch (e) { const motivo = String(e.message || e).slice(0, 150); log.push('livros ' + lf[0].ID + ': erro ' + motivo); if (!IA_SEM_COTA) await sql('livrosErroAnotar', { id: lf[0].ID, motivo: agora() + ' ' + motivo.replace(/[^\w\s:().,-]/g, ' ') }).catch(() => {}); if (IA_SEM_COTA || ++errosL >= 5) break; }
    }
  }
  let casadosLocal = 0;
  try {
    const semAcento = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const parada = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'um', 'uma', 'em', 'no', 'na', 'the', 'of', 'livro', 'livros']);
    const palavras = t => semAcento(t).split(' ').filter(w => w && !parada.has(w));
    const sobrenomes = t => semAcento(t).split(' ').filter(w => w.length >= 4);
    const semDecisao = ((await sql('nomesSemDecisao', {})).rows || []);
    if (semDecisao.length) {
      const indice = ((await sql('nomesCatalogoLer', {})).rows || []).map(c => ({ c, t: palavras(c.TITULO), tn: semAcento(c.TITULO), a: new Set(sobrenomes(c.AUTOR)) }));
      const achados = [];
      for (const f of semDecisao) {
        const t = palavras(f.NOME), tn = semAcento(f.NOME), an = sobrenomes(f.AUTOR);
        if (!t.length) continue;
        let melhor = null;
        for (const x of indice) {
          const inter = t.filter(w => x.t.includes(w)).length; if (!inter) continue;
          const sim = inter / Math.max(t.length, x.t.length), cont = inter / Math.min(t.length, x.t.length);
          const aut = an.some(w => x.a.has(w));
          let pts = 0;
          if (tn === x.tn && aut) pts = 3; else if (aut && sim >= 0.5 && t.length >= 2) pts = 2.5; else if (aut && cont >= 1) pts = 1.2;
          if (pts && (!melhor || pts + sim > melhor.pts + melhor.sim)) melhor = { c: x.c, pts, sim };
        }
        if (melhor) achados.push({ autorOuvido: String(f.AUTOR || ''), nome: String(f.NOME), titulo: String(melhor.c.TITULO), autor: String(melhor.c.AUTOR || ''), conf: 'baixa', verif: true, motivo: 'Título e autor parecidos com um livro da biblioteca (casamento automático)' });
      }
      if (achados.length) {
        const chaveL = 'C:' + Date.now();
        await lote(chaveL, achados);
        await sql('nomesPendGravar', { chave: chaveL });
        await sql('loteApagar', { chave: chaveL });
        await gravarCerteza(achados);
        casadosLocal = achados.length; log.push('nomes casados com a biblioteca: ' + casadosLocal);
      }
    }
  } catch (e) { log.push('casamento local: erro ' + String(e.message || e).slice(0, 120)); }
  let outrosConferidos = 0, errosO = 0;
  if (cfg.GEMINI_OK && cfg.LIVROS_LIGADO !== '0' && cfg.VALIDAR_LIVROS !== '0' && !IA_SEM_COTA) {
    while (Date.now() - T0 < Number(cfg.ORCAMENTO_SEG || 230) * 1000 - 60e3) {
      const filaO = ((await sql('outrosFila', { limit: 20 })).rows || []);
      if (!filaO.length) break;
      try { outrosConferidos += await conferirOutros(cfg, filaO); log.push('músicas, audiovisuais e textos sagrados conferidos: ' + filaO.length); }
      catch (e) { log.push('conferir outros: erro ' + String(e.message || e).slice(0, 150)); if (IA_SEM_COTA || ++errosO >= 3) break; }
    }
  }
  let nomesValidados = 0, errosN = 0;
  if (cfg.GEMINI_OK && cfg.LIVROS_LIGADO !== '0' && cfg.VALIDAR_LIVROS !== '0' && !IA_SEM_COTA) {
    while (Date.now() - T0 < Number(cfg.ORCAMENTO_SEG || 230) * 1000 - 60e3) {
      const fila = ((await sql('nomesFila', { limit: 40 })).rows || []);
      if (!fila.length) break;
      const chave = 'N:' + Date.now();
      try {
        const res = await validarNomes(cfg, fila);
        const normT = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
        const naBiblioteca = new Set(((await sql('nomesCatalogoLer', {})).rows || []).map(c => normT(c.TITULO)));
        const autorPrev = new Map(fila.map(x => [String(x.NOME), String(x.AUTOR || '')]));
        for (const x of res) {
          const naCat = !!x.titulo && naBiblioteca.has(normT(x.titulo));
          x.verif = !!x.achouNaBusca || naCat;
          if (naCat && x.conf !== 'alta' && x.conf !== 'baixa' && !/['"\\]/.test(x.nome) && certezaNome(x.nome, autorPrev.get(x.nome) || '', x.titulo, x.autor) >= 95) { x.conf = 'alta'; x.motivo = ('Aprovado: o livro já está na biblioteca e nome e autor batem. ' + x.motivo).slice(0, 300); }
        }
        const vistos = new Set(res.map(x => x.nome));
        for (const x of fila) if (!vistos.has(String(x.NOME))) res.push({ nome: String(x.NOME), titulo: '', autor: '', conf: 'baixa', motivo: 'A busca não respondeu sobre este nome' });
        await lote(chave, res);
        await sql('nomesCatalogoGravar', { chave }); await sql('nomesOkGravar', { chave }); await sql('nomesPendGravar', { chave });
        await sql('loteApagar', { chave });
        const autorDe = new Map(fila.map(x => [String(x.NOME), String(x.AUTOR || '')]));
        await gravarCerteza(res.filter(x => x.conf !== 'alta').map(x => Object.assign({ autorOuvido: autorDe.get(x.nome) || '' }, x)));
        nomesValidados += fila.length; log.push('nomes de livros validados: ' + fila.length);
      } catch (e) { await sql('loteApagar', { chave }).catch(() => {}); log.push('validar livros: erro ' + String(e.message || e).slice(0, 150)); if (IA_SEM_COTA || ++errosN >= 3) break; }
    }
  }
  let livroDisparado = false;
  const livroNoite = Number(cfg.LIVRO_POR_NOITE || 2);
  if (cfg.GEMINI_OK && cfg.LIVRO_LIGADO !== '0' && !(cfg.LIVRO_PAUSA_ATE && cfg.LIVRO_PAUSA_ATE > agora()) && livroNoite > 0 && !IA_SEM_COTA && horaBR >= 1 && horaBR < 7 && !(cfg.IA_PAUSADA_ATE && cfg.IA_PAUSADA_ATE > agora())) {
    const ultimaTentativa = Number(cfg.LIVRO_TENTOU_EM || 0);
    if (Date.now() - ultimaTentativa > 25 * 60e3) {
      const feitos = Number((((await sql('livroHoje', { dia: hojeBR })).rows || [{}])[0] || {}).N || 0);
      const prox = ((await sql('livroProximo', {})).rows || [])[0];
      if (prox && feitos < livroNoite) {
        await sql('configTelaGravar', { chave: 'LIVRO_TENTOU_EM', valor: String(Date.now()) });
        await m.executeServerFunctionAsyncMitra({ projectId: pid, serverFunctionId: SF.livroGerar, input: { temaId: Number(prox.ID), automatico: true } });
        livroDisparado = true; log.push('livro: escrevendo ' + prox.NOME);
      }
    }
  }
  await fecharAvisos(hojeBR);
  if (IA_SEM_COTA) {
    const d = new Date(); let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0);
    if (t <= Date.now()) t += 864e5;
    await sql('configTelaGravar', { chave: 'IA_PAUSADA_ATE', valor: new Date(t - 3 * 3600e3).toISOString().slice(0, 19) }).catch(() => {});
  } else if (IA_RESPONDEU) await sql('configTelaGravar', { chave: 'IA_PAUSADA_ATE', valor: '' }).catch(() => {});
  await sql('canaisAtualizarStatus', {});
  const resta = Number((((await sql('filaContar', {})).rows || [{}])[0] || {}).N || 0);
  const restaPraticas = Number((((await sql('praticasResumo', {})).rows || [{}])[0] || {}).N || 0) - Number((((await sql('praticasResumo', {})).rows || [{}])[0] || {}).LIDOS || 0);
  const restaLivros = Number((((await sql('livrosResumo', {})).rows || [{}])[0] || {}).N || 0) - Number((((await sql('livrosResumo', {})).rows || [{}])[0] || {}).LIDOS || 0);
  const restaFin = Number((((await sql('finContar', {})).rows || [{}])[0] || {}).N || 0);
  resultado = { livroDisparado, finMarcadas, restaFin, estudados, mentoresConferidos, restaMentores: Number((((await sql('mentorConferirContar', {})).rows || [{}])[0] || {}).N || 0), praticasLidas, livrosLidos, restaLivros, resta, restaPraticas, log, ms: Date.now() - T0 };
} finally {
  await sql('lockLiberar', { ate: String(ate) }).catch(() => {});
}
if ((resultado.resta > 0 && resultado.estudados > 0 || resultado.restaFin > 0 && resultado.finMarcadas > 0 || resultado.restaPraticas > 0 && resultado.praticasLidas > 0 || resultado.restaLivros > 0 && resultado.livrosLidos > 0 || resultado.restaMentores > 0 && resultado.mentoresConferidos > 0) && !event.semContinuar && Number(event.rodada || 0) < 400) {
  await m.executeServerFunctionAsyncMitra({ projectId: pid, serverFunctionId: SF.motor, input: { modo: 'continuar', rodada: Number(event.rodada || 0) + 1 } });
}
return resultado;
