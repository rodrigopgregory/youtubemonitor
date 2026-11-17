import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from './ui/Card'
import Badge from './ui/Badge'
import Button from './ui/Button'
import { linhas, chamar } from '../lib/api'

interface Pend { ID: number; NOME: string; SUGESTAO_TITULO: string | null; SUGESTAO_AUTOR: string | null; MOTIVO: string | null; VIDEOS: number }

const muted = { color: 'var(--fg-muted)' }
const limpa = (s: string) => s.replace(/['"\\{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250)

export default function PendenciasLivros() {
  const [lista, setLista] = useState<Pend[] | null>(null)
  const [total, setTotal] = useState(0)
  const [outro, setOutro] = useState<number | null>(null)
  const [titulo, setTitulo] = useState('')
  const [autor, setAutor] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  function carregar() {
    linhas<Pend>('pendLista').then(setLista).catch(() => setLista([]))
    linhas<{ N: number }>('pendTotal').then(r => setTotal(Number(r[0]?.N || 0))).catch(() => {})
  }
  useEffect(carregar, [])

  async function aplicar(fn: () => Promise<unknown>) {
    setOcupado(true); setErro('')
    try { await fn(); setOutro(null); setTitulo(''); setAutor(''); carregar() }
    catch { setErro('Não deu certo agora. Tente de novo.') }
    setOcupado(false)
  }
  const aceitar = (p: Pend, t: string, a: string) => aplicar(async () => {
    const tit = limpa(t); if (!tit) throw new Error('vazio')
    await chamar('pendCatalogoCriar', { titulo: tit, autor: limpa(a) })
    await chamar('pendDecidir', { id: p.ID, titulo: tit })
  })
  const naoLivro = (p: Pend) => aplicar(() => chamar('pendNaoLivro', { id: p.ID }))

  if (!lista || !lista.length) return null
  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15.5px] font-semibold inline-flex items-center gap-2"><BookOpen size={17} />Entradas para validar</h2>
        <Badge variant="neutral">{total}</Badge>
      </div>
      <p className="text-[13px]" style={muted}>A busca no Google não confirmou estes nomes. Diga o que fazer com cada um.</p>
      {erro && <p className="text-[13px]">{erro}</p>}
      <div className="flex flex-col gap-4">
        {lista.slice(0, 5).map(p => (
          <div key={p.ID} className="flex flex-col gap-2">
            <span className="text-[14px] font-medium">“{p.NOME}” <span className="text-[12px] font-normal" style={muted}>em {p.VIDEOS} vídeo{p.VIDEOS === 1 ? '' : 's'}</span></span>
            {p.SUGESTAO_TITULO && <span className="text-[13px]" style={muted}>Talvez seja: {p.SUGESTAO_TITULO}{p.SUGESTAO_AUTOR ? ', de ' + p.SUGESTAO_AUTOR : ''}</span>}
            {p.MOTIVO && <span className="text-[12px]" style={muted}>{p.MOTIVO}</span>}
            {outro === p.ID ? (
              <div className="flex flex-col gap-2">
                <input className="controle" placeholder="Título do livro" value={titulo} onChange={e => setTitulo(e.target.value)} />
                <input className="controle" placeholder="Autor (opcional)" value={autor} onChange={e => setAutor(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={ocupado || !titulo.trim()} onClick={() => aceitar(p, titulo, autor)}>Salvar</Button>
                  <Button size="sm" variant="secondary" onClick={() => setOutro(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {p.SUGESTAO_TITULO && <Button size="sm" disabled={ocupado} onClick={() => aceitar(p, p.SUGESTAO_TITULO || '', p.SUGESTAO_AUTOR || '')}>Aceitar sugestão</Button>}
                <Button size="sm" variant="secondary" disabled={ocupado} onClick={() => { setOutro(p.ID); setTitulo(p.SUGESTAO_TITULO || ''); setAutor(p.SUGESTAO_AUTOR || '') }}>É outro livro</Button>
                <Button size="sm" variant="secondary" disabled={ocupado} onClick={() => naoLivro(p)}>Não é livro</Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Link to="/livros/validar" className="text-[13px] underline" style={muted}>Ver todas as entradas a validar</Link>
    </Card>
  )
}
