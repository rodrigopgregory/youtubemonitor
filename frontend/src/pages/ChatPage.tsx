import { useEffect, useRef, useState } from 'react'
import { Send, PlayCircle, Trash2, MessageSquare } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { chamar, mmss, linkYt, dataBr, duracao, momentos } from '../lib/api'

interface Vid { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; DURACAO_SEG: number; TIPO: string; THUMB: string; INDISPONIVEL: boolean | number; CANAL: string; MOMS: string }
interface Acao { tipo: 'estudar'; quantidade: number; canalId: number; rotulo: string; estado?: 'feito' | 'cancelado' }
interface Msg { papel: 'pessoa' | 'agente'; texto: string; videos?: Vid[]; termos?: string[]; erro?: boolean; acao?: Acao }

const CHAVE = 'monitor-yt-chat'
const exemplos = ['O que ele fala sobre proteção contra energias negativas?', 'Vídeos mais recentes sobre mentores espirituais', 'Lives que falam de mantras', 'Estude mais 100 vídeos', 'Como está o estudo?']

function carregar(): Msg[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) || '[]') } catch { return [] }
}

export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>(carregar)
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => { localStorage.setItem(CHAVE, JSON.stringify(msgs.slice(-40))) }, [msgs])
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, pensando])

  async function enviar(t = texto) {
    const q = t.trim(); if (!q || pensando) return
    const historico = msgs.slice(-8).map(m => ({ papel: m.papel, texto: m.texto }))
    setMsgs(m => [...m, { papel: 'pessoa', texto: q }]); setTexto(''); setPensando(true)
    try {
      const r = await chamar<{ ok: boolean; resposta?: string; erro?: string; videos?: Vid[]; termos?: string[]; acao?: Acao }>('chatBusca', { texto: q, mensagens: historico })
      setMsgs(m => [...m, r.ok ? { papel: 'agente', texto: r.resposta || '', videos: r.videos, termos: r.termos, acao: r.acao } : { papel: 'agente', texto: r.erro || 'Não consegui responder agora.', erro: true }])
    } catch (e) {
      setMsgs(m => [...m, { papel: 'agente', texto: (e as Error).message, erro: true }])
    } finally { setPensando(false) }
  }

  function marcar(i: number, estado: 'feito' | 'cancelado') {
    setMsgs(m => m.map((x, j) => j === i && x.acao ? { ...x, acao: { ...x.acao, estado } } : x))
  }

  async function executar(i: number, a: Acao) {
    if (pensando) return
    setPensando(true)
    try {
      const r = await chamar<{ ok: boolean; erro?: string; quantidade?: number }>('estudarMais', { quantidade: a.quantidade, canalId: a.canalId })
      marcar(i, 'feito')
      setMsgs(m => [...m, r.ok
        ? { papel: 'agente', texto: `Pronto: ${r.quantidade} vídeos a mais entraram na fila. O estudo já começou e segue sozinho, uns 8 vídeos por minuto quando há legenda no YouTube. Pergunte "como está o estudo?" quando quiser.` }
        : { papel: 'agente', texto: r.erro || 'Não consegui colocar os vídeos na fila.', erro: true }])
    } catch (e) {
      setMsgs(m => [...m, { papel: 'agente', texto: (e as Error).message, erro: true }])
    } finally { setPensando(false) }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[480px]">
      <div className="flex items-end justify-between gap-3 pb-4">
        <div>
          <h1 className="text-[22px] font-semibold">Chat</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>Peça com as suas palavras o que quer encontrar. A resposta usa só o que foi falado nos vídeos da base. Você também pode pedir para estudar mais vídeos.</p>
        </div>
        {msgs.length > 0 && <Button variant="ghost" size="sm" onClick={() => setMsgs([])}><Trash2 size={14} />Nova conversa</Button>}
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border p-4 flex flex-col gap-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
        {msgs.length === 0 && (
          <div className="m-auto flex flex-col items-center gap-4 text-center max-w-md">
            <MessageSquare size={28} style={{ color: 'var(--accent)' }} />
            <p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Experimente:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {exemplos.map(e => <button key={e} onClick={() => enviar(e)} className="px-3 py-1.5 rounded-full border text-[13px]" style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>{e}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => m.papel === 'pessoa' ? (
          <div key={i} className="self-end max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] whitespace-pre-line" style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>{m.texto}</div>
        ) : (
          <div key={i} className="self-start max-w-[92%] flex flex-col gap-3">
            <div className="rounded-2xl rounded-bl-md px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line" style={{ background: 'var(--surface-muted)', color: m.erro ? 'var(--danger)' : 'var(--fg)' }}>{m.texto}</div>
            {m.acao && (
              m.acao.estado ? <span className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{m.acao.estado === 'feito' ? 'Confirmado.' : 'Cancelado.'}</span> :
              <div className="flex gap-2">
                <Button size="sm" variant="primary" disabled={pensando} onClick={() => executar(i, m.acao!)}>{m.acao.rotulo}</Button>
                <Button size="sm" variant="secondary" disabled={pensando} onClick={() => marcar(i, 'cancelado')}>Cancelar</Button>
              </div>
            )}
            {m.videos && m.videos.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{m.videos.length} {m.videos.length === 1 ? 'vídeo encontrado' : 'vídeos encontrados'}{m.termos?.length ? ' · procurei por: ' + m.termos.join(', ') : ''}</span>
                {m.videos.map(v => (
                  <div key={v.ID} className="rounded-xl border p-3 flex gap-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <a href={linkYt(v.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="shrink-0 hidden sm:block"><img src={v.THUMB} alt="" className="w-28 aspect-video object-cover rounded-lg" /></a>
                    <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                      <div className="flex items-start gap-2 flex-wrap">
                        <a href={linkYt(v.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="text-[14px] font-medium hover:underline">{v.TITULO}</a>
                        {v.TIPO === 'LIVE' && <Badge variant="info">Live</Badge>}
                        {!!v.INDISPONIVEL && <Badge variant="warning">Indisponível no YouTube</Badge>}
                      </div>
                      <div className="text-[12px]" style={{ color: 'var(--fg-muted)' }}>{v.CANAL} · {dataBr(v.PUBLICADO_EM)} · {duracao(v.DURACAO_SEG)}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {momentos(v.MOMS, v.DURACAO_SEG, 8).map(s => (
                          <a key={s} href={linkYt(v.YT_VIDEO_ID, s)} target="_blank" rel="noreferrer" className="h-6 px-2 rounded-md inline-flex items-center gap-1 text-[12px] font-medium"
                            style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}><PlayCircle size={12} />{mmss(s)}</a>))}
                      </div>
                    </div>
                  </div>))}
              </div>
            )}
          </div>
        ))}
        {pensando && <div className="self-start rounded-2xl px-4 py-2.5 text-[14px]" style={{ background: 'var(--surface-muted)', color: 'var(--fg-muted)' }}>Procurando nos vídeos…</div>}
        <div ref={fim} />
      </div>

      <form onSubmit={e => { e.preventDefault(); enviar() }} className="flex gap-2 pt-3">
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={1} placeholder="Ex.: o que ele fala sobre chakra coronário nas lives?"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
          className="controle flex-1 resize-none py-2" style={{ height: 'auto', minHeight: 'var(--altura-controle)' }} />
        <Button variant="primary" type="submit" disabled={pensando || !texto.trim()}><Send size={15} />Enviar</Button>
      </form>
    </div>
  )
}
