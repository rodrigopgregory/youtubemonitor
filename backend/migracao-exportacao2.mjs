import { sdk, projectId } from './lib.mjs';
if (projectId !== 67241) throw new Error('projeto errado');
const sql = `CREATE TABLE EXPORT_CODIGO_DEV (ID INT NOT NULL AUTO_INCREMENT, CHAVE_ARQUIVO VARCHAR(300) NOT NULL, GERADO_EM VARCHAR(19) NOT NULL, COMMIT_HASH VARCHAR(40), TAMANHO_BYTES BIGINT, PRIMARY KEY (ID)) COMMENT='Pacote de código montado no desenvolvimento (git, fonte, dependências). RETENCAO: só estrutura entra no pacote'`;
try { console.log(JSON.stringify(await sdk.runDdlMitra({ projectId, sql })).slice(0, 100)); } catch (e) { console.log('ERRO', e.message); }
