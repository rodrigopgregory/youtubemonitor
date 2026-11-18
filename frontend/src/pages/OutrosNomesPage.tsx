import { useEffect, useState } from 'react'
import { Search, Undo2, PlayCircle, Trash2 } from 'lucide-react'
import { Card } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { linhas, chamar, linkYt, mmss } from '../lib/api'
import EstrelaItem, { useFavoritosTipo } from '../components/EstrelaItem'

interface Item { ID: number; NOME: string; MOTIVO: string | null; VIDEOS: number; INDICADO_ID: number | null; STATUS: string | null }
interface Onde { ID: number; SEGUNDO: number | null; TRECHO: string | null; YT_VIDEO_ID: string; VIDEO: string; CANAL: string }
interface Props { estado: 'MUSICA' | 'AUDIOVISUAL' | 'SAGRADO'; titulo: string; texto: string }
const STATUS: Record<string, string[]> = {
  MUSICA: ['Já ouvi', 'Ouvindo', 'Tenho, não ouvi', 'Quero ouvir'],
  AUDIOVISUAL: ['Já vi', 'Vendo', 'Tenho, não vi', 'Quero ver'],
  SAGRADO: ['Já li', 'Lendo', 'Tenho, não li', 'Quero ler'],
}
const CODIGOS = ['LIDO', 'LENDO', 'TENHO', 'QUERO']
const PAG = 30
const muted = { color: 'var(--fg-muted)' }
const limpa = (v: string) => v.replace(/['"\\{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)

export default function OutrosNomesPage({ estado, titulo, texto }: Props) {
  const fav = useFavoritosTipo(estado)
  const [lista, setLista] = useState<Item[]>([])
  const [busca, setBusca] = useState('')
  const [q, setQ] = useState('')
  const [statusF, setStatusF] = useState('')
  const [ordem, setOrdem] = useState('mais')
  const [soFav, setSoFav] = useState(false)
  const [fim, setFim] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [onde, setOnde] = useState<number | null>(null)
  const [ondeLista, setOndeLista] = useState<Onde[] | null>(null)
  const [erro, setErro] = useState('')

  async function carregar(offset: number) {
    setCarregando(true)
    try {
      const r = await linhas<Item>('outrosLista', { estado, busca: limpa(q), status: statusF, ordem, fav: soFav ? '1' : '', limit: PAG, offset })
      setLista(l => offset ? [...l, ...r] : r); setFim(r.length < PAG)
    } finally { setCarregando(false) }
  }
  useEffect(() => { setOnde(null); carregar(0) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, q, statusF, ordem, soFav])

  async function voltar(it: Item) {
    setErro('')
    try { await chamar('outrosVoltar', { id: it.ID }); setLista(l => l.filter(x => x.ID !== it.ID)) } catch { setErro('Não deu certo agora. Tente de novo.') }
  }
  async function remover(it: Item) {
    setErro('')
    try { await chamar('pendNaoLivro', { id: it.ID }); setLista(l => l.filter(x => x.ID !== it.ID)) } catch { setErro('Não deu certo agora. Tente de novo.') }
  }
  async function mudarStatus(it: Item, valor: string) {
    setErro('')
    try { await chamar('itemStatusGravar', { tipo: estado, nome: limpa(it.NOME), status: valor }); setLista(l => l.map(x => x.ID === it.ID ? { ...x, STATUS: valor } : x)) } catch { setErro('Não deu certo agora. Tente de novo.') }
  }
  async function verOnde(it: Item) {
    if (onde === it.ID) { setOnde(null); return }
    setOnde(it.ID); setOndeLista(null)
    setOndeLista(it.INDICADO_ID ? await linhas<Onde>('validarOnde', { id: it.INDICADO_ID }).catch(() => []) : [])
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-semibold">{titulo}</h1>
        <p className="text-[14px] mt-1" style={muted}>{texto} Se algum foi parar aqui por engano, use "Voltar para validar". "Remover" tira o nome da lista de vez, sem apagar os vídeos.</p>
      </div>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setQ(busca.trim()) }}>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar pelo nome" className="controle w-full pl-9" />
        </div>
        <Button type="submit">Buscar</Button>
      </form>
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className="controle w-full" aria-label="Situação">
          <option value="">Todas as situações</option>
          {CODIGOS.map((c, i) => <option key={c} value={c}>{STATUS[estado][i]}</option>)}
          <option value="NENHUM">Sem marca</option>
        </select>
        <select value={ordem} onChange={e => setOrdem(e.target.value)} className="controle w-full" aria-label="Ordem">
          <option value="mais">Mais citados primeiro</option>
          <option value="az">Ordem alfabética</option>
        </select>
        <label className="controle w-full inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={soFav} onChange={e => setSoFav(e.target.checked)} />Só favoritos</label>
      </div>
      {erro && <p className="text-[13px]" style={{ color: 'var(--danger-text)' }}>{erro}</p>}
      {!carregando && lista.length === 0 && <Card className="p-6"><p className="text-[14px]" style={muted}>Nada aqui ainda. Em "Validar entradas", use "É música", "É filme ou série" ou "É texto sagrado" para mandar nomes para cá.</p></Card>}
      {lista.map(it => (
        <Card key={it.ID} className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <span className="text-[15px] font-medium">{it.NOME}</span>
              <span className="text-[12.5px] ml-2" style={muted}>{it.VIDEOS} {it.VIDEOS === 1 ? 'vídeo' : 'vídeos'}</span>
            </div>
            <div className="flex gap-2 items-center">
              <EstrelaItem favorito={fav.ehFavorito(it.NOME)} onAlternar={() => fav.alternar(it.NOME)} />
              <Button size="sm" variant="secondary" onClick={() => verOnde(it)}>{onde === it.ID ? 'Esconder onde foi dito' : 'Ver onde foi dito'}</Button>
              <Button size="sm" variant="secondary" onClick={() => voltar(it)}><Undo2 size={14} />Voltar para validar</Button>
              <Button size="sm" variant="secondary" onClick={() => remover(it)}><Trash2 size={14} />Remover</Button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px]" style={muted}>Minha situação:</span>
            <select value={it.STATUS || ''} onChange={e => mudarStatus(it, e.target.value)} className="controle" aria-label="Minha situação">
              <option value="">Sem marca</option>
              {CODIGOS.map((c, i) => <option key={c} value={c}>{STATUS[estado][i]}</option>)}
            </select>
          </div>
          {it.MOTIVO && <p className="text-[13.5px]" style={muted}>{it.MOTIVO}</p>}
          {onde === it.ID && (
            <div className="flex flex-col gap-2 text-[13px]">
              {ondeLista === null && <span style={muted}>Carregando…</span>}
              {ondeLista?.length === 0 && <span style={muted}>Sem trecho guardado.</span>}
              {ondeLista?.map(o => (
                <div key={o.ID} className="flex flex-col gap-0.5">
                  <span style={muted}>{o.CANAL} · {o.VIDEO}</span>
                  {o.TRECHO && <span>{o.TRECHO}</span>}
                  <a href={linkYt(o.YT_VIDEO_ID, o.SEGUNDO || 0)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium" style={{ color: 'var(--accent-text)' }}><PlayCircle size={14} />Assistir{o.SEGUNDO ? ' em ' + mmss(o.SEGUNDO) : ''}</a>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
      {!fim && lista.length > 0 && <Button variant="secondary" onClick={() => carregar(lista.length)} disabled={carregando}>{carregando ? 'Carregando…' : 'Ver mais'}</Button>}
    </div>
  )
}
