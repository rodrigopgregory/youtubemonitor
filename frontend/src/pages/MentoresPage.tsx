import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Merge, Ban, Check, X, ExternalLink, Trash2 } from 'lucide-react'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import { linhas, chamar, linkYt, dataBr } from '../lib/api'

interface Mentor { ID: number; NOME: string; QTD: number }
interface Regra { ID: number; NOME: string; TIPO: 'MENTOR' | 'APELIDO' | 'NAO'; DESTINO: string | null }
interface Vid { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string; ORIGEM: string }
type Res = { ok: boolean; msg?: string; erro?: string }

export default function MentoresPage() {
  const [mentores, setMentores] = useState<Mentor[]>([])
  const [regras, setRegras] = useState<Regra[]>([])
  const [novo, setNovo] = useState('')
  const [marcar, setMarcar] = useState(true)
  const [naoNome, setNaoNome] = useState('')
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  const [nomeEd, setNomeEd] = useState('')
  const [juntando, setJuntando] = useState<Mentor | null>(null)
  const [destino, setDestino] = useState('')
  const [vendo, setVendo] = useState<Mentor | null>(null)
  const [vids, setVids] = useState<Vid[]>([])

  const carregar = useCallback(() => {
    linhas<Mentor>('mentoresGerir').then(setMentores)
    linhas<Regra>('mentorRegrasListar').then(setRegras)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function agir(input: Record<string, unknown>, depois?: () => void) {
    setSalvando(true); setMsg(null)
    try {
      const r = await chamar<Res>('mentorEditar', input)
      setMsg(r.ok ? { t: r.msg || 'Feito.' } : { t: r.erro || 'Não foi possível salvar.', erro: true })
      if (r.ok) { depois?.(); carregar() }
    } catch (e) { setMsg({ t: (e as Error).message, erro: true }) } finally { setSalvando(false) }
  }

  async function abrirVideos(m: Mentor) {
    setVendo(m); setVids([])
    setVids(await linhas<Vid>('mentorVideos', { temaId: m.ID }))
  }

  const apelidos = regras.filter(r => r.TIPO === 'APELIDO')
  const naoSao = regras.filter(r => r.TIPO === 'NAO')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Mentores</h1>
        <p className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>Cadastre, renomeie, junte ou tire mentores. O que você decidir aqui vira regra: os próximos vídeos estudados já seguem.</p>
      </div>

      <Card className="p-5 flex flex-col gap-3">
        <form onSubmit={e => { e.preventDefault(); agir({ acao: 'criar', nome: novo, marcarTitulos: marcar }, () => setNovo('')) }} className="flex flex-col sm:flex-row gap-2">
          <input className="controle flex-1" placeholder="Nome do novo mentor, ex.: Vovó Cambinda" value={novo} onChange={e => setNovo(e.target.value)} />
          <Button variant="primary" type="submit" disabled={salvando || novo.trim().length < 2}><Plus size={15} />Cadastrar mentor</Button>
        </form>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--fg-muted)' }}>
          <input type="checkbox" checked={marcar} onChange={e => setMarcar(e.target.checked)} />
          Já marcar nos vídeos estudados que têm o nome dele no título
        </label>
        {msg && <p className="text-[13.5px]" style={{ color: msg.erro ? 'var(--danger)' : 'var(--success-text)' }}>{msg.t}</p>}
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-[13.5px]">
          <thead><tr style={{ color: 'var(--fg-muted)' }}>
            <th className="text-left font-medium px-4 py-2.5">Mentor</th>
            <th className="text-right font-medium px-4 py-2.5">Vídeos</th>
            <th className="text-right font-medium px-4 py-2.5">Ações</th>
          </tr></thead>
          <tbody>
            {mentores.map(m => (
              <tr key={m.ID} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-2">
                  {editando === m.ID ? (
                    <form className="flex gap-1.5 items-center" onSubmit={e => { e.preventDefault(); agir({ acao: 'renomear', temaId: m.ID, novo: nomeEd }, () => setEditando(null)) }}>
                      <input className="controle h-8" value={nomeEd} onChange={e => setNomeEd(e.target.value)} autoFocus />
                      <Button size="sm" variant="primary" type="submit" disabled={salvando}><Check size={14} /></Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => setEditando(null)}><X size={14} /></Button>
                    </form>
                  ) : <button className="font-medium hover:underline text-left" onClick={() => abrirVideos(m)}>{m.NOME}</button>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{m.QTD}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" title="Renomear" onClick={() => { setEditando(m.ID); setNomeEd(m.NOME) }}><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" title="Juntar com outro (é o mesmo mentor)" onClick={() => { setJuntando(m); setDestino('') }}><Merge size={14} /></Button>
                    <Button size="sm" variant="ghost" title="Não é mentor" disabled={salvando} onClick={() => { if (confirm(`Tirar "${m.NOME}" dos mentores? Sai de ${m.QTD} vídeo(s) e não volta nos próximos estudos.`)) agir({ acao: 'naoMentor', temaId: m.ID }) }}><Ban size={14} /></Button>
                  </div>
                </td>
              </tr>))}
            {mentores.length === 0 && <tr><td colSpan={3} className="px-4 py-6" style={{ color: 'var(--fg-muted)' }}>Carregando…</td></tr>}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-5 flex flex-col gap-2">
          <h2 className="text-[15px] font-medium">Outros jeitos de escrever</h2>
          <p className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Quando o estudo achar o nome da esquerda, marca o mentor da direita.</p>
          {apelidos.map(r => (
            <div key={r.ID} className="flex items-center gap-2 text-[13.5px]">
              <span>{r.NOME}</span><span style={{ color: 'var(--fg-subtle)' }}>→</span><Badge variant="accent">{r.DESTINO}</Badge>
              <button className="ml-auto" title="Apagar regra" style={{ color: 'var(--fg-muted)' }} onClick={() => agir({ acao: 'apagarRegra', id: r.ID })}><Trash2 size={14} /></button>
            </div>))}
          {apelidos.length === 0 && <p className="text-[13px]" style={{ color: 'var(--fg-subtle)' }}>Nenhum.</p>}
        </Card>
        <Card className="p-5 flex flex-col gap-2">
          <h2 className="text-[15px] font-medium">Não são mentores</h2>
          <p className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>Médiuns, pessoas e nomes só citados. O estudo nunca marca estes.</p>
          <div className="flex flex-wrap gap-1.5">
            {naoSao.map(r => (
              <span key={r.ID} className="inline-flex items-center gap-1"><Badge variant="neutral">{r.NOME}</Badge>
                <button title="Apagar regra" style={{ color: 'var(--fg-muted)' }} onClick={() => agir({ acao: 'apagarRegra', id: r.ID })}><X size={12} /></button></span>))}
          </div>
          <form className="flex gap-1.5 mt-1" onSubmit={e => { e.preventDefault(); agir({ acao: 'naoMentorNome', nome: naoNome }, () => setNaoNome('')) }}>
            <input className="controle h-8 flex-1" placeholder="Acrescentar nome" value={naoNome} onChange={e => setNaoNome(e.target.value)} />
            <Button size="sm" variant="secondary" type="submit" disabled={salvando || naoNome.trim().length < 2}><Plus size={14} />Acrescentar</Button>
          </form>
        </Card>
      </div>

      {juntando && (
        <Modal isOpen onClose={() => setJuntando(null)} title={`Juntar "${juntando.NOME}"`} size="md">
          <div className="p-5 flex flex-col gap-3">
            <p className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>Os {juntando.QTD} vídeo(s) de "{juntando.NOME}" passam para o mentor escolhido, e esse nome vira outro jeito de escrever o mesmo mentor.</p>
            <Select placeholder="Escolha o mentor certo" value={destino} onChange={setDestino} searchThreshold={0}
              options={mentores.filter(m => m.ID !== juntando.ID).map(m => ({ value: String(m.ID), label: `${m.NOME} (${m.QTD})` }))} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setJuntando(null)}>Cancelar</Button>
              <Button variant="primary" disabled={!destino || salvando} onClick={() => agir({ acao: 'juntar', temaId: juntando.ID, destinoId: Number(destino) }, () => setJuntando(null))}><Merge size={15} />Juntar</Button>
            </div>
          </div>
        </Modal>
      )}

      {vendo && (
        <Modal isOpen onClose={() => setVendo(null)} title={`Vídeos de ${vendo.NOME}`} size="lg">
          <div className="p-5 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
            {vids.length === 0 && <p className="text-[13.5px]" style={{ color: 'var(--fg-muted)' }}>Carregando…</p>}
            {vids.map(v => (
              <a key={v.ID} href={linkYt(v.YT_VIDEO_ID)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13.5px] hover:underline">
                <span className="w-20 shrink-0 tabular-nums" style={{ color: 'var(--fg-muted)' }}>{dataBr(v.PUBLICADO_EM)}</span>
                <span className="flex-1">{v.TITULO}</span><ExternalLink size={12} />
              </a>))}
          </div>
        </Modal>
      )}
    </div>
  )
}
