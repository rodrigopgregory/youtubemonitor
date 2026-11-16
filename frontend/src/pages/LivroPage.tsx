import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, RefreshCw, Sparkles, ExternalLink, Search } from 'lucide-react'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { linhas, chamarDemorado, linkYt, dataBr, mmss } from '../lib/api'

interface Tema { ID: number; NOME: string; QTD: number; CANAIS: number; GERADO_EM: string | null }
interface Fonte { video: string; canal: string; yt: string; seg: number }
interface Pratica { grupo: string; titulo: string; quando: string; passos: string; fontes: Fonte[] }
interface Capitulo { TEMA_ID: number; TEMA: string; TEXTO: string; PRATICAS_JSON: string; VIDEOS: number; GERADO_EM: string }

const GRUPOS = ['Técnicas de energia e consciência', 'Autoconhecimento e conduta', 'Preces e orações', 'Ervas, banhos, velas e rituais', 'Receitas e saúde', 'Outras']
const muted = { color: 'var(--fg-muted)' }

function Texto({ txt }: { txt: string }) {
  const blocos = txt.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  return (
    <div className="flex flex-col gap-3 text-[14.5px] leading-relaxed">
      {blocos.flatMap((b, i) => b.split('\n').map((l, k) => l.startsWith('## ')
        ? <h3 key={i + '-' + k} className="text-[16px] font-semibold pt-2">{l.slice(3)}</h3>
        : l.trim() ? <p key={i + '-' + k}>{l.replace(/\*\*/g, '')}</p> : null))}
    </div>
  )
}

export default function LivroPage() {
  const [temas, setTemas] = useState<Tema[]>([])
  const [filtro, setFiltro] = useState('')
  const [atual, setAtual] = useState<number | null>(null)
  const [cap, setCap] = useState<Capitulo | null>(null)
  const [aba, setAba] = useState<'texto' | 'praticas'>('texto')
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')

  const carregarTemas = useCallback(() => linhas<Tema>('livroTemas').then(setTemas), [])
  useEffect(() => { carregarTemas() }, [carregarTemas])

  const abrir = useCallback(async (id: number) => {
    setAtual(id); setErro(''); setCap(null); setAba('texto')
    const r = await linhas<Capitulo>('livroCapitulo', { temaId: id })
    setCap(r[0] ?? null)
  }, [])

  useEffect(() => { if (atual === null && temas.length) abrir((temas.find(t => t.GERADO_EM) ?? temas[0]).ID) }, [temas, atual, abrir])

  async function escrever() {
    if (!atual) return
    setGerando(true); setErro('')
    try {
      const r = await chamarDemorado<{ ok: boolean; erro?: string }>('livroGerar', { temaId: atual }, 280)
      if (!r?.ok) setErro(r?.erro || 'Não consegui escrever o capítulo agora.')
      await abrir(atual); carregarTemas()
    } catch (e) { setErro((e as Error).message) } finally { setGerando(false) }
  }

  const praticas = useMemo<Pratica[]>(() => { try { return JSON.parse(cap?.PRATICAS_JSON || '[]') } catch { return [] } }, [cap])
  const lista = temas.filter(t => !filtro || t.NOME.toLowerCase().includes(filtro.toLowerCase()))
  const tema = temas.find(t => t.ID === atual)
  const prontos = temas.filter(t => t.GERADO_EM).length

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold flex items-center gap-2"><BookOpen size={22} />Livro Vivo</h1>
        <p className="text-[13.5px]" style={muted}>Os ensinamentos dos canais reunidos por tema. {prontos} de {temas.length} capítulos escritos.{prontos < temas.length ? ' Toda madrugada escrevo até 2 novos sozinho, quando sobra cota da IA.' : ''}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <Card className="p-2 flex flex-col gap-1 md:max-h-[75vh] overflow-y-auto">
          <div className="relative p-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={muted} />
            <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Procurar tema" className="w-full h-9 pl-8 pr-2 rounded-md text-[13.5px] border" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--fg)' }} />
          </div>
          {lista.map(t => (
            <button key={t.ID} onClick={() => abrir(t.ID)} className="w-full text-left px-2 py-1.5 rounded-md text-[13.5px] flex items-center gap-2"
              style={t.ID === atual ? { background: 'var(--accent-soft)', color: 'var(--accent-text)' } : {}}>
              <span className="flex-1 truncate" style={t.GERADO_EM ? {} : muted}>{t.NOME}</span>
              <span className="text-[12px]" style={{ color: 'var(--fg-subtle)' }}>{t.QTD}</span>
            </button>
          ))}
        </Card>
        <Card className="p-5 flex flex-col gap-4 min-w-0">
          {tema && (
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex-1">
                <h2 className="text-[19px] font-semibold first-letter:uppercase">{tema.NOME}</h2>
                <p className="text-[12.5px]" style={muted}>{tema.QTD.toLocaleString('pt-BR')} vídeos estudados{cap ? ' · escrito em ' + dataBr(cap.GERADO_EM) : ''}</p>
              </div>
              <Button variant={cap ? 'secondary' : 'primary'} disabled={gerando} onClick={escrever}>
                {cap ? <RefreshCw size={15} className={gerando ? 'animate-spin' : ''} /> : <Sparkles size={15} />}
                {gerando ? 'Escrevendo… (até 1 min)' : cap ? 'Reescrever com os vídeos novos' : 'Escrever este capítulo'}
              </Button>
            </div>
          )}
          {erro && <p className="text-[13px]" style={{ color: 'var(--danger)' }}>{erro}</p>}
          {!cap && tema && !gerando && <p className="text-[14px]" style={muted}>Este capítulo ainda não foi escrito. Clique em "Escrever este capítulo".</p>}
          {cap && (
            <>
              <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
                {([['texto', 'Ensinamentos'], ['praticas', `Práticas (${praticas.length})`]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setAba(k)} className="h-9 px-3 text-[13.5px] font-medium -mb-px border-b-2"
                    style={aba === k ? { borderColor: 'var(--accent)', color: 'var(--accent-text)' } : { borderColor: 'transparent', color: 'var(--fg-muted)' }}>{l}</button>
                ))}
              </div>
              {aba === 'texto' && <Texto txt={cap.TEXTO} />}
              {aba === 'praticas' && (praticas.length === 0
                ? <p className="text-[14px]" style={muted}>Nenhuma prática ensinada nos vídeos deste tema.</p>
                : GRUPOS.map(g => {
                  const itens = praticas.filter(p => p.grupo === g)
                  if (!itens.length) return null
                  return (
                    <div key={g} className="flex flex-col gap-2">
                      <div className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>{g}</div>
                      {itens.map((p, i) => (
                        <div key={i} className="rounded-lg border p-3 flex flex-col gap-1.5" style={{ borderColor: 'var(--border)' }}>
                          <div className="text-[14.5px] font-semibold">{p.titulo}</div>
                          {p.quando && <div className="text-[13px]" style={muted}>{p.quando}</div>}
                          <p className="text-[14px] leading-relaxed whitespace-pre-line">{p.passos}</p>
                          {p.fontes?.length > 0 && (
                            <div className="flex flex-col gap-0.5 pt-1">
                              {p.fontes.map((f, k) => (
                                <a key={k} href={linkYt(f.yt, f.seg)} target="_blank" rel="noreferrer" className="text-[12.5px] inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--accent-text)' }}>
                                  <ExternalLink size={12} /><span className="truncate">{f.canal}: {f.video} ({mmss(f.seg)})</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>)
                }))}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
