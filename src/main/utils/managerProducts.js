const conexao = require('node-firebird');
const fs = require ('fs')
const path = require('node:path')
const { app } = require('electron')

const { preparingGetProductsAndVariants, preparingPostProduct , preparingUpdateProduct, preparingDeleteProduct, preparingDeletePermanentProduct, preparingUndeleteProduct, preparingUpdateVariation } = require('./preparingRequests.js');
const { returnCategoryId } = require('./managerCategories.js');
const { requireAllVariationsOfAProduct } = require('./managerVariations.js')
const { registerOrUpdateImage } = require('./managerImages.js')
const { findProductKeyByIdNuvemShopAsync, gravarLog } = require('./auxFunctions.js')

const userDataPath = 'src/build';
//const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathProducts = path.join(userDataPath, 'products.json');
var produtosDeletados = 0;

async function requireAllRegistersNuvem(index){
    let productsDB = JSON.parse(fs.readFileSync(pathProducts));
    let finish = false

    return new Promise(async (resolve, reject) => {
        let i = index+1;
        
        await preparingGetProductsAndVariants(i)
        .then(async (response) => {
            if(response){
                await readingProductsOnPage(response, productsDB, 0)
            }else{
                finish = true;
                resolve(produtosDeletados)
            }
        })
        .then(async () => {
            if(!finish){
               await requireAllRegistersNuvem(i)
            }
        })
        .then(() => {
            resolve(produtosDeletados)
        })
        .catch(async () => {
            resolve()
        })
        
    })
}


async function readingProductsOnPage(page, products, index){
    return new Promise(async (resolve, reject) => {
        let i = index+1;
        if(page[index]){
           await findProductKeyByIdNuvemShopAsync(products, page[index].id)
           .then(async (response) => {

                if(response){
//! TRECHO INCOMPLETO - DEVE SER REALIZADO UM DELETE DAS VARIANTS LIDAS NO GET E DELETAR VARIANTES DO JSON
                }else{
                    await preparingDeletePermanentProduct(page[index].id)
                    .then(() => {
                        produtosDeletados++;
                    })
                }
           })
           .then(async () => {
                await readingProductsOnPage(page, products, i)
                .then(() => {
                     resolve()
                })
   
            })
        }else{
            resolve()
        }

    })
}


async function requireAllProducts(config){
    return new Promise(async(resolve, reject) => {
        try {
        conexao.attach(config, function (err, db){
            if (err)
                throw err;
  
            let codigoSQL = `SELECT 
                                P.ID_PRODUTO,
                                P.PRODUTO,
                                P.DESCRICAO_COMPLEMENTAR,
                                P.VALOR_VENDA,
                                P.CUSTO,
                                M.MARCA,
                                P.ESTOQUE,
                                P.STATUS,
                                P.FOTO,
                                P.GRADE,
                                G.GRUPO,
                                SG.SUBGRUPO
                            FROM PRODUTOS P
                            LEFT JOIN PRODUTOS_MARCA M ON P.MARCA = M.ID
                            LEFT JOIN PRODUTOS_GRUPO G ON P.GRUPO = G.ID
                            LEFT JOIN PRODUTOS_SUBGRUPO SG ON P.SUBGRUPO = SG.ID;
                            `;
  
            db.query(codigoSQL, async function (err, result){
                if (err)
                    resolve({code: 500, msg:'ERRO AO CONSULTAR TABELA PRODUTOS, CONTATAR SUPORTE TECNICO'});
                
                await readingAllRecordProducts(result, 0)
                .then(() => {
                    resolve({code: 200, msg:'PRODUTOS CONSULTADOS COM SUCESSO'});
                })
                
            });
          
        db.detach();
        });
  
      } catch (error) {
        reject(error);
      }
    })
}


