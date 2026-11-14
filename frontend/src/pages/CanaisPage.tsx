import { useCallback, useEffect, useState } from 'react'
import { Plus, ExternalLink, Download, Package, RefreshCw } from 'lucide-react'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { useNavigate } from 'react-router-dom'
import { linhas, chamar, dataBr } from '../lib/api'
import { useCanal } from '../components/CanalFiltro'
import { exportarTemas, exportarTranscricoes, exportarTudo } from '../lib/exportar'

interface Canal { ID: number; NOME: string; HANDLE: string; URL: string; THUMB: string; CARGA_STATUS: string; CARGA_MSG: string; ULTIMA_CHECAGEM: string | null; CRIADO_EM: string; ESTUDADOS: number; FILA: number; PENDENTES: number; SEM_LEGENDA: number; TOTAL: number }

const st: Record<string, { l: string; v: 'success' | 'info' | 'neutral' }> = {
  LISTANDO: { l: 'Levantando vídeos', v: 'neutral' }, ESTUDANDO: { l: 'Estudando o acervo', v: 'info' }, EM_DIA: { l: 'Em dia', v: 'success' },
}

export default function CanaisPage() {
  const [canais, setCanais] = useState<Canal[]>([])
  const [url, setUrl] = useState('')
  const [msg, setMsg] = useState<{ t: string; erro: boolean } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [, setCanalId] = useCanal()
  const navegar = useNavigate()
  const [exportando, setExportando] = useState<string | null>(null)
  const [exportMsg, setExportMsg] = useState<{ id: number; msg: string } | null>(null)
  const [pacote, setPacote] = useState<{ rodando: boolean; msg: string } | null>(null)
  async function baixarTudo() {
    setPacote({ rodando: true, msg: 'Começando…' })
    try {
      const r = await exportarTudo(m => setPacote({ rodando: true, msg: m }))
      setPacote({ rodando: false, msg: `Pacote baixado: ${r.videos.toLocaleString('pt-BR')} vídeos, ${r.trechos.toLocaleString('pt-BR')} trechos de transcrição, o código do app e a estrutura do banco.` })
    } catch { setPacote({ rodando: false, msg: 'Não foi possível montar o pacote agora. Tente de novo em instantes.' }) }
  }
  const exportar = async (id: number, tipo: string, fazer: () => Promise<string>) => {
    setExportando(id + tipo)
    try { setExportMsg({ id, msg: await fazer() }) }
    catch { setExportMsg({ id, msg: 'Não foi possível exportar agora. Tente de novo em instantes.' }) }
    finally { setExportando(null) }
  }

  const [busca, setBusca] = useState<{ rodando: boolean; msg: string; erro?: boolean } | null>(null)
  async function buscarNovos() {
    setBusca({ rodando: true, msg: 'Procurando vídeos novos nos canais…' })
    try {
      const r = await chamar<{ ok: boolean; novos?: number; canais?: { nome: string; novos: number; msg?: string }[]; erro?: string }>('canaisAtualizar')
      if (!r?.ok) { setBusca({ rodando: false, msg: r?.erro || 'Não foi possível procurar agora. Tente de novo em instantes.', erro: true }); return }
      const det = (r.canais || []).filter(c => c.novos > 0 || c.msg).map(c => c.msg ? `${c.nome}: ${c.msg}` : `${c.nome}: ${c.novos}`).join(' · ')
      setBusca({ rodando: false, msg: r.novos ? `${r.novos} ${r.novos === 1 ? 'vídeo novo entrou' : 'vídeos novos entraram'} na fila de estudo. ${det}` : `Nenhum vídeo novo nos canais.${det ? ' ' + det : ''}` })
      carregar()
    } catch (er) { setBusca({ rodando: false, msg: (er as Error).message, erro: true }) }
  }
  const carregar = useCallback(() => { linhas<Canal>('canaisListar').then(setCanais) }, [])
  useEffect(() => { carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t) }, [carregar])

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault(); if (!url.trim()) return
    setSalvando(true); setMsg(null)
    try {
      const r = await chamar<{ ok: boolean; nome?: string; erro?: string }>('canalCadastrar', { url })
      if (r.ok) { setMsg({ t: `Canal "${r.nome}" cadastrado. O levantamento dos vídeos já começou.`, erro: false }); setUrl(''); carregar() }
      else setMsg({ t: r.erro || 'Não foi possível cadastrar.', erro: true })
    } catch (er) { setMsg({ t: (er as Error).message, erro: true }) } finally { setSalvando(false) }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1">
        <h1 className="text-[22px] font-semibold">Canais monitorados</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--fg-muted)' }}>Cada canal novo tem o acervo estudado, e todo dia o sistema confere se há vídeos novos. Entram vídeos e lives gravadas com mais de 10 minutos.</p>
      </div>
        <div className="flex flex-col sm:items-end gap-1 sm:max-w-[320px]">
          <Button variant="primary" disabled={!!busca?.rodando} onClick={buscarNovos} title="Procura agora, em todos os canais, vídeos novos publicados desde a última conferência">
            <RefreshCw size={15} className={busca?.rodando ? 'animate-spin' : ''} />{busca?.rodando ? 'Procurando…' : 'Atualizar canais'}
          </Button>
          {busca && <p className="text-[12.5px] sm:text-right" style={{ color: busca.erro ? 'var(--danger-text, var(--warning-text))' : 'var(--fg-muted)' }}>{busca.msg}</p>}
          <Button variant="secondary" disabled={!!pacote?.rodando} onClick={baixarTudo} title="Baixa um ZIP com o código do app, a estrutura do banco e todos os dados, para levar o sistema para outra plataforma ou IA">
            <Package size={15} />{pacote?.rodando ? 'Montando o pacote…' : 'Exportar tudo (app + banco)'}
          </Button>
          {pacote && <p className="text-[12.5px] sm:text-right" style={{ color: 'var(--fg-muted)' }}>{pacote.msg}</p>}
        </div>
      </div>
      <Card className="p-5">
        <form onSubmit={cadastrar} className="flex flex-col sm:flex-row gap-2">
          <input className="controle flex-1" placeholder="Cole o link do canal, ex.: https://www.youtube.com/@NomeDoCanal" value={url} onChange={e => setUrl(e.target.value)} />
          <Button variant="primary" type="submit" disabled={salvando || !url.trim()}><Plus size={15} />{salvando ? 'Cadastrando…' : 'Cadastrar canal'}</Button>
        </form>
        {msg && <p className="text-[13.5px] mt-2" style={{ color: msg.erro ? 'var(--danger)' : 'var(--success-text)' }}>{msg.t}</p>}
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {canais.map(c => {
          const s = st[c.CARGA_STATUS] || { l: c.CARGA_STATUS, v: 'neutral' as const }
          const tot = Number(c.TOTAL || 0), est = Number(c.ESTUDADOS || 0)
          return (
            <Card key={c.ID} className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {c.THUMB && <img src={c.THUMB} alt="" className="w-11 h-11 rounded-full object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium truncate">{c.NOME}</div>
                  <a href={c.URL} target="_blank" rel="noreferrer" className="text-[12.5px] inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--fg-muted)' }}>{c.HANDLE || c.URL}<ExternalLink size={11} /></a>
                </div>
                <Badge variant={s.v} dot>{s.l}</Badge>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
                <div className="h-full rounded-full" style={{ width: tot ? `${Math.round(est / tot * 100)}%` : '0%', background: 'var(--accent)' }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]" style={{ color: 'var(--fg-muted)' }}>
                <span><b style={{ color: 'var(--fg)' }}>{est}</b> de {tot} estudados</span>
                {Number(c.FILA) - Number(c.SEM_LEGENDA || 0) > 0 && <span>{Number(c.FILA) - Number(c.SEM_LEGENDA || 0)} com legenda na fila</span>}
                {Number(c.SEM_LEGENDA) > 0 && <span>{c.SEM_LEGENDA} sem legenda aguardando</span>}
                {Number(c.PENDENTES) > 0 && <span style={{ color: 'var(--warning-text)' }}>{c.PENDENTES} pendentes</span>}
                <span>Última checagem: {c.ULTIMA_CHECAGEM ? dataBr(c.ULTIMA_CHECAGEM) + ' ' + c.ULTIMA_CHECAGEM.slice(11, 16) : 'ainda não'}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setCanalId(c.ID); navegar('/videos') }}>Ver vídeos do canal</Button>
                <Button size="sm" variant="ghost" onClick={() => { setCanalId(c.ID); navegar('/') }}>Perguntar sobre este canal</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" disabled={!!exportando || !est} onClick={() => exportar(c.ID, 'temas', () => exportarTemas(c.ID, c.NOME, m => setExportMsg({ id: c.ID, msg: m })).then(n => `Planilha baixada com ${n} vídeos.`))}><Download size={14} />Exportar temas (planilha)</Button>
                <Button size="sm" variant="ghost" disabled={!!exportando || !est} onClick={() => exportar(c.ID, 'zip', () => exportarTranscricoes(c.ID, c.NOME, m => setExportMsg({ id: c.ID, msg: m })).then(r => `ZIP baixado com ${r.videos} transcrições.`))}><Download size={14} />Exportar transcrições (ZIP)</Button>
              </div>
              {exportMsg && exportMsg.id === c.ID && <p className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>{exportMsg.msg}</p>}
              {Number(c.SEM_LEGENDA) > 0 && Number(c.FILA) === Number(c.SEM_LEGENDA) && <p className="text-[12.5px]" style={{ color: 'var(--warning-text)' }}>Todos os vídeos com legenda já foram estudados. Os {c.SEM_LEGENDA} sem legenda estão aguardando.</p>}
              {c.CARGA_STATUS === 'LISTANDO' && c.CARGA_MSG && <p className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{c.CARGA_MSG}</p>}
            </Card>)
        })}
        {canais.length === 0 && <Card className="p-6"><p className="text-[14px]" style={{ color: 'var(--fg-muted)' }}>Nenhum canal cadastrado ainda.</p></Card>}
      </div>
    </div>
  )
}
