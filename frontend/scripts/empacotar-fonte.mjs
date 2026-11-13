import fs from 'fs'
import path from 'path'

const raiz = path.resolve(import.meta.dirname, '..', '..')
const fora = new Set(['node_modules', 'dist', '.git', '.env', '.env.local', '.env.production'])
const arquivos = {}

function andar(dir) {
  for (const nome of fs.readdirSync(dir)) {
    if (fora.has(nome) || (nome.startsWith('.env') && nome !== '.env.example') || nome.endsWith('.log') || nome === 'codigo-fonte.json') continue
    const cheio = path.join(dir, nome)
    const rel = path.relative(raiz, cheio).split(path.sep).join('/')
    if (fs.statSync(cheio).isDirectory()) andar(cheio)
    else if (fs.statSync(cheio).size < 2_000_000) arquivos[rel] = fs.readFileSync(cheio, 'utf8')
  }
}

for (const item of ['ESCOPO.md', 'backend', 'frontend']) {
  const cheio = path.join(raiz, item)
  if (!fs.existsSync(cheio)) continue
  if (fs.statSync(cheio).isDirectory()) andar(cheio)
  else arquivos[item] = fs.readFileSync(cheio, 'utf8')
}

fs.mkdirSync(path.join(raiz, 'frontend', 'public'), { recursive: true })
fs.writeFileSync(path.join(raiz, 'frontend', 'public', 'codigo-fonte.json'), JSON.stringify(arquivos))
console.log('código-fonte empacotado:', Object.keys(arquivos).length, 'arquivos')
