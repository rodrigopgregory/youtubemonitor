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
