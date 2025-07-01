const fs = require('fs');
const path = require('node:path');
const xml2js = require('xml2js');
const { app } = require('electron')

const { preparingGetProductsOnSaurus, preparingGetStockProductsOnSaurus, preparingPostProduct, preparingUpdateProduct, preparingDeleteProduct, preparingDeletePermanentProduct, preparingUndeleteProduct, preparingUpdateVariation } = require('./preparingRequests.js');

const { returnCategoryId } = require('./managerCategories.js');
const { requireAllVariationsOfAProduct } = require('./managerVariations.js');
const { clearFolderXMLProductsRecursive, getActualDatetime, gravarLog } = require('./auxFunctions.js');

//const userDataPath = 'src/build';
const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathProducts = path.join(userDataPath, 'products.json');

var recordsInReqCadastros;

async function requireAllProducts(initialRequest) {
    return new Promise(async (resolve, reject) => {
        try {
            await clearFolderXMLProductsRecursive();

            let dateTimeToRequest = await getActualDatetime(initialRequest)

            await preparingGetProductsOnSaurus(dateTimeToRequest, 1)
                .then(async (response) => {
                    if(response==null){
                        throw new Error
                    }

                    let pathXmlProducts = response;

                    await new Promise((resolve, reject) => {
                        xml2js.parseString(fs.readFileSync(pathXmlProducts), async (error, result) => {
                            if (error) return reject(error);

                            let products = result['cadastros']['tbProdutoDados'][0]['row'];
                            recordsInReqCadastros = result['cadastros'];

                            async function processProductsRecursively(products, index = 0) {
                                if (index >= products.length) return;

                                let idProduct = products[index]['$'].pro_idProduto;
                                let idProductFather = products[index]['$'].pro_idProdutoPai;

                                if (!idProductFather) {
                                    // Produto pai
                                    await preparingGetStockProductsOnSaurus(idProduct, null);
                                } else {
                                    // Variação
                                    await preparingGetStockProductsOnSaurus(idProduct, idProductFather);
                                }

                                await new Promise(res => setTimeout(res, 2000));
                                await processProductsRecursively(products, index + 1);
                            }

                            await processProductsRecursively(products);
                            resolve();
                        });
                    });
                })
                .then(async () => {
                    readingAllXMLsProductsAndFormatInJson(recordsInReqCadastros)
                    .then(async (response) => {
                        await readingAllRecordProducts(response, 0)
                    })
                    .then(() => {
                        resolve()
                    })
                })
                .catch((error) => {
                    console.log(error)
                })

        } catch (error) {
            reject(error);
        }
    });
}

async function readingAllXMLsProductsAndFormatInJson(records, index = 0, arrayJson = []) {
    return new Promise(async (resolve, reject) => {
        try {
            const produtos = records.tbProdutoDados[0].row;
            const precos = records.tbProdutoPrecos[0].row;

            if (index >= produtos.length) return resolve(arrayJson);

            const produto = produtos[index]['$'];

            if (produto.pro_idProdutoPai) {
                return resolve(await readingAllXMLsProductsAndFormatInJson(records, index + 1, arrayJson));
            }

            const idProduto = produto.pro_idProduto;

            const precosDoProduto = precos
                .filter(p => p['$'].pro_idProduto === idProduto)
                .sort((a, b) => parseInt(a['$'].pro_idTabPreco) - parseInt(b['$'].pro_idTabPreco));

            const preco = precosDoProduto.length > 0
                ? parseFloat(precosDoProduto[0]['$'].pro_vPreco)
                : 0;

            const pathXmlProduct = path.join(userDataPath, 'XMLs', 'products', idProduto + '.xml');

            let estoque = 0;
            if (fs.existsSync(pathXmlProduct)) {
                const xmlEstoque = fs.readFileSync(pathXmlProduct, 'utf-8');
                await xml2js.parseStringPromise(xmlEstoque).then(result => {
                    const estoqueRow = result.retProdutoEstoque?.EstoqueLoja?.[0]?.['$'];
                    if (estoqueRow) {
                        estoque = parseInt(parseFloat(estoqueRow.qSaldo));
                    }
                }).catch(() => {
                    estoque = 0;
                });
            }

            const categoria = produto.pro_descCategoria == 'Sem Categoria' ? '' : produto.pro_descCategoria;
            const subcategoria = produto.pro_descSubCategoria == 'Sem Subcategoria' ? '' : produto.pro_descSubCategoria;
            const marca = produto.pro_descMarca == 'Sem Marca' ? '' : produto.pro_descMarca;

            const obj = {
                ID_PRODUTO: idProduto,
                PRODUTO: produto.pro_descProduto,
                DESCRICAO_COMPLEMENTAR: produto.pro_infAdic ?? '',
                VALOR_VENDA: preco,
                ESTOQUE: estoque,
                MARCA: marca,
                STATUS: produto.pro_indStatus,
                CATEGORIA: categoria,
                SUBCATEGORIA: subcategoria
            };

            arrayJson.push(obj);

            resolve(await readingAllXMLsProductsAndFormatInJson(records, index + 1, arrayJson));

        } catch (error) {
            console.log(error)
            reject(error);
        }
    });
}

