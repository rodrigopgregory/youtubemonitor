import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const sql = `CREATE TABLE EXPORT_SESSOES (ID INT NOT NULL AUTO_INCREMENT, EMAIL VARCHAR(190) NOT NULL, HASH VARCHAR(64) NOT NULL, CRIADO_EM VARCHAR(19) NOT NULL, EXPIRA_EM VARCHAR(19) NOT NULL, PRIMARY KEY (ID), KEY IX_EXPSES_HASH (HASH)) COMMENT='Sessões curtas após validar o código. RETENCAO: só estrutura entra no pacote'`;
try { console.log(JSON.stringify(await sdk.runDdlMitra({ projectId, sql })).slice(0, 100)); } catch (e) { console.log('ERRO', e.message); }
