# Regras de classificação do Monitor de Canais do YouTube

Escrito a partir do código publicado (commit e889ad4), não de memória. Os trechos de código abaixo são cópias literais dos arquivos em `codigo/`. Onde não há evidência está escrito **NÃO SEI**.

## 0. Visão geral

- Quem classifica é o `motor` (`codigo/backend/sf/motor.js`), uma Server Function agendada de hora em hora (cron `0 5 * * * *`, ver DEPENDENCIAS_MITRA.md) que também se reencadeia com `modo: continuar`.
- Toda chamada ao Gemini passa pela função `gemini()` (seção 1). O modelo, a lista de conexões e a lista de modelos vêm da tabela `CONFIG`.
- O motor processa, em ordem, por execução: carga e checagem de canais, estudo de vídeos (transcrição, resumo, temas, mentores, práticas), conferência de mentores, etiquetas das práticas (jeito, serve, quando, conselho), leitura de práticas pendentes, leitura de livros indicados e, de madrugada, o Livro Vivo.
- Os vídeos só entram na classificação com `DURACAO_SEG` maior que `CONFIG.DURACAO_MIN_SEG` (padrão 600). Os demais viram `FORA_DO_FILTRO`.

## 1. Chamada ao Gemini (rodízio de conexões e modelos)

- Conexões: lista em `CONFIG.GEMINI_CONEXOES` (separada por vírgula). Modelos: `CONFIG.MODELO_ANALISE` para análise e `CONFIG.MODELO_TRANSCRICAO` para transcrição, também em lista separada por vírgula.
- Endpoint: `POST /v1beta/models/<modelo>:generateContent` pela integração do Mitra (`callIntegrationMitra`). Para cada conexão, tenta cada modelo na ordem; o primeiro que devolve texto vale.
- Erro 429: se a mensagem não for "por dia" e pedir espera de até 40 s, espera uma vez e repete. Se for "por dia" (`PerDay`), marca aquela combinação conexão+modelo como esgotada até o fim da execução. Se algo esgotou e nada respondeu, o motor marca `IA_SEM_COTA` e grava `CONFIG.IA_PAUSADA_ATE` para as 08:00 UTC seguintes.
- O JSON de resposta é lido por `jsonDe()`, que tenta `JSON.parse`, depois remove vírgulas sobrando e junta objetos colados, e por fim recorta o primeiro objeto balanceado.

```js
async function gemini(cfg, modelos, body, prioritarias) {
  let ultimo = '';
  const lista = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
  const conexoes = Array.from(new Set(lista(prioritarias).concat(lista(cfg.GEMINI_CONEXOES || 'gemini'))));
  for (const conexao of conexoes) {
    for (const modelo of String(modelos).split(',').map(x => x.trim()).filter(Boolean)) {
      const k = conexao + '|' + modelo;
      if (ESGOTADO.has(k)) continue;
      try {
        const r = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body });
        const st = r.result ? r.result.statusCode : r.statusCode;
        const b = (r.result ? r.result.body : r.body) || {};
        if ((st && st >= 400) || b.error) {
          if (st === 429 || (b.error && b.error.code === 429)) {
            const msg = JSON.stringify(b).slice(0, 3000);
            const porDia = /per day|PerDay/i.test(msg);
            const espera = Number((msg.match(/retry in ([\d.]+)s/) || [])[1] || 0);
            if (!porDia && espera > 0 && espera <= 40 && !ESPEROU.has(k)) {
              ESPEROU.add(k);
              await new Promise(res => setTimeout(res, (espera + 1) * 1000));
              const r2 = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body });
              const st2 = r2.result ? r2.result.statusCode : r2.statusCode;
              const b2 = (r2.result ? r2.result.body : r2.body) || {};
              if (!((st2 && st2 >= 400) || b2.error)) {
                ESPEROU.delete(k);
                const txt2 = ((((b2.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
                if (txt2) { IA_RESPONDEU = true; return txt2; }
              }
            }
            if (porDia) ESGOTADO.add(k);
          }
          ultimo = 'Gemini (' + modelo + '): ' + String((b.error && b.error.message) || st).slice(0, 200); continue;
        }
        const parts = (((b.candidates || [])[0] || {}).content || {}).parts || [];
        const txt = parts.map(p => p.text || '').join('');
        if (txt) { IA_RESPONDEU = true; return txt; }
        const porque = (b.promptFeedback && b.promptFeedback.blockReason) || (((b.candidates || [])[0] || {}).finishReason) || '';
        ultimo = 'Gemini (' + modelo + ') respondeu vazio' + (porque ? ' (' + porque + ')' : '');
      } catch (e) { ultimo = 'Gemini (' + modelo + '): ' + String(e.message || e).slice(0, 200); }
    }
  }
  if (ESGOTADO.size) IA_SEM_COTA = true;
  throw new Error(ultimo || 'Gemini sem resposta');
}
```

```js
function jsonDe(txt) {
  const a = txt.indexOf('{');
  try { return JSON.parse(txt.slice(a, txt.lastIndexOf('}') + 1)); } catch (e0) {
  try { return JSON.parse(txt.slice(a, txt.lastIndexOf('}') + 1).replace(/,\s*([\]}])/g, '$1').replace(/}\s*{/g, '},{').replace(/"\s*\n\s*"/g, '","')); } catch (e) {
    let prof = 0, aspas = false, esc = false;
    for (let i = a; i < txt.length; i++) {
      const ch = txt[i];
      if (aspas) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') aspas = false; continue; }
      if (ch === '"') aspas = true; else if (ch === '{') prof++; else if (ch === '}' && --prof === 0) return JSON.parse(txt.slice(a, i + 1));
    }
    throw e0;
  }
  }
}
```

## 2. Transcrição (tabela TRECHOS)

- Tabela e colunas: `TRECHOS(VIDEO_ID, SEGUNDO, TEXTO)`, com índices `UQ_TR`, `IX_TR_VIDEO` e FULLTEXT `FT_TR` em `TEXTO`.
- Função: `transcreverAudio` no `motor`. Gatilho: vídeo na fila (`STATUS = FILA`) sem legenda utilizável e `CONFIG.AUDIO_LIGADO` diferente de 0. Trabalha em blocos de `CONFIG.BLOCO_SEG` segundos (padrão 900 no código, 300 na configuração atual) e para ao passar de `CONFIG.ORCAMENTO_SEG` (padrão 230 s) por execução, retomando de `VIDEOS.PROGRESSO_SEG`.
- Modelo: `CONFIG.MODELO_TRANSCRICAO`. Temperatura 0. Formato: JSON (`responseMimeType: application/json`). O vídeo é passado ao Gemini pela URL do YouTube (`fileData.fileUri`) com `videoMetadata.startOffset/endOffset`.
- Prompt, completo (a parte de texto; o vídeo vai como a parte anterior):

```
Transcreva em portugues tudo o que e falado neste trecho do video. Responda so JSON: {"trechos":[{"s":<segundo do inicio no video inteiro>,"t":"texto"}]} com um item a cada 20 a 40 segundos. Nao resuma, nao invente.
```

- Validação: se o JSON vier quebrado (`SyntaxError`) e o bloco tiver 120 s ou mais, o bloco é dividido em 3 partes e repetido. Detalhes no código abaixo.

