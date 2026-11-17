import { useState } from 'react'
import { Star } from 'lucide-react'
import { chamar } from '../lib/api'

export default function FavoritaPratica({ id, favorita, onMudou }: { id: number; favorita: boolean; onMudou: (fav: boolean) => void }) {
  const [ocupado, setOcupado] = useState(false)
  async function alternar() {
    setOcupado(true)
    try { await chamar('praticaFavorito', { id, fav: favorita ? 0 : 1 }); onMudou(!favorita) } finally { setOcupado(false) }
  }
  return (
    <button onClick={e => { e.stopPropagation(); alternar() }} disabled={ocupado} aria-pressed={favorita} className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg"
      style={{ color: favorita ? 'var(--warning)' : 'var(--fg-subtle)' }} aria-label={favorita ? 'Tirar das favoritas' : 'Marcar como favorita'} title={favorita ? 'Favorita (toque para tirar)' : 'Marcar como favorita'}>
      <Star size={17} fill={favorita ? 'currentColor' : 'none'} />
    </button>
  )
}
