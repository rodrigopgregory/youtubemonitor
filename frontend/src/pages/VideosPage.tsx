import { Check, Download, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import Button from '../components/ui/Button'
import VideoDetalhe from '../components/VideoDetalhe'
import CanalFiltro, { useCanal } from '../components/CanalFiltro'
import { linhas, dataBr, duracao } from '../lib/api'
import { exportarVideosFiltro } from '../lib/exportar'

interface Tema { ID: number; NOME: string; QTD: number }
interface Playlist { ID: number; TITULO: string; CANAL_ID: number; CANAL: string; QTD: number; ESTUDADOS: number }
interface Video { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; DURACAO_SEG: number; TIPO: string; THUMB: string; STATUS: string; MOTIVO: string | null; ORIGEM: string | null; INDISPONIVEL: boolean | number; CANAL: string; TEMAS: string | null; PLAYLISTS: string | null; PRATICAS: string | null }
interface PraticaTipo { TIPO: string; QTD: number }
interface Painel { ESTUDADOS: number; FILA: number; PENDENTES: number; FORA_TEMA: number; TEMAS: number }

const statusInfo: Record<string, { label: string; v: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  ESTUDADO: { label: 'Estudado', v: 'success' }, FILA: { label: 'Na fila', v: 'neutral' }, PENDENTE: { label: 'Pendente', v: 'warning' }, FORA_TEMA: { label: 'Fora do tema', v: 'neutral' },
}
const PAG = 30

export default function VideosPage() {
  const [sp, setSp] = useSearchParams()
  const lista = (k: string) => (sp.get(k) || '').split(',').filter(Boolean)
  const temasSel = lista('tema').map(Number)
  const playSel = lista('playlist').map(Number)
  const pratSel = lista('pratica')
  const mentSel = lista('mentor').map(Number)
  const chaveFiltro = sp.toString()
  const [agrupar, setAgrupar] = useState<'temas' | 'mentores' | 'playlists' | 'praticas'>(() => (sp.get('mentor') ? 'mentores' : sp.get('pratica') ? 'praticas' : sp.get('playlist') ? 'playlists' : 'temas'))
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [praticas, setPraticas] = useState<PraticaTipo[]>([])
  const [leitura, setLeitura] = useState<{ N: number; LIDOS: number } | null>(null)
  const status = sp.get('status') || ''
  const origem = sp.get('origem') || ''
  const [temas, setTemas] = useState<Tema[]>([])
  const [mentores, setMentores] = useState<Tema[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [painel, setPainel] = useState<Painel | null>(null)
  const [fim, setFim] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState<number | null>(null)
  const [canalId, setCanalId] = useCanal()
  const [exportMsg, setExportMsg] = useState<{ rodando: boolean; msg: string } | null>(null)
  const [nomes, setNomes] = useState<Record<string, string>>({})

  const filtros = useCallback(() => {
    const t = [...(sp.get('tema') || '').split(','), ...(sp.get('mentor') || '').split(',')].filter(Boolean), p = (sp.get('playlist') || '').split(',').filter(Boolean), r = (sp.get('pratica') || '').split(',').filter(Boolean)
    return { canalId, status: sp.get('status') || '', temas: t.join(','), nTemas: t.length, playlists: p.join(','), nPlay: p.length, praticas: r.join(',').replace(/'/g, ''), nPrat: r.length, origem: ['YOUTUBE', 'AUDIO'].includes(sp.get('origem') || '') ? sp.get('origem') || '' : '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveFiltro, canalId])

  const nomeDe = (k: string, v: string | number) => nomes[k + ':' + v] || '…'
  useEffect(() => {
    setNomes(n => {
      const x = { ...n }
      temas.forEach(t => { x['tema:' + t.ID] = t.NOME })
      mentores.forEach(t => { x['mentor:' + t.ID] = t.NOME })
      playlists.forEach(p => { x['playlist:' + p.ID] = p.TITULO })
      return x
    })
  }, [temas, mentores, playlists])

  async function baixarPlanilha() {
    const partes = ['Vídeos', ...playSel.map(id => nomeDe('playlist', id)), ...temasSel.map(id => nomeDe('tema', id)), ...mentSel.map(id => nomeDe('mentor', id)), ...pratSel, status ? statusInfo[status]?.label : '', origem === 'AUDIO' ? 'Transcrito pelo áudio' : origem === 'YOUTUBE' ? 'Legenda do YouTube' : ''].filter(Boolean)
    setExportMsg({ rodando: true, msg: 'Buscando os vídeos…' })
    try {
      const n = await exportarVideosFiltro(filtros(), partes.join(' - '), m => setExportMsg({ rodando: true, msg: m }))
      setExportMsg({ rodando: false, msg: `Planilha baixada com ${n} ${n === 1 ? 'vídeo' : 'vídeos'}.` })
    } catch { setExportMsg({ rodando: false, msg: 'Não foi possível exportar agora. Tente de novo em instantes.' }) }
  }

  const carregar = useCallback(async (offset = 0) => {
    setCarregando(true)
    const r = await linhas<Video>('videosListar', { ...filtros(), limit: PAG, offset })
    setVideos(v => offset ? [...v, ...r] : r); setFim(r.length < PAG); setCarregando(false)
  }, [filtros])

  const carregarTemas = useCallback(() => {
    const f = filtros()
    linhas<Tema>('temasListar', f).then(setTemas)
    linhas<Tema>('mentoresListar', f).then(setMentores).catch(() => setMentores([]))
    linhas<Playlist>('playlistsListar', f).then(setPlaylists).catch(() => setPlaylists([]))
    linhas<PraticaTipo>('praticasTipos', f).then(setPraticas).catch(() => setPraticas([]))
    linhas<Painel>('painelResumo', { canalId }).then(r => setPainel(r[0] || null))
    linhas<{ N: number; LIDOS: number }>('praticasResumo').then(r => setLeitura(r[0] || null)).catch(() => {})
  }, [filtros, canalId])

  useEffect(() => { carregarTemas() }, [carregarTemas])
  useEffect(() => { carregar(0) }, [carregar])

  const filtro = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n) }
  const alternar = (k: string, v: string) => {
    const atual = (sp.get(k) || '').split(',').filter(Boolean)
    const novo = atual.includes(v) ? atual.filter(x => x !== v) : [...atual, v]
    filtro(k, novo.join(','))
  }
  const limparTudo = () => { const n = new URLSearchParams(sp); n.delete('tema'); n.delete('playlist'); n.delete('pratica'); n.delete('mentor'); setSp(n) }
  const mostrarCanal = !canalId && new Set(playlists.map(p => p.CANAL_ID)).size > 1
  const algum = temasSel.length + mentSel.length + playSel.length + pratSel.length
  const marcado = { background: 'var(--accent-soft)', color: 'var(--accent-text)' }
  const caixa = (on: boolean) => <span className="w-3.5 h-3.5 rounded border shrink-0 inline-flex items-center justify-center" style={on ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-fg)' } : { borderColor: 'var(--border)' }}>{on && <Check size={10} strokeWidth={3} />}</span>
  const playlistsMostrar = [...playlists.filter(p => playSel.includes(p.ID)), ...playlists.filter(p => !playSel.includes(p.ID))]
  const temasMostrar = [...temas.filter(t => temasSel.includes(t.ID)), ...temas.filter(t => !temasSel.includes(t.ID))]
  const mentoresMostrar = [...mentores.filter(t => mentSel.includes(t.ID)), ...mentores.filter(t => !mentSel.includes(t.ID))]
  const praticasMostrar = [...praticas.filter(p => pratSel.includes(p.TIPO)), ...praticas.filter(p => !pratSel.includes(p.TIPO))]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold">Vídeos e temas</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>Marque quantos temas, mentores, playlists e práticas quiser: a lista mostra só os vídeos que têm tudo o que foi marcado, e os números ao lado mostram quantos sobram. Clique num vídeo para ver o resumo, as práticas e a transcrição.</p>
        </div>
        <CanalFiltro valor={canalId} onChange={id => { setCanalId(id); limparTudo() }} />
        {painel && (
          <div className="flex gap-2 flex-wrap">
            {[['', 'Todos'], ['ESTUDADO', `${painel.ESTUDADOS || 0} estudados`], ['FILA', `${painel.FILA || 0} na fila`], ['PENDENTE', `${painel.PENDENTES || 0} pendentes`], ...(Number(painel.FORA_TEMA) ? [['FORA_TEMA', `${painel.FORA_TEMA} fora do tema`]] : [])].map(([k, l]) => (
              <button key={k} onClick={() => filtro('status', k)} className="h-8 px-3 rounded-full border text-[13px] font-medium"
                style={status === k ? { background: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>{l}</button>))}
          </div>
        )}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Transcrição:</span>
          {[['', 'Todas'], ['YOUTUBE', 'Legenda do YouTube'], ['AUDIO', 'Pelo áudio']].map(([k, l]) => (
            <button key={'o' + k} onClick={() => filtro('origem', k)} className="h-8 px-3 rounded-full border text-[13px] font-medium"
              style={origem === k ? { background: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>{l}</button>))}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="secondary" size="sm" disabled={!!exportMsg?.rodando} onClick={baixarPlanilha} title="Baixa uma planilha com os vídeos que estão aparecendo agora, com os filtros marcados">
            <Download size={14} />{exportMsg?.rodando ? 'Montando a planilha…' : 'Exportar planilha'}
          </Button>
          {exportMsg && <span className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>{exportMsg.msg}</span>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="p-3 self-start lg:sticky lg:top-20 max-h-[75vh] overflow-y-auto">
          <div className="flex gap-1 p-1 mb-2 rounded-lg" style={{ background: 'var(--surface-muted)' }}>
            {([['temas', 'Temas', temasSel.length], ['mentores', 'Mentores', mentSel.length], ['playlists', 'Playlists', playSel.length], ['praticas', 'Práticas', pratSel.length]] as const).map(([k, l, n]) => (
              <button key={k} onClick={() => setAgrupar(k)} className="flex-1 h-7 px-1 rounded-md text-[12.5px] font-medium inline-flex items-center justify-center gap-1"
                style={agrupar === k ? { background: 'var(--surface)', color: 'var(--fg)', boxShadow: 'var(--shadow-sm)' } : { color: 'var(--fg-muted)' }}>{l}{n > 0 && <span className="text-[11px] px-1.5 rounded-full" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>{n}</span>}</button>))}
          </div>
          {agrupar === 'temas' && <>
            {temasSel.length > 0 && <button onClick={() => filtro('tema', '')} className="w-full text-left px-2 py-1 text-[12.5px] underline" style={{ color: 'var(--fg-muted)' }}>Desmarcar temas</button>}
            {temas.length === 0 && <p className="px-2 py-2 text-[13px]" style={{ color: 'var(--fg-muted)' }}>{algum ? 'Nenhum vídeo estudado com essa combinação.' : 'Os temas aparecem quando os vídeos forem estudados.'}</p>}
            {temasMostrar.map(t => {
              const on = temasSel.includes(t.ID)
              return (
                <button key={t.ID} onClick={() => alternar('tema', String(t.ID))} className="w-full text-left px-2 py-1.5 rounded-md text-[13.5px] flex items-center gap-2" style={on ? marcado : {}}>
                  {caixa(on)}<span className="truncate flex-1">{t.NOME}</span><span style={{ color: 'var(--fg-subtle)' }}>{t.QTD}</span>
                </button>)
            })}
          </>}
          {agrupar === 'mentores' && <>
            <p className="px-2 pb-2 text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Mentores (espíritos) que se manifestam pela médium nas lives.</p>
            {mentSel.length > 0 && <button onClick={() => filtro('mentor', '')} className="w-full text-left px-2 py-1 text-[12.5px] underline" style={{ color: 'var(--fg-muted)' }}>Desmarcar mentores</button>}
            {mentores.length === 0 && <p className="px-2 py-2 text-[13px]" style={{ color: 'var(--fg-muted)' }}>{algum ? 'Nenhum mentor nessa combinação.' : 'Nenhum mentor identificado ainda.'}</p>}
            {mentoresMostrar.map(t => {
              const on = mentSel.includes(t.ID)
              return (
                <button key={t.ID} onClick={() => alternar('mentor', String(t.ID))} className="w-full text-left px-2 py-1.5 rounded-md text-[13.5px] flex items-center gap-2" style={on ? marcado : {}}>
                  {caixa(on)}<span className="truncate flex-1">{t.NOME}</span><span style={{ color: 'var(--fg-subtle)' }}>{t.QTD}</span>
                </button>)
            })}
          </>}
          {agrupar === 'playlists' && <>
            {playSel.length > 0 && <button onClick={() => filtro('playlist', '')} className="w-full text-left px-2 py-1 text-[12.5px] underline" style={{ color: 'var(--fg-muted)' }}>Desmarcar playlists</button>}
            {playlists.length === 0 && <p className="px-2 py-2 text-[13px]" style={{ color: 'var(--fg-muted)' }}>{algum ? 'Nenhuma playlist tem vídeo com essa combinação.' : 'As playlists aparecem depois que o sistema ler os canais no YouTube (uma vez por dia).'}</p>}
            {playlistsMostrar.map((p, i) => {
              const on = playSel.includes(p.ID)
              return (
                <div key={p.ID}>
                  {mostrarCanal && !on && (i === 0 || playlistsMostrar[i - 1].CANAL_ID !== p.CANAL_ID || playSel.includes(playlistsMostrar[i - 1].ID)) && <div className="px-2 pt-3 pb-1 text-[11.5px] font-medium truncate" style={{ color: 'var(--fg-subtle)' }}>{p.CANAL}</div>}
                  <button onClick={() => alternar('playlist', String(p.ID))} title={`${p.ESTUDADOS || 0} de ${p.QTD} estudados`} className="w-full text-left px-2 py-1.5 rounded-md text-[13.5px] flex items-center gap-2" style={on ? marcado : {}}>
                    {caixa(on)}<span className="truncate flex-1">{p.TITULO}</span><span style={{ color: 'var(--fg-subtle)' }}>{p.QTD}</span>
                  </button>
                </div>)
            })}
          </>}
          {agrupar === 'praticas' && <>
            <p className="px-2 pb-2 text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Vídeos que ensinam algo para fazer: meditação, banho de ervas, velas, prece e outros trabalhos espirituais.{leitura && leitura.LIDOS < leitura.N ? ` Já lidos ${leitura.LIDOS} de ${leitura.N} vídeos estudados; o resto entra aos poucos.` : ''}</p>
            {pratSel.length > 0 && <button onClick={() => filtro('pratica', '')} className="w-full text-left px-2 py-1 text-[12.5px] underline" style={{ color: 'var(--fg-muted)' }}>Desmarcar práticas</button>}
            {praticas.length === 0 && <p className="px-2 py-2 text-[13px]" style={{ color: 'var(--fg-muted)' }}>{algum ? 'Nenhum vídeo com prática nessa combinação.' : 'As práticas aparecem conforme os vídeos forem lidos.'}</p>}
            {praticasMostrar.map(p => {
              const on = pratSel.includes(p.TIPO)
              return (
                <button key={p.TIPO} onClick={() => alternar('pratica', p.TIPO)} className="w-full text-left px-2 py-1.5 rounded-md text-[13.5px] flex items-center gap-2" style={on ? marcado : {}}>
                  {caixa(on)}<span className="truncate flex-1">{p.TIPO}</span><span style={{ color: 'var(--fg-subtle)' }}>{p.QTD}</span>
                </button>)
            })}
          </>}
        </Card>

        <div className="flex flex-col gap-3 min-w-0">
          {algum > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {playSel.map(id => <button key={'p' + id} onClick={() => alternar('playlist', String(id))} className="h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5" style={marcado} title="Tirar este filtro">Playlist: {nomeDe('playlist', id)} <X size={14} /></button>)}
              {mentSel.map(id => <button key={'m' + id} onClick={() => alternar('mentor', String(id))} className="h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5" style={marcado} title="Tirar este filtro">Mentor: {nomeDe('mentor', id)} <X size={14} /></button>)}
              {temasSel.map(id => <button key={'t' + id} onClick={() => alternar('tema', String(id))} className="h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5" style={marcado} title="Tirar este filtro">Tema: {nomeDe('tema', id)} <X size={14} /></button>)}
              {pratSel.map(t => <button key={'r' + t} onClick={() => alternar('pratica', t)} className="h-8 px-3 rounded-full text-[13px] font-medium inline-flex items-center gap-1.5" style={marcado} title="Tirar este filtro">Prática: {t} <X size={14} /></button>)}
              {algum > 1 && <button onClick={limparTudo} className="text-[13px] underline" style={{ color: 'var(--fg-muted)' }}>Limpar filtros</button>}
            </div>
          )}
          {status === 'FORA_TEMA' && <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>Vídeos que não tratam de espiritualidade (jogo, programação, estudo de medicina). Ficam guardados aqui, com resumo e transcrição, mas não aparecem nas outras listas, nos temas nem na Pesquisar. Para trazer um de volta, abra o vídeo.</p>}
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
                    {v.ORIGEM === 'AUDIO' && <Badge variant="accent">Transcrito pelo áudio</Badge>}
                    {!!v.INDISPONIVEL && <Badge variant="warning">Indisponível no YouTube</Badge>}
                  </div>
                  <div className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
                    {v.CANAL}{v.PUBLICADO_EM ? ' · ' + dataBr(v.PUBLICADO_EM) : ''} · {duracao(v.DURACAO_SEG)}
                  </div>
                  {v.STATUS === 'PENDENTE' && v.MOTIVO && <div className="text-[12.5px]" style={{ color: 'var(--warning-text)' }}>Motivo: {v.MOTIVO}. Nova tentativa na próxima checagem diária.</div>}
                  {v.PRATICAS && <div className="flex flex-wrap gap-1 items-center text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Ensina: {v.PRATICAS.split('|').map(t => <Badge key={t} variant="success">{t}</Badge>)}</div>}
                  {v.PLAYLISTS && <div className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Playlist: {v.PLAYLISTS.split('|').join(' · ')}</div>}
                  {v.TEMAS && <div className="flex flex-wrap gap-1">{v.TEMAS.split('|').map(t => t.startsWith('mentor: ') ? <Badge key={t} variant="info">mentor {t.slice(8)}</Badge> : <Badge key={t} variant="accent">{t}</Badge>)}</div>}
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
