const util = require('util');
const fs = require('fs');
const { app } = require('electron')
const path = require('node:path')

const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

const userDataPath = 'src/build';
//const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathConfigApp = path.join(userDataPath, 'configApp.json');

async function saveInfos(systemSave, infos) {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await readFileAsync(pathConfigApp, 'utf-8');
      let dadosApp = JSON.parse(data);

      switch (systemSave) {
        case 'saurus':
          dadosApp.saurus.dominio = infos[0];
          dadosApp.saurus.chavecaixa = infos[1];
          dadosApp.saurus.tabpreco = infos[2];
          break;
      }

      let novoJson = JSON.stringify(dadosApp, null, 2);

      await writeFileAsync(pathConfigApp, novoJson, 'utf-8');
      resolve();
    } catch (err) {
      reject('Erro ao atualizar dados');
      console.error('Erro ao processar o arquivo JSON:', err);
    }
  });
}


async function returnValueFromJson(campo){
  return new Promise((resolve, reject) => {
    fs.readFile(pathConfigApp, 'utf-8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        let dados = JSON.parse(data);
        switch (campo) {
          case 'dominiosaurus':
            resolve(dados.saurus.dominio);
            break;

          case 'chavecaixasaurus':
            resolve(dados.saurus.chavecaixa);
            break;

          case 'tabeladeprecosaurus':
            resolve(dados.saurus.tabpreco)
            break

          case 'codenuvemshop':
            resolve(dados.nuvemshop.code);
            break;

          case 'tokennuvemshop':
            resolve(dados.nuvemshop.access_token);
            break;

          case 'storeidnuvemshop':
            resolve(dados.nuvemshop.store_id);
            break;
        }
      }
    });
  });
}


module.exports = { 
    saveInfos,
    returnValueFromJson
}