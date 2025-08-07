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

//const userDataPath = "src/build";
const userDataPath = path.join(app.getPath('userData'), 'ConfigFiles');
const pathProducts = path.join(userDataPath, "products.json");

var recordsInReqCadastros, tabPreco, idProdutos;

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

                    const produtosASeremBaixados = [];
                    const variacoesBaixadas = [];

                    // 1ª Passada: verificar quais produtos baixar
                    for (const produto of products) {
                        const info = produto["$"];
                        const idProduto = info.pro_idProduto;
                        const idProdutoPai = info.pro_idProdutoPai;

                        if (!idProdutoPai) {
                        let precoValido = false;

                        const precosDoProduto = precos.filter((p) => p["$"].pro_idProduto === idProduto);
                        for (const p of precosDoProduto) {
                            const preco = p["$"];
                            if (preco.pro_idTabPreco == tabPreco && parseFloat(preco.pro_vPreco) > 0) {
                            precoValido = true;
                            break;
                            }
                        }

                        const estaNoDB = produtosDB.hasOwnProperty(idProduto);
                        const statusDB = estaNoDB ? produtosDB[idProduto].status : null;

                        if (precoValido || statusDB === "ATIVO") {
                            produtosASeremBaixados.push(idProduto);
                            await preparingGetStockProductsOnSaurus(idProduto, null);
                            await new Promise((res) => setTimeout(res, 1000));
                        }
                        }
                    }

                    // 2ª Passada: baixar variações
                    for (const produto of products) {
                        const info = produto["$"];
                        const idProduto = info.pro_idProduto;
                        const idProdutoPai = info.pro_idProdutoPai;

                        if (idProdutoPai && produtosASeremBaixados.includes(idProdutoPai)) {
                        variacoesBaixadas.push(idProduto);
                        await preparingGetStockProductsOnSaurus(idProduto, idProdutoPai);
                        await new Promise((res) => setTimeout(res, 1000));
                        }
                    }

                    idProdutos = produtosASeremBaixados;

                    gravarLog("Produtos principais baixados:", produtosASeremBaixados.length);
                    gravarLog("Variacoes baixadas:", variacoesBaixadas.length);
                    gravarLog("IDs dos produtos:", produtosASeremBaixados);
                    gravarLog("IDs das variações:", variacoesBaixadas);
                }


                await processProductsOptimized(products);

                resolve();
              }
            );
          });
        })
        .then(async () => {
          readingAllXMLsProductsAndFormatInJson(recordsInReqCadastros, idProdutos)
            .then(async (response) => {
              await readingAllRecordProducts(response, 0);
            })
            .then(() => {
              resolve();
            });
        })
        .catch((error) => {
          console.log(error);
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

        // Ignora variações
        if (produto.pro_idProdutoPai) {
          continue;
        }

        // Obtém o preço do produto na tabela válida
        const precoObj = precos.find(
          (p) => p["$"].pro_idProduto === idProduto && p["$"].pro_idTabPreco == tabPreco
        );

        const preco = precoObj ? parseFloat(precoObj["$"].pro_vPreco) : 0;

        // Pega o estoque do XML baixado (que existe garantido pela lista)
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
            const estoqueRow = result.retProdutoEstoque?.EstoqueLoja?.[0]?.["$"];
            if (estoqueRow) {
              estoque = parseInt(parseFloat(estoqueRow.qSaldo));
            }
          } catch {
            estoque = 0;
          }
        }

        const categoria = produto.pro_descCategoria == "Sem Categoria" ? "" : produto.pro_descCategoria;
        const subcategoria = produto.pro_descSubCategoria == "Sem Subcategoria" ? "" : produto.pro_descSubCategoria;
        const marca = produto.pro_descMarca == "Sem Marca" ? "" : produto.pro_descMarca;

        // Se quiser, pode incluir published aqui, usando as regras que você definiu:
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
      const record = productsRecords[index];
      const i = index + 1;

      if (i > productsRecords.length) {
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
        resolve(); // evita travar a cadeia
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
      let productAndVariants = product;
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

      if (!productAlreadyRegister && productIsActiveOnSaurus) {
        await preparingPostProduct(product).then(async () => {
          await requireAllVariationsOfAProduct(
            idProductSaurus,
            nameProduct,
            stockProduct,
            recordsInReqCadastros
          ).then(() => {
            resolve();
          });
        });
      } else if (!productAlreadyRegister && !productIsActiveOnSaurus) {
        resolve();
      } else if (productAlreadyRegister && productIsActiveOnSaurus) {
        if (productIsActiveOnNuvem) {
          await preparingUpdateProduct(IdProducAndVariants, productAndVariants)
            .then(async () => {
              await requireAllVariationsOfAProduct(
                idProductSaurus,
                nameProduct,
                stockProduct,
                recordsInReqCadastros
              );
            })
            .then(async () => {
              let productsDBAtualizado = JSON.parse(
                fs.readFileSync(pathProducts)
              );

              if (
                Object.keys(
                  productsDBAtualizado[`${idProductSaurus}`].variations
                ).length === 0
              ) {
                await preparingUpdateVariation(
                  justProduct,
                  UniqueIdProductOnNuvem,
                  IdProducAndVariants,
                  idProductSaurus
                ).then(() => {
                  resolve();
                });
              } else {
                resolve();
              }
            });
        } else {
          await preparingUndeleteProduct(
            product.codigo,
            IdProducAndVariants,
            productAndVariants
          ).then(async () => {
            await requireAllVariationsOfAProduct(
              idProductSaurus,
              nameProduct,
              stockProduct,
              recordsInReqCadastros
            ).then(() => {
              resolve();
            });
          });
        }
      } else if (productAlreadyRegister && !productIsActiveOnSaurus) {
        if (productIsActiveOnNuvem) {
          await preparingDeleteProduct(
            product.codigo,
            IdProducAndVariants,
            productAndVariants
          ).then(() => {
            resolve();
          });
        } else {
          resolve();
        }
      }
    } catch (error) {
      console.log(error);
    }
  });
}

module.exports = {
  requireAllProducts,
  readingAllRecordProducts,
  readingAllXMLsProductsAndFormatInJson,
};
