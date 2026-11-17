import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const ddls = [
  `CREATE TABLE LIVROS_CATALOGO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    TITULO VARCHAR(300) NOT NULL COLLATE utf8mb4_0900_ai_ci,
    AUTOR VARCHAR(200),
    CRIADO_EM VARCHAR(19),
    UNIQUE KEY UX_LC_TITULO (TITULO)
  ) COMMENT='Livros reais confirmados (titulo oficial e autor). Varios nomes ouvidos nos videos apontam para um livro. RETENCAO: tudo'`,
  `CREATE TABLE LIVROS_NOMES (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    NOME VARCHAR(300) NOT NULL COLLATE utf8mb4_0900_ai_ci,
    CATALOGO_ID INT,
    ESTADO VARCHAR(12) NOT NULL DEFAULT 'PENDENTE',
    SUGESTAO_TITULO VARCHAR(300),
    SUGESTAO_AUTOR VARCHAR(200),
    MOTIVO VARCHAR(300),
    CRIADO_EM VARCHAR(19),
    UNIQUE KEY UX_LN_NOME (NOME),
    INDEX IX_LN_ESTADO (ESTADO),
    FOREIGN KEY (CATALOGO_ID) REFERENCES LIVROS_CATALOGO(ID)
  ) COMMENT='Cada nome de livro como foi ouvido nos videos e o que se decidiu: OK (aponta para o catalogo), PENDENTE (a pessoa decide na tela inicial) ou NAO_LIVRO. RETENCAO: tudo'`,
  `CREATE VIEW VW_LOTE_NOMES AS SELECT L.CHAVE, J.NOME, J.TITULO, J.AUTOR, J.CONF, J.MOTIVO FROM LOTES L JOIN JSON_TABLE(L.JSON_TXT, '$[*]' COLUMNS (NOME VARCHAR(300) PATH '$.nome', TITULO VARCHAR(300) PATH '$.titulo', AUTOR VARCHAR(200) PATH '$.autor', CONF VARCHAR(10) PATH '$.conf', MOTIVO VARCHAR(300) PATH '$.motivo')) J`,
  `INSERT INTO LIVROS_CATALOGO (TITULO, AUTOR, CRIADO_EM) VALUES ('Elos que Aprisionam', NULL, DATE_FORMAT(NOW() - INTERVAL 3 HOUR, '%Y-%m-%dT%H:%i:%s'))`,
  `INSERT INTO LIVROS_NOMES (NOME, CATALOGO_ID, ESTADO, CRIADO_EM) SELECT 'Elos que Aprisionam', ID, 'OK', DATE_FORMAT(NOW() - INTERVAL 3 HOUR, '%Y-%m-%dT%H:%i:%s') FROM LIVROS_CATALOGO WHERE TITULO = 'Elos que Aprisionam'`,
];
for (const sql of ddls) {
  try { const r = sql.startsWith('INSERT') ? await sdk.runDmlMitra({ projectId, sql }) : await sdk.runDdlMitra({ projectId, sql }); console.log(sql.slice(0, 50).replace(/\s+/g, ' '), '->', JSON.stringify(r).slice(0, 120)); }
  catch (e) { console.log(sql.slice(0, 50).replace(/\s+/g, ' '), 'ERRO', e.message, JSON.stringify(e.response?.data || '').slice(0, 300)); }
}
