import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const ddls = [
  `CREATE TABLE LIVROS_INDICADOS (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    VIDEO_ID INT NOT NULL,
    TITULO VARCHAR(300) NOT NULL,
    AUTOR VARCHAR(200),
    TRECHO TEXT,
    SEGUNDO INT,
    CRIADO_EM VARCHAR(19),
    INDEX IX_LI_VIDEO (VIDEO_ID),
    INDEX IX_LI_TITULO (TITULO),
    FOREIGN KEY (VIDEO_ID) REFERENCES VIDEOS(ID)
  ) COMMENT='Livros indicados ou citados nos videos (titulo, autor, trecho e minuto). RETENCAO: tudo'`,
  `ALTER TABLE VIDEOS ADD COLUMN LIVROS_EM VARCHAR(19)`,
  `ALTER TABLE VIDEOS ADD COLUMN LIVROS_ERROS INT NOT NULL DEFAULT 0`,
  `ALTER TABLE VIDEOS ADD COLUMN LIVROS_ERRO VARCHAR(300)`,
  `CREATE VIEW VW_LOTE_LIVROS AS SELECT L.CHAVE, J.TITULO, J.AUTOR, J.TRECHO, J.SEG FROM LOTES L JOIN JSON_TABLE(L.JSON_TXT, '$[*]' COLUMNS (TITULO VARCHAR(300) PATH '$.titulo', AUTOR VARCHAR(200) PATH '$.autor', TRECHO VARCHAR(4000) PATH '$.trecho', SEG INT PATH '$.seg')) J`,
];
for (const sql of ddls) {
  try { const r = await sdk.runDdlMitra({ projectId, sql }); console.log(sql.slice(0, 50).replace(/\s+/g, ' '), '->', JSON.stringify(r).slice(0, 150)); }
  catch (e) { console.log(sql.slice(0, 50).replace(/\s+/g, ' '), 'ERRO', e.message, JSON.stringify(e.response?.data || '').slice(0, 300)); }
}