```js
async function transcreverAudio(cfg, v) {
  const passo = Number(cfg.BLOCO_SEG || 900);
  let ini = Number(v.PROGRESSO_SEG || 0);
  while (ini < v.DURACAO_SEG) {
    if (Date.now() - T0 > Number(cfg.ORCAMENTO_SEG || 230) * 1000) return false;
    const fim = Math.min(v.DURACAO_SEG, ini + passo);
    const pedir = async (a, b) => jsonDe(await gemini(cfg, cfg.MODELO_TRANSCRICAO, {
      contents: [{ parts: [
        { fileData: { fileUri: 'https://www.youtube.com/watch?v=' + v.YT_VIDEO_ID } , videoMetadata: { startOffset: a + 's', endOffset: b + 's' } },
        { text: 'Transcreva em portugues tudo o que e falado neste trecho do video. Responda so JSON: {"trechos":[{"s":<segundo do inicio no video inteiro>,"t":"texto"}]} com um item a cada 20 a 40 segundos. Nao resuma, nao invente.' }
      ] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 }
    })).trechos || [];
    let partes;
    try { partes = await pedir(ini, fim); }
    catch (e) {
      if (!(e instanceof SyntaxError) || fim - ini < 120) throw e;
      partes = [];
      const passoMenor = Math.max(60, Math.ceil((fim - ini) / 3));
      for (let a = ini; a < fim; a += passoMenor) {
        const b = Math.min(fim, a + passoMenor);
        try { partes.push(...await pedir(a, b)); }
        catch (e2) { if (!(e2 instanceof SyntaxError)) throw e2; log.push(v.YT_VIDEO_ID + ': trecho ' + mmss(a) + '-' + mmss(b) + ' sem transcrição'); }
      }
    }
    const tr = partes.map(x => ({ s: Math.max(ini, Math.min(fim, Math.round(Number(x.s) || ini))), t: String(x.t || '').slice(0, 4000) })).filter(x => x.t);
    const porSeg = {}; tr.forEach(x => { porSeg[x.s] = porSeg[x.s] ? porSeg[x.s] + ' ' + x.t : x.t; });
    tr.length = 0; Object.keys(porSeg).forEach(k => tr.push({ s: Number(k), t: porSeg[k] }));
    for (let i = 0; i < tr.length; i += 150) {
      const chave = 'T:' + v.ID; await lote(chave, tr.slice(i, i + 150)); await sql('trechosInserirLote', { chave, videoId: v.ID }); await sql('loteApagar', { chave });
    }
    ini = fim;
    await sql('videoProgresso', { id: v.ID, seg: ini });
  }
  return true;
}
```

## 3. Resumo, temas e mentores (função analisar)

- Destino: `VIDEOS.RESUMO` (texto), `TEMAS(ID, NOME)` e `VIDEO_TEMAS(VIDEO_ID, TEMA_ID, ORIGEM, MOMENTOS, VERIFICADO)`. Mentores são temas cujo nome começa com `mentor: `.
- Função: `analisar` (`motor.js`). Gatilho: dentro de `estudar()`, depois da transcrição, para cada vídeo da fila. A mesma chamada devolve resumo, temas, mentores e práticas.
- Modelo: `CONFIG.MODELO_ANALISE`. Temperatura 0,2; se o JSON vier inválido (`SyntaxError`), repete com temperatura 0. Formato: JSON.
- Montagem do prompt, na ordem: (1) abertura com o título do vídeo; (2) formato JSON esperado; (3) `PROMPT_PRATICAS` (seção 4); (4) se o canal tem `TEM_MENTOR`, o parágrafo sobre mentores; (5) lista de categorias de tema permitidas (os `TEMAS` já existentes sem o prefixo `mentor: `, até 300, separados por `; `); (6) regra dos momentos; (7) a transcrição `[mm:ss] texto`, cortada em 600.000 caracteres. O código abaixo é o texto exato.
- Validação dos temas: o nome da IA é normalizado (sem acento, minúsculas, só letras e números) e trocado pelo nome oficial existente em `TEMAS`; nomes fora da lista são descartados; repetidos são removidos; no máximo 10 temas; no máximo 6 momentos por tema, e só os que estão entre 0 e `DURACAO_SEG`.
- Validação dos mentores: no máximo 3 por vídeo; o nome precisa aparecer escrito no título ou na transcrição (forma normalizada); passa por apelidos (`ALIAS` no código mais `MENTOR_REGRAS` tipo APELIDO), por uma lista de nomes que nunca são mentor (`NAO_MENTOR` no código mais `MENTOR_REGRAS` tipo NAO) e, se o nome não está no título, por uma segunda pergunta ao Gemini (`mentorConduz`, abaixo). Se o título do vídeo traz um mentor conhecido, só os mentores do título ficam.
- Valores permitidos: temas = linhas de `TEMAS` (vêm do próprio banco, função `temasNomes`); mentores = `mentor: <nome>`, com nomes de `MENTOR_REGRAS` (tipo MENTOR e destinos de APELIDO), do `ALIAS` do código e dos que já existem em `TEMAS`.

