// managerVariations.js - versão corrigida
const fs = require ('fs')
const path = require('node:path')
const xml2js = require('xml2js')
const { app } = require('electron')

const { preparingPostVariation, preparingUpdateVariation, preparingDeleteVariation } = require('./preparingRequests.js');

var variationsModificateds;

//const userDataPath = 'src/build';
const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathProducts = path.join(userDataPath, 'products.json');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function requireAllVariationsOfAProduct(idProduct, nameProduct, stockProduct, xmlOfProducts, tabPreco) {
    return new Promise(async (resolve, reject) => {
        try {
            variationsModificateds = [];

            const parser = new xml2js.Parser({ explicitArray: false });
            const produtos = xmlOfProducts['tbProdutoDados'][0]['row'];
            const precos = xmlOfProducts['tbProdutoPrecos'][0]['row'];

            const produtosArray = Array.isArray(produtos) ? produtos : [produtos];
            const precosArray = Array.isArray(precos) ? precos : [precos];

            // filtra variações desse produto pai
            const produtosVariacoes = produtosArray.filter(p => p['$'].pro_idProdutoPai == idProduct);

            const variationsRecords = [];

            for (const produto of produtosVariacoes) {
                const idVariante = produto['$'].pro_idProduto;
                const statusVariante = produto['$'].pro_indStatus;

                // --- buscar preço na tabPreco (obrigatório) ---
                const precosDaVariante = precosArray.filter(p => p['$'].pro_idProduto == idVariante && String(p['$'].pro_idTabPreco) == String(tabPreco));
                if (precosDaVariante.length === 0) {
                    // não tem preço na tabela configurada -> ignorar variação
                    continue;
                }
                const valorVenda = parseFloat(String(precosDaVariante[0]['$'].pro_vPreco ?? "").replace(',', '.')) || 0;
                if (valorVenda <= 0) continue; // preço inválido

                // --- buscar estoque dessa variação em seu XML (se existir) ---
                let estoque = 0;
                try {
                    const xmlPath = path.join(
                        userDataPath,
                        'XMLs',
                        'products',
                        'variations',
                        `${idProduct}`,
                        `${idVariante}.xml`
                    );

                    if (fs.existsSync(xmlPath)) {
                        const xmlContent = fs.readFileSync(xmlPath, 'utf8');
                        const estoqueXml = await parser.parseStringPromise(xmlContent);

                        // considerar possível array de EstoqueLoja e somar qSaldo
                        const estoqueNodes = estoqueXml.retProdutoEstoque?.EstoqueLoja ?? [];
                        if (Array.isArray(estoqueNodes) && estoqueNodes.length > 0) {
                            estoque = estoqueNodes.reduce((acc, node) => {
                                const q = parseFloat(node["$"]?.qSaldo ?? 0) || 0;
                                return acc + q;
                            }, 0);
                        } else if (estoqueNodes && estoqueNodes["$"]) {
                            estoque = parseFloat(estoqueNodes["$"].qSaldo) || 0;
                        }
                        estoque = parseInt(Math.floor(estoque));
                    } else {
                        // arquivo XML não existe: considerar 0
                        estoque = 0;
                        //console.log(`Caminho: ${xmlPath} não encontrado`);
                    }
                } catch (err) {
                    console.log(err)
                    estoque = 0;
                }

                // --- calcular GRADE (remover o nome do produto do nome da variação) ---
                // usar regex case-insensitive para remover ocorrência inicial do nome do produto
                let grade = produto['$'].pro_descProduto;
                if (nameProduct && nameProduct.trim() !== "") {
                    const re = new RegExp('^' + escapeRegExp(nameProduct), 'i');
                    grade = grade.replace(re, '').trim();
                } else {
                    grade = grade.trim();
                }

                // condição para considerar variação: estoque > 0 e status ativo no Saurus
                if((estoque>0) && (statusVariante == '0')) {
                    variationsRecords.push({
                        ID_PRODUTO: idProduct,
                        ID_VARIACAO: idVariante,
                        GRADE: grade,
                        VALOR_VENDA: valorVenda,
                        ESTOQUE: estoque
                    });
                }
            }

            // processa as variações encontradas (criar/atualizar/deletar não listadas)
            await readingAllRecordVariations(variationsRecords, 0, idProduct, stockProduct);

            resolve({
                code: 200,
                msg: 'Variações consultadas com sucesso',
                variationsProcessed: variationsModificateds
            });

        } catch (error) {
            console.log(error)
            reject({
                code: 500,
                msg: 'Erro ao consultar variações',
                error: error.message
            });
        }
    });
}