async function readingAllRecordProducts(productsRecords, index){
    return new Promise(async (resolve, reject) => {
        let record = productsRecords[index]
        let i = index + 1;

        if(i > productsRecords.length){
            resolve()
        }
        else{
            let product = {
                    "codigo": record.ID_PRODUTO,
                    "name": record.PRODUTO,
                    "description": record.DESCRICAO_COMPLEMENTAR,
                    "attributes":[
                        {
                            "pt": 'Variação'
                        }
                    ],
                    "variants": [
                        {
                            "price": parseFloat(String(record.VALOR_VENDA ?? '').replace(',', '.')).toFixed(2),
                            //"cost_price": parseFloat(String(record.CUSTO ?? '').replace(',', '.')).toFixed(2),
                            "stock": parseInt(record.ESTOQUE)
                        }
                    ],
                    "price": parseFloat(String(record.VALOR_VENDA ?? '').replace(',', '.')).toFixed(2),
                    "stock": parseInt(record.ESTOQUE),
                    "brand": `${record.MARCA}`,
                    "published": ((record.STATUS=='ATIVO')&&(parseInt(record.ESTOQUE)>0))? true : false
            }
            await returnCategoryId(record.GRUPO, record.SUBGRUPO)
            .then(async (idCategory) => {
                if(idCategory){
                    product.categories	= [idCategory]
                }
                else{
                    product.categories	= []
                }
                await registerOrUpdateProduct(product)
                .then(async () => {
                    await registerOrUpdateImage(record.FOTO, record.ID_PRODUTO)
                })
            })
            .then(async() => {

                setTimeout(async() => {

                    await readingAllRecordProducts(productsRecords, i)
                    .then(() => {
                        resolve()
                    })
                }, 1500);
            })

        }

    })
}


async function registerOrUpdateProduct(product){
    return new Promise(async (resolve, reject) => {
        let productsDB = JSON.parse(fs.readFileSync(pathProducts))
        let idProductHost = product.codigo;
        let stockProduct = product.stock;
        
        let justProduct = product.variants[0];
        let productAndVariants = product;
        delete productAndVariants.variants //removing variants, body will be afect the product and the variants, once time the "variants" refer to father product

        var productAlreadyRegister = productsDB[`${product.codigo}`] ? true : false;
        var productIsActiveOnHost = product.published

        const functionReturnStatusOnNuvem = () => {if(productAlreadyRegister){ return productsDB[`${product.codigo}`].status }else{return null}}
        const functionReturnUniqueIdProductOnNuvem = () => {if(productAlreadyRegister){ return productsDB[`${product.codigo}`].UniqueId }else{return null}}
        const functionReturnIdProductAndVariantsOnNuvem = () => {if(productAlreadyRegister){ return productsDB[`${product.codigo}`].idNuvemShop }else{return null}}
        
        var statusProductOnNuvem = await functionReturnStatusOnNuvem()

        var productIsActiveOnNuvem =  statusProductOnNuvem == 'ATIVO' ? true : false;
        var UniqueIdProductOnNuvem = functionReturnUniqueIdProductOnNuvem()
        var IdProducAndVariants = functionReturnIdProductAndVariantsOnNuvem()

        if(!productAlreadyRegister&&productIsActiveOnHost){
            await preparingPostProduct(product)
            .then(async () => {
                await requireAllVariationsOfAProduct(idProductHost, stockProduct)
                .then(() => {
                    resolve();
                })
            })
        }else
        if(!productAlreadyRegister&&(!productIsActiveOnHost)){
            resolve()
        }else
        if(productAlreadyRegister&&productIsActiveOnHost){
            if(productIsActiveOnNuvem){
                await preparingUpdateProduct(IdProducAndVariants, productAndVariants)
                .then(async () => {
                    await requireAllVariationsOfAProduct(idProductHost, stockProduct)
                })
                .then(async () => {
                    let productsDBAtualizado = JSON.parse(fs.readFileSync(pathProducts))

                    if(Object.keys(productsDBAtualizado[`${idProductHost}`].variations).length === 0){
                        await preparingUpdateVariation(justProduct, UniqueIdProductOnNuvem, IdProducAndVariants, idProductHost)
                        .then(() => {
                            resolve();
                        })
                    }else{
                      resolve()  
                    } 
                })
            }
            else{
                await preparingUndeleteProduct(product.codigo, IdProducAndVariants, productAndVariants)
                .then(async () => {
                    await requireAllVariationsOfAProduct(idProductHost, stockProduct)
                    .then(() => {
                        resolve();
                    })
                })
            }
        }else
        if(productAlreadyRegister&&(!productIsActiveOnHost)){
            if(productIsActiveOnNuvem){
                await preparingDeleteProduct(product.codigo, IdProducAndVariants, productAndVariants)
                .then(() => {
                    resolve()
                })
            }
            else{
                resolve()
            }
        }
        
    })
}



module.exports = {
    requireAllRegistersNuvem,
    requireAllProducts,
    readingAllRecordProducts
}
