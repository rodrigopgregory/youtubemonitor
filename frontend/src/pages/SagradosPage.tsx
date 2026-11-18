import { useEffect, useState } from 'react'
import { Search, Undo2, PlayCircle, Trash2, Unlink, Link2, Pencil } from 'lucide-react'
import { Card } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { linhas, chamar, linkYt, mmss } from '../lib/api'
import EstrelaItem, { useFavoritosTipo } from '../components/EstrelaItem'
import EditarNome from '../components/EditarNome'
import CanalFiltro, { useCanal } from '../components/CanalFiltro'

interface Obra { NOME: string; VIDEOS: number; PARTES: number; STATUS: string | null }
interface Parte { ID: number; NOME: string; VIDEOS: number; INDICADO_ID: number | null }
interface Onde { ID: number; SEGUNDO: number | null; TRECHO: string | null; YT_VIDEO_ID: string; VIDEO: string; CANAL: string }
const STATUS = ['Já li', 'Lendo', 'Tenho, não li', 'Quero ler']
const CODIGOS = ['LIDO', 'LENDO', 'TENHO', 'QUERO']
const PAG = 30
const muted = { color: 'var(--fg-muted)' }
const limpa = (v: string) => v.replace(/['"\\{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)

export default function SagradosPage() {
  const fav = useFavoritosTipo('SAGRADO')
  const [lista, setLista] = useState<Obra[]>([])
  const [busca, setBusca] = useState('')
  const [canalId, setCanalId] = useCanal()
  const [q, setQ] = useState('')
  const [statusF, setStatusF] = useState('')
  const [ordem, setOrdem] = useState('mais')
  const [soFav, setSoFav] = useState(false)
  const [fim, setFim] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [aberta, setAberta] = useState<string | null>(null)
  const [partes, setPartes] = useState<Parte[] | null>(null)
  const [onde, setOnde] = useState<number | null>(null)
  const [ondeLista, setOndeLista] = useState<Onde[] | null>(null)
  const [juntando, setJuntando] = useState<number | null>(null)
  const [destino, setDestino] = useState('')
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState<number | null>(null)

  async function carregar(offset: number) {
    setCarregando(true)
    try {
      const r = await linhas<Obra>('sagradoObras', { canalId, busca: limpa(q), status: statusF, ordem, fav: soFav ? '1' : '', limit: PAG, offset })
      setLista(l => offset ? [...l, ...r] : r); setFim(r.length < PAG)
    } finally { setCarregando(false) }
  }
  useEffect(() => { setAberta(null); carregar(0) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canalId, q, statusF, ordem, soFav])

  async function carregarPartes(obra: string) {
    setPartes(await linhas<Parte>('sagradoPartes', { obra, canalId }).catch(() => []))
  }
  async function abrir(obra: string) {
    if (aberta === obra) { setAberta(null); return }
    setAberta(obra); setPartes(null); setOnde(null); setJuntando(null)
    await carregarPartes(obra)
  }
  async function agir(fn: () => Promise<unknown>, depois?: () => void) {
    setErro('')
    try { await fn(); depois?.() } catch { setErro('Não deu certo agora. Tente de novo.') }
  }
  async function recarregar(obra: string) {
    await carregar(0)
    if (aberta === obra) await carregarPartes(obra)
  }
  const mudarStatus = (ob: Obra, valor: string) => agir(
    () => chamar('itemStatusGravar', { tipo: 'SAGRADO', nome: limpa(ob.NOME), status: valor }),
    () => setLista(l => l.map(x => x.NOME === ob.NOME ? { ...x, STATUS: valor } : x)))
  const tirar = (pt: Parte, obra: string) => agir(() => chamar('sagradoSeparar', { nome: pt.NOME }), () => { setAberta(null); recarregar(obra) })
  const juntar = (pt: Parte, obra: string) => agir(() => chamar('sagradoJuntar', { nome: pt.NOME, obra: limpa(destino) }), () => { setJuntando(null); setDestino(''); setAberta(null); recarregar(obra) })
  const voltar = (pt: Parte, obra: string) => agir(() => chamar('outrosVoltar', { id: pt.ID }), () => recarregar(obra))
  const remover = (pt: Parte, obra: string) => agir(() => chamar('pendNaoLivro', { id: pt.ID }), () => recarregar(obra))
  async function verOnde(pt: Parte) {
    if (onde === pt.ID) { setOnde(null); return }
    setOnde(pt.ID); setOndeLista(null)
    setOndeLista(pt.INDICADO_ID ? await linhas<Onde>('validarOnde', { id: pt.INDICADO_ID }).catch(() => []) : [])
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-semibold">Textos sagrados e clássicos</h1>
        <p className="text-[14px] mt-1" style={muted}>Cada obra reúne os livros e trechos citados nos vídeos (por exemplo, Gênesis e Êxodo dentro de Bíblia). Abra a obra para ver cada parte, onde foi dita, tirar do grupo ou juntar em outra obra.</p>
      </div>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setQ(busca.trim()) }}>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar pelo nome" className="controle w-full pl-9" />
        </div>
        <Button type="submit">Buscar</Button>
      </form>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="sm:col-span-full"><CanalFiltro valor={canalId} onChange={setCanalId} /></div>
        <select value={statusF} onChange={e => setStatusF(e.target.value)} className="controle w-full" aria-label="Situação">
          <option value="">Todas as situações</option>
          {CODIGOS.map((c, i) => <option key={c} value={c}>{STATUS[i]}</option>)}
          <option value="NENHUM">Sem marca</option>
        </select>
        <select value={ordem} onChange={e => setOrdem(e.target.value)} className="controle w-full" aria-label="Ordem">
          <option value="mais">Mais citados primeiro</option>
          <option value="az">Ordem alfabética</option>
        </select>
        <label className="controle w-full inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={soFav} onChange={e => setSoFav(e.target.checked)} />Só favoritos</label>
      </div>
      {erro && <p className="text-[13px]" style={{ color: 'var(--danger-text)' }}>{erro}</p>}
      <datalist id="obras-sagradas">{lista.map(o => <option key={o.NOME} value={o.NOME} />)}</datalist>
      {!carregando && lista.length === 0 && <Card className="p-6"><p className="text-[14px]" style={muted}>Nada aqui ainda. Em "Validar entradas", use "É texto sagrado" para mandar nomes para cá.</p></Card>}
      {lista.map(ob => (
        <Card key={ob.NOME} className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <span className="text-[15px] font-medium">{ob.NOME}</span>
              <span className="text-[12.5px] ml-2" style={muted}>{ob.VIDEOS} {ob.VIDEOS === 1 ? 'vídeo' : 'vídeos'}{ob.PARTES > 1 ? ` · ${ob.PARTES} partes` : ''}</span>
            </div>
            <div className="flex gap-2 items-center">
              <EstrelaItem favorito={fav.ehFavorito(ob.NOME)} onAlternar={() => fav.alternar(ob.NOME)} />
              <Button size="sm" variant="secondary" onClick={() => abrir(ob.NOME)}>{aberta === ob.NOME ? 'Fechar' : 'Abrir partes'}</Button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px]" style={muted}>Minha situação:</span>
            <select value={ob.STATUS || ''} onChange={e => mudarStatus(ob, e.target.value)} className="controle" aria-label="Minha situação">
              <option value="">Sem marca</option>
              {CODIGOS.map((c, i) => <option key={c} value={c}>{STATUS[i]}</option>)}
            </select>
          </div>
          {aberta === ob.NOME && (
            <div className="flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              {partes === null && <span className="text-[13px]" style={muted}>Carregando…</span>}
              {partes?.map(pt => (
                <div key={pt.ID} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-[14px] font-medium">{pt.NOME}</span>
                      <span className="text-[12.5px] ml-2" style={muted}>{pt.VIDEOS} {pt.VIDEOS === 1 ? 'vídeo' : 'vídeos'}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="secondary" onClick={() => verOnde(pt)}>{onde === pt.ID ? 'Esconder onde foi dito' : 'Ver onde foi dito'}</Button>
                      {pt.NOME !== ob.NOME && <Button size="sm" variant="secondary" onClick={() => tirar(pt, ob.NOME)}><Unlink size={14} />Tirar do grupo</Button>}
                      <Button size="sm" variant="secondary" onClick={() => { setJuntando(juntando === pt.ID ? null : pt.ID); setDestino('') }}><Link2 size={14} />Juntar com…</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditando(editando === pt.ID ? null : pt.ID)}><Pencil size={14} />Editar</Button>
                      <Button size="sm" variant="secondary" onClick={() => voltar(pt, ob.NOME)}><Undo2 size={14} />Voltar para validar</Button>
                      <Button size="sm" variant="secondary" onClick={() => remover(pt, ob.NOME)}><Trash2 size={14} />Remover</Button>
                    </div>
                  </div>
                  {editando === pt.ID && <EditarNome id={pt.ID} estado="SAGRADO" motivo={null} onCancelar={() => setEditando(null)} onSalvo={() => { setEditando(null); setAberta(null); recarregar(ob.NOME) }} />}
                  {juntando === pt.ID && (
                    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (limpa(destino)) juntar(pt, ob.NOME) }}>
                      <input list="obras-sagradas" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Nome da obra (escolha ou escreva)" className="controle flex-1" />
                      <Button type="submit" size="sm">Juntar</Button>
                    </form>
                  )}
                  {onde === pt.ID && (
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
