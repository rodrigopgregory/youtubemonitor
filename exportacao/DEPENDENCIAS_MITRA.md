# Dependências do Mitra e o que reescrever fora dele

Gerado de 256 funções publicadas, do código do front-end e das conexões, em 2026-11-18T22:59:32.

## 1. Mapa número -> função -> telas

A coluna "telas que chamam" vem de uma busca por `chamar('nome'`, `chamarDemorado('nome'` e `linhas('nome'` no código do front-end. Quem chama por outro caminho **NÃO SEI** apontar. Os números são os da plataforma e mudam se as funções forem recriadas; o front usa o objeto `SF` em `codigo/frontend/src/lib/sf.ts`.

| número | função | tipo | telas que chamam | chamada por funções | SDK do Mitra usado |
|---|---|---|---|---|---|
| 32 | configLer | SQL | - | motor, resumoBusca, chatBusca, buscaTermos, livroGerar, livroValidar | - |
| 33 | configGravar | SQL | - | motor | - |
| 34 | loteGravar | SQL | - | motor, livroValidar | - |
| 35 | loteApagar | SQL | - | motor, livroValidar | - |
| 36 | videosInserirLote | SQL | - | motor | - |
| 37 | canalCargaAtualizar | SQL | - | motor | - |
| 38 | canalCargaMsg | SQL | - | motor | - |
| 39 | videosIdsCanal | SQL | - | motor | - |
| 40 | canalChecado | SQL | - | motor | - |
| 41 | trechosInserirLote | SQL | - | motor | - |
| 42 | videoProgresso | SQL | - | motor | - |
| 43 | trechosDoVideo | SQL | components/VideoDetalhe.tsx | motor | - |
| 44 | temasNomes | SQL | - | motor, chatBusca, buscaTermos | - |
| 45 | temasGarantirLote | SQL | - | motor | - |
| 46 | videoTemasIA | SQL | - | motor | - |
| 47 | videoConcluir | SQL | - | motor | - |
| 48 | videoPendente | SQL | - | motor | - |
| 49 | videoIndisponivel | SQL | - | motor | - |
| 50 | videoDetalhes | SQL | - | motor | - |
| 51 | videoForaDoFiltro | SQL | - | motor | - |
| 52 | videoOrigem | SQL | - | motor | - |
| 53 | videosRetentar | SQL | - | motor, estudarMais | - |
| 54 | canaisParaMotor | SQL | - | motor | - |
| 55 | filaProximo | SQL | - | motor | - |
| 56 | filaContar | SQL | - | motor | - |
| 57 | avisoPendentes | SQL | - | motor | - |
| 58 | avisoHoje | SQL | - | motor | - |
| 59 | avisoCriar | SQL | - | motor | - |
| 60 | avisoVincular | SQL | - | motor | - |
| 61 | avisoRecontar | SQL | - | motor | - |
| 62 | canaisAtualizarStatus | SQL | - | motor | - |
| 63 | lockAdquirir | SQL | - | motor | - |
| 64 | lockLiberar | SQL | - | motor | - |
| 65 | motor | JAVASCRIPT | - | motor, canalCadastrar, estudarMais, canaisAtualizar | executeServerFunctionMitra, callIntegrationMitra, executeServerFunctionAsyncMitra |
| 66 | canalPorYt | SQL | - | canalCadastrar | - |
| 67 | canalInserir | SQL | - | canalCadastrar | - |
| 68 | canaisListar | SQL | pages/CanaisPage.tsx | - | - |
| 69 | painelResumo | SQL | pages/InicioPage.tsx, pages/VideosPage.tsx | - | - |
| 70 | videosListar | SQL | pages/VideosPage.tsx | - | - |
| 71 | temasListar | SQL | pages/VideosPage.tsx | - | - |
| 72 | videoDetalhe | SQL | components/VideoDetalhe.tsx | - | - |
| 73 | videoTemas | SQL | components/VideoDetalhe.tsx, pages/MapaMentalPage.tsx | - | - |
| 74 | temaGarantir | SQL | - | temaEditar, mentorEditar | - |
| 75 | vtAcrescentar | SQL | - | temaEditar | - |
| 76 | vtTirar | SQL | - | temaEditar | - |
| 77 | vtRenomear | SQL | - | temaEditar | - |
| 78 | vtTirarSeOutro | SQL | - | temaEditar | - |
| 79 | videoMarcarEditado | SQL | - | temaEditar | - |
| 80 | buscarTema | SQL | - | chatBusca | - |
| 81 | buscaTrechos | SQL | - | resumoBusca, chatBusca | - |
| 82 | buscaResumos | SQL | - | resumoBusca, chatBusca | - |
| 83 | avisosListar | SQL | components/Layout.tsx | - | - |
| 84 | avisoVideos | SQL | components/Layout.tsx | - | - |
| 85 | avisoMarcarLido | SQL | - | - | - |
| 86 | motorAndamento | SQL | - | - | - |
| 87 | canalCadastrar | JAVASCRIPT | pages/CanaisPage.tsx | - | executeServerFunctionMitra, callIntegrationMitra, executeServerFunctionAsyncMitra |
| 88 | temaEditar | JAVASCRIPT | components/VideoDetalhe.tsx | - | executeServerFunctionMitra |
| 89 | resumoBusca | JAVASCRIPT | - | - | executeServerFunctionMitra, callIntegrationMitra |
| 90 | chatBusca | JAVASCRIPT | pages/ChatPage.tsx | - | executeServerFunctionMitra, callIntegrationMitra |
| 91 | canaisLimiteMais | SQL | - | estudarMais | - |
| 92 | canaisNomes | SQL | components/CanalFiltro.tsx | chatBusca | - |
| 93 | estudoAndamento | SQL | - | chatBusca | - |
| 94 | estudarMais | JAVASCRIPT | pages/ChatPage.tsx | - | executeServerFunctionMitra, executeServerFunctionAsyncMitra |
| 95 | exportVideos | SQL | lib/exportar.ts | - | - |
| 96 | exportTrechos | SQL | lib/exportar.ts | - | - |
| 97 | filaComLegenda | SQL | - | motor | - |
| 98 | videoTemasIALimpar | SQL | - | motor | - |
| 99 | playlistsGravar | SQL | - | motor | - |
| 100 | playlistsDoCanal | SQL | - | - | - |
| 101 | playlistVideosLimpar | SQL | - | motor | - |
| 102 | playlistVideosGravar | SQL | - | motor | - |
| 103 | playlistsSumidasVideos | SQL | - | motor | - |
| 104 | playlistsSumidas | SQL | - | motor | - |
| 105 | canalPlaylistsFeito | SQL | - | motor | - |
| 106 | playlistsListar | SQL | pages/VideosPage.tsx | - | - |
| 107 | exportEstrutura | SQL | - | - | - |
| 108 | exportIndices | SQL | - | - | - |
| 109 | exportTabCanais | SQL | - | - | - |
| 110 | exportTabVideos | SQL | - | - | - |
| 111 | exportTabTrechos | SQL | - | - | - |
| 112 | exportTabTemas | SQL | - | - | - |
| 113 | exportTabVideoTemas | SQL | - | - | - |
| 114 | exportTabPlaylists | SQL | - | - | - |
| 115 | exportTabPlaylistVideos | SQL | - | - | - |
| 116 | exportTabAvisos | SQL | - | - | - |
| 117 | exportTabConfig | SQL | - | - | - |
| 118 | exportVideosFiltro | SQL | lib/exportar.ts | - | - |
| 119 | praticasLimpar | SQL | - | motor | - |
| 120 | praticasGravar | SQL | - | motor | - |
| 121 | videoPraticasFeito | SQL | - | motor | - |
| 122 | praticasFila | SQL | - | motor | - |
| 123 | praticasTipos | SQL | pages/VideosPage.tsx | - | - |
| 124 | praticasDoVideo | SQL | components/VideoDetalhe.tsx, pages/MapaMentalPage.tsx | - | - |
| 125 | praticasResumo | SQL | pages/VideosPage.tsx | motor | - |
| 126 | exportTabPraticas | SQL | - | - | - |
| 127 | mentoresListar | SQL | pages/VideosPage.tsx | - | - |
| 128 | mentoresGerir | SQL | pages/ConfiguracoesPage.tsx, pages/MentoresPage.tsx | - | - |
| 129 | mentorRegrasListar | SQL | pages/ConfiguracoesPage.tsx | - | - |
| 130 | mentorVideos | SQL | pages/MentoresPage.tsx | - | - |
| 131 | mentorRegraGravar | SQL | - | mentorEditar | - |
| 132 | mentorRegraApagar | SQL | - | mentorEditar | - |
| 133 | mentorRegraApagarNome | SQL | - | mentorEditar | - |
| 134 | mentorTemaPorId | SQL | - | mentorEditar | - |
| 135 | mentorTemaPorNome | SQL | - | mentorEditar | - |
| 136 | mentorBackup | SQL | - | mentorEditar | - |
| 137 | mentorMover | SQL | - | mentorEditar | - |
| 138 | mentorDesligar | SQL | - | mentorEditar | - |
| 139 | mentorTemaApagar | SQL | - | mentorEditar | - |
| 140 | mentorTemaRenomear | SQL | - | mentorEditar | - |
| 141 | mentorMarcarTitulos | SQL | - | mentorEditar | - |
| 142 | mentorRegrasMotor | SQL | - | motor | - |
| 143 | mentorEditar | JAVASCRIPT | pages/ConfiguracoesPage.tsx, pages/MentoresPage.tsx | - | executeServerFunctionMitra |
| 144 | mentorConferirFila | SQL | - | motor | - |
| 145 | mentorConferirContar | SQL | - | motor | - |
| 146 | mentorConferido | SQL | - | motor | - |
| 147 | mentorDescartarBkp | SQL | - | motor | - |
| 148 | mentorDescartar | SQL | - | motor | - |
| 149 | videoMentoresVerificados | SQL | - | motor | - |
| 150 | videoCotaEspera | SQL | - | motor | - |
| 151 | canaisAtualizar | JAVASCRIPT | components/Layout.tsx, pages/CanaisPage.tsx | - | executeServerFunctionMitra |
| 152 | buscaTermos | JAVASCRIPT | - | - | executeServerFunctionMitra, callIntegrationMitra |
| 153 | configTelaLer | SQL | - | configEditar | - |
| 154 | configTelaGravar | SQL | - | motor, configEditar | - |
| 155 | canaisMentorLer | SQL | - | configEditar | - |
| 156 | canalMentorGravar | SQL | - | configEditar | - |
| 157 | configEditar | JAVASCRIPT | pages/ConfiguracoesPage.tsx | - | executeServerFunctionMitra |
| 158 | avisoMarcar | SQL | components/Layout.tsx | - | - |
| 159 | avisoArquivar | SQL | components/Layout.tsx | - | - |
| 160 | avisosTodosLidos | SQL | components/Layout.tsx | - | - |
| 161 | videoForaTema | SQL | components/VideoDetalhe.tsx | - | - |
| 162 | exportTabMentorRegras | SQL | - | - | - |
| 163 | exportVisoes | SQL | - | - | - |
| 164 | livroResumos | SQL | - | livroGerar | - |
| 165 | livroPraticas | SQL | - | livroGerar | - |
| 166 | livroTemaInfo | SQL | - | livroGerar | - |
| 167 | livroGravar | SQL | - | livroGerar | - |
| 168 | livroTemas | SQL | pages/InicioPage.tsx, pages/LivroPage.tsx | - | - |
| 169 | livroCapitulo | SQL | pages/LivroPage.tsx | - | - |
| 170 | exportTabLivro | SQL | - | - | - |
| 171 | livroGerar | JAVASCRIPT | pages/LivroPage.tsx | motor | executeServerFunctionMitra, callIntegrationMitra |
| 172 | iaEstado | SQL | components/EstadoIA.tsx | - | - |
| 173 | finFila | SQL | - | motor | - |
| 174 | finGravar | SQL | - | motor | - |
| 175 | finContar | SQL | - | motor | - |
| 176 | praticasMapa | SQL | - | - | - |
| 177 | praticasTiposFin | SQL | - | - | - |
| 178 | praticasLista | SQL | pages/PraticasPage.tsx | - | - |
| 179 | praticasTotais | SQL | pages/InicioPage.tsx, pages/PraticasPage.tsx | - | - |
| 180 | videoFavorito | SQL | pages/FavoritosPage.tsx | - | - |
| 181 | videoAssistido | SQL | - | - | - |
| 182 | meusContar | SQL | pages/VideosPage.tsx | - | - |
| 183 | diarioInserir | SQL | - | diarioEditar | - |
| 184 | diarioApagar | SQL | - | diarioEditar | - |
| 185 | diarioListar | SQL | pages/MinhasPraticasPage.tsx | - | - |
| 186 | diarioPraticas | SQL | pages/InicioPage.tsx, pages/MinhasPraticasPage.tsx | - | - |
| 187 | diarioResumo | SQL | pages/MinhasPraticasPage.tsx | - | - |
| 188 | livroProximo | SQL | - | motor | - |
| 189 | livroHoje | SQL | - | motor | - |
| 190 | diarioEditar | JAVASCRIPT | components/Contador.tsx, components/FizHoje.tsx, pages/MinhasPraticasPage.tsx | - | executeServerFunctionMitra |
| 191 | diarioUltimo | SQL | - | diarioEditar | - |
| 192 | diarioContagem | SQL | - | diarioEditar | - |
| 193 | diarioAtualizar | SQL | - | diarioEditar | - |
| 194 | diarioUm | SQL | - | diarioEditar | - |
| 195 | diarioApagarUltimo | SQL | - | diarioEditar | - |
| 196 | inicioVideosNovos | SQL | pages/InicioPage.tsx | - | - |
| 197 | inicioParaAssistir | SQL | pages/InicioPage.tsx | - | - |
| 198 | inicioLivroUltimo | SQL | pages/InicioPage.tsx | - | - |
| 199 | inicioPraticaDia | SQL | pages/InicioPage.tsx | - | - |
| 200 | praticasJeitos | SQL | pages/PraticasPage.tsx | - | - |
| 201 | praticasServe | SQL | pages/PraticasPage.tsx | - | - |
| 202 | praticasQuando | SQL | pages/PraticasPage.tsx | - | - |
| 203 | praticasErroAnotar | SQL | - | motor | - |
| 205 | exportarGerar | JAVASCRIPT | - | - | runQueryMitra, runDmlMitra, uploadFilePrivateMitra, listProjectUsersMitra, listProfilesMitra, getProfileDetailsMitra, listIntegrationsMitra, listServerFunctionsMitra, readServerFunctionMitra, getFileLinkMitra |
| 206 | exportarPacote | JAVASCRIPT | components/PacoteExport.tsx | - | runQueryMitra, runDmlMitra, sendEmailMitra, listServerFunctionsMitra, executeServerFunctionAsyncMitra, getFileLinkMitra |
| 207 | livrosLimpar | SQL | - | motor | - |
| 208 | livrosGravar | SQL | - | motor | - |
| 209 | videoLivrosFeito | SQL | - | motor | - |
| 210 | livrosFila | SQL | - | motor | - |
| 211 | livrosErroAnotar | SQL | - | motor | - |
| 212 | livrosResumo | SQL | - | motor | - |
| 213 | livrosLista | SQL | pages/LivrosPage.tsx | - | - |
| 214 | livrosTotais | SQL | pages/LivrosPage.tsx, pages/RelacaoLivrosPage.tsx | - | - |
| 215 | livrosRelacao | SQL | pages/RelacaoLivrosPage.tsx | - | - |
| 216 | livrosDoTitulo | SQL | pages/RelacaoLivrosPage.tsx | - | - |
| 217 | exportarLeve | JAVASCRIPT | - | - | runQueryMitra, runDmlMitra, getFileLinkMitra, listProfilesMitra, getProfileDetailsMitra, listIntegrationsMitra, listServerFunctionsMitra, readServerFunctionMitra, uploadFilePrivateMitra |
| 218 | nomesFila | SQL | - | motor | - |
| 219 | nomesCatalogoGravar | SQL | - | motor, livroValidar | - |
| 220 | nomesOkGravar | SQL | - | motor, livroValidar | - |
| 221 | nomesPendGravar | SQL | - | motor, livroValidar | - |
| 222 | pendLista | SQL | components/PendenciasLivros.tsx | - | - |
| 223 | pendTotal | SQL | components/PendenciasLivros.tsx | - | - |
| 224 | pendCatalogoCriar | SQL | components/PendenciasLivros.tsx, pages/RelacaoLivrosPage.tsx, pages/ValidarLivrosPage.tsx | - | - |
| 225 | pendDecidir | SQL | components/PendenciasLivros.tsx | - | - |
| 226 | pendNaoLivro | SQL | components/PendenciasLivros.tsx, pages/OutrosNomesPage.tsx, pages/SagradosPage.tsx | - | - |
| 227 | validarUm | SQL | - | livroValidar | - |
| 228 | nomeEstado | SQL | - | livroValidar | - |
| 229 | nomesOkAtualizar | SQL | - | livroValidar | - |
| 230 | nomesPendAtualizar | SQL | - | livroValidar | - |
| 231 | validarLista | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 232 | validarTotal | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 233 | catalogoBusca | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 234 | catalogoAchar | SQL | pages/RelacaoLivrosPage.tsx, pages/ValidarLivrosPage.tsx | - | - |
| 235 | nomeOkCat | SQL | pages/RelacaoLivrosPage.tsx, pages/ValidarLivrosPage.tsx | - | - |
| 236 | nomeNaoLivro | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 237 | livroValidar | JAVASCRIPT | pages/ValidarLivrosPage.tsx | - | executeServerFunctionMitra, callIntegrationMitra |
| 238 | validarOnde | SQL | pages/OutrosNomesPage.tsx, pages/SagradosPage.tsx, pages/ValidarLivrosPage.tsx | - | - |
| 239 | nomesCatalogoLer | SQL | - | motor | - |
| 240 | nomesSemDecisao | SQL | - | motor | - |
| 241 | livroCatDe | SQL | pages/RelacaoLivrosPage.tsx | - | - |
| 242 | livroCatOutro | SQL | pages/RelacaoLivrosPage.tsx | - | - |
| 243 | livroCatEditar | SQL | pages/RelacaoLivrosPage.tsx | - | - |
| 244 | livroStatusGravar | SQL | pages/RelacaoLivrosPage.tsx | - | - |
| 245 | nomesCertezaGravar | SQL | - | motor | - |
| 246 | validarAltaTotal | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 247 | validarAceitarAlta | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 248 | praticaFavorito | SQL | components/FavoritaPratica.tsx | - | - |
| 249 | praticasFavoritas | SQL | pages/FavoritosPage.tsx, pages/MinhasPraticasPage.tsx | - | - |
| 250 | praticaTrechos | SQL | components/PraticaDetalhe.tsx | - | - |
| 251 | praticaUma | SQL | components/PraticaDetalhe.tsx | - | - |
| 252 | nomeMusica | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 253 | nomeAudiovisual | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 254 | outrosTotais | SQL | - | - | - |
| 255 | outrosLista | SQL | pages/OutrosNomesPage.tsx | - | - |
| 256 | outrosVoltar | SQL | pages/OutrosNomesPage.tsx, pages/SagradosPage.tsx | - | - |
| 257 | favItemMarcar | SQL | - | - | - |
| 258 | favItemTirar | SQL | pages/FavoritosPage.tsx | - | - |
| 259 | favItensTipo | SQL | components/EstrelaItem.tsx | - | - |
| 260 | favItensLista | SQL | pages/FavoritosPage.tsx | - | - |
| 261 | favVideosLista | SQL | pages/FavoritosPage.tsx | - | - |
| 262 | favContagens | SQL | pages/FavoritosPage.tsx | - | - |
| 263 | itemStatusGravar | SQL | pages/OutrosNomesPage.tsx, pages/SagradosPage.tsx | - | - |
| 264 | nomeSagrado | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 265 | sagradoObras | SQL | pages/SagradosPage.tsx | - | - |
| 266 | sagradoPartes | SQL | pages/SagradosPage.tsx | - | - |
| 267 | sagradoJuntar | SQL | pages/SagradosPage.tsx | - | - |
| 268 | sagradoSeparar | SQL | pages/SagradosPage.tsx | - | - |
| 269 | nomeTipoIA | SQL | - | motor | - |
| 270 | outrosEditar | SQL | components/EditarNome.tsx | - | - |
| 271 | outrosAceitar | SQL | pages/OutrosNomesPage.tsx | - | - |
| 272 | outrosFila | SQL | - | motor | - |
| 273 | outrosConferirGravar | SQL | - | motor | - |
| 274 | pendRefinoFila | SQL | - | motor | - |
| 275 | pendRefinoGravar | SQL | - | motor | - |
| 276 | validarExportar | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 277 | validarSugerir | SQL | - | - | - |
| 278 | validarSugerirEsp | SQL | - | - | - |
| 279 | outrosSubtipo | SQL | pages/OutrosNomesPage.tsx | - | - |
| 280 | nomeTipoPorNome | SQL | pages/ValidarLivrosPage.tsx | - | - |
| 281 | vtMomentos | SQL | - | temaEditar | - |
| 282 | mapaTemasLista | SQL | pages/MapaMentalPage.tsx | - | - |
| 283 | mapaTemaJeitos | SQL | pages/MapaMentalPage.tsx | - | - |
| 284 | mapaTemaPraticas | SQL | pages/MapaMentalPage.tsx | - | - |
| 285 | mapaTemaVideos | SQL | pages/MapaMentalPage.tsx | - | - |
| 286 | mapaTemaLigados | SQL | pages/MapaMentalPage.tsx | - | - |
| 287 | mapaVideoBusca | SQL | pages/MapaMentalPage.tsx | - | - |
| 288 | exportarGit | JAVASCRIPT | - | - | runQueryMitra, runDmlMitra, getFileLinkMitra |

