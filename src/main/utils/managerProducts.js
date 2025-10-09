// managerProducts.js - versão corrigida
const fs = require("fs");
const path = require("node:path");
const xml2js = require("xml2js");
const { app } = require("electron");

const {
  preparingGetProductsOnSaurus,
  preparingGetStockProductsOnSaurus,
  preparingPostProduct,
  preparingUpdateProduct,
  preparingDeleteProduct,
  preparingDeletePermanentProduct,
  preparingUndeleteProduct,
  preparingUpdateVariation,
} = require("./preparingRequests.js");

const { returnCategoryId } = require("./managerCategories.js");
const { returnValueFromJson } = require("./manageInfoUser.js");
const { requireAllVariationsOfAProduct } = require("./managerVariations.js");
const { clearFolderXMLProductsRecursive, getActualDatetime, gravarLog }= require("./auxFunctions.js");

const userDataPath = "src/build";
//const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathProducts = path.join(userDataPath, "products.json");

var recordsInReqCadastros, tabPreco, idProdutos;

function delay(ms){ return new Promise(res => setTimeout(res, ms)); }

async function requireAllProducts(initialRequest) {
  return new Promise(async (resolve, reject) => {
    try {
      await clearFolderXMLProductsRecursive();

      tabPreco = await returnValueFromJson("tabeladeprecosaurus");
      let dateTimeToRequest = await getActualDatetime(initialRequest);

      await preparingGetProductsOnSaurus(dateTimeToRequest, 1)
        .then(async (response) => {
          let pathXmlProducts;

          if (response) {
            pathXmlProducts = response;
          } else {
            pathXmlProducts = await preparingGetProductsOnSaurus(
              "1968-08-30T00:00:00-03:00",
              1
            );
          }

          await new Promise((resolve, reject) => {
            xml2js.parseString(
              fs.readFileSync(pathXmlProducts),
              async (error, result) => {
                if (error) return reject(error);

                if (!result["cadastros"]["tbProdutoDados"]) {
                  resolve();
                }

                let products = result["cadastros"]["tbProdutoDados"][0]["row"];
                recordsInReqCadastros = result["cadastros"];

                async function processProductsOptimized(products) {
                    const produtosDB = JSON.parse(fs.readFileSync(pathProducts));
                    const precos = recordsInReqCadastros.tbProdutoPrecos[0].row;

                    const produtosASeremBaixados = new Set();
                    const variacoesBaixadas = [];

                    // 1ª Passada: verificar quais produtos principais precisam de XML de estoque
                    for (const produto of products) {
                        const info = produto["$"];
                        const idProduto = info.pro_idProduto;
                        const idProdutoPai = info.pro_idProdutoPai;

                        // só consideramos produtos principais (sem pai)
                        if (idProdutoPai) continue;

                        // verifica se o produto tem preço na tabela configurada
                        const precosDoProduto = precos.filter((p) => p["$"].pro_idProduto === idProduto);
                        let hasPriceInTab = precosDoProduto.some((p) => {
                            const preco = p["$"];
                            // tratar vírgula -> ponto
                            const v = parseFloat(String(preco.pro_vPreco ?? "").replace(",", "."));
                            return String(preco.pro_idTabPreco) == String(tabPreco) && !isNaN(v) && v > 0;
                        });

                        const estaNoDB = produtosDB.hasOwnProperty(idProduto);
                        const statusSaurusIsActive = info.pro_indStatus === "0"; // '0' = ativo

                        // regra:
                        // - se possui preço na tabela configurada E está ativo no Saurus -> baixar (candidato a cadastro/atualização)
                        // - se já existe no products.json -> baixar também (precisamos checar se deve ser ocultado)
                        if ((hasPriceInTab && statusSaurusIsActive) || estaNoDB) {
                            produtosASeremBaixados.add(idProduto);
                            await preparingGetStockProductsOnSaurus(idProduto, null);
                            await delay(800);
                        }
                    }

                    // 2ª Passada: baixar variações dos produtos que serão processados
                    for (const produto of products) {
                        const info = produto["$"];
                        const idProduto = info.pro_idProduto;
                        const idProdutoPai = info.pro_idProdutoPai;

                        if (idProdutoPai && produtosASeremBaixados.has(idProdutoPai)) {
                            variacoesBaixadas.push(idProduto);
                            await preparingGetStockProductsOnSaurus(idProduto, idProdutoPai);
                            await delay(500);
                        }
                    }

                    idProdutos = Array.from(produtosASeremBaixados);

                    gravarLog("Produtos principais baixados:", idProdutos.length);
                    gravarLog("Variacoes baixadas:", variacoesBaixadas.length);
                    gravarLog("IDs dos produtos:", idProdutos);
                    gravarLog("IDs das variações:", variacoesBaixadas);
                }

                await processProductsOptimized(products);

                resolve();
              }
            );
          });
        })
        .then(async () => {
          // transforma XMLs baixados em JSON filtrado (só produtos com XML de estoque baixado)
          const response = await readingAllXMLsProductsAndFormatInJson(recordsInReqCadastros, idProdutos);
          await readingAllRecordProducts(response, 0);
          resolve();
        })
        .catch((error) => {
          console.log(error);
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

async function readingAllXMLsProductsAndFormatInJson(records, idsProdutosComXmlEstoque) {
  return new Promise(async (resolve, reject) => {
    try {
      const produtos = records.tbProdutoDados[0].row;
      const precos = records.tbProdutoPrecos[0].row;
      const arrayJson = [];

      for (let index = 0; index < produtos.length; index++) {
        const produto = produtos[index]["$"];
        const idProduto = produto.pro_idProduto;

        // Se não tem XML de estoque baixado, ignora e passa para o próximo
        if (!idsProdutosComXmlEstoque.includes(idProduto)) {
          continue;
        }

        // Ignora variações aqui (só queremos produtos principais)
        if (produto.pro_idProdutoPai) {
          continue;
        }

        // Obtém o preço do produto na tabela válida
        const precoObj = precos.find(
          (p) => p["$"].pro_idProduto === idProduto && String(p["$"].pro_idTabPreco) == String(tabPreco)
        );

        const preco = precoObj ? parseFloat(String(precoObj["$"].pro_vPreco ?? "").replace(",", ".")) : 0;

        // Pega o estoque do XML baixado (somando todos os EstoqueLoja se houver múltiplos)
        const pathXmlProduct = path.join(
          userDataPath,
          "XMLs",
          "products",
          idProduto + ".xml"
        );

        let estoque = 0;
        if (fs.existsSync(pathXmlProduct)) {
          const xmlEstoque = fs.readFileSync(pathXmlProduct, "utf-8");
          try {
            const result = await xml2js.parseStringPromise(xmlEstoque);
            const estoqueNodes = result.retProdutoEstoque?.EstoqueLoja ?? [];
            if (Array.isArray(estoqueNodes) && estoqueNodes.length > 0) {
              estoque = estoqueNodes.reduce((acc, node) => {
                const q = parseFloat(node["$"]?.qSaldo ?? 0) || 0;
                return acc + q;
              }, 0);
            } else if (estoqueNodes && estoqueNodes["$"]) {
              estoque = parseFloat(estoqueNodes["$"].qSaldo) || 0;
            }
            estoque = parseInt(Math.floor(estoque));
          } catch (e) {
            estoque = 0;
          }
        }

        const categoria = (produto.pro_descCategoria?.toUpperCase() === "SEM CATEGORIA") ? "" : produto.pro_descCategoria;
        const subcategoria = (produto.pro_descSubCategoria?.toUpperCase() === "SEM SUBCATEGORIA") ? "" : produto.pro_descSubCategoria;
        const marca = (produto.pro_descMarca?.toUpperCase() === "SEM MARCA") ? "" : produto.pro_descMarca;

        // published segue a regra: estoque > 0, preco > 0 e status ativo (0)
        const published = estoque > 0 && preco > 0 && produto.pro_indStatus === "0";

        const obj = {
          ID_PRODUTO: idProduto,
          PRODUTO: produto.pro_descProduto,
          DESCRICAO_COMPLEMENTAR: produto.pro_infAdic ?? "",
          VALOR_VENDA: preco,
          ESTOQUE: estoque,
          MARCA: marca,
          STATUS: produto.pro_indStatus,
          CATEGORIA: categoria,
          SUBCATEGORIA: subcategoria,
          published,
        };

        arrayJson.push(obj);
      }

      resolve(arrayJson);
    } catch (error) {
      console.log(error);
      reject(error);
    }
  });
}


async function readingAllRecordProducts(productsRecords, index) {
  return new Promise(async (resolve, reject) => {
    try {
      if(!productsRecords || productsRecords.length===0){
        resolve();
        return;
      }

      const record = productsRecords[index];
      const i = index + 1;

      if (index >= productsRecords.length) {
        resolve();
        return;
      }

      const valorVenda = parseFloat(
        String(record.VALOR_VENDA ?? "").replace(",", ".")
      ).toFixed(2);

      const estoque = parseInt(record.ESTOQUE);

      const product = {
        codigo: record.ID_PRODUTO,
        name: record.PRODUTO,
        description: record.DESCRICAO_COMPLEMENTAR,
        attributes: [
          {
            pt: "Variação",
          },
        ],
        variants: [
          {
            price: valorVenda,
            stock: estoque,
          },
        ],
        price: valorVenda,
        stock: estoque,
        brand: record.MARCA,
        published: record.STATUS === "0" && estoque > 0 && valorVenda > 0,
      };

      try {
        const idCategory = await returnCategoryId(
          record.CATEGORIA,
          record.SUBCATEGORIA
        );
        product.categories = idCategory ? [idCategory] : [];

        await registerOrUpdateProduct(product);

        setTimeout(() => {
          readingAllRecordProducts(productsRecords, i).then(resolve);
        }, 1500);
      } catch (error) {
        console.log(error);
        // continuar a fila mesmo se erro em um produto
        setTimeout(() => {
          readingAllRecordProducts(productsRecords, i).then(resolve);
        }, 1500);
      }
    } catch (error) {
      console.log(error);
      resolve();
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
      // clone para evitar mutação acidental
      let productAndVariants = Object.assign({}, product);
      delete productAndVariants.variants;

      var productAlreadyRegister = productsDB[`${product.codigo}`]
        ? true
        : false;
      var productIsActiveOnSaurus = product.published;

      const functionReturnStatusOnNuvem = () => {
        if (productAlreadyRegister) {
          return productsDB[`${product.codigo}`].status;
        } else {
          return null;
        }
      };
      const functionReturnUniqueIdProductOnNuvem = () => {
        if (productAlreadyRegister) {
          return productsDB[`${product.codigo}`].UniqueId;
        } else {
          return null;
        }
      };
      const functionReturnIdProductAndVariantsOnNuvem = () => {
        if (productAlreadyRegister) {
          return productsDB[`${product.codigo}`].idNuvemShop;
        } else {
          return null;
        }
      };

      var statusProductOnNuvem = await functionReturnStatusOnNuvem();
      var productIsActiveOnNuvem =
        statusProductOnNuvem == "ATIVO" ? true : false;
      var UniqueIdProductOnNuvem = functionReturnUniqueIdProductOnNuvem();
      var IdProducAndVariants = functionReturnIdProductAndVariantsOnNuvem();

      // CASO: novo produto e ativo no Saurus -> cadastrar + variações
      if (!productAlreadyRegister && productIsActiveOnSaurus) {
        gravarLog(`Cadastrando produto novo: ${idProductSaurus}`);
        await preparingPostProduct(product)
          .then(async () => {
            // sincronizar variações (usa tabPreco)
            await requireAllVariationsOfAProduct(
              idProductSaurus,
              nameProduct,
              stockProduct,
              recordsInReqCadastros,
              tabPreco
            ).then(() => {
              resolve();
            });
          })
          .catch((err) => {
            console.log("Erro no preparingPostProduct:", err);
            resolve();
          });
      }
      // novo produto e INATIVO no Saurus -> ignorar
      else if (!productAlreadyRegister && !productIsActiveOnSaurus) {
        resolve();
      }
      // já existe no DB e ativo no Saurus
      else if (productAlreadyRegister && productIsActiveOnSaurus) {
        // se está ativo na Nuvem -> atualizar e sincronizar variações
        if (productIsActiveOnNuvem) {
          gravarLog(`Atualizando produto existente: ${idProductSaurus}`);
          await preparingUpdateProduct(IdProducAndVariants, productAndVariants)
            .then(async () => {
              // sincronizar variações (usa tabPreco)
              await requireAllVariationsOfAProduct(
                idProductSaurus,
                nameProduct,
                stockProduct,
                recordsInReqCadastros,
                tabPreco
              );
            })
            .then(() => {
              resolve();
            })
            .catch((err) => {
              console.log("Erro updating product + variations:", err);
              resolve();
            });
        } else {
          // produto ativo no Saurus mas inativo na Nuvem -> reativar
          gravarLog(`Reativando produto na nuvem: ${idProductSaurus}`);
          await preparingUndeleteProduct(
            product.codigo,
            IdProducAndVariants,
            productAndVariants
          ).then(async () => {
            await requireAllVariationsOfAProduct(
              idProductSaurus,
              nameProduct,
              stockProduct,
              recordsInReqCadastros,
              tabPreco
            ).then(() => {
              resolve();
            });
          }).catch((err) => {
            console.log("Erro undelete product:", err);
            resolve();
          });
        }
      }
      // já existe no DB e INATIVO no Saurus -> se está ativo na Nuvem, ocultar (delete)
      else if (productAlreadyRegister && !productIsActiveOnSaurus) {
        if (productIsActiveOnNuvem) {
          gravarLog(`Ocultando (deletando) produto: ${idProductSaurus}`);
          await preparingDeleteProduct(
            product.codigo,
            IdProducAndVariants,
            productAndVariants
          ).then(() => {
            resolve();
          }).catch((err) => {
            console.log("Erro preparingDeleteProduct:", err);
            resolve();
          });
        } else {
          resolve();
        }
      } else {
        resolve();
      }
    } catch (error) {
      console.log("Erro registerOrUpdateProduct:", error);
      resolve();
    }
  });
}

module.exports = {
  requireAllProducts,
  readingAllRecordProducts,
  readingAllXMLsProductsAndFormatInJson,
};
