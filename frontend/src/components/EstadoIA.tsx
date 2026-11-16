import { PauseCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { linhas } from '../lib/api'

interface Estado { PAUSADA_ATE: string | null; N: number; LIDOS: number }

export default function EstadoIA({ soPausa = false, className = '' }: { soPausa?: boolean; className?: string }) {
  const [e, setE] = useState<Estado | null>(null)
  useEffect(() => { linhas<Estado>('iaEstado').then(r => setE(r[0] || null)).catch(() => {}) }, [])
  if (!e) return null
  const agoraBr = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19)
  const pausada = !!e.PAUSADA_ATE && e.PAUSADA_ATE > agoraBr
  const n = Number(e.N) || 0, lidos = Number(e.LIDOS) || 0
  const faltam = !soPausa && n > 0 && lidos < n
  if (!pausada && !faltam) return null
  const pct = n ? Math.round(lidos / n * 100) : 0
  return (
    <div className={className + ' cartao px-3 py-2.5 flex flex-col gap-1.5 text-[13px]'} style={{ color: 'var(--fg-muted)' }}>
      {faltam && (
        <div className="flex items-center gap-3">
          <span className="shrink-0">Práticas lidas: <b style={{ color: 'var(--fg)' }}>{lidos.toLocaleString('pt-BR')}</b> de {n.toLocaleString('pt-BR')} vídeos</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-[60px]" style={{ background: 'var(--surface-muted)' }}><div className="h-full rounded-full" style={{ width: pct + '%', background: 'var(--accent)' }} /></div>
          <span className="shrink-0">{pct}%</span>
        </div>
      )}
      {pausada && (
        <div className="flex items-start gap-1.5" style={{ color: 'var(--warning)' }}>
          <PauseCircle size={15} className="shrink-0 mt-[1px]" />
          <span>A IA do Google está em pausa até umas {Number(e.PAUSADA_ATE!.slice(11, 13))}h (acabou a cota grátis do dia). A busca continua funcionando; as práticas e os resumos voltam sozinhos.</span>
        </div>
      )}
    </div>
  )
}
