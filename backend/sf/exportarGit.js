const m = require('mitra-sdk');
const zlib = require('zlib');
const pid = Number(process.env.MITRA_PROJECT_ID);
const agora = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19);
const esc = s => String(s === null || s === undefined ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\0/g, '');
async function q(sql) { const r = await m.runQueryMitra({ projectId: pid, sql }); const x = r.result || r; return x.rows || []; }
async function dml(sql) { return m.runDmlMitra({ projectId: pid, sql }); }
const SEGREDO = /AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/g;
const BINARIO = /\.(png|ico|jpg|jpeg|gif|webp|zip|bundle|woff2?|ttf)$/i;
const acao = String((event && event.acao) || 'estado');
async function cfgLer() { const o = {}; (await q('SELECT CHAVE, VALOR FROM GIT_CONFIG')).forEach(r => { o[r.CHAVE] = r.VALOR; }); return o; }
async function cfgGravar(chave, valor) { const v = "'" + esc(String(valor === null || valor === undefined ? '' : valor).slice(0, 900)) + "'"; await dml("INSERT INTO GIT_CONFIG (CHAVE, VALOR) VALUES ('" + esc(chave) + "'," + v + ") ON DUPLICATE KEY UPDATE VALOR = " + v); }
async function ultimoZip() { return (await q("SELECT ID, NOME, CHAVE_ARQUIVO, TERMINOU_EM, TAMANHO_BYTES FROM EXPORT_LEVE WHERE ESTADO = 'PRONTO' ORDER BY ID DESC LIMIT 1"))[0] || null; }
function publico(c, zip) {
  return { ok: true, configurado: !!(c.TOKEN && c.REPO), repo: c.REPO || '', branch: c.BRANCH || 'main', estado: c.ULT_ESTADO || '', etapa: c.ULT_ETAPA || '', quando: c.ULT_EM || '', commit: c.ULT_COMMIT || '', link: c.ULT_LINK || '', arquivos: Number(c.ULT_ARQUIVOS || 0), erro: c.ULT_ERRO || '', zip: zip ? { nome: zip.NOME, em: zip.TERMINOU_EM } : null };
}
function lerZip(buf) {
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error('ZIP inválido');
  const total = buf.readUInt16LE(fim + 10); let p = buf.readUInt32LE(fim + 16); const out = [];
  for (let k = 0; k < total; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP corrompido');
    const metodo = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + nl);
    const ln = buf.readUInt16LE(off + 26), le = buf.readUInt16LE(off + 28); const ini = off + 30 + ln + le;
    const bruto = buf.subarray(ini, ini + csize);
    out.push({ nome, dados: metodo === 8 ? zlib.inflateRawSync(bruto) : Buffer.from(bruto) });
    p += 46 + nl + el + cl;
  }
  return out;
}
async function main() {
  const c = await cfgLer();
  if (!c.TOKEN || !c.REPO) return { ok: false, erro: 'O envio ao GitHub ainda não foi configurado.' };
  if (c.ULT_ESTADO === 'ENVIANDO' && c.ULT_EM && c.ULT_EM > new Date(Date.now() - 3 * 3600e3 - 20 * 60e3).toISOString().slice(0, 19)) return { ok: false, erro: 'Já existe um envio em andamento.' };
  const zip = await ultimoZip();
  if (!zip) return { ok: false, erro: 'Gere a exportação leve antes de enviar.' };
  const token = c.TOKEN; const repo = c.REPO; const branch = c.BRANCH || 'main';
  await cfgGravar('ULT_ESTADO', 'ENVIANDO'); await cfgGravar('ULT_EM', agora()); await cfgGravar('ULT_ERRO', ''); await cfgGravar('ULT_ETAPA', 'lendo a exportação');
  const etapa = t => cfgGravar('ULT_ETAPA', t).catch(() => {});
  try {
    const gh = async (metodo, caminho, corpo) => {
      const r = await fetch('https://api.github.com/repos/' + repo + caminho, { method: metodo, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'monitor-canais', 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });
      const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
      if (!r.ok) throw new Error('GitHub ' + r.status + ' em ' + metodo + ' ' + caminho.split('/').slice(0, 3).join('/') + ': ' + String((j && j.message) || txt).slice(0, 200).split(token).join('***'));
      return j;
    };
    const lk = await m.getFileLinkMitra({ projectId: pid, key: zip.CHAVE_ARQUIVO, ttlSeconds: 300 });
    const resp = await fetch((lk.result || lk).url);
    if (!resp.ok) throw new Error('Não consegui ler o ZIP da exportação.');
    const entradas = lerZip(Buffer.from(await resp.arrayBuffer()));
    const arquivos = [];
    let limpos = 0;
    for (const e of entradas) {
      if (e.nome.endsWith('/') || e.nome === 'historico/repo.bundle') continue;
      let caminho = e.nome.startsWith('codigo/') ? e.nome.slice(7) : 'exportacao/' + e.nome;
      if (/(^|\/)\.env$/.test(caminho) || /(^|\/)node_modules\//.test(caminho)) continue;
      let dados = e.dados; let binario = BINARIO.test(caminho) || dados.includes(0);
      if (!binario) { let t = dados.toString('utf8'); const n = (t.match(SEGREDO) || []).length; if (n || t.includes(token)) { limpos += n + 1; t = t.replace(SEGREDO, '[REMOVIDO]').split(token).join('[REMOVIDO]'); } dados = Buffer.from(t, 'utf8'); }
      arquivos.push({ caminho, dados, binario: binario || dados.length === 0 });
    }
    await etapa('enviando ' + arquivos.length + ' arquivos');
    const head = await gh('GET', '/git/ref/heads/' + branch);
    const parent = head.object.sha;
    const pai = await gh('GET', '/git/commits/' + parent);
    let treeSha = pai.tree.sha;
    const itens = [];
    for (let i = 0; i < arquivos.length; i += 8) {
      const lote = arquivos.slice(i, i + 8);
      const feitos = await Promise.all(lote.map(async a => {
        if (a.binario) { const b = await gh('POST', '/git/blobs', { content: a.dados.toString('base64'), encoding: 'base64' }); return { path: a.caminho, mode: '100644', type: 'blob', sha: b.sha }; }
        return { path: a.caminho, mode: '100644', type: 'blob', content: a.dados.toString('utf8') };
      }));
      itens.push(...feitos);
    }
    for (let i = 0; i < itens.length; i += 60) {
      await etapa('montando a árvore ' + Math.min(i + 60, itens.length) + '/' + itens.length);
      const t = await gh('POST', '/git/trees', { base_tree: treeSha, tree: itens.slice(i, i + 60) });
      treeSha = t.sha;
    }
    const msg = 'Envio do Monitor de Canais em ' + agora().replace('T', ' ') + ' (exportação ' + zip.NOME + ')';
    const novo = await gh('POST', '/git/commits', { message: msg, tree: treeSha, parents: [parent] });
    await gh('PATCH', '/git/refs/heads/' + branch, { sha: novo.sha, force: false });
    await cfgGravar('ULT_ESTADO', 'PRONTO'); await cfgGravar('ULT_ETAPA', 'pronto'); await cfgGravar('ULT_EM', agora());
    await cfgGravar('ULT_COMMIT', novo.sha); await cfgGravar('ULT_LINK', 'https://github.com/' + repo + '/commit/' + novo.sha); await cfgGravar('ULT_ARQUIVOS', arquivos.length);
    return { ok: true, commit: novo.sha, arquivos: arquivos.length, limpos };
  } catch (e) {
    const erro = String((e && e.message) || e).split(token).join('***').slice(0, 450);
    await cfgGravar('ULT_ESTADO', 'ERRO'); await cfgGravar('ULT_ERRO', erro); await cfgGravar('ULT_EM', agora());
    return { ok: false, erro };
  }
}
if (acao === 'estado') return publico(await cfgLer(), await ultimoZip());
if (acao === 'enviar') return await main();
return { ok: false, erro: 'Ação desconhecida.' };
