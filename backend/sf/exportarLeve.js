const m = require('mitra-sdk');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const pid = Number(process.env.MITRA_PROJECT_ID);
const INTERNO = /^(INT_|DIM_|CAD_|CC_|CUBE_|CUB_|CONNECTION|DATABASECHANGELOG|JAVA_DATE_FORMAT)/;
const SO_ESTRUTURA = t => /^EXPORT_/.test(t) || t === 'LOTES';
const agora = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\0/g, '');
const id = s => '`' + String(s).replace(/`/g, '``') + '`';
const inteiro = n => { const v = Number(n); if (!Number.isSafeInteger(v)) throw new Error('inteiro inválido'); return v; };
const hms = s => { s = Math.max(0, Math.floor(Number(s) || 0)); const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), x = s % 60; return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
async function q(sql) { const r = await m.runQueryMitra({ projectId: pid, sql }); const x = r.result || r; return x.rows || []; }
async function dml(sql) { return m.runDmlMitra({ projectId: pid, sql }); }
const sqlLit = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? (Number.isFinite(v) ? String(v) : 'NULL') : typeof v === 'boolean' ? (v ? '1' : '0') : "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\0/g, '\\0').replace(/\x1a/g, '\\Z') + "'";
const csvCel = (v, nulo) => v === null || v === undefined ? nulo : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? '1' : '0') : '"' + String(v).replace(/"/g, '""') + '"';
const csvLinha = (arr, nulo) => arr.map(v => csvCel(v, nulo)).join(',') + '\n';
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; } return t; })();
const crcUpd = (crc, buf) => { let c = crc; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return c; };
const DT = new Date(Date.now() - 3 * 3600e3);
const DOSTIME = (DT.getUTCHours() << 11) | (DT.getUTCMinutes() << 5) | (DT.getUTCSeconds() >> 1);
const DOSDATE = ((DT.getUTCFullYear() - 1980) << 9) | ((DT.getUTCMonth() + 1) << 5) | DT.getUTCDate();
class Zip {
  constructor(path) { this.path = path; this.fd = fs.openSync(path, 'w'); this.off = 0; this.entries = []; this.cur = null; }
  raw(buf) { fs.writeSync(this.fd, buf, 0, buf.length); this.off += buf.length; }
  begin(name) {
    const nameBuf = Buffer.from(name, 'utf8');
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0808, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(DOSTIME, 10); h.writeUInt16LE(DOSDATE, 12); h.writeUInt16LE(nameBuf.length, 26);
    const cur = { name, nameBuf, off: this.off, crc: -1, usize: 0, csize: 0, sha: crypto.createHash('sha256'), def: zlib.createDeflateRaw({ level: 6 }) };
    this.raw(h); this.raw(nameBuf);
    cur.def.on('data', c => { cur.csize += c.length; this.raw(c); });
    cur.done = new Promise((res, rej) => { cur.def.on('end', res); cur.def.on('error', rej); });
    this.cur = cur;
  }
  async write(data) {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const c = this.cur; c.crc = crcUpd(c.crc, buf); c.usize += buf.length; c.sha.update(buf);
    if (!c.def.write(buf)) await new Promise(r => c.def.once('drain', r));
  }
  async end() {
    const c = this.cur; c.def.end(); await c.done;
    const crc = (c.crc ^ -1) >>> 0;
    const d = Buffer.alloc(16); d.writeUInt32LE(0x08074b50, 0); d.writeUInt32LE(crc, 4); d.writeUInt32LE(c.csize, 8); d.writeUInt32LE(c.usize, 12); this.raw(d);
    const e = { name: c.name, nameBuf: c.nameBuf, off: c.off, crc, csize: c.csize, usize: c.usize, sha256: c.sha.digest('hex') };
    this.entries.push(e); this.cur = null; return e;
  }
  async add(name, data) { this.begin(name); await this.write(data); return this.end(); }
  close() {
    const ini = this.off; let tam = 0;
    for (const e of this.entries) {
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE((3 << 8) | 20, 4); h.writeUInt16LE(20, 6); h.writeUInt16LE(0x0808, 8); h.writeUInt16LE(8, 10);
      h.writeUInt16LE(DOSTIME, 12); h.writeUInt16LE(DOSDATE, 14); h.writeUInt32LE(e.crc, 16); h.writeUInt32LE(e.csize, 20); h.writeUInt32LE(e.usize, 24);
      h.writeUInt16LE(e.nameBuf.length, 28); h.writeUInt32LE((0o100644 << 16) >>> 0, 38); h.writeUInt32LE(e.off, 42);
      this.raw(h); this.raw(e.nameBuf); tam += 46 + e.nameBuf.length;
    }
    const f = Buffer.alloc(22);
    f.writeUInt32LE(0x06054b50, 0); f.writeUInt16LE(this.entries.length, 8); f.writeUInt16LE(this.entries.length, 10); f.writeUInt32LE(tam, 12); f.writeUInt32LE(ini, 16);
    this.raw(f); fs.closeSync(this.fd);
  }
}
async function inflarConferir(path, e) {
  const fd = fs.openSync(path, 'r');
  const inf = zlib.createInflateRaw(); const sha = crypto.createHash('sha256'); let usize = 0, crc = -1;
  inf.on('data', c => { sha.update(c); usize += c.length; crc = crcUpd(crc, c); });
  const done = new Promise((res, rej) => { inf.on('end', res); inf.on('error', rej); });
  let pos = e.off + 30 + e.nameBuf.length, rest = e.csize; const buf = Buffer.alloc(1 << 20);
  while (rest > 0) { const n = fs.readSync(fd, buf, 0, Math.min(buf.length, rest), pos); if (n <= 0) break; if (!inf.write(Buffer.from(buf.subarray(0, n)))) await new Promise(r => inf.once('drain', r)); pos += n; rest -= n; }
  inf.end(); await done; fs.closeSync(fd);
  return sha.digest('hex') === e.sha256 && usize === e.usize && ((crc ^ -1) >>> 0) === e.crc;
}
function shaArquivo(path) { return new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(path).on('data', c => h.update(c)).on('end', () => res(h.digest('hex'))).on('error', rej); }); }
function ordenarTabelas(tabs, fks) {
  const dep = new Map(tabs.map(t => [t, new Set()]));
  for (const f of fks) if (dep.has(f.tabela) && dep.has(f.pai) && f.tabela !== f.pai) dep.get(f.tabela).add(f.pai);
  const out = [], vis = new Set();
  const visita = t => { if (vis.has(t)) return; vis.add(t); [...dep.get(t)].sort().forEach(visita); out.push(t); };
  [...tabs].sort().forEach(visita);
  return out;
}
const OPC = Object.assign({ praticas: true, livro: true }, (event && event.opcoes) || {});
const acao = String(event.acao || 'estado');
const SEGREDO = /AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{5,}|Bearer [A-Za-z0-9._~+\/-]{30,}|MITRA_TOKEN=[^\s'"`]{8,}|sk-[A-Za-z0-9]{30,}/g;
async function ultimaLinha() { return (await q('SELECT ID, ESTADO, ETAPA, OPCOES, CRIADO_EM, TERMINOU_EM, NOME, TAMANHO_BYTES, SHA256, ARQUIVOS, CONFERIDO, ERRO FROM EXPORT_LEVE ORDER BY ID DESC LIMIT 1'))[0] || null; }
async function ultimaBase() { return (await q('SELECT ID, CHAVE_ARQUIVO, GERADO_EM, COMMIT_HASH, TAMANHO_BYTES, SHA256 FROM EXPORT_BASE ORDER BY ID DESC LIMIT 1'))[0] || null; }
if (acao === 'estado') {
  const u = await ultimaLinha(); const b = await ultimaBase();
  return { ok: true, vazio: !u, ultimo: u && { id: Number(u.ID), estado: u.ESTADO, etapa: u.ETAPA, opcoes: u.OPCOES, criadoEm: u.CRIADO_EM, terminouEm: u.TERMINOU_EM, nome: u.NOME, tamanho: u.TAMANHO_BYTES === null ? null : Number(u.TAMANHO_BYTES), sha256: u.SHA256, arquivos: u.ARQUIVOS === null ? null : Number(u.ARQUIVOS), conferido: u.CONFERIDO === null ? null : Number(u.CONFERIDO), erro: u.ERRO }, base: b && { geradoEm: b.GERADO_EM, commit: b.COMMIT_HASH } };
}
if (acao === 'link') {
  const r = await q("SELECT ID, NOME, CHAVE_ARQUIVO, TAMANHO_BYTES FROM EXPORT_LEVE WHERE ESTADO = 'PRONTO' ORDER BY ID DESC LIMIT 1");
  if (!r.length) return { ok: false, erro: 'Nenhuma exportação pronta.' };
  const l = await m.getFileLinkMitra({ projectId: pid, key: r[0].CHAVE_ARQUIVO, ttlSeconds: 120 });
  return { ok: true, url: (l.result || l).url, nome: r[0].NOME, tamanho: Number(r[0].TAMANHO_BYTES), valeSegundos: 120 };
}
if (acao !== 'gerar') return { ok: false, erro: 'Ação desconhecida.' };
const LEVE = { id: 0 };
const TMP = '/tmp/leve-' + Date.now();
fs.mkdirSync(TMP, { recursive: true });
async function etapa(txt) { try { if (LEVE.id) await dml("UPDATE EXPORT_LEVE SET ETAPA = '" + esc(String(txt).slice(0, 190)) + "' WHERE ID = " + LEVE.id); } catch (e) {} }
const lista = [];
let zip = null; let removidos = 0;
async function zadd(nome, dado) {
  let d = dado;
  if (typeof d === 'string') { const n = (d.match(SEGREDO) || []).length; if (n) { removidos += n; d = d.replace(SEGREDO, '[REMOVIDO]'); } }
  const e = await zip.add(nome, d);
  lista.push({ nome, tamanho: e.usize, sha256: e.sha256 });
  return e;
}
const carregarBase = async () => {
  const b = await ultimaBase();
  if (!b) throw new Error('Falta a base de código. Peça para gerá-la no desenvolvimento.');
  const l = await m.getFileLinkMitra({ projectId: pid, key: b.CHAVE_ARQUIVO, ttlSeconds: 300 });
  const resp = await fetch((l.result || l).url);
  if (!resp.ok) throw new Error('Não consegui ler a base de código.');
  const base = JSON.parse(await resp.text());
  base.linha = b;
  return base;
};
const linhasDiff = (a, b) => {
  const A = String(a).split('\n'), B = String(b).split('\n'); const out = []; const n = Math.max(A.length, B.length);
  for (let i = 0; i < n && out.length < 40; i++) if (A[i] !== B[i]) out.push('L' + (i + 1) + ' mitra: ' + String(A[i] === undefined ? '(sem linha)' : A[i]).slice(0, 300) + '\n     repo : ' + String(B[i] === undefined ? '(sem linha)' : B[i]).slice(0, 300));
  return { total: A.length, totalRepo: B.length, amostra: out };
};
async function main() {
  const t0 = agora();
  const andando = await ultimaLinha();
  if (andando && andando.ESTADO === 'GERANDO' && andando.CRIADO_EM > new Date(Date.now() - 3 * 3600e3 - 30 * 60e3).toISOString().slice(0, 19)) return { ok: false, jaGerando: true, erro: 'Já existe uma exportação em andamento.' };
  if (andando && andando.ESTADO === 'GERANDO') await dml("UPDATE EXPORT_LEVE SET ESTADO = 'ERRO', ERRO = 'Não terminou.' WHERE ID = " + inteiro(andando.ID));
  const versao = (await q('SELECT VERSION() V'))[0].V;
  const esquemaNome = (await q('SELECT DATABASE() D'))[0].D;
  await dml("INSERT INTO EXPORT_LEVE (ESTADO, ETAPA, OPCOES, CRIADO_EM) VALUES ('GERANDO','iniciando','" + esc(JSON.stringify(OPC)) + "','" + t0 + "')");
  LEVE.id = inteiro((await q('SELECT MAX(ID) I FROM EXPORT_LEVE'))[0].I);
  const nomeZip = 'monitor-exportacao-leve-' + t0.replace(/[-:T]/g, '').slice(0, 12) + '.zip';
  zip = new Zip(TMP + '/' + nomeZip);
  await etapa('lendo o código guardado');
  const base = await carregarBase();
  await etapa('lendo a estrutura do banco');
  const tabsInfo = (await q("SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_COLLATION, TABLE_COMMENT, ROW_FORMAT, AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME")).filter(t => !INTERNO.test(t.TABLE_NAME));
  const baseTabs = tabsInfo.filter(t => t.TABLE_TYPE === 'BASE TABLE');
  const views = tabsInfo.filter(t => t.TABLE_TYPE === 'VIEW');
  const meta = {};
  const fks = [];
  for (const t of baseTabs) {
    const n = t.TABLE_NAME;
    const cols = await q("SELECT COLUMN_NAME, COLUMN_DEFAULT, IS_NULLABLE, DATA_TYPE, COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME, EXTRA, COLUMN_COMMENT, GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '" + esc(n) + "' ORDER BY ORDINAL_POSITION");
    const idx = await q("SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, SUB_PART, INDEX_TYPE, INDEX_COMMENT, IS_VISIBLE, COLLATION FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '" + esc(n) + "' ORDER BY INDEX_NAME, SEQ_IN_INDEX");
    const fk = await q("SELECT k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, k.ORDINAL_POSITION, r.UPDATE_RULE, r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = '" + esc(n) + "' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.CONSTRAINT_NAME, k.ORDINAL_POSITION");
    const fkMap = {};
    for (const f of fk) { const g = fkMap[f.CONSTRAINT_NAME] || (fkMap[f.CONSTRAINT_NAME] = { nome: f.CONSTRAINT_NAME, tabela: n, pai: f.REFERENCED_TABLE_NAME, cols: [], refs: [], upd: f.UPDATE_RULE, del: f.DELETE_RULE }); g.cols.push(f.COLUMN_NAME); g.refs.push(f.REFERENCED_COLUMN_NAME); }
    const fkLista = Object.values(fkMap); fks.push(...fkLista);
    const idxMap = {};
    for (const i of idx) { const g = idxMap[i.INDEX_NAME] || (idxMap[i.INDEX_NAME] = { nome: i.INDEX_NAME, unico: Number(i.NON_UNIQUE) === 0, tipo: i.INDEX_TYPE, comentario: i.INDEX_COMMENT, visivel: i.IS_VISIBLE, cols: [] }); g.cols.push({ nome: i.COLUMN_NAME, sub: i.SUB_PART, desc: i.COLLATION === 'D' }); }
    meta[n] = { info: t, cols, idx: Object.values(idxMap), fks: fkLista, pk: idxMap.PRIMARY ? idxMap.PRIMARY.cols.map(c => c.nome) : [] };
  }
  const nomesApp = baseTabs.map(t => t.TABLE_NAME);
  const ordem = ordenarTabelas(nomesApp, fks);
  const colSql = c => {
    const ex = String(c.EXTRA || '');
    let s = id(c.COLUMN_NAME) + ' ' + c.COLUMN_TYPE;
    if (c.CHARACTER_SET_NAME) s += ' CHARACTER SET ' + c.CHARACTER_SET_NAME + ' COLLATE ' + c.COLLATION_NAME;
    s += c.IS_NULLABLE === 'YES' ? ' NULL' : ' NOT NULL';
    if (ex.includes('DEFAULT_GENERATED')) s += ' DEFAULT (' + c.COLUMN_DEFAULT + ')';
    else if (c.COLUMN_DEFAULT === null || c.COLUMN_DEFAULT === undefined) { if (c.IS_NULLABLE === 'YES') s += ' DEFAULT NULL'; }
    else s += ' DEFAULT ' + sqlLit(String(c.COLUMN_DEFAULT));
    if (ex.includes('auto_increment')) s += ' AUTO_INCREMENT';
    if (c.COLUMN_COMMENT) s += " COMMENT " + sqlLit(c.COLUMN_COMMENT);
    return s;
  };
  let ddl = ['-- Estrutura do banco reconstruída a partir do information_schema do MySQL ' + versao + ' (SHOW CREATE foi recusado pelo Mitra).', '-- Schema de origem: ' + esquemaNome + ' | gerado em ' + t0 + ' (horário de Brasília)', "SET NAMES utf8mb4;", "SET FOREIGN_KEY_CHECKS = 0;", ''];
  for (const n of ordem) {
    const mt = meta[n]; const linhas = mt.cols.map(colSql);
    for (const i of mt.idx) {
      const cl = i.cols.map(c => id(c.nome) + (c.sub ? '(' + c.sub + ')' : '') + (c.desc ? ' DESC' : '')).join(', ');
      if (i.nome === 'PRIMARY') linhas.push('PRIMARY KEY (' + cl + ')');
      else if (i.tipo === 'FULLTEXT') linhas.push('FULLTEXT KEY ' + id(i.nome) + ' (' + cl + ')' + (i.comentario ? ' COMMENT ' + sqlLit(i.comentario) : ''));
      else linhas.push((i.unico ? 'UNIQUE KEY ' : 'KEY ') + id(i.nome) + ' (' + cl + ')' + (i.visivel === 'NO' ? ' INVISIBLE' : '') + (i.comentario ? ' COMMENT ' + sqlLit(i.comentario) : ''));
    }
    for (const f of mt.fks) linhas.push('CONSTRAINT ' + id(f.nome) + ' FOREIGN KEY (' + f.cols.map(id).join(', ') + ') REFERENCES ' + id(f.pai) + ' (' + f.refs.map(id).join(', ') + ') ON DELETE ' + f.del + ' ON UPDATE ' + f.upd);
    const coll = mt.info.TABLE_COLLATION || 'utf8mb4_bin';
    ddl.push('DROP TABLE IF EXISTS ' + id(n) + ';');
    ddl.push('CREATE TABLE ' + id(n) + ' (\n  ' + linhas.join(',\n  ') + '\n) ENGINE=' + mt.info.ENGINE + (mt.info.AUTO_INCREMENT ? ' AUTO_INCREMENT=' + mt.info.AUTO_INCREMENT : '') + ' DEFAULT CHARSET=' + coll.split('_')[0] + ' COLLATE=' + coll + (mt.info.ROW_FORMAT ? ' ROW_FORMAT=' + mt.info.ROW_FORMAT : '') + (mt.info.TABLE_COMMENT ? ' COMMENT=' + sqlLit(mt.info.TABLE_COMMENT) : '') + ';\n');
  }
  const viewsOrd = views.map(v => v.TABLE_NAME).sort();
  const viewDefs = [];
  for (const vn of viewsOrd) {
    const r = (await q("SELECT VIEW_DEFINITION FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '" + esc(vn) + "'"))[0];
    const def = String(r.VIEW_DEFINITION).split('`' + esquemaNome + '`.').join('');
    viewDefs.push(vn);
    ddl.push('DROP VIEW IF EXISTS ' + id(vn) + ';');
    ddl.push('CREATE SQL SECURITY INVOKER VIEW ' + id(vn) + ' AS ' + def + ';\n');
  }
  ddl.push('SET FOREIGN_KEY_CHECKS = 1;');
  await zadd('banco/schema.sql', ddl.join('\n') + '\n');
  const contagens = [];
  for (const n of ordem) contagens.push({ tabela: n, linhas: Number((await q('SELECT COUNT(*) N FROM ' + id(n)))[0].N), colunas: meta[n].cols.length, engine: meta[n].info.ENGINE });
  const PEQUENAS = ['CONFIG', 'CANAIS', 'PLAYLISTS', 'TEMAS', 'TEMA_MAPA', 'MENTOR_REGRAS'];
  const SEM_COLUNA = { CANAIS: ['CARGA_TOKEN'] };
  const MASCARA = /KEY|TOKEN|SECRET|SENHA|PASSWORD/i;
  const entrou = [], naoEntrou = [];
  await etapa('exportando tabelas pequenas');
  const inserts = ['-- Dados das tabelas pequenas de configuração e domínio. Sem segredos. Carregue depois de banco/schema.sql.', 'SET NAMES utf8mb4;', ''];
  for (const n of ordem) {
    const c = contagens.find(x => x.tabela === n);
    if (!PEQUENAS.includes(n)) continue;
    if (c.linhas > 2000) { naoEntrou.push({ tabela: n, linhas: c.linhas, motivo: 'passa de 2.000 linhas' }); continue; }
    const cols = meta[n].cols.map(x => x.COLUMN_NAME).filter(x => !(SEM_COLUNA[n] || []).includes(x));
    const pk = meta[n].pk.length ? ' ORDER BY ' + meta[n].pk.map(id).join(', ') : '';
    const rows = await q('SELECT ' + cols.map(id).join(', ') + ' FROM ' + id(n) + pk + ' LIMIT 2000');
    const tratadas = rows.map(r => { const o = Object.assign({}, r); if (n === 'CONFIG' && MASCARA.test(String(o.CHAVE))) o.VALOR = '[REMOVIDO]'; return o; });
    await zadd('dados-pequenos/' + n + '.csv', csvLinha(cols, '') + tratadas.map(r => csvLinha(cols.map(k => r[k]), '')).join(''));
    inserts.push('-- ' + n + ' (' + tratadas.length + ' linhas)' + ((SEM_COLUNA[n] || []).length ? ' sem a coluna ' + SEM_COLUNA[n].join(', ') : ''));
    for (const r of tratadas) inserts.push('INSERT INTO ' + id(n) + ' (' + cols.map(id).join(', ') + ') VALUES (' + cols.map(k => sqlLit(r[k])).join(', ') + ');');
    inserts.push('');
    entrou.push({ tabela: n, linhas: tratadas.length, colunasRetiradas: SEM_COLUNA[n] || [] });
  }
  await zadd('dados-pequenos/CARGA_PEQUENAS.sql', inserts.join('\n') + '\n');
  const motivoFora = n => /^EXPORT_/.test(n) || n === 'LOTES' ? 'só estrutura (tabela de controle)' : /BKP/.test(n) ? 'cópia de segurança, grande' : n === 'EXPORT_DONOS' ? 'e-mails (dado pessoal)' : n === 'TRECHOS' ? 'transcrições (grande e conteúdo de terceiros)' : n === 'PRATICAS' && OPC.praticas ? 'exportada à parte, na pasta praticas/' : n === 'PRATICAS' ? 'grande (use a opção de práticas)' : (n === 'LIVRO_CAPITULOS' || n === 'LIVROS_INDICADOS') && OPC.livro ? 'exportada à parte, na pasta livro-vivo/' : (n === 'LIVRO_CAPITULOS' || n === 'LIVROS_INDICADOS') ? 'opção do Livro Vivo desligada' : n === 'AVISOS' ? 'dado de uso do dia a dia, não é configuração' : n === 'PRATICA_DIARIO' ? 'diário pessoal da pessoa' : 'dados de movimento (grande ou pessoal)';
  for (const c of contagens) if (!entrou.find(e => e.tabela === c.tabela) && !naoEntrou.find(e => e.tabela === c.tabela)) naoEntrou.push({ tabela: c.tabela, linhas: c.linhas, motivo: motivoFora(c.tabela) });
  const exportados = [];
  if (OPC.praticas) {
    await etapa('exportando as práticas');
    const cab = ['id', 'tipo', 'titulo', 'instrucao', 'jeito', 'serve', 'quando', 'conselho', 'inicio_seg', 'inicio_hms', 'link_com_tempo', 'video_id_interno', 'video_yt', 'video_titulo', 'canal', 'criada_em', 'revisada_em'];
    let ultimo = 0, total = 0; const porTipo = {};
    const csv = [csvLinha(cab, '')];
    for (;;) {
      const rows = await q('SELECT P.ID, P.TIPO, P.TITULO, P.INSTRUCAO, P.JEITO, P.SERVE, P.QUANDO, P.CONSELHO, P.SEGUNDO, P.VIDEO_ID, P.CRIADO_EM, P.REVISADA_EM, V.YT_VIDEO_ID, V.TITULO VTIT, C.NOME CANAL FROM PRATICAS P JOIN VIDEOS V ON V.ID = P.VIDEO_ID JOIN CANAIS C ON C.ID = V.CANAL_ID WHERE P.ID > ' + inteiro(ultimo) + ' ORDER BY P.ID LIMIT 1500');
      if (!rows.length) break;
      for (const p of rows) { const s = p.SEGUNDO === null ? '' : Number(p.SEGUNDO); porTipo[p.TIPO] = (porTipo[p.TIPO] || 0) + 1; total++; csv.push(csvLinha([Number(p.ID), p.TIPO, p.TITULO, p.INSTRUCAO, p.JEITO, p.SERVE, p.QUANDO, Number(p.CONSELHO), s, s === '' ? '' : hms(s), s === '' ? '' : 'https://youtu.be/' + p.YT_VIDEO_ID + '?t=' + s, Number(p.VIDEO_ID), p.YT_VIDEO_ID, p.VTIT, p.CANAL, p.CRIADO_EM, p.REVISADA_EM], '')); ultimo = Number(p.ID); }
      if (rows.length < 1500) break;
    }
    await zadd('praticas/praticas.csv', csv.join(''));
    await zadd('praticas/praticas_por_tipo.csv', csvLinha(['tipo', 'quantidade'], '') + Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => csvLinha([k, v], '')).join(''));
    await zadd('praticas/LEIAME.md', ['# Práticas', '', 'Arquivo `praticas.csv`: uma linha por prática ensinada nos vídeos estudados (' + total + ' linhas). Colunas:', '', '- `tipo`: um dos 19 tipos de `TIPOS_PRATICA` (ver REGRAS_DE_CLASSIFICACAO.md, seção 4). Mantra é o tipo `mantra e decreto`; as demais são exercícios.', '- `titulo`, `instrucao`: texto da prática como a IA anotou da fala do vídeo.', '- `jeito`, `serve`, `quando`, `conselho`: etiquetas da IA (seção 5 das regras). `conselho = 1` marca o que não é prática para fazer em casa.', '- `inicio_seg`, `inicio_hms`, `link_com_tempo`: onde a prática começa no vídeo. O fim não existe no banco.', '- `video_yt`, `video_titulo`, `canal`: de onde vem.', '', 'As transcrições não vão neste pacote.', ''].join('\n'));
    exportados.push({ parte: 'praticas', linhas: total });
  }
  if (OPC.livro) {
    await etapa('exportando o Livro Vivo');
    const caps = await q('SELECT ID, TEMA_ID, TEMA, TEXTO, PRATICAS_JSON, VIDEOS, GERADO_EM FROM LIVRO_CAPITULOS ORDER BY TEMA');
    const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'tema';
    await zadd('livro-vivo/capitulos.csv', csvLinha(['id', 'tema_id', 'tema', 'videos', 'gerado_em', 'texto', 'praticas_json'], '') + caps.map(c => csvLinha([Number(c.ID), Number(c.TEMA_ID), c.TEMA, Number(c.VIDEOS), c.GERADO_EM, c.TEXTO, c.PRATICAS_JSON], '')).join(''));
    for (const c of caps) {
      let pr = []; try { pr = JSON.parse(c.PRATICAS_JSON || '[]'); } catch (e) {}
      const md = ['# ' + c.TEMA, '', '_Capítulo do Livro Vivo, escrito em ' + c.GERADO_EM + ' a partir de ' + c.VIDEOS + ' vídeos._', '', c.TEXTO, '', '## Práticas deste capítulo', ''];
      for (const p of pr) { md.push('### ' + p.titulo + ' (' + p.grupo + ')', '', '**Para quê:** ' + p.quando, '', p.passos, '', 'Fontes: ' + (p.fontes || []).map(f => f.canal + ' - ' + f.video + ' https://youtu.be/' + f.yt + '?t=' + f.seg).join('; '), ''); }
      await zadd('livro-vivo/capitulos/' + slug(c.TEMA) + '.md', md.join('\n'));
    }
    const lv = await q('SELECT L.ID, L.VIDEO_ID, L.TITULO, L.AUTOR, L.TRECHO, L.SEGUNDO, V.YT_VIDEO_ID, V.TITULO VTIT, C.NOME CANAL FROM LIVROS_INDICADOS L JOIN VIDEOS V ON V.ID = L.VIDEO_ID JOIN CANAIS C ON C.ID = V.CANAL_ID ORDER BY L.ID LIMIT 2000');
    await zadd('livro-vivo/livros_indicados.csv', csvLinha(['id', 'titulo_livro', 'autor', 'trecho', 'inicio_seg', 'link_com_tempo', 'video_titulo', 'canal'], '') + lv.map(l => csvLinha([Number(l.ID), l.TITULO, l.AUTOR, l.TRECHO, Number(l.SEGUNDO), 'https://youtu.be/' + l.YT_VIDEO_ID + '?t=' + Number(l.SEGUNDO), l.VTIT, l.CANAL], '')).join(''));
    await zadd('livro-vivo/LEIAME.md', ['# Livro Vivo e livros indicados', '', '- `capitulos.csv` e `capitulos/*.md`: ' + caps.length + ' capítulos, um por tema, com as práticas unificadas e as fontes (vídeo, canal, minuto).', '- `livros_indicados.csv`: ' + lv.length + ' livros citados nos vídeos.', '- Como o capítulo é escrito: REGRAS_DE_CLASSIFICACAO.md, seção 7.', ''].join('\n'));
    exportados.push({ parte: 'livro-vivo', capitulos: caps.length, livrosIndicados: lv.length });
  }
  await etapa('copiando código e histórico');
  for (const f of base.arquivos) await zadd(f.n, f.t === 'b' ? Buffer.from(f.d, 'base64') : f.d);
  await etapa('lendo perfis, conexões e funções');
  const perfisLista = ((await m.listProfilesMitra({ projectId: pid })).result || []).filter(p => p.id > 0);
  const perfis = [];
  for (const p of perfisLista) { const d = ((await m.getProfileDetailsMitra({ projectId: pid, profileId: p.id })).result) || {}; perfis.push({ id: p.id, nome: p.name, funcoes: (d.serverFunctions || []).map(f => ({ numero: f.serverFunctionId, nome: f.serverFunctionName })) }); }
  await zadd('plataforma/perfis.json', JSON.stringify({ observacao: 'Somente perfis e as funções que cada um pode executar. Sem usuários, e-mails, senhas ou tokens.', perfis: perfis.map(p => ({ id: p.id, nome: p.nome, qtd_funcoes: p.funcoes.length, funcoes: p.funcoes })) }, null, 1));
  const integr = await m.listIntegrationsMitra({ projectId: pid });
  const itens = Array.isArray(integr) ? integr : (integr.result || []);
  const conexoes = itens.map(i => { const cr = i.credentials || {}; const az = i.authorizationConfig || {}; return { nome: i.name, slug: i.slug, tipo: i.blueprintType, autenticacao: i.authType, url_base: String(cr.base_url || '').split('?')[0], campos_de_credencial: Object.keys(cr), onde_vai_a_chave: az.type ? { tipo: az.type, nome_do_campo: az.config && az.config.name } : null, observacao: /^zz-teste/.test(String(i.name)) ? 'Sobra de teste.' : '' }; });
  await zadd('plataforma/conexoes.json', JSON.stringify({ observacao: 'Somente nome, URL base sem query string e nomes dos campos. Nenhum valor de chave.', conexoes }, null, 1));
  const nomesConexaoNoMotor = String((await q("SELECT VALOR FROM CONFIG WHERE CHAVE = 'GEMINI_CONEXOES'"))[0].VALOR).split(',').map(x => x.trim());
  const fnLista = await m.listServerFunctionsMitra({ projectId: pid });
  const fns = (fnLista.result || fnLista).slice().sort((a, b) => a.id - b.id);
  const perfilPorFn = new Map();
  for (const p of perfis) for (const f of p.funcoes) { const a = perfilPorFn.get(f.numero) || []; a.push(p.nome); perfilPorFn.set(f.numero, a); }
  const detalhes = new Map();
  for (let i = 0; i < fns.length; i += 6) {
    await etapa('lendo funções ' + Math.min(i + 6, fns.length) + ' de ' + fns.length);
    await Promise.all(fns.slice(i, i + 6).map(async f => { const d = (await m.readServerFunctionMitra({ projectId: pid, serverFunctionId: f.id })).result || {}; detalhes.set(f.id, d); }));
  }
  const nomesFn = new Set(fns.map(f => f.name));
  const indice = [], indiceJson = [], diff = { iguais: [], diferentes: [], soMitra: [], soRepo: [] };
  const sdkPorFn = {}, chamaFn = {}, usuarioLogado = [], arquivosFn = [];
  for (const f of fns) {
    const d = detalhes.get(f.id) || {}; const code = String(d.code || '');
    const params = f.type === 'SQL' ? [...new Set([...code.matchAll(/\{\{(\w+)\}\}/g)].map(x => x[1]))] : [...new Set([...code.matchAll(/event\.(\w+)/g)].map(x => x[1]))];
    const ext = f.type === 'SQL' ? 'sql' : 'js';
    const e = await zadd('funcoes/' + String(f.id).padStart(3, '0') + '-' + f.name + '.' + ext, code);
    const perfisF = perfilPorFn.get(f.id) || [];
    const telas = (base.telas[f.name] || []);
    indice.push([f.id, f.name, f.type, params.join(' '), perfisF.join(' | '), f.cronExpression || '', f.description || '', e.usize, e.sha256]);
    indiceJson.push({ numero: f.id, nome: f.name, tipo: f.type, parametros: params, perfis_com_permissao: perfisF, cron: f.cronExpression || null, cron_entrada: f.cronInputJson || null, descricao: f.description || '', tamanho_bytes: e.usize, sha256: e.sha256, telas_que_chamam: telas });
    if (f.type !== 'SQL') {
      const sdks = [...new Set([...code.matchAll(/\bm\.(\w+Mitra)\b/g)].map(x => x[1]))]; if (sdks.length) sdkPorFn[f.name] = sdks;
      const filhas = [...new Set([...code.matchAll(/\bsql\('(\w+)'/g)].map(x => x[1]).concat([...code.matchAll(/\bSF\.(\w+)/g)].map(x => x[1])))].filter(x => nomesFn.has(x)); if (filhas.length) chamaFn[f.name] = filhas;
    }
    if (/userId|user_id|\{\{user|CURRENT_USER|usuario_logado|currentUser|loggedUser/i.test(code)) usuarioLogado.push(f.name);
    const repo = base.repoFuncoes[f.name];
    if (!repo) { diff.soMitra.push({ nome: f.name, id: f.id, tipo: f.type }); continue; }
    const pub = f.type === 'SQL' ? code.trim() : code.replace(/const SF = \{[^\n]*\};/, 'const SF = __SF__;').trim();
    const loc = repo.code.trim();
    if (pub === loc) diff.iguais.push(f.name); else diff.diferentes.push({ nome: f.name, id: f.id, tipo: f.type, d: linhasDiff(pub, loc) });
  }
  for (const nome of Object.keys(base.repoFuncoes)) if (!nomesFn.has(nome)) diff.soRepo.push(nome);
  await zadd('funcoes/INDICE_FUNCOES.csv', csvLinha(['numero', 'nome', 'tipo', 'parametros', 'perfis_com_permissao', 'cron', 'descricao', 'tamanho_bytes', 'sha256'], '') + indice.map(r => csvLinha(r, '')).join(''));
  await zadd('funcoes/INDICE_FUNCOES.json', JSON.stringify(indiceJson, null, 1));
  const DF = ['# Diferenças entre as funções publicadas no Mitra e os scripts do repositório', '', 'Commit do repositório usado: `' + base.commit + '` (código guardado em ' + base.geradoEm + '). Funções JavaScript são comparadas com o marcador `__SF__` no lugar da tabela de números que o publicador injeta. Funções SQL são comparadas texto a texto (sem espaços nas pontas).', '',
    '- Publicadas no Mitra: ' + fns.length + '. Iguais ao repositório: ' + diff.iguais.length + '. Diferentes: ' + diff.diferentes.length + '. Só no Mitra: ' + diff.soMitra.length + '. Só no repositório: ' + diff.soRepo.length + '.', '', '## Só existem no Mitra (não têm script no repositório)', '', ...(diff.soMitra.length ? diff.soMitra.map(x => '- ' + x.id + ' `' + x.nome + '` (' + x.tipo + ')') : ['Nenhuma.']), '', '## Só existem no repositório (não estão publicadas)', '', ...(diff.soRepo.length ? diff.soRepo.map(x => '- `' + x + '`') : ['Nenhuma.']), '', '## Diferentes', ''];
  if (!diff.diferentes.length) DF.push('Nenhuma.');
  for (const x of diff.diferentes) { DF.push('### ' + x.id + ' `' + x.nome + '` (' + x.tipo + '): ' + x.d.total + ' linhas no Mitra, ' + x.d.totalRepo + ' no repositório', '', '```', ...x.d.amostra, '```', ''); }
  DF.push('## Iguais', '', diff.iguais.length ? diff.iguais.map(x => '`' + x + '`').join(', ') : 'Nenhuma.', '');
  await zadd('DIFF_FUNCOES.md', DF.join('\n'));
  const crons = fns.filter(f => f.cronExpression);
  await zadd('plataforma/rotinas.csv', csvLinha(['numero', 'funcao', 'cron', 'entrada', 'descricao'], '') + crons.map(f => csvLinha([f.id, f.name, f.cronExpression, f.cronInputJson || '', f.description || ''], '')).join(''));
  await etapa('escrevendo documentos');
  const tabelaFn = ['| número | função | tipo | telas que chamam | chamada por funções | SDK do Mitra usado |', '|---|---|---|---|---|---|'];
  const chamadaPor = {}; for (const [pai, filhas] of Object.entries(chamaFn)) for (const fi of filhas) (chamadaPor[fi] ||= []).push(pai);
  for (const f of fns) tabelaFn.push('| ' + f.id + ' | ' + f.name + ' | ' + f.type + ' | ' + ((base.telas[f.name] || []).map(x => x.replace('frontend/src/', '')).join(', ') || '-') + ' | ' + ((chamadaPor[f.name] || []).join(', ') || '-') + ' | ' + ((sdkPorFn[f.name] || []).join(', ') || '-') + ' |');
  const sdkFrontTxt = Object.entries(base.sdkFront).map(([k, v]) => '- `' + k.replace('frontend/src/', '') + '`: ' + v.join('; ')).join('\n');
  const usaArquivo = Object.entries(sdkPorFn).filter(([, v]) => v.some(x => /File|Upload/i.test(x))).map(([k, v]) => '- `' + k + '`: ' + v.filter(x => /File|Upload/i.test(x)).join(', '));
  const DEP = ['# Dependências do Mitra e o que reescrever fora dele', '', 'Gerado de ' + fns.length + ' funções publicadas, do código do front-end e das conexões, em ' + t0 + '.', '',
    '## 1. Mapa número -> função -> telas', '', 'A coluna "telas que chamam" vem de uma busca por `chamar(\'nome\'`, `chamarDemorado(\'nome\'` e `linhas(\'nome\'` no código do front-end. Quem chama por outro caminho **NÃO SEI** apontar. Os números são os da plataforma e mudam se as funções forem recriadas; o front usa o objeto `SF` em `codigo/frontend/src/lib/sf.ts`.', '', ...tabelaFn, '',
    '## 2. Consultas que usam o usuário logado', '', usuarioLogado.length ? 'Funções cujo código cita usuário (userId, user_id, currentUser e parecidos): ' + usuarioLogado.map(x => '`' + x + '`').join(', ') + '.' : 'Nenhuma função publicada usa o usuário logado em consulta ou regra. Os dados são os mesmos para qualquer pessoa que entre. O login serve só para liberar a tela e as funções por perfil.', '',
    '## 3. Uso do SDK do Mitra', '', '**No servidor** (cada função JavaScript, pelo prefixo `m.`):', '', ...Object.entries(sdkPorFn).map(([k, v]) => '- `' + k + '`: ' + v.join(', ')), '', '**No front-end** (`mitra-interactions-sdk`):', '', sdkFrontTxt || 'Nenhum.', '', 'Autenticação do front: `codigo/frontend/src/lib/mitra-auth.ts` (variáveis `VITE_MITRA_AUTH_URL` e `VITE_MITRA_PROJECT_ID`; sessão no `localStorage`, chave `mitra-session`).', '',
    '## 4. Upload e link de arquivo', '', ...(usaArquivo.length ? usaArquivo : ['Nenhum.']), '', 'O app gera ZIPs de exportação e entrega por link temporário (`getFileLinkMitra`). O arquivo enviado é privado (`uploadFilePrivateMitra`). Fora do Mitra isso vira armazenamento de objetos com URL assinada.', '',
    '## 5. Rotinas agendadas', '', '| função | cron | entrada | o que faz |', '|---|---|---|---|', ...crons.map(f => '| ' + f.name + ' | `' + f.cronExpression + '` | `' + (f.cronInputJson || '') + '` | ' + (f.description || '') + ' |'), '',
    'O formato do cron tem 6 campos (segundo, minuto, hora, dia, mês, dia da semana): `0 5 * * * *` lê-se como "no minuto 5 de toda hora". **NÃO SEI** confirmar o fuso do agendador do Mitra. O `motor` também se reagenda sozinho (`modo: continuar`) enquanto houver trabalho. Dentro dele: a checagem diária de canais roda na primeira execução depois de `CONFIG.HORA_CHECAGEM` (hora de Brasília) em que `ULTIMA_CHECAGEM_DIA` ainda não é o dia de hoje; o Livro Vivo é escrito de madrugada (hora de Brasília entre 1 e 7), no máximo `CONFIG.LIVRO_POR_NOITE` por dia.', '',
    '## 6. Conexões usadas', '', 'Nomes de conexão que o motor usa para o Gemini (de `CONFIG.GEMINI_CONEXOES`): ' + nomesConexaoNoMotor.join(', ') + '. O YouTube é acessado pela conexão `youtube-web` (páginas públicas). Lista completa em `plataforma/conexoes.json`.', '',
    '## 7. O que precisa ser reescrito fora do Mitra', '', '- **Server Functions SQL** (' + fns.filter(f => f.type === 'SQL').length + '): viram consultas parametrizadas no seu back-end. O marcador `{{nome}}` hoje é substituído como texto pela plataforma; fora dela use parâmetros de verdade (evita injeção de SQL).',
    '- **Server Functions JavaScript** (' + fns.filter(f => f.type !== 'SQL').length + '): usam `require(\'mitra-sdk\')`, a variável `event` e `return` no nível de cima. Precisam virar módulos com o mesmo contrato, trocando cada `m.*Mitra` listado na seção 3.',
    '- **Banco**: `banco/schema.sql` (MySQL 8, collation `utf8mb4_bin`, FULLTEXT em `TRECHOS.TEXTO`). A busca por texto depende do FULLTEXT.',
    '- **Gemini**: sai de `callIntegrationMitra` para chamada direta à API do Google, com rodízio de chaves e modelos (REGRAS_DE_CLASSIFICACAO.md, seção 1).',
    '- **YouTube**: o motor lê as páginas públicas pela conexão do Mitra; fora dele é preciso chamar as mesmas URLs.',
    '- **Agendador**: o cron do Mitra vira cron do servidor ou fila.',
    '- **Login e perfis**: a autenticação e a permissão por função são do Mitra; fora dele é preciso criar login e controle de acesso.',
    '- **Front-end**: troca o SDK do Mitra (`api.ts`, `mitra-auth.ts`) por chamadas ao novo back-end.', ''];
  await zadd('DEPENDENCIAS_MITRA.md', DEP.join('\n'));
  await zadd('.env.example', ['# Somente nomes. Preencha no novo ambiente. Nada aqui é segredo.', 'MITRA_BASE_URL=', 'MITRA_BASE_URL_INTEGRATIONS=', 'MITRA_TOKEN=', 'MITRA_PROJECT_ID=', 'MITRA_WORKSPACE_ID=', 'VITE_MITRA_AUTH_URL=', 'VITE_MITRA_PROJECT_ID=', '# Fora do Mitra, uma chave por conexão do Gemini:', ...nomesConexaoNoMotor.map(x => '# GEMINI_API_KEY_' + x.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '='), '# Banco:', 'DB_HOST=', 'DB_PORT=3306', 'DB_NAME=', 'DB_USER=', 'DB_PASSWORD='].join('\n') + '\n');
  await etapa('escrevendo o leia-me e o manifesto');
  const arvore = lista.map(x => '- `' + x.nome + '`').join('\n');
  const LM = ['# Exportação leve do Monitor de Canais do YouTube', '', 'Gerada em ' + t0 + ' (horário de Brasília), a partir do ambiente de desenvolvimento e da plataforma. Código no commit `' + base.commit + '` (guardado em ' + base.geradoEm + '). MySQL ' + versao + ', schema `' + esquemaNome + '`.', '',
    '## O que está neste ZIP', '', '- `codigo/`: front-end, back-end (scripts e Server Functions em `backend/sf`), configurações, README e `ESCOPO.md` (cópia dos arquivos versionados no Git, sem `.env`, `node_modules` e `dist`).', '- `historico/repo.bundle` e `historico/commits.txt`: histórico Git completo (`git clone historico/repo.bundle`) e a lista de commits.', '- `funcoes/`: as ' + fns.length + ' Server Functions na versão PUBLICADA, uma por arquivo (`número-nome.sql|js`), com `INDICE_FUNCOES.csv` e `.json` (número, nome, tipo, parâmetros, perfis com permissão, cron, descrição, SHA-256). Inclui as que só existem no Mitra.', '- `DIFF_FUNCOES.md`: publicadas x scripts do repositório.', '- `REGRAS_DE_CLASSIFICACAO.md`: o que o app realmente faz para classificar (prompts exatos, modelo, temperatura, validações, valores permitidos, minutagem, filtros, e o que não se sabe).', '- `banco/schema.sql`: estrutura lida do `information_schema` (tabelas, views, chaves, índices, FULLTEXT, ENGINE, charset e collation), sem nenhuma linha de dados.', '- `dados-pequenos/`: ' + entrou.map(e => e.tabela + ' (' + e.linhas + ' linhas)').join(', ') + ', em CSV e em `CARGA_PEQUENAS.sql`. Da tabela CANAIS saiu a coluna `CARGA_TOKEN`; valores de CONFIG com nome de chave, token ou senha são trocados por `[REMOVIDO]`.',
    OPC.praticas ? '- `praticas/`: todas as práticas (' + (exportados.find(x => x.parte === 'praticas') || {}).linhas + ' linhas) com tipo, etiquetas, minuto e link, mais a contagem por tipo.' : '- Práticas: NÃO incluídas (opção desligada).',
    OPC.livro ? '- `livro-vivo/`: ' + (exportados.find(x => x.parte === 'livro-vivo') || {}).capitulos + ' capítulos (CSV e um `.md` por tema) e ' + (exportados.find(x => x.parte === 'livro-vivo') || {}).livrosIndicados + ' livros indicados.' : '- Livro Vivo: NÃO incluído (opção desligada).',
    '- `plataforma/`: `conexoes.json` (nome, URL base e nomes dos campos), `perfis.json` (perfis e funções permitidas) e `rotinas.csv`.', '- `DEPENDENCIAS_MITRA.md`, `.env.example` (só nomes), `MANIFEST.json` (todos os arquivos com tamanho e SHA-256).', '',
    '## O que NÃO está neste ZIP', '', '- Transcrições (`TRECHOS`), vínculos vídeo-tema, vídeos, playlists-vídeos e qualquer outro dado de movimento.', '- Tabelas grandes ou pessoais, com a contagem de linhas do momento:', '', '| tabela | linhas | motivo |', '|---|---|---|', ...naoEntrou.map(x => '| ' + x.tabela + ' | ' + x.linhas + ' | ' + x.motivo + ' |'), '', '- Chaves, tokens, senhas e hashes: nenhum. ' + (removidos ? 'O gerador trocou ' + removidos + ' trecho(s) com cara de segredo por `[REMOVIDO]`.' : 'O gerador não encontrou trecho com cara de segredo.'), '- Usuários e e-mails da plataforma, e a lista de donos da exportação pesada.', '- Valores das integrações (chaves do Gemini e do YouTube) e as configurações guardadas só dentro de cada conexão do Mitra.', '- O código das telas na versão publicada: o ZIP traz o código do repositório. O que está no ar pode ser diferente se alguém mudou algo sem commit. **NÃO SEI** comparar.', '- Os dados do banco além das tabelas listadas acima. O pacote completo (pesado) é outro fluxo e não foi usado.', '', '## Como conferir', '', 'Cada arquivo tem tamanho e SHA-256 em `MANIFEST.json`. O gerador releu o ZIP depois de gravar e conferiu cada arquivo (SHA-256, CRC-32 e tamanho). Para repetir: `unzip` e `sha256sum -c` com os valores do manifesto.', '', '## Lista de arquivos', '', arvore, ''];
  await zadd('LEIAME_EXPORTACAO_LEVE.md', LM.join('\n'));
  await zadd('README.md', ['# Exportação leve', '', 'Comece por `LEIAME_EXPORTACAO_LEVE.md`. Depois `REGRAS_DE_CLASSIFICACAO.md`, `DEPENDENCIAS_MITRA.md` e `DIFF_FUNCOES.md`.', ''].join('\n'));
  const manifesto = { gerado_em: t0, commit: base.commit, codigo_guardado_em: base.geradoEm, versao_mysql: versao, esquema: esquemaNome, opcoes: OPC, trechos_de_segredo_removidos: removidos, tabelas_incluidas: entrou, tabelas_fora: naoEntrou, arquivos: lista.slice(), observacao: 'O próprio MANIFEST.json não aparece na lista (não dá para conter o próprio SHA-256).' };
  await zip.add('MANIFEST.json', JSON.stringify(manifesto, null, 1));
  zip.close();
  await etapa('conferindo o ZIP gravado');
  const falhas = [];
  for (const e of zip.entries) if (!(await inflarConferir(zip.path, e))) falhas.push(e.name);
  for (const x of lista) { const e = zip.entries.find(y => y.name === x.nome); if (!e || e.sha256 !== x.sha256 || e.usize !== x.tamanho) falhas.push('manifesto:' + x.nome); }
  const tamanho = fs.statSync(zip.path).size; const sha = await shaArquivo(zip.path);
  const blob = await fs.openAsBlob(zip.path);
  await etapa('enviando o ZIP');
  const up = await m.uploadFilePrivateMitra({ projectId: pid, file: new File([blob], nomeZip, { type: 'application/zip' }) });
  const chave = up.result && up.result.key;
  if (!chave) throw new Error('envio do ZIP falhou');
  const lk = await m.getFileLinkMitra({ projectId: pid, key: chave, ttlSeconds: 120 });
  const resp = await fetch((lk.result || lk).url); const h = crypto.createHash('sha256'); let tamVolta = 0;
  for await (const c of resp.body) { h.update(c); tamVolta += c.length; }
  const volta = h.digest('hex');
  const conferido = !falhas.length && volta === sha && tamVolta === tamanho ? 1 : 0;
  fs.unlinkSync(zip.path);
  await dml("UPDATE EXPORT_LEVE SET ESTADO = '" + (conferido ? 'PRONTO' : 'ERRO') + "', ETAPA = '" + (conferido ? 'pronto' : 'conferência falhou') + "', TERMINOU_EM = '" + agora() + "', CHAVE_ARQUIVO = '" + esc(chave) + "', NOME = '" + esc(nomeZip) + "', TAMANHO_BYTES = " + tamanho + ", SHA256 = '" + sha + "', ARQUIVOS = " + (zip.entries.length) + ", CONFERIDO = " + conferido + ", ERRO = " + (conferido ? 'NULL' : "'" + esc(('falhas: ' + falhas.join(', ') + ' | volta ' + volta + ' ' + tamVolta).slice(0, 480)) + "'") + " WHERE ID = " + LEVE.id);
  return { ok: !!conferido, nome: nomeZip, tamanho, sha256: sha, arquivos: zip.entries.length, falhas, releituraDoEnvio: volta === sha && tamVolta === tamanho, removidos };
}
try { return await main(); }
catch (e) {
  const msg = String((e && e.message) || e).slice(0, 450);
  try { if (LEVE.id) await dml("UPDATE EXPORT_LEVE SET ESTADO = 'ERRO', ERRO = '" + esc(msg) + "', TERMINOU_EM = '" + agora() + "' WHERE ID = " + LEVE.id); } catch (e2) {}
  return { ok: false, erro: msg };
}
