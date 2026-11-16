import { PlayCircle, Search, BookMarked, ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card } from '../components/ui/Card'
import Button from '../components/ui/Button'
import CanalFiltro, { useCanal } from '../components/CanalFiltro'
import { linhas, linkYt, mmss } from '../lib/api'

interface Relacao { ID: number; TITULO: string; AUTOR: string | null; INDICACOES: number; VIDEOS: number; CANAIS: string }
interface Indicacao { ID: number; TRECHO: string | null; SEGUNDO: number | null; YT_VIDEO_ID: string; VIDEO: string; CANAL: string }
interface Totais { N: number; LIVROS: number; VIDEOS: number }
const PAG = 50

export default function RelacaoLivrosPage() {
  const [canalId, setCanalId] = useCanal()
  const [busca, setBusca] = useState('')
  const [q, setQ] = useState('')
  const [lista, setLista] = useState<Relacao[]>([])
  const [fim, setFim] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [aberto, setAberto] = useState<number | null>(null)
  const [detalhe, setDetalhe] = useState<Indicacao[]>([])
  const [totais, setTotais] = useState<Totais | null>(null)

  useEffect(() => { linhas<Totais>('livrosTotais', { canalId }).then(r => setTotais(r[0] || null)).catch(() => setTotais(null)) }, [canalId])

  async function carregar(offset: number) {
    setCarregando(true)
    try {
      const r = await linhas<Relacao>('livrosRelacao', { canalId, busca: q.replace(/'/g, '').slice(0, 80), limit: PAG, offset })
      setLista(l => offset ? [...l, ...r] : r); setFim(r.length < PAG)
    } finally { setCarregando(false) }
  }
  useEffect(() => { setAberto(null); carregar(0) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalId, q])

  async function abrir(id: number) {
    if (aberto === id) { setAberto(null); return }
    setAberto(id); setDetalhe([])
    setDetalhe(await linhas<Indicacao>('livrosDoTitulo', { canalId, id }).catch(() => []))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Relação de livros</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>Cada livro aparece uma vez, com o autor e a quantidade de vídeos que o indicam. Toque num livro para ver onde ele foi citado.</p>
        </div>
        <CanalFiltro valor={canalId} onChange={setCanalId} />
      </div>

      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setQ(busca.trim()) }}>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar por título ou autor" className="controle w-full pl-9" />
        </div>
        <Button type="submit">Buscar</Button>
      </form>

      {totais && <p className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{Number(totais.LIVROS).toLocaleString('pt-BR')} livros diferentes, {Number(totais.N).toLocaleString('pt-BR')} indicações em {Number(totais.VIDEOS).toLocaleString('pt-BR')} vídeos. A IA lê os vídeos aos poucos, então a relação cresce a cada hora.</p>}

      <div className="flex flex-col gap-2">
        {!carregando && lista.length === 0 && <Card className="p-6"><p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Nenhum livro na relação ainda.</p></Card>}
        {lista.map(l => {
          const on = aberto === l.ID
          return (
            <Card key={l.ID} className="p-4 flex flex-col gap-2">
              <button onClick={() => abrir(l.ID)} className="text-left flex items-start gap-2">
                <BookMarked size={16} className="mt-1 shrink-0" style={{ color: 'var(--accent-text)' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap"><span className="text-[15px] font-medium">{l.TITULO}</span>{l.AUTOR && <span className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>de {l.AUTOR}</span>}</div>
                  <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--fg-muted)' }}>{Number(l.VIDEOS)} {Number(l.VIDEOS) === 1 ? 'vídeo' : 'vídeos'} · {l.CANAIS}</p>
                </div>
                {on ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {on && (
                <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  {detalhe.length === 0 && <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>Carregando…</p>}
                  {detalhe.map(d => (
                    <div key={d.ID} className="flex flex-col gap-1">
                      {d.TRECHO && <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{d.TRECHO}</p>}
                      <div className="flex items-center gap-2 flex-wrap text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
                        <span className="truncate max-w-full">{d.CANAL} · {d.VIDEO}</span>
                        <a href={linkYt(d.YT_VIDEO_ID, d.SEGUNDO || 0)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--accent-text)' }}><PlayCircle size={14} />Assistir{d.SEGUNDO ? ' em ' + mmss(d.SEGUNDO) : ''}</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })}
        {!fim && lista.length > 0 && <Button variant="secondary" onClick={() => carregar(lista.length)} disabled={carregando}>{carregando ? 'Carregando…' : 'Ver mais'}</Button>}
      </div>
    </div>
  )
}
