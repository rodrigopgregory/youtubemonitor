const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = __SF__;
const WEB = { clientName: 'WEB', clientVersion: '2.20251101.00.00', hl: 'pt', gl: 'BR' };
async function sql(nome, input) {
  const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF[nome], input: input || {} });
  const res = r.result || r;
  if (res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res.error).slice(0, 300));
  return res.output;
}
async function yt(ep, body) {
  const r = await m.callIntegrationMitra({ projectId: pid, connection: 'youtube-web', method: 'POST', endpoint: '/youtubei/v1/' + ep, body: Object.assign({ context: { client: WEB } }, body) });
  return r.result ? r.result.body : r.body;
}
let url = String(event.url || '').trim();
if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
let u; try { u = new (require('url').URL)(url); } catch (e) { return { ok: false, erro: 'Esse link não é um endereço válido. Cole o link do canal, por exemplo https://www.youtube.com/@NomeDoCanal' }; }
if (!/(^|\.)youtube\.com$/i.test(u.hostname)) return { ok: false, erro: 'Esse link não é de um canal do YouTube.' };
const caminho = u.pathname.replace(/\/(videos|streams|featured|shorts|playlists|live|about)\/?$/i, '');
if (!/^\/(@[^/]+|channel\/UC[\w-]+|c\/[^/]+|user\/[^/]+)\/?$/i.test(caminho)) return { ok: false, erro: 'Esse link não é de um canal do YouTube. Use o link do canal (com @nome ou /channel/...).' };
let channelId = (caminho.match(/channel\/(UC[\w-]+)/) || [])[1];
if (!channelId) {
  const r = await yt('navigation/resolve_url', { url: 'https://www.youtube.com' + caminho });
  channelId = r && r.endpoint && r.endpoint.browseEndpoint && r.endpoint.browseEndpoint.browseId;
}
if (!channelId || !/^UC/.test(channelId)) return { ok: false, erro: 'Não encontrei esse canal no YouTube. Confira se o link está certo e se o canal é público.' };
const ja = await sql('canalPorYt', { yt: channelId });
if (ja.rows && ja.rows.length) return { ok: false, duplicado: true, erro: 'O canal "' + ja.rows[0].NOME + '" já está cadastrado.' };
const b = await yt('browse', { browseId: channelId });
const md = (b && b.metadata && b.metadata.channelMetadataRenderer) || {};
const nome = md.title || caminho.replace(/^\//, '');
const thumbs = (md.avatar && md.avatar.thumbnails) || [];
const handle = (String(md.vanityChannelUrl || '').match(/@[^/]+$/) || [caminho.startsWith('/@') ? caminho.slice(1) : ''])[0];
await sql('canalInserir', { yt: channelId, handle: decodeURIComponent(handle || ''), nome, url: 'https://www.youtube.com' + caminho, uploads: 'UU' + channelId.slice(2), thumb: thumbs.length ? thumbs[thumbs.length - 1].url : '' });
await m.executeServerFunctionAsyncMitra({ projectId: pid, serverFunctionId: SF.motor, input: { modo: 'continuar' } });
return { ok: true, nome };
