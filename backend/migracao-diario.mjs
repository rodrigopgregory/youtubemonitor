import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const ddls = [
  `CREATE TABLE PRATICA_DIARIO (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    PRATICA_ID INT NOT NULL,
    DIA VARCHAR(10) NOT NULL,
    HUMOR TINYINT NULL,
    SENTIU TEXT NULL,
    CRIADO_EM VARCHAR(19),
    INDEX IX_PD_PRATICA (PRATICA_ID),
    INDEX IX_PD_DIA (DIA),
    FOREIGN KEY (PRATICA_ID) REFERENCES PRATICAS(ID)
  ) COMMENT='Minhas praticas: cada vez que a pessoa fez uma pratica, o dia e como se sentiu (HUMOR 1 pior a 5 melhor). RETENCAO: tudo'`,
  `ALTER TABLE VIDEOS ADD COLUMN FAVORITO TINYINT NOT NULL DEFAULT 0 COMMENT 'Marcado como favorito pela pessoa'`,
  `ALTER TABLE VIDEOS ADD COLUMN ASSISTIDO_EM VARCHAR(19) NULL COMMENT 'Quando a pessoa marcou que ja assistiu; nulo = nao assistiu'`,
];
for (const sql of ddls) {
  try { const r = await sdk.runDdlMitra({ projectId, sql }); console.log(sql.slice(0, 40).replace(/\s+/g, ' '), '->', JSON.stringify(r).slice(0, 150)); }
  catch (e) { console.log(sql.slice(0, 40).replace(/\s+/g, ' '), 'ERRO', e.message, JSON.stringify(e.response?.data || '').slice(0, 300)); }
}
