const fs = require ('fs')
const path = require('node:path')
const xml2js = require('xml2js');

const { preparingGetProductsOnSaurus, preparingGetStockProductsOnSaurus, preparingPostProduct , preparingUpdateProduct, preparingDeleteProduct, preparingDeletePermanentProduct, preparingUndeleteProduct, preparingUpdateVariation } = require('./preparingRequests.js');
const { returnCategoryId } = require('./managerCategories.js');
const { requireAllVariationsOfAProduct } = require('./managerVariations.js')
const { registerOrUpdateImage } = require('./managerImages.js')
const { clearFolderXMLProductsRecursive, findProductKeyByIdNuvemShopAsync, gravarLog } = require('./auxFunctions.js');
const { resolveMx } = require('node:dns');

const userDataPath = 'src/build';
//const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathProducts = path.join(userDataPath, 'products.json');


async function requireAllProducts(config){
    return new Promise(async(resolve, reject) => {
        try {
            
            await clearFolderXMLProductsRecursive();

            await preparingGetProductsOnSaurus('1968-08-30T00:00:00-03:00', 1)
            .then(async (response) => {
                let pathXmlProducts = response;

                await new Promise((resolve, reject) => {
                    xml2js.parseString(fs.readFileSync(pathXmlProducts), async (error, result) => {
                        if (error) return rejectParse(error);

                        let products = result['cadastros']['tbProdutoDados'][0]['row'];

                        async function processProductsRecursively(products, index = 0) {
                            if (index >= products.length) return;
                            let idProduct = products[index]['$'].pro_idProduto;
                            let idProdctFather = products[index]['$'].pro_idProdutoPai;

                            await new Promise(res => setTimeout(res, 1500));
                            await preparingGetStockProductsOnSaurus(idProduct, idProdctFather);
                            await processProductsRecursively(products, index + 1);
                        }
                        await processProductsRecursively(products);
                        resolveParse();
                    });
                });
            })
            .then(async () => {
                
            
                await new Promise(async (resolve, reject) => {
                    let dirPath = path.join(userDataPath, 'XMLs', 'products');
                    let productsXml;
                    let arrayOfProducts = []

                    if (!fs.existsSync(dirPath)) return [];
                        productsXml= fs.readdirSync(dirPath).filter(file => fs.lstatSync(path.join(dirPath, file)).isFile());

                    async function readingAllXMLsProductsAndFormatInJson(files, index=0){
                        return new Promise(async (resolve, reject) => {
                            if (index >= products.length) resolve();

                            let pathXmlProduct = path.join(userDataPath, 'XMLs', 'products', files[index]);

                            xml2js.parseString(fs.readFileSync(pathXmlProduct), async (error, response) => {

                                let product = {
                                    ID_PRODUTO: response['Produto']['ProdutoDados'].pro_idProduto,
                                    PRODUTO: response['Produto']['ProdutoDados'].pro_descProduto,
                                    DESCRICAO_COMPLEMENTAR: response['Produto']['ProdutoDados'].pro_infAdic,
                                    VALOR_VENDA: response['Produto']['ProdutoPrecos'][0].pro_vPreco,
                                    ESTOQUE: 0,
                                    MARCA: response['Produto']['ProdutoDados'].pro_idProduto,
                                    STATUS: (response['Produto']['ProdutoDados'].pro_idProduto == 0 ? 'INATIVO' : 'ATIVO'),
                                }

                                arrayOfProducts.push(product)
                            })
                        })
                        
                    }

                    await readingAllXMLsProductsAndFormatInJson(productsXml, index + 1)
                    .then(async () => {
                        await readingAllRecordProducts(arrayOfProducts, 0)
                    })

                })
            })
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
