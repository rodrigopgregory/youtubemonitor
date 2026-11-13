import { linhas, mmss, linkYt, dataBr, duracao } from './api'

type VideoExp = { ID: number; YT_VIDEO_ID: string; TITULO: string; PUBLICADO_EM: string | null; DURACAO_SEG: number; ORIGEM: string; CANAL: string; RESUMO: string | null; TEMAS: string | null }
type Trecho = { VIDEO_ID: number; SEGUNDO: number; TEXTO: string }
type Progresso = (msg: string) => void

async function videosDoCanal(canalId: number) {
  const todos: VideoExp[] = []
  let depois = 0
  for (;;) {
    const pag = await linhas<VideoExp>('exportVideos', { canalId, depois })
    todos.push(...pag)
    if (pag.length < 500) break
    depois = pag[pag.length - 1].ID
  }
  return todos
}

function separarTemas(txt: string | null) {
  const temas: string[] = [], mentores: string[] = []
  for (const parte of String(txt || '').split('|').filter(Boolean)) {
    const nome = parte.split('=')[0]
    if (nome.startsWith('mentor: ')) mentores.push(nome.slice(8))
    else temas.push(nome)
  }
  return { temas, mentores }
}

function celula(v: unknown) {
  const s = String(v ?? '')
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function planilha(videos: VideoExp[]) {
  const cab = ['Canal', 'Título', 'Link', 'Publicado em', 'Duração', 'Temas', 'Mentores', 'Resumo']
  const corpo = videos.map(v => {
    const { temas, mentores } = separarTemas(v.TEMAS)
    return [v.CANAL, v.TITULO, linkYt(v.YT_VIDEO_ID), dataBr(v.PUBLICADO_EM), duracao(Number(v.DURACAO_SEG || 0)), temas.join(', '), mentores.join(', '), v.RESUMO || ''].map(celula).join(';')
  })
  return '\ufeff' + [cab.join(';'), ...corpo].join('\r\n')
}

function nomeArquivo(base: string) {
  return base.normalize('NFC').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'canal'
}

function baixar(dados: Blob, nome: string) {
  const url = URL.createObjectURL(dados)
  const a = document.createElement('a')
  a.href = url; a.download = nome
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function exportarTemas(canalId: number, canalNome: string, progresso: Progresso) {
  progresso('Buscando os vídeos…')
  const videos = await videosDoCanal(canalId)
  baixar(new Blob([planilha(videos)], { type: 'text/csv;charset=utf-8' }), nomeArquivo(canalNome) + ' - temas.csv')
  return videos.length
}

const TABELA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crc32(b: Uint8Array) {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function montarZip(arquivos: { nome: string; dados: Uint8Array }[]) {
  const enc = new TextEncoder()
  const partes: BlobPart[] = [], central: Uint8Array[] = []
  let pos = 0
  for (const arq of arquivos) {
    const nome = enc.encode(arq.nome), crc = crc32(arq.dados), tam = arq.dados.length
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true)
    local.setUint32(14, crc, true); local.setUint32(18, tam, true); local.setUint32(22, tam, true); local.setUint16(26, nome.length, true)
    partes.push(local.buffer, nome, arq.dados as BlobPart)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true)
    cd.setUint32(16, crc, true); cd.setUint32(20, tam, true); cd.setUint32(24, tam, true); cd.setUint16(28, nome.length, true); cd.setUint32(42, pos, true)
    const reg = new Uint8Array(46 + nome.length); reg.set(new Uint8Array(cd.buffer), 0); reg.set(nome, 46)
    central.push(reg)
    pos += 30 + nome.length + tam
  }
  const tamCentral = central.reduce((a, c) => a + c.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true)
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true)
  return new Blob([...partes, ...central.map(c => c as BlobPart), fim.buffer], { type: 'application/zip' })
}

