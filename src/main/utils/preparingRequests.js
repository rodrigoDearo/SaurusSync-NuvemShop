const { getProductsAndVariants, registerProduct, updateProduct, deleteProduct, deleteProductPermanent, undeleteProduct, registerCategory, deleteCategory, getVariants, registerVariation, updateVariation, deleteVariation, uploadImage, deleteImage, generateToken } = require('./requestsNuvemShop');
const { getProducts } = require('./requestsSaurus.js');
const { returnValueFromJson } = require('./manageInfoUser');
const { returnInfo } = require('../envManager');
  
async function preparingGetProductsOnSaurus(parameters, password) {
    const headers = {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://saurus.net.br/retCadastros'
        }

    const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <retCadastros xmlns="http://saurus.net.br/">
              <xBytesParametros>${parameters}</xBytesParametros>
              <xSenha>${password}</xSenha>
            </retCadastros>
          </soap:Body>
        </soap:Envelope>`

    await getProducts(body, 
      headers);
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
    const infosNuvem = await getHeaderAndStore();
    let result = await getProductsAndVariants(infosNuvem[0], infosNuvem[1], page)
    return result
  }
  
  async function preparingPostProduct(product) {
    const infosNuvem = await getHeaderAndStore();
    const idSaurus = product.codigo;
    delete product.codigo;
    await registerProduct(infosNuvem[0], infosNuvem[1], product, idSaurus);
  }
  
  async function preparingUpdateProduct(idproduct, product) {
    const infosNuvem = await getHeaderAndStore();
    const idSaurus = product.codigo;
    delete product.codigo;
    delete product.attributes;
    await updateProduct(infosNuvem[0], infosNuvem[1], product, idproduct, idSaurus);
  }
  
  async function preparingDeleteProduct(idSaurus, idproduct, product) {
    const infosNuvem = await getHeaderAndStore();
    delete product.codigo;
    delete product.attributes;
    product.published = false;
    await deleteProduct(infosNuvem[0], infosNuvem[1], product, idproduct, idSaurus);
  }

  async function preparingDeletePermanentProduct(idproduct) {
    const infosNuvem = await getHeaderAndStore();
    await deleteProductPermanent(infosNuvem[0], infosNuvem[1], idproduct);
  }
  
  async function preparingUndeleteProduct(idSaurus, idproduct, product) {
    const infosNuvem = await getHeaderAndStore();
    delete product.codigo;
    delete product.attributes;
    product.published = true;
    await undeleteProduct(infosNuvem[0], infosNuvem[1], product, idproduct, idSaurus);
  }
  
  async function preparingPostCategory(category) {
    const infosNuvem = await getHeaderAndStore();
    const body = { name: category };
    const id = await registerCategory(infosNuvem[0], infosNuvem[1], body, 'category', category);
    return id ?? null;
  }
  
  async function preparingPostSubCategory(category, subcategory, category_id) {
    const infosNuvem = await getHeaderAndStore();
    const body = {
      name: subcategory,
      parent: category_id,
    };
    const id = await registerCategory(infosNuvem[0], infosNuvem[1], body, 'subcategory', category);
    return id ?? null;
  }
  
  async function preparingPostVariation(variant, idProduct, idProductSaurus) {
    const infosNuvem = await getHeaderAndStore();
    delete variant.codigo;
    await registerVariation(infosNuvem[0], infosNuvem[1], variant, idProduct, idProductSaurus);
  }
  
  async function preparingUpdateVariation(variant, idVariant, idProduct, idProductSaurus) {
    const infosNuvem = await getHeaderAndStore();
    delete variant.codigo;
    await updateVariation(infosNuvem[0], infosNuvem[1], variant, idProduct, idVariant, idProductSaurus);
  }
  
  async function preparingDeleteVariation(idVariant, idProduct, idProductSaurus, grade, stockProduct) {
    const infosNuvem = await getHeaderAndStore();
    await deleteVariation(infosNuvem[0], infosNuvem[1], idProduct, idVariant, idProductSaurus, grade, stockProduct);
  }

  /*
  async function preparingDeletePermanentVariant(idproduct, idvariant) {
    const infosNuvem = await getHeaderAndStore();
    await deleteVariation(infosNuvem[0], infosNuvem[1], idproduct, idvariant);
  }
  */

  async function preparingUploadImage(image, idProductNuvem, idProductSaurus, hash) {
    const infosNuvem = await getHeaderAndStore();
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
    const infosNuvem = await getHeaderAndStore();
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
  