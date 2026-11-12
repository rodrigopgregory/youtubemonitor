import { executePublicServerFunctionMitra } from 'mitra-interactions-sdk'
import { SF } from './sf'

type Nome = keyof typeof SF
const PROJECT_ID = Number(import.meta.env.VITE_MITRA_PROJECT_ID)

export async function chamar<T = any>(nome: Nome, input: Record<string, unknown> = {}): Promise<T> {
  const res = await executePublicServerFunctionMitra({ projectId: PROJECT_ID, serverFunctionId: SF[nome], input })
  if (res.status === 'FAILED') throw new Error('Não foi possível concluir agora. Tente de novo em instantes.')
  let out = res.output
  if (typeof out === 'string') { try { out = JSON.parse(out) } catch { /* texto */ } }
  return out as T
}

export async function linhas<T = any>(nome: Nome, input: Record<string, unknown> = {}): Promise<T[]> {
  const o = await chamar<{ rows?: T[] }>(nome, input)
  return o?.rows ?? []
}

export function mmss(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60)
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0')
}
export function linkYt(id: string, seg?: number) {
  return 'https://www.youtube.com/watch?v=' + id + (seg ? '&t=' + Math.floor(seg) + 's' : '')
}
export function dataBr(iso?: string | null) {
  if (!iso) return ''
  const [d] = iso.split('T'); const [a, m, dd] = d.split('-'); return `${dd}/${m}/${a}`
}
export function duracao(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}
export function momentos(txt: string | null | undefined, dur: number, max = 10) {
  const vals = String(txt || '').split(',').map(Number).filter(n => Number.isFinite(n) && n >= 0 && (!dur || n <= dur))
  const ord = [...new Set(vals)].sort((a, b) => a - b)
  const out: number[] = []
  for (const v of ord) if (!out.length || v - out[out.length - 1] >= 45) out.push(v)
  return out.slice(0, max)
}
