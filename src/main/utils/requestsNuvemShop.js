const axios = require('axios');
const { successHandlingRequests, errorHandlingRequest, saveNewUniqueIdInProduct, gravarLog } = require('./auxFunctions');
const { parse } = require('dotenv');


async function getProductsAndVariants(store_id, header, page){
    return new Promise(async (resolve, reject) => {
        await axios.get(`https://api.nuvemshop.com.br/v1/${store_id}/products?page=${page}`, header)
        .then(async (answer) => {
            resolve(answer.data)
        })
        .catch(async (error) => {
            if(error.response.data.code==404){
                resolve(null)
            }else
            if(error.response.data.code==429){
                resolve(null)
            }else{
                console.log(error.response.data)
            }
        })
    })
}


async function registerProduct(store_id, header, body, idHost){
    return new Promise(async (resolve, reject) => {
        await axios.post(`https://api.nuvemshop.com.br/v1/${store_id}/products`, body, header)
        .then(async (answer) => {
            await successHandlingRequests('product', 'post', idHost, answer.data.id, answer.data.variants[0].id)
            .then(async () => {
                await updateVariation(store_id, header, {"price": body.price, "stock": body.stock}, answer.data.id, answer.data.variants[0].id, idHost)
            })
            .catch(async () => {
                resolve()
            })
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('product', 'POST', idHost, null, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await registerProduct(store_id, header, body, idHost)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Register Product Loading...')
                        await errorHandlingRequest('product', 'POST', idHost, null, 'CONNECTION ERROR', body)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
        })
        .finally(() => {
            resolve()
        })    
    })
}


async function putVariantsInProduct(store_id, header, body, idproduct, idProductHost){
    return new Promise(async (resolve, reject) => {
        await axios.put(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}/variants/`, body, header)
        .then(async(answer) => {
            resolve(answer.data[0].id)
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('product', 'PUT', idProductHost, idproduct, error.response.data, body)
                .then(() => {
                    reject()
                })
            }else{
                setTimeout(async() => {
                    await putVariantsInProduct(store_id, header, body, idproduct, idProductHost)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Put Variants in Product Loading...')
                        await errorHandlingRequest('product', 'PUT', idProductHost, idproduct, 'CONNECTION ERROR', body)
                        .then(async () => {
                            resolve()
                        })
                    }) 
                }, 1500);
            }
            
        })
        .finally(() => {
            resolve()
        })    
    })
}


async function updateProduct(store_id, header, body, idproduct, idHost){
    return new Promise(async (resolve, reject) => {
        await axios.put(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}`, body, header)
        .then(async (response) => {
            await successHandlingRequests('product', 'update', idHost, idproduct, null)
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('product', 'PUT', idHost, idproduct, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await updateProduct(store_id, header, body, idproduct, idHost)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Update Product Loading...')
                        await errorHandlingRequest('product', 'PUT', idHost, idproduct, 'CONNECTION ERROR', body)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
        })
        .finally(() => {
            resolve()
        })    
    })
}


async function deleteProduct(store_id, header, body, idproduct, idHost){
    return new Promise(async (resolve, reject) => {
        await axios.put(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}`, body, header)
        .then(async () => {
            await successHandlingRequests('product', 'delete', idHost, idproduct, null)
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('product', 'DELETE', idHost, idproduct, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await deleteProduct(store_id, header, body, idproduct, idHost)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Delete Product Loading...')

                        await errorHandlingRequest('product', 'DELETE', idHost, idproduct, 'CONNECTION ERROR', body)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
        })
        .finally(() => {
            resolve()
        })    
    })
}


async function deleteProductPermanent(store_id, header, idproduct){
    return new Promise(async (resolve, reject) => {
        await axios.delete(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}`, header)
        .then(async () => {
            gravarLog('DELETADO PRODUTO QUE NÃO EXISTE NA BASE DO INTEGRADOR')
        })
        .catch(async (error) => {
            console.log(error.response.data)
            if(error.response){
                gravarLog('ERRO AO DELETAR PRODUTO QUE NÃO EXISTE NA BASE DO INTEGRADOR')
            }else{
                setTimeout(async () => {
                    await deleteProductPermanent(store_id, header, idproduct)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Delete Product Permanent Loading...')

                        await errorHandlingRequest('product', 'DELETEPERMANENT', null, idproduct, 'CONNECTION ERROR', body)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
        })
        .finally(() => {
            resolve()
        })    
    })
}


async function undeleteProduct(store_id, header, body, idproduct, idHost){
    return new Promise(async (resolve, reject) => {
        await axios.put(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}`, body, header)
        .then(async (response) => {
            await successHandlingRequests('product', 'undelete', idHost, idproduct, null)
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('product', 'UNDELETE', idHost, idproduct, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await undeleteProduct(store_id, header, body, idproduct, idHost)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Undelete Product Loading...')

                        await errorHandlingRequest('product', 'UNDELETE', idHost,  'CONNECTION ERROR', body)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
        })
        .finally(() => {
            resolve()
        })    
    })
}


// ---------------------------------------------------------------------


async function registerCategory(store_id, header, body, type, category){
    return new Promise(async (resolve, reject) => {
        await axios.post(`https://api.nuvemshop.com.br/v1/${store_id}/categories`, body, header)
        .then(async (answer) => {
            if(answer.data){
                await successHandlingRequests(type, 'post', body.name, answer.data.id, [body.name, category])
                .then(async () => {
                    resolve(answer.data.id)
                })
            }else{
                await errorHandlingRequest(type, 'POST', body.name, null, error.response.data, body)
                .then(() => {
                    resolve()
                })
            }
            
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest(type, 'POST', body.name, null, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await registerCategory(store_id, header, body, type, category)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Register Category Loading...')

                        await errorHandlingRequest(type, 'POST', body.name, null, 'CONNECTION ERROR', body)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
        })
        .finally(() => {
            resolve()
        })  
    })
}

/* VER DEPOIS
function deleteCategory(header, idcustomer, idHost){
    return new Promise(async (resolve, reject) => {
        await axios.delete(`${url}/categories/:id`, header)
        .then(async () => {
            await successHandlingRequests('category', 'delete', idHost, idcustomer)
        })
        .catch(async (error) => {
            await errorHandlingRequest('category', 'DELETE', idHost, idcustomer, error.response.data, null)
        })
        .finally(() => {
            resolve()
        })    
    })
}*/


// ---------------------------------------------------------------------


async function getVariants(store_id, header, idproduct, idProductHost){
    return new Promise(async (resolve, reject) => {
        await axios.get(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}/variants`, header)
        .then(async (answer) => {
                resolve(answer.data)
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('variation', 'GET', idProductHost, null, error.response.data, null)
                .then(() => {
                    reject()
                })
            }else{
                setTimeout(async () => {
                    await getVariants(store_id, header, idproduct, idProductHost)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        await errorHandlingRequest('variation', 'GET', idProductHost, null, 'CONNECTION ERROR', null)
                        .then(() => {
                            reject()
                        })
                    })
                }, 1500); 
            }
            
        })
        .finally(() => {
            resolve()
        })    
    })
}


async function registerVariation(store_id, header, body, idproduct, idProductHost){
    return new Promise(async (resolve, reject) => {
        await axios.post(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}/variants`, body, header)
        .then(async (answer) => {
            await successHandlingRequests('variation', 'post', idProductHost, answer.data.id, [body.values[0].pt])
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('variation', 'POST', idProductHost, null, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await registerVariation(store_id, header, body, idproduct, idProductHost)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Register Variation Loading...')

                        await errorHandlingRequest('variation', 'POST', idProductHost, null, 'CONNECTION ERROR', body)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
        })
        .finally(() => {
            resolve()
        })    
    })
}


async function updateVariation(store_id, header, body, idproduct, idVariant, idProductHost){
    return new Promise(async (resolve, reject) => {
        await axios.put(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}/variants/${idVariant}`, body, header)
        .then(async() => {
            if(body.values){
                await successHandlingRequests('variation', 'update', idProductHost, idVariant, [body.values[0].pt])
            }else{
                await successHandlingRequests('product', 'update', idProductHost, idproduct, null)
            }
            
        })
        .catch(async (error) => {
            if(error.response){
                if(error.response.data.description=='Product_Variant with such id does not exist'){
                    await deleteVariation(store_id, header, idproduct, idVariant, idProductHost, 'PRODUTO DESCONHECIDO', 0) 
                }else{
                    await errorHandlingRequest('variation', 'PUT', idProductHost, idVariant, error.response.data, body)
                }
               
            }else{
                setTimeout(async () => {
                    await updateVariation(store_id, header, body, idproduct, idVariant, idProductHost)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Update Variation Loading...')

                        await errorHandlingRequest('variation', 'PUT', idProductHost, idVariant, 'CONNECTION ERROR', body)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
        })
        .finally(() => {
            resolve()
        })    
    })
}



async function deleteVariation(store_id, header, idproduct, idVariant, idProductHost, nameVariant, stockProduct){
    return new Promise(async (resolve, reject) => {
        await axios.delete(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}/variants/${idVariant}`, header)
        .then(async () => {
            await successHandlingRequests('variation', 'delete', idProductHost, idVariant, [nameVariant])
        })
        .catch(async (error) => {
            if(error.response){

                if(error.response.data.description=='Product_Variant with such id does not exist'){
                    await successHandlingRequests('variation', 'delete', idProductHost, idVariant, [nameVariant])
                }else
                if(error.response.data.description=="The last variant of a product cannot be deleted."){
                    let newUniqueId;

                    await updateProduct(store_id, header, {"attributes": [""]}, idproduct, idProductHost)
                    .then(async () => {
                        await getVariants(store_id, header, idproduct, idProductHost)
                        .then(async (response) => {
                            response[0].values = []
                            let bodyPutVariants = response
                            await putVariantsInProduct(store_id, header, bodyPutVariants, idproduct, idProductHost)
                            .then(async (response) => {
                                await saveNewUniqueIdInProduct(idProductHost, response)
                                newUniqueId = response;
                            })
                        })
                        .then(async () => {
                            await updateProduct(store_id, header, {"attributes":[{"pt": 'Variação'}]}, idproduct, idProductHost)
                        })
                        .then(async () => {
                            await updateVariation(store_id, header, {"stock": stockProduct}, idproduct, newUniqueId, idProductHost)
                        })
                    })
                    .then(async () => {
                        await successHandlingRequests('variation', 'delete', idProductHost, idVariant, [nameVariant])
                    })
                    .catch(async () => {
                        await errorHandlingRequest('variation', 'DELETE', idProductHost, idVariant, error.response.data, null)
                        resolve()
                    })
                }else{
                    await errorHandlingRequest('variation', 'DELETE', idProductHost, idVariant, error.response.data, null)
                }
            }else{
                setTimeout(async () => {
                    await deleteVariation(store_id, header, idproduct, idVariant, idProductHost, nameVariant, stockProduct)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Delete Variation Loading...')


                        await errorHandlingRequest('variation', 'DELETE', idProductHost, idVariant, 'CONNECTION ERROR', null)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
            
        })
        .finally(() => {
            resolve()
        })    
    })
}

async function uploadImage(store_id, header, body, idProductNuvem, idProductHost, hash){
    return new Promise(async (resolve, reject) => {
        await axios.post(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idProductNuvem}/images`, body, header)
        .then(async (answer) => {
            await successHandlingRequests('image', 'post', idProductHost, answer.data.id, [hash])
        })
        .catch(async (error) => {

            if(error.response){
                await errorHandlingRequest('image', 'POST', idProductHost, null, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await uploadImage(store_id, body, idProductNuvem, idProductHost)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Upload Image Loading...')

                        await errorHandlingRequest('image', 'POST', idProductHost, null, 'CONNECTION ERROR', body)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
        })
        .finally(() => {
            resolve()
        })    
    })
}


async function deleteImage(store_id, header, idProductNuvem, idImage, idProductHost){
    return new Promise(async (resolve, reject) => {
        await axios.delete(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idProductNuvem}/images/${idImage}`, header)
        .then(async (answer) => {
            await successHandlingRequests('image', 'delete', idProductHost, null, null)
        })
        .catch(async (error) => {
            if(error.response){
                if(error.response.data.description=='Product_Image with such id does not exist'){
                    await successHandlingRequests('image', 'delete', idProductHost, null, null)
                }else{
                    await errorHandlingRequest('image', 'DELETE', idProductHost, null, error.response.data, null)
                }
            }else{
                setTimeout(async () => {
                    await deleteImage(store_id, header, idProductNuvem, idImage, idProductHost)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Delete Image Loading...')

                        await errorHandlingRequest('image', 'DELETE', idProductHost, null, 'CONNECTION ERROR', null)
                        .then(async () => {
                            resolve()
                        })
                    })
                }, 1500); 
            }
        })
        .finally(() => {
            resolve()
        })    
    })
}


// ---------------------------------------------------------------------


async function generateToken(body){
    return new Promise(async (resolve, reject) => {
        let success;

        await axios.post('https://www.nuvemshop.com.br/apps/authorize/token', body, {
            'User-Agent': `HostSync (${body.client_id})`, 
            'Content-Type': 'application/json'
          })
        .then(async (answer) => {
           if(answer.data.access_token){
            success = true
            await successHandlingRequests('token', 'post', null, null, [
                answer.data.access_token,
                answer.data.user_id,
                body.code
            ])
           }
           else{
            success = false
            await errorHandlingRequest('token', 'POST', 1, 1, answer.data.error_description, body.code)
           }
           
        })
        .catch(async () => {
            resolve(false)
        })
        .finally(() => {
            resolve(success)
        })    
    })
}



module.exports = { 
    getProductsAndVariants,
    registerProduct,
    updateProduct,
    deleteProduct,
    deleteProductPermanent,
    undeleteProduct,
    registerCategory,
    //deleteCategory,
    registerVariation,
    updateVariation,
    deleteVariation,
    uploadImage,
    deleteImage,
    generateToken
}