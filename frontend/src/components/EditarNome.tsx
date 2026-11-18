import { useState } from 'react'
import Button from './ui/Button'
import { chamar } from '../lib/api'

const TIPOS: [string, string][] = [['MUSICA', 'Música, álbum ou banda'], ['AUDIOVISUAL', 'Filme, série ou vídeo'], ['SAGRADO', 'Texto sagrado ou clássico'], ['PENDENTE', 'Voltar para validar (pode ser livro)']]
const limpa = (v: string) => v.replace(/['"\\{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)

interface Props { id: number; estado: string; motivo: string | null; onSalvo: (estado: string, motivo: string) => void; onCancelar: () => void }

export default function EditarNome({ id, estado, motivo, onSalvo, onCancelar }: Props) {
  const [tipo, setTipo] = useState(estado)
  const [nota, setNota] = useState(motivo || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    setSalvando(true); setErro('')
    try { await chamar('outrosEditar', { id, estado: tipo, motivo: limpa(nota) }); onSalvo(tipo, limpa(nota)) }
    catch { setErro('Não deu certo agora. Tente de novo.') }
    finally { setSalvando(false) }
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
      <label className="flex flex-col gap-1 text-[13px]">
        <span style={{ color: 'var(--fg-muted)' }}>O que é</span>
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="controle w-full">
          {TIPOS.map(([codigo, rotulo]) => <option key={codigo} value={codigo}>{rotulo}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px]">
        <span style={{ color: 'var(--fg-muted)' }}>Nota (autor, artista, o que for útil)</span>
        <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} className="controle w-full" maxLength={300} />
      </label>
      {erro && <p className="text-[13px]" style={{ color: 'var(--danger-text)' }}>{erro}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        <Button size="sm" variant="secondary" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  )
}
