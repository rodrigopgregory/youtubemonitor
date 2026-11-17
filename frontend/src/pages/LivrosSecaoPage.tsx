import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import LivrosPage from './LivrosPage'
import RelacaoLivrosPage from './RelacaoLivrosPage'
import ValidarLivrosPage from './ValidarLivrosPage'
import OutrosNomesPage from './OutrosNomesPage'

const sub = [
  { to: '/livros/indicados', label: 'Livros indicados' },
  { to: '/livros/relacao', label: 'Relação de livros' },
  { to: '/livros/validar', label: 'Livros a validar' },
  { to: '/livros/musicas', label: 'Músicas' },
  { to: '/livros/audiovisuais', label: 'Audiovisuais' },
]

export default function LivrosSecaoPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {sub.map(s => (
          <NavLink key={s.to} to={s.to}
            className="h-10 px-3 inline-flex items-center text-[14px] font-medium border-b-2 -mb-px"
            style={({ isActive }) => isActive ? { borderColor: 'var(--accent)', color: 'var(--accent-text)' } : { borderColor: 'transparent', color: 'var(--fg-muted)' }}>
            {s.label}
          </NavLink>
        ))}
      </div>
      <Routes>
        <Route path="indicados" element={<LivrosPage />} />
        <Route path="relacao" element={<RelacaoLivrosPage />} />
        <Route path="validar" element={<ValidarLivrosPage />} />
        <Route path="musicas" element={<OutrosNomesPage estado="MUSICA" titulo="Músicas, álbuns e bandas" texto="Nomes citados nos vídeos que são música, álbum ou banda e não livro." />} />
        <Route path="audiovisuais" element={<OutrosNomesPage estado="AUDIOVISUAL" titulo="Filmes, séries e vídeos" texto="Nomes citados nos vídeos que são filme, série ou vídeo e não livro." />} />
        <Route path="*" element={<Navigate to="indicados" replace />} />
      </Routes>
    </div>
  )
}
