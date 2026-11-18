import { useEffect, useState } from 'react'
import { Search, Sparkles, PenLine, Ban, Check, PlayCircle, FileText, Music, Clapperboard, BookOpen } from 'lucide-react'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import InstrucaoIA from '../components/InstrucaoIA'
import { linhas, chamar, chamarDemorado, linkYt, mmss } from '../lib/api'

interface Item { ID: number; NOME: string; AUTOR: string | null; VIDEOS: number; NID: number | null; SUG_TITULO: string | null; SUG_AUTOR: string | null; MOTIVO: string | null; CERTEZA: number | null; TIPO?: string | null }
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
  const [faixa, setFaixa] = useState('')
  const [campos, setCampos] = useState('')
  const [grupo, setGrupo] = useState(false)
  const [tipo, setTipo] = useState('')
  const [origem, setOrigem] = useState('')
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
  const [colado, setColado] = useState('')
  const [leitura, setLeitura] = useState('')
  const [exportando, setExportando] = useState(false)
  const [importar, setImportar] = useState(false)
  const [textoImportar, setTextoImportar] = useState('')
  const [msgImportar, setMsgImportar] = useState('')
  const [aviso, setAviso] = useState<Record<number, string>>({})

  async function carregar(offset: number) {
    setCarregando(true)
    try {
      const tudo = !!(filtro || faixa || campos || grupo || tipo || origem || q)
      const passo = tudo ? 300 : PAG
      let achados: Item[] = []
      let ultimo = 0
      do {
        const r = await linhas<Item>('validarLista', { busca: limpa(q), filtro, faixa, campos, grupo: grupo ? '1' : '', tipo, origem, limit: passo, offset: offset + achados.length })
        achados = achados.concat(r); ultimo = r.length
      } while (tudo && ultimo === passo && achados.length < 6000)
      setLista(l => offset ? [...l, ...achados] : achados); setFim(tudo ? true : ultimo < passo)
    } finally { setCarregando(false) }
  }
  function totais() { linhas<{ N: number; PEND: number; COM_AUTOR: number }>('validarTotal').then(r => setTotal({ N: Number(r[0]?.N || 0), PEND: Number(r[0]?.PEND || 0), COM_AUTOR: Number(r[0]?.COM_AUTOR || 0) })).catch(() => {}) }
  useEffect(() => { carregar(0) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filtro, faixa, campos, grupo, tipo, origem])
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
  async function naoLivroMarcados() {
    const alvo = lista.filter(x => marcados.has(x.ID))
    if (!alvo.length || !window.confirm('Marcar ' + alvo.length + ' nomes como "não é livro"? Eles saem desta lista.')) return
    setMassa('...')
    let feitos = 0
    for (const it of alvo) {
      try { await chamar('nomeNaoLivro', { id: it.ID }); feitos++; setLista(l => l.filter(x => x.ID !== it.ID)); setMarcados(m => { const n = new Set(m); n.delete(it.ID); return n }) } catch { break }
    }
    setMassa(feitos === alvo.length ? feitos + ' nomes marcados como não é livro.' : 'Marquei ' + feitos + ' de ' + alvo.length + '. Tente de novo para o resto.')
    totais()
  }
  async function aceitarMarcados() {
    const alvo = lista.filter(x => marcados.has(x.ID))
    const prontos = alvo.filter(x => x.SUG_TITULO && (!x.TIPO || x.TIPO === 'livro'))
    const pulados = alvo.length - prontos.length
    if (!prontos.length) { setMassa('Nenhum dos marcados tem sugestão de livro para aceitar.'); return }
    if (!window.confirm('Aceitar a sugestão de ' + prontos.length + ' nomes? Cada um será ligado ao livro sugerido' + (pulados ? ' (' + pulados + ' ficam de fora: sem sugestão ou de outro tipo)' : '') + '.')) return
    setMassa('...')
    let feitos = 0
    for (const it of prontos) {
      try { await gravar(it, it.SUG_TITULO || '', it.SUG_AUTOR || '', 0); feitos++; setMarcados(m => { const n = new Set(m); n.delete(it.ID); return n }) } catch { break }
    }
    setMassa(feitos + ' sugestões aceitas' + (feitos < prontos.length ? '. Algumas deram erro: tente de novo' : '') + '.')
    totais()
  }
  async function tipoMarcados(acao: 'nomeMusica' | 'nomeAudiovisual' | 'nomeSagrado', rotulo: string) {
    const alvo = lista.filter(x => marcados.has(x.ID))
    if (!alvo.length || !window.confirm('Marcar ' + alvo.length + ' nomes como "' + rotulo + '"? Eles saem desta lista.')) return
    setMassa('...')
    let feitos = 0
    for (const it of alvo) {
      try { await chamar(acao, { id: it.ID }); feitos++; setLista(l => l.filter(x => x.ID !== it.ID)); setMarcados(m => { const n = new Set(m); n.delete(it.ID); return n }) } catch { break }
    }
    setMassa(feitos === alvo.length ? feitos + ' nomes marcados como ' + rotulo + '.' : 'Marquei ' + feitos + ' de ' + alvo.length + '. Tente de novo para o resto.')
    totais()
  }
  const grupos = grupo ? Object.values(lista.reduce<Record<string, Item[]>>((acc, it) => { const k = it.SUG_TITULO || ''; (acc[k] = acc[k] || []).push(it); return acc }, {})) : []
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
  function lerTextoColado(texto: string): boolean {
    const limpo = texto.replace(/\s+/g, ' ').trim()
    let achouTit = ''
    let achouAut = ''
    const rotuloTit = limpo.match(/t[ií]tulo\s*[:\-–]\s*([^|;\n]+?)(?=\s+(?:autor(?:a)?|escrit[oa]|publicad[oa])\b|[|;]|$)/i)
    const rotuloAut = limpo.match(/autor(?:a)?\s*[:\-–]\s*([^|;,.\n]{3,120})/i)
    const aspas = limpo.match(/[“"«'‘]([^”"»’]{3,200})[”"»'’]/)
    if (rotuloTit) { achouTit = rotuloTit[1] }
    else if (aspas) { achouTit = aspas[1] }
    const base = aspas && !rotuloTit ? limpo.slice((aspas.index || 0) + aspas[0].length) : limpo
    const porAutor = rotuloAut || base.match(/(?:escrit[ao]s?|publicad[ao]s?|assinad[ao]s?)\s+(?:pel[oa]\s+)?(?:(?:brasileir[oa]|escritor(?:a)?|autor(?:a)?|professor(?:a)?)\s+)*([^,.;()\n]{3,120})/i) || base.match(/(?:de autoria de|\bpor|\bde)\s+([^,.;()\n]{3,120})/i)
    if (porAutor) achouAut = porAutor[1]
    if (!achouTit && !limpo.includes('\n') && texto.split('\n').length === 1) {
      const par = limpo.match(/^(.{3,160}?)\s+(?:[-–—]|,\s*de|\bde)\s+([^,.;()]{3,100})$/i)
      if (par) { achouTit = par[1]; achouAut = par[2] }
    }
    if (!achouTit) {
      const linhasTxt = texto.split('\n').map(x => x.trim()).filter(Boolean)
      if (linhasTxt.length >= 1 && linhasTxt[0].length <= 160 && linhasTxt.length <= 3) { achouTit = linhasTxt[0]; if (linhasTxt[1] && !achouAut) achouAut = linhasTxt[1].replace(/^(?:de|por|autor(?:a)?:?)\s+/i, '') }
    }
    achouTit = achouTit.trim().replace(/^["“«]|["”»]$/g, '')
    if (!achouTit) return false
    setTitulo(achouTit); setCatId(0); setAchados([])
    if (achouAut) setAutor(achouAut.trim())
    return true
  }
  function lerAgora() {
    const ok = lerTextoColado(colado)
    setLeitura(ok ? 'Li o texto: confira título e autor abaixo e clique em Salvar.' : 'Não consegui achar o título nesse texto. Escreva o título abaixo à mão, ou cole algo como: Título: ... Autor: ...')
  }
  async function exportarPendentes() {
    setExportando(true); setMassa('')
    try {
      type Linha = { NOME: string; AUTOR: string | null; VIDEOS: number; TRECHO: string | null; SUG_TITULO: string | null; SUG_AUTOR: string | null; CERTEZA: number | null; MOTIVO: string | null; TIPO: string | null }
      const todos: Linha[] = []
      for (let offset = 0; offset < 6000; offset += 300) {
        const r = await linhas<Linha>('validarExportar', { busca: limpa(q), filtro, faixa, campos, grupo: grupo ? '1' : '', tipo, origem, limit: 300, offset })
        todos.push(...r)
        if (r.length < 300) break
      }
      const validos = todos
      const itens = validos.map(x => ({
        nome: x.NOME,
        autor_ouvido: x.AUTOR || '',
        videos: Number(x.VIDEOS),
        trecho_da_transcricao: (x.TRECHO || '').replace(/\s+/g, ' ').trim(),
        sugestao_atual: x.SUG_TITULO ? { tipo: x.TIPO || '', titulo: x.SUG_TITULO, autor: x.SUG_AUTOR || '', certeza_pct: x.CERTEZA == null ? null : Number(x.CERTEZA), motivo: x.MOTIVO || '' } : null
      }))
      const instrucao = [
        'CONTEXTO',
        'Tenho um aplicativo que monitora canais do YouTube espiritas e espiritualistas (em portugues do Brasil). Ele transcreve os videos e, por IA, detecta citacoes de livros. Como a transcricao e feita por voz, os nomes saem errados, truncados, com grafia trocada, ou nem sao livros (podem ser musicas, filmes, textos sagrados ou frases soltas).',
        '',
        'SUA TAREFA',
        'Para CADA item da lista abaixo, faca DUAS coisas: (1) classifique o que o nome e; (2) se for livro, valide na internet que o livro existe (Estante Virtual, Sebos, Amazon, Skoob, Google Livros, sites de editoras como FEB, Lachatre, Petit, EME, IDE, Conscienciologia etc.). Use o trecho da transcricao para entender o contexto e o autor ouvido como pista.',
        'Cada item traz: o nome ouvido, o autor ouvido, em quantos videos apareceu, o trecho da transcricao e, quando existe, a sugestao atual do app (tipo, titulo, autor, certeza e motivo). Confirme, corrija ou rejeite a sugestao atual.',
        '',
        'REGRAS',
        '- "tipo" e OBRIGATORIO em todos os itens, sem excecao. Valores permitidos: "livro", "musica", "audiovisual", "sagrado" ou "outro". Decida NESTA ORDEM: (1) e livro? (2) se nao, e musica, album ou letra de musica? (3) se nao, e texto sagrado? (4) se nao, e filme, serie, anime, desenho, documentario, especial ou jogo? Isso e "audiovisual". (5) so use "outro" se nao se encaixar em NENHUM dos anteriores.',
        '  * "livro": livro real (inclui apostilas e obras impressas).',
        '  * "musica": cancao, album ou artista citado como musica.',
        '  * "audiovisual": filme, serie, anime, desenho, documentario, especial de TV ou jogo. Se o trecho falar do filme e nao do livro (mesmo existindo livro com o mesmo nome), use "audiovisual".',
        '  * "sagrado": texto sagrado ou escritura (Biblia, Evangelho, Bhagavad Gita, Tao Te King, Alcorao, Dhammapada, Salmos etc.).',
        '  * "outro": frase solta, tema, expressao, nome de pessoa ou lugar, ou trecho sem obra identificavel. Em "outro", o campo "motivo" e OBRIGATORIO e deve dizer em uma frase o que esta sendo dito (ex.: "expressao sobre meditacao, nao e obra", "nome de uma palestrante", "trecho truncado, parece falar de reencarnacao").',
        '- "subtipo": preencha SO quando "tipo" for "audiovisual", com "filme", "serie" (series, animes e desenhos), "documentario" ou "jogo" (video game). Nos demais tipos deixe "".',
        '- Para "livro": "titulo" e o titulo oficial completo, "autor" e o autor como esta na capa, "certeza" de 0 a 100 (so acima de 85 se achou o livro em pelo menos uma loja ou catalogo). Se nao achar em nenhuma fonte, deixe "titulo" vazio e "certeza" 0, mas mantenha "tipo".',
        '- Para "musica", "audiovisual" e "sagrado": "titulo" e o nome correto da obra, "autor" e o artista, diretor ou tradicao quando souber (ou ""), e "certeza" e a sua confianca na CLASSIFICACAO.',
        '- Nao invente. Se estiver em duvida entre duas categorias, escolha a mais provavel e explique em "motivo".',
        '- "fonte": o nome do site ou a URL onde achou (ou ""). "motivo": uma frase curta.',
        '- Copie "nome" exatamente como veio na lista, para eu conseguir casar a resposta.',
        '',
        'FORMATO DA RESPOSTA',
        'Responda SOMENTE com um array JSON (sem texto antes ou depois), na mesma ordem da lista, com TODOS estes campos em cada objeto:',
        '[{"nome":"...","tipo":"livro","subtipo":"","titulo":"...","autor":"...","certeza":0,"fonte":"...","motivo":"..."}]',
        'Exemplos: {"nome":"Matrix","tipo":"audiovisual","subtipo":"filme","titulo":"Matrix","autor":"Irmas Wachowski","certeza":95,"fonte":"","motivo":"Filme de 1999"} ; {"nome":"o livro dos espiritos","tipo":"livro","subtipo":"","titulo":"O Livro dos Espiritos","autor":"Allan Kardec","certeza":99,"fonte":"FEB","motivo":"Obra basica do espiritismo"}.',
        'Faca em lotes de 50 itens. Ao terminar cada lote, devolva o array JSON dele e espere eu pedir o proximo.',
        '',
        'LISTA (' + itens.length + ' itens, um por linha, em JSON):'
      ].join('\n')
      const blob = new Blob([instrucao + '\n' + itens.map(x => JSON.stringify(x)).join('\n')], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = 'validar-livros.txt'; a.click(); URL.revokeObjectURL(a.href)
      setMassa(itens.length + ' nomes exportados no arquivo validar-livros.txt.')
    } catch { setMassa('Não deu certo agora. Tente de novo.') }
    setExportando(false)
  }
  async function importarRespostas() {
    setMsgImportar('Lendo...')
    const bruto = textoImportar.trim()
    const ini = bruto.indexOf('['), fim2 = bruto.lastIndexOf(']')
    let lista2: { tipo?: string; subtipo?: string; nome?: string; titulo?: string; autor?: string; certeza?: number; motivo?: string; fonte?: string }[] = []
    try { lista2 = JSON.parse(bruto.slice(ini, fim2 + 1)) } catch { setMsgImportar('Não consegui ler. Cole o array JSON que o Claude devolveu, começando em [ e terminando em ].'); return }
    let gravados = 0, vazios = 0, falhas = 0, movidos = 0
    for (const x of lista2) {
      const nome = limpa(String(x.nome || '')), tit = limpa(String(x.titulo || ''))
      if (!nome) continue
      let tp = ({ livro: 'livro', musica: 'musica', 'música': 'musica', audiovisual: 'audiovisual', sagrado: 'sagrado', outro: 'outro' } as Record<string, string>)[String(x.tipo || '').toLowerCase().trim()] || ''
      const dica = (String(x.motivo || '').match(/n[aã]o [eé] livro:\s*([^.]*)/i)?.[1] || '').toLowerCase()
      if (!tp && dica) tp = /m[uú]sica|can[cç][aã]o/.test(dica) ? 'musica' : /jogo|filme|s[eé]rie|anime|document|anima|desenho|especial|franquia|tv/.test(dica) ? 'audiovisual' : ''
      if (!tit && !(tp && tp !== 'livro')) { vazios++; continue }
      const st = String(x.subtipo || dica).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
      const cats = [/jogo|game/.test(st) && 'jogo', /document/.test(st) && 'documentario', /anime|serie|desenho/.test(st) && 'serie', /filme|animacao/.test(st) && 'filme'].filter(Boolean)
      const sub = tp !== 'audiovisual' ? '' : cats.length === 1 ? String(cats[0]) : cats.includes('documentario') ? 'documentario' : ''
      const cert = Math.max(0, Math.min(100, Math.round(Number(x.certeza) || 0)))
      try { await chamar(/['"\\{}]/.test(String(x.nome || '')) ? 'validarSugerirEsp' : 'validarSugerir', { nome, subtipo: sub, padrao: String(x.nome || '').replace(/['"\\{}]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 250), titulo: tit, tipo: tp, autor: limpa(String(x.autor || '')), certeza: cert, motivo: 'Claude: ' + limpa(String(x.motivo || '') + (x.fonte ? ' (fonte: ' + String(x.fonte) + ')' : '')) }); gravados++; if (tp === 'musica' || tp === 'audiovisual' || tp === 'sagrado') { await chamar('nomeTipoPorNome', { padrao: String(x.nome || '').replace(/['"\\{}]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 250), estado: tp === 'musica' ? 'MUSICA' : tp === 'sagrado' ? 'SAGRADO' : 'AUDIOVISUAL', subtipo: sub }); movidos++ } } catch { falhas++ }
      setMsgImportar('Gravando... ' + gravados)
    }
    setMsgImportar(gravados + ' sugestões gravadas' + (movidos ? ', ' + movidos + ' já levados para a aba de música, filmes e séries ou textos sagrados' : '') + (vazios ? ', ' + vazios + ' sem livro achado (ignorados)' : '') + (falhas ? ', ' + falhas + ' com erro' : '') + '. Nada foi aprovado: confira na lista.')
    carregar(0); totais()
  }
  function abrir(it: Item) { setColado(''); setLeitura(''); setEditando(it.ID); setTitulo(it.SUG_TITULO || ''); setAutor(it.SUG_AUTOR || it.AUTOR || ''); setCatId(0); setAchados([]) }

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
          <option value="sug">Com sugestão</option>
          <option value="novoautor">Sem sugestão, com autor ouvido</option>
          <option value="novosolo">Sem sugestão, só o nome</option>
          <option value="novo">Ainda não vistos pela IA</option>
          <option value="semautor">Sem nenhum autor (nem ouvido, nem sugerido)</option>
        </select>
        <select value={faixa} onChange={e => setFaixa(e.target.value)} className="controle" aria-label="Certeza">
          <option value="">Qualquer certeza</option>
          <option value="alta">Certeza de 90% ou mais</option>
          <option value="baixa">Abaixo de 90%</option>
        </select>
        <select value={campos} onChange={e => setCampos(e.target.value)} className="controle" aria-label="Título e autor">
          <option value="">Título e autor: qualquer</option>
          <option value="ambos">Com título e autor</option>
          <option value="titulo">Só título (sem autor)</option>
          <option value="autor">Só autor (sem título)</option>
          <option value="nenhum">Sem título e sem autor</option>
        </select>
        <label className="controle flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={grupo} onChange={e => setGrupo(e.target.checked)} />Agrupar por livro</label>
        <select value={origem} onChange={e => setOrigem(e.target.value)} className="controle" aria-label="Origem da sugestão">
          <option value="">Qualquer origem</option>
          <option value="claude">Validados pelo Claude</option>
          <option value="app">Validados pela IA do app</option>
        </select>
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="controle" aria-label="Tipo sugerido">
          <option value="">Qualquer tipo</option>
          <option value="livro">Sugerido: livro</option>
          <option value="musica">Sugerido: música</option>
          <option value="audiovisual">Sugerido: filme ou série</option>
          <option value="sagrado">Sugerido: texto sagrado</option>
          <option value="outro">Sugerido: outro</option>
          <option value="semtipo">Sem tipo ainda</option>
        </select>
        <Button type="submit">Buscar</Button>
      </form>

      <p className="text-[12.5px]" style={{ color: 'var(--fg-subtle)' }}>{total.N.toLocaleString('pt-BR')} nomes para validar, {total.PEND.toLocaleString('pt-BR')} com sugestão e {total.COM_AUTOR.toLocaleString('pt-BR')} sem sugestão, mas com autor ouvido. Os mais citados vêm primeiro.</p>

      <InstrucaoIA valor={instrucao} onChange={setInstrucao} />

      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" disabled={massa === '...'} onClick={aceitarAlta}><Check size={14} />Aceitar todos com 90% ou mais</Button>
        <Button variant="secondary" disabled={exportando} onClick={exportarPendentes}><FileText size={14} />{exportando ? 'Exportando…' : (filtro || faixa || campos || grupo || tipo || origem || q ? 'Exportar o filtro atual para o Claude' : 'Exportar pendentes para o Claude')}</Button>
        <Button variant="secondary" onClick={() => setImportar(v => !v)}><PenLine size={14} />Colar respostas do Claude</Button>
        {massa && massa !== '...' && <span className="text-[13px]" style={muted}>{massa}</span>}
      </div>
      {!grupo && lista.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => setMarcados(m => { const n = new Set(m); lista.forEach(x => n.add(x.ID)); return n })}>Marcar todos os {lista.length} da tela</Button>
          <Button size="sm" variant="secondary" disabled={!marcados.size} onClick={() => setMarcados(new Set())}>Desmarcar</Button>
          <Button size="sm" disabled={!lista.some(x => marcados.has(x.ID)) || massa === '...'} onClick={naoLivroMarcados}><Ban size={14} />Não é livro nos marcados ({lista.filter(x => marcados.has(x.ID)).length})</Button>
          <Button size="sm" disabled={!lista.some(x => marcados.has(x.ID)) || massa === '...'} onClick={aceitarMarcados}><Check size={14} />Aceitar sugestão nos marcados</Button>
          <Button size="sm" variant="secondary" disabled={!lista.some(x => marcados.has(x.ID)) || massa === '...'} onClick={() => tipoMarcados('nomeMusica', 'música')}><Music size={14} />É música</Button>
          <Button size="sm" variant="secondary" disabled={!lista.some(x => marcados.has(x.ID)) || massa === '...'} onClick={() => tipoMarcados('nomeAudiovisual', 'filme ou série')}><Clapperboard size={14} />É filme ou série</Button>
          <Button size="sm" variant="secondary" disabled={!lista.some(x => marcados.has(x.ID)) || massa === '...'} onClick={() => tipoMarcados('nomeSagrado', 'texto sagrado')}><BookOpen size={14} />É texto sagrado</Button>
        </div>
      )}
      {importar && (
        <Card className="p-4 flex flex-col gap-2">
          <label className="text-[12px] font-medium" style={muted}>Cole aqui o array JSON que o Claude devolveu</label>
          <textarea className="controle" rows={6} value={textoImportar} onChange={e => setTextoImportar(e.target.value)} placeholder='[{"nome":"...","titulo":"...","autor":"...","certeza":70,"motivo":"..."}]' />
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" disabled={!textoImportar.trim()} onClick={importarRespostas}><Check size={14} />Gravar sugestões</Button>
            {msgImportar && <span className="text-[12.5px]">{msgImportar}</span>}
          </div>
        </Card>
      )}

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
        {!grupo && lista.map(it => (
          <Card key={it.ID} className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <input type="checkbox" checked={marcados.has(it.ID)} onChange={() => marcar(it.ID)} aria-label="Marcar este nome" />
              <span className="text-[15px] font-medium">“{it.NOME}”</span>
              {it.AUTOR && <span className="text-[13px]" style={muted}>autor ouvido: {it.AUTOR}</span>}
              <Badge variant="neutral">{Number(it.VIDEOS)} {Number(it.VIDEOS) === 1 ? 'vídeo' : 'vídeos'}</Badge>
              {it.TIPO && <Badge variant="neutral">{({ livro: 'livro', musica: 'música', audiovisual: 'filme ou série', sagrado: 'texto sagrado', outro: 'outro' } as Record<string, string>)[it.TIPO] || it.TIPO}</Badge>}
            </div>
            {it.TIPO === 'outro' && !it.SUG_TITULO && it.MOTIVO && <p className="text-[13px]" style={muted}><Badge variant="neutral">Não identificado</Badge> {it.MOTIVO}</p>}
            {it.SUG_TITULO && <p className="text-[13px]" style={muted}>{it.CERTEZA != null && <Badge variant={Number(it.CERTEZA) >= 90 ? 'success' : 'neutral'}>{Number(it.CERTEZA)}% de certeza</Badge>} Sugestão: {it.SUG_TITULO}{it.SUG_AUTOR ? ', de ' + it.SUG_AUTOR : ''}{it.MOTIVO ? ' · ' + it.MOTIVO : ''}</p>}
            {aviso[it.ID] && <p className="text-[12.5px]">{aviso[it.ID]}</p>}
            {editando === it.ID ? (
              <div className="flex flex-col gap-2">
                <label className="text-[12px] font-medium" style={muted}>Colar texto da internet (preenche título e autor)</label>
                <textarea className="controle" rows={3} value={colado} placeholder='Ex.: A obra é "Título do livro", escrita por Fulano de Tal' onChange={e => { setColado(e.target.value); setLeitura('') }} />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="secondary" disabled={!colado.trim()} onClick={lerAgora}><Check size={14} />OK, ler texto</Button>
                  {leitura && <span className="text-[12.5px]">{leitura}</span>}
                </div>
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
