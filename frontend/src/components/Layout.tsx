import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Bell, Search, Film, Radio, Moon, Sun, Download, Users, RefreshCw, Settings, Archive, Check, Mail } from 'lucide-react'
import Modal from './ui/Modal'
import { linhas, chamar, dataBr, linkYt } from '../lib/api'

interface Aviso { ID: number; DIA: string; CRIADO_EM: string; QTD: number; LIDO: boolean | number }
interface AvisoVideo { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; STATUS: string; CANAL: string }

const abas = [
  { to: '/', label: 'Pesquisar', icon: Search, end: true },
  { to: '/videos', label: 'Vídeos e temas', icon: Film, end: false },
  { to: '/mentores', label: 'Mentores', icon: Users, end: false },
  { to: '/canais', label: 'Canais', icon: Radio, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, end: false },
]

export default function Layout() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [aberto, setAberto] = useState(false)
  const [atual, setAtual] = useState<Aviso | null>(null)
  const [vids, setVids] = useState<AvisoVideo[]>([])
  const [busca, setBusca] = useState<{ rodando: boolean; msg: string; erro?: boolean } | null>(null)
  async function buscarNovos() {
    setBusca({ rodando: true, msg: '' })
    try {
      const r = await chamar<{ ok: boolean; novos?: number; canais?: { nome: string; novos: number; msg?: string }[]; erro?: string }>('canaisAtualizar')
      if (!r?.ok) { setBusca({ rodando: false, msg: r?.erro || 'Não foi possível procurar agora. Tente de novo em instantes.', erro: true }); return }
      const det = (r.canais || []).filter(c => c.novos > 0 || c.msg).map(c => c.msg ? `${c.nome}: ${c.msg}` : `${c.nome}: ${c.novos}`).join(' · ')
      setBusca({ rodando: false, msg: r.novos ? `${r.novos} ${r.novos === 1 ? 'vídeo novo entrou' : 'vídeos novos entraram'} na fila de estudo. ${det}` : `Nenhum vídeo novo nos canais desde a última conferência.${det ? ' ' + det : ''}` })
    } catch (er) { setBusca({ rodando: false, msg: (er as Error).message, erro: true }) }
  }
  const [escuro, setEscuro] = useState(() => document.documentElement.dataset.theme === 'dark')

  const carregar = useCallback(() => { linhas<Aviso>('avisosListar').then(setAvisos).catch(() => {}) }, [])
  useEffect(() => { carregar(); const t = setInterval(carregar, 120000); return () => clearInterval(t) }, [carregar])
  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = escuro ? 'dark' : 'light'
    el.classList.toggle('dark', escuro)
  }, [escuro])

  const [instalar, setInstalar] = useState<{ prompt: () => Promise<void> } | null>(null)
  useEffect(() => {
    const pegar = (e: Event) => { e.preventDefault(); setInstalar(e as unknown as { prompt: () => Promise<void> }) }
    const instalado = () => setInstalar(null)
    window.addEventListener('beforeinstallprompt', pegar)
    window.addEventListener('appinstalled', instalado)
    return () => { window.removeEventListener('beforeinstallprompt', pegar); window.removeEventListener('appinstalled', instalado) }
  }, [])

  const naoLidos = avisos.filter(a => !a.LIDO)

  const totalNovos = naoLidos.reduce((s, a) => s + Number(a.QTD), 0)

  async function abrirAviso(a: Aviso) {
    setAtual(a); setVids([])
    setVids(await linhas<AvisoVideo>('avisoVideos', { id: a.ID }))
  }

  async function marcar(a: Aviso, lido: boolean) {
    setAvisos(l => l.map(x => x.ID === a.ID ? { ...x, LIDO: lido ? 1 : 0 } : x))
    if (atual?.ID === a.ID) setAtual({ ...a, LIDO: lido ? 1 : 0 })
    try { await chamar('avisoMarcar', { id: a.ID, lido: lido ? 1 : 0 }) } finally { carregar() }
  }

  async function arquivar(a: Aviso) {
    setAvisos(l => l.filter(x => x.ID !== a.ID))
    if (atual?.ID === a.ID) setAtual(null)
    try { await chamar('avisoArquivar', { id: a.ID }) } finally { carregar() }
  }

  async function todosLidos() {
    setAvisos(l => l.map(x => ({ ...x, LIDO: 1 })))
    try { await chamar('avisosTodosLidos') } finally { carregar() }
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
            {instalar && <button onClick={() => { instalar.prompt().finally(() => setInstalar(null)) }} className="h-9 px-3 inline-flex items-center gap-2 rounded-lg text-[13.5px]" style={{ color: 'var(--fg-muted)' }} title="Instalar o Monitor como aplicativo neste aparelho">
              <Download size={16} /><span className="hidden sm:inline">Instalar app</span>
            </button>}
            <button onClick={buscarNovos} disabled={busca?.rodando} className="h-9 px-3 inline-flex items-center gap-2 rounded-lg text-[13.5px]" style={{ color: 'var(--fg-muted)' }} title="Procurar agora vídeos novos em todos os canais">
              <RefreshCw size={16} className={busca?.rodando ? 'animate-spin' : ''} /><span className="hidden sm:inline">{busca?.rodando ? 'Procurando…' : 'Buscar vídeos novos'}</span>
            </button>
            <button onClick={() => setEscuro(e => !e)} className="h-9 w-9 inline-flex items-center justify-center rounded-lg" style={{ color: 'var(--fg-muted)' }} aria-label="Trocar tema">
              {escuro ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button onClick={() => { setAberto(true); setAtual(null) }} className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg"
              style={{ color: naoLidos.length ? 'var(--accent)' : 'var(--fg-muted)', background: naoLidos.length ? 'var(--accent-soft)' : 'transparent' }}
              aria-label={naoLidos.length ? `Avisos: ${naoLidos.length} não ${naoLidos.length === 1 ? 'lido' : 'lidos'}` : 'Avisos'}
              title={naoLidos.length ? `${totalNovos} ${totalNovos === 1 ? 'vídeo novo' : 'vídeos novos'} em avisos não lidos` : 'Avisos'}>
              <Bell size={18} fill={naoLidos.length ? 'currentColor' : 'none'} />
              {naoLidos.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold leading-[18px] text-center"
                style={{ background: 'var(--danger)', color: 'var(--fg-inverted)', boxShadow: '0 0 0 2px var(--bg-elevated)' }}>{naoLidos.length > 99 ? '99+' : naoLidos.length}</span>}
            </button>
          </div>
        </div>
      </header>

      {busca && !busca.rodando && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
          <div className="rounded-lg border px-4 py-2.5 text-[13.5px] flex items-start gap-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated, var(--bg))', color: busca.erro ? 'var(--danger)' : 'var(--fg)' }}>
            <span className="flex-1">{busca.msg}</span>
            <button onClick={() => setBusca(null)} className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Fechar</button>
          </div>
        </div>
      )}

      {naoLidos.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
          <button onClick={() => { setAberto(true); abrirAviso(naoLidos[0]) }} className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 border"
            style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-border)' }}>
            <Bell size={18} style={{ color: 'var(--accent)' }} />
            <span className="text-[14px]">
              <b>{naoLidos[0].QTD} {Number(naoLidos[0].QTD) === 1 ? 'vídeo novo captado' : 'vídeos novos captados'}</b> em {dataBr(naoLidos[0].DIA)}. Clique para ver a lista.
            </span>
          </button>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6"><Outlet /></main>

      <Modal isOpen={aberto} onClose={() => setAberto(false)} title={atual ? `${atual.QTD} ${Number(atual.QTD) === 1 ? 'vídeo novo' : 'vídeos novos'} em ${dataBr(atual.DIA)}` : 'Avisos de vídeos novos'} size="lg">
        <div className="p-5">
          {!atual && (avisos.length === 0
            ? <p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Nenhum aviso na lista. Quando a checagem diária encontrar vídeos novos, o aviso aparece aqui.</p>
            : <div className="flex flex-col gap-2">
                {naoLidos.length > 1 && <button onClick={todosLidos} className="self-end text-[13px] underline" style={{ color: 'var(--fg-muted)' }}>Marcar todos como lidos</button>}
                <ul className="flex flex-col gap-2">{avisos.map(a => (
                  <li key={a.ID} className="rounded-lg border flex items-center gap-1 pr-1.5" style={{ borderColor: a.LIDO ? 'var(--border)' : 'var(--accent-border)', background: a.LIDO ? 'transparent' : 'var(--accent-soft)' }}>
                    <button onClick={() => abrirAviso(a)} className="flex-1 min-w-0 text-left px-3 py-2.5 flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.LIDO ? 'transparent' : 'var(--accent)' }} />
                      <span className={'text-[14px] ' + (a.LIDO ? '' : 'font-semibold')}>{a.QTD} {Number(a.QTD) === 1 ? 'vídeo novo captado' : 'vídeos novos captados'} em {dataBr(a.DIA)}</span>
                    </button>
                    <button onClick={() => marcar(a, !a.LIDO)} className="h-8 px-2 rounded-md inline-flex items-center gap-1 text-[12.5px]" style={{ color: 'var(--fg-muted)' }} title={a.LIDO ? 'Marcar como não lido' : 'Marcar como lido'}>
                      {a.LIDO ? <Mail size={14} /> : <Check size={14} />}<span className="hidden sm:inline">{a.LIDO ? 'Não lido' : 'Lido'}</span>
                    </button>
                    <button onClick={() => arquivar(a)} className="h-8 px-2 rounded-md inline-flex items-center gap-1 text-[12.5px]" style={{ color: 'var(--fg-muted)' }} title="Arquivar: sai da lista">
                      <Archive size={14} /><span className="hidden sm:inline">Arquivar</span>
                    </button>
                  </li>))}</ul>
              </div>)}
          {atual && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setAtual(null)} className="text-[13px] mr-auto" style={{ color: 'var(--fg-muted)' }}>← Todos os avisos</button>
                <button onClick={() => marcar(atual, !atual.LIDO)} className="h-8 px-2.5 rounded-md border inline-flex items-center gap-1.5 text-[13px]" style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>
                  {atual.LIDO ? <Mail size={14} /> : <Check size={14} />}{atual.LIDO ? 'Marcar como não lido' : 'Marcar como lido'}
                </button>
                <button onClick={() => arquivar(atual)} className="h-8 px-2.5 rounded-md border inline-flex items-center gap-1.5 text-[13px]" style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}>
                  <Archive size={14} />Arquivar
                </button>
              </div>
              {vids.length === 0 ? <p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Carregando…</p> :
                <ul className="flex flex-col gap-2">{vids.map(v => (
                  <li key={v.ID} className="rounded-lg px-3 py-2.5 border" style={{ borderColor: 'var(--border)' }}>
                    <a href={linkYt(v.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="text-[14px] font-medium hover:underline">{v.TITULO}</a>
                    <div className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>{v.CANAL} · publicado em {dataBr(v.PUBLICADO_EM)} · {v.STATUS === 'ESTUDADO' ? 'já estudado' : v.STATUS === 'PENDENTE' ? 'estudo com problema' : 'na fila para estudar'}</div>
                  </li>))}</ul>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