export async function exportarTranscricoes(canalId: number, canalNome: string, progresso: Progresso) {
  progresso('Buscando os vídeos…')
  const videos = await videosDoCanal(canalId)
  const textos = new Map<number, string[]>()
  let video = 0, segundo = -1, total = 0
  for (;;) {
    const pag = await linhas<Trecho>('exportTrechos', { canalId, video, segundo })
    for (const t of pag) {
      const lista = textos.get(t.VIDEO_ID) ?? []
      lista.push('[' + mmss(Number(t.SEGUNDO)) + '] ' + t.TEXTO)
      textos.set(t.VIDEO_ID, lista)
    }
    total += pag.length
    progresso(`Juntando as transcrições… ${textos.size} de ${videos.length} vídeos`)
    if (pag.length < 5000) break
    const ult = pag[pag.length - 1]
    video = ult.VIDEO_ID; segundo = Number(ult.SEGUNDO)
  }
  progresso('Montando o ZIP…')
  const enc = new TextEncoder()
  const ordenados = [...videos].sort((a, b) => String(a.PUBLICADO_EM || '').localeCompare(String(b.PUBLICADO_EM || '')))
  const usados = new Set<string>()
  const arquivos = ordenados.filter(v => textos.has(v.ID)).map(v => {
    const { temas, mentores } = separarTemas(v.TEMAS)
    const data = (v.PUBLICADO_EM || '').slice(0, 10)
    let nome = nomeArquivo((data ? data + ' - ' : '') + v.TITULO)
    while (usados.has(nome)) nome += '_'
    usados.add(nome)
    const cab = [v.TITULO, linkYt(v.YT_VIDEO_ID), 'Publicado em: ' + dataBr(v.PUBLICADO_EM) + '  ·  Duração: ' + duracao(Number(v.DURACAO_SEG || 0)),
      temas.length ? 'Temas: ' + temas.join(', ') : '', mentores.length ? 'Mentores: ' + mentores.join(', ') : '', v.RESUMO ? '\nResumo: ' + v.RESUMO : ''].filter(Boolean)
    return { nome: nome + '.txt', dados: enc.encode(cab.join('\n') + '\n\nTranscrição\n\n' + (textos.get(v.ID) ?? []).join('\n') + '\n') }
  })
  arquivos.unshift({ nome: '_indice.csv', dados: enc.encode(planilha(ordenados)) })
  baixar(montarZip(arquivos), nomeArquivo(canalNome) + ' - transcrições.zip')
  return { videos: arquivos.length - 1, trechos: total }
}

type Parte = Uint8Array
type ArquivoZip = { nome: string; partes: Parte[] }

function crcPartes(partes: Parte[]) {
  let c = 0xffffffff
  for (const b of partes) for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zipPartes(arquivos: ArquivoZip[]) {
  const enc = new TextEncoder()
  const saida: BlobPart[] = [], central: Uint8Array[] = []
  let pos = 0
  for (const arq of arquivos) {
    const nome = enc.encode(arq.nome), crc = crcPartes(arq.partes), tam = arq.partes.reduce((a, p) => a + p.length, 0)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true)
    local.setUint32(14, crc, true); local.setUint32(18, tam, true); local.setUint32(22, tam, true); local.setUint16(26, nome.length, true)
    saida.push(local.buffer, nome as BlobPart, ...arq.partes.map(p => p as BlobPart))
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true)
    cd.setUint32(16, crc, true); cd.setUint32(20, tam, true); cd.setUint32(24, tam, true); cd.setUint16(28, nome.length, true); cd.setUint32(42, pos, true)
    const reg = new Uint8Array(46 + nome.length); reg.set(new Uint8Array(cd.buffer), 0); reg.set(nome, 46)
    central.push(reg)
    pos += 30 + nome.length + tam
  }
  const tamCentral = central.reduce((a, c) => a + c.length, 0)
  const fim = new DataView(new ArrayBuffer(22))
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true)
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true)
  return new Blob([...saida, ...central.map(c => c as BlobPart), fim.buffer], { type: 'application/zip' })
}