async function readingAllRecordVariations(variationsRecords, index, idProdutoSaurus, stockProduct){
    return new Promise(async (resolve, reject) => {
        try {
            let productsDB = JSON.parse(fs.readFileSync(pathProducts));
            let record;

            if(variationsRecords){
                record = variationsRecords[index]
            }else{
                variationsRecords = []
            }
            
            let i = index + 1;

            // quando terminar, deletar variações que estavam no products.json mas não vieram do Saurus
            if(i > variationsRecords.length){
                if(productsDB[`${idProdutoSaurus}`]){
                    await deleteUnlistedVariations(productsDB[`${idProdutoSaurus}`], idProdutoSaurus, variationsModificateds, stockProduct)
                    .then(async () => {
                        resolve()
                    })
                }else{
                    resolve()
                }

                return;
            }
            else{
                // montar objeto variante
                let variant = {
                    "values": [
                        {
                            "pt": record.GRADE
                        }
                    ],
                    "codigo": record.ID_VARIACAO, // id da variação (Saurus)
                    "productId": record.ID_PRODUTO, // id do produto pai (Saurus)
                    "price": parseFloat(String(record.VALOR_VENDA ?? '').replace(',', '.')).toFixed(2),
                    //"cost_price": parseFloat(String(record.CUSTO ?? '').replace(',', '.')).toFixed(2),
                    "stock": parseInt(record.ESTOQUE),
                }
    
                if(productsDB[`${idProdutoSaurus}`]){
                    await registerUpdateOrDeleteVariant(variant)
                    .then(async() => {
                        setTimeout(async () => {
                            await readingAllRecordVariations(variationsRecords, i, idProdutoSaurus, stockProduct)
                            .then(() => {
                                resolve()
                            })
                        }, 400);
                    })
                }
                else{
                    // produto pai não existe mais no DB local — nada a fazer
                    setTimeout(async () => {
                        await readingAllRecordVariations(variationsRecords, i, idProdutoSaurus, stockProduct)
                        .then(() => resolve())
                    }, 400)
                }
            }
        } catch (error) {
            console.log(error)
            resolve()
        }

    })
}


async function registerUpdateOrDeleteVariant(variant){
    return new Promise(async (resolve, reject) => {
        let productsDB = JSON.parse(fs.readFileSync(pathProducts))
        let parentProductId = variant.productId; // ID do produto pai
        // segurança: verificar existência do produto pai no DB
        if(!productsDB[`${parentProductId}`]) {
            return resolve();
        }

        var variantAlreadyRegister = productsDB[`${parentProductId}`].variations && productsDB[`${parentProductId}`].variations[`${variant.values[0].pt}`] ? true : false;

        const functionReturnIdProductOnNuvem = () => {return productsDB[`${parentProductId}`].idNuvemShop}
        let idProductNuvem = functionReturnIdProductOnNuvem()

        const functionReturnIdVariantOnNuvem = () => {if(variantAlreadyRegister){ return productsDB[`${parentProductId}`].variations[`${variant.values[0].pt}`] }else{return null}}
        let idVariantNuvem = functionReturnIdVariantOnNuvem()

        if(variantAlreadyRegister){
            await preparingUpdateVariation(variant, idVariantNuvem, idProductNuvem, parentProductId)
            .then(() => {
                variationsModificateds.push(variant.values[0].pt)
                resolve()
            }).catch((err) => {
                console.log("Erro preparingUpdateVariation:", err)
                resolve()
            })
        }else{
            await preparingPostVariation(variant, idProductNuvem, parentProductId)
            .then(() => {
                variationsModificateds.push(variant.values[0].pt)
                resolve()
            }).catch((err) => {
                console.log("Erro preparingPostVariation:", err)
                resolve()
            })
        }
        
    })
}


async function deleteUnlistedVariations(product, idSaurus, arrayVariations, stockProduct) {
    return new Promise(async (resolve, reject) => {
        let idProductNuvem = product.idNuvemShop;
        let variations = Object.assign({}, product.variations || {});

        // remover do objeto 'variations' as que foram atualizadas/criadas
        for(let i=0; i<arrayVariations.length; i++){
            delete variations[`${arrayVariations[i]}`]
        }

        // tudo que sobrar em `variations` são variações que NÃO vieram do Saurus -> deletar
        for (const [grade, idVariation] of Object.entries(variations)) {
            // chamar delete com delay para não saturar
            await new Promise(res => setTimeout(res, 800));
            await preparingDeleteVariation(idVariation, idProductNuvem, idSaurus, grade, stockProduct).catch(err => {
                console.log("Erro preparingDeleteVariation:", err)
            });
        }
        
        resolve()
    })
}

module.exports = {
    requireAllVariationsOfAProduct
}
