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
const lerMinutos = txt => {
  const out = [];
  for (const parte of String(txt || '').split(/[,;\s]+/).filter(Boolean)) {
    const nums = parte.split(':').map(Number);
    if (nums.length > 3 || nums.some(n => !Number.isFinite(n) || n < 0)) return null;
    const seg = nums.length === 1 ? nums[0] * 60 : nums.reduce((tot, n) => tot * 60 + n, 0);
    out.push(Math.round(seg));
  }
  return [...new Set(out)].sort((a, b) => a - b).join(',');
};
const temMinutos = event.momentos !== undefined && event.momentos !== null;
const minutos = temMinutos ? lerMinutos(event.momentos) : '';
if (minutos === null) return { ok: false, erro: 'Minutos inválidos. Use 12 (minuto 12) ou 12:30, separados por vírgula.' };
if (!videoId) return { ok: false, erro: 'Vídeo não informado.' };
if (acao === 'acrescentar') {
  if (!nome) return { ok: false, erro: 'Escreva o nome do tema.' };
  await sql('temaGarantir', { nome });
  await sql('vtAcrescentar', { videoId, nome });
  if (temMinutos) await sql('vtMomentos', { videoId, nome, momentos: minutos });
} else if (acao === 'tirar') {
  await sql('vtTirar', { videoId, temaId: Number(event.temaId) });
} else if (acao === 'renomear') {
  if (!novo) return { ok: false, erro: 'Escreva o novo nome do tema.' };
  await sql('temaGarantir', { nome: novo });
  await sql('vtRenomear', { videoId, temaId: Number(event.temaId), nome: novo });
  await sql('vtTirarSeOutro', { videoId, temaId: Number(event.temaId), nome: novo });
  if (temMinutos) await sql('vtMomentos', { videoId, nome: novo, momentos: minutos });
} else return { ok: false, erro: 'Ação desconhecida.' };
await sql('videoMarcarEditado', { id: videoId });
return { ok: true };
