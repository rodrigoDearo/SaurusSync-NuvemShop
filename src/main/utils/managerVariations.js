const fs = require ('fs')
const path = require('node:path')
const xml2js = require('xml2js')

const { preparingPostVariation, preparingUpdateVariation, preparingDeleteVariation } = require('./preparingRequests.js');

var variationsModificateds;

const userDataPath = 'src/build';
//const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathProducts = path.join(userDataPath, 'products.json');


async function requireAllVariationsOfAProduct(idProduct, nameProduct, stockProduct, xmlOfProducts) {
    return new Promise(async (resolve, reject) => {
        try {
            variationsModificateds = [];

            const parser = new xml2js.Parser({ explicitArray: false });
            const produtos = xmlOfProducts['tbProdutoDados'][0]['row'];
            const precos = xmlOfProducts['tbProdutoPrecos'][0]['row'];

            const produtosArray = Array.isArray(produtos) ? produtos : [produtos];
            const precosArray = Array.isArray(precos) ? precos : [precos];

            // 🔍 Localiza todas as variações do produto (onde pro_idProdutoPai == idProduct)
            const produtosVariacoes = produtosArray.filter(p => p['$'].pro_idProdutoPai == idProduct);

            const variationsRecords = [];

            for (const produto of produtosVariacoes) {
                const idVariante = produto['$'].pro_idProduto;

                // 🔍 Buscar estoque no XML externo
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
        
                        const estoqueData = estoqueXml.retProdutoEstoque.EstoqueLoja['$'];
                        if (estoqueData) {
                            const estoqueItem = Array.isArray(estoqueData) ? estoqueData[0] : estoqueData;
                            estoque = parseFloat(estoqueItem.qSaldo) || 0;
                        }
                    }else{
                        console.log(`Caminho: ${xmlPath} não encontrado`)
                    }
                } catch (err) {
                    console.log(err)
                    estoque = 0;
                }
                

                // 🔍 Buscar preço da menor tabela (menor pro_idTabPreco)
                const precosDaVariante = precosArray.filter(p => p['$'].pro_idProduto == idVariante);

                let valorVenda = 0;
                if (precosDaVariante.length > 0) {

                    const precoSelecionado = precosDaVariante.reduce((anterior, atual) => {
                        return parseInt(atual['$'].pro_idTabPreco) < parseInt(anterior['$'].pro_idTabPreco) ? atual : anterior;
                    });
                    valorVenda = parseFloat(precoSelecionado['$'].pro_vPreco) || 0;
                }
    
                // 🔍 Calcular GRADE (diferença entre nome do produto e nome da variação)
                const grade = produto['$'].pro_descProduto.replace(nameProduct, '').trim();

                if((estoque>0)&&(produto['$'].pro_indStatus=='0')){
                    variationsRecords.push({
                        ID_PRODUTO: idProduct,
                        GRADE: grade,
                        VALOR_VENDA: valorVenda,
                        ESTOQUE: estoque
                    });
                }
                
            }

            // 🔥 Mantendo a mesma chamada da função anterior
            await readingAllRecordVariations(variationsRecords, 0, idProduct, stockProduct);

            resolve({
                code: 200,
                msg: 'Variações consultadas com sucesso'
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

            if(i > variationsRecords.length){
                if(productsDB[`${idProdutoSaurus}`]){
                    await deleteUnlistedVariations(productsDB[`${idProdutoSaurus}`], idProdutoSaurus, variationsModificateds, stockProduct)
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
                    console.log(productsDB[record.ID_PRODUTO])
                }
            }
        } catch (error) {
            console.log(error)
        }

    })
}


async function registerUpdateOrDeleteVariant(variant){
    return new Promise(async (resolve, reject) => {
        let productsDB = JSON.parse(fs.readFileSync(pathProducts))
        let productIdSaurus = variant.codigo;
        var variantAlreadyRegister = productsDB[`${productIdSaurus}`].variations[`${variant.values[0].pt}`] ? true : false;

        const functionReturnIdProductOnNuvem = () => {return productsDB[`${productIdSaurus}`].idNuvemShop}
        let idProductNuvem = functionReturnIdProductOnNuvem()

        const functionReturnIdVariantOnNuvem = () => {if(variantAlreadyRegister){ return productsDB[`${productIdSaurus}`].variations[`${variant.values[0].pt}`] }else{return null}}
        let idVariantNuvem = functionReturnIdVariantOnNuvem()

        if(variantAlreadyRegister){
            await preparingUpdateVariation(variant, idVariantNuvem, idProductNuvem, productIdSaurus)
            .then(() => {
                variationsModificateds.push(variant.values[0].pt)
                resolve()
            })
        }else
        if(!variantAlreadyRegister){
            await preparingPostVariation(variant, idProductNuvem, productIdSaurus)
            .then(() => {
                variationsModificateds.push(variant.values[0].pt)
                resolve()
            })
        }
        
    })
}


async function deleteUnlistedVariations(product, idSaurus, arrayVariations, stockProduct) {
    return new Promise(async (resolve, reject) => {
        let idProductNuvem = product.idNuvemShop;
        let variations = product.variations;

        for(let i=0; i<arrayVariations.length; i++){
            delete variations[`${arrayVariations[i]}`]
        }

        for (const [grade, idVariation] of Object.entries(variations)) {
            setTimeout(async () => {
                await preparingDeleteVariation(idVariation, idProductNuvem, idSaurus, grade, stockProduct)
            }, 1000);
        }
        

        resolve()
    })
}

module.exports = {
    requireAllVariationsOfAProduct
}
