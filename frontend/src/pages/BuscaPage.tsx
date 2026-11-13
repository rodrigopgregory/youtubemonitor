import { useState } from 'react'
import { Search, Sparkles, PlayCircle } from 'lucide-react'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import CanalFiltro, { useCanal } from '../components/CanalFiltro'
import { chamarDemorado, linhas, mmss, linkYt, dataBr, duracao, momentos } from '../lib/api'

interface Res { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; DURACAO_SEG: number; TIPO: string; THUMB: string; INDISPONIVEL: boolean | number; CANAL: string; SCORE: number; MOMS: string }

const sugestoes = ['chakra coronário', 'saída do corpo', 'mantras', 'mentores espirituais', 'práticas']

export default function BuscaPage() {
  const [tema, setTema] = useState('')
  const [buscado, setBuscado] = useState('')
  const [ordem, setOrdem] = useState<'relevancia' | 'recentes'>('relevancia')
  const [res, setRes] = useState<Res[] | null>(null)
  const [resumo, setResumo] = useState<{ texto: string; vazio?: boolean; erro?: boolean } | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [canalId, setCanalId] = useCanal()

  async function buscar(t = tema, o = ordem, comResumo = true, canal = canalId) {
    const q = t.trim(); if (!q) return
    setCarregando(true); setBuscado(q)
    if (comResumo) setResumo(null)
    try {
      const r = await linhas<Res>('buscarTema', { tema: q, ordem: o, limit: 50, offset: 0, canalId: canal })
      setRes(r)
      if (comResumo) {
        if (!r.length) setResumo({ texto: `Nenhum vídeo da base trata do tema "${q}".`, vazio: true })
        else chamarDemorado<{ ok: boolean; resumo?: string; vazio?: boolean; erro?: string }>('resumoBusca', { tema: q, canalId: canal })
          .then(x => setResumo(x.ok ? { texto: x.resumo || '', vazio: x.vazio } : { texto: x.erro || 'Não consegui gerar o resumo agora.', erro: true }))
          .catch(() => setResumo({ texto: 'Não consegui gerar o resumo agora.', erro: true }))
      }
    } catch (e) {
      setRes([]); setResumo({ texto: (e as Error).message, erro: true })
    } finally { setCarregando(false) }
  }

  function trocarOrdem(o: 'relevancia' | 'recentes') { setOrdem(o); if (buscado) buscar(buscado, o, false) }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-semibold">Pesquisar um tema</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>A resposta usa só o que foi falado nos vídeos dos canais cadastrados.</p>
      </div>
      <CanalFiltro valor={canalId} onChange={id => { setCanalId(id); if (buscado) buscar(buscado, ordem, true, id) }} />
      <form onSubmit={e => { e.preventDefault(); buscar() }} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }} />
          <input value={tema} onChange={e => setTema(e.target.value)} placeholder="Ex.: chakra coronário" className="controle controle-com-icone w-full" autoFocus />
        </div>
        <Button variant="primary" type="submit" disabled={carregando || !tema.trim()}>{carregando ? 'Buscando…' : 'Buscar'}</Button>
      </form>
      {!buscado && (
        <div className="flex flex-wrap gap-2">
          {sugestoes.map(s => <button key={s} onClick={() => { setTema(s); buscar(s) }} className="h-8 px-3 rounded-full border text-[13px]" style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>{s}</button>)}
        </div>
      )}

      {buscado && resumo && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2 text-[13px] font-medium" style={{ color: 'var(--fg-muted)' }}><Sparkles size={15} />O que foi falado sobre “{buscado}”</div>
          <p className="text-[14.5px] leading-relaxed whitespace-pre-line" style={{ color: resumo.erro ? 'var(--danger)' : 'var(--fg)' }}>{resumo.texto.replace(/\*/g, '')}</p>
        </Card>
      )}
      {buscado && !resumo && res && res.length > 0 && (
        <Card className="p-5"><p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Preparando o resumo do tema com os trechos encontrados…</p></Card>
      )}

      {res && res.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>{res.length} {res.length === 1 ? 'vídeo trata' : 'vídeos tratam'} do tema</span>
            <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: 'var(--border)' }} role="group" aria-label="Ordem">
              {(['relevancia', 'recentes'] as const).map(o => (
                <button key={o} onClick={() => trocarOrdem(o)} className="h-8 px-3 rounded-md text-[13px] font-medium"
                  style={ordem === o ? { background: 'var(--accent)', color: 'var(--accent-fg)' } : { color: 'var(--fg-muted)' }}>
                  {o === 'relevancia' ? 'Mais relevantes' : 'Mais recentes'}
                </button>))}
            </div>
          </div>
          {res.map(v => {
            const moms = momentos(v.MOMS, v.DURACAO_SEG, 12)
            return (
              <Card key={v.ID} className="p-4 flex gap-4">
                <a href={linkYt(v.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="shrink-0 hidden sm:block">
                  <img src={v.THUMB} alt="" className="w-40 aspect-video object-cover rounded-lg" />
                </a>
                <div className="min-w-0 flex-1 flex flex-col gap-2">
                  <div className="flex items-start gap-2 flex-wrap">
                    <a href={linkYt(v.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="text-[15px] font-medium hover:underline">{v.TITULO}</a>
                    {v.TIPO === 'LIVE' && <Badge variant="info">Live</Badge>}
                    {!!v.INDISPONIVEL && <Badge variant="warning">Indisponível no YouTube</Badge>}
                  </div>
                  <div className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>{v.CANAL} · {dataBr(v.PUBLICADO_EM)} · {duracao(v.DURACAO_SEG)}</div>
                  {moms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>O tema aparece em:</span>
                      {moms.map(s => (
                        <a key={s} href={linkYt(v.YT_VIDEO_ID, s)} target="_blank" rel="noreferrer" className="h-7 px-2 rounded-md inline-flex items-center gap-1 text-[12.5px] font-medium"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}><PlayCircle size={13} />{mmss(s)}</a>))}
                    </div>
                  )}
                </div>
              </Card>)
          })}
        </div>
      )}
    </div>
  )
}
