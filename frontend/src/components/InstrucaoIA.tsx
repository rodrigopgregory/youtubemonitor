import { useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

interface Reconhecimento { lang: string; interimResults: boolean; continuous: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void; stop: () => void }

export default function InstrucaoIA({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const [ouvindo, setOuvindo] = useState(false)
  const rec = useRef<Reconhecimento | null>(null)
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecimento; webkitSpeechRecognition?: new () => Reconhecimento }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition

  function alternar() {
    if (ouvindo) { rec.current?.stop(); return }
    if (!Ctor) return
    const base = valor.trim()
    const r = new Ctor()
    r.lang = 'pt-BR'; r.interimResults = true; r.continuous = true
    r.onresult = e => {
      const fala = Array.from(e.results).map(x => x[0].transcript).join(' ').trim()
      onChange((base ? base + ' ' : '') + fala)
    }
    r.onend = () => setOuvindo(false)
    r.onerror = () => setOuvindo(false)
    rec.current = r
    setOuvindo(true)
    r.start()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium" style={{ color: 'var(--fg-muted)' }}>Instrução para a IA (vale para o botão "Validar com IA")</span>
      <div className="flex gap-2 items-start">
        <textarea value={valor} onChange={e => onChange(e.target.value.slice(0, 500))} rows={2} placeholder="Ex.: só confirme se achar um livro real com esse nome e esse autor" className="controle w-full resize-none py-2 leading-relaxed" />
        {Ctor && (
          <button type="button" onClick={alternar} aria-pressed={ouvindo} aria-label={ouvindo ? 'Parar de gravar' : 'Falar a instrução'} title={ouvindo ? 'Parar de gravar' : 'Falar a instrução'}
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-lg border"
            style={ouvindo ? { background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>
            {ouvindo ? <Square size={16} /> : <Mic size={18} />}
          </button>)}
      </div>
      {!Ctor && <span className="text-[11.5px]" style={{ color: 'var(--fg-subtle)' }}>O ditado por voz funciona no Chrome e no Edge. Aqui, digite a instrução.</span>}
    </div>
  )
}
