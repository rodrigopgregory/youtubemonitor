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
