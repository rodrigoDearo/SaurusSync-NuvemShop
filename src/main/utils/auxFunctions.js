const fs = require('fs')
const { Readable } = require('stream');
const zlib = require('zlib');
const path = require('node:path');
const { app } = require('electron')

//const userDataPath = 'src/build';
const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathLog = path.join(userDataPath, 'logs');
const pathConfigApp = path.join(userDataPath, 'configApp.json');
const pathProducts = path.join(userDataPath, 'products.json');
const pathCategories = path.join(userDataPath, 'categories.json');
const pathErrorsDB = path.join(userDataPath, 'errorsDB.json');

var config, numberProcces=0;

function gravarLog(mensagem) {
  if (!fs.existsSync(pathLog)) {
      fs.mkdirSync(pathLog, { recursive: true });
  }

  const data = new Date();
  data.setHours(data.getHours() - 3);
  const dataFormatada = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  const logMessage = `[${data.toISOString()}]: ${mensagem}\n`;
  const logFileName = `log_${dataFormatada}.txt`;
  const logFilePath = path.join(pathLog, logFileName);

  fs.appendFile(logFilePath, logMessage, (err) => {
      if (err) {
          console.error('Erro ao gravar o log:', err);
      } else {
          console.log('Log gravado com sucesso!');
      }
  });
}



async function successHandlingRequests(destiny, resource, idSaurus, idNuvemShop, othersInfo){
  return new Promise(async (resolve, reject) => {
  try {

    if(destiny=="product"){
      let productsDB = JSON.parse(fs.readFileSync(pathProducts))

      switch (resource) {
        case "post":
          productsDB[`${idSaurus}`] = {
            "idNuvemShop": `${idNuvemShop}`,
            "UniqueId": `${othersInfo}`,
            "status": "ATIVO",
            "imageId": "",
            "hashImage": "",
            "variations": {}
          }
          await verifyToDeleteErrorRecord(destiny, idSaurus, 'POST')
          gravarLog('Cadastrado registro no banco de ' + destiny);
          break;

        case "update":
          gravarLog('Atualizado registro no banco de ' + destiny);
          break;

        case "delete":
          productsDB[`${idSaurus}`].status = "INATIVO";
          gravarLog('Deletado registro no banco de ' + destiny);
          break;

        case "undelete":
          productsDB[`${idSaurus}`].status = "ATIVO";
          gravarLog('Re-Cadastrado registro no banco de ' + destiny);
          break;
      }

      fs.writeFileSync(pathProducts, JSON.stringify(productsDB), 'utf-8')
      resolve()
    }else
    if(destiny=="category"){
      let categoriesDB = JSON.parse(fs.readFileSync(pathCategories))

      switch (resource) {
        case "post":
          categoriesDB[`${othersInfo[0]}`] = {
            "idNuvemShop": `${idNuvemShop}`,
            "subCategories": {}
          }
          gravarLog('Cadastrado registro no banco de ' + destiny);
          break;

        case "delete":
          categoriesDB[`${othersInfo[0]}`].status = "INATIVO";
          gravarLog('Deletado registro no banco de ' + destiny);
          break;

      }
      
      fs.writeFileSync(pathCategories, JSON.stringify(categoriesDB), 'utf-8')
      resolve()
    }else
    if(destiny=="subcategory"){
      let categoriesDB = JSON.parse(fs.readFileSync(pathCategories))

      switch (resource) {
        case "post":
          categoriesDB[`${othersInfo[1]}`].subCategories[`${othersInfo[0]}`] = idNuvemShop
          gravarLog('Cadastrado registro no banco de ' + destiny);
          break;

        case "delete":
          delete categoriesDB[`${othersInfo[0]}`].subCategories[`${othersInfo[1]}`]
          gravarLog('Deletado registro no banco de ' + destiny);
          await verifyToDeleteErrorRecord(destiny, idSaurus, 'POST')
          break;


      }
      
      fs.writeFileSync(pathCategories, JSON.stringify(categoriesDB), 'utf-8')
      gravarLog('Gravado/Atualizado registro no banco de ' + destiny);
      resolve()
    }else
    if(destiny=="variation"){
      let productsDB = JSON.parse(fs.readFileSync(pathProducts))

      switch (resource) {
        case "post":
          productsDB[`${idSaurus}`].variations[`${othersInfo[0]}`] = idNuvemShop
          gravarLog('Cadastrado registro no banco de ' + destiny);
          break;

        case "update":
          gravarLog('Atualizado registro no banco de ' + destiny);
          break;

        case "delete":
          delete productsDB[`${idSaurus}`].variations[`${othersInfo[0]}`]
          gravarLog('Deletado registro no banco de ' + destiny);
          break;


      }
      
      fs.writeFileSync(pathProducts, JSON.stringify(productsDB), 'utf-8')
      resolve()
    }else
    if(destiny=="image"){
      let productsDB = JSON.parse(fs.readFileSync(pathProducts))

      switch (resource) {
        case "post":
          productsDB[`${idSaurus}`].imageId = `${idNuvemShop}`
          productsDB[`${idSaurus}`].hashImage = othersInfo[0]
          gravarLog('Cadastrado imagem de produto com sucesso');
          break;

        case "delete":
          productsDB[`${idSaurus}`].imageId = false
          productsDB[`${idSaurus}`].hashImage = false
          gravarLog('Deletado imagem de produto com sucesso');
          break;

      }

      fs.writeFileSync(pathProducts, JSON.stringify(productsDB), 'utf-8')
      resolve()
    }else
    if(destiny=="token"){
      let configApp = JSON.parse(fs.readFileSync(pathConfigApp))

      switch (resource) {
        case "post":
          configApp.nuvemshop.access_token = othersInfo[0]
          configApp.nuvemshop.store_id = othersInfo[1]
          configApp.nuvemshop.code = othersInfo[2]
          gravarLog('Gerado token de acesso com sucesso');
          break;

      }
      fs.writeFileSync(pathConfigApp, JSON.stringify(configApp), 'utf-8')
      resolve()
    }
  } catch (error) {
    numberProcces++
    console.log('ALERTA EM PROCESSO DE NORMALIZAÇÃO NUMERO: ' + numberProcces)
    resolve()  
  }

  })
}


