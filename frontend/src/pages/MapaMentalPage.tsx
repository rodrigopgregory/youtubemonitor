import { useEffect, useMemo, useState } from 'react'
import { Network, Search, PlayCircle } from 'lucide-react'
import { linhas, mmss, linkYt } from '../lib/api'
import { nomeEt } from '../lib/etiquetas'

interface Tema { ID: number; NOME: string; N: number }
interface Jeito { JEITO: string | null; N: number; VIDEOS: number }
interface PratTema { ID: number; TITULO: string; SEGUNDO: number | null; VIDEO_ID: number; YT_VIDEO_ID: string; VIDEO: string }
interface VidTema { ID: number; YT_VIDEO_ID: string; TITULO: string; NP: number }
interface Ligado { ID: number; NOME: string; N: number }
interface VidBusca { ID: number; TITULO: string; YT_VIDEO_ID: string; NP: number }
interface TemaVid { ID: number; NOME: string; MOMENTOS: string }
interface PratVid { ID: number; TITULO: string; JEITO: string | null; SEGUNDO: number | null }

interface No { chave: string; rotulo: string; sub?: string; ativo?: boolean; onClick?: () => void }

const LARG = 900
const ALTO = 520
const corte = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t)

function Mapa({ centro, centroSub, esquerda, direita, tituloEsq, tituloDir }: { centro: string; centroSub?: string; esquerda: No[]; direita: No[]; tituloEsq: string; tituloDir: string }) {
  const cx = LARG / 2, cy = ALTO / 2
  function posicoes(lista: No[], lado: -1 | 1) {
    const n = lista.length
    const topo = 60, base = ALTO - 40
    return lista.map((_, i) => {
      const y = n === 1 ? cy : topo + ((base - topo) * i) / (n - 1)
      const folga = 1 - Math.abs(y - cy) / (cy - 30)
      const x = cx + lado * (250 + 80 * Math.max(0, folga) * 0 + 40 * Math.max(0, folga))
      return { x, y }
    })
  }
  const pe = posicoes(esquerda, -1), pd = posicoes(direita, 1)
  function desenha(lista: No[], pos: { x: number; y: number }[], lado: -1 | 1) {
    return lista.map((no, i) => {
      const { x, y } = pos[i]
      const larg = 190
      const x0 = lado === -1 ? x - larg + 20 : x - 20
      return (
        <g key={no.chave} style={{ cursor: no.onClick ? 'pointer' : 'default' }} onClick={no.onClick}>
          <path d={`M ${cx} ${cy} C ${cx + lado * 110} ${cy}, ${x - lado * 110} ${y}, ${lado === -1 ? x0 + larg : x0} ${y}`} fill="none" stroke={no.ativo ? 'var(--accent)' : 'var(--border-strong, var(--border))'} strokeWidth={no.ativo ? 2.5 : 1.5} />
          <rect x={x0} y={y - 20} width={larg} height={40} rx={10} fill={no.ativo ? 'var(--accent-soft)' : 'var(--bg-elevated)'} stroke={no.ativo ? 'var(--accent)' : 'var(--border)'} />
          <text x={x0 + larg / 2} y={no.sub ? y - 2 : y + 4} textAnchor="middle" fontSize="12.5" fontWeight={500} fill="var(--fg)">{corte(no.rotulo, 26)}</text>
          {no.sub && <text x={x0 + larg / 2} y={y + 13} textAnchor="middle" fontSize="11" fill="var(--fg-muted)">{no.sub}</text>}
          <title>{no.rotulo}{no.sub ? ' · ' + no.sub : ''}</title>
        </g>
      )
    })
  }
  return (
    <div className="cartao p-2 overflow-x-auto">
      <svg viewBox={`0 0 ${LARG} ${ALTO}`} className="w-full min-w-[640px]" role="img" aria-label={`Mapa mental de ${centro}`}>
        <text x={20} y={22} fontSize="12" fill="var(--fg-muted)">{tituloEsq}</text>
        <text x={LARG - 20} y={22} fontSize="12" textAnchor="end" fill="var(--fg-muted)">{tituloDir}</text>
        {desenha(esquerda, pe, -1)}
        {desenha(direita, pd, 1)}
        <g>
          <ellipse cx={cx} cy={cy} rx={105} ry={46} fill="var(--accent)" />
          <text x={cx} y={centroSub ? cy - 2 : cy + 5} textAnchor="middle" fontSize="14" fontWeight={600} fill="var(--fg-inverted, #fff)">{corte(centro, 24)}</text>
          {centroSub && <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11.5" fill="var(--fg-inverted, #fff)">{centroSub}</text>}
          <title>{centro}</title>
        </g>
      </svg>
      {(esquerda.length === 0 && direita.length === 0) && <p className="text-[13px] p-3" style={{ color: 'var(--fg-muted)' }}>Nada ligado a este item ainda.</p>}
    </div>
  )
}

function PorTema() {
  const [temas, setTemas] = useState<Tema[]>([])
  const [filtro, setFiltro] = useState('')
  const [tema, setTema] = useState<Tema | null>(null)
  const [jeitos, setJeitos] = useState<Jeito[]>([])
  const [ligados, setLigados] = useState<Ligado[]>([])
  const [videos, setVideos] = useState<VidTema[]>([])
  const [jeito, setJeito] = useState<string | null>(null)
  const [prats, setPrats] = useState<PratTema[]>([])

  useEffect(() => { linhas<Tema>('mapaTemasLista').then(r => { setTemas(r); if (r.length) setTema(r[0]) }).catch(() => {}) }, [])
  useEffect(() => {
    if (!tema) return
    setJeito(null); setPrats([])
    linhas<Jeito>('mapaTemaJeitos', { temaId: tema.ID }).then(setJeitos).catch(() => setJeitos([]))
    linhas<Ligado>('mapaTemaLigados', { temaId: tema.ID }).then(setLigados).catch(() => setLigados([]))
    linhas<VidTema>('mapaTemaVideos', { temaId: tema.ID }).then(setVideos).catch(() => setVideos([]))
  }, [tema])
  useEffect(() => {
    if (!tema || jeito === null) return
    linhas<PratTema>('mapaTemaPraticas', { temaId: tema.ID, jeito, limit: 30, offset: 0 }).then(setPrats).catch(() => setPrats([]))
  }, [tema, jeito])

  const lista = useMemo(() => temas.filter(t => !filtro || t.NOME.toLowerCase().includes(filtro.toLowerCase())), [temas, filtro])
  const esquerda: No[] = jeitos.slice(0, 9).map(j => ({
    chave: j.JEITO || 'outra', rotulo: nomeEt(j.JEITO || 'outra'), sub: `${j.N} ${j.N === 1 ? 'prática' : 'práticas'} · ${j.VIDEOS} ${j.VIDEOS === 1 ? 'vídeo' : 'vídeos'}`,
    ativo: jeito === (j.JEITO || 'outra'), onClick: () => setJeito(jeito === (j.JEITO || 'outra') ? null : (j.JEITO || 'outra')),
  }))
  const direita: No[] = ligados.map(l => ({
    chave: String(l.ID), rotulo: l.NOME, sub: `${l.N} ${l.N === 1 ? 'vídeo em comum' : 'vídeos em comum'}`,
    onClick: () => { const t = temas.find(x => x.ID === l.ID); if (t) setTema(t) },
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-muted)' }} />
          <input className="controle h-9 pl-8 w-56" placeholder="Filtrar temas" value={filtro} onChange={e => setFiltro(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap max-h-28 overflow-y-auto">
        {lista.map(t => (
          <button key={t.ID} onClick={() => setTema(t)} className="h-8 px-3 rounded-full border text-[13px]"
            style={tema?.ID === t.ID ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent-text)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>
            {t.NOME} <span style={{ opacity: 0.7 }}>{t.N}</span>
          </button>))}
      </div>
      {tema && <Mapa centro={tema.NOME} centroSub={`${tema.N} vídeos`} esquerda={esquerda} direita={direita} tituloEsq="Práticas (clique para ver)" tituloDir="Temas que aparecem junto (clique para ir)" />}
      {jeito !== null && (
        <section className="cartao p-3 flex flex-col gap-2">
          <h3 className="text-[14px] font-medium">{nomeEt(jeito)} em “{tema?.NOME}”</h3>
          <ul className="flex flex-col gap-1.5">
            {prats.map(p => (
              <li key={p.ID} className="text-[13.5px] flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{p.TITULO}</span>
                <a href={linkYt(p.YT_VIDEO_ID, p.SEGUNDO || undefined)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[12px] hover:underline" style={{ color: 'var(--accent-text)' }}>
                  <PlayCircle size={12} />{p.SEGUNDO != null ? mmss(p.SEGUNDO) : 'vídeo'}
                </a>
                <span className="text-[12px]" style={{ color: 'var(--fg-muted)' }}>{corte(p.VIDEO, 70)}</span>
              </li>))}
          </ul>
        </section>)}
      {videos.length > 0 && (
        <section className="cartao p-3 flex flex-col gap-2">
          <h3 className="text-[14px] font-medium">Vídeos que mais ensinam práticas neste tema</h3>
          <ul className="flex flex-col gap-1">
            {videos.map(v => (
              <li key={v.ID} className="text-[13.5px] flex gap-2">
                <a href={linkYt(v.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="hover:underline min-w-0 truncate">{v.TITULO}</a>
                <span className="shrink-0 text-[12px]" style={{ color: 'var(--fg-muted)' }}>{v.NP} {v.NP === 1 ? 'prática' : 'práticas'}</span>
              </li>))}
          </ul>
        </section>)}
    </div>
  )
}

function PorVideo() {
  const [busca, setBusca] = useState('')
  const [achados, setAchados] = useState<VidBusca[]>([])
  const [video, setVideo] = useState<VidBusca | null>(null)
  const [temas, setTemas] = useState<TemaVid[]>([])
  const [prats, setPrats] = useState<PratVid[]>([])

  useEffect(() => {
    const t = setTimeout(() => { linhas<VidBusca>('mapaVideoBusca', { busca: busca.replace(/['\\%]/g, ' ').trim() }).then(setAchados).catch(() => setAchados([])) }, 300)
    return () => clearTimeout(t)
  }, [busca])
  useEffect(() => {
    if (!video) return
    linhas<TemaVid>('videoTemas', { videoId: video.ID }).then(setTemas).catch(() => setTemas([]))
    linhas<PratVid>('praticasDoVideo', { videoId: video.ID }).then(setPrats).catch(() => setPrats([]))
  }, [video])

  const grupos = useMemo(() => {
    const m = new Map<string, PratVid[]>()
    for (const p of prats) { const k = p.JEITO || 'outra'; m.set(k, [...(m.get(k) || []), p]) }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [prats])
  const esquerda: No[] = temas.slice(0, 9).map(t => ({ chave: String(t.ID), rotulo: t.NOME }))
  const direita: No[] = grupos.slice(0, 9).map(([k, l]) => ({ chave: k, rotulo: nomeEt(k), sub: `${l.length} ${l.length === 1 ? 'prática' : 'práticas'}` }))

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-muted)' }} />
        <input className="controle h-9 pl-8 w-full" placeholder="Procurar um vídeo pelo título" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>
      <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto">
        {achados.map(v => (
          <li key={v.ID}>
            <button onClick={() => setVideo(v)} className="w-full text-left text-[13.5px] px-2.5 py-1.5 rounded-lg flex gap-2"
              style={video?.ID === v.ID ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' } : { color: 'var(--fg)' }}>
              <span className="min-w-0 truncate">{v.TITULO}</span>
              <span className="shrink-0 text-[12px]" style={{ color: 'var(--fg-muted)' }}>{v.NP} {v.NP === 1 ? 'prática' : 'práticas'}</span>
            </button>
          </li>))}
      </ul>
      {video && <Mapa centro={video.TITULO} centroSub={`${prats.length} práticas`} esquerda={esquerda} direita={direita} tituloEsq="Temas do vídeo" tituloDir="Práticas ensinadas" />}
      {video && grupos.map(([k, l]) => (
        <section key={k} className="cartao p-3 flex flex-col gap-1.5">
          <h3 className="text-[14px] font-medium">{nomeEt(k)}</h3>
          <ul className="flex flex-col gap-1">
            {l.map(p => (
              <li key={p.ID} className="text-[13.5px] flex flex-wrap items-center gap-2">
                <span>{p.TITULO}</span>
                <a href={linkYt(video.YT_VIDEO_ID, p.SEGUNDO || undefined)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[12px] hover:underline" style={{ color: 'var(--accent-text)' }}>
                  <PlayCircle size={12} />{p.SEGUNDO != null ? mmss(p.SEGUNDO) : 'vídeo'}
                </a>
              </li>))}
          </ul>
        </section>))}
    </div>
  )
}

export default function MapaMentalPage() {
  const [modo, setModo] = useState<'tema' | 'video'>('tema')
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 flex flex-col gap-4">
      <header>
        <h1 className="text-[20px] font-semibold inline-flex items-center gap-2"><Network size={20} />Mapa mental</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>Veja como os temas, as práticas e os vídeos se ligam. Cada prática abre o vídeo no minuto em que é ensinada.</p>
      </header>
      <div className="flex gap-1.5">
        {([['tema', 'Por tema'], ['video', 'Por vídeo']] as const).map(([cod, nome]) => (
          <button key={cod} onClick={() => setModo(cod)} className="h-9 px-4 rounded-lg text-[13.5px] font-medium"
            style={modo === cod ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' } : { color: 'var(--fg-muted)' }}>{nome}</button>))}
      </div>
      {modo === 'tema' ? <PorTema /> : <PorVideo />}
    </div>
  )
}
