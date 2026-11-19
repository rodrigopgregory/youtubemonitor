const m = require('mitra-sdk');
const crypto = require('crypto');
const pid = Number(process.env.MITRA_PROJECT_ID);
const agora = (ms) => new Date(Date.now() + (ms || 0) - 3 * 3600e3).toISOString().slice(0, 19);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\0/g, '');
const inteiro = n => { const v = Number(n); if (!Number.isSafeInteger(v) || v < 0) throw new Error('número inválido'); return v; };
const hex = (s) => /^[0-9a-f]{32,64}$/.test(String(s || '')) ? String(s) : '';
async function q(sql) { const r = await m.runQueryMitra({ projectId: pid, sql }); return (r.result || r).rows || []; }
async function dml(sql) { return m.runDmlMitra({ projectId: pid, sql }); }
async function log(email, evento, resultado, detalhe, tamanho) {
  await dml("INSERT INTO EXPORT_LOG (QUANDO, EMAIL, EVENTO, RESULTADO, TAMANHO_BYTES, DETALHE) VALUES ('" + agora() + "'," + (email ? "'" + esc(String(email).slice(0, 190)) + "'" : 'NULL') + ",'" + esc(evento) + "','" + esc(resultado) + "'," + (tamanho ? inteiro(tamanho) : 'NULL') + ",'" + esc(String(detalhe || '').slice(0, 480)) + "')");
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const acao = String(event.acao || 'estado');
const emailRaw = String(event.email || '').trim().toLowerCase().slice(0, 190);
const emailOk = /^[^\s@'"\\]+@[^\s@'"\\]+\.[^\s@'"\\]+$/.test(emailRaw);
async function sessaoValida() {
  const tok = hex(event.sessao); if (!tok) return null;
  const r = await q("SELECT EMAIL FROM EXPORT_SESSOES WHERE HASH = '" + sha(tok) + "' AND EXPIRA_EM > '" + agora() + "' LIMIT 1");
  if (!r.length) return null;
  const dono = await q("SELECT EMAIL FROM EXPORT_DONOS WHERE ATIVO = 1 AND LOWER(EMAIL) = '" + esc(String(r[0].EMAIL).toLowerCase()) + "'");
  return dono.length ? String(r[0].EMAIL).toLowerCase() : null;
}
const NEG = { ok: false, erro: 'Acesso negado. Peça um novo código.' };
if (acao === 'pedirCodigo') {
  const generico = { ok: true, mensagem: 'Se a conta for autorizada, o código chegou por e-mail e vale 10 minutos.' };
  if (!emailOk) { await log(null, 'codigo_pedido', 'recusado', 'e-mail inválido'); return generico; }
  const dono = await q("SELECT EMAIL FROM EXPORT_DONOS WHERE ATIVO = 1 AND LOWER(EMAIL) = '" + esc(emailRaw) + "'");
  if (!dono.length) { await log(emailRaw, 'codigo_pedido', 'recusado', 'conta não autorizada'); return generico; }
  const recentes = await q("SELECT COUNT(*) N FROM EXPORT_CODIGOS WHERE EMAIL = '" + esc(emailRaw) + "' AND CRIADO_EM > '" + agora(-10 * 60e3) + "'");
  if (Number(recentes[0].N) >= 3) { await log(emailRaw, 'codigo_pedido', 'recusado', 'limite de 3 pedidos em 10 min'); return { ok: false, erro: 'Muitos pedidos. Espere alguns minutos.' }; }
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const sal = crypto.randomBytes(16).toString('hex');
  await dml("UPDATE EXPORT_CODIGOS SET USADO = 1 WHERE EMAIL = '" + esc(emailRaw) + "' AND USADO = 0");
  await dml("INSERT INTO EXPORT_CODIGOS (EMAIL, SAL, HASH, EXPIRA_EM, TENTATIVAS, USADO, CRIADO_EM) VALUES ('" + esc(emailRaw) + "','" + sal + "','" + sha(sal + codigo) + "','" + agora(10 * 60e3) + "',0,0,'" + agora() + "')");
  await m.sendEmailMitra({ projectId: pid, to: [emailRaw], subject: 'Código para exportar o Monitor de Canais', body: '<p>Seu código de exportação é <b style="font-size:20px">' + codigo + '</b>.</p><p>Vale por 10 minutos e só funciona uma vez. Se você não pediu, ignore este e-mail.</p>' });
  await log(emailRaw, 'codigo_pedido', 'ok', 'código enviado');
  return generico;
}
if (acao === 'validarCodigo') {
  const cod = String(event.codigo || '').trim();
  if (!emailOk || !/^\d{6}$/.test(cod)) { await log(emailOk ? emailRaw : null, 'codigo_validar', 'recusado', 'formato'); return NEG; }
  const r = await q("SELECT ID, SAL, HASH, TENTATIVAS FROM EXPORT_CODIGOS WHERE EMAIL = '" + esc(emailRaw) + "' AND USADO = 0 AND EXPIRA_EM > '" + agora() + "' ORDER BY ID DESC LIMIT 1");
  if (!r.length) { await log(emailRaw, 'codigo_validar', 'recusado', 'sem código válido'); return NEG; }
  const reg = r[0]; const cid = inteiro(reg.ID);
  if (Number(reg.TENTATIVAS) >= 5) { await dml("UPDATE EXPORT_CODIGOS SET USADO = 1 WHERE ID = " + cid); await log(emailRaw, 'codigo_validar', 'recusado', 'tentativas esgotadas'); return NEG; }
  await dml("UPDATE EXPORT_CODIGOS SET TENTATIVAS = TENTATIVAS + 1 WHERE ID = " + cid);
  const a = Buffer.from(sha(reg.SAL + cod)), b = Buffer.from(String(reg.HASH));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { await log(emailRaw, 'codigo_validar', 'recusado', 'código errado'); return NEG; }
  await dml("UPDATE EXPORT_CODIGOS SET USADO = 1 WHERE ID = " + cid);
  const tok = crypto.randomBytes(32).toString('hex');
  await dml("INSERT INTO EXPORT_SESSOES (EMAIL, HASH, CRIADO_EM, EXPIRA_EM) VALUES ('" + esc(emailRaw) + "','" + sha(tok) + "','" + agora() + "','" + agora(60 * 60e3) + "')");
  await log(emailRaw, 'codigo_validar', 'ok', 'sessão de 60 min');
  return { ok: true, sessao: tok, valeMinutos: 60 };
}
const quem = await sessaoValida();
if (!quem) { await log(emailOk ? emailRaw : null, acao, 'recusado', 'sem sessão válida'); return NEG; }
async function ultimo() {
  const r = await q("SELECT ID, ESTADO, ETAPA, CRIADO_EM, TERMINOU_EM, DADOS_EM, CODIGO_EM, ERRO, RESUMO_JSON FROM EXPORT_PACOTES ORDER BY ID DESC LIMIT 1");
  return r[0] || null;
}
if (acao === 'iniciar') {
  const u = await ultimo();
  if (u && u.ESTADO === 'GERANDO' && u.CRIADO_EM > agora(-70 * 60e3)) { await log(quem, 'geracao_pedido', 'recusado', 'já existe geração em andamento'); return { ok: true, jaGerando: true, pacoteId: Number(u.ID) }; }
  if (u && u.ESTADO === 'GERANDO') await dml("UPDATE EXPORT_PACOTES SET ESTADO = 'ERRO', ERRO = 'Geração anterior não terminou.' WHERE ID = " + inteiro(u.ID));
  const lista = await m.listServerFunctionsMitra({ projectId: pid });
  const fn = (lista.result || lista).find(f => f.name === 'exportarGerar');
  if (!fn) return { ok: false, erro: 'Gerador não encontrado.' };
  await log(quem, 'geracao_pedido', 'ok', 'geração iniciada');
  await m.executeServerFunctionAsyncMitra({ projectId: pid, serverFunctionId: fn.id, input: { email: quem } });
  return { ok: true, iniciado: true };
}
if (acao === 'estado') {
  const u = await ultimo();
  const cod = (await q("SELECT GERADO_EM, COMMIT_HASH, TAMANHO_BYTES FROM EXPORT_CODIGO_DEV ORDER BY ID DESC LIMIT 1"))[0] || null;
  if (!u) return { ok: true, vazio: true, codigo: cod };
  let resumo = null; try { resumo = u.RESUMO_JSON ? JSON.parse(u.RESUMO_JSON) : null; } catch (e) {}
  const partes = await q("SELECT ID, NOME, TAMANHO_BYTES, SHA256 FROM EXPORT_PARTES WHERE PACOTE_ID = " + inteiro(u.ID) + " ORDER BY ID");
  return { ok: true, pacoteId: Number(u.ID), estado: u.ESTADO, etapa: u.ETAPA, criadoEm: u.CRIADO_EM, terminouEm: u.TERMINOU_EM, dadosEm: u.DADOS_EM, codigoEm: u.CODIGO_EM, erro: u.ERRO, totais: resumo && resumo.totais, tamanhoTotal: resumo && resumo.tamanho_total_bytes, conferidas: resumo && resumo.todas_as_partes_conferidas, partes: partes.map(p => ({ id: Number(p.ID), nome: p.NOME, tamanho: Number(p.TAMANHO_BYTES), sha256: p.SHA256 })), codigoDev: cod ? { geradoEm: cod.GERADO_EM, commit: cod.COMMIT_HASH } : null };
}
if (acao === 'link') {
  const parteId = inteiro(event.parteId);
  const r = await q("SELECT p.ID, p.NOME, p.CHAVE_ARQUIVO, p.TAMANHO_BYTES FROM EXPORT_PARTES p JOIN EXPORT_PACOTES k ON k.ID = p.PACOTE_ID WHERE p.ID = " + parteId + " AND k.ESTADO = 'PRONTO'");
  if (!r.length) { await log(quem, 'download', 'recusado', 'parte inexistente ' + parteId); return { ok: false, erro: 'Parte não encontrada.' }; }
  const l = await m.getFileLinkMitra({ projectId: pid, key: r[0].CHAVE_ARQUIVO, ttlSeconds: 90 });
  await dml("UPDATE EXPORT_PARTES SET EXPIRA_EM = '" + agora(90e3) + "', LINK_USADO = LINK_USADO + 1 WHERE ID = " + parteId);
  await log(quem, 'download', 'ok', r[0].NOME, Number(r[0].TAMANHO_BYTES));
  return { ok: true, url: (l.result || l).url, nome: r[0].NOME, valeSegundos: 90 };
}
return { ok: false, erro: 'Ação desconhecida.' };
