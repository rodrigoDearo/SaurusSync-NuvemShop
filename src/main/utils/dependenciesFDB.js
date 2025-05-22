process.stdin.setEncoding('utf-8');

/* ---------------------- IMPORTAÇÃO DE MÓDULOS ----------------------*/
const conexao = require('node-firebird');



/**
 * ESSA FUNÇÃO CRIA EM CASO DE AUSÊNCIA, UM GERADOR DE ID A SER USADO NA TABELA NOTIFICACOES_HOSTSYNC
 * @param {*} config 
 * @returns 
 */
async function criarGeneratorID(config){
  return new Promise(async (resolve, reject) => {
    try {
      
      conexao.attach(config, function (err, db){
        if(err)
          throw err

        let codigo = `EXECUTE BLOCK
        AS
        BEGIN
            IF (NOT EXISTS (
                SELECT 1
                FROM RDB$GENERATORS
                WHERE RDB$GENERATOR_NAME = 'GEN_NOTIFICACOES_HOSTSYNC_ID'
            ))
            THEN
            BEGIN
                EXECUTE STATEMENT 'CREATE SEQUENCE GEN_NOTIFICACOES_HOSTSYNC_ID';
            END
        END
        `;

        db.query(codigo, function (err, result){
          if (err)
            throw err;

          console.log('GERADOR DE ID GEN_NOTIFICACOES_HOSTSYNC_ID FOI CRIADA EM CASO DE AUSÊNCIA');
          resolve();
        })

        db.detach();
      })

    } catch (error) {
      reject(error)
    }
  })
}



/**
 * FUNÇÃO RESPONSÁVEL POR CRIAR CASO NÃO EXISTA A TABELA NOTIFICACOES_HOSTSYNC
 * @param {config} config se trata do JSON com as configurações para se conectar com o banco de dados 
 * @returns void 
 */