```js
async function analisar(cfg, v) {
  const RM = await regrasMentor();
  const tr = ((await sql('trechosDoVideo', { videoId: v.ID, limit: 2000, offset: 0 })).rows || []);
  const texto = tr.map(x => '[' + mmss(x.SEGUNDO) + '] ' + x.TEXTO).join('\n').slice(0, 600000);
  const temasExist = ((await sql('temasNomes', {})).rows || []).map(r => r.NOME);
  const corpo = {
    contents: [{ parts: [{ text:
      'Voce organiza uma base de estudo sobre espiritualidade. Abaixo esta a transcricao do video "' + v.TITULO + '" com o tempo de cada trecho.\n' +
      'Responda so JSON: {"resumo":"resumo em portugues de 5 a 10 frases, so com o que foi falado","temas":[{"nome":"tema curto em minusculas","momentos":["mm:ss",...]}],"mentores":[{"nome":"nome do mentor","momentos":["mm:ss",...]}],"praticas":[{"tipo":"...","titulo":"...","instrucao":"...","momento":"mm:ss"}]}\n' + PROMPT_PRATICAS +
      (Number(v.TEM_MENTOR) ? 'Em "mentores" ponha SO o mentor (guia ou espirito) que conduz a live: quem se manifesta e fala pela medium. Olhe SEMPRE o titulo do video ("' + v.TITULO + '"): nos videos da Casa do Consolador o nome do mentor quase sempre esta no titulo; senao, e anunciado no comeco. Ex.: Veludo, Tupã, Pai Joaquim, Dr. Espanhol. So vale nome que aparece escrito no titulo ou falado na transcricao. A medium e pessoas vivas (ex.: Monica de Medeiros, Shirlene, Margarete Aquila, Pava) NAO sao mentores, e Mae Maria, Oxala, Frei Luiz e Mario Schenberg tambem nao entram. Nomes que so sao citados ou comentados (ex.: Maria Madalena, Jesus, Chico Xavier, Emmanuel, Kardec) NAO sao mentores: se forem assunto importante, entram em "temas". Em geral ha 0 ou 1 mentor, no maximo 3; lista vazia se ninguem conduz como mentor. Se for um destes mentores ja usados, use a mesma grafia: ' + [...new Set([...RM.mentores, ...temasExist.filter(n => n.startsWith('mentor: ')).map(n => n.slice(8))])].join('; ') + (RM.nao.size ? '. Estes NAO sao mentores, nunca ponha: ' + [...RM.nao].join('; ') : '') + '\n' : 'Deixe "mentores" sempre como lista vazia.\n') +
      'De 2 a 6 temas, escolhidos SO desta lista de categorias (copie o nome exatamente como esta): ' + temasExist.filter(n => !n.startsWith('mentor: ')).slice(0, 300).join('; ') + '\n' +
      'Os momentos sao os tempos dos trechos em que o tema aparece (ate 6 por tema). Use so a transcricao.\n\nTRANSCRICAO:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
  };
  let j;
  try { j = jsonDe(await gemini(cfg, cfg.MODELO_ANALISE, corpo)); }
  catch (e) { if (!(e instanceof SyntaxError)) throw e; corpo.generationConfig.temperature = 0; j = jsonDe(await gemini(cfg, cfg.MODELO_ANALISE, corpo)); }
  const seg = t => { const p = String(t).split(':').map(Number); return p.reduce((a, b) => a * 60 + b, 0); };
  const temas = (j.temas || []).filter(t => t && t.nome).slice(0, 10).map(t => ({ nome: String(t.nome).trim().toLowerCase().slice(0, 150), momentos: (t.momentos || []).map(seg).filter(n => n >= 0 && n <= Number(v.DURACAO_SEG || 1e9)).slice(0, 6).join(',') }));
  const sem0 = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cats = new Map(temasExist.filter(n => !n.startsWith('mentor: ')).map(n => [sem0(n), n]));
  if (cats.size) {
    const vistas = new Set();
    for (let i = temas.length - 1; i >= 0; i--) {
      const certo = cats.get(sem0(temas[i].nome));
      if (!certo || vistas.has(certo)) temas.splice(i, 1); else { temas[i].nome = certo; vistas.add(certo); }
    }
  }
  const nomes = new Set(temas.map(t => t.nome));
  const ALIAS = { 'tupan': 'tupã', 'shellyana': 'Shell Y Ann', 'shell y ann': 'Shell Y Ann', 'shelly ann': 'Shell Y Ann', 'shellyann': 'Shell Y Ann', 'shelly ana': 'Shell Y Ann', 'shel': 'Shell Y Ann', 'sheli': 'Shell Y Ann', 'shelly': 'Shell Y Ann', 'sheelian': 'Shell Y Ann', 'sheliane': 'Shell Y Ann', 'shellyanna': 'Shell Y Ann', 'sheliana': 'Shell Y Ann', 'shelyana': 'Shell Y Ann', 'tranqueira': 'tronqueira', 'pai joaquim de angola': 'pai joaquim', 'pai joaquim d\'angola': 'pai joaquim', 'tamiris': 'tamires', 'tamires das sete rosas': 'tamires', 'tamiris das sete rosas': 'tamires', 'tamires das 7 rosas': 'tamires', 'dr espanhol': 'dr. espanhol', 'doutor espanhol': 'dr. espanhol' };
  const semA = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const k of Object.keys(ALIAS)) if (!RM.alias[semA(k)]) RM.alias[semA(k)] = ALIAS[k];
  for (const k of Object.keys(RM.alias)) ALIAS[k] = RM.alias[k];
  const doTitulo = new Set();
  for (const mt of (Number(v.TEM_MENTOR) ? (j.mentores || []) : []).filter(x => x && x.nome).slice(0, 3)) {
    const base0 = String(mt.nome).trim().toLowerCase().replace(/\s+/g, ' ');
    const base = RM.alias[semA(base0)] ? semA(base0) : base0;
    const sem = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const onde = sem(v.TITULO + ' ' + texto);
    const formas = [base, ALIAS[base] || base, ...Object.keys(ALIAS).filter(k => ALIAS[k] === (ALIAS[base] || base))].map(sem).filter(f => f.length >= 3);
    if (!formas.some(f => onde.includes(f))) continue;
    if (NAO_MENTOR.has(sem(ALIAS[base] || base)) || RM.nao.has(sem(ALIAS[base] || base)) || RM.nao.has(sem(base0))) continue;
    const nome = ('mentor: ' + capMentor(ALIAS[base] || base)).slice(0, 150);
    if (nomes.has(nome)) continue;
    const noTitulo = formas.filter(f => f.length >= 4).some(f => sem(v.TITULO).includes(f));
    if (!noTitulo) { try { if (!(await mentorConduz(cfg, v.TITULO, texto, nome.slice(8))).conduz) continue; } catch (e) { continue; } }
    nomes.add(nome); if (noTitulo) doTitulo.add(nome);
    temas.push({ nome, momentos: (mt.momentos || []).map(seg).filter(n => n >= 0 && n <= Number(v.DURACAO_SEG || 1e9)).slice(0, 6).join(',') });
  }
  if (Number(v.TEM_MENTOR)) {
    const pal = x => ' ' + String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
    const tit = pal(v.TITULO);
    const conhecidos = [...new Set([...RM.mentores, ...temasExist.filter(n => n.startsWith('mentor: ')).map(n => n.slice(8))])];
    const formasT = [];
    for (const n of conhecidos) formasT.push([n, n]);
    for (const k of Object.keys(RM.alias)) formasT.push([k, RM.alias[k]]);
    for (const k of Object.keys(ALIAS)) formasT.push([k, ALIAS[k]]);
    for (const [forma, alvo] of formasT) {
      const f = pal(forma);
      if (f.trim().length < 4 || !tit.includes(f)) continue;
      if (RM.nao.has(semA(alvo)) || NAO_MENTOR.has(semA(alvo))) continue;
      const nome = ('mentor: ' + capMentor(alvo)).slice(0, 150);
      if ([...nomes].some(x => semA(x) === semA(nome))) continue;
      nomes.add(nome); doTitulo.add(nome); temas.push({ nome, momentos: '' });
    }
  }
  if (doTitulo.size) for (let i = temas.length - 1; i >= 0; i--) if (temas[i].nome.startsWith('mentor: ') && ![...doTitulo].some(d => semA(d) === semA(temas[i].nome))) temas.splice(i, 1);
  const chave = 'M:' + v.ID;
  await lote(chave, temas);
  await sql('temasGarantirLote', { chave });
  await sql('videoTemasIALimpar', { videoId: v.ID });
  await sql('videoTemasIA', { chave, videoId: v.ID });
  await sql('videoMentoresVerificados', { videoId: v.ID });
  await sql('loteApagar', { chave });
  await sql('videoConcluir', { id: v.ID, resumo: String(j.resumo || '').slice(0, 20000), quando: agora() });
  await gravarPraticas(v, limparPraticas(j.praticas, v.DURACAO_SEG));
}
```

### 3.1 Conferência do mentor (função mentorConduz e conferirMentor)

Gatilho: `CONFIG.CONFERIR_MENTOR` diferente de 0 e existir `VIDEO_TEMAS` de mentor com `ORIGEM = IA` e `VERIFICADO` nulo (`mentorConferirFila`). Temperatura 0, formato JSON, `MODELO_ANALISE`. Se não conduz, o vínculo vai para `VIDEO_TEMAS_BKP_MENTORES` e é apagado.

```js
const NAO_MENTOR = new Set(['shirlene', 'monicademedeiros', 'monica', 'maemaria', 'jesus', 'mariamadalena', 'chicoxavier', 'kardec', 'allankardec', 'emmanuel', 'margareteaquila', 'margarete', 'oxala', 'pava', 'freiluiz', 'marioschenberg', 'mario']);
```

```js
async function regrasMentor() {
  if (REGRAS_MENTOR) return REGRAS_MENTOR;
  const sm = x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const r = { alias: {}, nao: new Set(), mentores: [] };
  try {
    for (const x of ((await sql('mentorRegrasMotor', {})).rows || [])) {
      if (x.TIPO === 'NAO') r.nao.add(sm(x.NOME));
      else if (x.TIPO === 'APELIDO' && x.DESTINO) r.alias[sm(x.NOME)] = x.DESTINO;
      else if (x.TIPO === 'MENTOR') { r.mentores.push(x.NOME); r.alias[sm(x.NOME)] = x.NOME; }
    }
  } catch (e) {}
  REGRAS_MENTOR = r;
  return r;
}
```

```js
async function mentorConduz(cfg, titulo, texto, nome) {
  const txt = await gemini(cfg, cfg.MODELO_ANALISE, {
    contents: [{ parts: [{ text: 'Abaixo esta a transcricao do video "' + titulo + '". Pergunta: o mentor espiritual "' + nome + '" esta INCORPORADO num medium (ex.: Monica de Medeiros ou outro) e CONDUZ esta live, falando ele mesmo em primeira pessoa por boa parte do video? Responda NAO se ele so e citado, lembrado, se alguem le uma mensagem dele, se aparece so numa prece ou se fala so poucos minutos. Se o titulo do video traz o nome de OUTRO mentor, quem conduz e esse outro: responda NAO. Confira quem se apresenta e de onde diz que vem (ex.: Shell Y Ann fala do planeta natal dela, Tizeon). Na duvida, NAO. Responda so JSON: {"conduz":true|false,"motivo":"uma frase","momento":"mm:ss do trecho que comprova"}\n\nTRANSCRICAO:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 }
  });
  const j = jsonDe(txt);
  return { conduz: j.conduz === true, motivo: String(j.motivo || '').slice(0, 300) };
}
```

```js
async function conferirMentor(cfg, x) {
  const tr = ((await sql('trechosDoVideo', { videoId: x.VIDEO_ID, limit: 2000, offset: 0 })).rows || []);
  if (!tr.length) { await sql('mentorConferido', { id: x.ID }); return 'sem transcricao'; }
  const texto = tr.map(t => '[' + mmss(t.SEGUNDO) + '] ' + t.TEXTO).join('\n').slice(0, 600000);
  const r = await mentorConduz(cfg, x.TITULO, texto, x.MENTOR);
  if (r.conduz) { await sql('mentorConferido', { id: x.ID }); return 'mantido: ' + r.motivo; }
  await sql('mentorDescartarBkp', { id: x.ID });
  await sql('mentorDescartar', { id: x.ID });
  return 'retirado: ' + r.motivo;
}
```

