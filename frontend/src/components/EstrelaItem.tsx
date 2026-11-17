import { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { chamar, linhas } from '../lib/api'

export const limpaNome = (v: string) => v.replace(/['"\\{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250)

export function useFavoritosTipo(tipo: 'LIVRO' | 'MUSICA' | 'AUDIOVISUAL' | 'SAGRADO') {
  const [nomes, setNomes] = useState<Set<string>>(new Set())
  useEffect(() => { linhas<{ NOME: string }>('favItensTipo', { tipo }).then(r => setNomes(new Set(r.map(x => x.NOME.toLowerCase())))).catch(() => setNomes(new Set())) }, [tipo])
  const alternar = useCallback(async (nome: string) => {
    const n = limpaNome(nome); const chave = n.toLowerCase(); const ja = nomes.has(chave)
    await chamar(ja ? 'favItemTirar' : 'favItemMarcar', { tipo, nome: n })
    setNomes(s => { const novo = new Set(s); if (ja) novo.delete(chave); else novo.add(chave); return novo })
  }, [nomes, tipo])
  return { ehFavorito: (nome: string) => nomes.has(limpaNome(nome).toLowerCase()), alternar }
}

export default function EstrelaItem({ favorito, onAlternar }: { favorito: boolean; onAlternar: () => Promise<void> }) {
  const [ocupado, setOcupado] = useState(false)
  return (
    <button onClick={async e => { e.stopPropagation(); setOcupado(true); try { await onAlternar() } finally { setOcupado(false) } }} disabled={ocupado} aria-pressed={favorito}
      className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg" style={{ color: favorito ? 'var(--warning)' : 'var(--fg-subtle)' }}
      aria-label={favorito ? 'Tirar dos favoritos' : 'Marcar como favorito'} title={favorito ? 'Favorito (toque para tirar)' : 'Marcar como favorito'}>
      <Star size={17} fill={favorito ? 'currentColor' : 'none'} />
    </button>
  )
}
