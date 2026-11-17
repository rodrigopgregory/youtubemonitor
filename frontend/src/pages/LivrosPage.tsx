import { PlayCircle, Search, Film, BookMarked } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import Button from '../components/ui/Button'
import CanalFiltro, { useCanal } from '../components/CanalFiltro'
import VideoDetalhe from '../components/VideoDetalhe'
import { linhas, linkYt, mmss } from '../lib/api'
import EstrelaItem, { useFavoritosTipo } from '../components/EstrelaItem'

interface Livro { ID: number; TITULO: string; AUTOR: string | null; TRECHO: string | null; SEGUNDO: number | null; VIDEO_ID: number; YT_VIDEO_ID: string; VIDEO: string; CANAL: string }
interface Totais { N: number; LIVROS: number; VIDEOS: number }
const PAG = 20

export default function LivrosPage() {
  const [sp, setSp] = useSearchParams()
  const [canalId, setCanalId] = useCanal()
  const fav = useFavoritosTipo('LIVRO')
  const [busca, setBusca] = useState(sp.get('q') || '')
  const q = (sp.get('q') || '').replace(/'/g, '').trim()
  const [lista, setLista] = useState<Livro[]>([])
  const [fim, setFim] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [video, setVideo] = useState<number | null>(null)
  const [totais, setTotais] = useState<Totais | null>(null)
  const base = { canalId, busca: q.slice(0, 80) }

  useEffect(() => { linhas<Totais>('livrosTotais', { canalId }).then(r => setTotais(r[0] || null)).catch(() => setTotais(null)) }, [canalId])

  async function carregar(offset: number) {
    setCarregando(true)
    try {
      const r = await linhas<Livro>('livrosLista', { ...base, limit: PAG, offset })
      setLista(l => offset ? [...l, ...r] : r); setFim(r.length < PAG)
    } finally { setCarregando(false) }
  }
  useEffect(() => { carregar(0) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalId, q])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Livros indicados</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>Livros que foram indicados ou citados nos vídeos, com o trecho e o minuto em que aparecem.</p>
        </div>
        <CanalFiltro valor={canalId} onChange={setCanalId} />
      </div>

      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const n = new URLSearchParams(sp); if (busca.trim()) n.set('q', busca.trim()); else n.delete('q'); setSp(n) }}>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar por título, autor ou assunto" className="controle w-full pl-9" />
        </div>
        <Button type="submit">Buscar</Button>
      </form>

      {totais && <p className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{Number(totais.N).toLocaleString('pt-BR')} indicações, {Number(totais.LIVROS).toLocaleString('pt-BR')} livros diferentes, em {Number(totais.VIDEOS).toLocaleString('pt-BR')} vídeos.</p>}

      <div className="flex flex-col gap-3">
        {!carregando && lista.length === 0 && <Card className="p-6"><p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Nenhum livro encontrado ainda. A IA lê os vídeos aos poucos, então a lista cresce a cada hora.</p></Card>}
        {lista.map(l => (
          <Card key={l.ID} className="p-4 flex flex-col gap-2">
            <div className="flex items-start gap-2 flex-wrap">
              <BookMarked size={16} className="mt-1 shrink-0" style={{ color: 'var(--accent-text)' }} />
              <span className="text-[15px] font-medium">{l.TITULO}</span>
              {l.AUTOR && <span className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>de {l.AUTOR}</span>}
              <span className="ml-auto"><EstrelaItem favorito={fav.ehFavorito(l.TITULO)} onAlternar={() => fav.alternar(l.TITULO)} /></span>
            </div>
            {l.TRECHO && <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{l.TRECHO}</p>}
            <div className="flex items-center gap-2 flex-wrap text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
              <span className="truncate max-w-full">{l.CANAL} · {l.VIDEO}</span>
              <a href={linkYt(l.YT_VIDEO_ID, l.SEGUNDO || 0)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--accent-text)' }}><PlayCircle size={14} />Assistir{l.SEGUNDO ? ' em ' + mmss(l.SEGUNDO) : ''}</a>
              <button onClick={() => setVideo(l.VIDEO_ID)} className="inline-flex items-center gap-1" style={{ color: 'var(--fg-muted)' }}><Film size={13} />Ver o vídeo</button>
            </div>
          </Card>
        ))}
        {!fim && lista.length > 0 && <Button variant="secondary" onClick={() => carregar(lista.length)} disabled={carregando}>{carregando ? 'Carregando…' : 'Ver mais'}</Button>}
      </div>
      {video && <VideoDetalhe id={video} onClose={() => setVideo(null)} onMudou={() => {}} />}
    </div>
  )
}
