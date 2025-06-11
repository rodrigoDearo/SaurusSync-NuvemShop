const fs = require ('fs')
const path = require('node:path')
const xml2js = require('xml2js');

const { preparingGetProductsOnSaurus, preparingGetStockProductsOnSaurus, preparingPostProduct , preparingUpdateProduct, preparingDeleteProduct, preparingDeletePermanentProduct, preparingUndeleteProduct, preparingUpdateVariation } = require('./preparingRequests.js');
const { returnCategoryId } = require('./managerCategories.js');
const { requireAllVariationsOfAProduct } = require('./managerVariations.js')
const { registerOrUpdateImage } = require('./managerImages.js')
const { findProductKeyByIdNuvemShopAsync, gravarLog } = require('./auxFunctions.js')

const userDataPath = 'src/build';
//const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathProducts = path.join(userDataPath, 'products.json');


async function requireAllProducts(config){
    return new Promise(async(resolve, reject) => {
        try {

            await preparingGetProductsOnSaurus('1968-08-30T00:00:00-03:00', 1)
            .then(async (response) => {
                    let pathXmlProducts = response;

                    xml2js.parseString(fs.readFileSync(pathXmlProducts), async(error, result) => {

                    let products = result['cadastros']['tbProdutoDados'][0]['row']

                    for(let i=0; i<products.length; i++){
                        let product = products[i];
                        //ao inves de for fazer fun recursiva para ler todos os produtos, realizar um getRequest e após isso salvsr na pasta XMLs/estoque
                    }
                })
            })

            
            //deletar todos os arquivos da pasta estoque
            //ler o xml indicado no caminho
            //ler todos os produtos esalvar o get productSotck
            //casoo o produto seja variação indicar nome do arquivo o produto - variação
            //ler todos os arqquivos, em cada arquivo é um produto
            //segue tratamento padrão, deletar, atualizar ou cadastrar




       /*
           await returnPasswordWSSaurus()
           .then(response => {
            console.log(response)
           })
  
            db.query(codigoSQL, async function (err, result){
                if (err)
                    resolve({code: 500, msg:'ERRO AO CONSULTAR TABELA PRODUTOS, CONTATAR SUPORTE TECNICO'});
                
                await readingAllRecordProducts(result, 0)
                .then(() => {
                    resolve({code: 200, msg:'PRODUTOS CONSULTADOS COM SUCESSO'});
                })
                
            });
          
     */
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
    requireAllProducts,
    readingAllRecordProducts
}
