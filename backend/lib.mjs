import 'dotenv/config';
import * as m from 'mitra-sdk';
m.configureSdkMitra({ baseURL: process.env.MITRA_BASE_URL, token: process.env.MITRA_TOKEN, integrationURL: process.env.MITRA_BASE_URL_INTEGRATIONS });
export const projectId = Number(process.env.MITRA_PROJECT_ID);
export const sdk = m;
let cache = null;
export async function listarSFs() {
  const r = await m.listServerFunctionsMitra({ projectId });
  cache = r.result || r;
  return cache;
}
export async function garantirSF({ name, type, code, description }) {
  if (!cache) await listarSFs();
  const ex = cache.find(f => f.name === name);
  if (ex) {
    await m.updateServerFunctionMitra({ projectId, serverFunctionId: ex.id, code, description });
    return ex.id;
  }
  const r = await m.createServerFunctionMitra({ projectId, name, type, code, description });
  const id = r.result?.serverFunctionId ?? r.result?.id;
  cache.push({ id, name });
  return id;
}
export async function exec(id, input) {
  const r = await m.executeServerFunctionMitra({ projectId, serverFunctionId: id, input });
  return r.result;
}
