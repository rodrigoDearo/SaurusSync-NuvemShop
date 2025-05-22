const conexao = require('node-firebird');
const fs = require ('fs')
const path = require('node:path')
const { app } = require('electron')

const { preparingPostVariation, preparingUpdateVariation, preparingDeleteVariation } = require('./preparingRequests.js');
const { returnConfigToAccessDB } = require('./auxFunctions.js')

var variationsModificateds = []

const userDataPath = 'src/build';
//const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathProducts = path.join(userDataPath, 'products.json');


async function requireAllVariationsOfAProduct(idProduct, stockProduct){
    return new Promise(async(resolve, reject) => {
        try {
        variationsModificateds = []

        let config;

        await returnConfigToAccessDB()
        .then(response => {
            config = response
        })

        conexao.attach(config, function (err, db){
            if (err)
                throw err;
  
            let codigoSQL = `SELECT 
                                PG.ID_PRODUTO,
                                PG.BARRAS,
                                P.VALOR_VENDA,
                                P.CUSTO,
                                G.GRADE,
                                PG.ESTOQUE,
                                P.STATUS
                            FROM PRODUTOS_GRADE_ITENS PG
                            LEFT JOIN PRODUTOS P ON PG.ID_PRODUTO = P.ID_PRODUTO
                            LEFT JOIN GRADE G ON PG.ID_GRADE = G.ID
                            WHERE PG.ID_PRODUTO='${idProduct}'
                            AND G.GRADE!='null'
                            AND PG.ESTOQUE > 0;`;
  
            db.query(codigoSQL, async function (err, result){
                if (err)
                    resolve({code: 500, msg:'ERRO AO CONSULTAR TABELA VARIACOES, CONTATAR SUPORTE TECNICO'});
                
                await readingAllRecordVariations(result, 0, idProduct, stockProduct)
                .then(() => {
                    resolve({code: 200, msg:'VARIACOES CONSULTADAS COM SUCESSO'});
                })
                
            });
          
        db.detach();
        });
  
      } catch (error) {
        reject(error);
      }
    })
}


async function readingAllRecordVariations(variationsRecords, index, idProdutoHost, stockProduct){
    return new Promise(async (resolve, reject) => {
        let productsDB = JSON.parse(fs.readFileSync(pathProducts));
        let record;

        if(variationsRecords){
            record = variationsRecords[index]
        }else{
            variationsRecords = []
        }
         
        let i = index + 1;

        if(i > variationsRecords.length){
            if(productsDB[`${idProdutoHost}`]){
                await deleteUnlistedVariations(productsDB[`${idProdutoHost}`], idProdutoHost, variationsModificateds, stockProduct)
                .then(async () => {
                    resolve()
                })
            }else{
                resolve()
            }

        }
        else{
            let variant = {
                "values": [
                      {
                        "pt": record.GRADE
                      }
                ],
                "codigo": record.ID_PRODUTO,
                "price": parseFloat(String(record.VALOR_VENDA ?? '').replace(',', '.')).toFixed(2),
                //"cost_price": parseFloat(String(record.CUSTO ?? '').replace(',', '.')).toFixed(2),
                "stock": parseInt(record.ESTOQUE),
            }
            
            if(productsDB[`${record.ID_PRODUTO}`]){
                await registerUpdateOrDeleteVariant(variant)
                .then(async() => {
                    setTimeout(async () => {
                        await readingAllRecordVariations(variationsRecords, i, idProdutoHost, stockProduct)
                        .then(() => {
                            resolve()
                        })
                    }, 400);
                })
            }

        }

    })
}


async function registerUpdateOrDeleteVariant(variant){
    return new Promise(async (resolve, reject) => {
        let productsDB = JSON.parse(fs.readFileSync(pathProducts))
        let productIdHost = variant.codigo;
        var variantAlreadyRegister = productsDB[`${productIdHost}`].variations[`${variant.values[0].pt}`] ? true : false;

        const functionReturnIdProductOnNuvem = () => {return productsDB[`${productIdHost}`].idNuvemShop}
        let idProductNuvem = functionReturnIdProductOnNuvem()

        const functionReturnIdVariantOnNuvem = () => {if(variantAlreadyRegister){ return productsDB[`${productIdHost}`].variations[`${variant.values[0].pt}`] }else{return null}}
        let idVariantNuvem = functionReturnIdVariantOnNuvem()

        if(variantAlreadyRegister){
            await preparingUpdateVariation(variant, idVariantNuvem, idProductNuvem, productIdHost)
            .then(() => {
                variationsModificateds.push(variant.values[0].pt)
                resolve()
            })
        }else
        if(!variantAlreadyRegister){
            await preparingPostVariation(variant, idProductNuvem, productIdHost)
            .then(() => {
                variationsModificateds.push(variant.values[0].pt)
                resolve()
            })
        }
        
    })
}


async function deleteUnlistedVariations(product, idHost, arrayVariations, stockProduct) {
    return new Promise(async (resolve, reject) => {
        let idProductNuvem = product.idNuvemShop;
        let variations = product.variations;

        for(let i=0; i<arrayVariations.length; i++){
            delete variations[`${arrayVariations[i]}`]
        }

        for (const [grade, idVariation] of Object.entries(variations)) {
            setTimeout(async () => {
                await preparingDeleteVariation(idVariation, idProductNuvem, idHost, grade, stockProduct)
            }, 1000);
        }
        

        resolve()
    })
}

module.exports = {
    requireAllVariationsOfAProduct
}
