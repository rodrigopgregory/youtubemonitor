import { nomeEt } from '../lib/etiquetas'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayCircle, Trash2, Pencil } from 'lucide-react'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import FizHoje, { humorDe } from '../components/FizHoje'
import type { RegistroEd } from '../components/FizHoje'
import Contador from '../components/Contador'
import FavoritaPratica from '../components/FavoritaPratica'
import PraticaDetalhe from '../components/PraticaDetalhe'
import { chamar, linhas, linkYt, mmss, dataBr } from '../lib/api'

interface Feita { FAVORITA?: number | boolean; ID: number; TIPO: string; JEITO?: string | null; TITULO: string; INSTRUCAO: string; SEGUNDO: number | null; VIDEO_ID: number; YT_VIDEO_ID: string; VIDEO: string; CANAL: string; VEZES: number; ULTIMA: string; HUMOR: number | null }
interface Registro { ID: number; PRATICA_ID: number; DIA: string; HUMOR: number | null; SENTIU: string | null; TIPO: string; JEITO?: string | null; TITULO: string; SEGUNDO: number | null; YT_VIDEO_ID: string; CANAL: string }
interface Resumo { VEZES: number; PRATICAS: number; DIAS: number; SEMANA: number; HUMOR: number | null }
const PAG = 500

