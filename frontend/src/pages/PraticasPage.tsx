import { Brain, CloudRain, Shield, ShieldAlert, Moon, Rocket, HeartPulse, Coins, Users, Home, Sparkles, Ban, PlayCircle, Search, X, Film, CheckCircle2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import CanalFiltro, { useCanal } from '../components/CanalFiltro'
import VideoDetalhe from '../components/VideoDetalhe'
import FizHoje from '../components/FizHoje'
import { linhas, linkYt, mmss, dataBr } from '../lib/api'

interface Pratica { ID: number; TIPO: string; TITULO: string; INSTRUCAO: string; SEGUNDO: number | null; FINS: string | null; VIDEO_ID: number; YT_VIDEO_ID: string; VIDEO: string; CANAL: string; VEZES?: number; ULTIMA?: string | null }
interface Qtd { COD?: string; TIPO?: string; QTD: number }

const FINS: { cod: string; nome: string; desc: string; icon: LucideIcon }[] = [
  { cod: 'lucidez', nome: 'Lucidez e clareza mental', desc: 'Concentração, foco, discernimento', icon: Brain },
  { cod: 'emocional', nome: 'Ansiedade, tristeza e depressão', desc: 'Medo, pânico, equilíbrio emocional', icon: CloudRain },
  { cod: 'negativos', nome: 'Afastar pensamentos negativos', desc: 'Formas-pensamento, pessimismo', icon: Ban },
  { cod: 'protecao', nome: 'Proteção e limpeza energética', desc: 'Descarrego, escudo, purificação', icon: Shield },
  { cod: 'obsessao', nome: 'Obsessão e ataques espirituais', desc: 'Vampirismo, magia, espíritos sofredores', icon: ShieldAlert },
  { cod: 'sono', nome: 'Sono', desc: 'Dormir bem, insônia, antes de deitar', icon: Moon },
  { cod: 'projecao', nome: 'Projeção astral', desc: 'Desdobramento, sonho lúcido', icon: Rocket },
  { cod: 'saude', nome: 'Saúde do corpo', desc: 'Cura, dores, doenças', icon: HeartPulse },
  { cod: 'prosperidade', nome: 'Prosperidade e caminhos', desc: 'Dinheiro, trabalho, abrir caminhos', icon: Coins },
  { cod: 'relacoes', nome: 'Família e relações', desc: 'Perdão, mágoas, relacionamentos', icon: Users },
  { cod: 'casa', nome: 'Harmonizar a casa', desc: 'Ambiente, cômodos, lar', icon: Home },
  { cod: 'conexao', nome: 'Conexão com o alto', desc: 'Mentores, intuição, gratidão', icon: Sparkles },
]
const nomeFin = (c: string) => FINS.find(f => f.cod === c)?.nome || c
const PAG = 20

export default function PraticasPage() {
  const [sp, setSp] = useSearchParams()
  const fin = sp.get('fin') || ''
  const tipo = sp.get('tipo') || ''
  const [canalId, setCanalId] = useCanal()
  const [busca, setBusca] = useState(sp.get('q') || '')
  const q = (sp.get('q') || '').replace(/'/g, '').trim()
  const [mapa, setMapa] = useState<Record<string, number>>({})
  const [tipos, setTipos] = useState<Qtd[]>([])
  const [lista, setLista] = useState<Pratica[]>([])
  const [fim, setFim] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [aberta, setAberta] = useState<number | null>(null)
  const [video, setVideo] = useState<number | null>(null)
  const [fazendo, setFazendo] = useState<Pratica | null>(null)
  const [totais, setTotais] = useState<{ N: number; MARCADAS: number } | null>(null)

  const mudar = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k === 'fin') n.delete('tipo'); setSp(n) }
  const base = { canalId, busca: q.slice(0, 80) }

  useEffect(() => { linhas<{ N: number; MARCADAS: number }>('praticasTotais').then(r => setTotais(r[0] || null)).catch(() => {}) }, [])
  useEffect(() => {
    linhas<Qtd>('praticasMapa', { ...base, tipo }).then(r => setMapa(Object.fromEntries(r.map(x => [x.COD || '', Number(x.QTD)])))).catch(() => setMapa({}))
    linhas<Qtd>('praticasTiposFin', { ...base, fin }).then(setTipos).catch(() => setTipos([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalId, q, fin, tipo])

  async function carregar(offset: number) {
    setCarregando(true)
    try {
      const r = await linhas<Pratica>('praticasLista', { ...base, fin, tipo, limit: PAG, offset })
      setLista(l => offset ? [...l, ...r] : r); setFim(r.length < PAG)
    } finally { setCarregando(false) }
  }
  useEffect(() => { if (fin || tipo || q) carregar(0); else setLista([]) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalId, q, fin, tipo])

  const mostrandoLista = !!(fin || tipo || q)
  const faltaIA = totais && Number(totais.MARCADAS) < Number(totais.N)
  const chip = (on: boolean) => on ? { background: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Práticas</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>Escolha para que você precisa e veja o passo a passo ensinado nos vídeos.</p>
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

      {(fin || tipo || q) && (
        <div className="flex items-center gap-2 flex-wrap">
          {fin && <button onClick={() => mudar('fin', '')} className="h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>{nomeFin(fin)} <X size={14} /></button>}
          {tipo && <button onClick={() => mudar('tipo', '')} className="h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>{tipo} <X size={14} /></button>}
          {q && <button onClick={() => { setBusca(''); mudar('q', '') }} className="h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>"{q}" <X size={14} /></button>}
          <button onClick={() => { setBusca(''); setSp(new URLSearchParams()) }} className="text-[13px] underline" style={{ color: 'var(--fg-muted)' }}>Ver o mapa</button>
        </div>
      )}

      {!fin && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {FINS.map(f => {
            const n = mapa[f.cod] || 0
            const Icon = f.icon
            return (
              <button key={f.cod} onClick={() => mudar('fin', f.cod)} disabled={!n} className="cartao p-3 text-left flex flex-col gap-1.5 transition-shadow hover:shadow-md disabled:opacity-50">
                <div className="flex items-center justify-between gap-2"><Icon size={18} style={{ color: 'var(--accent)' }} /><span className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{n}</span></div>
                <span className="text-[14px] font-medium leading-snug">{f.nome}</span>
                <span className="text-[12px] leading-snug hidden sm:block" style={{ color: 'var(--fg-muted)' }}>{f.desc}</span>
              </button>)
          })}
        </div>
      )}

      {tipos.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Jeito de fazer{fin ? '' : ' (todas as finalidades)'}:</span>
          <div className="flex gap-2 overflow-x-auto sm:flex-wrap pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button onClick={() => mudar('tipo', '')} className="shrink-0 h-8 px-3 rounded-full border text-[13px] font-medium" style={chip(!tipo)}>Todos</button>
            {tipos.map(t => <button key={t.TIPO} onClick={() => mudar('tipo', tipo === t.TIPO ? '' : t.TIPO || '')} className="shrink-0 h-8 px-3 rounded-full border text-[13px] font-medium whitespace-nowrap" style={chip(tipo === t.TIPO)}>{t.TIPO} <span style={{ opacity: .7 }}>{t.QTD}</span></button>)}
          </div>
        </div>
      )}

      {faltaIA && <p className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>A IA já separou {Number(totais!.MARCADAS).toLocaleString('pt-BR')} de {Number(totais!.N).toLocaleString('pt-BR')} práticas por finalidade; as outras aparecem pelas palavras do texto até ela terminar.</p>}

      {mostrandoLista && (
        <div className="flex flex-col gap-3">
          {!carregando && lista.length === 0 && <Card className="p-6"><p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Nenhuma prática com esses filtros.</p></Card>}
          {lista.map(p => {
            const on = aberta === p.ID
            return (
              <Card key={p.ID} className="p-4 flex flex-col gap-2">
                <button onClick={() => setAberta(on ? null : p.ID)} className="text-left flex flex-col gap-1.5">
                  <div className="flex items-start gap-2 flex-wrap"><span className="text-[15px] font-medium first-letter:uppercase">{p.TITULO}</span><Badge variant="success">{p.TIPO}</Badge></div>
                  <p className={'text-[13.5px] leading-relaxed ' + (on ? '' : 'line-clamp-2')} style={{ color: 'var(--fg-muted)' }}>{p.INSTRUCAO}</p>
                </button>
                {p.FINS && <div className="flex flex-wrap gap-1">{p.FINS.split(',').filter(Boolean).map(c => <Badge key={c} variant="accent">{nomeFin(c)}</Badge>)}</div>}
                <div className="flex items-center gap-2 flex-wrap text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
                  <span className="truncate max-w-full">{p.CANAL} · {p.VIDEO}</span>
                  <a href={linkYt(p.YT_VIDEO_ID, p.SEGUNDO || 0)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--accent-text)' }}><PlayCircle size={14} />Assistir{p.SEGUNDO ? ' em ' + mmss(p.SEGUNDO) : ''}</a>
                  <button onClick={() => setVideo(p.VIDEO_ID)} className="inline-flex items-center gap-1" style={{ color: 'var(--fg-muted)' }}><Film size={13} />Ver o vídeo</button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={() => setFazendo(p)}><CheckCircle2 size={14} />Fiz hoje</Button>
                  {Number(p.VEZES || 0) > 0 && <span className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Você já fez {Number(p.VEZES)} {Number(p.VEZES) === 1 ? 'vez' : 'vezes'} · última em {dataBr(p.ULTIMA)}</span>}
                </div>
              </Card>)
          })}
          {!fim && lista.length > 0 && <Button variant="secondary" onClick={() => carregar(lista.length)} disabled={carregando}>{carregando ? 'Carregando…' : 'Ver mais'}</Button>}
        </div>
      )}
      {fazendo && <FizHoje pratica={fazendo} onClose={() => setFazendo(null)} onSalvo={() => setLista(l => l.map(x => x.ID === fazendo.ID ? { ...x, VEZES: Number(x.VEZES || 0) + 1, ULTIMA: new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10) } : x))} />}
      {video && <VideoDetalhe id={video} onClose={() => setVideo(null)} onMudou={() => {}} />}
    </div>
  )
}
