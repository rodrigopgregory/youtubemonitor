import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import Button from '../components/ui/Button'
import VideoDetalhe from '../components/VideoDetalhe'
import CanalFiltro, { useCanal } from '../components/CanalFiltro'
import { linhas, dataBr, duracao } from '../lib/api'

interface Tema { ID: number; NOME: string; QTD: number }
interface Video { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; DURACAO_SEG: number; TIPO: string; THUMB: string; STATUS: string; MOTIVO: string | null; ORIGEM: string | null; INDISPONIVEL: boolean | number; CANAL: string; TEMAS: string | null }
interface Painel { ESTUDADOS: number; FILA: number; PENDENTES: number; TEMAS: number }

const statusInfo: Record<string, { label: string; v: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  ESTUDADO: { label: 'Estudado', v: 'success' }, FILA: { label: 'Na fila', v: 'neutral' }, PENDENTE: { label: 'Pendente', v: 'warning' },
}
const PAG = 30

export default function VideosPage() {
  const [sp, setSp] = useSearchParams()
  const temaId = Number(sp.get('tema') || 0)
  const status = sp.get('status') || ''
  const [temas, setTemas] = useState<Tema[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [painel, setPainel] = useState<Painel | null>(null)
  const [fim, setFim] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState<number | null>(null)
  const [canalId, setCanalId] = useCanal()

  const carregar = useCallback(async (offset = 0) => {
    setCarregando(true)
    const r = await linhas<Video>('videosListar', { status, temaId, canalId, limit: PAG, offset })
    setVideos(v => offset ? [...v, ...r] : r); setFim(r.length < PAG); setCarregando(false)
  }, [status, temaId, canalId])

  const carregarTemas = useCallback(() => {
    linhas<Tema>('temasListar', { canalId }).then(setTemas)
    linhas<Painel>('painelResumo', { canalId }).then(r => setPainel(r[0] || null))
  }, [canalId])

  useEffect(() => { carregarTemas() }, [carregarTemas])
  useEffect(() => { carregar(0) }, [carregar])

  const filtro = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n) }
  const temaAtual = temas.find(t => t.ID === temaId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold">Vídeos e temas</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>Os vídeos agrupados pelos temas. Clique num vídeo para ver o resumo, a transcrição e editar os temas.</p>
        </div>
        <CanalFiltro valor={canalId} onChange={id => { setCanalId(id); filtro('tema', '') }} />
        {painel && (
          <div className="flex gap-2 flex-wrap">
            {[['', 'Todos'], ['ESTUDADO', `${painel.ESTUDADOS || 0} estudados`], ['FILA', `${painel.FILA || 0} na fila`], ['PENDENTE', `${painel.PENDENTES || 0} pendentes`]].map(([k, l]) => (
              <button key={k} onClick={() => filtro('status', k)} className="h-8 px-3 rounded-full border text-[13px] font-medium"
                style={status === k ? { background: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>{l}</button>))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="p-3 self-start lg:sticky lg:top-20 max-h-[70vh] overflow-y-auto">
          <div className="px-2 pb-2 text-[12px] font-medium uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>Temas</div>
          <button onClick={() => filtro('tema', '')} className="w-full text-left px-2 py-1.5 rounded-md text-[13.5px] flex justify-between"
            style={!temaId ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' } : {}}>Todos os temas</button>
          {temas.length === 0 && <p className="px-2 py-2 text-[13px]" style={{ color: 'var(--fg-muted)' }}>Os temas aparecem quando os vídeos forem estudados.</p>}
          {temas.map(t => (
            <button key={t.ID} onClick={() => filtro('tema', String(t.ID))} className="w-full text-left px-2 py-1.5 rounded-md text-[13.5px] flex justify-between gap-2"
              style={temaId === t.ID ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' } : {}}>
              <span className="truncate">{t.NOME}</span><span style={{ color: 'var(--fg-subtle)' }}>{t.QTD}</span>
            </button>))}
        </Card>

        <div className="flex flex-col gap-3 min-w-0">
          {temaAtual && <h2 className="text-[16px] font-medium">Tema: {temaAtual.NOME}</h2>}
          {!carregando && videos.length === 0 && <Card className="p-6"><p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Nenhum vídeo aqui ainda.</p></Card>}
          {videos.map(v => {
            const st = statusInfo[v.STATUS] || { label: v.STATUS, v: 'neutral' as const }
            return (
              <Card key={v.ID} className="p-3 flex gap-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setAberto(v.ID)}>
                <img src={v.THUMB} alt="" className="w-32 aspect-video object-cover rounded-lg shrink-0 hidden sm:block" />
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-[14.5px] font-medium">{v.TITULO}</span>
                    <Badge variant={st.v}>{st.label}</Badge>
                    {v.TIPO === 'LIVE' && <Badge variant="info">Live</Badge>}
                    {!!v.INDISPONIVEL && <Badge variant="warning">Indisponível no YouTube</Badge>}
                  </div>
                  <div className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
                    {v.CANAL}{v.PUBLICADO_EM ? ' · ' + dataBr(v.PUBLICADO_EM) : ''} · {duracao(v.DURACAO_SEG)}
                    {v.ORIGEM === 'AUDIO' && ' · transcrito pelo áudio'}
                  </div>
                  {v.STATUS === 'PENDENTE' && v.MOTIVO && <div className="text-[12.5px]" style={{ color: 'var(--warning-text)' }}>Motivo: {v.MOTIVO}. Nova tentativa na próxima checagem diária.</div>}
                  {v.TEMAS && <div className="flex flex-wrap gap-1">{v.TEMAS.split('|').map(t => <Badge key={t} variant="accent">{t}</Badge>)}</div>}
                </div>
              </Card>)
          })}
          {!fim && videos.length > 0 && <Button variant="secondary" onClick={() => carregar(videos.length)} disabled={carregando}>{carregando ? 'Carregando…' : 'Ver mais'}</Button>}
        </div>
      </div>
      {aberto && <VideoDetalhe id={aberto} onClose={() => setAberto(null)} onMudou={() => { carregar(0); carregarTemas() }} />}
    </div>
  )
}
