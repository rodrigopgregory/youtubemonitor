import { useEffect, useState } from 'react'
import { linhas } from '../lib/api'

interface Canal { ID: number; NOME: string }

const CHAVE = 'monitor-yt-canal'

export function useCanal(): [number, (id: number) => void] {
  const [id, setId] = useState<number>(() => Number(localStorage.getItem(CHAVE) || 0))
  const mudar = (n: number) => { localStorage.setItem(CHAVE, String(n)); setId(n) }
  return [id, mudar]
}

export default function CanalFiltro({ valor, onChange }: { valor: number; onChange: (id: number) => void }) {
  const [canais, setCanais] = useState<Canal[]>([])
  useEffect(() => { linhas<Canal>('canaisNomes').then(setCanais).catch(() => {}) }, [])
  useEffect(() => { if (valor && canais.length && !canais.some(c => c.ID === valor)) onChange(0) }, [canais, valor, onChange])
  if (canais.length < 2) return null
  return (
    <label className="inline-flex items-center gap-2 text-[13px]" style={{ color: 'var(--fg-muted)' }}>
      Canal
      <select value={valor} onChange={e => onChange(Number(e.target.value))} className="controle h-8 py-0 pr-8 max-w-[260px]">
        <option value={0}>Todos os canais</option>
        {canais.map(c => <option key={c.ID} value={c.ID}>{c.NOME}</option>)}
      </select>
    </label>
  )
}
