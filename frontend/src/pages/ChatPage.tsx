import { useEffect, useRef, useState } from 'react'
import { Send, PlayCircle, Trash2, MessageSquare, Mic, Square } from 'lucide-react'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EstadoIA from '../components/EstadoIA'
import CanalFiltro, { useCanal } from '../components/CanalFiltro'
import { chamar, chamarDemorado, mmss, linkYt, dataBr, duracao, momentos } from '../lib/api'

interface Vid { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; DURACAO_SEG: number; TIPO: string; THUMB: string; INDISPONIVEL: boolean | number; ORIGEM?: string | null; CANAL: string; MOMS: string }
interface Acao { tipo: 'estudar'; quantidade: number; canalId: number; rotulo: string; estado?: 'feito' | 'cancelado' }
interface Msg { papel: 'pessoa' | 'agente'; texto: string; videos?: Vid[]; termos?: string[]; erro?: boolean; acao?: Acao }

const CHAVE = 'monitor-yt-chat'
const exemplos = ['chakra coronário', 'O que ele fala sobre proteção contra energias negativas?', 'Vídeos mais recentes sobre mentores espirituais', 'Lives que falam de mantras', 'Estude mais 100 vídeos', 'Como está o estudo?']

type Reconhecedor = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null }
function criarReconhecedor(): Reconhecedor | null {
  const w = window as unknown as Record<string, new () => Reconhecedor>
  const C = w.SpeechRecognition || w.webkitSpeechRecognition
  return C ? new C() : null
}

function carregar(): Msg[] {
  try { return JSON.parse(localStorage.getItem(CHAVE) || '[]') } catch { return [] }
}

export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>(carregar)
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [canalId, setCanalId] = useCanal()
  const fim = useRef<HTMLDivElement>(null)
  const caixa = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight + 2, Math.round(window.innerHeight * 0.4)) + 'px'
  }, [texto])
  const [ouvindo, setOuvindo] = useState(false)
  const [avisoVoz, setAvisoVoz] = useState('')
  const rec = useRef<Reconhecedor | null>(null)
  const base = useRef('')
  const temVoz = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  function falar() {
    if (ouvindo) { rec.current?.stop(); return }
    const r = criarReconhecedor()
    if (!r) { setAvisoVoz('Este navegador não aceita ditado por voz. Use o Chrome ou o Edge.'); return }
    setAvisoVoz('')
    base.current = texto ? texto.trimEnd() + ' ' : ''
    r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true
    let final = ''
    r.onresult = e => {
      let parcial = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t + ' '; else parcial += t
      }
      setTexto((base.current + final + parcial).replace(/\s+/g, ' ').trimStart())
    }
    r.onerror = e => { setAvisoVoz(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Libere o microfone para este site no navegador (ícone de cadeado na barra de endereço).' : e.error === 'no-speech' ? 'Não ouvi nada. Toque no microfone e fale de novo.' : 'Não consegui ouvir agora. Tente de novo.') }
    r.onend = () => { setOuvindo(false); rec.current = null }
    rec.current = r
    try { r.start(); setOuvindo(true) } catch { setAvisoVoz('Não consegui ligar o microfone. Tente de novo.') }
  }
  useEffect(() => () => rec.current?.stop(), [])

  useEffect(() => { localStorage.setItem(CHAVE, JSON.stringify(msgs.slice(-40))) }, [msgs])
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, pensando])

  async function enviar(t = texto) {
    const q = t.trim(); if (!q || pensando) return
    if (ouvindo) rec.current?.stop()
    const historico = msgs.slice(-8).map(m => ({ papel: m.papel, texto: m.texto }))
    setMsgs(m => [...m, { papel: 'pessoa', texto: q }]); setTexto(''); setPensando(true)
    try {
      const r = await chamarDemorado<{ ok: boolean; resposta?: string; erro?: string; videos?: Vid[]; termos?: string[]; acao?: Acao }>('chatBusca', { texto: q, mensagens: historico, canalId })
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
    <div className="flex flex-col h-[calc(100dvh-7rem)] sm:h-[calc(100dvh-8.5rem)] min-h-[420px]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold">Pesquisar</h1>
          <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>Pergunte com as suas palavras e veja os vídeos e os momentos.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CanalFiltro valor={canalId} onChange={setCanalId} />
          {msgs.length > 0 && <Button variant="ghost" size="sm" onClick={() => setMsgs([])}><Trash2 size={14} />Nova conversa</Button>}
        </div>
      </div>
      <EstadoIA soPausa className="mb-3" />

      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border p-4 flex flex-col gap-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
        {msgs.length === 0 && (
          <div className="mt-auto sm:m-auto w-full sm:w-auto flex flex-col sm:items-center gap-2 sm:gap-3 sm:text-center sm:max-w-3xl">
            <MessageSquare size={24} className="hidden sm:block" style={{ color: 'var(--accent)' }} />
            <p className="text-[13px] sm:text-[14px]" style={{ color: 'var(--fg-muted)' }}>Experimente:</p>
            <div className="flex sm:flex-wrap sm:justify-center gap-2 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {exemplos.map(e => <button key={e} onClick={() => enviar(e)} className="shrink-0 whitespace-nowrap sm:whitespace-normal px-3 py-1.5 rounded-full border text-[12.5px] sm:text-[13px]" style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>{e}</button>)}
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
                        {v.ORIGEM === 'AUDIO' && <Badge variant="accent">Transcrito pelo áudio</Badge>}
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
        {pensando && <div className="self-start rounded-2xl px-4 py-2.5 text-[14px]" style={{ background: 'var(--surface-muted)', color: 'var(--fg-muted)' }}>Procurando nos vídeos… isso leva até 1 minuto.</div>}
        <div ref={fim} />
      </div>

      <form onSubmit={e => { e.preventDefault(); enviar() }} className="flex flex-wrap sm:flex-nowrap items-end gap-2 pt-3">
        <textarea ref={caixa} value={texto} onChange={e => setTexto(e.target.value)} rows={3} placeholder={ouvindo ? 'Ouvindo…' : 'Tema ou pergunta. Ex.: chakra coronário'}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 640) { e.preventDefault(); enviar() } }}
          className="controle w-full sm:flex-1 resize-none py-2.5 leading-relaxed overflow-y-auto" style={{ minHeight: '5.5rem', maxHeight: '40vh' }} />
        <div className="flex gap-2 ml-auto shrink-0">
        {temVoz && <Button type="button" variant={ouvindo ? 'primary' : 'secondary'} onClick={falar} disabled={pensando} aria-label={ouvindo ? 'Parar de ouvir' : 'Falar por voz'} title={ouvindo ? 'Parar de ouvir' : 'Falar por voz'}>
          {ouvindo ? <><Square size={14} />Parar</> : <Mic size={16} />}
        </Button>}
        <Button variant="primary" type="submit" disabled={pensando || !texto.trim()}><Send size={15} />Enviar</Button>
        </div>
      </form>
      {(ouvindo || avisoVoz) && <p className="text-[12.5px] pt-1.5" style={{ color: avisoVoz ? 'var(--warning-text)' : 'var(--accent-text)' }}>{avisoVoz || 'Ouvindo… fale a sua pergunta. Toque em Parar quando terminar e depois em Enviar.'}</p>}
    </div>
  )
}
