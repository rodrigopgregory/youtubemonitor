import { Brain, Image, Rocket, Wind, Zap, Heart, Droplets, Flame, Gem, Leaf, Pill, Utensils, HeartPulse, BookOpen, Star, Music, Eye, Sparkles, PlayCircle, Search, X, Film } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import CanalFiltro, { useCanal } from '../components/CanalFiltro'
import VideoDetalhe from '../components/VideoDetalhe'
import Contador from '../components/Contador'
import FavoritaPratica from '../components/FavoritaPratica'
import { linhas, linkYt, mmss } from '../lib/api'
import { JEITOS, SERVE, QUANDO, nomeEt, lista as listaEt } from '../lib/etiquetas'

interface Pratica { FAVORITA?: number | boolean; ID: number; TIPO: string; JEITO: string | null; SERVE: string | null; QUANDO: string | null; TITULO: string; INSTRUCAO: string; SEGUNDO: number | null; VIDEO_ID: number; YT_VIDEO_ID: string; VIDEO: string; CANAL: string; VEZES?: number; ULTIMA?: string | null }
interface Qtd { COD: string; QTD: number }

const ICONES: Record<string, LucideIcon> = { med: Brain, vis: Image, saida: Rocket, resp: Wind, energia: Zap, prece: Heart, banho: Droplets, defum: Flame, agua: Gem, chas: Leaf, homeo: Pill, alim: Utensils, corpo: HeartPulse, reflexao: BookOpen, ritual: Star, musica: Music, percepcao: Eye, outra: Sparkles }
const PAG = 20
const paraMapa = (r: Qtd[]) => Object.fromEntries(r.map(x => [x.COD || '', Number(x.QTD)]))

