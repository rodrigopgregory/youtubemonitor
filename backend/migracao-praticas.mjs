import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const ddls = [
  `CREATE TABLE PRATICAS (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    VIDEO_ID INT NOT NULL,
    TIPO VARCHAR(60) NOT NULL,
    TITULO VARCHAR(300),
    INSTRUCAO TEXT,
    SEGUNDO INT,
    CRIADO_EM VARCHAR(19),
    INDEX IX_PR_VIDEO (VIDEO_ID),
    INDEX IX_PR_TIPO (TIPO),
    FOREIGN KEY (VIDEO_ID) REFERENCES VIDEOS(ID)
  ) COMMENT='Praticas e instrucoes de trabalho espiritual citadas nos videos (meditacao, banho de ervas, velas, prece...). RETENCAO: tudo'`,
  `ALTER TABLE VIDEOS ADD COLUMN PRATICAS_EM VARCHAR(19)`,
  `CREATE VIEW VW_LOTE_PRATICAS AS SELECT L.CHAVE, J.TIPO, J.TITULO, J.INSTRUCAO, J.SEG FROM LOTES L JOIN JSON_TABLE(L.JSON_TXT, '$[*]' COLUMNS (TIPO VARCHAR(60) PATH '$.tipo', TITULO VARCHAR(300) PATH '$.titulo', INSTRUCAO VARCHAR(4000) PATH '$.instrucao', SEG INT PATH '$.seg')) J`,
];
for (const sql of ddls) {
  try { const r = await sdk.runDdlMitra({ projectId, sql }); console.log(sql.slice(0, 40).replace(/\s+/g, ' '), '->', JSON.stringify(r).slice(0, 150)); }
  catch (e) { console.log(sql.slice(0, 40).replace(/\s+/g, ' '), 'ERRO', e.message, JSON.stringify(e.response?.data || '').slice(0, 300)); }
}
