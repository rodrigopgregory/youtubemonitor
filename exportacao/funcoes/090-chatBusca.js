const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = {"configLer":32,"configGravar":33,"loteGravar":34,"loteApagar":35,"videosInserirLote":36,"canalCargaAtualizar":37,"canalCargaMsg":38,"videosIdsCanal":39,"canalChecado":40,"trechosInserirLote":41,"videoProgresso":42,"trechosDoVideo":43,"temasNomes":44,"temasGarantirLote":45,"videoTemasIALimpar":98,"videoTemasIA":46,"videoConcluir":47,"videoPendente":48,"videoIndisponivel":49,"videoDetalhes":50,"videoForaDoFiltro":51,"videoOrigem":52,"videoCotaEspera":150,"videosRetentar":53,"canaisParaMotor":54,"filaComLegenda":97,"filaProximo":55,"filaContar":56,"avisoPendentes":57,"avisoHoje":58,"avisoCriar":59,"avisoVincular":60,"avisoRecontar":61,"canaisAtualizarStatus":62,"lockAdquirir":63,"playlistsGravar":99,"playlistVideosLimpar":101,"playlistVideosGravar":102,"playlistsSumidasVideos":103,"playlistsSumidas":104,"canalPlaylistsFeito":105,"praticasLimpar":119,"praticasGravar":120,"videoPraticasFeito":121,"praticasFila":122,"praticasErroAnotar":203,"nomeTipoIA":269,"livrosLimpar":207,"livrosGravar":208,"videoLivrosFeito":209,"validarUm":227,"nomeEstado":228,"nomesOkAtualizar":229,"nomesPendAtualizar":230,"nomesFila":218,"nomesCatalogoLer":239,"nomesSemDecisao":240,"nomesCatalogoGravar":219,"nomesOkGravar":220,"pendRefinoFila":274,"pendRefinoGravar":275,"nomesCertezaGravar":245,"nomesPendGravar":221,"livrosFila":210,"livrosErroAnotar":211,"livrosResumo":212,"livroResumos":164,"livroPraticas":165,"livroTemaInfo":166,"livroGravar":167,"finFila":173,"finGravar":174,"finContar":175,"lockLiberar":64,"inicioVideosNovos":196,"inicioParaAssistir":197,"inicioLivroUltimo":198,"inicioPraticaDia":199,"praticasJeitos":200,"praticasServe":201,"praticasQuando":202,"praticasLista":178,"praticasTotais":179,"playlistsListar":106,"canalPorYt":66,"canalInserir":67,"canaisListar":68,"painelResumo":69,"videosListar":70,"temasListar":71,"mentoresListar":127,"videoDetalhe":72,"videoTemas":73,"temaGarantir":74,"vtAcrescentar":75,"vtMomentos":281,"mapaTemasLista":282,"mapaTemaJeitos":283,"mapaTemaPraticas":284,"mapaTemaVideos":285,"mapaTemaLigados":286,"mapaVideoBusca":287,"vtTirar":76,"vtRenomear":77,"vtTirarSeOutro":78,"videoForaTema":161,"videoMarcarEditado":79,"buscarTema":80,"buscaTrechos":81,"buscaResumos":82,"avisosListar":83,"avisoVideos":84,"avisoMarcar":158,"avisoArquivar":159,"avisosTodosLidos":160,"avisoMarcarLido":85,"motorAndamento":86,"canaisLimiteMais":91,"canaisNomes":92,"estudoAndamento":93,"exportVideos":95,"exportTrechos":96,"exportEstrutura":107,"exportIndices":108,"exportTabCanais":109,"exportTabVideos":110,"exportTabTrechos":111,"exportTabTemas":112,"exportTabVideoTemas":113,"exportTabPlaylists":114,"exportTabPlaylistVideos":115,"exportTabAvisos":116,"exportVideosFiltro":118,"praticasTipos":123,"praticasDoVideo":124,"iaEstado":172,"praticasResumo":125,"exportTabMentorRegras":162,"exportVisoes":163,"exportTabPraticas":126,"exportTabConfig":117,"mentoresGerir":128,"configTelaLer":153,"configTelaGravar":154,"canaisMentorLer":155,"canalMentorGravar":156,"mentorRegrasListar":129,"mentorVideos":130,"mentorRegraGravar":131,"mentorRegraApagar":132,"mentorRegraApagarNome":133,"mentorTemaPorId":134,"mentorTemaPorNome":135,"mentorBackup":136,"mentorMover":137,"mentorDesligar":138,"mentorTemaApagar":139,"mentorTemaRenomear":140,"mentorMarcarTitulos":141,"mentorRegrasMotor":142,"mentorConferirFila":144,"mentorConferirContar":145,"mentorConferido":146,"mentorDescartarBkp":147,"mentorDescartar":148,"videoMentoresVerificados":149,"livroTemas":168,"livroCapitulo":169,"exportTabLivro":170,"praticaFavorito":248,"praticasFavoritas":249,"praticaTrechos":250,"praticaUma":251,"videoFavorito":180,"videoAssistido":181,"meusContar":182,"diarioInserir":183,"diarioUltimo":191,"diarioContagem":192,"diarioAtualizar":193,"diarioUm":194,"diarioApagarUltimo":195,"diarioApagar":184,"diarioListar":185,"diarioPraticas":186,"diarioResumo":187,"livroProximo":188,"livroHoje":189,"pendLista":222,"pendTotal":223,"pendCatalogoCriar":224,"pendDecidir":225,"pendNaoLivro":226,"validarLista":231,"validarAltaTotal":246,"validarAceitarAlta":247,"validarTotal":232,"catalogoBusca":233,"livroCatDe":241,"livroCatOutro":242,"livroCatEditar":243,"livroStatusGravar":244,"catalogoAchar":234,"nomeOkCat":235,"validarExportar":276,"validarSugerir":277,"validarSugerirEsp":278,"nomeNaoLivro":236,"validarOnde":238,"livrosLista":213,"livrosTotais":214,"livrosRelacao":215,"livrosDoTitulo":216,"nomeMusica":252,"outrosSubtipo":279,"nomeTipoPorNome":280,"nomeAudiovisual":253,"outrosTotais":254,"outrosLista":255,"itemStatusGravar":263,"sagradoObras":265,"sagradoPartes":266,"sagradoJuntar":267,"sagradoSeparar":268,"nomeSagrado":264,"outrosEditar":270,"outrosAceitar":271,"outrosFila":272,"outrosConferirGravar":273,"outrosVoltar":256,"favItemMarcar":257,"favItemTirar":258,"favItensTipo":259,"favItensLista":260,"favVideosLista":261,"favContagens":262,"motor":65,"canalCadastrar":87,"temaEditar":88,"resumoBusca":89,"chatBusca":90,"estudarMais":94,"mentorEditar":143,"canaisAtualizar":151,"buscaTermos":152,"configEditar":157,"livroGerar":171,"livroValidar":237,"diarioEditar":190,"exportarGerar":205,"exportarPacote":206,"exportarLeve":217,"exportarGit":288};
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
} catch (e) {
  const semAcento = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const p = semAcento(pedido);
  if (/quantos|andamento|como esta o estudo|o que falta/.test(p)) plano = { tipo: 'andamento' };
  else if (/\b(estud|rod|process|carreg)\w*\s+mais\b/.test(p)) plano = { tipo: 'estudar', quantidade: Number((p.match(/\d+/) || [50])[0]) };
  else {
    const canaisLista = ((await sql('canaisNomes', {})).rows || []);
    const canal = canaisLista.find(c => semAcento(c.NOME).split(/[^a-z0-9]+/).filter(w => w.length >= 4).some(w => p.includes(w)));
    const doCanal = new Set(canal ? semAcento(canal.NOME).split(/[^a-z0-9]+/) : []);
    const pare = new Set('a o e de da do das dos em no na nos nas um uma uns umas que se por para pra com sem sobre como qual quais quando onde porque quero queria me te ele ela eles elas isso esse essa este esta aquele aquela fala falou falam explica explique mostra mostre diga conta conte pratica praticas video videos live lives canal ele dele dela tem existe sabe pode poderia algum alguma mais muito quero entender'.split(' '));
    const palavras = [...new Set(p.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !pare.has(w) && !doCanal.has(w)))];
    plano = { tipo: 'busca', termos: palavras.sort((a, b) => b.length - a.length).slice(0, 5), ordem: /recente|ultim|novo/.test(p) ? 'recentes' : 'relevancia', somenteLives: /\blives?\b/.test(p) && /so (as )?lives|nas lives/.test(p), canalId: canal ? Number(canal.ID) : 0, semIA: true };
  }
}

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
  const achados = ((await sql('buscarTema', { tema, ordem: 'relevancia', limit: 30, offset: 0, canalId: canalBusca })).rows || []);
  const maior = Math.max(1, ...achados.map(v => Number(v.SCORE || 0)));
  const peso = 30 / Math.max(1, achados.length);
  for (const v of achados) {
    if (plano.somenteLives && v.TIPO !== 'LIVE') continue;
    const a = vids[v.ID] || (vids[v.ID] = Object.assign({}, v, { SCORE: 0, MOMS: '', ACHOU: 0 }));
    a.SCORE += Number(v.SCORE || 0) / maior * 100 * peso; a.ACHOU++; a.MOMS = [a.MOMS, v.MOMS].filter(Boolean).join(',');
  }
  for (const t of ((await sql('buscaTrechos', { tema, canalId: canalBusca })).rows || []).slice(0, 25)) trechos.push(t);
  for (const r of ((await sql('buscaResumos', { tema, canalId: canalBusca })).rows || [])) resumos[r.TITULO] = r.RESUMO;
}
let lista = Object.values(vids);
lista.sort((a, b) => ordem === 'recentes' ? String(b.PUBLICADO_EM || '').localeCompare(String(a.PUBLICADO_EM || '')) || b.SCORE - a.SCORE : b.SCORE - a.SCORE || b.ACHOU - a.ACHOU || String(b.PUBLICADO_EM || '').localeCompare(String(a.PUBLICADO_EM || '')));
lista = lista.slice(0, 30).map(v => Object.assign({}, v, { SCORE: Math.round(v.SCORE) }));
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
} catch (e) { resposta = 'A IA do Google chegou ao limite de uso de hoje, então não deu para escrever o resumo agora. Encontrei os vídeos abaixo pelas palavras ' + termos.join(', ') + '; clique num vídeo para ver os momentos em que o assunto aparece. O resumo volta quando o limite renovar (por volta das 5h).'; }
return { ok: true, resposta: resposta.replace(/\*\*?/g, ''), videos: lista, termos, ordem };
