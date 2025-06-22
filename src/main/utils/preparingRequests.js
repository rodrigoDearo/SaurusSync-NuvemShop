const { getProductsAndVariants, registerProduct, updateProduct, deleteProduct, deleteProductPermanent, undeleteProduct, registerCategory, deleteCategory, getVariants, registerVariation, updateVariation, deleteVariation, uploadImage, deleteImage, generateToken } = require('./requestsNuvemShop');
const { getProducts, getStockProduct } = require('./requestsSaurus.js');
const { returnValueFromJson } = require('./manageInfoUser');
const { returnInfo } = require('../envManager');
const { returnNumberCodeOfPasswordSaurus, encodedStringInBase64, decodeBase64inFileAndUnizp, stringToXmlObject } = require('./auxFunctions.js');
  
const infosNuvem = getHeaderAndStore();


async function returnPasswordWSSaurus() {
  try {
    const numberCode = await returnNumberCodeOfPasswordSaurus();
    const dominio = await returnValueFromJson('dominiosaurus');
    
    const response = await returnInfo('check_saurus');
    const password = `${response}${numberCode}|${dominio}|1`;

    const encoded = await encodedStringInBase64(password);

    return encoded;
  } catch (err) {
    console.error(err);
    return null
  }
}


async function returnParametersReqCadastros(data, tpSync){
  try {
    
    const dominio = await returnValueFromJson('dominiosaurus');
    const chavecaixa = await returnValueFromJson('chavecaixasaurus');

    const parameters = `<xmlIntegracao>
        <Dominio>${dominio}</Dominio>
        <TpArquivo>50</TpArquivo>
        <ChaveCaixa>${chavecaixa}</ChaveCaixa>
        <TpSync>${tpSync}</TpSync>
        <DhReferencia>${data}</DhReferencia>
      </xmlIntegracao>`

    const encoded = await encodedStringInBase64(parameters);

    return encoded
  } catch (error) {
    console.error(error)
    return null
  }
}


async function returnParametersRetProdutoEstoque(idProduct){
  try {
    const dominio = await returnValueFromJson('dominiosaurus');

    const parameters = `<xmlIntegracao>
        <Dominio>${dominio}</Dominio>
        <IdProduto>${idProduct}</IdProduto>
    </xmlIntegracao>`

    const encoded = await encodedStringInBase64(parameters);

    return encoded
  } catch (error) {
    console.error(error)
    return null
  }
}


