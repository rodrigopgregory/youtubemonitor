import { useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { chamar } from '../lib/api'

export const HUMORES = [
  { n: 1, emoji: '😣', nome: 'Pior' },
  { n: 2, emoji: '😕', nome: 'Um pouco pior' },
  { n: 3, emoji: '😐', nome: 'Igual' },
  { n: 4, emoji: '🙂', nome: 'Melhor' },
  { n: 5, emoji: '😌', nome: 'Muito melhor' },
]
export const humorDe = (n?: number | null) => HUMORES.find(h => h.n === Math.round(Number(n || 0)))

const hojeBr = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)

export interface RegistroEd { ID: number; DIA: string; HUMOR: number | null; SENTIU: string | null }
export interface Contagem { praticaId: number; vezes: number; ultima: string | null; id?: number }

export default function FizHoje({ pratica, registro, onClose, onSalvo }: { pratica: { ID: number; TITULO: string }; registro?: RegistroEd; onClose: () => void; onSalvo: (c: Contagem) => void }) {
  const [humor, setHumor] = useState(Number(registro?.HUMOR || 0))
  const [sentiu, setSentiu] = useState(registro?.SENTIU || '')
  const [dia, setDia] = useState(registro?.DIA || hojeBr())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setErro(''); setSalvando(true)
    try {
      const r = await chamar<Contagem & { ok: boolean; erro?: string }>('diarioEditar', registro ? { acao: 'editar', id: registro.ID, humor, sentiu, dia } : { acao: 'fiz', praticaId: pratica.ID, humor, sentiu, dia })
      if (!r.ok) setErro(r.erro || 'Não foi possível salvar.')
      else { onSalvo(r); onClose() }
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  return (
    <Modal isOpen onClose={onClose} title={registro ? 'Editar registro' : 'Fiz esta prática'} size="md">
      <div className="p-5 flex flex-col gap-4">
        <p className="text-[14px] font-medium first-letter:uppercase">{pratica.TITULO}</p>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium" style={{ color: 'var(--fg-muted)' }}>Como você ficou depois?</span>
          <div className="grid grid-cols-5 gap-1.5">
            {HUMORES.map(h => {
              const on = humor === h.n
              return (
                <button key={h.n} type="button" onClick={() => setHumor(on ? 0 : h.n)} aria-pressed={on}
                  className="rounded-lg border py-2 flex flex-col items-center gap-1 text-[11.5px] leading-tight"
                  style={on ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)', color: 'var(--accent-text)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>
                  <span className="text-[22px] leading-none" aria-hidden>{h.emoji}</span>{h.nome}
                </button>)
            })}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium" style={{ color: 'var(--fg-muted)' }}>O que você sentiu (opcional)</span>
          <textarea value={sentiu} onChange={e => setSentiu(e.target.value)} rows={4} maxLength={2000} placeholder="Ex.: senti calor nas mãos e dormi melhor"
            className="controle w-full resize-none py-2.5 leading-relaxed" style={{ minHeight: '6rem' }} />
        </label>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--fg-muted)' }}>
          Dia:
          <input type="date" value={dia} max={hojeBr()} onChange={e => setDia(e.target.value || hojeBr())} className="controle w-auto" />
        </label>
        {erro && <p className="text-[13px]" style={{ color: 'var(--danger)' }}>{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </div>
    </Modal>
  )
}
