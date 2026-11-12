const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = __SF__;
async function sql(nome, input) {
  const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF[nome], input: input || {} });
  const res = r.result || r;
  if (res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res.error).slice(0, 300));
  return res.output;
}
const videoId = Number(event.videoId);
const acao = String(event.acao || '');
const limpa = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 150);
const nome = limpa(event.nome);
const novo = limpa(event.novo);
if (!videoId) return { ok: false, erro: 'Vídeo não informado.' };
if (acao === 'acrescentar') {
  if (!nome) return { ok: false, erro: 'Escreva o nome do tema.' };
  await sql('temaGarantir', { nome });
  await sql('vtAcrescentar', { videoId, nome });
} else if (acao === 'tirar') {
  await sql('vtTirar', { videoId, temaId: Number(event.temaId) });
} else if (acao === 'renomear') {
  if (!novo) return { ok: false, erro: 'Escreva o novo nome do tema.' };
  await sql('temaGarantir', { nome: novo });
  await sql('vtRenomear', { videoId, temaId: Number(event.temaId), nome: novo });
  await sql('vtTirarSeOutro', { videoId, temaId: Number(event.temaId), nome: novo });
} else return { ok: false, erro: 'Ação desconhecida.' };
await sql('videoMarcarEditado', { id: videoId });
return { ok: true };