## 2. Consultas que usam o usuário logado

Funções cujo código cita usuário (userId, user_id, currentUser e parecidos): `exportarGerar`, `exportarLeve`.

## 3. Uso do SDK do Mitra

**No servidor** (cada função JavaScript, pelo prefixo `m.`):

- `motor`: executeServerFunctionMitra, callIntegrationMitra, executeServerFunctionAsyncMitra
- `canalCadastrar`: executeServerFunctionMitra, callIntegrationMitra, executeServerFunctionAsyncMitra
- `temaEditar`: executeServerFunctionMitra
- `resumoBusca`: executeServerFunctionMitra, callIntegrationMitra
- `chatBusca`: executeServerFunctionMitra, callIntegrationMitra
- `estudarMais`: executeServerFunctionMitra, executeServerFunctionAsyncMitra
- `mentorEditar`: executeServerFunctionMitra
- `canaisAtualizar`: executeServerFunctionMitra
- `buscaTermos`: executeServerFunctionMitra, callIntegrationMitra
- `configEditar`: executeServerFunctionMitra
- `livroGerar`: executeServerFunctionMitra, callIntegrationMitra
- `diarioEditar`: executeServerFunctionMitra
- `exportarGerar`: runQueryMitra, runDmlMitra, uploadFilePrivateMitra, listProjectUsersMitra, listProfilesMitra, getProfileDetailsMitra, listIntegrationsMitra, listServerFunctionsMitra, readServerFunctionMitra, getFileLinkMitra
- `exportarPacote`: runQueryMitra, runDmlMitra, sendEmailMitra, listServerFunctionsMitra, executeServerFunctionAsyncMitra, getFileLinkMitra
- `exportarLeve`: runQueryMitra, runDmlMitra, getFileLinkMitra, listProfilesMitra, getProfileDetailsMitra, listIntegrationsMitra, listServerFunctionsMitra, readServerFunctionMitra, uploadFilePrivateMitra
- `livroValidar`: executeServerFunctionMitra, callIntegrationMitra
- `exportarGit`: runQueryMitra, runDmlMitra, getFileLinkMitra

