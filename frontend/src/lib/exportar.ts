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

function origemNome(o: string | null | undefined) {
  return o === 'AUDIO' ? 'Pelo áudio' : o === 'YOUTUBE' ? 'Legenda do YouTube' : ''
}

function celula(v: unknown) {
  const s = String(v ?? '')
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function planilha(videos: VideoExp[]) {
  const cab = ['Canal', 'Título', 'Link', 'Publicado em', 'Duração', 'Origem da transcrição', 'Temas', 'Mentores', 'Resumo']
  const corpo = videos.map(v => {
    const { temas, mentores } = separarTemas(v.TEMAS)
    return [v.CANAL, v.TITULO, linkYt(v.YT_VIDEO_ID), dataBr(v.PUBLICADO_EM), duracao(Number(v.DURACAO_SEG || 0)), origemNome(v.ORIGEM), temas.join(', '), mentores.join(', '), v.RESUMO || ''].map(celula).join(';')
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
type VideoFiltro = VideoExp & { STATUS: string; PLAYLISTS: string | null; PRATICAS: string | null }
export type FiltroVideos = Record<string, string | number>
const statusNome: Record<string, string> = { ESTUDADO: 'Estudado', FILA: 'Na fila', PENDENTE: 'Pendente' }

export async function exportarVideosFiltro(filtro: FiltroVideos, nome: string, progresso: Progresso) {
  const todos: VideoFiltro[] = []
  let depois = 0
  for (;;) {
    progresso(todos.length ? `Buscando os vídeos… ${todos.length}` : 'Buscando os vídeos…')
    const pag = await linhas<VideoFiltro>('exportVideosFiltro', { ...filtro, depois })
    todos.push(...pag)
    if (pag.length < 500) break
    depois = pag[pag.length - 1].ID
  }
  todos.sort((a, b) => String(b.PUBLICADO_EM || '').localeCompare(String(a.PUBLICADO_EM || '')))
  const cab = ['Canal', 'Título', 'Link', 'Publicado em', 'Duração', 'Origem da transcrição', 'Situação', 'Playlists', 'Temas', 'Mentores', 'Práticas', 'Resumo']
  const corpo = todos.map(v => {
    const { temas, mentores } = separarTemas(v.TEMAS)
    return [v.CANAL, v.TITULO, linkYt(v.YT_VIDEO_ID), dataBr(v.PUBLICADO_EM), duracao(Number(v.DURACAO_SEG || 0)), origemNome(v.ORIGEM), statusNome[v.STATUS] || v.STATUS, v.PLAYLISTS || '', temas.join(', '), mentores.join(', '), v.PRATICAS || '', v.RESUMO || ''].map(celula).join(';')
  })
  baixar(new Blob(['\ufeff' + [cab.join(';'), ...corpo].join('\r\n')], { type: 'text/csv;charset=utf-8' }), nomeArquivo(nome) + '.csv')
  return todos.length
}

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

const LIMITE_PALAVRAS = 430000

export async function exportarNotebookLM(canais: { ID: number; NOME: string }[], progresso: Progresso) {
  const enc = new TextEncoder()
  const arquivos: ArquivoZip[] = []
  const resumo: string[] = []
  let totalVideos = 0
  for (const canal of canais) {
    progresso(`${canal.NOME}: buscando os vídeos…`)
    const videos = (await videosDoCanal(canal.ID)).sort((a, b) => String(a.PUBLICADO_EM || '').localeCompare(String(b.PUBLICADO_EM || '')))
    const textos = new Map<number, { bytes: Uint8Array[]; palavras: number }>()
    let video = 0, segundo = -1
    for (;;) {
      const pag = await linhas<Trecho>('exportTrechos', { canalId: canal.ID, video, segundo })
      for (const t of pag) {
        const atual = textos.get(t.VIDEO_ID) ?? { bytes: [], palavras: 0 }
        const linha = '[' + mmss(Number(t.SEGUNDO)) + '] ' + t.TEXTO + '\n'
        atual.bytes.push(enc.encode(linha))
        atual.palavras += linha.split(/\s+/).filter(Boolean).length
        textos.set(t.VIDEO_ID, atual)
      }
      progresso(`${canal.NOME}: juntando as transcrições… ${textos.size.toLocaleString('pt-BR')} de ${videos.length.toLocaleString('pt-BR')} vídeos`)
      if (pag.length < 5000) break
      const ult = pag[pag.length - 1]
      video = ult.VIDEO_ID; segundo = Number(ult.SEGUNDO)
    }
    const pasta = nomeArquivo(canal.NOME)
    let partes: Parte[] = [], palavras = 0, primeiro = '', ultimo = '', n = 0, qtd = 0
    const fechar = () => {
      if (!partes.length) return
      n++
      const periodo = primeiro === ultimo ? primeiro : primeiro + ' a ' + ultimo
      const cab = enc.encode(`${canal.NOME} - transcrições, parte ${n}\nVídeos publicados de ${periodo || 'data desconhecida'} (${qtd} vídeos)\nCada vídeo começa com o título, o link do YouTube, a data, os temas e o resumo. Os números entre colchetes são o minuto da fala no vídeo.\n\n`)
      arquivos.push({ nome: `${pasta}/${pasta} - parte ${String(n).padStart(2, '0')}.txt`, partes: [cab, ...partes] })
      partes = []; palavras = 0; primeiro = ''; qtd = 0
    }
    for (const v of videos) {
      const t = textos.get(v.ID)
      if (!t) continue
      if (palavras && palavras + t.palavras > LIMITE_PALAVRAS) fechar()
      const { temas, mentores } = separarTemas(v.TEMAS)
      const dataTxt = dataBr(v.PUBLICADO_EM)
      const cab = ['==========', 'VÍDEO: ' + v.TITULO, 'Canal: ' + canal.NOME, 'Link: ' + linkYt(v.YT_VIDEO_ID), 'Publicado em: ' + dataTxt + '  ·  Duração: ' + duracao(Number(v.DURACAO_SEG || 0))]
      if (temas.length) cab.push('Temas: ' + temas.join(', '))
      if (mentores.length) cab.push('Mentores: ' + mentores.join(', '))
      if (v.RESUMO) cab.push('Resumo: ' + v.RESUMO)
      cab.push('', 'Transcrição:', '')
      partes.push(enc.encode(cab.join('\n') + '\n'), ...t.bytes, enc.encode('\n'))
      palavras += t.palavras + cab.join(' ').split(/\s+/).length
      if (!primeiro) primeiro = dataTxt
      ultimo = dataTxt
      qtd++
    }
    fechar()
    const vidsCanal = videos.filter(v => textos.has(v.ID)).length
    totalVideos += vidsCanal
    resumo.push(`- ${canal.NOME}: ${vidsCanal.toLocaleString('pt-BR')} vídeos em ${n} arquivos (pasta "${pasta}")`)
    textos.clear()
  }
  const leia = `Transcrições para o NotebookLM
Gerado em ${new Date().toLocaleString('pt-BR')} pelo Monitor de Canais do YouTube.

${resumo.join('\n')}

Cada arquivo tem até cerca de ${LIMITE_PALAVRAS.toLocaleString('pt-BR')} palavras, abaixo do limite de 500 mil palavras por fonte do NotebookLM. Os vídeos estão em ordem de publicação.

Como usar:
1. Descompacte este ZIP.
2. No NotebookLM (notebooklm.google.com), crie um caderno, por exemplo um por canal.
3. Clique em "Adicionar fontes" e envie os arquivos .txt da pasta do canal.
4. No plano gratuito, cada caderno aceita até 50 fontes; se precisar, divida os arquivos entre cadernos.
5. Para atualizar, exporte de novo e troque as fontes do caderno.
`
  arquivos.unshift({ nome: 'LEIA-ME.txt', partes: [enc.encode(leia)] })
  progresso('Montando o ZIP…')
  const data = new Date().toISOString().slice(0, 10)
  const nome = canais.length === 1 ? nomeArquivo(canais[0].NOME) : 'todos os canais'
  baixar(zipPartes(arquivos), `NotebookLM - ${nome} ${data}.zip`)
  return { videos: totalVideos, arquivos: arquivos.length - 1 }
}
