import { useCallback, useEffect, useRef, useState } from 'react'
import { GitBranch } from 'lucide-react'
import Button from './ui/Button'
import { chamarLogado, iniciarLogado } from '../lib/api'

type Estado = { ok: boolean; erro?: string; configurado?: boolean; repo?: string; branch?: string; estado?: string; etapa?: string; quando?: string; commit?: string; link?: string; arquivos?: number; zip?: { nome: string; em: string } | null }
type Leve = { ok: boolean; ultimo?: { id: number; estado: string; etapa?: string; erro?: string | null } | null }

const muted = { color: 'var(--fg-muted)' }
const dh = (iso?: string | null) => { if (!iso) return '-'; const [d, h] = iso.split('T'); const [a, m, dia] = d.split('-'); return `${dia}/${m}/${a} ${(h || '').slice(0, 5)}` }

export default function ExportGit() {
  const [est, setEst] = useState<Estado | null>(null)
  const [fase, setFase] = useState<'' | 'leve' | 'git'>('')
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null)
  const timer = useRef<number | null>(null)

  const atualizar = useCallback(async () => {
    try { setEst(await chamarLogado<Estado>('exportarGit', { acao: 'estado' })) } catch { /* tenta de novo */ }
  }, [])
  useEffect(() => { atualizar() }, [atualizar])
  const enviando = fase !== '' || est?.estado === 'ENVIANDO'
  useEffect(() => {
    if (timer.current) window.clearInterval(timer.current)
    if (enviando) timer.current = window.setInterval(atualizar, 4000)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [enviando, atualizar])

  async function enviar() {
    setMsg(null)
    try {
      setFase('leve')
      await iniciarLogado('exportarLeve', { acao: 'gerar', opcoes: { praticas: true, livro: true } })
      let pronto = false
      for (let i = 0; i < 150 && !pronto; i++) {
        await new Promise(r => window.setTimeout(r, 4000))
        const l = await chamarLogado<Leve>('exportarLeve', { acao: 'estado' })
        const u = l.ultimo
        if (u && u.estado === 'ERRO') throw new Error(u.erro || 'A exportação leve falhou.')
        if (u && u.estado === 'PRONTO') pronto = true
      }
      if (!pronto) throw new Error('A exportação leve demorou demais. Tente de novo.')
      setFase('git')
      const antes = (await chamarLogado<Estado>('exportarGit', { acao: 'estado' })).commit || ''
      await iniciarLogado('exportarGit', { acao: 'enviar' })
      let fim: Estado | null = null
      for (let i = 0; i < 90 && !fim; i++) {
        await new Promise(r => window.setTimeout(r, 3000))
        let e: Estado | null = null
        try { e = await chamarLogado<Estado>('exportarGit', { acao: 'estado' }) } catch { continue }
        if (e.estado === 'ERRO') throw new Error(e.erro || 'O envio falhou.')
        if (e.estado === 'PRONTO' && e.commit && e.commit !== antes) fim = e
      }
      if (!fim) throw new Error('O envio está demorando. Veja o estado abaixo em instantes.')
      setMsg({ t: `Enviado: ${fim.arquivos} arquivos.` })
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : 'Não foi possível enviar agora.', erro: true })
    } finally { setFase(''); atualizar() }
  }

  const rotulo = fase === 'leve' ? 'Preparando os arquivos…' : fase === 'git' || est?.estado === 'ENVIANDO' ? 'Enviando ao GitHub…' : 'Enviar tudo para o GitHub'
  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex flex-col gap-1">
        <p className="text-[13.5px] font-medium">Enviar tudo para o GitHub</p>
        <p className="text-[13px]" style={muted}>Gera a exportação leve na hora e grava num novo commit do repositório <b>{est?.repo || '-'}</b> (branch {est?.branch || 'main'}): código, funções, estrutura do banco, regras e prompts, tabelas pequenas de configuração, práticas e Livro Vivo. Sem transcrições, sem dados do dia a dia e sem chaves.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={enviando || est?.configurado === false} onClick={enviar}><GitBranch size={15} />{rotulo}</Button>
        {enviando && est?.etapa && <span className="text-[13px]" style={muted}>{est.etapa}</span>}
        {est?.repo && <a className="text-[13px] underline" href={'https://github.com/' + est.repo} target="_blank" rel="noreferrer">Abrir o repositório</a>}
        {est?.link && <a className="text-[13px] underline" href={est.link} target="_blank" rel="noreferrer">Ver o último commit</a>}
      </div>
      {est?.quando && est.estado === 'PRONTO' && <p className="text-[12.5px]" style={muted}>Último envio: {dh(est.quando)} · {est.arquivos} arquivos · commit {est.commit?.slice(0, 7)}</p>}
      {est?.estado === 'ERRO' && !msg && <p className="text-[12.5px]" style={{ color: 'var(--danger)' }}>O último envio falhou. Tente de novo.</p>}
      {msg && <p className="text-[12.5px]" style={{ color: msg.erro ? 'var(--danger)' : 'var(--success-text)' }}>{msg.t}</p>}
    </div>
  )
}
