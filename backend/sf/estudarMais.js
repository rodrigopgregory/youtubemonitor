const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = __SF__;
async function sql(nome, input) {
  const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF[nome], input: input || {} });
  const res = r.result || r;
  if (res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res.error).slice(0, 300));
  return res.output;
}
const qtd = Math.floor(Number(event.quantidade));
if (!(qtd >= 1 && qtd <= 2000)) return { ok: false, erro: 'Escolha uma quantidade entre 1 e 2000 vídeos.' };
const canalId = Math.max(0, Math.floor(Number(event.canalId || 0)));
await sql('videosRetentar', {});
const r = await sql('canaisLimiteMais', { qtd, canalId });
if (!r || !r.affectedRows) return { ok: false, erro: 'Não encontrei o canal.' };
await m.executeServerFunctionAsyncMitra({ projectId: pid, serverFunctionId: SF.motor, input: { modo: 'continuar' } });
return { ok: true, quantidade: qtd, canais: r.affectedRows };
