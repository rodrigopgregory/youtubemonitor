import { useEffect, useState } from 'react'
import { PlayCircle, Star } from 'lucide-react'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import PraticaDetalhe from '../components/PraticaDetalhe'
import FavoritaPratica from '../components/FavoritaPratica'
import EstrelaItem from '../components/EstrelaItem'
import { linhas, chamar, linkYt, dataBr, duracao } from '../lib/api'

type Aba = 'VIDEOS' | 'PRATICAS' | 'LIVRO' | 'MUSICA' | 'AUDIOVISUAL' | 'SAGRADO'
interface Contagens { VIDEOS: number; PRATICAS: number; LIVROS: number; MUSICAS: number; AUDIOVISUAIS: number; SAGRADOS: number }
interface Video { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string | null; DURACAO_SEG: number | null; CANAL: string }
interface Pratica { ID: number; TITULO: string; JEITO: string | null; TIPO: string; INSTRUCAO: string | null; VIDEO: string; CANAL: string }
interface Item { NOME: string; VIDEOS: number; AUTOR: string | null }
const muted = { color: 'var(--fg-muted)' }
const ABAS: { k: Aba; rotulo: string; campo: keyof Contagens }[] = [
  { k: 'VIDEOS', rotulo: 'Vídeos', campo: 'VIDEOS' },
  { k: 'PRATICAS', rotulo: 'Práticas', campo: 'PRATICAS' },
  { k: 'LIVRO', rotulo: 'Livros', campo: 'LIVROS' },
  { k: 'MUSICA', rotulo: 'Músicas', campo: 'MUSICAS' },
  { k: 'AUDIOVISUAL', rotulo: 'Audiovisuais', campo: 'AUDIOVISUAIS' },
  { k: 'SAGRADO', rotulo: 'Textos sagrados', campo: 'SAGRADOS' },
]

export default function FavoritosPage() {
  const [aba, setAba] = useState<Aba>('VIDEOS')
  const [cont, setCont] = useState<Contagens | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [praticas, setPraticas] = useState<Pratica[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberta, setAberta] = useState<number | null>(null)

  const contar = () => linhas<Contagens>('favContagens').then(r => setCont(r[0] || null)).catch(() => setCont(null))
  async function carregar() {
    setCarregando(true)
    try {
      if (aba === 'VIDEOS') setVideos(await linhas<Video>('favVideosLista'))
      else if (aba === 'PRATICAS') setPraticas(await linhas<Pratica>('praticasFavoritas'))
      else setItens(await linhas<Item>('favItensLista', { tipo: aba }))
    } finally { setCarregando(false) }
  }
  useEffect(() => { contar() }, [])
  useEffect(() => { carregar() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba])

  async function tirarVideo(v: Video) { await chamar('videoFavorito', { id: v.ID, fav: 0 }); setVideos(l => l.filter(x => x.ID !== v.ID)); contar() }
  async function tirarItem(i: Item) { await chamar('favItemTirar', { tipo: aba, nome: i.NOME }); setItens(l => l.filter(x => x.NOME !== i.NOME)); contar() }
  const vazio = <Card className="p-6"><p className="text-[14px]" style={muted}>Nada aqui ainda. Toque na estrela de um item para guardar nesta lista.</p></Card>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-semibold inline-flex items-center gap-2"><Star size={20} />Meus favoritos</h1>
        <p className="text-[14px] mt-1" style={muted}>Tudo o que você marcou com a estrela: vídeos, práticas, livros, músicas e audiovisuais.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {ABAS.map(a => (
          <button key={a.k} onClick={() => setAba(a.k)} className="h-8 px-3 rounded-full border text-[13px] font-medium"
            style={aba === a.k ? { background: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>
            {a.rotulo}{cont ? ' ' + Number(cont[a.campo] || 0) : ''}
          </button>))}
      </div>
      <div className="flex flex-col gap-2">
        {!carregando && aba === 'VIDEOS' && videos.length === 0 && vazio}
        {aba === 'VIDEOS' && videos.map(v => (
          <Card key={v.ID} className="px-4 py-3 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <a href={linkYt(v.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="text-[15px] font-medium inline-flex items-center gap-1.5 hover:underline"><PlayCircle size={15} />{v.TITULO}</a>
              <p className="text-[12.5px]" style={muted}>{v.CANAL}{v.PUBLICADO_EM ? ' · ' + dataBr(v.PUBLICADO_EM) : ''}{v.DURACAO_SEG ? ' · ' + duracao(Number(v.DURACAO_SEG)) : ''}</p>
            </div>
            <EstrelaItem favorito onAlternar={() => tirarVideo(v)} />
          </Card>))}
        {!carregando && aba === 'PRATICAS' && praticas.length === 0 && vazio}
        {aba === 'PRATICAS' && praticas.map(p => (
          <Card key={p.ID} className="px-4 py-3 flex flex-col gap-1">
            <div className="flex items-start gap-2 flex-wrap">
              <button onClick={() => setAberta(p.ID)} className="text-[15px] font-medium first-letter:uppercase text-left hover:underline">{p.TITULO}</button>
              <Badge variant="success">{p.JEITO || p.TIPO}</Badge>
              <span className="ml-auto"><FavoritaPratica id={p.ID} favorita onMudou={() => { setPraticas(l => l.filter(x => x.ID !== p.ID)); contar() }} /></span>
            </div>
            {p.INSTRUCAO && <p className="text-[13.5px] line-clamp-2" style={muted}>{p.INSTRUCAO}</p>}
          </Card>))}
        {!carregando && aba !== 'VIDEOS' && aba !== 'PRATICAS' && itens.length === 0 && vazio}
        {aba !== 'VIDEOS' && aba !== 'PRATICAS' && itens.map(i => (
          <Card key={i.NOME} className="px-4 py-3 flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-[15px] font-medium">{i.NOME}</span>{i.AUTOR && <span className="text-[13.5px] ml-2" style={muted}>de {i.AUTOR}</span>}
              <p className="text-[12.5px]" style={muted}>{Number(i.VIDEOS)} {Number(i.VIDEOS) === 1 ? 'vídeo' : 'vídeos'}</p>
            </div>
            <EstrelaItem favorito onAlternar={() => tirarItem(i)} />
          </Card>))}
      </div>
      {aberta && <PraticaDetalhe id={aberta} onClose={() => setAberta(null)} onMudou={() => { carregar(); contar() }} />}
    </div>
  )
}
