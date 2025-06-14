const axios = require('axios');
const xml2js = require('xml2js');

const { saveDecodedXmlFromBase64ZipReqCadastros, saveDecodedXmlFromBase64ZipRetProdutoEstoque } = require('./auxFunctions');

async function getProducts(body, header){
    return new Promise(async (resolve, reject) => {
        axios.post('https://wscadastros.saurus.net.br/v001/serviceCadastros.asmx', body, { headers: header })
        .then(async (answer) => {
            xml2js.parseString(answer.data, async (err, result) => {
                if (err) {
                    console.error('Erro ao parsear XML:', err);
                    return reject(err);
                }

                const base64String = result['soap:Envelope']['soap:Body'][0]['retCadastrosResponse'][0]['retCadastrosResult'][0]
                
                const xmlPath = await saveDecodedXmlFromBase64ZipReqCadastros(base64String);
                resolve(xmlPath);
            });
        })
        .catch(async (error) => {
            console.log(error.response);
            reject(error);
        });
    });
}


async function getStockProduct(body, header, idProduct, idProductFather) {
    return new Promise(async (resolve, reject) => {
        axios.post('https://wsretaguarda.saurus.net.br/v001/serviceRetaguarda.asmx', body, { headers: header })
        .then(async (answer) => {
            xml2js.parseString(answer.data, async (err, result) => {
                if (err) {
                    console.error('Erro ao parsear XML:', err);
                    return reject(err);
                }

                const base64String = result['soap:Envelope']['soap:Body'][0]['retProdutoResponse'][0]['retProdutoResult'][0];

                const xmlPath = await saveDecodedXmlFromBase64ZipRetProdutoEstoque(base64String, idProduct, idProductFather);
                resolve(xmlPath);
            });
        })
        .catch(async (error) => {
            console.log(error.response);
            reject(error);
        });
    });
}

module.exports = {
  getProducts,
  getStockProduct
}