export default function PraticasPage() {
  const [sp, setSp] = useSearchParams()
  const jeito = sp.get('jeito') || ''
  const serve = sp.get('serve') || ''
  const quando = sp.get('quando') || ''
  const [canalId, setCanalId] = useCanal()
  const [busca, setBusca] = useState(sp.get('q') || '')
  const soFav = sp.get('fav') === '1'
  const q = (sp.get('q') || '').replace(/'/g, '').trim()
  const [qtdJeito, setQtdJeito] = useState<Record<string, number>>({})
  const [qtdServe, setQtdServe] = useState<Record<string, number>>({})
  const [qtdQuando, setQtdQuando] = useState<Record<string, number>>({})
  const [lista, setLista] = useState<Pratica[]>([])
  const [fim, setFim] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [aberta, setAberta] = useState<number | null>(null)
  const [video, setVideo] = useState<number | null>(null)
  const [totais, setTotais] = useState<{ N: number; MARCADAS: number; FALTAM: number } | null>(null)

  const mudar = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n) }
  const base = { canalId, busca: q.slice(0, 80), fav: soFav ? 1 : 0 }

  useEffect(() => { linhas<{ N: number; MARCADAS: number; FALTAM: number }>('praticasTotais').then(r => setTotais(r[0] || null)).catch(() => {}) }, [])
  useEffect(() => {
    linhas<Qtd>('praticasJeitos', { ...base, serve, quando }).then(r => setQtdJeito(paraMapa(r))).catch(() => setQtdJeito({}))
    linhas<Qtd>('praticasServe', { ...base, jeito, quando }).then(r => setQtdServe(paraMapa(r))).catch(() => setQtdServe({}))
    linhas<Qtd>('praticasQuando', { ...base, jeito, serve }).then(r => setQtdQuando(paraMapa(r))).catch(() => setQtdQuando({}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalId, q, jeito, serve, quando, soFav])

  async function carregar(offset: number) {
    setCarregando(true)
    try {
      const r = await linhas<Pratica>('praticasLista', { ...base, jeito, serve, quando, limit: PAG, offset })
      setLista(l => offset ? [...l, ...r] : r); setFim(r.length < PAG)
    } finally { setCarregando(false) }
  }
  const mostrandoLista = !!(jeito || serve || quando || q || soFav)
  useEffect(() => { if (mostrandoLista) carregar(0); else setLista([]) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalId, q, jeito, serve, quando, soFav])

  const chip = (on: boolean) => on ? { background: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }
  const grupoAtivo = serve.split('.')[0]
  const qtdGrupo = (cod: string) => Object.entries(qtdServe).filter(([c]) => c.startsWith(cod + '.')).reduce((s, [, n]) => s + n, 0)
  const tirar = (k: string, label: string) => <button key={k} onClick={() => mudar(k, '')} className="h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>{label} <X size={14} /></button>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Práticas</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>Escolha o jeito de fazer e depois para que você precisa. Cada prática traz o passo a passo ensinado nos vídeos.</p>
        </div>
        <CanalFiltro valor={canalId} onChange={setCanalId} />
      </div>

      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); mudar('q', busca.trim()) }}>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar uma prática (ex.: arruda, Rudra, vela azul)" className="controle w-full pl-9" />
        </div>
        <Button type="submit" variant="secondary">Procurar</Button>
      </form>
      <div className="flex"><button onClick={() => mudar('fav', soFav ? '' : '1')} aria-pressed={soFav} className="h-8 px-3 rounded-full border text-[13px] font-medium inline-flex items-center gap-1.5" style={chip(soFav)}><Star size={14} fill={soFav ? 'currentColor' : 'none'} />Só as favoritas</button></div>

      {mostrandoLista && (
        <div className="flex items-center gap-2 flex-wrap">
          {jeito && tirar('jeito', nomeEt(jeito))}
          {serve && tirar('serve', nomeEt(serve))}
          {quando && tirar('quando', nomeEt(quando))}
          {soFav && tirar('fav', 'Favoritas')}
          {q && <button onClick={() => { setBusca(''); mudar('q', '') }} className="h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>"{q}" <X size={14} /></button>}
          <button onClick={() => { setBusca(''); setSp(new URLSearchParams()) }} className="text-[13px] underline" style={{ color: 'var(--fg-muted)' }}>Ver todos os jeitos</button>
        </div>
      )}

      {!jeito && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {JEITOS.map(([cod, nome]) => {
            const n = qtdJeito[cod] || 0
            const Icon = ICONES[cod] || Sparkles
            return (
              <button key={cod} onClick={() => mudar('jeito', cod)} disabled={!n} className="cartao p-3 text-left flex flex-col gap-1.5 transition-shadow hover:shadow-md disabled:opacity-50">
                <div className="flex items-center justify-between gap-2"><Icon size={18} style={{ color: 'var(--accent)' }} /><span className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{n}</span></div>
                <span className="text-[14px] font-medium leading-snug">{nome}</span>
              </button>)
          })}
        </div>
      )}

      {mostrandoLista && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Para que serve:</span>
            <div className="flex gap-2 overflow-x-auto sm:flex-wrap pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button onClick={() => mudar('serve', '')} className="shrink-0 h-8 px-3 rounded-full border text-[13px] font-medium" style={chip(!serve)}>Tudo</button>
              {SERVE.filter(g => qtdGrupo(g.cod) > 0 || grupoAtivo === g.cod).map(g => <button key={g.cod} onClick={() => mudar('serve', serve === g.cod ? '' : g.cod)} className="shrink-0 h-8 px-3 rounded-full border text-[13px] font-medium whitespace-nowrap" style={chip(grupoAtivo === g.cod)}>{g.nome} <span style={{ opacity: .7 }}>{qtdGrupo(g.cod)}</span></button>)}
            </div>
            {grupoAtivo && (
              <div className="flex gap-2 overflow-x-auto sm:flex-wrap pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {SERVE.find(g => g.cod === grupoAtivo)?.itens.filter(([c]) => (qtdServe[c] || 0) > 0 || serve === c).map(([c, nome]) => <button key={c} onClick={() => mudar('serve', serve === c ? grupoAtivo : c)} className="shrink-0 h-7 px-3 rounded-full border text-[12.5px] whitespace-nowrap" style={chip(serve === c)}>{nome} <span style={{ opacity: .7 }}>{qtdServe[c] || 0}</span></button>)}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Quando fazer:</span>
            <div className="flex gap-2 overflow-x-auto sm:flex-wrap pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button onClick={() => mudar('quando', '')} className="shrink-0 h-8 px-3 rounded-full border text-[13px] font-medium" style={chip(!quando)}>Qualquer hora</button>
              {QUANDO.filter(([c]) => (qtdQuando[c] || 0) > 0 || quando === c).map(([c, nome]) => <button key={c} onClick={() => mudar('quando', quando === c ? '' : c)} className="shrink-0 h-8 px-3 rounded-full border text-[13px] font-medium whitespace-nowrap" style={chip(quando === c)}>{nome} <span style={{ opacity: .7 }}>{qtdQuando[c] || 0}</span></button>)}
            </div>
          </div>
        </div>
      )}

      {totais && Number(totais.FALTAM) > 0 && <p className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{Number(totais.FALTAM).toLocaleString('pt-BR')} práticas novas ainda vão ser organizadas pela IA no próximo estudo.</p>}

      {mostrandoLista && (
        <div className="flex flex-col gap-3">
          {!carregando && lista.length === 0 && <Card className="p-6"><p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Nenhuma prática com esses filtros.</p></Card>}
          {lista.map(p => {
            const on = aberta === p.ID
            return (
              <Card key={p.ID} className="p-4 flex flex-col gap-2">
                <div className="flex items-start gap-2"><FavoritaPratica id={p.ID} favorita={!!Number(p.FAVORITA)} onMudou={f => setLista(l => soFav && !f ? l.filter(x => x.ID !== p.ID) : l.map(x => x.ID === p.ID ? { ...x, FAVORITA: f ? 1 : 0 } : x))} />
                <button onClick={() => setAberta(on ? null : p.ID)} className="text-left flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap"><span className="text-[15px] font-medium first-letter:uppercase">{p.TITULO}</span><Badge variant="success">{nomeEt(p.JEITO) || p.TIPO}</Badge></div>
                  <p className={'text-[13.5px] leading-relaxed ' + (on ? '' : 'line-clamp-2')} style={{ color: 'var(--fg-muted)' }}>{p.INSTRUCAO}</p>
                </button></div>
                {(p.SERVE || p.QUANDO) && <div className="flex flex-wrap gap-1">{listaEt(p.SERVE).map(c => <Badge key={c} variant="accent">{nomeEt(c)}</Badge>)}{listaEt(p.QUANDO).map(c => <Badge key={c} variant="neutral">{nomeEt(c)}</Badge>)}</div>}
                <div className="flex items-center gap-2 flex-wrap text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
                  <span className="truncate max-w-full">{p.CANAL} · {p.VIDEO}</span>
                  <a href={linkYt(p.YT_VIDEO_ID, p.SEGUNDO || 0)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--accent-text)' }}><PlayCircle size={14} />Assistir{p.SEGUNDO ? ' em ' + mmss(p.SEGUNDO) : ''}</a>
                  <button onClick={() => setVideo(p.VIDEO_ID)} className="inline-flex items-center gap-1" style={{ color: 'var(--fg-muted)' }}><Film size={13} />Ver o vídeo</button>
                </div>
                <Contador pratica={p} vezes={Number(p.VEZES || 0)} ultima={p.ULTIMA} onMudou={c => setLista(l => l.map(x => x.ID === c.praticaId ? { ...x, VEZES: c.vezes, ULTIMA: c.ultima } : x))} />
              </Card>)
          })}
          {!fim && lista.length > 0 && <Button variant="secondary" onClick={() => carregar(lista.length)} disabled={carregando}>{carregando ? 'Carregando…' : 'Ver mais'}</Button>}
        </div>
      )}
      <p className="text-[11.5px] text-center" style={{ color: 'var(--fg-subtle)' }}>Práticas ensinadas nos vídeos, para estudo. Não substituem orientação médica ou de um profissional de saúde.</p>
      {video && <VideoDetalhe id={video} onClose={() => setVideo(null)} onMudou={() => {}} />}
    </div>
  )
}
