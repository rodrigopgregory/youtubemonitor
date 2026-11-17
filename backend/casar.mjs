const SEM = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'um', 'uma', 'em', 'no', 'na', 'the', 'of', 'livro', 'livros']);
const toks = s => SEM(s).split(' ').filter(t => t && !STOP.has(t));
const nomes = s => SEM(s).split(' ').filter(t => t.length >= 4);
export function indexar(catalogo) {
  return catalogo.map(c => ({ c, t: toks(c.TITULO), tn: SEM(c.TITULO), a: new Set(nomes(c.AUTOR)) }));
}
export function casar(idx, nome, autor) {
  const t = toks(nome), tn = SEM(nome); if (!t.length) return null;
  const an = nomes(autor); let melhor = null;
  for (const x of idx) {
    const inter = t.filter(w => x.t.includes(w)).length;
    if (!inter) continue;
    const sim = inter / Math.max(t.length, x.t.length);
    const cont = inter / Math.min(t.length, x.t.length);
    const igual = tn === x.tn;
    const aut = an.length > 0 && an.some(w => x.a.has(w));
    let pts = 0, forte = false;
    if (igual && (aut || !an.length)) { pts = 3; forte = aut; }
    else if (igual) pts = 2;
    else if (aut && sim >= 0.5 && t.length >= 2) { pts = 2.5; forte = sim >= 0.8; }
    else if (!an.length && sim >= 0.85 && t.length >= 3) pts = 1.5;
    else if (aut && cont >= 1 && t.length >= 1) pts = 1.2;
    if (pts && (!melhor || pts + sim > melhor.pts + melhor.sim)) melhor = { c: x.c, pts, sim, forte, aut };
  }
  return melhor;
}

const bigramas = s => { const t = ' ' + SEM(s) + ' '; const m = new Map(); for (let i = 0; i < t.length - 1; i++) { const b = t.slice(i, i + 2); m.set(b, (m.get(b) || 0) + 1) } return m };
export function certeza(nomeOuvido, autorOuvido, titulo, autor) {
  const a = bigramas(nomeOuvido), b = bigramas(titulo); let comum = 0, ta = 0, tb = 0;
  for (const v of a.values()) ta += v; for (const v of b.values()) tb += v;
  for (const [k, v] of a) comum += Math.min(v, b.get(k) || 0);
  let sim = ta + tb ? (2 * comum) / (ta + tb) : 0;
  const t1 = toks(nomeOuvido), t2 = toks(titulo);
  if (t1.length && t2.length) {
    const [menor, maior] = t1.length <= t2.length ? [t1, t2] : [t2, t1];
    if (menor.every(w => maior.includes(w))) sim = Math.max(sim, menor.length >= 2 || t1.length === t2.length ? 0.95 : 0.85);
  }
  const ouvido = nomes(autorOuvido); const cat = new Set(nomes(autor));
  const aut = !ouvido.length ? 0.5 : ouvido.some(w => cat.has(w)) ? 1 : 0;
  return Math.round(100 * (0.6 * sim + 0.4 * aut));
}
