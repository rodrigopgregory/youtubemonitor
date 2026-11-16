import { useCallback, useEffect, useState } from 'react'
import { Plus, X, Trash2, BookOpen } from 'lucide-react'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Select from '../components/ui/Select'
import { linhas, chamar } from '../lib/api'
import { exportarNotebookLM } from '../lib/exportar'
import PacoteExport from '../components/PacoteExport'

interface Mentor { ID: number; NOME: string; QTD: number }
interface Regra { ID: number; NOME: string; TIPO: 'MENTOR' | 'APELIDO' | 'NAO'; DESTINO: string | null }
interface Canal { ID: number; NOME: string; TEM_MENTOR: number }
type Config = Record<string, string>
type Res = { ok: boolean; msg?: string; erro?: string; config?: Config; canais?: Canal[]; agora?: string }
type Aviso = { t: string; erro?: boolean } | null

const muted = { color: 'var(--fg-muted)' }

function Aviso({ a }: { a: Aviso }) {
  if (!a) return null
  return <p className="text-[13px]" style={{ color: a.erro ? 'var(--danger)' : 'var(--success-text)' }}>{a.t}</p>
}

function Chave({ ligado, onChange, disabled }: { ligado: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} disabled={disabled} onClick={() => onChange(!ligado)}
      className="relative w-10 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50"
      style={{ background: ligado ? 'var(--accent)' : 'var(--border)' }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: ligado ? 18 : 2, background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }} />
    </button>
  )
}

function Linha({ titulo, nota, children }: { titulo: string; nota: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3 border-t first:border-t-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium">{titulo}</div>
        <div className="text-[12.5px]" style={muted}>{nota}</div>
      </div>
      {children}
    </div>
  )
}

