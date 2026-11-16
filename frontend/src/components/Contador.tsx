import { useState } from 'react'
import { CheckCircle2, Undo2, Pencil } from 'lucide-react'
import Button from './ui/Button'
import FizHoje from './FizHoje'
import type { Contagem, RegistroEd } from './FizHoje'
import { chamar, dataBr } from '../lib/api'

export default function Contador({ pratica, vezes, ultima, onMudou }: { pratica: { ID: number; TITULO: string }; vezes: number; ultima: string | null | undefined; onMudou: (c: Contagem) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [editando, setEditando] = useState<RegistroEd | null>(null)
  const [erro, setErro] = useState('')

  async function acao(nome: 'fiz' | 'desfazer') {
    setErro(''); setOcupado(true)
    try {
      const r = await chamar<Contagem & { ok: boolean; erro?: string }>('diarioEditar', { acao: nome, praticaId: pratica.ID })
      if (!r.ok) setErro(r.erro || 'Não foi possível salvar.')
      else onMudou(r)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
  }
  async function anotar() {
    setErro(''); setOcupado(true)
    try {
      const r = await chamar<{ ok: boolean; erro?: string; registro?: RegistroEd }>('diarioEditar', { acao: 'ultimo', praticaId: pratica.ID })
      if (!r.ok || !r.registro) setErro(r.erro || 'Não foi possível abrir.')
      else setEditando(r.registro)
    } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
  }

  const n = Number(vezes || 0)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => acao('fiz')} disabled={ocupado} title="Conta mais uma vez, com a data de hoje"><CheckCircle2 size={14} />Fiz hoje</Button>
        <span className="inline-flex items-center gap-1.5 text-[13px]" aria-live="polite">
          <span className="min-w-7 h-7 px-2 rounded-full inline-flex items-center justify-center text-[13px] font-semibold"
            style={n ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' } : { background: 'var(--surface-muted)', color: 'var(--fg-subtle)' }}
            title={n + (n === 1 ? ' vez' : ' vezes')}>{n}</span>
          <span style={{ color: n ? 'var(--fg-muted)' : 'var(--fg-subtle)' }}>{n && ultima ? 'última em ' + dataBr(ultima) : 'ainda não fiz'}</span>
        </span>
        {n > 0 && <>
          <Button size="sm" variant="secondary" onClick={() => acao('desfazer')} disabled={ocupado} title="Tira o último registro"><Undo2 size={14} />Desfazer</Button>
          <button onClick={anotar} disabled={ocupado} className="h-8 w-8 inline-flex items-center justify-center rounded-lg" style={{ color: 'var(--fg-subtle)' }} aria-label="Anotar como me senti no último registro" title="Anotar como me senti no último registro"><Pencil size={15} /></button>
        </>}
      </div>
      {erro && <span className="text-[12.5px]" style={{ color: 'var(--danger)' }}>{erro}</span>}
      {editando && <FizHoje pratica={pratica} registro={editando} onClose={() => setEditando(null)} onSalvo={c => onMudou(c)} />}
    </div>
  )
}