export default function MinhasPraticasPage() {
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [feitas, setFeitas] = useState<Feita[]>([])
  const [registros, setRegistros] = useState<Registro[]>([])
  const [fim, setFim] = useState(true)
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<'diario' | 'praticas' | 'favoritas'>('diario')
  const [favoritas, setFavoritas] = useState<Feita[]>([])
  const [aberta, setAberta] = useState<number | null>(null)
  const [editando, setEditando] = useState<(RegistroEd & { TITULO: string; PRATICA_ID: number }) | null>(null)
  const [apagando, setApagando] = useState<number | null>(null)
  const [cat, setCat] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [r, f, d, fv] = await Promise.all([linhas<Resumo>('diarioResumo'), linhas<Feita>('diarioPraticas'), linhas<Registro>('diarioListar', { praticaId: 0, limit: PAG, offset: 0 }), linhas<Feita>('praticasFavoritas')])
      setResumo(r[0] || null); setFeitas(f); setFavoritas(fv); setRegistros(d); setFim(d.length < PAG)
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
  const vazio = !carregando && !Number(resumo?.VEZES || 0) && favoritas.length === 0
  const aspas = (on: boolean) => on ? { background: 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'var(--accent)' } : { borderColor: 'var(--border)', color: 'var(--fg-muted)' }
  const h = humorDe(resumo?.HUMOR)
  const chave = (x: { JEITO?: string | null; TIPO: string }) => x.JEITO || x.TIPO
  const rotulo = (k: string) => nomeEt(k) || k
  const porCat = new Map<string, { vezes: number; praticas: number }>()
  for (const p of feitas) { const k = chave(p); const c = porCat.get(k) || { vezes: 0, praticas: 0 }; c.vezes += Number(p.VEZES); c.praticas += 1; porCat.set(k, c) }
  const cats = [...porCat.entries()].sort((a, b) => b[1].vezes - a[1].vezes)
  const okCat = (x: { JEITO?: string | null; TIPO: string }) => !cat || chave(x) === cat
  const registrosV = registros.filter(okCat)
  const feitasV = feitas.filter(okCat)
  const favoritasV = favoritas.filter(okCat)
  const totalVezes = Number(resumo?.VEZES || 0)

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
        {resumo && Number(resumo.VEZES) > 0 && (
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
          <button onClick={() => setAba('favoritas')} className="h-8 px-3 rounded-full border text-[13px] font-medium" style={aspas(aba === 'favoritas')}>Favoritas{favoritas.length ? ' ' + favoritas.length : ''}</button>
        </div>

        {cats.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setCat('')} className="h-8 px-3 rounded-full border text-[13px] font-medium" style={aspas(!cat)}>Todas</button>
              {cats.map(([k, c]) => <button key={k} onClick={() => setCat(cat === k ? '' : k)} className="h-8 px-3 rounded-full border text-[13px] font-medium" style={aspas(cat === k)}>{rotulo(k)} · {c.vezes}</button>)}
            </div>
            <div className="flex flex-col gap-1.5">
              {cats.map(([k, c]) => (
                <div key={k} className="flex items-center gap-2 text-[12.5px]" style={muted}>
                  <span className="w-32 shrink-0 truncate">{rotulo(k)}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}><div className="h-full rounded-full" style={{ background: 'var(--accent)', width: (totalVezes ? Math.round(c.vezes / totalVezes * 100) : 0) + '%' }} /></div>
                  <span className="w-28 shrink-0 text-right">{c.vezes} {c.vezes === 1 ? 'vez' : 'vezes'} · {c.praticas} {c.praticas === 1 ? 'prática' : 'práticas'}</span>
                </div>))}
            </div>
          </div>
        )}

        {aba === 'diario' && (
          <div className="flex flex-col gap-3">
            {registrosV.map(r => {
              const hm = humorDe(r.HUMOR)
              return (
                <Card key={r.ID} className="p-4 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-[12.5px] font-medium" style={{ color: 'var(--accent-text)' }}>{dataBr(r.DIA)}</span>
                      <button onClick={() => setAberta(r.PRATICA_ID)} className="text-[14.5px] font-medium first-letter:uppercase text-left hover:underline" title="Abrir a prática">{r.TITULO}</button>
                      <Badge variant="success">{nomeEt(r.JEITO) || r.TIPO}</Badge>
                    </div>
                    <span className="flex shrink-0">
                    <button onClick={() => setEditando(r)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg" style={{ color: 'var(--fg-subtle)' }} aria-label="Editar este registro" title="Editar este registro"><Pencil size={15} /></button>
                    <button onClick={() => apagar(r.ID)} disabled={apagando === r.ID} className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg" style={{ color: 'var(--fg-subtle)' }} aria-label="Apagar este registro" title="Apagar este registro"><Trash2 size={15} /></button>
                    </span>
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
            {feitasV.map(p => {
              const hm = humorDe(p.HUMOR)
              return (
                <Card key={p.ID} className="p-4 flex flex-col gap-2">
                  <div className="flex items-start gap-2 flex-wrap"><button onClick={() => setAberta(p.ID)} className="text-[15px] font-medium first-letter:uppercase text-left hover:underline" title="Abrir a prática">{p.TITULO}</button><Badge variant="success">{nomeEt(p.JEITO) || p.TIPO}</Badge><span className="ml-auto"><FavoritaPratica id={p.ID} favorita={!!Number(p.FAVORITA)} onMudou={() => carregar()} /></span></div>
                  {hm && <span className="text-[13px]" style={muted}>Em média: {hm.emoji} {hm.nome}</span>}
                  <p className="text-[13.5px] leading-relaxed line-clamp-3" style={muted}>{p.INSTRUCAO}</p>
                  <div className="flex items-center gap-3 flex-wrap text-[12.5px]">
                    <span className="truncate max-w-full" style={muted}>{p.CANAL} · {p.VIDEO}</span>
                    <a href={linkYt(p.YT_VIDEO_ID, p.SEGUNDO || 0)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--accent-text)' }}><PlayCircle size={14} />Assistir{p.SEGUNDO ? ' em ' + mmss(p.SEGUNDO) : ''}</a>
                  </div>
                  <Contador pratica={p} vezes={Number(p.VEZES)} ultima={p.ULTIMA} onMudou={() => carregar()} />
                </Card>)
            })}
          </div>
        )}
        {aba === 'favoritas' && (
          <div className="flex flex-col gap-3">
            {favoritasV.length === 0 && <Card className="p-6"><p className="text-[14px]" style={muted}>{cat ? 'Nenhuma favorita nesta categoria.' : 'Nenhuma favorita ainda. Na tela Práticas, toque na estrela de uma prática.'}</p></Card>}
            {favoritasV.map(p => (
              <Card key={p.ID} className="p-4 flex flex-col gap-2">
                <div className="flex items-start gap-2 flex-wrap"><button onClick={() => setAberta(p.ID)} className="text-[15px] font-medium first-letter:uppercase text-left hover:underline" title="Abrir a prática">{p.TITULO}</button><Badge variant="success">{nomeEt(p.JEITO) || p.TIPO}</Badge><span className="ml-auto"><FavoritaPratica id={p.ID} favorita onMudou={() => carregar()} /></span></div>
                <p className="text-[13.5px] leading-relaxed line-clamp-3" style={muted}>{p.INSTRUCAO}</p>
                <Contador pratica={p} vezes={Number(p.VEZES)} ultima={p.ULTIMA} onMudou={() => carregar()} />
              </Card>))}
          </div>
        )}
      </>)}
      {aberta && <PraticaDetalhe id={aberta} onClose={() => setAberta(null)} onMudou={() => carregar()} />}
      {editando && <FizHoje pratica={{ ID: editando.PRATICA_ID, TITULO: editando.TITULO }} registro={editando} onClose={() => setEditando(null)} onSalvo={() => carregar()} />}
    </div>
  )
}
