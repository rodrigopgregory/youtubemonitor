import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, PlayCircle, BookOpen, Shuffle, Heart, Sparkles, ArrowRight } from 'lucide-react'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Contador from '../components/Contador'
import EstadoIA from '../components/EstadoIA'
import { SERVE, nomeEt } from '../lib/etiquetas'
import { linhas, linkYt, mmss, dataBr } from '../lib/api'

interface Feita { ID: number; TIPO: string; JEITO?: string | null; TITULO: string; SEGUNDO: number | null; YT_VIDEO_ID: string; CANAL: string; VEZES: number; ULTIMA: string | null }
interface Pratica { ID: number; TIPO: string; JEITO?: string | null; TITULO: string; INSTRUCAO: string; SEGUNDO: number | null; YT_VIDEO_ID: string; VIDEO: string; CANAL: string; VEZES: number; ULTIMA: string | null }
interface Video { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; DURACAO_SEG: number; THUMB: string; RESUMO?: string | null; CANAL: string }
interface Capitulo { TEMA_ID: number; TEMA: string; GERADO_EM: string; TRECHO: string; N: number }
interface Numeros { ESTUDADOS: number }
interface Totais { N: number; MARCADAS: number }
interface Temas { ID: number; GERADO_EM: string | null }

const FINS: [string, string][] = [['', 'Para qualquer coisa'], ...SERVE.map(g => [g.cod, g.nome] as [string, string])]
const CHAVE_FIN = 'monitor-yt-inicio-serve'
const hoje = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
const muted = { color: 'var(--fg-muted)' }
const n = (v: unknown) => Number(v || 0).toLocaleString('pt-BR')

function Titulo({ icon: Icon, texto, link, rotulo }: { icon: typeof Search; texto: string; link?: string; rotulo?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[15.5px] font-semibold inline-flex items-center gap-2"><Icon size={17} />{texto}</h2>
      {link && <Link to={link} className="text-[13px] inline-flex items-center gap-1" style={muted}>{rotulo || 'Ver tudo'}<ArrowRight size={13} /></Link>}
    </div>
  )
}

