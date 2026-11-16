import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, PlayCircle, Trash2, Plus } from 'lucide-react'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import FizHoje, { humorDe } from '../components/FizHoje'
import { chamar, linhas, linkYt, mmss, dataBr } from '../lib/api'

interface Feita { ID: number; TIPO: string; TITULO: string; INSTRUCAO: string; SEGUNDO: number | null; VIDEO_ID: number; YT_VIDEO_ID: string; VIDEO: string; CANAL: string; VEZES: number; ULTIMA: string; HUMOR: number | null }
interface Registro { ID: number; PRATICA_ID: number; DIA: string; HUMOR: number | null; SENTIU: string | null; TIPO: string; TITULO: string; SEGUNDO: number | null; YT_VIDEO_ID: string; CANAL: string }
interface Resumo { VEZES: number; PRATICAS: number; DIAS: number; SEMANA: number; HUMOR: number | null }
const PAG = 30

export default function MinhasPraticasPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [feitas, setFeitas] = useState<Feita[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [fim, setFim] = useState(true)
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'diario' | 'praticas'>('diario')
  const [fazendo, setFazendo] = useState<Feita | null>(null)
  const [apagando, setApagando] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [r, f, d] = await Promise.all([linhas<Resumo>('diarioResumo'), linhas<Feita>('diarioPraticas'), linhas<Registro>('diarioListar', { praticaId: 0, limit: PAG, offset: 0 })])
      setResumo(r[0] || null); setFeitas(f); setRegistros(d); setFim(d.length < PAG)
    } finally { setCarregando(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function verMais() {
    const d = await linhas<Registro>('diarioListar', { praticaId: 0, limit: PAG, offset: registros.length })
    setRegistros(x => [...x, ...d]); setFim(d.length < PAG)
  }
  async function apagar(id: number) {
    setApagando(id)
    try { await chamar('diarioEditar', { acao: 'apagar', id }); await carregar() } finally { setApagando(null) }
  }

  const muted = { color: 'var(--fg-muted)' }
  const vazio = !carregando && !Number(resumo?.VEZES || 0)
  const aspas = (on: boolean) => on ? { background: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }
  const h = humorDe(resumo?.HUMOR)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Minhas práticas</h1>
        <p className="text-[14px] mt-1" style={muted}>O que você já fez e como se sentiu depois.</p>
      </div>

      {vazio ? (
        <Card className="p-6 flex flex-col gap-3 items-start">
          <p className="text-[14px]" style={muted}>Você ainda não marcou nenhuma prática. Na tela Práticas, abra uma e toque em "Fiz hoje".</p>
          <Link to="/praticas"><Button size="sm">Ir para Práticas</Button></Link>
        </Card>
      ) : (<>
        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Vezes que pratiquei', Number(resumo.VEZES)], ['Nos últimos 7 dias', Number(resumo.SEMANA || 0)], ['Práticas diferentes', Number(resumo.PRATICAS)], ['Como fiquei, em média', h ? h.emoji + ' ' + h.nome : '—']].map(([r, v]) => (
              <Card key={String(r)} className="p-3 flex flex-col gap-1">
                <span className="text-[12.5px]" style={muted}>{r}</span>
                <span className="text-[18px] font-semibold">{typeof v === 'number' ? v.toLocaleString('pt-BR') : v}</span>
              </Card>))}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setAba('diario')} className="h-8 px-3 rounded-full border text-[13px] font-medium" style={aspas(aba === 'diario')}>Diário</button>
          <button onClick={() => setAba('praticas')} className="h-8 px-3 rounded-full border text-[13px] font-medium" style={aspas(aba === 'praticas')}>Por prática</button>
        </div>

        {aba === 'diario' && (
          <div className="flex flex-col gap-3">
            {registros.map(r => {
              const hm = humorDe(r.HUMOR)
              return (
                <Card key={r.ID} className="p-4 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-[12.5px] font-medium" style={{ color: 'var(--accent-text)' }}>{dataBr(r.DIA)}</span>
                      <span className="text-[14.5px] font-medium first-letter:uppercase">{r.TITULO}</span>
                      <Badge variant="success">{r.TIPO}</Badge>
                    </div>
                    <button onClick={() => apagar(r.ID)} disabled={apagando === r.ID} className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg" style={{ color: 'var(--fg-subtle)' }} aria-label="Apagar este registro" title="Apagar este registro"><Trash2 size={15} /></button>
                  </div>
                  {hm && <span className="text-[13.5px]">{hm.emoji} {hm.nome}</span>}
                  {r.SENTIU && <p className="text-[13.5px] leading-relaxed whitespace-pre-line" style={muted}>{r.SENTIU}</p>}
                </Card>)
            })}
            {!fim && <Button variant="secondary" onClick={verMais}>Ver mais</Button>}
          </div>
        )}

        {aba === 'praticas' && (
          <div className="flex flex-col gap-3">
            {feitas.map(p => {
              const hm = humorDe(p.HUMOR)
              return (
                <Card key={p.ID} className="p-4 flex flex-col gap-2">
                  <div className="flex items-start gap-2 flex-wrap"><span className="text-[15px] font-medium first-letter:uppercase">{p.TITULO}</span><Badge variant="success">{p.TIPO}</Badge></div>
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[13px]" style={muted}>
                    <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} style={{ color: 'var(--success)' }} />{Number(p.VEZES)} {Number(p.VEZES) === 1 ? 'vez' : 'vezes'}</span>
                    <span>Última: {dataBr(p.ULTIMA)}</span>
                    {hm && <span>Em média: {hm.emoji} {hm.nome}</span>}
                  </div>
                  <p className="text-[13.5px] leading-relaxed line-clamp-3" style={muted}>{p.INSTRUCAO}</p>
                  <div className="flex items-center gap-3 flex-wrap text-[12.5px]">
                    <span className="truncate max-w-full" style={muted}>{p.CANAL} · {p.VIDEO}</span>
                    <a href={linkYt(p.YT_VIDEO_ID, p.SEGUNDO || 0)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--accent-text)' }}><PlayCircle size={14} />Assistir{p.SEGUNDO ? ' em ' + mmss(p.SEGUNDO) : ''}</a>
                  </div>
                  <div><Button size="sm" variant="secondary" onClick={() => setFazendo(p)}><Plus size={14} />Fiz de novo</Button></div>
                </Card>)
            })}
          </div>
        )}
      </>)}
      {fazendo && <FizHoje pratica={fazendo} onClose={() => setFazendo(null)} onSalvo={carregar} />}
    </div>
  )
}
