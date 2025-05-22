const { getProductsAndVariants, registerProduct, updateProduct, deleteProduct, deleteProductPermanent, undeleteProduct, registerCategory, deleteCategory, getVariants, registerVariation, updateVariation, deleteVariation, uploadImage, deleteImage, generateToken } = require('./requestsNuvemShop');
const { returnValueFromJson } = require('./manageInfoUser');
const { returnInfo } = require('../envManager');
  
  async function getHeaderAndStore() {
    const cli_id = await returnInfo('client_id');
    const access_token = await returnValueFromJson('tokennuvemshop');
    const storeid = await returnValueFromJson('storeidnuvemshop');
  
    const config = {
      headers: {
        'Authentication': `bearer ${access_token}`,
        'User-Agent': `HostSync (${cli_id})`,
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
    const idHost = product.codigo;
    delete product.codigo;
    await registerProduct(infosNuvem[0], infosNuvem[1], product, idHost);
  }
  
  async function preparingUpdateProduct(idproduct, product) {
    const infosNuvem = await getHeaderAndStore();
    const idHost = product.codigo;
    delete product.codigo;
    delete product.attributes;
    await updateProduct(infosNuvem[0], infosNuvem[1], product, idproduct, idHost);
  }
  
  async function preparingDeleteProduct(idHost, idproduct, product) {
    const infosNuvem = await getHeaderAndStore();
    delete product.codigo;
    delete product.attributes;
    product.published = false;
    await deleteProduct(infosNuvem[0], infosNuvem[1], product, idproduct, idHost);
  }

  async function preparingDeletePermanentProduct(idproduct) {
    const infosNuvem = await getHeaderAndStore();
    await deleteProductPermanent(infosNuvem[0], infosNuvem[1], idproduct);
  }
  
  async function preparingUndeleteProduct(idHost, idproduct, product) {
    const infosNuvem = await getHeaderAndStore();
    delete product.codigo;
    delete product.attributes;
    product.published = true;
    await undeleteProduct(infosNuvem[0], infosNuvem[1], product, idproduct, idHost);
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
  
  async function preparingPostVariation(variant, idProduct, idProductHost) {
    const infosNuvem = await getHeaderAndStore();
    delete variant.codigo;
    await registerVariation(infosNuvem[0], infosNuvem[1], variant, idProduct, idProductHost);
  }
  
  async function preparingUpdateVariation(variant, idVariant, idProduct, idProductHost) {
    const infosNuvem = await getHeaderAndStore();
    delete variant.codigo;
    await updateVariation(infosNuvem[0], infosNuvem[1], variant, idProduct, idVariant, idProductHost);
  }
  
  async function preparingDeleteVariation(idVariant, idProduct, idProductHost, grade, stockProduct) {
    const infosNuvem = await getHeaderAndStore();
    await deleteVariation(infosNuvem[0], infosNuvem[1], idProduct, idVariant, idProductHost, grade, stockProduct);
  }

  /*
  async function preparingDeletePermanentVariant(idproduct, idvariant) {
    const infosNuvem = await getHeaderAndStore();
    await deleteVariation(infosNuvem[0], infosNuvem[1], idproduct, idvariant);
  }
  */

  async function preparingUploadImage(image, idProductNuvem, idProductHost, hash) {
    const infosNuvem = await getHeaderAndStore();
    const body = {
      "filename": "image",
      "position": 1,
      "attachment": image
    };
    if(image){
      await uploadImage(infosNuvem[0], infosNuvem[1], body, idProductNuvem, idProductHost, hash);
    }
  }

  async function preparingDeleteImage(idProductNuvem, idImageNuvem, idProductHost) {
    const infosNuvem = await getHeaderAndStore();
    await deleteImage(infosNuvem[0], infosNuvem[1], idProductNuvem, idImageNuvem, idProductHost);
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
    preparingGetProductsAndVariants,
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
  