function ListaVideos({ videos, vazio, resumo }: { videos: Video[]; vazio: string; resumo?: boolean }) {
  if (!videos.length) return <p className="text-[13.5px]" style={muted}>{vazio}</p>
  return (
    <div className="flex flex-col gap-3">
      {videos.map(v => (
        <a key={v.ID} href={linkYt(v.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="flex gap-3 min-w-0 group">
          {v.THUMB ? <img src={v.THUMB} alt="" loading="lazy" className="w-28 h-16 rounded-md object-cover shrink-0" /> : <span className="w-28 h-16 rounded-md shrink-0 inline-flex items-center justify-center" style={{ background: 'var(--surface-muted)' }}><PlayCircle size={20} /></span>}
          <span className="flex flex-col min-w-0 gap-0.5">
            <span className="text-[13.5px] font-medium line-clamp-2 group-hover:underline">{v.TITULO}</span>
            <span className="text-[12px]" style={muted}>{v.CANAL} · {dataBr(v.PUBLICADO_EM)}{v.DURACAO_SEG ? ' · ' + mmss(v.DURACAO_SEG) : ''}</span>
            {resumo && v.RESUMO && <span className="text-[12.5px] line-clamp-2" style={muted}>{v.RESUMO}</span>}
          </span>
        </a>
      ))}
    </div>
  )
}

export default function InicioPage() {
  const navigate = useNavigate()
  const [pergunta, setPergunta] = useState('')
  const [minhas, setMinhas] = useState<Feita[] | null>(null)
  const [fin, setFin] = useState(() => localStorage.getItem(CHAVE_FIN) || '')
  const [vez, setVez] = useState(0)
  const [doDia, setDoDia] = useState<Pratica | null | undefined>(undefined)
  const [novos, setNovos] = useState<Video[] | null>(null)
  const [assistir, setAssistir] = useState<Video[] | null>(null)
  const [cap, setCap] = useState<Capitulo | null | undefined>(undefined)
  const [numeros, setNumeros] = useState<{ estudados: number; praticas: number; marcadas: number; caps: number; temas: number } | null>(null)

  useEffect(() => {
    linhas<Feita>('diarioPraticas').then(r => setMinhas(r.slice(0, 5))).catch(() => setMinhas([]))
    linhas<Video>('inicioVideosNovos').then(setNovos).catch(() => setNovos([]))
    linhas<Video>('inicioParaAssistir').then(setAssistir).catch(() => setAssistir([]))
    linhas<Capitulo>('inicioLivroUltimo').then(r => setCap(r[0] || null)).catch(() => setCap(null))
    Promise.all([linhas<Numeros>('painelResumo', { canalId: 0 }), linhas<Totais>('praticasTotais'), linhas<Temas>('livroTemas')])
      .then(([p, t, l]) => setNumeros({ estudados: Number(p[0]?.ESTUDADOS || 0), praticas: Number(t[0]?.N || 0), marcadas: Number(t[0]?.MARCADAS || 0), caps: l.filter(x => x.GERADO_EM).length, temas: l.length }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    linhas<Pratica>('inicioPraticaDia', { fin, dia: hoje(), vez }).then(r => setDoDia(r[0] || null)).catch(() => setDoDia(null))
  }, [fin, vez])

  function perguntar(e: React.FormEvent) {
    e.preventDefault()
    const q = pergunta.trim()
    navigate(q ? '/pesquisar?q=' + encodeURIComponent(q) : '/pesquisar')
  }
  const atualizarMinha = (id: number, vezes: number, ultima: string | null) => setMinhas(l => l && l.map(p => p.ID === id ? { ...p, VEZES: vezes, ULTIMA: ultima } : p))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Início</h1>
        <p className="text-[14px] mt-1" style={muted}>O seu dia com os ensinamentos dos canais.</p>
      </div>

      <form onSubmit={perguntar} className="flex gap-2">
        <input value={pergunta} onChange={e => setPergunta(e.target.value)} placeholder="Pergunte aos mentores. Ex.: como me proteger de energias negativas?" className="controle flex-1 min-w-0" aria-label="Pergunta" />
        <Button type="submit"><Search size={15} /><span className="hidden sm:inline">Perguntar</span></Button>
      </form>

      <EstadoIA soPausa />

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <Card className="p-5 flex flex-col gap-4">
            <Titulo icon={Heart} texto="Minhas práticas de hoje" link="/minhas-praticas" />
            {minhas === null ? <p className="text-[13.5px]" style={muted}>Carregando…</p>
              : !minhas.length ? <p className="text-[13.5px]" style={muted}>Você ainda não marcou nenhuma prática. Use "Fiz hoje" na prática do dia ou na tela Práticas.</p>
              : minhas.map(p => (
                <div key={p.ID} className="flex flex-col gap-2 pb-3 border-b last:border-b-0 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[14px] font-medium">{p.TITULO}</span>
                    <Badge variant="neutral">{nomeEt(p.JEITO) || p.TIPO}</Badge>
                  </div>
                  <Contador pratica={p} vezes={p.VEZES} ultima={p.ULTIMA} onMudou={c => atualizarMinha(p.ID, c.vezes, c.ultima)} />
                </div>
              ))}
          </Card>

          <Card className="p-5 flex flex-col gap-3">
            <Titulo icon={Sparkles} texto="Uma prática para hoje" link="/praticas" rotulo="Mais práticas" />
            <div className="flex gap-2 flex-wrap items-center">
              <select value={fin} onChange={e => { setDoDia(undefined); setFin(e.target.value); localStorage.setItem(CHAVE_FIN, e.target.value); setVez(0) }} className="controle flex-1 min-w-0" aria-label="Para que serve">
                {FINS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select>
              <Button size="sm" variant="secondary" onClick={() => { setDoDia(undefined); setVez(v => v + 1) }} title="Sortear outra prática"><Shuffle size={14} />Outra</Button>
            </div>
            {doDia === undefined ? <p className="text-[13.5px]" style={muted}>Escolhendo…</p>
              : !doDia ? <p className="text-[13.5px]" style={muted}>Ainda não há prática para isso. Escolha outra opção.</p>
              : <>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[15px] font-semibold">{doDia.TITULO}</span>
                  <Badge variant="neutral">{nomeEt(doDia.JEITO) || doDia.TIPO}</Badge>
                </div>
                <p className="text-[14px] leading-relaxed whitespace-pre-line">{doDia.INSTRUCAO}</p>
                <a href={linkYt(doDia.YT_VIDEO_ID, doDia.SEGUNDO || 0)} target="_blank" rel="noreferrer" className="text-[13px] inline-flex items-center gap-1.5 underline" style={muted}>
                  <PlayCircle size={14} />{doDia.CANAL}: {doDia.VIDEO}{doDia.SEGUNDO ? ' (' + mmss(doDia.SEGUNDO) + ')' : ''}
                </a>
                <Contador pratica={doDia} vezes={doDia.VEZES} ultima={doDia.ULTIMA} onMudou={c => setDoDia(d => d && { ...d, VEZES: c.vezes, ULTIMA: c.ultima })} />
              </>}
          </Card>

          <Card className="p-5 flex flex-col gap-3">
            <Titulo icon={BookOpen} texto="Livro Vivo" link="/livro" rotulo="Abrir o livro" />
            {cap === undefined ? <p className="text-[13.5px]" style={muted}>Carregando…</p>
              : !cap ? <p className="text-[13.5px]" style={muted}>Nenhum capítulo escrito ainda.</p>
              : <>
                <span className="text-[12.5px]" style={muted}>Último capítulo, escrito em {dataBr(cap.GERADO_EM)}</span>
                <span className="text-[15px] font-semibold">{cap.TEMA}</span>
                <p className="text-[13.5px] leading-relaxed line-clamp-4" style={muted}>{cap.TRECHO.replace(/[#*_>]/g, '')}</p>
                <div><Link to={'/livro?tema=' + cap.TEMA_ID}><Button size="sm">Ler</Button></Link></div>
              </>}
          </Card>
        </div>

        <div className="flex flex-col gap-5 min-w-0">
          <Card className="p-5 flex flex-col gap-4">
            <Titulo icon={PlayCircle} texto="Vídeos novos" link="/videos" />
            {novos === null ? <p className="text-[13.5px]" style={muted}>Carregando…</p> : <ListaVideos videos={novos} resumo vazio="Nenhum vídeo estudado ainda." />}
          </Card>

          <Card className="p-5 flex flex-col gap-4">
            <Titulo icon={Heart} texto="Para assistir" link="/videos?meu=FAV" rotulo="Favoritos" />
            {assistir === null ? <p className="text-[13.5px]" style={muted}>Carregando…</p> : <ListaVideos videos={assistir} vazio="Nenhum favorito esperando. Toque no coração de um vídeo para guardar aqui." />}
          </Card>

          {numeros && (
            <Card className="p-5 grid grid-cols-3 gap-3 text-center">
              <div><div className="text-[20px] font-semibold">{n(numeros.estudados)}</div><div className="text-[12px]" style={muted}>vídeos estudados</div></div>
              <div><div className="text-[20px] font-semibold">{n(numeros.praticas)}</div><div className="text-[12px]" style={muted}>práticas ({n(numeros.marcadas)} organizadas)</div></div>
              <div><div className="text-[20px] font-semibold">{n(numeros.caps)}<span className="text-[14px]" style={muted}> de {n(numeros.temas)}</span></div><div className="text-[12px]" style={muted}>capítulos do livro</div></div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