function celulaCsv(v: unknown) {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'boolean' ? (v ? '1' : '0') : String(v)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

const TABELAS: { tabela: string; funcao: Parameters<typeof linhas>[0]; pagina: number }[] = [
  { tabela: 'CANAIS', funcao: 'exportTabCanais', pagina: 5000 },
  { tabela: 'VIDEOS', funcao: 'exportTabVideos', pagina: 2000 },
  { tabela: 'TEMAS', funcao: 'exportTabTemas', pagina: 5000 },
  { tabela: 'VIDEO_TEMAS', funcao: 'exportTabVideoTemas', pagina: 5000 },
  { tabela: 'PLAYLISTS', funcao: 'exportTabPlaylists', pagina: 5000 },
  { tabela: 'PLAYLIST_VIDEOS', funcao: 'exportTabPlaylistVideos', pagina: 5000 },
  { tabela: 'AVISOS', funcao: 'exportTabAvisos', pagina: 5000 },
  { tabela: 'TRECHOS', funcao: 'exportTabTrechos', pagina: 5000 },
]

type Coluna = { TABLE_NAME: string; COLUMN_NAME: string; COLUMN_TYPE: string; IS_NULLABLE: string; COLUMN_KEY: string; COLUMN_DEFAULT: string | null; EXTRA: string }
type Indice = { TABLE_NAME: string; INDEX_NAME: string; NON_UNIQUE: number; COLUNAS: string }

function montarEsquema(colunas: Coluna[], indices: Indice[]) {
  const porTabela = new Map<string, Coluna[]>()
  for (const c of colunas) porTabela.set(c.TABLE_NAME, [...(porTabela.get(c.TABLE_NAME) ?? []), c])
  const blocos: string[] = ['-- Estrutura do banco do Monitor de Canais do YouTube (MySQL 8)', 'SET NAMES utf8mb4;', '']
  for (const [tabela, cols] of porTabela) {
    const linhasSql = cols.map(c => {
      let def = `  \`${c.COLUMN_NAME}\` ${c.COLUMN_TYPE}`
      if (c.IS_NULLABLE === 'NO') def += ' NOT NULL'
      if (c.COLUMN_DEFAULT !== null && c.COLUMN_DEFAULT !== undefined && !/auto_increment/i.test(c.EXTRA)) def += ` DEFAULT '${String(c.COLUMN_DEFAULT).replace(/'/g, "''")}'`
      if (/auto_increment/i.test(c.EXTRA)) def += ' AUTO_INCREMENT'
      return def
    })
    for (const i of indices.filter(x => x.TABLE_NAME === tabela)) {
      const cols = i.COLUNAS.split(',').map(n => '`' + n + '`').join(', ')
      if (i.INDEX_NAME === 'PRIMARY') linhasSql.push(`  PRIMARY KEY (${cols})`)
      else linhasSql.push(`  ${Number(i.NON_UNIQUE) ? 'KEY' : 'UNIQUE KEY'} \`${i.INDEX_NAME}\` (${cols})`)
    }
    blocos.push(`CREATE TABLE IF NOT EXISTS \`${tabela}\` (\n${linhasSql.join(',\n')}\n) DEFAULT CHARSET=utf8mb4;`, '')
  }
  blocos.push('-- Para carregar os dados: LOAD DATA LOCAL INFILE \'dados/VIDEOS.csv\' INTO TABLE VIDEOS CHARACTER SET utf8mb4', "--   FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '\"' LINES TERMINATED BY '\\r\\n' IGNORE 1 LINES;", '-- (repita para cada arquivo da pasta dados; carregue CANAIS e TEMAS antes das demais)')
  return blocos.join('\n')
}

const LEIAME = `# Monitor de Canais do YouTube — pacote completo

Este pacote tem tudo o que é preciso para levar o sistema para outra plataforma ou outra IA.

## O que tem aqui

- codigo/ — o código do app.
  - codigo/frontend — as telas (React + Vite + Tailwind). Rode \`npm install\` e \`npm run build\`.
  - codigo/backend/sf — o "motor" e as demais funções em JavaScript (estudo dos vídeos, cadastro de canal, chat, resumo).
  - codigo/backend/criar-funcoes.mjs e funcoes-tela.mjs — todas as consultas SQL que o app usa, com nome e descrição.
  - codigo/backend/setup-backend.mjs — como as tabelas foram criadas.
  - codigo/ESCOPO.md — o escopo funcional completo do sistema.
- banco/esquema.sql — a estrutura de todas as tabelas (MySQL 8), com chaves e índices.
- dados/*.csv — todos os dados, uma planilha por tabela (separador vírgula, UTF-8, primeira linha com os nomes das colunas).
  - CANAIS: os canais monitorados.
  - VIDEOS: cada vídeo, com status, resumo e datas.
  - TRECHOS: a transcrição, trecho a trecho (VIDEO_ID + SEGUNDO + TEXTO).
  - TEMAS e VIDEO_TEMAS: os temas e em quais vídeos (e momentos, em segundos) aparecem.
  - PLAYLISTS e PLAYLIST_VIDEOS: as playlists de cada canal e seus vídeos.
  - AVISOS: os avisos de vídeos novos.
  - CONFIG: os parâmetros do motor (modelos de IA, horário da checagem etc.).

## O que NÃO vem no pacote

- Chaves e senhas (chave do Gemini, acesso ao Mitra). Na nova plataforma, crie chaves novas.
- O app chama duas integrações: "youtube-web" (https://www.youtube.com, sem chave) e as conexões do Gemini
  (https://generativelanguage.googleapis.com, com chave de API), listadas em CONFIG.GEMINI_CONEXOES.
  No código, troque a chamada callIntegrationMitra por uma chamada HTTP comum a esses endereços.

## Como remontar

1. Crie um banco MySQL 8 e rode banco/esquema.sql.
2. Carregue cada CSV da pasta dados na tabela de mesmo nome (instrução no fim do esquema.sql).
3. Adapte as funções de codigo/backend para a nova plataforma (cada consulta SQL vira uma rota ou função).
4. O motor (codigo/backend/sf/motor.js) roda de hora em hora; a checagem de vídeos novos é diária às 6h (horário de Brasília).
`

export async function exportarTudo(progresso: Progresso) {
  const enc = new TextEncoder()
  const arquivos: ArquivoZip[] = []
  progresso('Juntando o código do app…')
  const resp = await fetch('./codigo-fonte.json', { cache: 'no-store' })
  if (resp.ok) {
    const fonte = await resp.json() as Record<string, string>
    for (const [nome, txt] of Object.entries(fonte).sort(([a], [b]) => a.localeCompare(b))) arquivos.push({ nome: 'codigo/' + nome, partes: [enc.encode(txt)] })
  }
  progresso('Lendo a estrutura do banco…')
  const [colunas, indices] = await Promise.all([linhas<Coluna>('exportEstrutura'), linhas<Indice>('exportIndices')])
  arquivos.push({ nome: 'banco/esquema.sql', partes: [enc.encode(montarEsquema(colunas, indices))] })
  const totais: Record<string, number> = {}
  const config = await linhas<Record<string, unknown>>('exportTabConfig')
  arquivos.push({ nome: 'dados/CONFIG.csv', partes: [enc.encode('\ufeffCHAVE,VALOR\r\n' + config.map(r => celulaCsv(r.CHAVE) + ',' + celulaCsv(r.VALOR)).join('\r\n') + '\r\n')] })
  totais.CONFIG = config.length
  for (const t of TABELAS) {
    const nomesCol = colunas.filter(c => c.TABLE_NAME === t.tabela).map(c => c.COLUMN_NAME).filter(n => n !== 'STAGE_JSON')
    const partes: Parte[] = [enc.encode('\ufeff' + nomesCol.join(',') + '\r\n')]
    let depois = 0, n = 0
    for (;;) {
      const pag = await linhas<Record<string, unknown>>(t.funcao, { depois })
      if (pag.length) partes.push(enc.encode(pag.map(r => nomesCol.map(c => celulaCsv(r[c])).join(',')).join('\r\n') + '\r\n'))
      n += pag.length
      progresso(`Copiando os dados: ${t.tabela} (${n.toLocaleString('pt-BR')} linhas)…`)
      if (pag.length < t.pagina) break
      depois = Number(pag[pag.length - 1].ID)
    }
    totais[t.tabela] = n
    arquivos.push({ nome: `dados/${t.tabela}.csv`, partes })
  }
  const resumo = Object.entries(totais).map(([k, v]) => `- ${k}: ${v.toLocaleString('pt-BR')} linhas`).join('\n')
  arquivos.unshift({ nome: 'LEIA-ME.md', partes: [enc.encode(LEIAME + '\n## Conteúdo desta cópia (' + new Date().toLocaleString('pt-BR') + ')\n\n' + resumo + '\n')] })
  progresso('Montando o ZIP…')
  const data = new Date().toISOString().slice(0, 10)
  baixar(zipPartes(arquivos), `Monitor de Canais - pacote completo ${data}.zip`)
  return { arquivos: arquivos.length, trechos: totais.TRECHOS ?? 0, videos: totais.VIDEOS ?? 0 }
}
