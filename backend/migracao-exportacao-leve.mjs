import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const ddls = [
  `CREATE TABLE IF NOT EXISTS EXPORT_BASE (ID INT NOT NULL AUTO_INCREMENT, CHAVE_ARQUIVO VARCHAR(300) NOT NULL, GERADO_EM VARCHAR(19) NOT NULL, COMMIT_HASH VARCHAR(40), TAMANHO_BYTES BIGINT, SHA256 VARCHAR(64), PRIMARY KEY (ID)) COMMENT='Código e histórico Git empacotados no desenvolvimento para a exportação leve. RETENCAO: só estrutura entra no pacote'`,
  `CREATE TABLE IF NOT EXISTS EXPORT_LEVE (ID INT NOT NULL AUTO_INCREMENT, ESTADO VARCHAR(20) NOT NULL, ETAPA VARCHAR(200), OPCOES VARCHAR(200), CRIADO_EM VARCHAR(19) NOT NULL, TERMINOU_EM VARCHAR(19), CHAVE_ARQUIVO VARCHAR(300), NOME VARCHAR(120), TAMANHO_BYTES BIGINT, SHA256 VARCHAR(64), ARQUIVOS INT, CONFERIDO TINYINT, ERRO VARCHAR(500), PRIMARY KEY (ID)) COMMENT='Exportações leves geradas. RETENCAO: só estrutura entra no pacote'`,
];
for (const sql of ddls) { const r = await sdk.runDdlMitra({ projectId, sql }); console.log(sql.slice(0, 50), JSON.stringify(r).slice(0, 100)); }
