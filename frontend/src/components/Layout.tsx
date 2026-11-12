import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Bell, Search, Film, Radio, Moon, Sun, MessageSquare } from 'lucide-react'
import Modal from './ui/Modal'
import { linhas, chamar, dataBr, linkYt } from '../lib/api'

interface Aviso { ID: number; DIA: string; CRIADO_EM: string; QTD: number; LIDO: boolean | number }
interface AvisoVideo { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; CANAL: string }

const abas = [
  { to: '/', label: 'Busca', icon: Search, end: true },
  { to: '/chat', label: 'Chat', icon: MessageSquare, end: false },
  { to: '/videos', label: 'Vídeos e temas', icon: Film, end: false },
  { to: '/canais', label: 'Canais', icon: Radio, end: false },
]

export default function Layout() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [aberto, setAberto] = useState(false)
  const [atual, setAtual] = useState<Aviso | null>(null)
  const [vids, setVids] = useState<AvisoVideo[]>([])
  const [escuro, setEscuro] = useState(() => document.documentElement.dataset.theme === 'dark')

  const carregar = useCallback(() => { linhas<Aviso>('avisosListar').then(setAvisos).catch(() => {}) }, [])
  useEffect(() => { carregar(); const t = setInterval(carregar, 120000); return () => clearInterval(t) }, [carregar])
  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = escuro ? 'dark' : 'light'
    el.classList.toggle('dark', escuro)
  }, [escuro])

  const naoLidos = avisos.filter(a => !a.LIDO)

  async function abrirAviso(a: Aviso) {
    setAtual(a); setVids([])
    setVids(await linhas<AvisoVideo>('avisoVideos', { id: a.ID }))
    if (!a.LIDO) { await chamar('avisoMarcarLido', { id: a.ID }); carregar() }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <header className="sticky top-0 z-30 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
          <nav className="flex items-center gap-1 overflow-x-auto">
            {abas.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className="h-9 px-3 rounded-lg inline-flex items-center gap-2 text-[13.5px] font-medium whitespace-nowrap transition-colors"
                style={({ isActive }) => isActive ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' } : { color: 'var(--fg-muted)' }}>
                <Icon size={16} />{label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setEscuro(e => !e)} className="h-9 w-9 inline-flex items-center justify-center rounded-lg" style={{ color: 'var(--fg-muted)' }} aria-label="Trocar tema">
              {escuro ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button onClick={() => { setAberto(true); setAtual(null) }} className="relative h-9 px-3 inline-flex items-center gap-2 rounded-lg text-[13.5px]"
              style={{ color: naoLidos.length ? 'var(--accent-text)' : 'var(--fg-muted)', background: naoLidos.length ? 'var(--accent-soft)' : 'transparent' }} aria-label="Avisos">
              <Bell size={17} />
              {naoLidos.length > 0 && <span className="font-medium">{naoLidos.reduce((s, a) => s + Number(a.QTD), 0)} novos</span>}
            </button>
          </div>
        </div>
      </header>

      {naoLidos.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
          <button onClick={() => { setAberto(true); abrirAviso(naoLidos[0]) }} className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 border"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}>
            <Bell size={18} style={{ color: 'var(--accent)' }} />
            <span className="text-[14px]">
              <b>{naoLidos[0].QTD} {Number(naoLidos[0].QTD) === 1 ? 'vídeo novo estudado' : 'vídeos novos estudados'}</b> em {dataBr(naoLidos[0].DIA)}. Clique para ver a lista.
            </span>
          </button>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6"><Outlet /></main>

      <Modal isOpen={aberto} onClose={() => setAberto(false)} title={atual ? `${atual.QTD} ${Number(atual.QTD) === 1 ? 'vídeo novo' : 'vídeos novos'} em ${dataBr(atual.DIA)}` : 'Avisos de vídeos novos'} size="lg">
        <div className="p-5">
          {!atual && (avisos.length === 0
            ? <p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Nenhum aviso ainda. Quando a checagem diária estudar vídeos novos, o aviso aparece aqui.</p>
            : <ul className="flex flex-col gap-2">{avisos.map(a => (
                <li key={a.ID}>
                  <button onClick={() => abrirAviso(a)} className="w-full text-left rounded-lg px-3 py-2.5 border flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[14px]">{a.QTD} {Number(a.QTD) === 1 ? 'vídeo novo estudado' : 'vídeos novos estudados'} em {dataBr(a.DIA)}</span>
                    <span className="text-[12px] font-medium" style={{ color: a.LIDO ? 'var(--fg-subtle)' : 'var(--accent)' }}>{a.LIDO ? 'Lido' : 'Não lido'}</span>
                  </button>
                </li>))}</ul>)}
          {atual && (
            <div className="flex flex-col gap-3">
              <button onClick={() => setAtual(null)} className="self-start text-[13px]" style={{ color: 'var(--fg-muted)' }}>← Todos os avisos</button>
              {vids.length === 0 ? <p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Carregando…</p> :
                <ul className="flex flex-col gap-2">{vids.map(v => (
                  <li key={v.ID} className="rounded-lg px-3 py-2.5 border" style={{ borderColor: 'var(--border)' }}>
                    <a href={linkYt(v.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="text-[14px] font-medium hover:underline">{v.TITULO}</a>
                    <div className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>{v.CANAL} · publicado em {dataBr(v.PUBLICADO_EM)}</div>
                  </li>))}</ul>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
