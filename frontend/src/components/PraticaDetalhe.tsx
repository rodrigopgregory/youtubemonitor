import { useEffect, useState } from 'react'
import { PlayCircle, Film } from 'lucide-react'
import Modal from './ui/Modal'
import Badge from './ui/Badge'
import Button from './ui/Button'
import Contador from './Contador'
import FavoritaPratica from './FavoritaPratica'
import VideoDetalhe from './VideoDetalhe'
import { nomeEt } from '../lib/etiquetas'
import { linhas, linkYt, mmss } from '../lib/api'

interface Uma { FAVORITA: number; ID: number; TIPO: string; JEITO: string | null; TITULO: string; INSTRUCAO: string; SEGUNDO: number | null; VIDEO_ID: number; YT_VIDEO_ID: string; VIDEO: string; CANAL: string; VEZES: number; ULTIMA: string | null }
interface Trecho { SEGUNDO: number; TEXTO: string }

export default function PraticaDetalhe({ id, onClose, onMudou }: { id: number; onClose: () => void; onMudou?: () => void }) {
  const [p, setP] = useState<Uma | null>(null)
  const [trechos, setTrechos] = useState<Trecho[]>([])
  const [video, setVideo] = useState(false)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    linhas<Uma>('praticaUma', { id }).then(r => {
      const u = r[0] || null
      setP(u)
      if (u && u.SEGUNDO != null) {
        const seg = Number(u.SEGUNDO)
        linhas<Trecho>('praticaTrechos', { videoId: u.VIDEO_ID, de: Math.max(0, seg - 45), ate: seg + 240 }).then(setTrechos).catch(() => setTrechos([]))
      }
    }).finally(() => setCarregando(false))
  }, [id])

  const muted = { color: 'var(--fg-muted)' }
  return (
    <>
      <Modal isOpen onClose={onClose} title="Prática" size="lg">
        <div className="p-5 flex flex-col gap-4">
          {carregando && <p className="text-[14px]" style={muted}>Carregando…</p>}
          {!carregando && !p && <p className="text-[14px]" style={muted}>Prática não encontrada.</p>}
          {p && <>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <span className="text-[16px] font-semibold first-letter:uppercase">{p.TITULO}</span>
                <div><Badge variant="success">{nomeEt(p.JEITO) || p.TIPO}</Badge></div>
              </div>
              <FavoritaPratica id={p.ID} favorita={!!Number(p.FAVORITA)} onMudou={f => { setP({ ...p, FAVORITA: f ? 1 : 0 }); onMudou?.() }} />
            </div>
            <p className="text-[14px] leading-relaxed whitespace-pre-line">{p.INSTRUCAO}</p>
            <Contador pratica={p} vezes={Number(p.VEZES || 0)} ultima={p.ULTIMA} onMudou={c => { setP({ ...p, VEZES: c.vezes, ULTIMA: c.ultima }); onMudou?.() }} />
            <div className="flex flex-col gap-1 text-[13px]" style={muted}>
              <span>Vem do vídeo: {p.VIDEO} · {p.CANAL}</span>
              <div className="flex items-center gap-4 flex-wrap">
                <a href={linkYt(p.YT_VIDEO_ID, p.SEGUNDO || 0)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--accent-text)' }}><PlayCircle size={14} />Assistir{p.SEGUNDO ? ' em ' + mmss(p.SEGUNDO) : ''}</a>
                <Button size="sm" variant="secondary" onClick={() => setVideo(true)}><Film size={14} />Abrir o vídeo com a transcrição</Button>
              </div>
            </div>
            {trechos.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium" style={muted}>Onde a prática é falada</span>
                <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto rounded-lg p-3" style={{ background: 'var(--surface-muted)' }}>
                  {trechos.map(t => {
                    const perto = p.SEGUNDO != null && t.SEGUNDO >= Number(p.SEGUNDO) && t.SEGUNDO < Number(p.SEGUNDO) + 15
                    return (
                      <div key={t.SEGUNDO} className="flex gap-3 text-[13.5px] leading-relaxed" style={perto ? { background: 'var(--accent-soft)', borderRadius: 6 } : {}}>
                        <a href={linkYt(p.YT_VIDEO_ID, t.SEGUNDO)} target="_blank" rel="noreferrer" className="shrink-0 w-14 font-medium tabular-nums hover:underline" style={{ color: 'var(--accent-text)' }}>{mmss(t.SEGUNDO)}</a>
                        <span>{t.TEXTO}</span>
                      </div>)
                  })}
                </div>
              </div>
            )}
          </>}
        </div>
      </Modal>
      {video && p && <VideoDetalhe id={p.VIDEO_ID} onClose={() => setVideo(false)} onMudou={() => {}} />}
    </>
  )
}