**No front-end** (`mitra-interactions-sdk`):

- `lib/api.ts`: executeServerFunctionMitra, executeServerFunctionAsyncMitra, executePublicServerFunctionMitra, executePublicServerFunctionAsyncMitra, getPublicServerFunctionExecutionMitra
- `lib/mitra-auth.ts`: configureSdkMitra
- `pages/LoginPage.tsx`: loginWithGoogleMitra, loginWithMicrosoftMitra, emailLoginMitra, emailSignupMitra, emailVerifyCodeMitra, emailResendCodeMitra, sendPasswordResetCodeMitra, validatePasswordResetCodeMitra, resetPasswordMitra,

Autenticação do front: `codigo/frontend/src/lib/mitra-auth.ts` (variáveis `VITE_MITRA_AUTH_URL` e `VITE_MITRA_PROJECT_ID`; sessão no `localStorage`, chave `mitra-session`).

## 4. Upload e link de arquivo

- `exportarGerar`: uploadFilePrivateMitra, listProfilesMitra, getProfileDetailsMitra, getFileLinkMitra
- `exportarPacote`: getFileLinkMitra
- `exportarLeve`: getFileLinkMitra, listProfilesMitra, getProfileDetailsMitra, uploadFilePrivateMitra
- `exportarGit`: getFileLinkMitra

