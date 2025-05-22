/* ---------------------- IMPORTAÇÃO DE MÓDULOS ----------------------*/
const fs = require('fs');
const path = require('path');
const { app } = require('electron')

const { preparingUploadImage, preparingDeleteImage } = require('./preparingRequests.js');
const { returnValueFromJson } = require('./manageInfoUser');
const { gravarLog } = require('./auxFunctions');

const userDataPath = 'src/build';
//const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathProducts = path.join(userDataPath, 'products.json');


async function retornarBase64DaImagem(caminho, image) {
  const caminhoImagem = path.join(caminho, 'imgProdutos', image);

  if (!fs.existsSync(caminhoImagem)) {
    return false;
  }
  try {
    const buffer = fs.readFileSync(caminhoImagem);
    return buffer.toString('base64');
  } catch (error) {
    gravarLog(`Erro na codificação da imagem ${caminhoImagem} em BASE64`);
    throw error; // deixa o tratamento para o catch da função pai
  }
}


async function registerOrUpdateImage(nameImage, idProductHost){
  return new Promise(async (resolve, reject) => {
    try {
      let productsDB = JSON.parse(fs.readFileSync(pathProducts))

      let image, idProductNuvem;      

      if(productsDB[`${idProductHost}`]){
        image = productsDB[`${idProductHost}`].imageId
        idProductNuvem = productsDB[`${idProductHost}`].idNuvemShop
      }else{  
        resolve()
      }

      if(nameImage){
        await returnValueFromJson('pathdbhost')
        .then(async (response) => {
          const imgBase64 = await retornarBase64DaImagem(response, nameImage);
          const last8OfString = imgBase64.toString().slice(-8);

          if(image){
            if(last8OfString==productsDB[`${idProductHost}`].hashImage){
              resolve()
            }
            else{
              await preparingDeleteImage(idProductNuvem, image, idProductHost)
              .then(async() => {
                await preparingUploadImage(imgBase64, idProductNuvem, idProductHost, last8OfString)
              })
              .then(() => {
                resolve()
              })
            }
          }else{
            await preparingUploadImage(imgBase64, idProductNuvem, idProductHost, last8OfString)
            .then(() => {
              resolve()
            })
          }

        })
       
      }else{
        if(image){
            await preparingDeleteImage(idProductNuvem, image, idProductHost)
            .then(() => {
              resolve()
            })
          }else{
            resolve()
          }
      }

    } catch (error) {
      console.log(error)
      gravarLog('Erro ao processar a imagem:', error)
      resolve()
    }
  })
}

module.exports = {
  registerOrUpdateImage
};