## 4. Práticas: mantra, exercício e demais tipos

- Tabela: `PRATICAS(ID, VIDEO_ID, TIPO, TITULO, INSTRUCAO, SEGUNDO, CRIADO_EM, FINALIDADES, FINALIDADE_EM, JEITO, SERVE, QUANDO, CONSELHO, REVISADA_EM)`. `FINALIDADES` e `FINALIDADE_EM` são de uma versão antiga; hoje valem `JEITO`, `SERVE`, `QUANDO`, `CONSELHO`.
- **Mantra** e **exercício** não são tabelas separadas: mantra é `TIPO = 'mantra e decreto'`; todo o resto é exercício (regra aplicada nas telas e na exportação pesada, linha `const mantra = p.tipo === 'mantra e decreto'` em `exportarGerar.js`).
- Funções: `analisar` (junto com o resumo, ao estudar um vídeo novo) e `lerPraticas` (vídeos já estudados sem leitura de práticas, `VIDEOS.PRATICAS_EM` nulo, fila `praticasFila`; liga/desliga em `CONFIG.PRATICAS_LIGADO`). Gravação por `gravarPraticas` (apaga as do vídeo e regrava).
- Modelo `CONFIG.MODELO_ANALISE`. Temperatura: 0,2 em `analisar` (0 no segundo tentativa) e 0,2 em `lerPraticas`. Formato JSON.
- Validação (`limparPraticas`): no máximo 15 por vídeo; `tipo` normalizado contra `TIPOS_PRATICA`, e o que não casa vira `outra prática`; `titulo` até 290 caracteres; `instrucao` até 3900; `momento` em mm:ss vira segundos e só vale entre 0 e a duração (senão 0).
- Erros: `VIDEOS.PRATICAS_ERROS` e `PRATICAS_ERRO` contam e guardam o último erro; o vídeo vai para o fim da fila.

### 4.1 Valores permitidos de TIPO e onde ficam

```js
const TIPOS_PRATICA = ['meditação', 'visualização', 'respiração', 'prece e oração', 'mantra e decreto', 'banho de ervas', 'velas', 'defumação', 'chás e ervas', 'água, sal e cristais', 'limpeza e proteção energética', 'projeção astral', 'chakras e exercício energético', 'ritual e oferenda', 'alimentação e receitas', 'saúde e cuidados com o corpo', 'mediunidade e percepção', 'autoconhecimento e conduta', 'outra prática'];
```

Ficam no código (`motor.js`); não há tabela de tipos. A tela lê os tipos presentes por `praticasTipos`.

### 4.2 Prompt exato (PROMPT_PRATICAS)

É usado dentro do prompt de `analisar` (seção 3) e de `lerPraticas`, que monta assim: abertura com o título do vídeo, o formato JSON `{"praticas":[...]}`, `PROMPT_PRATICAS`, a frase `Use so a transcricao.` e a transcrição.

```js
const PROMPT_PRATICAS = 'Em "praticas" liste TODA instrucao de algo para a pessoa FAZER que aparece na fala: meditacao, visualizacao, exercicio de respiracao, prece ou oracao, mantra ou decreto, banho de ervas, uso de velas, defumacao, cha, agua, sal ou cristais, limpeza ou protecao energetica, tecnica de projecao astral, exercicio com chakras, ritual ou oferenda, alimentacao, receita ou energizacao de alimentos, cuidado com a saude e o corpo, homeopatia, medicacao ou suplemento indicado (traga o nome e a dose quando forem ditos), exercicio de mediunidade ou percepcao (psicografia, clarividencia, telepatia, passe), exercicio de autoconhecimento ou conduta (reflexao, perdao, gratidao, habitos), ou qualquer outro trabalho espiritual ensinado. So o que e ensinado ou recomendado para fazer, nao o que e so comentado. Para cada uma: "tipo" (escolha SO desta lista, copiando o nome: ' + TIPOS_PRATICA.join('; ') + '), "titulo" (nome curto da pratica, ex.: "banho de arruda e guine para descarrego"), "instrucao" (o passo a passo como foi ensinado: ingredientes, quantidades, horario, o que falar ou mentalizar; ate 8 frases) e "momento" ("mm:ss" do trecho em que comeca). Lista vazia se o video nao ensina nenhuma pratica.\n';
```

```js
function limparPraticas(lista, dur) {
  const seg = t => { const p = String(t || '').split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0); };
  const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const mapa = new Map(TIPOS_PRATICA.map(t => [norm(t), t]));
  return (Array.isArray(lista) ? lista : []).filter(p => p && (p.titulo || p.instrucao)).slice(0, 15).map(p => {
    const s = seg(p.momento);
    return { tipo: mapa.get(norm(p.tipo)) || 'outra prática', titulo: String(p.titulo || '').trim().slice(0, 290), instrucao: String(p.instrucao || '').trim().slice(0, 3900), seg: s >= 0 && s <= Number(dur || 1e9) ? s : 0 };
  });
}
```

```js
async function gravarPraticas(v, lista) {
  const chave = 'P:' + v.ID;
  await sql('praticasLimpar', { videoId: v.ID });
  if (lista.length) { await lote(chave, lista); await sql('praticasGravar', { chave, videoId: v.ID }); await sql('loteApagar', { chave }); }
  await sql('videoPraticasFeito', { id: v.ID, quando: agora() });
}
```

```js
async function lerPraticas(cfg, v) {
  const tr = ((await sql('trechosDoVideo', { videoId: v.ID, limit: 2000, offset: 0 })).rows || []);
  if (!tr.length) { await gravarPraticas(v, []); return 0; }
  const texto = tr.map(x => '[' + mmss(x.SEGUNDO) + '] ' + x.TEXTO).join('\n').slice(0, 600000);
  const txt = await gemini(cfg, cfg.MODELO_ANALISE, {
    contents: [{ parts: [{ text: 'Voce organiza uma base de estudo sobre espiritualidade. Abaixo esta a transcricao do video "' + v.TITULO + '" com o tempo de cada trecho.\nResponda so JSON: {"praticas":[{"tipo":"...","titulo":"...","instrucao":"...","momento":"mm:ss"}]}\n' + PROMPT_PRATICAS + 'Use so a transcricao.\n\nTRANSCRICAO:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
  });
  const lista = limparPraticas(jsonDe(txt).praticas, v.DURACAO_SEG);
  await gravarPraticas(v, lista);
  return lista.length;
}
```

## 5. Etiquetas das práticas: jeito, serve, quando e conselho

- Destino: `PRATICAS.JEITO` (1 código), `SERVE` (1 a 3 códigos separados por vírgula), `QUANDO` (0 a 2) e `CONSELHO` (0 ou 1); `REVISADA_EM` e `FINALIDADE_EM` recebem a data.
- Função `marcarFinalidades`. Gatilho: no `motor`, quando `CONFIG.GEMINI_OK`, `PRATICAS_LIGADO` e `FINALIDADE_LIGADO` não são 0 e há práticas com `REVISADA_EM` nulo (`finFila`: 40 por vez, instrução cortada em 400 caracteres). Grava por `finGravar`.
- Modelo `CONFIG.MODELO_ANALISE`, temperatura 0,1, formato JSON. Prompt: abertura, as 4 definições (jeito, serve, quando, conselho), o formato JSON e a lista `#id [tipo] titulo: instrucao` (uma por linha).
- Validação: cada código precisa estar nas listas abaixo (`ok()` pega a palavra antes do primeiro espaço); jeito vazio vira `outra`; `serve` até 3, `quando` até 2; `conselho` só vale 1 se vier exatamente 1.
- Onde ficam os valores permitidos: nas constantes do `motor.js` (abaixo) e, espelhadas para os filtros das telas, em `frontend/src/lib/etiquetas.ts` (seção 9). As duas listas precisam ser mantidas iguais à mão; não há checagem automática. **NÃO SEI** se já divergiram.

