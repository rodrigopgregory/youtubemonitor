const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = __SF__;
const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF.motor, input: { modo: 'buscarNovos' } });
const res = r.result || r;
if (res.executionStatus === 'FAILED') return { ok: false, erro: 'Não foi possível procurar vídeos novos agora. Tente de novo em instantes.' };
let o = res.output; if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) {} }
return o;
