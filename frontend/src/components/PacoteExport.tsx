import { useCallback, useEffect, useRef, useState } from 'react'
import { Package } from 'lucide-react'
import Button from './ui/Button'
import Input from './ui/Input'
import { chamar } from '../lib/api'

type Parte = { id: number; nome: string; tamanho: number; sha256: string }
type Estado = {
  ok: boolean; erro?: string; vazio?: boolean; estado?: string; etapa?: string; jaGerando?: boolean
  dadosEm?: string; codigoEm?: string; terminouEm?: string;
  totais?: { tabelas_com_dados: number; tabelas_so_estrutura: number; views: number; linhas: number; transcricoes: number }
  tamanhoTotal?: number; conferidas?: boolean; partes?: Parte[]
  codigoDev?: { geradoEm: string; commit: string } | null; codigo?: { GERADO_EM: string } | null
  sessao?: string; mensagem?: string; url?: string; nome?: string
}

const muted = { color: 'var(--fg-muted)' }
const EMAIL_KEY = 'exportar-email'
const mb = (n: number) => (n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB'
const dh = (iso?: string | null) => { if (!iso) return '-'; const [d, h] = iso.split('T'); const [a, m, dia] = d.split('-'); return `${dia}/${m}/${a} ${(h || '').slice(0, 5)}` }

export default function PacoteExport() {
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || '')
  const [codigo, setCodigo] = useState('')
  const [sessao, setSessao] = useState('')
  const [etapaCodigo, setEtapaCodigo] = useState<'email' | 'codigo'>('email')
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [est, setEst] = useState<Estado | null>(null)
  const timer = useRef<number | null>(null)

  const atualizar = useCallback(async (tok: string) => {
    try {
      const r = await chamar<Estado>('exportarPacote', { acao: 'estado', sessao: tok })
      if (!r.ok) { setSessao(''); setEtapaCodigo('email'); setMsg({ t: 'Sua sessão acabou. Peça um novo código.', erro: true }); return }
      setEst(r)
    } catch { /* tenta de novo no próximo ciclo */ }
  }, [])

  useEffect(() => {
    if (!sessao) return
    atualizar(sessao)
    timer.current = window.setInterval(() => atualizar(sessao), 5000)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [sessao, atualizar])

  async function pedir() {
    setOcupado(true); setMsg(null)
    try {
      localStorage.setItem(EMAIL_KEY, email.trim())
      const r = await chamar<Estado>('exportarPacote', { acao: 'pedirCodigo', email: email.trim() })
      if (r.ok) { setEtapaCodigo('codigo'); setMsg({ t: r.mensagem || 'Código enviado.' }) } else setMsg({ t: r.erro || 'Não foi possível pedir o código.', erro: true })
    } catch { setMsg({ t: 'Não foi possível pedir o código agora.', erro: true }) } finally { setOcupado(false) }
  }
  async function validar() {
    setOcupado(true); setMsg(null)
    try {
      const r = await chamar<Estado>('exportarPacote', { acao: 'validarCodigo', email: email.trim(), codigo: codigo.trim() })
      if (r.ok && r.sessao) { setSessao(r.sessao); setCodigo('') } else setMsg({ t: r.erro || 'Código inválido.', erro: true })
    } catch { setMsg({ t: 'Não foi possível conferir o código agora.', erro: true }) } finally { setOcupado(false) }
  }
  async function gerar() {
    setOcupado(true); setMsg(null)
    try {
      const r = await chamar<Estado>('exportarPacote', { acao: 'iniciar', sessao })
      if (!r.ok) setMsg({ t: r.erro || 'Não foi possível iniciar.', erro: true })
      else setMsg({ t: r.jaGerando ? 'Já existe uma geração em andamento.' : 'Geração iniciada. Pode fechar a tela: ela continua no servidor.' })
      await atualizar(sessao)
    } catch { setMsg({ t: 'Não foi possível iniciar agora.', erro: true }) } finally { setOcupado(false) }
  }
  async function baixar(p: Parte) {
    setMsg(null)
    try {
      const r = await chamar<Estado>('exportarPacote', { acao: 'link', sessao, parteId: p.id })
      if (!r.ok || !r.url) { setMsg({ t: r.erro || 'Não foi possível gerar o link.', erro: true }); return }
      const a = document.createElement('a'); a.href = r.url; a.download = p.nome; document.body.appendChild(a); a.click(); a.remove()
    } catch { setMsg({ t: 'Não foi possível gerar o link agora.', erro: true }) }
  }

  const gerando = est?.estado === 'GERANDO'
  const pronto = est?.estado === 'PRONTO'
  const codigoEm = est?.codigoEm || est?.codigoDev?.geradoEm || null
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col gap-1">
        <p className="text-[13.5px]" style={muted}>Gera um pacote completo para levar o app a outra hospedagem: banco (estrutura e dados), transcrições em TXT, vínculos com a minutagem, leitura por categoria, funções, código e guia de migração. Chaves e senhas não vão no pacote.</p>
        <p className="text-[12.5px] font-medium" style={{ color: 'var(--warning)' }}>Confidencial: o pacote tem dados pessoais e conteúdo de terceiros (transcrições de vídeos). Não publique nem compartilhe.</p>
      </div>
      {!sessao ? (
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <div className="flex-1"><Input label="E-mail autorizado" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={ocupado || etapaCodigo === 'codigo'} /></div>
          {etapaCodigo === 'codigo' && <div className="sm:w-40"><Input label="Código de 6 dígitos" inputMode="numeric" maxLength={6} value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} disabled={ocupado} /></div>}
          {etapaCodigo === 'email'
            ? <Button variant="secondary" disabled={ocupado || !email.includes('@')} onClick={pedir}><Package size={15} />{ocupado ? 'Enviando…' : 'Receber código por e-mail'}</Button>
            : <div className="flex gap-2"><Button variant="primary" disabled={ocupado || codigo.length !== 6} onClick={validar}>{ocupado ? 'Conferindo…' : 'Entrar'}</Button><Button variant="ghost" disabled={ocupado} onClick={() => { setEtapaCodigo('email'); setCodigo(''); setMsg(null) }}>Trocar e-mail</Button></div>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={ocupado || gerando} onClick={gerar}><Package size={15} />{gerando ? 'Gerando…' : pronto ? 'Gerar de novo' : 'Gerar o pacote'}</Button>
            {gerando && <span className="text-[13px]" style={muted}>{est?.etapa}</span>}
          </div>
          {est && !est.vazio && (
            <div className="text-[13px] flex flex-col gap-0.5" style={muted}>
              <span>Estado: <b>{gerando ? 'gerando' : pronto ? 'pronto' : est.estado === 'ERRO' ? 'com erro' : est.estado}</b></span>
              <span>Dados e arquivos de: {dh(est.dadosEm)}</span>
              <span>Código do pacote de: {dh(codigoEm)}{est.codigoDev?.commit ? ` (versão ${est.codigoDev.commit.slice(0, 7)})` : ''}</span>
              {est.estado === 'ERRO' && <span style={{ color: 'var(--danger)' }}>{est.erro || 'A geração falhou. Gere de novo.'}</span>}
            </div>
          )}
          {pronto && est?.totais && (
            <div className="text-[13px]">
              <p>{est.totais.tabelas_com_dados} tabelas com dados ({est.totais.linhas.toLocaleString('pt-BR')} linhas), {est.totais.tabelas_so_estrutura} só com estrutura, {est.totais.views} views, {est.totais.transcricoes.toLocaleString('pt-BR')} transcrições. {est.partes?.length} partes, {mb(est.tamanhoTotal || 0)}. Conferência dos arquivos após gravar: {est.conferidas ? 'ok' : 'com falha, veja VERIFICACAO.md'}.</p>
              <ul className="mt-2 flex flex-col gap-1">
                {est.partes?.map(p => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span>{p.nome} <span style={muted}>({mb(p.tamanho)})</span></span>
                    <Button size="sm" variant="secondary" onClick={() => baixar(p)}>Baixar</Button>
                  </li>))}
              </ul>
              <p className="mt-2 text-[12.5px]" style={muted}>Baixe todas as partes na mesma pasta. Cada link vale 90 segundos. Comece pelo README_MIGRACAO.md, dentro de 00-raiz.zip.</p>
            </div>
          )}
        </div>
      )}
      {msg && <p className="text-[12.5px]" style={{ color: msg.erro ? 'var(--danger)' : 'var(--success-text)' }}>{msg.t}</p>}
    </div>
  )
}