```js
const JEITOS_ET = 'med (meditacao, silencio, mantras falados ou mentalizados); vis (visualizacao, mentalizar luz, cilindros, esferas); saida (tecnicas de projecao astral e saida do corpo); resp (exercicios de respiracao); energia (movimentacao de energia, chakras, passes, autopasse, irradiar energia); prece (preces, oracoes, decretos, evangelho no lar); banho (banhos de ervas, sal, chuveirada); defum (defumacao, incenso, aromatizador, velas); agua (agua fluidificada, sal grosso, cristais, objetos de protecao); chas (chas, florais, oleos essenciais, remedios naturais caseiros); homeo (homeopatia, medicacao, suplementos, vitaminas, minerais, fitoterapicos em capsula ou tintura, com a dose quando dita); alim (alimentacao e receitas); corpo (cuidados com o corpo, exercicio fisico, natureza, aterramento); reflexao (reflexao, autoconhecimento, conduta, habitos, perdao); ritual (rituais, oferendas, simpatias, patuas, espada de sao jorge); musica (musicas, cantos, sons); percepcao (treinos de percepcao, clarividencia, leitura energetica, mediunidade); outra';
```

```js
const SERVE_ET = 'prot.pes (protecao pessoal), prot.aura (limpeza da aura), prot.laco (cortar lacos e energias de pessoas), prot.obs (obsessao e ataques espirituais), emo.ans (ansiedade, medo, panico), emo.tri (tristeza, desanimo), emo.rai (raiva), emo.neg (pensamentos negativos), emo.auto (autoestima, amor-proprio), con.men (mentores e amparadores), con.eu (eu interior), con.fe (fe e gratidao), con.med (mediunidade), men.foco (foco), men.mem (memoria), men.clar (clareza, discernimento), men.int (intuicao, percepcao), proj.prep (preparar para projetar), proj.saida (sair do corpo), proj.luc (lucidez fora do corpo), proj.lem (lembrar sonhos), proj.prot (protecao na projecao), casa.limp (limpar ambiente), casa.prot (proteger a casa), casa.harm (harmonizar o lar), sau.cura (cura), sau.dor (dores), sau.ener (energia e disposicao), sau.desint (desintoxicar), rel.fam (familia e filhos), rel.casal (casal), rel.perd (perdao e magoas), rel.car (ajudar e doar energia), rel.dist (ajudar a distancia e quem partiu), sono.dorm (dormir bem), sono.ins (insonia), sono.pes (pesadelos e protecao a noite), pros.din (dinheiro), pros.trab (trabalho), pros.cam (abrir caminhos)';
```

```js
const QUANDO_ET = 'acordar (ao acordar), dia (todo dia), varias (varias vezes ao dia), dormir (antes de dormir), madrugada, semana (toda semana), vez (de vez em quando), precisa (quando precisar)';
```

```js
async function marcarFinalidades(cfg) {
  const fila = ((await sql('finFila', {})).rows || []);
  if (!fila.length) return 0;
  const texto = fila.map(p => '#' + p.ID + ' [' + p.TIPO + '] ' + p.TITULO + ': ' + String(p.INSTRUCAO || '').replace(/\s+/g, ' ')).join('\n');
  const txt = await gemini(cfg, cfg.MODELO_ANALISE, {
    contents: [{ parts: [{ text: 'Voce organiza praticas espirituais ensinadas em videos. Para cada pratica abaixo de 3 etiquetas.\n' +
      '"jeito": o jeito de fazer, UM codigo desta lista: ' + JEITOS_ET + '.\n' +
      '"serve": para que serve, de 1 a 3 codigos SO desta lista: ' + SERVE_ET + '. Use so o que a pratica promete ou indica.\n' +
      '"quando": quando fazer, codigos desta lista (0 a 2): ' + QUANDO_ET + '. Lista vazia se a pratica nao diz quando.\n' +
      '"conselho": 1 se NAO e uma pratica para a pessoa fazer em casa: conselho generico sem tecnica (ex.: "mantenha a fe", "seja feliz"), encaminhamento para buscar ajuda fora (ir a um centro, pedir cirurgia espiritual, mandar nomes para tratamento, procurar grupo), assunto que nao e espiritual (higiene, golpes, financas, estoque de comida), causa ou evento pontual (abaixo-assinado, inscricao em evento), ou rito guiado por outra pessoa que nao da para repetir em casa. Senao 0.\n' +
      'Responda so JSON: {"itens":[{"id":123,"jeito":"med","serve":["emo.ans"],"quando":["dormir"],"conselho":0}]}\n\nPRATICAS:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
  });
  const j = jsonDe(txt);
  const lim = (v, okSet, n) => (Array.isArray(v) ? v : [v]).map(x => String(x || '').trim().toLowerCase()).filter(x => okSet.has(x)).filter((x, i, a) => a.indexOf(x) === i).slice(0, n).join(',');
  const porId = new Map((j.itens || []).map(x => [Number(x.id), x]));
  const lista = fila.filter(p => porId.has(Number(p.ID))).map(p => {
    const x = porId.get(Number(p.ID));
    return { id: Number(p.ID), jeito: lim(x.jeito, JEITO_OK, 1) || 'outra', serve: lim(x.serve, SERVE_OK, 3), quando: lim(x.quando, QUANDO_OK, 2), conselho: Number(x.conselho) === 1 ? 1 : 0 };
  });
  if (!lista.length) return 0;
  const chave = 'fin-' + Date.now();
  await lote(chave, lista); await sql('finGravar', { chave }); await sql('loteApagar', { chave });
  return lista.length;
}
```

## 6. Livros indicados

- Tabela `LIVROS_INDICADOS(ID, VIDEO_ID, TITULO, AUTOR, TRECHO, SEGUNDO, CRIADO_EM)`; marcação em `VIDEOS.LIVROS_EM`, `LIVROS_ERROS`, `LIVROS_ERRO`.
- Função `lerLivros`. Gatilho: `CONFIG.LIVROS_LIGADO` diferente de 0 e vídeos `ESTUDADO` com `LIVROS_EM` nulo (`livrosFila`). Modelo `MODELO_ANALISE`, temperatura 0,2, formato JSON.
- Validação (`limparLivros`): até 30 livros por vídeo, título obrigatório (até 290), autor até 190, trecho até 3900, momento em segundos entre 0 e a duração, e sem repetir o par título+segundo. A tela agrupa por título; a regra de agrupamento está em `livrosRelacao` (`funcoes-tela.mjs`).

```js
const PROMPT_LIVROS = 'Em "livros" liste TODO livro que a pessoa que fala indica, recomenda, sugere ler ou cita como fonte de estudo (inclua obras espirituais, romances mediunicos, biografias e livros de autoria do proprio palestrante). Liste tambem, com o "tipo" certo, musicas, albuns e bandas ("musica"), filmes, series e documentarios ("audiovisual") e textos sagrados ou classicos como Biblia, Bhagavad Gita, Alcorao, Upanishads, Tao Te Ching e seus livros ou capitulos ("sagrado"), quando citados como referencia. Todo o resto e "livro". Nao inclua o que e so um nome solto sem ser uma obra. Para cada um: "titulo" (como foi dito), "autor" (autor, artista ou diretor se foi dito ou for evidente; senao vazio), "tipo" ("livro", "musica", "audiovisual" ou "sagrado"; na duvida use "livro"), "trecho" (o que foi dito, com as palavras do video, ate 3 frases) e "momento" ("mm:ss" em que e citado). Lista vazia se o video nao cita nenhuma obra.\n';
```

```js
function limparLivros(lista, dur) {
  const seg = t => { const p = String(t || '').split(':').map(Number); return p.some(isNaN) ? 0 : p.reduce((a, b) => a * 60 + b, 0); };
  const vistos = new Set();
  return (Array.isArray(lista) ? lista : []).filter(l => l && String(l.titulo || '').trim()).slice(0, 30).map(l => {
    const s = seg(l.momento);
    const tipo = ['musica', 'audiovisual', 'sagrado'].includes(String(l.tipo || '').toLowerCase()) ? String(l.tipo).toLowerCase() : 'livro';
    return { tipo, titulo: String(l.titulo).trim().slice(0, 290), autor: String(l.autor || '').trim().slice(0, 190), trecho: String(l.trecho || '').trim().slice(0, 3900), seg: s >= 0 && s <= Number(dur || 1e9) ? s : 0 };
  }).filter(l => { const k = l.titulo.toLowerCase() + '|' + l.seg; if (vistos.has(k)) return false; vistos.add(k); return true; });
}
```