O app gera ZIPs de exportação e entrega por link temporário (`getFileLinkMitra`). O arquivo enviado é privado (`uploadFilePrivateMitra`). Fora do Mitra isso vira armazenamento de objetos com URL assinada.

## 5. Rotinas agendadas

| função | cron | entrada | o que faz |
|---|---|---|---|
| motor | `0 5 * * * *` | `` | Motor: carga histórica, checagem diária e estudo dos vídeos |

O formato do cron tem 6 campos (segundo, minuto, hora, dia, mês, dia da semana): `0 5 * * * *` lê-se como "no minuto 5 de toda hora". **NÃO SEI** confirmar o fuso do agendador do Mitra. O `motor` também se reagenda sozinho (`modo: continuar`) enquanto houver trabalho. Dentro dele: a checagem diária de canais roda na primeira execução depois de `CONFIG.HORA_CHECAGEM` (hora de Brasília) em que `ULTIMA_CHECAGEM_DIA` ainda não é o dia de hoje; o Livro Vivo é escrito de madrugada (hora de Brasília entre 1 e 7), no máximo `CONFIG.LIVRO_POR_NOITE` por dia.

## 6. Conexões usadas

Nomes de conexão que o motor usa para o Gemini (de `CONFIG.GEMINI_CONEXOES`): gemini5, gemini4, gemini3, gemini, gemini2, gemini6, gemini7, gemini8, gemini9. O YouTube é acessado pela conexão `youtube-web` (páginas públicas). Lista completa em `plataforma/conexoes.json`.

