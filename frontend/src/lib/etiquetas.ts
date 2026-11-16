export const JEITOS: [string, string][] = [
  ['med', 'Meditação e mantras'], ['vis', 'Visualização'], ['saida', 'Técnicas de saída do corpo'], ['resp', 'Respiração'],
  ['energia', 'Exercícios de energia e chakras'], ['prece', 'Preces, orações e decretos'], ['banho', 'Banhos'], ['defum', 'Defumação e velas'],
  ['agua', 'Água, sal e cristais'], ['chas', 'Chás, florais, óleos e remédios naturais'], ['alim', 'Alimentação e receitas'], ['corpo', 'Cuidados com o corpo'],
  ['reflexao', 'Reflexão e autoconhecimento'], ['ritual', 'Rituais e oferendas'], ['musica', 'Músicas e sons'], ['percepcao', 'Treinos de percepção e clarividência'], ['outra', 'Outras'],
]
export const SERVE: { cod: string; nome: string; itens: [string, string][] }[] = [
  { cod: 'prot', nome: 'Proteção e limpeza', itens: [['prot.pes', 'Proteção pessoal'], ['prot.aura', 'Limpeza da aura'], ['prot.laco', 'Cortar laços e energias de pessoas'], ['prot.obs', 'Obsessão e ataques espirituais']] },
  { cod: 'emo', nome: 'Emoções', itens: [['emo.ans', 'Ansiedade, medo e pânico'], ['emo.tri', 'Tristeza e desânimo'], ['emo.rai', 'Raiva'], ['emo.neg', 'Pensamentos negativos'], ['emo.auto', 'Autoestima e amor-próprio']] },
  { cod: 'con', nome: 'Conexão espiritual', itens: [['con.men', 'Mentores e amparadores'], ['con.eu', 'Eu interior'], ['con.fe', 'Fé e gratidão'], ['con.med', 'Mediunidade']] },
  { cod: 'men', nome: 'Mente e lucidez', itens: [['men.foco', 'Foco e concentração'], ['men.mem', 'Memória'], ['men.clar', 'Clareza e discernimento'], ['men.int', 'Intuição e percepção']] },
  { cod: 'proj', nome: 'Projeção e sonhos', itens: [['proj.prep', 'Preparar para projetar'], ['proj.saida', 'Sair do corpo'], ['proj.luc', 'Lucidez fora do corpo'], ['proj.lem', 'Lembrar dos sonhos'], ['proj.prot', 'Proteção na projeção']] },
  { cod: 'casa', nome: 'Casa e ambiente', itens: [['casa.limp', 'Limpar o ambiente'], ['casa.prot', 'Proteger a casa'], ['casa.harm', 'Harmonizar o lar']] },
  { cod: 'sau', nome: 'Saúde do corpo', itens: [['sau.cura', 'Cura'], ['sau.dor', 'Dores'], ['sau.ener', 'Energia e disposição'], ['sau.desint', 'Desintoxicar']] },
  { cod: 'rel', nome: 'Relações e serviço', itens: [['rel.fam', 'Família e filhos'], ['rel.casal', 'Casal'], ['rel.perd', 'Perdão e mágoas'], ['rel.car', 'Ajudar e doar energia'], ['rel.dist', 'Ajudar à distância e quem partiu']] },
  { cod: 'sono', nome: 'Sono', itens: [['sono.dorm', 'Dormir bem'], ['sono.ins', 'Insônia'], ['sono.pes', 'Pesadelos e proteção à noite']] },
  { cod: 'pros', nome: 'Prosperidade e caminhos', itens: [['pros.din', 'Dinheiro'], ['pros.trab', 'Trabalho'], ['pros.cam', 'Abrir caminhos']] },
]
export const QUANDO: [string, string][] = [
  ['acordar', 'Ao acordar'], ['dia', 'Todo dia'], ['varias', 'Várias vezes ao dia'], ['dormir', 'Antes de dormir'], ['madrugada', 'De madrugada'],
  ['semana', 'Toda semana'], ['vez', 'De vez em quando'], ['precisa', 'Quando precisar'],
]
const mapa = new Map<string, string>([...JEITOS, ...QUANDO, ...SERVE.flatMap(g => [[g.cod, g.nome] as [string, string], ...g.itens])])
export const nomeEt = (c: string | null | undefined) => (c ? mapa.get(c) || c : '')
export const lista = (v: string | null | undefined) => String(v || '').split(',').map(s => s.trim()).filter(Boolean)