```js
async function lerLivros(cfg, v) {
  const tr = ((await sql('trechosDoVideo', { videoId: v.ID, limit: 2000, offset: 0 })).rows || []);
  if (!tr.length) { await gravarLivros(v, []); return 0; }
  const texto = tr.map(x => '[' + mmss(x.SEGUNDO) + '] ' + x.TEXTO).join('\n').slice(0, 600000);
  const txt = await gemini(cfg, cfg.MODELO_ANALISE, {
    contents: [{ parts: [{ text: 'Voce organiza uma base de estudo sobre espiritualidade. Abaixo esta a transcricao do video "' + v.TITULO + '" com o tempo de cada trecho.\nResponda so JSON: {"livros":[{"titulo":"...","autor":"...","tipo":"livro|musica|audiovisual|sagrado","trecho":"...","momento":"mm:ss"}]}\n' + PROMPT_LIVROS + 'Use so a transcricao.\n\nTRANSCRICAO:\n' + texto }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
  }, cfg.GEMINI_CONEXOES_LIVROS);
  const lista = limparLivros(jsonDe(txt).livros, v.DURACAO_SEG);
  await gravarLivros(v, lista);
  return lista.length;
}
```

## 7. Livro Vivo

- Tabela `LIVRO_CAPITULOS(ID, TEMA_ID, TEMA, TEXTO, PRATICAS_JSON, VIDEOS, GERADO_EM)`, um capítulo por tema (chave única por `TEMA_ID`; `livroGravar` usa `ON DUPLICATE KEY UPDATE`).
- Função `livroGerar`. Disparo: (a) pela tela, com `temaId`; (b) pelo `motor`, de madrugada (hora de Brasília entre 1 e 7), no máximo `CONFIG.LIVRO_POR_NOITE` por dia (padrão 2), espaçado de 25 min por `CONFIG.LIVRO_TENTOU_EM`, só se `LIVRO_LIGADO` não for 0, `LIVRO_PAUSA_ATE` e `IA_PAUSADA_ATE` não estiverem no futuro e não houver `IA_SEM_COTA`. O próximo tema é o de `livroProximo`: sem capítulo ainda, não-mentor, com 5 vídeos estudados ou mais, o de mais vídeos primeiro.
- Material enviado: resumos dos vídeos do tema (`livroResumos`) e práticas do tema sem `CONSELHO` (`livroPraticas`), numeradas P1, P2, ...; cortado em 400.000 caracteres.
- Modelo `MODELO_ANALISE` (lista, na ordem), temperatura 0,3, `maxOutputTokens` 30000, formato JSON. Validação: precisa vir `texto`; até 30 práticas; `grupo` precisa estar em `GRUPOS` (os nomes de `JEITOS` do arquivo), senão `Outras`; `fontes` viram vídeo, canal, yt e segundo das práticas P citadas (até 8, sem repetir vídeo); texto cortado em 60.000 caracteres.
- Valores permitidos de `grupo`: o objeto `JEITOS` do arquivo abaixo (é uma cópia de nomes, separada de `etiquetas.ts`).

```js
const m = require('mitra-sdk');
const pid = Number(process.env.MITRA_PROJECT_ID);
const SF = __SF__;
async function sql(nome, input) {
  const r = await m.executeServerFunctionMitra({ projectId: pid, serverFunctionId: SF[nome], input: input || {} });
  const res = r.result || r;
  if (res.executionStatus === 'FAILED') throw new Error(nome + ': ' + JSON.stringify(res.error).slice(0, 300));
  let o = res.output; if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) {} }
  return o;
}
const JEITOS = { med: 'Meditação e mantras', vis: 'Visualização', saida: 'Técnicas de saída do corpo', resp: 'Respiração', energia: 'Exercícios de energia e chakras', prece: 'Preces, orações e decretos', banho: 'Banhos', defum: 'Defumação e velas', agua: 'Água, sal e cristais', chas: 'Chás, florais, óleos e remédios naturais', homeo: 'Homeopatia, medicação e suplementos', alim: 'Alimentação e receitas', corpo: 'Cuidados com o corpo', reflexao: 'Reflexão e autoconhecimento', ritual: 'Rituais e oferendas', musica: 'Músicas e sons', percepcao: 'Treinos de percepção e clarividência', outra: 'Outras' };
const GRUPOS = Object.values(JEITOS);
const temaId = Number(event.temaId || 0);
if (!temaId) return { ok: false, erro: 'Escolha um tema.' };
const info = ((await sql('livroTemaInfo', { temaId })).rows || [])[0];
if (!info) return { ok: false, erro: 'Tema sem vídeos estudados.' };
const resumos = (await sql('livroResumos', { temaId })).rows || [];
const prats = (await sql('livroPraticas', { temaId })).rows || [];
if (!resumos.length) return { ok: false, erro: 'Tema sem vídeos estudados.' };
const fonte = 'RESUMOS DOS VIDEOS:\n' + resumos.map(v => '- [' + v.CANAL + '] "' + v.TITULO + '": ' + v.RESUMO).join('\n') +
  '\n\nPRATICAS ENSINADAS (numeradas):\n' + prats.map((p, i) => 'P' + (i + 1) + ' [' + p.CANAL + ' / ' + (JEITOS[p.JEITO] || p.TIPO) + '] ' + (p.TITULO || '') + ': ' + (p.INSTRUCAO || '')).join('\n');
const prompt = 'Voce escreve um capitulo do "Livro Vivo", um livro de estudo que reune os ensinamentos de canais espiritualistas do YouTube (Wagner Borges, Monica de Medeiros - Casa do Consolador, Saulo Calderon). O capitulo e sobre o tema "' + info.NOME + '".\n' +
  'Use SOMENTE o material abaixo. Nao invente nada de fora.\n' +
  'Responda so JSON: {"texto":"...","praticas":[{"grupo":"...","titulo":"...","quando":"...","passos":"...","fontes":[1,2]}]}\n' +
  '"texto": o capitulo em portugues, de 4 a 10 paragrafos, organizado em secoes com subtitulos (linhas que comecam com "## "). Agrupe o que os canais ensinam em ideias principais, mostre onde concordam e o que cada um acrescenta, citando o canal pelo nome. Separe paragrafos com linha em branco.\n' +
  '"praticas": junte as praticas parecidas numa so (ex.: varias receitas para dor de cabeca viram uma receita), no maximo 25. Para cada uma: "grupo" (escolha SO desta lista: ' + GRUPOS.join('; ') + '), "titulo" curto, "quando" (para que serve, 1 frase), "passos" (o passo a passo unificado: ingredientes, quantidades, horario, o que falar ou mentalizar; ate 10 frases) e "fontes" (os numeros das praticas P usadas, sem o P). Lista vazia se nao houver praticas.\n\nMATERIAL:\n' + fonte.slice(0, 400000);
const cfg = {}; ((await sql('configLer', {})).rows || []).forEach(r => { cfg[r.CHAVE] = r.VALOR; });
const modelos = String(cfg.MODELO_ANALISE || 'gemini-3.1-flash-lite').split(',').map(x => x.trim()).filter(Boolean);
let ultimo = '', j = null;
for (const conexao of String(cfg.GEMINI_CONEXOES || 'gemini').split(',').map(x => x.trim()).filter(Boolean)) {
  for (const modelo of modelos) {
    try {
      const r = await m.callIntegrationMitra({ projectId: pid, connection: conexao, method: 'POST', endpoint: '/v1beta/models/' + modelo + ':generateContent', body: {
        contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, responseMimeType: 'application/json', maxOutputTokens: 30000 } } });
      const b = (r.result ? r.result.body : r.body) || {};
      const st = r.result ? r.result.statusCode : r.statusCode;
      if ((st && st >= 400) || b.error) { ultimo = String((b.error && b.error.message) || st); continue; }
      const txt = ((((b.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('').trim();
      try { j = JSON.parse(txt); } catch (e) { const a = txt.indexOf('{'), z = txt.lastIndexOf('}'); try { j = JSON.parse(txt.slice(a, z + 1)); } catch (e2) { j = null; } }
      if (j && j.texto) break;
      ultimo = 'resposta sem texto'; j = null;
    } catch (e) { ultimo = String(e.message || e); }
  }
  if (j) break;
}
if (!j) return { ok: false, erro: 'Não consegui escrever o capítulo agora. Tente de novo em instantes.', detalhe: ultimo.slice(0, 200) };
const praticas = (Array.isArray(j.praticas) ? j.praticas : []).slice(0, 30).map(p => ({
  grupo: GRUPOS.includes(p.grupo) ? p.grupo : 'Outras',
  titulo: String(p.titulo || '').slice(0, 200), quando: String(p.quando || '').slice(0, 500), passos: String(p.passos || '').slice(0, 4000),
  fontes: (Array.isArray(p.fontes) ? p.fontes : []).map(n => prats[Number(n) - 1]).filter(Boolean).filter((x, i, a) => a.findIndex(y => y.YT === x.YT) === i).slice(0, 8)
    .map(x => ({ video: x.VIDEO, canal: x.CANAL, yt: x.YT, seg: Number(x.SEGUNDO || 0) })),
}));
await sql('livroGravar', { temaId, tema: info.NOME, texto: String(j.texto).slice(0, 60000), praticas: JSON.stringify(praticas), videos: Number(info.QTD) });
return { ok: true, tema: info.NOME, praticas: praticas.length };

```

