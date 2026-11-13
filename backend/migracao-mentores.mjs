import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const ddls = [
  `CREATE TABLE MENTOR_REGRAS (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    NOME VARCHAR(150) NOT NULL,
    TIPO VARCHAR(10) NOT NULL,
    DESTINO VARCHAR(150),
    CRIADO_EM VARCHAR(19),
    UNIQUE KEY UQ_MR_NOME (NOME)
  ) COMMENT='Regras de mentores definidas pela dona: MENTOR (cadastrado a mao), APELIDO (NOME e outro jeito de escrever DESTINO) e NAO (nao e mentor). O motor segue estas regras. RETENCAO: tudo'`,
];
const dmls = [
  `INSERT IGNORE INTO MENTOR_REGRAS (NOME, TIPO, DESTINO, CRIADO_EM) VALUES
   ('Shirlene','NAO',NULL,'2026-11-13T18:00:00'),('Mônica de Medeiros','NAO',NULL,'2026-11-13T18:00:00'),('Mãe Maria','NAO',NULL,'2026-11-13T18:00:00'),
   ('Margarete Áquila','NAO',NULL,'2026-11-13T18:00:00'),('Oxalá','NAO',NULL,'2026-11-13T18:00:00'),('Pava','NAO',NULL,'2026-11-13T18:00:00'),
   ('Frei Luiz','NAO',NULL,'2026-11-13T18:00:00'),('Mário Schenberg','NAO',NULL,'2026-11-13T18:00:00'),
   ('Shellyana','APELIDO','Shell Y Ann','2026-11-13T18:00:00'),('Shel','APELIDO','Shell Y Ann','2026-11-13T18:00:00'),('Sheli','APELIDO','Shell Y Ann','2026-11-13T18:00:00'),
   ('Shelly','APELIDO','Shell Y Ann','2026-11-13T18:00:00'),('Sheelian','APELIDO','Shell Y Ann','2026-11-13T18:00:00'),('Sheliane','APELIDO','Shell Y Ann','2026-11-13T18:00:00'),
   ('Shellyanna','APELIDO','Shell Y Ann','2026-11-13T18:00:00'),('Tranqueira','APELIDO','tronqueira','2026-11-13T18:00:00'),
   ('Pai Joaquim de Angola','APELIDO','pai joaquim','2026-11-13T18:00:00'),('Tamiris','APELIDO','tamires','2026-11-13T18:00:00'),
   ('Tamires das Sete Rosas','APELIDO','tamires','2026-11-13T18:00:00'),('Tupan','APELIDO','tupã','2026-11-13T18:00:00')`,
];
for (const sql of ddls) {
  try { const r = await sdk.runDdlMitra({ projectId, sql }); console.log(sql.slice(0, 40).replace(/\s+/g, ' '), '->', JSON.stringify(r).slice(0, 150)); }
  catch (e) { console.log(sql.slice(0, 40).replace(/\s+/g, ' '), 'ERRO', e.message, JSON.stringify(e.response?.data || e).slice(0, 300)); }
}
for (const sql of dmls) { const r = await sdk.runDmlMitra({ projectId, sql }); console.log('seed', JSON.stringify(r?.result ?? r).slice(0, 150)); }
