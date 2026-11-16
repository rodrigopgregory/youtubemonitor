import { useCallback, useEffect, useRef, useState } from 'react'
import { FileArchive } from 'lucide-react'
import Button from './ui/Button'
import { chamarLogado, iniciarLogado } from '../lib/api'

type Ultimo = { id: number; estado: string; etapa?: string; criadoEm?: string; terminouEm?: string; nome?: string; tamanho?: number | null; sha256?: string; arquivos?: number | null; conferido?: number | null; erro?: string | null }
type Estado = { ok: boolean; erro?: string; vazio?: boolean; ultimo?: Ultimo | null; base?: { geradoEm: string; commit: string } | null; url?: string; nome?: string; jaGerando?: boolean }

const muted = { color: 'var(--fg-muted)' }
const mb = (n: number) => (n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' MB'
const dh = (iso?: string | null) => { if (!iso) return '-'; const [d, h] = iso.split('T'); const [a, m, dia] = d.split('-'); return `${dia}/${m}/${a} ${(h || '').slice(0, 5)}` }

export default function ExportLeve() {
  const [est, setEst] = useState<Estado | null>(null)
  const [praticas, setPraticas] = useState(true)
  const [livro, setLivro] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null)
  const timer = useRef<number | null>(null)

  const atualizar = useCallback(async () => {
    try { setEst(await chamarLogado<Estado>('exportarLeve', { acao: 'estado' })) } catch { /* tenta no próximo ciclo */ }
  }, [])

  useEffect(() => { atualizar() }, [atualizar])
  const gerando = est?.ultimo?.estado === 'GERANDO'
  useEffect(() => {
    if (timer.current) window.clearInterval(timer.current)
    if (gerando) timer.current = window.setInterval(atualizar, 4000)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [gerando, atualizar])

  async function gerar() {
    setOcupado(true); setMsg(null)
    try {
      await iniciarLogado('exportarLeve', { acao: 'gerar', opcoes: { praticas, livro } })
      setMsg({ t: 'Geração iniciada. Pode ficar nesta tela: ela acompanha sozinha.' })
      window.setTimeout(atualizar, 2500)
    } catch { setMsg({ t: 'Não foi possível iniciar agora.', erro: true }) } finally { setOcupado(false) }
  }
  async function baixar() {
    setMsg(null)
    try {
      const r = await chamarLogado<Estado>('exportarLeve', { acao: 'link' })
      if (!r.ok || !r.url) { setMsg({ t: r.erro || 'Não foi possível gerar o link.', erro: true }); return }
      const a = document.createElement('a'); a.href = r.url; a.download = r.nome || 'exportacao-leve.zip'; document.body.appendChild(a); a.click(); a.remove()
    } catch { setMsg({ t: 'Não foi possível gerar o link agora.', erro: true }) }
  }

  const u = est?.ultimo
  const pronto = u?.estado === 'PRONTO'
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col gap-1">
        <p className="text-[13.5px] font-medium">Exportação leve (código, regras e estrutura)</p>
        <p className="text-[13px]" style={muted}>ZIP pequeno, sem transcrições e sem os dados do dia a dia: código e histórico Git, as funções publicadas, as regras de classificação com os prompts, a estrutura do banco, as tabelas pequenas de configuração e as listas de dependências do Mitra. Nenhuma chave ou senha vai junto.</p>
      </div>
      <div className="flex flex-wrap gap-4 text-[13.5px]">
        <label className="flex items-center gap-2"><input type="checkbox" checked={praticas} onChange={e => setPraticas(e.target.checked)} disabled={gerando} />Incluir as práticas</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={livro} onChange={e => setLivro(e.target.checked)} disabled={gerando} />Incluir o Livro Vivo</label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={ocupado || gerando} onClick={gerar}><FileArchive size={15} />{gerando ? 'Gerando…' : pronto ? 'Gerar de novo' : 'Gerar exportação leve'}</Button>
        {pronto && <Button variant="secondary" onClick={baixar}>Baixar o ZIP</Button>}
        {gerando && <span className="text-[13px]" style={muted}>{u?.etapa}</span>}
      </div>
      {u && (
        <div className="text-[13px] flex flex-col gap-0.5" style={muted}>
          <span>Última: <b>{gerando ? 'gerando' : pronto ? 'pronta' : u.estado === 'ERRO' ? 'com erro' : u.estado}</b> ({dh(u.terminouEm || u.criadoEm)})</span>
          {pronto && u.tamanho != null && <span>{u.nome} · {mb(u.tamanho)} · {u.arquivos} arquivos · {u.conferido ? 'conferida depois de gravar' : 'conferência falhou'}</span>}
          {pronto && u.sha256 && <span className="break-all">SHA-256: {u.sha256}</span>}
          {u.estado === 'ERRO' && <span style={{ color: 'var(--danger)' }}>{u.erro || 'A geração falhou. Gere de novo.'}</span>}
        </div>
      )}
      {est?.base && <p className="text-[12.5px]" style={muted}>Código incluído: versão {est.base.commit.slice(0, 7)}, de {dh(est.base.geradoEm)}. O código só muda quando a base for atualizada no desenvolvimento.</p>}
      {pronto && <p className="text-[12.5px]" style={muted}>O link de download vale 2 minutos e só funciona com você logada.</p>}
      {msg && <p className="text-[12.5px]" style={{ color: msg.erro ? 'var(--danger)' : 'var(--success-text)' }}>{msg.t}</p>}
    </div>
  )
}