## 8. Busca e chat (não gravam categoria)

Não escrevem em tabela de classificação. Prompts e temperaturas (linhas literais dos arquivos):

```js
// buscaTermos.js
14: const prompt = 'Uma pessoa vai pesquisar o tema "' + tema + '" numa base de transcricoes de videos de espiritualidade em portugues. Devolva so JSON {"termos":["..."]} com 2 a 5 termos de UMA ou DUAS palavras, do jeito que alguem falaria num video: sinonimos e palavras muito proximas do tema (ex.: para "protecao" use "protecao", "blindagem", "defesa energetica"). Nao inclua o proprio tema. Nao fuja do assunto. Temas que ja existem na base (use quando forem sinonimos): ' + temas.join('; ');
19:       contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } } });

// resumoBusca.js
28:       contents: [{ parts: [{ text: 'Use SOMENTE o material abaixo, tirado das transcricoes de videos de uma base de estudo. Escreva em portugues um resumo de 1 a 3 paragrafos do que foi falado sobre o tema "' + tema + '" (termos procurados: ' + termos.join(', ') + '), citando o titulo do video quando ajudar. Nao acrescente nada de fora do material. Se o material nao tratar do tema, responda exatamente: NENHUM.\n\nMATERIAL:\n' + fonte.slice(0, 200000) }] }],
29:       generationConfig: { temperature: 0.2 } } });

// chatBusca.js
11: async function gemini(prompt, json) {
17:         contents: [{ parts: [{ text: prompt }] }],
18:         generationConfig: Object.assign({ temperature: 0.2 }, json ? { responseMimeType: 'application/json' } : {}) } });
```

## 9. Minutagem, fim_calculado e filtros das telas

- **Início**: `PRATICAS.SEGUNDO`, `LIVROS_INDICADOS.SEGUNDO` e `TRECHOS.SEGUNDO` são o segundo de início no vídeo inteiro (a IA devolve `mm:ss`, o código converte e descarta o que passa da duração). `VIDEO_TEMAS.MOMENTOS` é uma lista de segundos separados por vírgula (até 6).
- **Fim**: o banco **não guarda fim**. O `fim_calculado` só existe na exportação pesada (`exportarGerar.js`): é o início do próximo trecho da transcrição depois do início do item; se não houver próximo, é a duração do vídeo (ou o próprio início, se a duração for menor). Vem sempre marcado `fim_calculado = 1`. Nesta exportação leve ele não é calculado (a tabela TRECHOS não entra). Código:

```js
  const fimDe = (vid, s, dur) => { const a = segs.get(vid); if (a) { let lo = 0, hi = a.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid] > s) hi = mid; else lo = mid + 1; } if (lo < a.length) return a[lo]; } return dur >= s ? dur : s; };
  const url = (yt, s) => 'https://youtu.be/' + yt + '?t=' + Math.max(0, Math.floor(s));
  const minutCab = ['tipo', 'subtipo', 'texto', 'video_id', 'video_id_interno', 'video_titulo', 'canal', 'inicio_seg', 'fim_seg', 'fim_calculado', 'url_com_tempo', 'origem', 'origem_id'];
  const leit = { mantras: [], exercicios: [], temas: [], mentores: [] };
  const minut = [];
  let acimaDuracao = 0, semArquivo = 0, semMinut = 0; const exemplosAcima = [], exemplosSemArq = [];
  const registrar = (tipo, subtipo, texto, v, s, origem, oid, extra) => {
    const canal = canalPorId.get(v.canal); const cn = canal ? canal.nome : '';
    const fim = fimDe(v.id, s, v.dur);
    if (v.dur > 0 && s > v.dur) { acimaDuracao++; if (exemplosAcima.length < 20) exemplosAcima.push(origem + '#' + oid + ' vídeo ' + v.yt + ' início ' + s + 's > duração ' + v.dur + 's'); }
    if (!segs.has(v.id)) { semArquivo++; if (exemplosSemArq.length < 20) exemplosSemArq.push(origem + '#' + oid + ' vídeo ' + v.yt); }
    const link = url(v.yt, s);
    minut.push([tipo, subtipo, texto, v.yt, v.id, v.titulo, cn, s, fim, 1, link, origem, oid]);
    return { cn, fim, link };

```

- **Link com tempo**: `https://youtu.be/<YT_VIDEO_ID>?t=<segundo>`.
- **Filtros das telas**: vêm de três lugares. (1) Listas fixas de jeito, serve e quando em `frontend/src/lib/etiquetas.ts` (abaixo). (2) Tipos de prática, temas e canais lidos do banco por Server Functions (`praticasTipos`, `temasListar`, `canaisNomes`, `mentoresListar`). (3) Contagens por filtro em `praticasJeitos`, `praticasServe`, `praticasQuando`, `praticasTotais`. Os filtros salvos da pessoa **NÃO SEI** onde ficam: não achei tabela nem função de filtro salvo no código; os filtros ativos vivem no estado da tela.

```ts
export const JEITOS: [string, string][] = [
  ['med', 'Meditação e mantras'], ['vis', 'Visualização'], ['saida', 'Técnicas de saída do corpo'], ['resp', 'Respiração'],
  ['energia', 'Exercícios de energia e chakras'], ['prece', 'Preces, orações e decretos'], ['banho', 'Banhos'], ['defum', 'Defumação e velas'],
  ['agua', 'Água, sal e cristais'], ['chas', 'Chás, florais, óleos e remédios naturais'], ['homeo', 'Homeopatia, medicação e suplementos'], ['alim', 'Alimentação e receitas'], ['corpo', 'Cuidados com o corpo'],
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

```

