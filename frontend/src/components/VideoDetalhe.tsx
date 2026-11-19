import { nomeEt } from '../lib/etiquetas'
import { useCallback, useEffect, useState } from 'react'
import { Pencil, X, Plus, Check, PlayCircle, Star, Eye } from 'lucide-react'
import Modal from './ui/Modal'
import Badge from './ui/Badge'
import Button from './ui/Button'
import { linhas, chamar, mmss, linkYt, dataBr, duracao, momentos } from '../lib/api'

interface Det { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; DURACAO_SEG: number; TIPO: string; STATUS: string; MOTIVO: string | null; ORIGEM: string | null; INDISPONIVEL: boolean | number; RESUMO: string | null; CANAL: string; FAVORITO?: number | boolean; ASSISTIDO_EM?: string | null }
interface Tema { ID: number; NOME: string; ORIGEM: string; MOMENTOS: string }
interface Trecho { SEGUNDO: number; TEXTO: string }
interface Pratica { ID: number; TIPO: string; JEITO?: string | null; TITULO: string; INSTRUCAO: string; SEGUNDO: number }

export default function VideoDetalhe({ id, onClose, onMudou }: { id: number; onClose: () => void; onMudou: () => void }) {
  const [d, setD] = useState<Det | null>(null)
  const [temas, setTemas] = useState<Tema[]>([])
  const [trechos, setTrechos] = useState<Trecho[]>([])
  const [praticas, setPraticas] = useState<Pratica[]>([])
  const [mais, setMais] = useState(false)
  const [novo, setNovo] = useState('')
  const [editando, setEditando] = useState<number | null>(null)
  const [nomeEd, setNomeEd] = useState('')
  const [minEd, setMinEd] = useState('')
  const [minNovo, setMinNovo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [movendo, setMovendo] = useState(false)

  async function marcar(campo: 'fav' | 'visto') {
    if (!d) return
    const novo = campo === 'fav' ? !Number(d.FAVORITO) : !d.ASSISTIDO_EM
    setD({ ...d, ...(campo === 'fav' ? { FAVORITO: novo ? 1 : 0 } : { ASSISTIDO_EM: novo ? 'agora' : null }) })
    try { await chamar(campo === 'fav' ? 'videoFavorito' : 'videoAssistido', campo === 'fav' ? { id, fav: novo ? 1 : 0 } : { id, visto: novo ? 1 : 0 }); onMudou() }
    catch (e) { setErro((e as Error).message) }
  }

  async function foraTema(fora: boolean) {
    setErro(''); setMovendo(true)
    try {
      await chamar('videoForaTema', { id, fora: fora ? 1 : 0 })
      const r = await linhas<Det>('videoDetalhe', { id }); setD(r[0] || null); onMudou()
    } catch (e) { setErro((e as Error).message) } finally { setMovendo(false) }
  }

  const carregarTemas = useCallback(() => linhas<Tema>('videoTemas', { videoId: id }).then(setTemas), [id])
  useEffect(() => {
    linhas<Det>('videoDetalhe', { id }).then(r => setD(r[0] || null))
    carregarTemas()
    linhas<Pratica>('praticasDoVideo', { videoId: id }).then(setPraticas).catch(() => setPraticas([]))
    linhas<Trecho>('trechosDoVideo', { videoId: id, limit: 100, offset: 0 }).then(r => { setTrechos(r); setMais(r.length === 100) })
  }, [id, carregarTemas])

  async function editar(input: Record<string, unknown>) {
    setErro(''); setSalvando(true)
    try {
      const r = await chamar<{ ok: boolean; erro?: string }>('temaEditar', { videoId: id, ...input })
      if (!r.ok) setErro(r.erro || 'Não foi possível salvar.')
      else { await carregarTemas(); onMudou(); setNovo(''); setMinNovo(''); setEditando(null) }
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  async function verMais() {
    const r = await linhas<Trecho>('trechosDoVideo', { videoId: id, limit: 200, offset: trechos.length })
    setTrechos(t => [...t, ...r]); setMais(r.length === 200)
  }

  return (
    <Modal isOpen onClose={onClose} title={d?.TITULO || 'Vídeo'} size="xl">
      {!d ? <div className="p-5 text-[14px]" style={{ color: 'var(--fg-muted)' }}>Carregando…</div> : (
        <div className="p-5 flex flex-col gap-5 max-h-[78vh] overflow-y-auto">
          <div className="flex flex-wrap gap-2 items-center text-[13px]" style={{ color: 'var(--fg-muted)' }}>
            <span>{d.CANAL}</span><span>·</span><span>Publicado em {dataBr(d.PUBLICADO_EM) || '—'}</span><span>·</span><span>{duracao(d.DURACAO_SEG)}</span>
            <Badge variant={d.TIPO === 'LIVE' ? 'info' : 'neutral'}>{d.TIPO === 'LIVE' ? 'Live' : 'Vídeo'}</Badge>
            {d.ORIGEM && <Badge variant={d.ORIGEM === 'AUDIO' ? 'accent' : 'neutral'}>{d.ORIGEM === 'AUDIO' ? 'Transcrito pelo áudio' : 'Legenda do YouTube'}</Badge>}
            {!!d.INDISPONIVEL && <Badge variant="warning">Indisponível no YouTube</Badge>}
            <a href={linkYt(d.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{ color: 'var(--accent-text)' }}>Assistir no YouTube</a>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={Number(d.FAVORITO) ? 'primary' : 'secondary'} onClick={() => marcar('fav')} aria-pressed={!!Number(d.FAVORITO)}><Star size={14} fill={Number(d.FAVORITO) ? 'currentColor' : 'none'} />{Number(d.FAVORITO) ? 'Favorito' : 'Marcar como favorito'}</Button>
            <Button size="sm" variant={d.ASSISTIDO_EM ? 'primary' : 'secondary'} onClick={() => marcar('visto')} aria-pressed={!!d.ASSISTIDO_EM}><Eye size={14} />{d.ASSISTIDO_EM ? 'Já assisti' + (d.ASSISTIDO_EM !== 'agora' ? ' em ' + dataBr(d.ASSISTIDO_EM) : '') : 'Marcar como já assisti'}</Button>
          </div>
          {d.STATUS === 'PENDENTE' && <p className="text-[13.5px]" style={{ color: 'var(--warning-text)' }}>Pendente: {d.MOTIVO}. O sistema tenta de novo na próxima checagem diária.</p>}
          {(d.STATUS === 'ESTUDADO' || d.STATUS === 'FORA_TEMA') && (
            <div className="flex items-center gap-3 flex-wrap">
              {d.STATUS === 'FORA_TEMA' && <Badge variant="neutral">Fora do tema espiritualidade</Badge>}
              <span className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>{d.STATUS === 'FORA_TEMA' ? 'Este vídeo não aparece nas listas, nos temas nem na Pesquisar.' : 'Não trata de espiritualidade?'}</span>
              <Button variant="secondary" size="sm" disabled={movendo} onClick={() => foraTema(d.STATUS !== 'FORA_TEMA')}>{movendo ? 'Salvando…' : d.STATUS === 'FORA_TEMA' ? 'Trazer de volta' : 'Mover para Fora do tema espiritualidade'}</Button>
            </div>
          )}
          {d.STATUS === 'FILA' && <p className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>Este vídeo ainda está na fila para ser estudado.</p>}

          {d.RESUMO && <section><h3 className="text-[14px] font-medium mb-1.5">Resumo</h3><p className="text-[14px] leading-relaxed">{d.RESUMO}</p></section>}

          {praticas.length > 0 && (
            <section>
              <h3 className="text-[14px] font-medium mb-2">Práticas ensinadas</h3>
              <div className="flex flex-col gap-3">
                {praticas.map(p => (
                  <div key={p.ID} className="rounded-lg p-3 flex flex-col gap-1.5" style={{ background: 'var(--surface-muted)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="success">{nomeEt(p.JEITO) || p.TIPO}</Badge>
                      <span className="text-[14px] font-medium">{p.TITULO}</span>
                      <a href={linkYt(d.YT_VIDEO_ID, p.SEGUNDO)} target="_blank" rel="noreferrer" className="text-[12px] inline-flex items-center gap-0.5 hover:underline" style={{ color: 'var(--accent-text)' }}><PlayCircle size={12} />{mmss(p.SEGUNDO)}</a>
                    </div>
                    {p.INSTRUCAO && <p className="text-[13.5px] leading-relaxed whitespace-pre-line">{p.INSTRUCAO}</p>}
                  </div>))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-[14px] font-medium mb-2">Temas</h3>
            <div className="flex flex-col gap-2">
              {temas.map(t => (
                <div key={t.ID} className="flex items-center gap-2 flex-wrap">
                  {editando === t.ID ? (
                    <form className="flex gap-1.5 items-center" onSubmit={e => { e.preventDefault(); editar({ acao: 'renomear', temaId: t.ID, novo: nomeEd, momentos: minEd }) }}>
                      <input className="controle h-8" value={nomeEd} onChange={e => setNomeEd(e.target.value)} autoFocus aria-label="Nome do tema" />
                      <input className="controle h-8 w-48" value={minEd} onChange={e => setMinEd(e.target.value)} placeholder="Minutos: 12, 25:30" aria-label="Minutos do tema no vídeo" title="Minutos em que o tema aparece. Use 12 (minuto 12) ou 25:30, separados por vírgula." />
                      <Button size="sm" variant="primary" type="submit" disabled={salvando}><Check size={14} /></Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => setEditando(null)}><X size={14} /></Button>
                    </form>
                  ) : (
                    <>
                      <Badge variant="accent">{t.NOME}</Badge>
                      {t.ORIGEM === 'USUARIO' && <span className="text-[11.5px]" style={{ color: 'var(--fg-subtle)' }}>editado por você</span>}
                      <button onClick={() => { setEditando(t.ID); setNomeEd(t.NOME); setMinEd(String(t.MOMENTOS || '').split(',').map(Number).filter(n => Number.isFinite(n) && n >= 0 && String(n) !== '').map(mmss).join(', ')) }} title="Editar nome e minutos" className="h-7 w-7 inline-flex items-center justify-center rounded-md" style={{ color: 'var(--fg-muted)' }}><Pencil size={13} /></button>
                      <button onClick={() => editar({ acao: 'tirar', temaId: t.ID })} title="Tirar" disabled={salvando} className="h-7 w-7 inline-flex items-center justify-center rounded-md" style={{ color: 'var(--fg-muted)' }}><X size={14} /></button>
                      {momentos(t.MOMENTOS, d.DURACAO_SEG, 6).map(s => (
                        <a key={s} href={linkYt(d.YT_VIDEO_ID, s)} target="_blank" rel="noreferrer" className="text-[12px] inline-flex items-center gap-0.5 hover:underline" style={{ color: 'var(--accent-text)' }}><PlayCircle size={12} />{mmss(s)}</a>))}
                    </>
                  )}
                </div>))}
              <form className="flex gap-1.5 items-center mt-1" onSubmit={e => { e.preventDefault(); editar({ acao: 'acrescentar', nome: novo, momentos: minNovo }) }}>
                <input className="controle h-8 max-w-xs" placeholder="Acrescentar tema" value={novo} onChange={e => setNovo(e.target.value)} />
                <input className="controle h-8 w-48" placeholder="Minutos: 12, 25:30" value={minNovo} onChange={e => setMinNovo(e.target.value)} aria-label="Minutos do tema no vídeo" title="Minutos em que o tema aparece. Use 12 (minuto 12) ou 25:30, separados por vírgula." />
                <Button size="sm" variant="secondary" type="submit" disabled={salvando || !novo.trim()}><Plus size={14} />Acrescentar</Button>
              </form>
              {erro && <p className="text-[12.5px]" style={{ color: 'var(--danger)' }}>{erro}</p>}
              <p className="text-[12px]" style={{ color: 'var(--fg-subtle)' }}>O que você editar fica valendo: as checagens diárias não mudam os temas deste vídeo.</p>
            </div>
          </section>

          {trechos.length > 0 && (
            <section>
              <h3 className="text-[14px] font-medium mb-2">Transcrição</h3>
              <div className="flex flex-col gap-2">
                {trechos.map(t => (
                  <div key={t.SEGUNDO} className="flex gap-3 text-[13.5px] leading-relaxed">
                    <a href={linkYt(d.YT_VIDEO_ID, t.SEGUNDO)} target="_blank" rel="noreferrer" className="shrink-0 w-14 font-medium tabular-nums hover:underline" style={{ color: 'var(--accent-text)' }}>{mmss(t.SEGUNDO)}</a>
                    <span>{t.TEXTO}</span>
                  </div>))}
                {mais && <Button variant="secondary" size="sm" onClick={verMais}>Carregar mais da transcrição</Button>}
              </div>
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