export default function ConfiguracoesPage() {
  const [mentores, setMentores] = useState<Mentor[]>([])
  const [regras, setRegras] = useState<Regra[]>([])
  const [config, setConfig] = useState<Config | null>(null)
  const [canais, setCanais] = useState<Canal[]>([])
  const [apelido, setApelido] = useState('')
  const [destino, setDestino] = useState('')
  const [naoNome, setNaoNome] = useState('')
  const [minutos, setMinutos] = useState('')
  const [avisoMent, setAvisoMent] = useState<Aviso>(null)
  const [avisoEst, setAvisoEst] = useState<Aviso>(null)
  const [salvando, setSalvando] = useState(false)

  const carregarMentores = useCallback(() => {
    linhas<Mentor>('mentoresGerir').then(setMentores)
    linhas<Regra>('mentorRegrasListar').then(setRegras)
  }, [])
  const [agoraBR, setAgoraBR] = useState('')
  const aplicar = (r: Res) => {
    if (r.agora) setAgoraBR(r.agora)
    if (r.config) { setConfig(r.config); setMinutos(String(Math.round(Number(r.config.DURACAO_MIN_SEG || 600) / 60))) }
    if (r.canais) setCanais(r.canais)
  }
  useEffect(() => {
    carregarMentores()
    chamar<Res>('configEditar', { acao: 'ler' }).then(aplicar).catch(() => setAvisoEst({ t: 'Não foi possível carregar os ajustes agora.', erro: true }))
  }, [carregarMentores])

  async function mentor(input: Record<string, unknown>, depois?: () => void) {
    setSalvando(true); setAvisoMent(null)
    try {
      const r = await chamar<Res>('mentorEditar', input)
      setAvisoMent(r.ok ? { t: r.msg || 'Feito.' } : { t: r.erro || 'Não foi possível salvar.', erro: true })
      if (r.ok) { depois?.(); carregarMentores() }
    } catch (e) { setAvisoMent({ t: (e as Error).message, erro: true }) } finally { setSalvando(false) }
  }

  async function ajuste(input: Record<string, unknown>) {
    setSalvando(true); setAvisoEst(null)
    try {
      const r = await chamar<Res>('configEditar', input)
      if (r.ok) { aplicar(r); setAvisoEst({ t: 'Salvo. Vale a partir da próxima rodada do estudo.' }) }
      else setAvisoEst({ t: r.erro || 'Não foi possível salvar.', erro: true })
    } catch (e) { setAvisoEst({ t: (e as Error).message, erro: true }) } finally { setSalvando(false) }
  }

  const apelidos = regras.filter(r => r.TIPO === 'APELIDO')
  const [nbCanal, setNbCanal] = useState('0')
  const [nb, setNb] = useState<{ rodando: boolean; msg: string } | null>(null)
  async function baixarNotebook() {
    const escolhidos = nbCanal === '0' ? canais : canais.filter(c => String(c.ID) === nbCanal)
    if (!escolhidos.length) return
    setNb({ rodando: true, msg: 'Começando…' })
    try {
      const r = await exportarNotebookLM(escolhidos, m => setNb({ rodando: true, msg: m }))
      setNb({ rodando: false, msg: `Baixado: ${r.videos.toLocaleString('pt-BR')} vídeos em ${r.arquivos} arquivos. Envie os .txt em "Adicionar fontes" no NotebookLM.` })
    } catch { setNb({ rodando: false, msg: 'Não foi possível montar os arquivos agora. Tente de novo em instantes.' }) }
  }
  const naoSao = regras.filter(r => r.TIPO === 'NAO')
  const liga = (k: string) => config?.[k] !== '0'
  const dataHora = (iso: string) => { const [d, h] = iso.split('T'); const [, mes, dia] = d.split('-'); return `${dia}/${mes} às ${h.slice(0, 5)}` }
  const livroPausa = config?.LIVRO_PAUSA_ATE && agoraBR && config.LIVRO_PAUSA_ATE > agoraBR ? config.LIVRO_PAUSA_ATE : ''
  const iaPausa = config?.IA_PAUSADA_ATE && agoraBR && config.IA_PAUSADA_ATE > agoraBR ? config.IA_PAUSADA_ATE : ''
  const minAtual = config ? String(Math.round(Number(config.DURACAO_MIN_SEG || 600) / 60)) : ''

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-semibold">Configurações</h1>
        <p className="text-[13.5px]" style={muted}>Regras que o estudo dos próximos vídeos segue.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold">Mentores</h2>
        <Aviso a={avisoMent} />
        <div className="grid gap-3 md:grid-cols-2 [&>*]:min-w-0">
          <Card className="p-5 flex flex-col gap-2">
            <h3 className="text-[15px] font-medium">Outros jeitos de escrever</h3>
            <p className="text-[12.5px]" style={muted}>Quando o estudo achar o nome da esquerda, marca o mentor da direita.</p>
            {apelidos.map(r => (
              <div key={r.ID} className="flex items-center gap-2 text-[13.5px]">
                <span>{r.NOME}</span><span style={{ color: 'var(--fg-subtle)' }}>→</span><Badge variant="accent">{r.DESTINO}</Badge>
                <button className="ml-auto" title="Apagar regra" style={muted} onClick={() => mentor({ acao: 'apagarRegra', id: r.ID })}><Trash2 size={14} /></button>
              </div>))}
            {apelidos.length === 0 && <p className="text-[13px]" style={{ color: 'var(--fg-subtle)' }}>Nenhum.</p>}
            <form className="flex flex-col gap-1.5 mt-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}
              onSubmit={e => { e.preventDefault(); mentor({ acao: 'apelido', nome: apelido, destinoId: Number(destino) }, () => { setApelido(''); setDestino('') }) }}>
              <span className="text-[12.5px] font-medium">Vincular um nome à mão</span>
              <input className="controle h-8" placeholder="Como aparece escrito, ex.: Pai Joaquin" value={apelido} onChange={e => setApelido(e.target.value)} />
              <Select placeholder="Mentor certo" value={destino} onChange={setDestino} searchThreshold={0}
                options={mentores.map(m => ({ value: String(m.ID), label: m.NOME }))} />
              <Button size="sm" variant="secondary" type="submit" className="self-start" disabled={salvando || apelido.trim().length < 2 || !destino}><Plus size={14} />Vincular</Button>
            </form>
          </Card>
          <Card className="p-5 flex flex-col gap-2">
            <h3 className="text-[15px] font-medium">Não são mentores</h3>
            <p className="text-[12.5px]" style={muted}>Médiuns, pessoas e nomes só citados. O estudo nunca marca estes.</p>
            <div className="flex flex-wrap gap-1.5">
              {naoSao.map(r => (
                <span key={r.ID} className="inline-flex items-center gap-1"><Badge variant="neutral">{r.NOME}</Badge>
                  <button title="Apagar regra" style={muted} onClick={() => mentor({ acao: 'apagarRegra', id: r.ID })}><X size={12} /></button></span>))}
              {naoSao.length === 0 && <p className="text-[13px]" style={{ color: 'var(--fg-subtle)' }}>Nenhum.</p>}
            </div>
            <form className="flex gap-1.5 mt-1" onSubmit={e => { e.preventDefault(); mentor({ acao: 'naoMentorNome', nome: naoNome }, () => setNaoNome('')) }}>
              <input className="controle h-8 flex-1" placeholder="Acrescentar nome" value={naoNome} onChange={e => setNaoNome(e.target.value)} />
              <Button size="sm" variant="secondary" type="submit" disabled={salvando || naoNome.trim().length < 2}><Plus size={14} />Acrescentar</Button>
            </form>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold">Estudo dos vídeos</h2>
        <Aviso a={avisoEst} />
        <Card className="px-5 py-2">
          {!config && <p className="py-3 text-[13.5px]" style={muted}>Carregando…</p>}
          {config && <>
            <Linha titulo="Duração mínima" nota="Vídeos com essa duração ou menos (cortes, avisos) não são estudados.">
              <form className="flex items-center gap-1.5" onSubmit={e => { e.preventDefault(); ajuste({ acao: 'gravar', chave: 'DURACAO_MIN_SEG', valor: Number(minutos) * 60 }) }}>
                <input className="controle h-8 w-16 text-right" type="number" min={0} max={120} value={minutos} onChange={e => setMinutos(e.target.value)} />
                <span className="text-[13px]" style={muted}>min</span>
                {minutos !== minAtual && <Button size="sm" variant="primary" type="submit" disabled={salvando || minutos === ''}>Salvar</Button>}
              </form>
            </Linha>
            <Linha titulo="Hora de procurar vídeos novos" nota="Uma vez por dia, a partir desta hora (horário de Brasília).">
              <div className="w-28"><Select value={config.HORA_CHECAGEM} searchThreshold={99} disabled={salvando}
                onChange={v => ajuste({ acao: 'gravar', chave: 'HORA_CHECAGEM', valor: v })}
                options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: String(h).padStart(2, '0') + ':00' }))} /></div>
            </Linha>
            <Linha titulo="Transcrever pelo áudio" nota="Quando o vídeo não tem legenda no YouTube, a IA ouve o áudio. Pode errar mais em nomes próprios.">
              <Chave ligado={liga('AUDIO_LIGADO')} disabled={salvando} onChange={v => ajuste({ acao: 'gravar', chave: 'AUDIO_LIGADO', valor: v })} />
            </Linha>
            <Linha titulo="Procurar práticas" nota="Lê os vídeos estudados atrás de meditações, banhos, preces e outros trabalhos ensinados.">
              <Chave ligado={liga('PRATICAS_LIGADO')} disabled={salvando} onChange={v => ajuste({ acao: 'gravar', chave: 'PRATICAS_LIGADO', valor: v })} />
            </Linha>
            <Linha titulo="Conferir mentores já marcados" nota="Revê com a IA os mentores marcados nos vídeos antigos e tira os que não conduzem a live.">
              <Chave ligado={liga('CONFERIR_MENTOR')} disabled={salvando} onChange={v => ajuste({ acao: 'gravar', chave: 'CONFERIR_MENTOR', valor: v })} />
            </Linha>
            <Linha titulo="Organizar cada prática" nota="A IA diz o jeito de fazer, para que serve e quando fazer cada prática nova, e esconde os simples conselhos. É o que monta a tela Práticas.">
              <Chave ligado={liga('FINALIDADE_LIGADO')} disabled={salvando} onChange={v => ajuste({ acao: 'gravar', chave: 'FINALIDADE_LIGADO', valor: v })} />
            </Linha>
            <Linha titulo="Situação da IA" nota={iaPausa ? `Sem cota grátis por hoje. Volta a trabalhar em ${dataHora(iaPausa)}.` : 'Trabalhando normalmente.'}>
              <span className="text-[12.5px] px-2 py-0.5 rounded-full shrink-0" style={{ background: iaPausa ? 'var(--warning-soft)' : 'var(--success-soft)', color: iaPausa ? 'var(--warning-text)' : 'var(--success-text)' }}>{iaPausa ? 'Em pausa' : 'Ativa'}</span>
            </Linha>
          </>}
        </Card>
        {config && (
          <Card className="px-5 py-2">
            <p className="pt-3 text-[13.5px] font-medium">Livro Vivo</p>
            <Linha titulo="Escrever sozinho de madrugada" nota={config.LIVRO_LIGADO === '0' ? 'Desligado. Fica assim até você ligar de novo.' : livroPausa ? `Pausado até ${dataHora(livroPausa)}. Depois volta sozinho.` : 'Ligado. A IA escreve capítulos novos entre 1h e 7h.'}>
              <Chave ligado={liga('LIVRO_LIGADO')} disabled={salvando} onChange={v => ajuste({ acao: 'gravar', chave: 'LIVRO_LIGADO', valor: v })} />
            </Linha>
            {config.LIVRO_LIGADO !== '0' && <>
              <Linha titulo="Capítulos por madrugada" nota="Mais capítulos gastam mais cota da IA.">
                <div className="w-20"><Select value={config.LIVRO_POR_NOITE || '2'} searchThreshold={99} disabled={salvando}
                  onChange={v => ajuste({ acao: 'gravar', chave: 'LIVRO_POR_NOITE', valor: v })}
                  options={Array.from({ length: 5 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} /></div>
              </Linha>
              <Linha titulo="Pausar por 24 horas" nota={livroPausa ? 'Pausa ativa.' : 'Não escreve nas próximas 24 horas e depois volta sozinho.'}>
                {livroPausa
                  ? <Button size="sm" variant="secondary" disabled={salvando} onClick={() => ajuste({ acao: 'gravar', chave: 'LIVRO_PAUSA_ATE', valor: '' })}>Tirar pausa</Button>
                  : <Button size="sm" variant="secondary" disabled={salvando} onClick={() => ajuste({ acao: 'gravar', chave: 'LIVRO_PAUSA_ATE', valor: '24h' })}>Pausar 24h</Button>}
              </Linha>
            </>}
          </Card>
        )}
        {canais.length > 0 && (
          <Card className="px-5 py-2">
            <p className="pt-3 text-[13.5px] font-medium">Canais com mentores</p>
            <p className="text-[12.5px]" style={muted}>Ligue nos canais em que um mentor (espírito) conduz as lives. Nos outros, o estudo não procura mentor.</p>
            {canais.map(c => (
              <Linha key={c.ID} titulo={c.NOME} nota={c.TEM_MENTOR ? 'Procura mentor' : 'Não procura mentor'}>
                <Chave ligado={!!c.TEM_MENTOR} disabled={salvando} onChange={v => ajuste({ acao: 'canalMentor', canalId: c.ID, tem: v })} />
              </Linha>))}
          </Card>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-[16px] font-semibold">Exportar</h2>
        <Card className="p-5"><PacoteExport /></Card>
        <Card className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-[13.5px] flex-1" style={muted}>Baixa as transcrições dos vídeos estudados num ZIP pronto para o NotebookLM: poucos arquivos de texto por canal, cada um abaixo do limite de uma fonte, com título, link, data, temas e resumo de cada vídeo. Depois é só enviar os arquivos em "Adicionar fontes" no NotebookLM.</p>
          <div className="flex flex-col sm:items-end gap-2 sm:max-w-[320px]">
            <Select value={nbCanal} onChange={setNbCanal} disabled={!!nb?.rodando} options={[{ value: '0', label: 'Todos os canais' }, ...canais.map(c => ({ value: String(c.ID), label: c.NOME }))]} />
            <Button variant="secondary" disabled={!!nb?.rodando || !canais.length} onClick={baixarNotebook}>
              <BookOpen size={15} />{nb?.rodando ? 'Montando os arquivos…' : 'Exportar para o NotebookLM'}
            </Button>
            {nb && <p className="text-[12.5px] sm:text-right" style={muted}>{nb.msg}</p>}
          </div>
        </Card>
      </section>
    </div>
  )
}