```js
  S('praticasJeitos', `SELECT P.JEITO COD, COUNT(*) QTD FROM PRATICAS P JOIN VIDEOS V ON V.ID = P.VIDEO_ID WHERE V.STATUS = 'ESTUDADO' AND P.CONSELHO = 0 AND ({{canalId}} = 0 OR V.CANAL_ID = {{canalId}}) AND ('{{busca}}' = '' OR CONCAT(P.TITULO, ' ', P.INSTRUCAO) COLLATE utf8mb4_0900_ai_ci LIKE CONCAT('%', '{{busca}}', '%')) AND ('{{serve}}' = '' OR FIND_IN_SET('{{serve}}', P.SERVE) OR (LOCATE('.', '{{serve}}') = 0 AND CONCAT(',', P.SERVE) LIKE CONCAT('%,', '{{serve}}', '.%'))) AND ('{{quando}}' = '' OR FIND_IN_SET('{{quando}}', P.QUANDO)) GROUP BY P.JEITO`, 'Práticas: quantas há em cada jeito de fazer'),
  S('praticasServe', `SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(P.SERVE, ',', K.N), ',', -1) COD, COUNT(*) QTD FROM PRATICAS P JOIN VIDEOS V ON V.ID = P.VIDEO_ID JOIN (SELECT 1 N UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) K ON K.N <= 1 + LENGTH(P.SERVE) - LENGTH(REPLACE(P.SERVE, ',', '')) WHERE V.STATUS = 'ESTUDADO' AND P.CONSELHO = 0 AND ({{canalId}} = 0 OR V.CANAL_ID = {{canalId}}) AND ('{{busca}}' = '' OR CONCAT(P.TITULO, ' ', P.INSTRUCAO) COLLATE utf8mb4_0900_ai_ci LIKE CONCAT('%', '{{busca}}', '%')) AND ('{{jeito}}' = '' OR P.JEITO = '{{jeito}}') AND ('{{quando}}' = '' OR FIND_IN_SET('{{quando}}', P.QUANDO)) AND P.SERVE IS NOT NULL GROUP BY COD`, 'Práticas: quantas servem para cada coisa, dentro do jeito de fazer'),
  S('praticasQuando', `SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(P.QUANDO, ',', K.N), ',', -1) COD, COUNT(*) QTD FROM PRATICAS P JOIN VIDEOS V ON V.ID = P.VIDEO_ID JOIN (SELECT 1 N UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) K ON K.N <= 1 + LENGTH(P.QUANDO) - LENGTH(REPLACE(P.QUANDO, ',', '')) WHERE V.STATUS = 'ESTUDADO' AND P.CONSELHO = 0 AND ({{canalId}} = 0 OR V.CANAL_ID = {{canalId}}) AND ('{{busca}}' = '' OR CONCAT(P.TITULO, ' ', P.INSTRUCAO) COLLATE utf8mb4_0900_ai_ci LIKE CONCAT('%', '{{busca}}', '%')) AND ('{{jeito}}' = '' OR P.JEITO = '{{jeito}}') AND ('{{serve}}' = '' OR FIND_IN_SET('{{serve}}', P.SERVE) OR (LOCATE('.', '{{serve}}') = 0 AND CONCAT(',', P.SERVE) LIKE CONCAT('%,', '{{serve}}', '.%'))) AND P.QUANDO IS NOT NULL GROUP BY COD`, 'Práticas: quantas há para cada momento de fazer'),
  S('praticasTotais', `SELECT SUM(P.CONSELHO = 0) N, SUM(P.REVISADA_EM IS NOT NULL AND P.CONSELHO = 0) MARCADAS, SUM(P.REVISADA_EM IS NULL) FALTAM FROM PRATICAS P JOIN VIDEOS V ON V.ID = P.VIDEO_ID WHERE V.STATUS = 'ESTUDADO'`, 'Quantas práticas há e quantas já estão organizadas'),
  S('temasListar', `SELECT T.ID, T.NOME, COUNT(*) QTD FROM TEMAS T JOIN VIDEO_TEMAS VT ON VT.TEMA_ID = T.ID JOIN VIDEOS V ON V.ID = VT.VIDEO_ID WHERE T.NOME NOT LIKE 'mentor: %' AND V.STATUS IN ('ESTUDADO', 'FORA_TEMA') AND (V.STATUS <> 'FORA_TEMA' OR '{{status}}' = 'FORA_TEMA') AND ({{canalId}} = 0 OR V.CANAL_ID = {{canalId}}) AND ('{{status}}' = '' OR V.STATUS = '{{status}}') AND ({{nTemas}} = 0 OR V.ID IN (SELECT XT.VIDEO_ID FROM VIDEO_TEMAS XT WHERE FIND_IN_SET(XT.TEMA_ID, '{{temas}}') GROUP BY XT.VIDEO_ID HAVING COUNT(DISTINCT XT.TEMA_ID) = {{nTemas}})) AND ({{nPlay}} = 0 OR V.YT_VIDEO_ID IN (SELECT XP.YT_VIDEO_ID FROM PLAYLIST_VIDEOS XP WHERE FIND_IN_SET(XP.PLAYLIST_ID, '{{playlists}}') GROUP BY XP.YT_VIDEO_ID HAVING COUNT(DISTINCT XP.PLAYLIST_ID) = {{nPlay}})) AND ({{nPrat}} = 0 OR V.ID IN (SELECT XR.VIDEO_ID FROM PRATICAS XR WHERE XR.CONSELHO = 0 AND FIND_IN_SET(XR.JEITO, '{{praticas}}') GROUP BY XR.VIDEO_ID HAVING COUNT(DISTINCT XR.JEITO) = {{nPrat}})) AND ('{{origem}}' = '' OR V.ORIGEM = '{{origem}}') GROUP BY T.ID, T.NOME ORDER BY QTD DESC, T.NOME LIMIT 500`, 'Temas com quantos vídeos sobram nos filtros escolhidos'),
  S('canaisNomes', `SELECT ID, NOME, HANDLE FROM CANAIS ORDER BY ID`, 'Nomes dos canais'),
  S('praticasTipos', `SELECT XR2.JEITO TIPO, COUNT(DISTINCT XR2.VIDEO_ID) QTD FROM PRATICAS XR2 JOIN VIDEOS V ON V.ID = XR2.VIDEO_ID WHERE XR2.CONSELHO = 0 AND V.STATUS <> 'FORA' AND (V.STATUS <> 'FORA_TEMA' OR '{{status}}' = 'FORA_TEMA') AND ({{canalId}} = 0 OR V.CANAL_ID = {{canalId}}) AND ('{{status}}' = '' OR V.STATUS = '{{status}}') AND ({{nTemas}} = 0 OR V.ID IN (SELECT XT.VIDEO_ID FROM VIDEO_TEMAS XT WHERE FIND_IN_SET(XT.TEMA_ID, '{{temas}}') GROUP BY XT.VIDEO_ID HAVING COUNT(DISTINCT XT.TEMA_ID) = {{nTemas}})) AND ({{nPlay}} = 0 OR V.YT_VIDEO_ID IN (SELECT XP.YT_VIDEO_ID FROM PLAYLIST_VIDEOS XP WHERE FIND_IN_SET(XP.PLAYLIST_ID, '{{playlists}}') GROUP BY XP.YT_VIDEO_ID HAVING COUNT(DISTINCT XP.PLAYLIST_ID) = {{nPlay}})) AND ({{nPrat}} = 0 OR V.ID IN (SELECT XR.VIDEO_ID FROM PRATICAS XR WHERE XR.CONSELHO = 0 AND FIND_IN_SET(XR.JEITO, '{{praticas}}') GROUP BY XR.VIDEO_ID HAVING COUNT(DISTINCT XR.JEITO) = {{nPrat}})) AND ('{{origem}}' = '' OR V.ORIGEM = '{{origem}}') GROUP BY XR2.JEITO ORDER BY QTD DESC, XR2.JEITO`, 'Tipos de prática com quantos vídeos sobram nos filtros escolhidos'),
```

## 10. O que NÃO está no código nem nas tabelas

- Configurações da conexão do Gemini feitas só no Mitra (chave, URL, cabeçalhos, qualquer limite ou política de segurança da conexão): **NÃO SEI**. O código nunca manda `safetySettings` nem `maxOutputTokens` (exceto o Livro Vivo), então valem os padrões do Gemini.
- Qual modelo respondeu cada vez: **NÃO SEI**. Só se grava o texto; o modelo vem do rodízio da seção 1 e não é registrado.
- Cotas, preços e limites das chaves Gemini: **NÃO SEI** (ficam na conta do Google).
- Prompts de versões anteriores ao commit e889ad4: estão só no histórico Git (`historico/repo.bundle`). Nenhum resultado guarda qual versão do prompt o gerou.
- Tabela `TEMA_MAPA(ID, NOME, CATEGORIA, ...)`: existe e tem linhas, mas **NÃO SEI** o que a preenche nem quem a lê: não achei nenhuma referência a ela no código do app.
- Tabela `MENTOR_REGRAS`: é editada pela tela de mentores (`mentorEditar`) e lida pelo motor; o conteúdo vai no ZIP porque é pequena.
- Regras que valem só nas telas (textos, ordenação, cortes de tela) estão em `codigo/frontend/src`; não foram resumidas aqui.
- Dados: transcrições (`TRECHOS`), vínculos e leituras completas não estão neste ZIP.