function preparingGetProductsOnSaurus(data, tpSync) {
  return new Promise(async (resolve, reject) => {
    try {
      const headers = {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://saurus.net.br/retCadastros'
      };

      const password = await returnPasswordWSSaurus();
      const parameters = await returnParametersReqCadastros(data, tpSync);

      if (!password || !parameters) {
        return resolve(null);
      }

      const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <retCadastros xmlns="http://saurus.net.br/">
              <xBytesParametros>${parameters}</xBytesParametros>
              <xSenha>${password}</xSenha>
            </retCadastros>
          </soap:Body>
        </soap:Envelope>`;

      getProducts(body, headers)
        .then((xmlPath) => {
          console.log('Produtos consultados com sucesso no WebService da Saurus');
          resolve(xmlPath);
        })
        .catch(() => {
          console.log('Erro ao consultar produtos no WebService da Saurus');
          resolve(null);
        });
    } catch (error) {
      console.error(error);
      resolve(null);
    }
  });
}


async function preparingGetStockProductsOnSaurus(idproduct, idProdctFather) {
    const headers = {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://saurus.net.br/retProdutoEstoque',
          'Host': 'wsretaguarda.saurus.net.br'
        }


    const password = await returnPasswordWSSaurus()
    const parameters = await returnParametersRetProdutoEstoque(idproduct)
    
    if(!password || !parameters){
      return null
    }

    const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <retProdutoEstoque xmlns="http://saurus.net.br/">
              <xBytesParametros>${parameters}</xBytesParametros>
              <xSenha>${password}</xSenha>
            </retProdutoEstoque>
          </soap:Body>
        </soap:Envelope>`

    await getStockProduct(body, headers, idproduct, idProdctFather)
    .then(async (xmlPath) => {
      console.log('Estoque de produto consultado com sucesso no WebService da Saurus');
      return xmlPath
    })
    .catch(async () => {
      console.log('Erro ao consultar estoque de produto no WebService da Saurus');
    })
  }


// -----------------------------------------------------------------------

  async function getHeaderAndStore() {
    const cli_id = await returnInfo('client_id');
    const access_token = await returnValueFromJson('tokennuvemshop');
    const storeid = await returnValueFromJson('storeidnuvemshop');
  
    const config = {
      headers: {
        'Authentication': `bearer ${access_token}`,
        'User-Agent': `SaurusSync (${cli_id})`,
        'Content-Type': 'application/json',
      },
    };
  
    return [storeid, config];
  }
  
  async function preparingGetProductsAndVariants(page) {
    let result = await getProductsAndVariants(infosNuvem[0], infosNuvem[1], page)
    return result
  }
  
  async function preparingPostProduct(product) {
    const idSaurus = product.codigo;
    delete product.codigo;
    await registerProduct(infosNuvem[0], infosNuvem[1], product, idSaurus);
  }
  
  async function preparingUpdateProduct(idproduct, product) {
    const idSaurus = product.codigo;
    delete product.codigo;
    delete product.attributes;
    await updateProduct(infosNuvem[0], infosNuvem[1], product, idproduct, idSaurus);
  }
  
  async function preparingDeleteProduct(idSaurus, idproduct, product) {
    delete product.codigo;
    delete product.attributes;
    product.published = false;
    await deleteProduct(infosNuvem[0], infosNuvem[1], product, idproduct, idSaurus);
  }

  async function preparingDeletePermanentProduct(idproduct) {
    await deleteProductPermanent(infosNuvem[0], infosNuvem[1], idproduct);
  }
  
  async function preparingUndeleteProduct(idSaurus, idproduct, product) {
    delete product.codigo;
    delete product.attributes;
    product.published = true;
    await undeleteProduct(infosNuvem[0], infosNuvem[1], product, idproduct, idSaurus);
  }
  
  async function preparingPostCategory(category) {
    const body = { name: category };
    const id = await registerCategory(infosNuvem[0], infosNuvem[1], body, 'category', category);
    return id ?? null;
  }
  
  async function preparingPostSubCategory(category, subcategory, category_id) {
    const body = {
      name: subcategory,
      parent: category_id,
    };
    const id = await registerCategory(infosNuvem[0], infosNuvem[1], body, 'subcategory', category);
    return id ?? null;
  }
  
  async function preparingPostVariation(variant, idProduct, idProductSaurus) {
    delete variant.codigo;
    await registerVariation(infosNuvem[0], infosNuvem[1], variant, idProduct, idProductSaurus);
  }
  
  async function preparingUpdateVariation(variant, idVariant, idProduct, idProductSaurus) {
    delete variant.codigo;
    await updateVariation(infosNuvem[0], infosNuvem[1], variant, idProduct, idVariant, idProductSaurus);
  }
  
  async function preparingDeleteVariation(idVariant, idProduct, idProductSaurus, grade, stockProduct) {
    await deleteVariation(infosNuvem[0], infosNuvem[1], idProduct, idVariant, idProductSaurus, grade, stockProduct);
  }

  /*
  async function preparingDeletePermanentVariant(idproduct, idvariant) {
    
    await deleteVariation(infosNuvem[0], infosNuvem[1], idproduct, idvariant);
  }
  */

  async function preparingUploadImage(image, idProductNuvem, idProductSaurus, hash) {
    const body = {
      "filename": "image",
      "position": 1,
      "attachment": image
    };
    if(image){
      await uploadImage(infosNuvem[0], infosNuvem[1], body, idProductNuvem, idProductSaurus, hash);
    }
  }

  async function preparingDeleteImage(idProductNuvem, idImageNuvem, idProductSaurus) {
    await deleteImage(infosNuvem[0], infosNuvem[1], idProductNuvem, idImageNuvem, idProductSaurus);
  }

  async function preparingGenerateToken(code) {
    const client_secret = await returnInfo('client_secret');
    const client_id = await returnInfo('client_id');
    const body = {
      client_id,
      client_secret,
      grant_type: 'authorization_code',
      code,
    };
    return await generateToken(body);
  }
  
  module.exports = {
    preparingGetProductsOnSaurus,
    preparingGetStockProductsOnSaurus,
    preparingPostProduct,
    preparingUpdateProduct,
    preparingDeleteProduct,
    preparingDeletePermanentProduct,
    preparingUndeleteProduct,
    preparingPostCategory,
    preparingPostSubCategory,
    preparingPostVariation,
    preparingUpdateVariation,
    preparingDeleteVariation,
    preparingUploadImage,
    preparingDeleteImage,
    preparingGenerateToken,
  };
  