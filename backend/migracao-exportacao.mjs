import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const ddls = [
  `CREATE TABLE EXPORT_DONOS (EMAIL VARCHAR(190) NOT NULL, NOME VARCHAR(120), ATIVO TINYINT NOT NULL DEFAULT 1, CRIADO_EM VARCHAR(19), PRIMARY KEY (EMAIL)) COMMENT='Contas autorizadas a gerar o pacote de exportação. RETENCAO: só estrutura entra no pacote'`,
  `CREATE TABLE EXPORT_CODIGOS (ID INT NOT NULL AUTO_INCREMENT, EMAIL VARCHAR(190) NOT NULL, SAL VARCHAR(32) NOT NULL, HASH VARCHAR(64) NOT NULL, EXPIRA_EM VARCHAR(19) NOT NULL, TENTATIVAS INT NOT NULL DEFAULT 0, USADO TINYINT NOT NULL DEFAULT 0, CRIADO_EM VARCHAR(19) NOT NULL, PRIMARY KEY (ID), KEY IX_EXPCOD_EMAIL (EMAIL)) COMMENT='Códigos de 6 dígitos (hash com sal). RETENCAO: só estrutura entra no pacote'`,
  `CREATE TABLE EXPORT_LOG (ID INT NOT NULL AUTO_INCREMENT, QUANDO VARCHAR(19) NOT NULL, EMAIL VARCHAR(190), EVENTO VARCHAR(40) NOT NULL, RESULTADO VARCHAR(20) NOT NULL, TAMANHO_BYTES BIGINT, DETALHE VARCHAR(500), PRIMARY KEY (ID)) COMMENT='Registro de pedidos, recusas e gerações. RETENCAO: só estrutura entra no pacote'`,
  `CREATE TABLE EXPORT_PACOTES (ID INT NOT NULL AUTO_INCREMENT, EMAIL VARCHAR(190) NOT NULL, ESTADO VARCHAR(20) NOT NULL, ETAPA VARCHAR(200), CRIADO_EM VARCHAR(19) NOT NULL, TERMINOU_EM VARCHAR(19), DADOS_EM VARCHAR(19), CODIGO_EM VARCHAR(19), TOKEN_SESSAO VARCHAR(64), RESUMO_JSON LONGTEXT, MANIFESTO_JSON LONGTEXT, ERRO VARCHAR(500), PRIMARY KEY (ID)) COMMENT='Pacotes gerados e estado. RETENCAO: só estrutura entra no pacote'`,
  `CREATE TABLE EXPORT_PARTES (ID INT NOT NULL AUTO_INCREMENT, PACOTE_ID INT NOT NULL, NOME VARCHAR(120) NOT NULL, CHAVE_ARQUIVO VARCHAR(300), TAMANHO_BYTES BIGINT, SHA256 VARCHAR(64), TOKEN_LINK VARCHAR(64), LINK_USADO TINYINT NOT NULL DEFAULT 0, EXPIRA_EM VARCHAR(19), PRIMARY KEY (ID), KEY IX_EXPPAR_PACOTE (PACOTE_ID), CONSTRAINT FK_EXPPAR_PACOTE FOREIGN KEY (PACOTE_ID) REFERENCES EXPORT_PACOTES (ID)) COMMENT='Partes (ZIPs) de cada pacote. RETENCAO: só estrutura entra no pacote'`,
];
for (const sql of ddls) {
  try { const r = await sdk.runDdlMitra({ projectId, sql }); console.log(sql.slice(0, 40), '->', JSON.stringify(r).slice(0, 120)); }
  catch (e) { console.log(sql.slice(0, 40), 'ERRO', e.message, JSON.stringify(e.response?.data || '').slice(0, 300)); }
}
for (const sql of [
  `INSERT INTO EXPORT_DONOS (EMAIL, NOME, ATIVO, CRIADO_EM) VALUES ('sledt1006p01@imersao.mitralab.io','Rodrigo Gregory',1,DATE_FORMAT(NOW(),'%Y-%m-%dT%H:%i:%s'))`,
  `INSERT INTO EXPORT_DONOS (EMAIL, NOME, ATIVO, CRIADO_EM) VALUES ('rodrigogregory@hotmail.com','Rodrigo Gregory (master)',1,DATE_FORMAT(NOW(),'%Y-%m-%dT%H:%i:%s'))`]) {
  try { console.log(JSON.stringify(await sdk.runDmlMitra({ projectId, sql })).slice(0, 120)); } catch (e) { console.log('ERRO', e.message); }
}