async function errorHandlingRequest(destiny, resource, idSaurus, idNuvemShop, errors, body){
  return new Promise(async (resolve, reject) => {
      let errorsDB = JSON.parse(fs.readFileSync(pathErrorsDB))

      const data = new Date();
      data.setHours(data.getHours() - 3);
      const dataFormatada = `${data.getFullYear()}-${data.getMonth() + 1}-${data.getDate()}`;
      
      let mensagemErro = JSON.stringify(errors).length > 500 ? 'Erro causado por Bad Request, mensagem longa' : errors
      
      errorsDB[destiny][idSaurus] = {
        "typeRequest": resource,
        "idNuvemShop": idNuvemShop,
        "timeRequest": dataFormatada,
        "returnRequest": mensagemErro,
        "bodyRequest": body
      }

      fs.writeFileSync(pathErrorsDB, JSON.stringify(errorsDB), 'utf-8');
      gravarLog('Gravado/Atualizado registro no banco de erros')
      resolve()
  })
}


async function verifyToDeleteErrorRecord(destiny, idSaurus, type){
  return new Promise(async (resolve, reject) => {
    let errorsDB = JSON.parse(fs.readFileSync(pathErrorsDB));

    if(errorsDB[destiny][idSaurus]&&errorsDB[destiny][idSaurus].typeRequest == type){
        delete errorsDB[destiny][idSaurus]
    }

    fs.writeFileSync(pathErrorsDB, JSON.stringify(errorsDB), 'utf-8');
    gravarLog('Retirado registro no banco de erros')
    resolve()
  })
}


async function deleteErrorsRecords(){
  return new Promise(async (resolve, reject) => {
    let errorsDB = JSON.parse(fs.readFileSync(pathErrorsDB));

    errorsDB.product = {}
    errorsDB.category = {}
    errorsDB.subcategory = {}
    errorsDB.variation = {}
    errorsDB.token = {}
    errorsDB.image = {}

    fs.writeFileSync(pathErrorsDB, JSON.stringify(errorsDB), 'utf-8');
    gravarLog('RESETADO BANCO DE ERROS')
    resolve()
  })
}


async function saveNewUniqueIdInProduct(idSaurus, id){
  return new Promise(async (resolve, reject) => {
    let productsDB = JSON.parse(fs.readFileSync(pathProducts))

    productsDB[`${idSaurus}`].UniqueId = `${id}`

    fs.writeFileSync(pathProducts, JSON.stringify(productsDB), 'utf-8')
    resolve()
  })
}


async function getActualDatetime(firtsRequest) {
  if (!firtsRequest) {
    const now = new Date();

    // Remove 10 minutes, handling hour/day underflow automatically
    now.setMinutes(now.getMinutes() - 10);

    let timeToRequest = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, '0') + "-" +
      String(now.getDate()).padStart(2, '0') + "T" +
      String(now.getHours()).padStart(2, '0') + ":" +
      String(now.getMinutes()).padStart(2, '0') + ":00-03:00";

    return timeToRequest;
  } else {
    return '1968-08-30T00:00:00-03:00';
  }
}


