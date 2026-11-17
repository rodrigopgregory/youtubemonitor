import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import LivrosPage from './LivrosPage'
import RelacaoLivrosPage from './RelacaoLivrosPage'

const sub = [
  { to: '/livros/indicados', label: 'Livros indicados' },
  { to: '/livros/relacao', label: 'Relação de livros' },
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
        <Route path="*" element={<Navigate to="indicados" replace />} />
      </Routes>
    </div>
  )
}
