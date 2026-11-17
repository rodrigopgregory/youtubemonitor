import { useEffect, useState } from 'react'
import { Search, Sparkles, PenLine, Ban, Check } from 'lucide-react'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { linhas, chamar, chamarDemorado } from '../lib/api'

interface Item { ID: number; NOME: string; AUTOR: string | null; VIDEOS: number; NID: number | null; SUG_TITULO: string | null; SUG_AUTOR: string | null; MOTIVO: string | null }
interface Cat { ID: number; TITULO: string; AUTOR: string | null }
const PAG = 25
const muted = { color: 'var(--fg-muted)' }
const limpa = (v: string) => v.replace(/['"\\{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250)

export default function ValidarLivrosPage() {
  const [lista, setLista] = useState<Item[]>([])
  const [total, setTotal] = useState({ N: 0, PEND: 0 })
  const [busca, setBusca] = useState('')
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('')
  const [fim, setFim] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  const [titulo, setTitulo] = useState('')
  const [autor, setAutor] = useState('')
  const [catId, setCatId] = useState(0)
  const [achados, setAchados] = useState<Cat[]>([])
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [aviso, setAviso] = useState<Record<number, string>>({})

  async function carregar(offset: number) {
    setCarregando(true)
    try {
      const r = await linhas<Item>('validarLista', { busca: limpa(q), filtro, limit: PAG, offset })
      setLista(l => offset ? [...l, ...r] : r); setFim(r.length < PAG)
    } finally { setCarregando(false) }
  }
  function totais() { linhas<{ N: number; PEND: number }>('validarTotal').then(r => setTotal({ N: Number(r[0]?.N || 0), PEND: Number(r[0]?.PEND || 0) })).catch(() => {}) }
  useEffect(() => { carregar(0) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filtro])
  useEffect(totais, [])
  useEffect(() => {
    const t = limpa(titulo)
    if (editando === null || t.length < 3 || catId) { setAchados([]); return }
    const h = setTimeout(() => { linhas<Cat>('catalogoBusca', { busca: t }).then(setAchados).catch(() => setAchados([])) }, 300)
    return () => clearTimeout(h)
  }, [titulo, editando, catId])

  function sair(id: number) { setLista(l => l.filter(x => x.ID !== id)); totais(); setEditando(null) }
  async function executar(it: Item, fn: () => Promise<void>) {
    setOcupado(it.ID); setAviso(a => ({ ...a, [it.ID]: '' }))
    try { await fn() } catch { setAviso(a => ({ ...a, [it.ID]: 'Não deu certo agora. Tente de novo.' })) }
    setOcupado(null)
  }
  const validarIA = (it: Item) => executar(it, async () => {
    const r = await chamarDemorado<{ ok: boolean; estado?: string; titulo?: string; autor?: string; motivo?: string; erro?: string }>('livroValidar', { id: it.ID }, 120)
    if (!r?.ok) { setAviso(a => ({ ...a, [it.ID]: r?.erro || 'Não consegui validar agora.' })); return }
    if (r.estado === 'OK') { sair(it.ID); return }
    setLista(l => l.map(x => x.ID === it.ID ? { ...x, NID: x.NID || 1, SUG_TITULO: r.titulo || null, SUG_AUTOR: r.autor || null, MOTIVO: r.motivo || null } : x))
    setAviso(a => ({ ...a, [it.ID]: r.titulo ? 'A IA não teve certeza. Veja a sugestão.' : 'A IA não achou esse livro.' }))
  })
  const gravar = (it: Item, t: string, a: string, cat: number) => executar(it, async () => {
    const tit = limpa(t); if (!tit) throw new Error('vazio')
    let id = cat
    if (!id) {
      const f = await linhas<{ ID: number }>('catalogoAchar', { titulo: tit })
      id = Number(f[0]?.ID || 0)
      if (!id) { await chamar('pendCatalogoCriar', { titulo: tit, autor: limpa(a) }); id = Number((await linhas<{ ID: number }>('catalogoAchar', { titulo: tit }))[0]?.ID || 0) }
    }
    if (!id) throw new Error('sem id')
    await chamar('nomeOkCat', { id: it.ID, catId: id }); sair(it.ID)
  })
  const naoLivro = (it: Item) => executar(it, async () => { await chamar('nomeNaoLivro', { id: it.ID }); sair(it.ID) })
  function abrir(it: Item) { setEditando(it.ID); setTitulo(it.SUG_TITULO || ''); setAutor(it.SUG_AUTOR || it.AUTOR || ''); setCatId(0); setAchados([]) }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Livros a validar</h1>
        <p className="text-[14px] mt-1" style={muted}>Nomes de livros ouvidos nos vídeos que ainda não foram confirmados. Valide com a IA (que pesquisa no Google) ou escreva o nome certo. Livros já confirmados entram na Relação.</p>
      </div>

      <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); setQ(busca.trim()) }}>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar um nome" className="controle w-full pl-9" />
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} className="controle" aria-label="Mostrar">
          <option value="">Todos</option>
          <option value="sug">Com sugestão</option>
          <option value="novo">Ainda não vistos pela IA</option>
        </select>
        <Button type="submit">Buscar</Button>
      </form>

      <p className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{total.N.toLocaleString('pt-BR')} nomes para validar, {total.PEND.toLocaleString('pt-BR')} com sugestão. Os mais citados vêm primeiro.</p>

      <div className="flex flex-col gap-2">
        {!carregando && lista.length === 0 && <Card className="p-6"><p className="text-[14px]" style={muted}>Nada para validar agora.</p></Card>}
        {lista.map(it => (
          <Card key={it.ID} className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[15px] font-medium">“{it.NOME}”</span>
              {it.AUTOR && <span className="text-[13px]" style={muted}>autor ouvido: {it.AUTOR}</span>}
              <Badge variant="neutral">{Number(it.VIDEOS)} {Number(it.VIDEOS) === 1 ? 'vídeo' : 'vídeos'}</Badge>
            </div>
            {it.SUG_TITULO && <p className="text-[13px]" style={muted}>Sugestão: {it.SUG_TITULO}{it.SUG_AUTOR ? ', de ' + it.SUG_AUTOR : ''}{it.MOTIVO ? ' · ' + it.MOTIVO : ''}</p>}
            {aviso[it.ID] && <p className="text-[12.5px]">{aviso[it.ID]}</p>}
            {editando === it.ID ? (
              <div className="flex flex-col gap-2">
                <input className="controle" placeholder="Título certo do livro" value={titulo} onChange={e => { setTitulo(e.target.value); setCatId(0) }} />
                {achados.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px]" style={muted}>Na sua biblioteca:</span>
                    {achados.map(c => <button key={c.ID} type="button" className="text-left text-[13px] underline" onClick={() => { setTitulo(c.TITULO); setAutor(c.AUTOR || ''); setCatId(c.ID); setAchados([]) }}>{c.TITULO}{c.AUTOR ? ' (' + c.AUTOR + ')' : ''}</button>)}
                  </div>
                )}
                <input className="controle" placeholder="Autor (opcional)" value={autor} onChange={e => setAutor(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={ocupado === it.ID || !limpa(titulo)} onClick={() => gravar(it, titulo, autor, catId)}><Check size={14} />Salvar</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" disabled={ocupado === it.ID} onClick={() => validarIA(it)}><Sparkles size={14} />{ocupado === it.ID ? 'Validando…' : 'Validar com IA'}</Button>
                {it.SUG_TITULO && <Button size="sm" variant="secondary" disabled={ocupado === it.ID} onClick={() => gravar(it, it.SUG_TITULO || '', it.SUG_AUTOR || '', 0)}>Aceitar sugestão</Button>}
                <Button size="sm" variant="secondary" disabled={ocupado === it.ID} onClick={() => abrir(it)}><PenLine size={14} />Validar manual</Button>
                <Button size="sm" variant="secondary" disabled={ocupado === it.ID} onClick={() => naoLivro(it)}><Ban size={14} />Não é livro</Button>
              </div>
            )}
          </Card>
        ))}
        {!fim && lista.length > 0 && <Button variant="secondary" onClick={() => carregar(lista.length)} disabled={carregando}>{carregando ? 'Carregando…' : 'Ver mais'}</Button>}
      </div>
    </div>
  )
}
