const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = {"configLer":32,"configGravar":33,"loteGravar":34,"loteApagar":35,"videosInserirLote":36,"canalCargaAtualizar":37,"canalCargaMsg":38,"videosIdsCanal":39,"canalChecado":40,"trechosInserirLote":41,"videoProgresso":42,"trechosDoVideo":43,"temasNomes":44,"temasGarantirLote":45,"videoTemasIALimpar":98,"videoTemasIA":46,"videoConcluir":47,"videoPendente":48,"videoIndisponivel":49,"videoDetalhes":50,"videoForaDoFiltro":51,"videoOrigem":52,"videoCotaEspera":150,"videosRetentar":53,"canaisParaMotor":54,"filaComLegenda":97,"filaProximo":55,"filaContar":56,"avisoPendentes":57,"avisoHoje":58,"avisoCriar":59,"avisoVincular":60,"avisoRecontar":61,"canaisAtualizarStatus":62,"lockAdquirir":63,"playlistsGravar":99,"playlistVideosLimpar":101,"playlistVideosGravar":102,"playlistsSumidasVideos":103,"playlistsSumidas":104,"canalPlaylistsFeito":105,"praticasLimpar":119,"praticasGravar":120,"videoPraticasFeito":121,"praticasFila":122,"praticasErroAnotar":203,"nomeTipoIA":269,"livrosLimpar":207,"livrosGravar":208,"videoLivrosFeito":209,"validarUm":227,"nomeEstado":228,"nomesOkAtualizar":229,"nomesPendAtualizar":230,"nomesFila":218,"nomesCatalogoLer":239,"nomesSemDecisao":240,"nomesCatalogoGravar":219,"nomesOkGravar":220,"pendRefinoFila":274,"pendRefinoGravar":275,"nomesCertezaGravar":245,"nomesPendGravar":221,"livrosFila":210,"livrosErroAnotar":211,"livrosResumo":212,"livroResumos":164,"livroPraticas":165,"livroTemaInfo":166,"livroGravar":167,"finFila":173,"finGravar":174,"finContar":175,"lockLiberar":64,"inicioVideosNovos":196,"inicioParaAssistir":197,"inicioLivroUltimo":198,"inicioPraticaDia":199,"praticasJeitos":200,"praticasServe":201,"praticasQuando":202,"praticasLista":178,"praticasTotais":179,"playlistsListar":106,"canalPorYt":66,"canalInserir":67,"canaisListar":68,"painelResumo":69,"videosListar":70,"temasListar":71,"mentoresListar":127,"videoDetalhe":72,"videoTemas":73,"temaGarantir":74,"vtAcrescentar":75,"vtMomentos":281,"mapaTemasLista":282,"mapaTemaJeitos":283,"mapaTemaPraticas":284,"mapaTemaVideos":285,"mapaTemaLigados":286,"mapaVideoBusca":287,"vtTirar":76,"vtRenomear":77,"vtTirarSeOutro":78,"videoForaTema":161,"videoMarcarEditado":79,"buscarTema":80,"buscaTrechos":81,"buscaResumos":82,"avisosListar":83,"avisoVideos":84,"avisoMarcar":158,"avisoArquivar":159,"avisosTodosLidos":160,"avisoMarcarLido":85,"motorAndamento":86,"canaisLimiteMais":91,"canaisNomes":92,"estudoAndamento":93,"exportVideos":95,"exportTrechos":96,"exportEstrutura":107,"exportIndices":108,"exportTabCanais":109,"exportTabVideos":110,"exportTabTrechos":111,"exportTabTemas":112,"exportTabVideoTemas":113,"exportTabPlaylists":114,"exportTabPlaylistVideos":115,"exportTabAvisos":116,"exportVideosFiltro":118,"praticasTipos":123,"praticasDoVideo":124,"iaEstado":172,"praticasResumo":125,"exportTabMentorRegras":162,"exportVisoes":163,"exportTabPraticas":126,"exportTabConfig":117,"mentoresGerir":128,"configTelaLer":153,"configTelaGravar":154,"canaisMentorLer":155,"canalMentorGravar":156,"mentorRegrasListar":129,"mentorVideos":130,"mentorRegraGravar":131,"mentorRegraApagar":132,"mentorRegraApagarNome":133,"mentorTemaPorId":134,"mentorTemaPorNome":135,"mentorBackup":136,"mentorMover":137,"mentorDesligar":138,"mentorTemaApagar":139,"mentorTemaRenomear":140,"mentorMarcarTitulos":141,"mentorRegrasMotor":142,"mentorConferirFila":144,"mentorConferirContar":145,"mentorConferido":146,"mentorDescartarBkp":147,"mentorDescartar":148,"videoMentoresVerificados":149,"livroTemas":168,"livroCapitulo":169,"exportTabLivro":170,"praticaFavorito":248,"praticasFavoritas":249,"praticaTrechos":250,"praticaUma":251,"videoFavorito":180,"videoAssistido":181,"meusContar":182,"diarioInserir":183,"diarioUltimo":191,"diarioContagem":192,"diarioAtualizar":193,"diarioUm":194,"diarioApagarUltimo":195,"diarioApagar":184,"diarioListar":185,"diarioPraticas":186,"diarioResumo":187,"livroProximo":188,"livroHoje":189,"pendLista":222,"pendTotal":223,"pendCatalogoCriar":224,"pendDecidir":225,"pendNaoLivro":226,"validarLista":231,"validarAltaTotal":246,"validarAceitarAlta":247,"validarTotal":232,"catalogoBusca":233,"livroCatDe":241,"livroCatOutro":242,"livroCatEditar":243,"livroStatusGravar":244,"catalogoAchar":234,"nomeOkCat":235,"validarExportar":276,"validarSugerir":277,"validarSugerirEsp":278,"nomeNaoLivro":236,"validarOnde":238,"livrosLista":213,"livrosTotais":214,"livrosRelacao":215,"livrosDoTitulo":216,"nomeMusica":252,"outrosSubtipo":279,"nomeTipoPorNome":280,"nomeAudiovisual":253,"outrosTotais":254,"outrosLista":255,"itemStatusGravar":263,"sagradoObras":265,"sagradoPartes":266,"sagradoJuntar":267,"sagradoSeparar":268,"nomeSagrado":264,"outrosEditar":270,"outrosAceitar":271,"outrosFila":272,"outrosConferirGravar":273,"outrosVoltar":256,"favItemMarcar":257,"favItemTirar":258,"favItensTipo":259,"favItensLista":260,"favVideosLista":261,"favContagens":262,"motor":65,"canalCadastrar":87,"temaEditar":88,"resumoBusca":89,"chatBusca":90,"estudarMais":94,"mentorEditar":143,"canaisAtualizar":151,"buscaTermos":152,"configEditar":157,"livroGerar":171,"livroValidar":237,"diarioEditar":190,"exportarGerar":205,"exportarPacote":206,"exportarLeve":217,"exportarGit":288};
async function sql(nome, input) {
  const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF[nome], input: input || {} });
  const res = r.result || r;
  if (res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res.error).slice(0, 300));
  return res.output;
}
const acao = String(event.acao || '');
const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const diaOk = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && String(d) <= hoje ? String(d) : hoje;
const humorOk = v => { const h = Math.floor(Number(v || 0)); return h >= 1 && h <= 5 ? h : 0; };
const textoOk = v => String(v || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 2000).replace(/\{\{/g, '{ {');
async function contagem(praticaId) {
  const c = ((await sql('diarioContagem', { praticaId })).rows || [{}])[0] || {};
  return { vezes: Number(c.VEZES || 0), ultima: c.ULTIMA || null };
}
async function doRegistro(id) {
  return ((await sql('diarioUm', { id })).rows || [])[0];
}
if (acao === 'apagar' || acao === 'editar') {
  const id = Math.floor(Number(event.id));
  if (!(id > 0)) return { ok: false, erro: 'Registro não informado.' };
  const reg = await doRegistro(id);
  if (!reg) return { ok: false, erro: 'Registro não encontrado.' };
  if (acao === 'apagar') await sql('diarioApagar', { id });
  else await sql('diarioAtualizar', { id, dia: diaOk(event.dia), humor: humorOk(event.humor), sentiu: textoOk(event.sentiu) });
  return { ok: true, praticaId: Number(reg.PRATICA_ID), ...(await contagem(Number(reg.PRATICA_ID))) };
}
if (acao === 'desfazer' || acao === 'ultimo') {
  const praticaId = Math.floor(Number(event.praticaId));
  if (!(praticaId > 0)) return { ok: false, erro: 'Prática não informada.' };
  if (acao === 'desfazer') await sql('diarioApagarUltimo', { praticaId });
  const u = ((await sql('diarioUltimo', { praticaId })).rows || [])[0];
  if (acao === 'ultimo') return u ? { ok: true, registro: { ID: Number(u.ID), DIA: u.DIA, HUMOR: u.HUMOR, SENTIU: u.SENTIU } } : { ok: false, erro: 'Nenhum registro ainda.' };
  return { ok: true, praticaId, ...(await contagem(praticaId)) };
}
if (acao !== 'fiz') return { ok: false, erro: 'Ação desconhecida.' };
const praticaId = Math.floor(Number(event.praticaId));
if (!(praticaId > 0)) return { ok: false, erro: 'Prática não informada.' };
const r = await sql('diarioInserir', { praticaId, dia: diaOk(event.dia), humor: humorOk(event.humor), sentiu: textoOk(event.sentiu) });
if (!r || !r.affectedRows) return { ok: false, erro: 'Prática não encontrada.' };
const u = ((await sql('diarioUltimo', { praticaId })).rows || [{}])[0] || {};
return { ok: true, id: Number(u.ID || 0), praticaId, vezes: Number(u.VEZES || 0), ultima: u.ULTIMA || null };