## 7. O que precisa ser reescrito fora do Mitra

- **Server Functions SQL** (239): viram consultas parametrizadas no seu back-end. O marcador `{{nome}}` hoje é substituído como texto pela plataforma; fora dela use parâmetros de verdade (evita injeção de SQL).
- **Server Functions JavaScript** (17): usam `require('mitra-sdk')`, a variável `event` e `return` no nível de cima. Precisam virar módulos com o mesmo contrato, trocando cada `m.*Mitra` listado na seção 3.
- **Banco**: `banco/schema.sql` (MySQL 8, collation `utf8mb4_bin`, FULLTEXT em `TRECHOS.TEXTO`). A busca por texto depende do FULLTEXT.
- **Gemini**: sai de `callIntegrationMitra` para chamada direta à API do Google, com rodízio de chaves e modelos (REGRAS_DE_CLASSIFICACAO.md, seção 1).
- **YouTube**: o motor lê as páginas públicas pela conexão do Mitra; fora dele é preciso chamar as mesmas URLs.
- **Agendador**: o cron do Mitra vira cron do servidor ou fila.
- **Login e perfis**: a autenticação e a permissão por função são do Mitra; fora dele é preciso criar login e controle de acesso.
- **Front-end**: troca o SDK do Mitra (`api.ts`, `mitra-auth.ts`) por chamadas ao novo back-end.
