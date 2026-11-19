const m = require('mitra-sdk');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const pid = Number(process.env.MITRA_PROJECT_ID);
const TESTE = !!event.teste;
const EMAIL = String(event.email || 'desenvolvimento');
const LIMITE_PARTE = 85 * 1024 * 1024;
const INTERNO = /^(INT_|DIM_|CAD_|CC_|CUBE_|CUB_|CONNECTION|DATABASECHANGELOG|JAVA_DATE_FORMAT)/;
const SO_ESTRUTURA = t => /^EXPORT_/.test(t) || t === 'LOTES';
const agora = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\0/g, '');
const id = s => '`' + String(s).replace(/`/g, '``') + '`';
const inteiro = n => { const v = Number(n); if (!Number.isSafeInteger(v)) throw new Error('inteiro inválido'); return v; };
async function q(sql) { const r = await m.runQueryMitra({ projectId: pid, sql }); const x = r.result || r; return x.rows || []; }
async function dml(sql) { return m.runDmlMitra({ projectId: pid, sql }); }
const sqlLit = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? (Number.isFinite(v) ? String(v) : 'NULL') : typeof v === 'boolean' ? (v ? '1' : '0') : "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\0/g, '\\0').replace(/\x1a/g, '\\Z') + "'";
const csvCel = (v, nulo) => v === null || v === undefined ? nulo : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? '1' : '0') : '"' + String(v).replace(/"/g, '""') + '"';
const csvLinha = (arr, nulo) => arr.map(v => csvCel(v, nulo)).join(',') + '\n';
const hms = s => { s = Math.max(0, Math.floor(Number(s) || 0)); const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), x = s % 60; return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
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
const PACOTE = { id: 0 };
const PARTES = [];
const TMP = '/tmp/exp-' + Date.now();
fs.mkdirSync(TMP, { recursive: true });
class Grupo {
  constructor(nome, numerado) { this.nome = nome; this.numerado = numerado; this.n = 0; this.zip = null; this.lista = []; }
  nomeParte() { return (this.numerado || this.n > 1) ? this.nome + '-' + this.n + '.zip' : this.nome + '.zip'; }
  async garantir() {
    if (this.zip && this.zip.off > LIMITE_PARTE && !this.zip.cur) await this.fechar();
    if (!this.zip) { this.n++; this.zip = new Zip(TMP + '/' + this.nome + '-' + this.n + '.zip'); this.zip.nomeParte = this.nomeParte(); this.zip.grupo = this; }
    return this.zip;
  }
  async add(name, data) { const z = await this.garantir(); const e = await z.add(name, data); return e; }
  async fechar() {
    if (!this.zip) return;
    const z = this.zip; this.zip = null;
    if (!z.entries.length) { z.close(); return; }
    const manifestoParte = { parte: z.nomeParte, gerado_em: agora(), arquivos: z.entries.map(e => ({ nome: e.name, tamanho: e.usize, sha256: e.sha256 })) };
    const todas = z.entries.slice();
    const mp = await z.add('MANIFEST_PARTE_' + z.nomeParte.replace('.zip', '') + '.json', JSON.stringify(manifestoParte, null, 1));
    z.close();
    let ok = true; const falhas = [];
    for (const e of z.entries) { if (!(await inflarConferir(z.path, e))) { ok = false; falhas.push(e.name); } }
    const tamanho = fs.statSync(z.path).size; const sha = await shaArquivo(z.path);
    const blob = await fs.openAsBlob(z.path);
    const up = await m.uploadFilePrivateMitra({ projectId: pid, file: new File([blob], z.nomeParte, { type: 'application/zip' }) });
    const chave = up.result && up.result.key;
    if (!chave) throw new Error('envio da parte ' + z.nomeParte + ' falhou');
    fs.unlinkSync(z.path);
    const info = { nome: z.nomeParte, chave, tamanho, sha256: sha, arquivos: z.entries.length, conferido_apos_gravar: ok, falhas, entradas: z.entries.map(e => ({ nome: e.name, tamanho: e.usize, sha256: e.sha256 })) };
    PARTES.push(info);
    await dml("INSERT INTO EXPORT_PARTES (PACOTE_ID, NOME, CHAVE_ARQUIVO, TAMANHO_BYTES, SHA256) VALUES (" + PACOTE.id + ",'" + esc(info.nome) + "','" + esc(chave) + "'," + tamanho + ",'" + sha + "')");
  }
}
const mb = () => { const u = process.memoryUsage(); return ' [' + Math.round(u.rss / 1048576) + 'MB rss, heap ' + Math.round(u.heapUsed / 1048576) + 'MB, ext ' + Math.round((u.external + u.arrayBuffers) / 1048576) + 'MB]'; };
async function etapa(txt) { try { await dml("UPDATE EXPORT_PACOTES SET ETAPA = '" + esc(String(txt + mb()).slice(0, 190)) + "' WHERE ID = " + PACOTE.id); } catch (e) {} }
function ordenarTabelas(tabs, fks) {
  const dep = new Map(tabs.map(t => [t, new Set()]));
  for (const f of fks) if (dep.has(f.tabela) && dep.has(f.pai) && f.tabela !== f.pai) dep.get(f.tabela).add(f.pai);
  const out = [], vis = new Set();
  const visita = t => { if (vis.has(t)) return; vis.add(t); [...dep.get(t)].sort().forEach(visita); out.push(t); };
  [...tabs].sort().forEach(visita);
  return out;
}
const ver = { orfaosArquivo: [], fk: [], vinculosSoft: [], minut: [], contagens: [], zips: [], avisos: [] };
const avisos = [];
async function main() {
  const t0 = agora();
  const esquemaNome = (await q('SELECT DATABASE() D'))[0].D;
  const versao = (await q('SELECT VERSION() V'))[0].V;
  await dml("INSERT INTO EXPORT_PACOTES (EMAIL, ESTADO, ETAPA, CRIADO_EM, DADOS_EM) VALUES ('" + esc(EMAIL) + "','GERANDO','iniciando','" + t0 + "','" + t0 + "')");
  PACOTE.id = inteiro((await q("SELECT MAX(ID) I FROM EXPORT_PACOTES WHERE EMAIL = '" + esc(EMAIL) + "'"))[0].I);
  await dml("INSERT INTO EXPORT_LOG (QUANDO, EMAIL, EVENTO, RESULTADO, DETALHE) VALUES ('" + t0 + "','" + esc(EMAIL) + "','geracao_inicio','ok','pacote " + PACOTE.id + (TESTE ? ' (teste)' : '') + "')");
  const gBanco = new Grupo('banco', false), gCsv = new Grupo('banco-csv', false), gTrans = new Grupo('transcricoes', true), gGeral = new Grupo('complemento', false), gRaiz = new Grupo('00-raiz', false);
  const arquivosGerais = [];
  const addGeral = async (nome, conteudo) => { const e = await gGeral.add(nome, conteudo); return e; };
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
  await gBanco.add('banco/schema.sql', ddl.join('\n') + '\n');
  const snap = {};
  await etapa('contando linhas');
  for (const n of ordem) {
    const mt = meta[n]; const cols = mt.cols.map(c => c.COLUMN_NAME);
    const colTipo = c => (mt.cols.find(x => x.COLUMN_NAME === c) || {}).DATA_TYPE;
    const pkInt = mt.pk.length === 1 && ['int', 'bigint', 'smallint', 'mediumint'].includes(colTipo(mt.pk[0]));
    const s = { cols, pkInt, pk: mt.pk, soEstrutura: SO_ESTRUTURA(n), temTexto: mt.cols.some(c => ['text', 'longtext', 'mediumtext'].includes(c.DATA_TYPE)), grande: mt.cols.some(c => c.DATA_TYPE === 'longtext') };
    if (s.soEstrutura) { s.total = 0; s.max = null; }
    else if (pkInt) { const r = (await q('SELECT COUNT(*) N, MAX(' + id(mt.pk[0]) + ') M FROM ' + id(n)))[0]; s.total = Number(r.N); s.max = r.M === null ? null : inteiro(r.M); }
    else { s.total = Number((await q('SELECT COUNT(*) N FROM ' + id(n)))[0].N); s.max = null; }
    snap[n] = s;
  }
  const mem = { VIDEOS: [], CANAIS: [], TEMAS: [], PRATICAS: [], VIDEO_TEMAS: [] };
  const idxCol = n => Object.fromEntries(snap[n].cols.map((c, i) => [c, i]));
  const videoPorId = new Map(), canalPorId = new Map(), segs = new Map(), indiceTrans = [];
  let orfaosTrechos = 0, trechosLinhas = 0;
  const trans = { vid: null, linhas: [] };
  const flushTrans = async () => {
    if (trans.vid === null) return;
    const v = videoPorId.get(trans.vid);
    if (!v) { orfaosTrechos += trans.linhas.length; trans.vid = null; trans.linhas = []; return; }
    const conteudo = trans.linhas.join('\n') + '\n';
    const chave = 'transcricoes/' + v.yt + '.txt';
    const e = await gTrans.add(chave, conteudo);
    const canal = canalPorId.get(v.canal);
    indiceTrans.push([v.yt, v.id, v.titulo, canal ? canal.nome : '', v.publicado, v.dur, chave, e.usize, e.sha256]);
    trans.vid = null; trans.linhas = [];
  };
  const gancho = {
    CANAIS: (r, ix) => { canalPorId.set(r[ix.ID], { id: r[ix.ID], nome: r[ix.NOME], handle: r[ix.HANDLE], yt: r[ix.YT_CHANNEL_ID] }); },
    VIDEOS: (r, ix) => { videoPorId.set(r[ix.ID], { id: r[ix.ID], yt: r[ix.YT_VIDEO_ID], titulo: r[ix.TITULO], canal: r[ix.CANAL_ID], dur: Number(r[ix.DURACAO_SEG]) || 0, publicado: r[ix.PUBLICADO_EM], status: r[ix.STATUS] }); },
    TEMAS: (r, ix) => { mem.TEMAS.push({ id: r[ix.ID], nome: r[ix.NOME] }); },
    PRATICAS: (r, ix) => { mem.PRATICAS.push({ id: r[ix.ID], video: r[ix.VIDEO_ID], tipo: r[ix.TIPO], titulo: r[ix.TITULO], instrucao: r[ix.INSTRUCAO], segundo: r[ix.SEGUNDO], jeito: r[ix.JEITO], serve: r[ix.SERVE], quando: r[ix.QUANDO] }); },
    VIDEO_TEMAS: (r, ix) => { mem.VIDEO_TEMAS.push({ id: r[ix.ID], video: r[ix.VIDEO_ID], tema: r[ix.TEMA_ID], origem: r[ix.ORIGEM], momentos: r[ix.MOMENTOS] }); },
    TRECHOS: async (r, ix) => {
      const vid = r[ix.VIDEO_ID];
      if (vid !== trans.vid) { await flushTrans(); trans.vid = vid; }
      let a = segs.get(vid); if (!a) { a = []; segs.set(vid, a); }
      a.push(Number(r[ix.SEGUNDO]));
      trans.linhas.push('[' + hms(r[ix.SEGUNDO]) + '] ' + String(r[ix.TEXTO]).replace(/\r?\n/g, ' '));
      trechosLinhas++;
    },
  };
  const zipDados = await gBanco.garantir();
  zipDados.begin('banco/dados.sql');
  await zipDados.write('-- Dados exportados em ' + t0 + ' (horário de Brasília). NULL preservado; datas como estão (texto).\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\nSET UNIQUE_CHECKS = 0;\nSET SQL_MODE = \'NO_AUTO_VALUE_ON_ZERO\';\n\n');
  const escritas = {};
  for (const n of ordem) {
    const s = snap[n];
    if (s.soEstrutura || s.total === 0) { escritas[n] = 0; continue; }
    await etapa('exportando ' + n + ' (' + s.total + ' linhas)');
    const zipCsv = await gCsv.garantir();
    zipCsv.begin('banco/csv/' + n + '.csv');
    await zipCsv.write(csvLinha(s.cols, '\\N'));
    await zipDados.write('-- ' + n + ': ' + s.total + ' linhas\n');
    const ix = idxCol(n); const cab = 'INSERT INTO ' + id(n) + ' (' + s.cols.map(id).join(',') + ') VALUES\n';
    const lim = s.grande ? 150 : s.temTexto ? 1000 : 2000;
    const lista = s.cols.map(id).join(',');
    let lastA = null, lastB = null, offset = 0, escrito = 0, paginas = 0;
    for (;;) {
      let sql;
      if (n === 'TRECHOS') sql = 'SELECT ' + lista + ' FROM `TRECHOS` WHERE `ID` <= ' + s.max + (lastA === null ? '' : ' AND (`VIDEO_ID` > ' + inteiro(lastA) + ' OR (`VIDEO_ID` = ' + inteiro(lastA) + ' AND `SEGUNDO` > ' + inteiro(lastB) + '))') + ' ORDER BY `VIDEO_ID`, `SEGUNDO` LIMIT ' + lim;
      else if (s.pkInt) sql = 'SELECT ' + lista + ' FROM ' + id(n) + ' WHERE ' + id(s.pk[0]) + ' <= ' + s.max + (lastA === null ? '' : ' AND ' + id(s.pk[0]) + ' > ' + inteiro(lastA)) + ' ORDER BY ' + id(s.pk[0]) + ' LIMIT ' + lim;
      else sql = 'SELECT ' + lista + ' FROM ' + id(n) + ' ORDER BY ' + (s.pk.length ? s.pk.map(id).join(',') : lista) + ' LIMIT ' + lim + ' OFFSET ' + offset;
      const rows = await q(sql);
      if (!rows.length) break;
      const mat = rows.map(r => s.cols.map(c => { const v = r[c]; return typeof v === 'boolean' ? (v ? 1 : 0) : v; }));
      await zipDados.write(cab + mat.map(r => '(' + r.map(sqlLit).join(',') + ')').join(',\n') + ';\n');
      await zipCsv.write(mat.map(r => csvLinha(r, '\\N')).join(''));
      for (const r of mat) { if (gancho[n]) await gancho[n](r, ix); }
      escrito += mat.length; offset += mat.length; paginas++;
      const ultimo = mat[mat.length - 1];
      if (n === 'TRECHOS') { lastA = ultimo[ix.VIDEO_ID]; lastB = ultimo[ix.SEGUNDO]; } else if (s.pkInt) lastA = ultimo[ix[s.pk[0]]];
      if (paginas % 40 === 0) await etapa('exportando ' + n + ' ' + escrito + '/' + s.total);
      if (rows.length < lim) break;
      if (TESTE && paginas >= 2) break;
    }
    if (n === 'TRECHOS') await flushTrans();
    await zipDados.write('\n');
    await zipCsv.end();
    escritas[n] = escrito;
  }
  await zipDados.write('SET UNIQUE_CHECKS = 1;\nSET FOREIGN_KEY_CHECKS = 1;\n');
  await zipDados.end();
  await gBanco.fechar();
  await gCsv.fechar();
  await etapa('montando vínculos e leitura');
  const nomeTema = new Map(mem.TEMAS.map(t => [t.id, t.nome]));
  const fimDe = (vid, s, dur) => { const a = segs.get(vid); if (a) { let lo = 0, hi = a.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid] > s) hi = mid; else lo = mid + 1; } if (lo < a.length) return a[lo]; } return dur >= s ? dur : s; };
  const url = (yt, s) => 'https://youtu.be/' + yt + '?t=' + Math.max(0, Math.floor(s));
  const minutCab = ['tipo', 'subtipo', 'texto', 'video_id', 'video_id_interno', 'video_titulo', 'canal', 'inicio_seg', 'fim_seg', 'fim_calculado', 'url_com_tempo', 'origem', 'origem_id'];
  const leit = { mantras: [], exercicios: [], temas: [], mentores: [] };
  const minut = [];
  let acimaDuracao = 0, semArquivo = 0, semMinut = 0; const exemplosAcima = [], exemplosSemArq = [];
  const registrar = (tipo, subtipo, texto, v, s, origem, oid, extra) => {
    const canal = canalPorId.get(v.canal); const cn = canal ? canal.nome : '';
    const fim = fimDe(v.id, s, v.dur);
    if (v.dur > 0 && s > v.dur) { acimaDuracao++; if (exemplosAcima.length < 20) exemplosAcima.push(origem + '#' + oid + ' vídeo ' + v.yt + ' início ' + s + 's > duração ' + v.dur + 's'); }
    if (!segs.has(v.id)) { semArquivo++; if (exemplosSemArq.length < 20) exemplosSemArq.push(origem + '#' + oid + ' vídeo ' + v.yt); }
    const link = url(v.yt, s);
    minut.push([tipo, subtipo, texto, v.yt, v.id, v.titulo, cn, s, fim, 1, link, origem, oid]);
    return { cn, fim, link };
  };
  for (const p of mem.PRATICAS) {
    const v = videoPorId.get(p.video); if (!v || p.segundo === null || p.segundo === undefined) { semMinut++; continue; }
    const mantra = p.tipo === 'mantra e decreto';
    const r = registrar(mantra ? 'mantra' : 'exercicio', p.tipo, p.titulo + (p.instrucao ? ' | ' + p.instrucao : ''), v, Number(p.segundo), 'PRATICAS', p.id);
    (mantra ? leit.mantras : leit.exercicios).push([p.id, p.tipo, p.titulo, p.instrucao, p.jeito, p.serve, p.quando, v.titulo, r.cn, v.yt, Number(p.segundo), hms(p.segundo), r.fim, r.link]);
  }
  for (const vt of mem.VIDEO_TEMAS) {
    const v = videoPorId.get(vt.video); const nome = nomeTema.get(vt.tema) || ''; if (!v) continue;
    const mentor = nome.startsWith('mentor: '); const tipo = mentor ? 'mentor' : 'tema'; const rotulo = mentor ? nome.slice(8) : nome;
    const lista = String(vt.momentos || '').split(',').map(x => x.trim()).filter(x => x !== '' && /^\d+$/.test(x)).map(Number);
    if (!lista.length) { semMinut++; (mentor ? leit.mentores : leit.temas).push([vt.id, rotulo, vt.origem, v.titulo, canalPorId.get(v.canal) ? canalPorId.get(v.canal).nome : '', v.yt, '', '', '', 'https://youtu.be/' + v.yt]); continue; }
    for (const s of lista) {
      const r = registrar(tipo, vt.origem || '', rotulo, v, s, 'VIDEO_TEMAS', vt.id);
      (mentor ? leit.mentores : leit.temas).push([vt.id, rotulo, vt.origem, v.titulo, r.cn, v.yt, s, hms(s), r.fim, r.link]);
    }
  }
  await etapa('ordenando minutagem (' + minut.length + ')');
  minut.sort((a, b) => (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0) || a[7] - b[7]);
  await etapa('minutagem ordenada');
  await etapa('gravando indice_minutagem');
  { const zg = await gGeral.garantir(); zg.begin('vinculos/indice_minutagem.csv'); await zg.write(csvLinha(minutCab, '')); for (let i = 0; i < minut.length; i += 2000) await zg.write(minut.slice(i, i + 2000).map(r => csvLinha(r, '')).join('')); await zg.end(); }
  await etapa('minutagem gravada');
  const cabP = ['id_pratica', 'tipo', 'titulo', 'instrucao', 'jeito_de_fazer', 'para_que_serve', 'quando_fazer', 'video_titulo', 'canal', 'video_id', 'inicio_seg', 'inicio_hms', 'fim_seg_calculado', 'link_com_minutagem'];
  const cabT = ['id_vinculo', 'nome', 'origem', 'video_titulo', 'canal', 'video_id', 'inicio_seg', 'inicio_hms', 'fim_seg_calculado', 'link_com_minutagem'];
  await addGeral('leitura/mantras.csv', csvLinha(cabP, '') + leit.mantras.map(r => csvLinha(r, '')).join(''));
  await addGeral('leitura/exercicios.csv', csvLinha(cabP, '') + leit.exercicios.map(r => csvLinha(r, '')).join(''));
  await addGeral('leitura/temas.csv', csvLinha(cabT, '') + leit.temas.map(r => csvLinha(r, '')).join(''));
  await addGeral('leitura/mentores.csv', csvLinha(cabT, '') + leit.mentores.map(r => csvLinha(r, '')).join(''));
  await addGeral('transcricoes/indice_transcricoes.csv', csvLinha(['video_id', 'video_id_interno', 'titulo', 'canal', 'data_publicacao', 'duracao_seg', 'chave_arquivo', 'tamanho_bytes', 'sha256'], '') + indiceTrans.map(r => csvLinha(r, '')).join(''));
  await etapa('lendo plataforma e funções');
  const usuarios = (await m.listProjectUsersMitra({ projectId: pid })).result || [];
  const perfisLista = ((await m.listProfilesMitra({ projectId: pid })).result || []).filter(p => p.id > 0);
  const perfis = [];
  for (const p of perfisLista) { const d = ((await m.getProfileDetailsMitra({ projectId: pid, profileId: p.id })).result) || {}; perfis.push({ id: p.id, nome: p.name, usuarios: (d.users || []).map(u => ({ userId: u.userId, nome: u.name, email: u.email })), funcoes: (d.serverFunctions || []).map(f => ({ numero: f.serverFunctionId, nome: f.serverFunctionName })) }); }
  const csvPlat = csvLinha(['user_id', 'nome', 'email', 'perfil', 'tipo', 'acesso_ao_pacote'], '');
  const donos = (await q('SELECT EMAIL FROM EXPORT_DONOS WHERE ATIVO = 1')).map(d => String(d.EMAIL).toLowerCase());
  await addGeral('plataforma/usuarios.csv', csvPlat + usuarios.map(u => csvLinha([u.userId, u.name, u.email, u.profile, u.userType, donos.includes(String(u.email).toLowerCase()) ? 'sim' : 'não'], '')).join(''));
  await addGeral('plataforma/perfis.json', JSON.stringify({ observacao: 'Sem hashes de senha nem tokens.', donos_autorizados_a_gerar_pacote: donos, perfis }, null, 1));
  const integr = (await m.listIntegrationsMitra({ projectId: pid })).result || (await m.listIntegrationsMitra({ projectId: pid }));
  const listaIntegr = Array.isArray(integr) ? integr : (integr.result || []);
  const conexoes = listaIntegr.map(i => { const cr = i.credentials || {}; const base = String(cr.base_url || '').split('?')[0]; const az = i.authorizationConfig || {}; return { nome: i.name, slug: i.slug, tipo: i.blueprintType, autenticacao: i.authType, url_base: base, campos_de_credencial: Object.keys(cr), onde_vai_a_chave: az.type ? { tipo: az.type, nome_do_campo: az.config && az.config.name } : null, observacao: /^zz-teste/.test(String(i.name)) ? 'Sobra de teste.' : '' }; });
  await addGeral('plataforma/conexoes.json', JSON.stringify({ observacao: 'Somente nomes, URL base e nomes dos campos. Nenhum valor de chave.', conexoes }, null, 1));
  const fnLista = (await m.listServerFunctionsMitra({ projectId: pid })); const fns = (fnLista.result || fnLista).filter(f => f.name !== 'zzSondaExport');
  await addGeral('plataforma/rotinas.csv', csvLinha(['funcao', 'numero', 'cron', 'entrada', 'o_que_faz'], '') + fns.filter(f => f.cronExpression).map(f => csvLinha([f.name, f.id, f.cronExpression, f.cronInputJson || '', f.description || ''], '')).join(''));
  const perfilPorFn = new Map();
  for (const p of perfis) for (const f of p.funcoes) { const a = perfilPorFn.get(f.numero) || []; a.push(p.nome); perfilPorFn.set(f.numero, a); }
  const indiceFn = [];
  for (const f of fns.sort((a, b) => a.id - b.id)) {
    const d = (await m.readServerFunctionMitra({ projectId: pid, serverFunctionId: f.id })).result || {};
    const code = String(d.code || '');
    const params = f.type === 'SQL' ? [...new Set([...code.matchAll(/\{\{(\w+)\}\}/g)].map(x => x[1]))] : [...new Set([...code.matchAll(/event\.(\w+)/g)].map(x => x[1]))];
    const ext = f.type === 'SQL' ? 'sql' : 'js';
    const e = await addGeral('funcoes/' + String(f.id).padStart(3, '0') + '-' + f.name + '.' + ext, code);
    indiceFn.push([f.id, f.name, f.type, params.join(' '), (perfilPorFn.get(f.id) || []).join(' | '), f.cronExpression || '', f.description || '', e.usize, e.sha256]);
  }
  await addGeral('funcoes/INDICE_FUNCOES.csv', csvLinha(['numero', 'nome', 'tipo', 'parametros', 'perfis', 'cron', 'descricao', 'tamanho_bytes', 'sha256'], '') + indiceFn.map(r => csvLinha(r, '')).join(''));
  await etapa('verificando integridade');
  for (const f of fks) {
    if (SO_ESTRUTURA(f.tabela) || snap[f.tabela].total === 0) { ver.fk.push(f.tabela + '.' + f.cols.join(',') + ' -> ' + f.pai + ': sem linhas exportadas, não verificado'); continue; }
    const on = f.cols.map((c, i) => 'c.' + id(c) + ' = p.' + id(f.refs[i])).join(' AND ');
    try { const r = await q('SELECT COUNT(*) N FROM ' + id(f.tabela) + ' c LEFT JOIN ' + id(f.pai) + ' p ON ' + on + ' WHERE p.' + id(f.refs[0]) + ' IS NULL AND c.' + id(f.cols[0]) + ' IS NOT NULL'); ver.fk.push(f.tabela + '.' + f.cols.join(',') + ' -> ' + f.pai + ' (' + f.del + '): ' + r[0].N + ' violações'); }
    catch (e) { ver.fk.push(f.tabela + ' -> ' + f.pai + ': ERRO ao verificar: ' + String(e.message).slice(0, 120)); }
  }
  for (const [rot, sql] of [['LIVRO_CAPITULOS.TEMA_ID sem tema (sem FK no banco)', 'SELECT COUNT(*) N FROM LIVRO_CAPITULOS c LEFT JOIN TEMAS t ON t.ID = c.TEMA_ID WHERE t.ID IS NULL AND c.TEMA_ID IS NOT NULL'], ['PLAYLIST_VIDEOS.YT_VIDEO_ID de vídeo não monitorado (sem FK; esperado, a playlist lista vídeos de fora)', 'SELECT COUNT(*) N FROM PLAYLIST_VIDEOS pv LEFT JOIN VIDEOS v ON v.YT_VIDEO_ID = pv.YT_VIDEO_ID WHERE v.ID IS NULL']]) {
    try { ver.vinculosSoft.push(rot + ': ' + (await q(sql))[0].N); } catch (e) { ver.vinculosSoft.push(rot + ': ERRO ' + String(e.message).slice(0, 100)); }
  }
  const semTrechos = [...videoPorId.values()].filter(v => !segs.has(v.id));
  const porStatus = {}; semTrechos.forEach(v => { porStatus[v.status] = (porStatus[v.status] || 0) + 1; });
  ver.orfaosArquivo.push('Arquivos de transcrição gerados: ' + indiceTrans.length + '; vídeos com trechos no banco: ' + segs.size + '.');
  ver.orfaosArquivo.push('Arquivo sem vídeo correspondente (trechos de vídeo inexistente): ' + orfaosTrechos + ' trechos.');
  ver.orfaosArquivo.push('Vídeos do banco sem arquivo de transcrição: ' + semTrechos.length + ' (por status: ' + JSON.stringify(porStatus) + ').');
  ver.orfaosArquivo.push('O banco não tem coluna que guarde chave de arquivo privado: não há referência banco -> arquivo para conferir; a ligação é VIDEOS.ID = TRECHOS.VIDEO_ID e o nome do arquivo é YT_VIDEO_ID.txt.');
  ver.minut.push('Registros de minutagem gerados: ' + minut.length + ' (mantras/exercícios de PRATICAS e temas/mentores de VIDEO_TEMAS.MOMENTOS).');
  ver.minut.push('Com início maior que a duração do vídeo: ' + acimaDuracao + (exemplosAcima.length ? '\n  ' + exemplosAcima.join('\n  ') : ''));
  ver.minut.push('Apontando para vídeo sem transcrição: ' + semArquivo + (exemplosSemArq.length ? '\n  ' + exemplosSemArq.join('\n  ') : ''));
  ver.minut.push('Registros classificados sem tempo (ficam só nos CSVs de leitura, sem linha em indice_minutagem): ' + semMinut);
  for (const n of ordem) {
    const s = snap[n]; let agoraN = '-';
    if (!s.soEstrutura) agoraN = (await q('SELECT COUNT(*) N FROM ' + id(n)))[0].N;
    ver.contagens.push([n, s.soEstrutura ? 'só estrutura' : s.total, s.soEstrutura ? 0 : escritas[n], agoraN, s.soEstrutura ? 'ok' : (escritas[n] === s.total ? 'ok' : 'DIFERENTE')]);
  }
  const codigoDev = (await q('SELECT CHAVE_ARQUIVO, GERADO_EM, COMMIT_HASH, TAMANHO_BYTES FROM EXPORT_CODIGO_DEV ORDER BY ID DESC LIMIT 1'))[0] || null;
  await gGeral.fechar(); await gTrans.fechar();
  const conferirTudo = PARTES.every(p => p.conferido_apos_gravar);
  const totais = { tabelas_com_dados: ordem.filter(n => !snap[n].soEstrutura).length, tabelas_so_estrutura: ordem.filter(n => snap[n].soEstrutura).length, views: viewDefs.length, linhas: Object.values(escritas).reduce((a, b) => a + b, 0), transcricoes: indiceTrans.length };
  const L = [];
  L.push('# Verificação de integridade', '', 'Gerado em ' + agora() + (TESTE ? ' (EXECUÇÃO DE TESTE: tabelas grandes foram cortadas)' : '') + '. Banco de origem: MySQL ' + versao + '.', '');
  L.push('## 1. Arquivos x banco', ...ver.orfaosArquivo.map(x => '- ' + x), '');
  L.push('## 2. Chaves estrangeiras (violações)', ...ver.fk.map(x => '- ' + x), '', '### Ligações sem chave estrangeira', ...ver.vinculosSoft.map(x => '- ' + x), '');
  L.push('## 3. Minutagem', ...ver.minut.map(x => '- ' + x), '');
  L.push('## 4. Contagens (linhas no início | exportadas | no fim da geração)', '', '| tabela | no início | exportadas | no fim | resultado |', '|---|---|---|---|---|', ...ver.contagens.map(r => '| ' + r.join(' | ') + ' |'), '', 'Se "no fim" for maior que "exportadas", o app gravou durante a geração (a leitura das práticas roda sozinha). O pacote é uma foto do início.', '');
  L.push('## 5. SHA-256 conferido depois de gravado no ZIP', '', 'Cada arquivo foi relido do ZIP gravado em disco, descompactado e comparado (SHA-256, CRC-32 e tamanho) com o valor calculado na gravação.', '', '| parte | arquivos | tamanho | SHA-256 do ZIP | releitura |', '|---|---|---|---|---|', ...PARTES.map(p => '| ' + p.nome + ' | ' + p.arquivos + ' | ' + p.tamanho + ' | ' + p.sha256 + ' | ' + (p.conferido_apos_gravar ? 'ok' : 'FALHOU: ' + p.falhas.join(', ')) + ' |'), '', 'A parte 00-raiz.zip (que contém este arquivo) é conferida depois de fechada e o resultado vai no MANIFEST_GERAL.json e na tela.', '');
  L.push('## 6. Carga em banco vazio', '', 'NÃO executada pelo gerador (o servidor do Mitra não tem outro MySQL). O script scripts/carregar_e_conferir.sh faz a carga e compara com banco/contagens.tsv. O resultado do teste feito pelo desenvolvedor vem em separado.', '');
  const verificacao = L.join('\n');
  const ENV = ['# Nomes das variáveis. Preencha os valores no novo ambiente. Nada aqui é segredo.', 'MITRA_BASE_URL=', 'MITRA_TOKEN=', 'MITRA_PROJECT_ID=', 'VITE_MITRA_PROJECT_ID=', 'DB_HOST=', 'DB_PORT=3306', 'DB_NAME=', 'DB_USER=', 'DB_PASSWORD=', ...conexoes.flatMap(c => c.campos_de_credencial.filter(k => !/base_url/.test(k)).map(k => (c.slug + '_' + k).toUpperCase().replace(/[^A-Z0-9_]/g, '_') + '='))].join('\n') + '\n';
  const contagensTsv = ordem.filter(n => !snap[n].soEstrutura).map(n => n + '\t' + escritas[n]).join('\n') + '\n';
  const sh = ['#!/usr/bin/env bash', 'set -euo pipefail', '# Uso: DB_HOST=127.0.0.1 DB_USER=root DB_PASSWORD=... ./scripts/carregar_e_conferir.sh nome_do_banco', 'BANCO="${1:?informe o nome do banco}"', 'M="mysql -h ${DB_HOST:-127.0.0.1} -P ${DB_PORT:-3306} -u ${DB_USER:-root} --default-character-set=utf8mb4 --max-allowed-packet=512M"', '[ -n "${DB_PASSWORD:-}" ] && export MYSQL_PWD="$DB_PASSWORD"', '$M -e "CREATE DATABASE IF NOT EXISTS \\`$BANCO\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"', '$M "$BANCO" < banco/schema.sql', '$M "$BANCO" < banco/dados.sql', '$M -N -e "SELECT VERSION()"', 'ERROS=0', 'while IFS=$\'\\t\' read -r T N; do', '  R=$($M -N "$BANCO" -e "SELECT COUNT(*) FROM \\`$T\\`")', '  if [ "$R" = "$N" ]; then echo "ok   $T $R"; else echo "DIFERENTE $T esperado=$N obtido=$R"; ERROS=$((ERROS+1)); fi', 'done < banco/contagens.tsv', 'echo "tabelas com diferença: $ERROS"', 'exit $ERROS'].join('\n') + '\n';
  const AV = ['# Avisos da exportação', '', 'Pacote gerado em ' + agora() + '. Este pacote contém dados pessoais e conteúdo de terceiros (transcrições de vídeos). É confidencial: não publique.', '', '## O que não foi exportado, e por quê', '', '- Tabelas e views internas do Mitra (INT_, DIM_, CAD_, CC_, CUBE_, CUB_, CONNECTION*, DATABASECHANGELOG, JAVA_DATE_FORMAT): pertencem à plataforma, não ao app.', '- As tabelas EXPORT_* (códigos, registro, pacotes) e LOTES entram só com a estrutura. EXPORT_* guardam pacotes e registros da própria exportação; LOTES é só área de passagem.', '- Valores de chaves, tokens e senhas das conexões (Gemini, YouTube): o Mitra não entrega esses valores e não devem ir no pacote. Só nomes e campos.', '- Hashes de senha e tokens de usuários: não exportados.', '- Não existem arquivos TXT nem arquivos privados no app. As transcrições estão na tabela TRECHOS (uma linha por fala). Os TXT de /transcricoes/ foram GERADOS a partir dela, um por vídeo, com o nome YT_VIDEO_ID.txt. Quebras de linha dentro de uma fala viraram espaço no TXT; o texto exato está em TRECHOS.', '- Fim da minutagem: o banco guarda só o início (em segundos). O fim é CALCULADO como o início do trecho seguinte da transcrição; no último trecho vale a duração do vídeo. A coluna fim_calculado = 1 marca isso.', '- Triggers, rotinas e eventos do banco: o app não tem nenhum.', '- Views: recriadas com SQL SECURITY INVOKER, porque o DEFINER original (usuário da plataforma) não existe em outro lugar.', '- FULLTEXT (TEMAS.NOME, TRECHOS.TEXTO): o parser é o padrão; a plataforma não informa se havia parser especial.', '- Telas, SDK e funções do servidor dependem do Mitra para rodar. Veja DEPENDENCIAS_MITRA.md.', '- Código do desenvolvimento (git, fonte, dependências) vem do último pacote montado no desenvolvimento; a data está no MANIFEST_GERAL.json.', '- SQL novo deste gerador usa números validados e texto escapado (a API de consulta do Mitra não aceita parâmetros ligados). Nenhum texto digitado por pessoa entra nessas consultas.', ...(TESTE ? ['', '- ESTE FOI UM PACOTE DE TESTE, cortado.'] : []), ''].join('\n');
  const RD = ['# Migração para outra hospedagem', '', '1. Descompacte TODAS as partes (.zip) na mesma pasta. Os caminhos se completam (banco/, transcricoes/, vinculos/, leitura/, plataforma/, funcoes/, codigo/).', '2. Confira cada parte com MANIFEST_GERAL.json (SHA-256 do ZIP) e cada arquivo com MANIFEST.json.', '3. Crie um banco MySQL 8 (utf8mb4, collation utf8mb4_bin) e rode ./scripts/carregar_e_conferir.sh NOME_DO_BANCO (usa banco/schema.sql, banco/dados.sql e compara as contagens). Use --max-allowed-packet alto.', '4. Os CSV em banco/csv/ têm UTF-8, cabeçalho na primeira linha, texto sempre entre aspas duplas e NULL escrito como \\N (sem aspas). O caminho oficial para recriar o banco é o dados.sql; os CSV servem para outras ferramentas.', '5. Os TXT de transcricoes/ são cópia legível. A fonte completa e exata é a tabela TRECHOS.', '6. vinculos/indice_minutagem.csv liga cada mantra, exercício, tema e mentor ao vídeo e ao tempo (https://youtu.be/ID?t=SEGUNDOS). leitura/ tem os mesmos dados por categoria. Mantras = práticas do tipo "mantra e decreto"; exercícios = todas as outras práticas (coluna tipo diz qual). Mentores = temas que começam com "mentor: ".', '7. O app depende do Mitra (funções do servidor, envio de arquivos, conexões). Leia DEPENDENCIAS_MITRA.md para saber o que reescrever.', '8. Preencha .env.example no novo ambiente. Chaves do YouTube e do Gemini precisam ser criadas de novo; elas não vêm no pacote.', ''].join('\n');
  const zr = gRaiz;
  const raizArq = [['README_MIGRACAO.md', RD], ['EXPORT_AVISOS.md', AV], ['VERIFICACAO.md', verificacao], ['.env.example', ENV], ['banco/contagens.tsv', contagensTsv], ['scripts/carregar_e_conferir.sh', sh]];
  for (const [nome, cont] of raizArq) await zr.add(nome, cont);
  const todosArquivos = [];
  for (const p of PARTES) for (const e of p.entradas) todosArquivos.push({ parte: p.nome, nome: e.nome, tamanho: e.tamanho, sha256: e.sha256 });
  for (const e of gRaiz.zip.entries) todosArquivos.push({ parte: '00-raiz.zip', nome: e.name, tamanho: e.usize, sha256: e.sha256 });
  const manifesto = { gerado_em: agora(), dados_em: t0, versao_mysql_origem: versao, esquema: esquemaNome, teste: TESTE, totais, linhas_por_tabela: ordem.map(n => ({ tabela: n, linhas_no_inicio: snap[n].soEstrutura ? null : snap[n].total, linhas_exportadas: escritas[n] || 0, so_estrutura: snap[n].soEstrutura })), arquivos: todosArquivos, observacao: 'Os arquivos de 00-raiz.zip entram aqui; MANIFEST.json não lista a si mesmo.' };
  await zr.add('MANIFEST.json', JSON.stringify(manifesto, null, 1));
  await zr.fechar();
  let codigoParte = null;
  if (codigoDev && codigoDev.CHAVE_ARQUIVO) {
    const lk = await m.getFileLinkMitra({ projectId: pid, key: codigoDev.CHAVE_ARQUIVO, ttlSeconds: 600 });
    const resp = await fetch(lk.result.url); const h = crypto.createHash('sha256'); let tam = 0;
    for await (const c of resp.body) { h.update(c); tam += c.length; }
    codigoParte = { nome: 'codigo.zip', chave: codigoDev.CHAVE_ARQUIVO, tamanho: tam, sha256: h.digest('hex'), codigo_gerado_em: codigoDev.GERADO_EM, commit: codigoDev.COMMIT_HASH };
    await dml("INSERT INTO EXPORT_PARTES (PACOTE_ID, NOME, CHAVE_ARQUIVO, TAMANHO_BYTES, SHA256) VALUES (" + PACOTE.id + ",'codigo.zip','" + esc(codigoDev.CHAVE_ARQUIVO) + "'," + tam + ",'" + codigoParte.sha256 + "')");
  } else avisos.push('Pacote de código do desenvolvimento ainda não foi montado.');
  const geral = { pacote: PACOTE.id, gerado_em: agora(), dados_em: t0, codigo_em: codigoParte ? codigoParte.codigo_gerado_em : null, teste: TESTE, partes: PARTES.map(p => ({ nome: p.nome, tamanho: p.tamanho, sha256: p.sha256, arquivos: p.arquivos, conferido_apos_gravar: p.conferido_apos_gravar })).concat(codigoParte ? [codigoParte] : []), todas_as_partes_conferidas: conferirTudo, totais, avisos };
  const tamTotal = geral.partes.reduce((a, p) => a + p.tamanho, 0);
  geral.tamanho_total_bytes = tamTotal;
  await dml("UPDATE EXPORT_PACOTES SET ESTADO = 'PRONTO', ETAPA = 'pronto', TERMINOU_EM = '" + agora() + "', CODIGO_EM = " + (codigoParte ? "'" + esc(codigoParte.codigo_gerado_em) + "'" : 'NULL') + ", RESUMO_JSON = '" + esc(JSON.stringify(geral)) + "' WHERE ID = " + PACOTE.id);
  await dml("INSERT INTO EXPORT_LOG (QUANDO, EMAIL, EVENTO, RESULTADO, TAMANHO_BYTES, DETALHE) VALUES ('" + agora() + "','" + esc(EMAIL) + "','geracao_fim','ok'," + tamTotal + ",'pacote " + PACOTE.id + ", " + geral.partes.length + " partes')");
  return { ok: true, pacoteId: PACOTE.id, geral, verificacao: verificacao.slice(0, 200) };
}
try { return await main(); }
catch (e) {
  const msg = String((e && e.message) || e).slice(0, 450);
  try { if (PACOTE.id) await dml("UPDATE EXPORT_PACOTES SET ESTADO = 'ERRO', ERRO = '" + esc(msg) + "', TERMINOU_EM = '" + agora() + "' WHERE ID = " + PACOTE.id); await dml("INSERT INTO EXPORT_LOG (QUANDO, EMAIL, EVENTO, RESULTADO, DETALHE) VALUES ('" + agora() + "','" + esc(EMAIL) + "','geracao_fim','erro','" + esc(msg) + "')"); } catch (x) {}
  return { ok: false, erro: msg };
}
