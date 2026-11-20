import { useState } from 'react'
import { Download } from 'lucide-react'
import Button from './ui/Button'
import { exportarPraticasFiltro, type FiltroVideos } from '../lib/exportar'

const muted = { color: 'var(--fg-muted)' }

export default function ExportPraticas({ filtro, nome, titulo }: { filtro: FiltroVideos; nome: string; titulo?: string }) {
  const [msg, setMsg] = useState<{ rodando: boolean; msg: string } | null>(null)
  async function baixar() {
    setMsg({ rodando: true, msg: 'Buscando as práticas…' })
    try {
      const n = await exportarPraticasFiltro(filtro, nome, m => setMsg({ rodando: true, msg: m }))
      setMsg({ rodando: false, msg: `Planilha baixada com ${n} ${n === 1 ? 'prática' : 'práticas'}.` })
    } catch { setMsg({ rodando: false, msg: 'Não foi possível exportar agora. Tente de novo em instantes.' }) }
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="secondary" size="sm" disabled={!!msg?.rodando} onClick={baixar} title={titulo || 'Baixa uma planilha com as práticas que estão aparecendo agora'}>
        <Download size={14} />{msg?.rodando ? 'Montando a planilha…' : 'Exportar práticas'}
      </Button>
      {msg && <span className="text-[12.5px]" style={muted}>{msg.msg}</span>}
    </div>
  )
}
