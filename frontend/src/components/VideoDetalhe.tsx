import { useCallback, useEffect, useState } from 'react'
import { Pencil, X, Plus, Check, PlayCircle } from 'lucide-react'
import Modal from './ui/Modal'
import Badge from './ui/Badge'
import Button from './ui/Button'
import { linhas, chamar, mmss, linkYt, dataBr, duracao, momentos } from '../lib/api'

interface Det { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; DURACAO_SEG: number; TIPO: string; STATUS: string; MOTIVO: string | null; ORIGEM: string | null; INDISPONIVEL: boolean | number; RESUMO: string | null; CANAL: string }
interface Tema { ID: number; NOME: string; ORIGEM: string; MOMENTOS: string }
interface Trecho { SEGUNDO: number; TEXTO: string }

export default function VideoDetalhe({ id, onClose, onMudou }: { id: number; onClose: () => void; onMudou: () => void }) {
  const [d, setD] = useState<Det | null>(null)
  const [temas, setTemas] = useState<Tema[]>([])
  const [trechos, setTrechos] = useState<Trecho[]>([])
  const [mais, setMais] = useState(false)
  const [novo, setNovo] = useState('')
  const [editando, setEditando] = useState<number | null>(null)
  const [nomeEd, setNomeEd] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregarTemas = useCallback(() => linhas<Tema>('videoTemas', { videoId: id }).then(setTemas), [id])
  useEffect(() => {
    linhas<Det>('videoDetalhe', { id }).then(r => setD(r[0] || null))
    carregarTemas()
    linhas<Trecho>('trechosDoVideo', { videoId: id, limit: 100, offset: 0 }).then(r => { setTrechos(r); setMais(r.length === 100) })
  }, [id, carregarTemas])

  async function editar(input: Record<string, unknown>) {
    setErro(''); setSalvando(true)
    try {
      const r = await chamar<{ ok: boolean; erro?: string }>('temaEditar', { videoId: id, ...input })
      if (!r.ok) setErro(r.erro || 'Não foi possível salvar.')
      else { await carregarTemas(); onMudou(); setNovo(''); setEditando(null) }
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
            {d.ORIGEM && <Badge variant="neutral">{d.ORIGEM === 'AUDIO' ? 'Transcrito pelo áudio' : 'Transcrição do YouTube'}</Badge>}
            {!!d.INDISPONIVEL && <Badge variant="warning">Indisponível no YouTube</Badge>}
            <a href={linkYt(d.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{ color: 'var(--accent-text)' }}>Assistir no YouTube</a>
          </div>
          {d.STATUS === 'PENDENTE' && <p className="text-[13.5px]" style={{ color: 'var(--warning-text)' }}>Pendente: {d.MOTIVO}. O sistema tenta de novo na próxima checagem diária.</p>}
          {d.STATUS === 'FILA' && <p className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>Este vídeo ainda está na fila para ser estudado.</p>}

          {d.RESUMO && <section><h3 className="text-[14px] font-medium mb-1.5">Resumo</h3><p className="text-[14px] leading-relaxed">{d.RESUMO}</p></section>}

          <section>
            <h3 className="text-[14px] font-medium mb-2">Temas</h3>
            <div className="flex flex-col gap-2">
              {temas.map(t => (
                <div key={t.ID} className="flex items-center gap-2 flex-wrap">
                  {editando === t.ID ? (
                    <form className="flex gap-1.5 items-center" onSubmit={e => { e.preventDefault(); editar({ acao: 'renomear', temaId: t.ID, novo: nomeEd }) }}>
                      <input className="controle h-8" value={nomeEd} onChange={e => setNomeEd(e.target.value)} autoFocus />
                      <Button size="sm" variant="primary" type="submit" disabled={salvando}><Check size={14} /></Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => setEditando(null)}><X size={14} /></Button>
                    </form>
                  ) : (
                    <>
                      <Badge variant="accent">{t.NOME}</Badge>
                      {t.ORIGEM === 'USUARIO' && <span className="text-[11.5px]" style={{ color: 'var(--fg-subtle)' }}>editado por você</span>}
                      <button onClick={() => { setEditando(t.ID); setNomeEd(t.NOME) }} title="Renomear" className="h-7 w-7 inline-flex items-center justify-center rounded-md" style={{ color: 'var(--fg-muted)' }}><Pencil size={13} /></button>
                      <button onClick={() => editar({ acao: 'tirar', temaId: t.ID })} title="Tirar" disabled={salvando} className="h-7 w-7 inline-flex items-center justify-center rounded-md" style={{ color: 'var(--fg-muted)' }}><X size={14} /></button>
                      {momentos(t.MOMENTOS, d.DURACAO_SEG, 6).map(s => (
                        <a key={s} href={linkYt(d.YT_VIDEO_ID, s)} target="_blank" rel="noreferrer" className="text-[12px] inline-flex items-center gap-0.5 hover:underline" style={{ color: 'var(--accent-text)' }}><PlayCircle size={12} />{mmss(s)}</a>))}
                    </>
                  )}
                </div>))}
              <form className="flex gap-1.5 items-center mt-1" onSubmit={e => { e.preventDefault(); editar({ acao: 'acrescentar', nome: novo }) }}>
                <input className="controle h-8 max-w-xs" placeholder="Acrescentar tema" value={novo} onChange={e => setNovo(e.target.value)} />
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
