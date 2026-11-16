import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Plus, Undo2 } from 'lucide-react'
import Button from './ui/Button'
import FizHoje from './FizHoje'
import type { Contagem } from './FizHoje'
import { chamar, dataBr } from '../lib/api'

export default function Contador({ pratica, vezes, ultima, onMudou }: { pratica: { ID: number; TITULO: string }; vezes: number; ultima: string | null | undefined; onMudou: (c: Contagem) => void }) {
  const [desfazer, setDesfazer] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [janela, setJanela] = useState(false)
  const [erro, setErro] = useState('')
  const relogio = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(relogio.current), [])

  function oferecerDesfazer(id?: number) {
    window.clearTimeout(relogio.current)
    if (!id) { setDesfazer(null); return }
    setDesfazer(id)
    relogio.current = window.setTimeout(() => setDesfazer(null), 15000)
  }
  async function maisUm() {
    setErro(''); setOcupado(true)
    try {
      const r = await chamar<Contagem & { ok: boolean; erro?: string }>('diarioEditar', { acao: 'fiz', praticaId: pratica.ID })
      if (!r.ok) setErro(r.erro || 'Não foi possível salvar.')
      else { onMudou(r); oferecerDesfazer(r.id) }
    } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
  }
  async function voltar() {
    if (!desfazer) return
    setErro(''); setOcupado(true)
    try {
      const r = await chamar<Contagem & { ok: boolean; erro?: string }>('diarioEditar', { acao: 'apagar', id: desfazer })
      if (!r.ok) setErro(r.erro || 'Não foi possível desfazer.')
      else { onMudou(r); oferecerDesfazer() }
    } catch (e) { setErro((e as Error).message) } finally { setOcupado(false) }
  }

  const n = Number(vezes || 0)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={maisUm} disabled={ocupado} title="Conta mais uma vez, com a data de hoje"><Plus size={14} />1</Button>
        <Button size="sm" variant="secondary" onClick={() => setJanela(true)} disabled={ocupado} title="Marcar e anotar como você se sentiu"><CheckCircle2 size={14} />Fiz hoje</Button>
        {desfazer && <Button size="sm" variant="secondary" onClick={voltar} disabled={ocupado}><Undo2 size={14} />Desfazer</Button>}
        <span className="text-[12.5px]" style={{ color: n ? 'var(--fg)' : 'var(--fg-subtle)' }} aria-live="polite">
          {n ? <><b>{n}</b> {n === 1 ? 'vez' : 'vezes'}{ultima ? ' · última em ' + dataBr(ultima) : ''}</> : 'Ainda não fiz'}
        </span>
      </div>
      {erro && <span className="text-[12.5px]" style={{ color: 'var(--danger)' }}>{erro}</span>}
      {janela && <FizHoje pratica={pratica} onClose={() => setJanela(false)} onSalvo={c => { onMudou(c); oferecerDesfazer(c.id) }} />}
    </div>
  )
}
