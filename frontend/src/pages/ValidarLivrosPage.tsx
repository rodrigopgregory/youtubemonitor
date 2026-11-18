import { useEffect, useState } from 'react'
import { Search, Sparkles, PenLine, Ban, Check, PlayCircle, FileText, Music, Clapperboard, BookOpen } from 'lucide-react'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import InstrucaoIA from '../components/InstrucaoIA'
import { linhas, chamar, chamarDemorado, linkYt, mmss } from '../lib/api'

interface Item { ID: number; NOME: string; AUTOR: string | null; VIDEOS: number; NID: number | null; SUG_TITULO: string | null; SUG_AUTOR: string | null; MOTIVO: string | null; CERTEZA: number | null }
interface Onde { ID: number; SEGUNDO: number | null; TRECHO: string | null; YT_VIDEO_ID: string; VIDEO: string; CANAL: string; TRANSCRICAO: string | null }
interface Cat { ID: number; TITULO: string; AUTOR: string | null }
const PAG = 25
const muted = { color: 'var(--fg-muted)' }
const limpa = (v: string) => v.replace(/['"\\{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250)

export default function ValidarLivrosPage() {
  const [instrucao, setInstrucao] = useState('')
  const [lista, setLista] = useState<Item[]>([])
  const [total, setTotal] = useState({ N: 0, PEND: 0, COM_AUTOR: 0 })
  const [busca, setBusca] = useState('')
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('')
  const [fim, setFim] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  const [titulo, setTitulo] = useState('')
  const [autor, setAutor] = useState('')
  const [catId, setCatId] = useState(0)
  const [achados, setAchados] = useState<Cat[]>([])
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [onde, setOnde] = useState<number | null>(null)
  const [ondeLista, setOndeLista] = useState<Onde[] | null>(null)
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [massa, setMassa] = useState('')
  const [aviso, setAviso] = useState<Record<number, string>>({})

  async function carregar(offset: number) {
    setCarregando(true)
    try {
      const r = await linhas<Item>('validarLista', { busca: limpa(q), filtro, limit: filtro === 'grupo' ? 300 : PAG, offset })
      setLista(l => offset ? [...l, ...r] : r); setFim(r.length < (filtro === 'grupo' ? 300 : PAG))
    } finally { setCarregando(false) }
  }
  function totais() { linhas<{ N: number; PEND: number; COM_AUTOR: number }>('validarTotal').then(r => setTotal({ N: Number(r[0]?.N || 0), PEND: Number(r[0]?.PEND || 0), COM_AUTOR: Number(r[0]?.COM_AUTOR || 0) })).catch(() => {}) }
  useEffect(() => { carregar(0) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filtro])
  useEffect(totais, [])
  useEffect(() => {
    const t = limpa(titulo)
    if (editando === null || t.length < 3 || catId) { setAchados([]); return }
    const h = setTimeout(() => { linhas<Cat>('catalogoBusca', { busca: t }).then(setAchados).catch(() => setAchados([])) }, 300)
    return () => clearTimeout(h)
  }, [titulo, editando, catId])

  async function aceitarAlta() {
    setMassa('...')
    try {
      const n = Number((await linhas<{ N: number }>('validarAltaTotal'))[0]?.N || 0)
      if (!n) { setMassa('Nenhuma sugestão com 90% ou mais para aceitar.'); return }
      if (!window.confirm('Aceitar ' + n + ' sugestões com 90% ou mais de certeza? Cada nome será ligado ao livro sugerido da sua biblioteca.')) { setMassa(''); return }
      await chamar('validarAceitarAlta')
      setMassa(n + ' sugestões aceitas.'); carregar(0); totais()
    } catch { setMassa('Não deu certo agora. Tente de novo.') }
  }
  function marcar(id: number) { setMarcados(m => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  async function ligarGrupo(itens: Item[]) {
    const alvo = itens.filter(x => marcados.has(x.ID))
    if (!alvo.length || !window.confirm('Ligar ' + alvo.length + ' nomes ao livro "' + (alvo[0].SUG_TITULO || '') + '"?')) return
    for (const it of alvo) await gravar(it, it.SUG_TITULO || '', it.SUG_AUTOR || '', 0)
    setMarcados(m => { const n = new Set(m); alvo.forEach(x => n.delete(x.ID)); return n })
  }
  const grupos = filtro === 'grupo' ? Object.values(lista.reduce<Record<string, Item[]>>((acc, it) => { const k = it.SUG_TITULO || ''; (acc[k] = acc[k] || []).push(it); return acc }, {})) : []
  function sair(id: number) { setLista(l => l.filter(x => x.ID !== id)); totais(); setEditando(null) }
  async function executar(it: Item, fn: () => Promise<void>) {
    setOcupado(it.ID); setAviso(a => ({ ...a, [it.ID]: '' }))
    try { await fn() } catch { setAviso(a => ({ ...a, [it.ID]: 'Não deu certo agora. Tente de novo.' })) }
    setOcupado(null)
  }
  const validarIA = (it: Item) => executar(it, async () => {
    const r = await chamarDemorado<{ ok: boolean; semBusca?: boolean; estado?: string; titulo?: string; autor?: string; motivo?: string; erro?: string }>('livroValidar', { id: it.ID, instrucao: instrucao.trim() }, 120)
    if (!r?.ok) { setAviso(a => ({ ...a, [it.ID]: r?.erro || 'Não consegui validar agora.' })); return }
    if (r.estado === 'OK') { sair(it.ID); return }
    setLista(l => l.map(x => x.ID === it.ID ? { ...x, NID: x.NID || 1, SUG_TITULO: r.titulo || null, SUG_AUTOR: r.autor || null, MOTIVO: r.motivo || null } : x))
    const so = r.semBusca ? ' (sem a busca do Google, que está sem cota: confira)' : ' (busca do Google usada)'
    setAviso(a => ({ ...a, [it.ID]: (r.titulo ? 'A IA sugeriu: ' + r.titulo + (r.autor ? ', de ' + r.autor : '') + '. Não teve certeza' : 'A IA não achou esse livro') + so + '.' }))
  })
  const gravar = (it: Item, t: string, a: string, cat: number) => executar(it, async () => {
    const tit = limpa(t); if (!tit) throw new Error('vazio')
    let id = cat
    if (!id) {
      const f = await linhas<{ ID: number }>('catalogoAchar', { titulo: tit })
      id = Number(f[0]?.ID || 0)
      if (!id) { await chamar('pendCatalogoCriar', { titulo: tit, autor: limpa(a) }); id = Number((await linhas<{ ID: number }>('catalogoAchar', { titulo: tit }))[0]?.ID || 0) }
    }
    if (!id) throw new Error('sem id')
    await chamar('nomeOkCat', { id: it.ID, catId: id }); sair(it.ID)
  })
  const naoLivro = (it: Item) => executar(it, async () => { await chamar('nomeNaoLivro', { id: it.ID }); sair(it.ID) })
  const musica = (it: Item) => executar(it, async () => { await chamar('nomeMusica', { id: it.ID }); sair(it.ID) })
  const sagrado = (it: Item) => executar(it, async () => { await chamar('nomeSagrado', { id: it.ID }); sair(it.ID) })
  const audiovisual = (it: Item) => executar(it, async () => { await chamar('nomeAudiovisual', { id: it.ID }); sair(it.ID) })
  async function verOnde(it: Item) {
    if (onde === it.ID) { setOnde(null); return }
    setOnde(it.ID); setOndeLista(null)
    setOndeLista(await linhas<Onde>('validarOnde', { id: it.ID }).catch(() => []))
  }
  function lerTextoColado(texto: string) {
    const achouTitulo = texto.match(/[“"«]([^”"»]{3,200})[”"»]/)
    if (!achouTitulo) return
    const resto = texto.slice((achouTitulo.index || 0) + achouTitulo[0].length)
    const achouAutor = resto.match(/(?:escrit[ao]s?|publicad[ao]s?|assinad[ao]s?)\s+(?:pel[oa]\s+)?(?:(?:brasileir[oa]|escritor(?:a)?|autor(?:a)?|professor(?:a)?)\s+)*([^,.;()\n]{3,120})/i) || resto.match(/(?:de autoria de|autor(?:a)?:?|\bpor|\bde)\s+([^,.;()\n]{3,120})/i)
    setTitulo(achouTitulo[1].trim()); setCatId(0); setAchados([])
    if (achouAutor) setAutor(achouAutor[1].trim())
  }
  function abrir(it: Item) { setEditando(it.ID); setTitulo(it.SUG_TITULO || ''); setAutor(it.SUG_AUTOR || it.AUTOR || ''); setCatId(0); setAchados([]) }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-semibold">Validar entradas</h1>
        <p className="text-[14px] mt-1" style={muted}>Nomes ouvidos nos vídeos que ainda não foram confirmados. Decida se cada um é livro, música ou filme/série. Valide com a IA (que pesquisa no Google) ou escreva o nome certo. Livros confirmados entram na Relação.</p>
      </div>

      <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); setQ(busca.trim()) }}>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Procurar um nome" className="controle w-full pl-9" />
        </div>
        <select value={filtro} onChange={e => setFiltro(e.target.value)} className="controle" aria-label="Mostrar">
          <option value="">Todos</option>
          <option value="alta">Certeza de 90% ou mais</option>
          <option value="baixa">Abaixo de 90%</option>
          <option value="grupo">Agrupados por livro</option>
          <option value="sug">Com sugestão</option>
          <option value="novoautor">Sem sugestão, com autor ouvido</option>
          <option value="novosolo">Sem sugestão, só o nome</option>
          <option value="novo">Ainda não vistos pela IA</option>
        </select>
        <Button type="submit">Buscar</Button>
      </form>

      <p className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{total.N.toLocaleString('pt-BR')} nomes para validar, {total.PEND.toLocaleString('pt-BR')} com sugestão e {total.COM_AUTOR.toLocaleString('pt-BR')} sem sugestão, mas com autor ouvido. Os mais citados vêm primeiro.</p>

      <InstrucaoIA valor={instrucao} onChange={setInstrucao} />

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" disabled={massa === '...'} onClick={aceitarAlta}><Check size={14} />Aceitar todos com 90% ou mais</Button>
        {massa && massa !== '...' && <span className="text-[13px]" style={muted}>{massa}</span>}
      </div>

      <div className="flex flex-col gap-2">
        {!carregando && lista.length === 0 && <Card className="p-6"><p className="text-[14px]" style={muted}>Nada para validar agora.</p></Card>}
        {grupos.map(itens => (
          <Card key={itens[0].SUG_TITULO} className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[15px] font-medium">{itens[0].SUG_TITULO}</span>
              {itens[0].SUG_AUTOR && <span className="text-[13px]" style={muted}>{itens[0].SUG_AUTOR}</span>}
              <Badge variant="neutral">{itens.length} nomes parecidos</Badge>
            </div>
            {itens.map(it => (
              <label key={it.ID} className="flex items-center gap-2 text-[13.5px]">
                <input type="checkbox" checked={marcados.has(it.ID)} onChange={() => marcar(it.ID)} />
                <span>“{it.NOME}”</span>
                {it.CERTEZA != null && <span className="text-[12px]" style={muted}>{Number(it.CERTEZA)}%</span>}
                {aviso[it.ID] && <span className="text-[12px]">{aviso[it.ID]}</span>}
              </label>
            ))}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => ligarGrupo(itens)} disabled={!itens.some(x => marcados.has(x.ID))}><Check size={14} />Ligar marcados a este livro</Button>
              <Button size="sm" variant="secondary" onClick={() => setMarcados(m => { const n = new Set(m); itens.forEach(x => n.add(x.ID)); return n })}>Marcar todos</Button>
            </div>
          </Card>
        ))}
        {filtro !== 'grupo' && lista.map(it => (
          <Card key={it.ID} className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[15px] font-medium">“{it.NOME}”</span>
              {it.AUTOR && <span className="text-[13px]" style={muted}>autor ouvido: {it.AUTOR}</span>}
              <Badge variant="neutral">{Number(it.VIDEOS)} {Number(it.VIDEOS) === 1 ? 'vídeo' : 'vídeos'}</Badge>
            </div>
            {it.SUG_TITULO && <p className="text-[13px]" style={muted}>{it.CERTEZA != null && <Badge variant={Number(it.CERTEZA) >= 90 ? 'success' : 'neutral'}>{Number(it.CERTEZA)}% de certeza</Badge>} Sugestão: {it.SUG_TITULO}{it.SUG_AUTOR ? ', de ' + it.SUG_AUTOR : ''}{it.MOTIVO ? ' · ' + it.MOTIVO : ''}</p>}
            {aviso[it.ID] && <p className="text-[12.5px]">{aviso[it.ID]}</p>}
            {editando === it.ID ? (
              <div className="flex flex-col gap-2">
                <label className="text-[12px] font-medium" style={muted}>Colar texto da internet (preenche título e autor)</label>
                <textarea className="controle" rows={2} placeholder='Ex.: A obra é "Título do livro", escrita por Fulano de Tal' onChange={e => lerTextoColado(e.target.value)} />
                <label className="text-[12px] font-medium" style={muted}>Título do livro</label>
                <input className="controle" placeholder="Título certo do livro" value={titulo} onChange={e => { setTitulo(e.target.value); setCatId(0) }} />
                {achados.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px]" style={muted}>Na sua biblioteca:</span>
                    {achados.map(c => <button key={c.ID} type="button" className="text-left text-[13px] underline" onClick={() => { setTitulo(c.TITULO); setAutor(c.AUTOR || ''); setCatId(c.ID); setAchados([]) }}>{c.TITULO}{c.AUTOR ? ' (' + c.AUTOR + ')' : ''}</button>)}
                  </div>
                )}
                <label className="text-[12px] font-medium" style={muted}>Autor (opcional)</label>
                <input className="controle" placeholder="Autor (opcional)" value={autor} onChange={e => setAutor(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={ocupado === it.ID || !limpa(titulo)} onClick={() => gravar(it, titulo, autor, catId)}><Check size={14} />Salvar</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" disabled={ocupado === it.ID} onClick={() => validarIA(it)}><Sparkles size={14} />{ocupado === it.ID ? 'Validando…' : 'Validar com IA'}</Button>
                {it.SUG_TITULO && <Button size="sm" variant="secondary" disabled={ocupado === it.ID} onClick={() => gravar(it, it.SUG_TITULO || '', it.SUG_AUTOR || '', 0)}>Aceitar sugestão</Button>}
                <Button size="sm" variant="secondary" disabled={ocupado === it.ID} onClick={() => abrir(it)}><PenLine size={14} />Validar manual</Button>
                <Button size="sm" variant="secondary" disabled={ocupado === it.ID} onClick={() => naoLivro(it)}><Ban size={14} />Não é livro</Button>
                <Button size="sm" variant="secondary" disabled={ocupado === it.ID} onClick={() => musica(it)}><Music size={14} />É música</Button>
                <Button size="sm" variant="secondary" disabled={ocupado === it.ID} onClick={() => audiovisual(it)}><Clapperboard size={14} />É filme ou série</Button>
                <Button size="sm" variant="secondary" disabled={ocupado === it.ID} onClick={() => sagrado(it)}><BookOpen size={14} />É texto sagrado</Button>
                <Button size="sm" variant="secondary" onClick={() => verOnde(it)}><FileText size={14} />{onde === it.ID ? 'Esconder onde foi dito' : 'Ver onde foi dito'}</Button>
              </div>
            )}
            {onde === it.ID && (
              <div className="flex flex-col gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                {ondeLista === null && <p className="text-[13px]" style={muted}>Carregando…</p>}
                {ondeLista !== null && ondeLista.length === 0 && <p className="text-[13px]" style={muted}>Não achei o trecho.</p>}
                {ondeLista?.map(o => (
                  <div key={o.ID} className="flex flex-col gap-1">
                    <span className="text-[12.5px]" style={muted}>{o.CANAL} · {o.VIDEO}{o.SEGUNDO ? ' · ' + mmss(o.SEGUNDO) : ''}</span>
                    {o.TRANSCRICAO ? <p className="text-[13.5px] leading-relaxed">{o.TRANSCRICAO}</p> : o.TRECHO && <p className="text-[13.5px] leading-relaxed">{o.TRECHO}</p>}
                    <a href={linkYt(o.YT_VIDEO_ID, Math.max(0, (o.SEGUNDO || 0) - 5))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium" style={{ color: 'var(--accent-text)' }}><PlayCircle size={14} />Ouvir no YouTube{o.SEGUNDO ? ' em ' + mmss(Math.max(0, o.SEGUNDO - 5)) : ''}</a>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
        {!fim && lista.length > 0 && <Button variant="secondary" onClick={() => carregar(lista.length)} disabled={carregando}>{carregando ? 'Carregando…' : 'Ver mais'}</Button>}
      </div>
    </div>
  )
}