async function criarTabela(config){
    return new Promise(async(resolve, reject) => {
      try {
        // CONEXAO ABERTA PARA CRIAR TABELA NOTIFICACOES_HOSTSYNC CASO NAO EXISTA
        conexao.attach(config, function(err, db) {
          if (err)
            console.log(err);
  
          let codigo = `EXECUTE BLOCK
          AS
          BEGIN
              IF (NOT EXISTS (
                  SELECT 1
                  FROM RDB$RELATIONS
                  WHERE RDB$RELATION_NAME = 'NOTIFICACOES_HOSTSYNC'
              ))
              THEN
              BEGIN
                  EXECUTE STATEMENT 'CREATE TABLE NOTIFICACOES_HOSTSYNC (
                      ID INTEGER NOT NULL PRIMARY KEY,
                      TIPO       VARCHAR(100),
                      OBS        VARCHAR(100),
                      IDITEM  INTEGER
                  )';
              END
          END`
  
          db.query(codigo, function (err, result){
            if (err)
  
            console.log('TABELA NOTIFICACOES_HOSTSYNC FOI CRIADA EM CASO DE AUSÊNCIA');
            resolve();
          })
  
          db.detach();
        })
      } catch (error) {
        console.log(error);
      }
    })
  }
  
  

  async function criarTriggerInsertProduto(config){
    return new Promise(async(resolve, reject) => {
      try {
        
        // CONEXAO ABERTA NOVAMENTE PARA ESTAR ATUALIZADA COM A TABELA CRIADA, USADA PARA CRIAR A TRIGGER INSERT
        conexao.attach(config, function (err, db){
          if (err)
            throw err;
  
          let codigoTriggerInsert = `EXECUTE BLOCK
          AS
          BEGIN
              IF (NOT EXISTS (
                  SELECT 1
                  FROM RDB$TRIGGERS
                  WHERE RDB$TRIGGER_NAME = 'INSERT_PRODUTO_HOSTSYNC'
              ))
              THEN
              BEGIN
                  EXECUTE STATEMENT 'CREATE TRIGGER INSERT_PRODUTO_HOSTSYNC FOR PRODUTOS
                  ACTIVE AFTER INSERT POSITION 0
                  AS
                  BEGIN
                      INSERT INTO NOTIFICACOES_HOSTSYNC (id, tipo, obs, iditem) VALUES (NEXT VALUE FOR GEN_NOTIFICACOES_HOSTSYNC_ID, ''PRODUTO'', '''', NEW.id_produto);
                  END';
              END
          END`;
  
          db.query(codigoTriggerInsert, function (err, result){
            if (err)
              throw err;
  
            console.log('TRIGGER INSERT_PRODUTO_HOSTSYNC FOI CRIADA EM CASO DE AUSÊNCIA');
            resolve();
          });
          
          db.detach();
        });
  
      } catch (error) {
        reject(error);
      }
    })
  }
  
  

  async function criarTriggerUpdateProduto(config){
    return new Promise(async(resolve, reject) => {
      try {
        
        // CONEXAO ABERTA NOVAMENTE PARA ESTAR ATUALIZADA COM A TABELA CRIADA, USADA PARA CRIAR A TRIGGER INSERT
        conexao.attach(config, function(err, db){
          if (err)
            throw err;
  
            let codigoTriggerUpdate = `EXECUTE BLOCK
            AS
            BEGIN
                IF (NOT EXISTS (
                    SELECT 1
                    FROM RDB$TRIGGERS
                    WHERE RDB$TRIGGER_NAME = 'UPDATE_PRODUTO_HOSTSYNC'
                ))
                THEN
                BEGIN
                    EXECUTE STATEMENT 'CREATE TRIGGER UPDATE_PRODUTO_HOSTSYNC FOR PRODUTOS
                    ACTIVE AFTER UPDATE POSITION 0
                    AS
                    BEGIN
                        INSERT INTO NOTIFICACOES_HOSTSYNC (id, tipo, obs, iditem) VALUES (NEXT VALUE FOR GEN_NOTIFICACOES_HOSTSYNC_ID, ''PRODUTO'', '''', NEW.id_produto);
                    END';
                END
            END`;
                
            db.query(codigoTriggerUpdate, function (err, result){
              if (err)
                throw err;
      
              console.log('TRIGGER UPDATE_PRODUTO_HOSTSYNC FOI CRIADO EM CASO DE AUSÊNCIA');
              resolve();
            });
      
            db.detach();
        })
  
      } catch (error) {
        reject(error);
      }
    })
  }


  async function criarTriggerUpdateVariacao(config){
    return new Promise(async(resolve, reject) => {
      try {
        
        // CONEXAO ABERTA NOVAMENTE PARA ESTAR ATUALIZADA COM A TABELA CRIADA, USADA PARA CRIAR A TRIGGER INSERT
        conexao.attach(config, function (err, db){
          if (err)
            throw err;
  
          let codigoTriggerInsert = `EXECUTE BLOCK
          AS
          BEGIN
              IF (NOT EXISTS (
                  SELECT 1
                  FROM RDB$TRIGGERS
                  WHERE RDB$TRIGGER_NAME = 'UPDATE_VARIACAO_HOSTSYNC'
              ))
              THEN
              BEGIN
                  EXECUTE STATEMENT 'CREATE TRIGGER UPDATE_VARIACAO_HOSTSYNC FOR PRODUTOS_GRADE_ITENS
                  ACTIVE AFTER UPDATE POSITION 0
                  AS
                  BEGIN
                      INSERT INTO NOTIFICACOES_HOSTSYNC (id, tipo, obs, iditem) VALUES (NEXT VALUE FOR GEN_NOTIFICACOES_HOSTSYNC_ID, ''PRODUTO'', ''VARIACAO ALTERADA'', NEW.id_produto);
                  END';
              END
          END`;
  
          db.query(codigoTriggerInsert, function (err, result){
            if (err)
              throw err;
  
            console.log('TRIGGER UPDATE_VARIACAO_HOSTSYNC FOI CRIADA EM CASO DE AUSÊNCIA');
            resolve();
          });
          
          db.detach();
        });
  
      } catch (error) {
        reject(error);
      }
    })
  }
  
  

  async function criarTriggerDeleteVariacao(config){
    return new Promise(async(resolve, reject) => {
      try {
        
        // CONEXAO ABERTA NOVAMENTE PARA ESTAR ATUALIZADA COM A TABELA CRIADA, USADA PARA CRIAR A TRIGGER INSERT
        conexao.attach(config, function(err, db){
          if (err)
            throw err;
  
            let codigoTriggerUpdate = `EXECUTE BLOCK
            AS
            BEGIN
                IF (NOT EXISTS (
                    SELECT 1
                    FROM RDB$TRIGGERS
                    WHERE RDB$TRIGGER_NAME = 'DELETE_VARIACAO_HOSTSYNC'
                ))
                THEN
                BEGIN
                    EXECUTE STATEMENT 'CREATE TRIGGER DELETE_VARIACAO_HOSTSYNC FOR PRODUTOS_GRADE_ITENS
                    ACTIVE AFTER DELETE POSITION 0
                    AS
                    BEGIN
                        INSERT INTO NOTIFICACOES_HOSTSYNC (id, tipo, obs, iditem) VALUES (NEXT VALUE FOR GEN_NOTIFICACOES_HOSTSYNC_ID, ''PRODUTO'', ''VARIACAO DELETADA'', OLD.id_produto);
                    END';
                END
            END`;
                
            db.query(codigoTriggerUpdate, function (err, result){
              if (err)
                throw err;
      
              console.log('TRIGGER DELETE_VARIACAO_HOSTSYNC FOI CRIADO EM CASO DE AUSÊNCIA');
              resolve();
            });
      
            db.detach();
        })
  
      } catch (error) {
        reject(error);
      }
    })
  }


  async function limparTabela(config){
    return new Promise(async(resolve, reject) => {
      try {
        
        // CONEXAO ABERTA NOVAMENTE PARA ESTAR ATUALIZADA COM A TABELA CRIADA, USADA PARA CRIAR A TRIGGER INSERT
        conexao.attach(config, function (err, db){
          if (err)
            throw err;
  
          let codigoSQL = `DELETE FROM NOTIFICACOES_HOSTSYNC;`;
  
          db.query(codigoSQL, function (err, result){
            if (err)
              resolve({code: 500, msg:'ERRO AO LIMPAR TABELA, CONTATAR SUPORTE TECNICO'});
  
            console.log('FOI LIMPADO A TABELA NOTIFICACOES_HOSTSYNC PARA QUE POSSO COMECAR A LEITURA');
          });
          
          db.detach();

          resolve({code: 200, msg:'LIMPADO A TABELA NOTIFICACOES_HOSTSYNC'});
        });
  
      } catch (error) {
        reject(error);
      }
    })
  }



async function createDependencies(config) {
  return new Promise(async (resolve, reject) => {
    await criarTabela(config) 
    .then(async () => {
      await criarGeneratorID(config);
    })
    .then(async () => {
      await criarTriggerInsertProduto(config);
    })
    .then(async () => {
      await criarTriggerUpdateProduto(config);
    })
    .then(async () => {
      await criarTriggerUpdateVariacao(config);
    })
    .then(async () => {
      await criarTriggerDeleteVariacao(config);
    })
    .catch(() => {
      resolve({code:500, msg:"Erro ao criar/verificar as dependencias SQL necessarias no banco FDB. Consultar o desenvolvedor do sistema com URGENCIA"});
    })
    .finally(() => {
      resolve({code:200, msg:"Dependencias FDB corretamente configuradas!"})
    })
  })
}
  







  module.exports = {
    createDependencies,
    limparTabela
  };