async function readingAllRecordProducts(productsRecords, index) {
    return new Promise(async (resolve, reject) => {
        try {
            let record = productsRecords[index];
            let i = index + 1;

            if (i > productsRecords.length) {
                resolve();
            } else {
                let product = {
                    "codigo": record.ID_PRODUTO,
                    "name": record.PRODUTO,
                    "description": record.DESCRICAO_COMPLEMENTAR,
                    "attributes": [
                        {
                            "pt": 'Variação'
                        }
                    ],
                    "variants": [
                        {
                            "price": parseFloat(String(record.VALOR_VENDA ?? '').replace(',', '.')).toFixed(2),
                            "stock": parseInt(record.ESTOQUE)
                        }
                    ],
                    "price": parseFloat(String(record.VALOR_VENDA ?? '').replace(',', '.')).toFixed(2),
                    "stock": parseInt(record.ESTOQUE),
                    "brand": record.MARCA,
                    "published": ((record.STATUS == '0') && (parseInt(record.ESTOQUE) > 0)) ? true : false
                };

                await returnCategoryId(record.CATEGORIA, record.SUBCATEGORIA)
                    .then(async (idCategory) => {
                        if (idCategory) {
                            product.categories = [idCategory];
                        } else {
                            product.categories = [];
                        }
                        await registerOrUpdateProduct(product);
                    })
                    .then(async () => {
                        setTimeout(async () => {
                            await readingAllRecordProducts(productsRecords, i)
                                .then(() => {
                                    resolve();
                                });
                        }, 1500);
                    })
                    .catch((error) => {
                        console.log(error)
                    })
                    
            }
        } catch (error) {
            console.log(error)
        }
        
    });
}

async function registerOrUpdateProduct(product) {
    return new Promise(async (resolve, reject) => {
        try {
            let productsDB = JSON.parse(fs.readFileSync(pathProducts));
            let idProductSaurus = product.codigo;
            let stockProduct = product.stock;
            let nameProduct = product.name;

            let justProduct = product.variants[0];
            let productAndVariants = product;
            delete productAndVariants.variants;

            var productAlreadyRegister = productsDB[`${product.codigo}`] ? true : false;
            var productIsActiveOnSaurus = product.published;

            const functionReturnStatusOnNuvem = () => { if (productAlreadyRegister) { return productsDB[`${product.codigo}`].status } else { return null } };
            const functionReturnUniqueIdProductOnNuvem = () => { if (productAlreadyRegister) { return productsDB[`${product.codigo}`].UniqueId } else { return null } };
            const functionReturnIdProductAndVariantsOnNuvem = () => { if (productAlreadyRegister) { return productsDB[`${product.codigo}`].idNuvemShop } else { return null } };

            var statusProductOnNuvem = await functionReturnStatusOnNuvem();
            var productIsActiveOnNuvem = statusProductOnNuvem == 'ATIVO' ? true : false;
            var UniqueIdProductOnNuvem = functionReturnUniqueIdProductOnNuvem();
            var IdProducAndVariants = functionReturnIdProductAndVariantsOnNuvem();

            if (!productAlreadyRegister && productIsActiveOnSaurus) {
                await preparingPostProduct(product)
                    .then(async () => {
                        await requireAllVariationsOfAProduct(idProductSaurus, nameProduct, stockProduct, recordsInReqCadastros)
                            .then(() => {
                                resolve();
                            });
                    });
            } else if (!productAlreadyRegister && (!productIsActiveOnSaurus)) {
                resolve();
            } else if (productAlreadyRegister && productIsActiveOnSaurus) {

                if (productIsActiveOnNuvem) {
                    await preparingUpdateProduct(IdProducAndVariants, productAndVariants)
                    .then(async () => {
                        await requireAllVariationsOfAProduct(idProductSaurus, nameProduct, stockProduct, recordsInReqCadastros);
                    })
                    .then(async () => {
                        let productsDBAtualizado = JSON.parse(fs.readFileSync(pathProducts));

                        if (Object.keys(productsDBAtualizado[`${idProductSaurus}`].variations).length === 0) {
                            await preparingUpdateVariation(justProduct, UniqueIdProductOnNuvem, IdProducAndVariants, idProductSaurus)
                            .then(() => {
                                resolve();
                            });
                        } else {
                            resolve();
                        }
                    });
                } else {
                    await preparingUndeleteProduct(product.codigo, IdProducAndVariants, productAndVariants)
                        .then(async () => {
                            await requireAllVariationsOfAProduct(idProductSaurus, nameProduct, stockProduct, recordsInReqCadastros)
                                .then(() => {
                                    resolve();
                                });
                        });
                }

            } else if (productAlreadyRegister && (!productIsActiveOnSaurus)) {
                if (productIsActiveOnNuvem) {
                    await preparingDeleteProduct(product.codigo, IdProducAndVariants, productAndVariants)
                        .then(() => {
                            resolve();
                        });
                } else {
                    resolve();
                }
            }
        } catch (error) {
            console.log(error)
        }
      
    });
}

module.exports = {
    requireAllProducts,
    readingAllRecordProducts,
    readingAllXMLsProductsAndFormatInJson
};