async function findProductKeyByIdNuvemShopAsync(data, idToFind) {
  for (const [key, product] of Object.entries(data)) {
    if (product.idNuvemShop == idToFind) {
      return key;
    }
  }
  return null;
}


async function findIdVariantFromNameVariant(data, nameVariant){
  return new Promise(async (resolve, reject) => {
    for(let i=0; i<data.length; i++){
      if(data[i].values[0].pt==nameVariant){
        resolve(data[i].id)
      }
    }
  })
}


function copyJsonFilesToUserData() {
  // Caminho correto onde os arquivos são empacotados
  const resourcesPath = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);

  const filesToCopy = [
      'configApp.json',
      'products.json',
      'categories.json',
      'errorsDB.json'
  ];

  filesToCopy.forEach(file => {
      const sourcePath = path.join(resourcesPath, file);
      const destinationPath = path.join(userDataPath, file);

      console.log(`Copiando: ${file}`);

      if (!fs.existsSync(userDataPath)) {
          fs.mkdirSync(userDataPath, { recursive: true });
      }

      if (!fs.existsSync(destinationPath)) {
          if (fs.existsSync(sourcePath)) {
              fs.copyFileSync(sourcePath, destinationPath);
              console.log(`Copiado file para ${userDataPath}`);
          } else {
              console.warn(`Arquivo nao encontrado: ${sourcePath}`);
          }
      } else {
          console.log(`${file} ja existe em ${userDataPath}`);
      }
  });
}


async function returnNumberCodeOfPasswordSaurus(){
  const now = new Date();


  let number = now.getDate() + now.getMonth() + (now.getFullYear() - 1999);

  return number;
}



async function encodedStringInBase64(input){
   return Buffer.from(input, 'utf-8').toString('base64');
}


async function saveDecodedXmlFromBase64ZipReqCadastros(base64String) {
    const now = new Date();
    const xmlDir = path.join(userDataPath, 'XMLs', 'cadastros');

    if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
    }
    const buffer = Buffer.from(base64String, 'base64');
    const xmlContent = zlib.gunzipSync(buffer);

    const xmlFile = `reqCadastros-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.xml`;
    const xmlPath = path.join(xmlDir, xmlFile);
    fs.writeFileSync(xmlPath, xmlContent);

    return xmlPath;
}

async function saveDecodedXmlFromBase64ZipRetProdutoEstoque(base64String, idProduct,  idProductFather) {
    let xmlDir;

    if(idProductFather){ // thats mean it's a variation
      xmlDir = path.join(userDataPath, 'XMLs', 'products', 'variations', `${idProductFather}`);
    }else{
      xmlDir = path.join(userDataPath, 'XMLs', 'products');
    }

    if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
    }

    const buffer = Buffer.from(base64String, 'base64');
    const xmlContent = zlib.gunzipSync(buffer);

    const xmlFile = `${idProduct}.xml`;
    const xmlPath = path.join(xmlDir, xmlFile);
    fs.writeFileSync(xmlPath, xmlContent);

    return xmlPath;
}


function clearDirectoryRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  fs.readdirSync(dirPath).forEach((file) => {
    const curPath = path.join(dirPath, file);
    if (fs.lstatSync(curPath).isDirectory()) {
      clearDirectoryRecursive(curPath);
      fs.rmdirSync(curPath);
    } else {
      fs.unlinkSync(curPath);
    }
  });
}

async function clearFolderXMLProductsRecursive() {
  let dirPath = path.join(userDataPath, 'XMLs', 'products');

  if (!fs.existsSync(dirPath)) return;

  fs.readdirSync(dirPath).forEach((file) => {
    const curPath = path.join(dirPath, file);
    if (fs.lstatSync(curPath).isDirectory()) {
      clearDirectoryRecursive(curPath);
      fs.rmdirSync(curPath);
    } else {
      fs.unlinkSync(curPath);
    }
  });
}


module.exports = {
    findProductKeyByIdNuvemShopAsync,
    copyJsonFilesToUserData,
    successHandlingRequests,
    errorHandlingRequest,
    saveNewUniqueIdInProduct,
    deleteErrorsRecords,
    getActualDatetime,
    gravarLog,
    findIdVariantFromNameVariant,
    returnNumberCodeOfPasswordSaurus,
    encodedStringInBase64,
    saveDecodedXmlFromBase64ZipReqCadastros,
    saveDecodedXmlFromBase64ZipRetProdutoEstoque,
    clearFolderXMLProductsRecursive,
}
