const axios = require('axios');

const { successHandlingRequests, errorHandlingRequest, saveNewUniqueIdInProduct, gravarLog, findIdVariantFromNameVariant } = require('./auxFunctions');

async function registerProduct(store_id, header, body, idSaurus){
    return new Promise(async (resolve, reject) => {
        await axios.post(`https://api.nuvemshop.com.br/v1/${store_id}/products`, body, header)
        .then(async (answer) => {
            await successHandlingRequests('product', 'post', idSaurus, answer.data.id, answer.data.variants[0].id)
            .then(async () => {
                await updateVariation(store_id, header, {"price": body.price, "stock": body.stock}, answer.data.id, answer.data.variants[0].id, idSaurus)
            })
            .catch(async () => {
                resolve()
            })
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('product', 'POST', idSaurus, null, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await registerProduct(store_id, header, body, idSaurus)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Register Product Loading...')
                        await errorHandlingRequest('product', 'POST', idSaurus, null, 'CONNECTION ERROR', body)
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


async function putVariantsInProduct(store_id, header, body, idproduct, idProductSaurus){
    return new Promise(async (resolve, reject) => {
        await axios.put(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}/variants/`, body, header)
        .then(async(answer) => {
            resolve(answer.data[0].id)
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('product', 'PUT', idProductSaurus, idproduct, error.response.data, body)
                .then(() => {
                    reject()
                })
            }else{
                setTimeout(async() => {
                    await putVariantsInProduct(store_id, header, body, idproduct, idProductSaurus)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Put Variants in Product Loading...')
                        await errorHandlingRequest('product', 'PUT', idProductSaurus, idproduct, 'CONNECTION ERROR', body)
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


async function updateProduct(store_id, header, body, idproduct, idSaurus){
    return new Promise(async (resolve, reject) => {
        await axios.put(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}`, body, header)
        .then(async (response) => {
            await successHandlingRequests('product', 'update', idSaurus, idproduct, null)
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('product', 'PUT', idSaurus, idproduct, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await updateProduct(store_id, header, body, idproduct, idSaurus)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Update Product Loading...')
                        await errorHandlingRequest('product', 'PUT', idSaurus, idproduct, 'CONNECTION ERROR', body)
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


async function deleteProduct(store_id, header, body, idproduct, idSaurus){
    return new Promise(async (resolve, reject) => {
        await axios.put(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}`, body, header)
        .then(async () => {
            await successHandlingRequests('product', 'delete', idSaurus, idproduct, null)
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('product', 'DELETE', idSaurus, idproduct, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await deleteProduct(store_id, header, body, idproduct, idSaurus)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Delete Product Loading...')

                        await errorHandlingRequest('product', 'DELETE', idSaurus, idproduct, 'CONNECTION ERROR', body)
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


async function undeleteProduct(store_id, header, body, idproduct, idSaurus){
    return new Promise(async (resolve, reject) => {
        await axios.put(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}`, body, header)
        .then(async (response) => {
            await successHandlingRequests('product', 'undelete', idSaurus, idproduct, null)
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('product', 'UNDELETE', idSaurus, idproduct, error.response.data, body)
            }else{
                setTimeout(async () => {
                    await undeleteProduct(store_id, header, body, idproduct, idSaurus)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Undelete Product Loading...')

                        await errorHandlingRequest('product', 'UNDELETE', idSaurus,  'CONNECTION ERROR', body)
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
function deleteCategory(header, idcustomer, idSaurus){
    return new Promise(async (resolve, reject) => {
        await axios.delete(`${url}/categories/:id`, header)
        .then(async () => {
            await successHandlingRequests('category', 'delete', idSaurus, idcustomer)
        })
        .catch(async (error) => {
            await errorHandlingRequest('category', 'DELETE', idSaurus, idcustomer, error.response.data, null)
        })
        .finally(() => {
            resolve()
        })    
    })
}*/


// ---------------------------------------------------------------------


async function getVariants(store_id, header, idproduct, idProductSaurus){
    return new Promise(async (resolve, reject) => {
        await axios.get(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}/variants`, header)
        .then(async (answer) => {
                resolve(answer.data)
        })
        .catch(async (error) => {
            if(error.response){
                await errorHandlingRequest('variation', 'GET', idProductSaurus, null, error.response.data, null)
                .then(() => {
                    reject()
                })
            }else{
                setTimeout(async () => {
                    await getVariants(store_id, header, idproduct, idProductSaurus)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        await errorHandlingRequest('variation', 'GET', idProductSaurus, null, 'CONNECTION ERROR', null)
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


async function registerVariation(store_id, header, body, idproduct, idProductSaurus){
    return new Promise(async (resolve, reject) => {
        await axios.post(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}/variants`, body, header)
        .then(async (answer) => {
            await successHandlingRequests('variation', 'post', idProductSaurus, answer.data.id, [body.values[0].pt])
        })
        .catch(async (error) => {
            if(error.response){ 
                if(error.response.data.values){ //erro tentando cadastrar variante com numero errado de elementos
                    if(error.response.data.values[0]=='The values has the wrong number of elements.'){
                        await updateProduct(store_id, header, {"attributes":[{"pt": 'Variação'}]}, idproduct, idProductSaurus)
                        .then(async () => {
                            console.log('Atualizado produto para poder definir elementos das variacoes')
                            await registerVariation(store_id, header, body, idproduct, idProductSaurus)
                        })
                    }else{
                        await errorHandlingRequest('variation', 'POST', idProductSaurus, null, error.response.data, body)
                    }
                }else{ //variante ja existe
                    if(error.response.data.description=="Variants cannot be repeated"){
                        gravarLog('Variante ja existe, procurando ID da variante para atualizar banco')
                        await getVariants(store_id, header, idproduct, idProductSaurus)
                        .then(async (variantsOfProduct) => {
                            let nameVariant = body.values[0].pt
                            await findIdVariantFromNameVariant(variantsOfProduct, nameVariant)
                            .then(async (idVariantFound) => {
                                await successHandlingRequests('variation', 'post', idProductSaurus, idVariantFound, [nameVariant])
                            })
                            .catch(() => {
                                gravarLog('Devido a alguma exception nao foi possivel encontrar id de variante que consta como existente na base da nuvemshop')
                                console.log('Devido a alguma exception nao foi possivel encontrar id de variante que consta como existente na base da nuvemshop')
                                resolve()
                            })
                        })
                    }else{
                        console.log(error.response.data)
                    }  
                }
                
            }else{ // request sem response
                setTimeout(async () => {
                    await registerVariation(store_id, header, body, idproduct, idProductSaurus)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        await errorHandlingRequest('variation', 'POST', idProductSaurus, null, 'CONNECTION ERROR', body)
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


async function updateVariation(store_id, header, body, idproduct, idVariant, idProductSaurus){
    return new Promise(async (resolve, reject) => {
        await axios.put(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}/variants/${idVariant}`, body, header)
        .then(async() => {
            if(body.values){
                await successHandlingRequests('variation', 'update', idProductSaurus, idVariant, [body.values[0].pt])
            }else{
                await successHandlingRequests('product', 'update', idProductSaurus, idproduct, null)
            }
            
        })
        .catch(async (error) => {
            if(error.response){
                if(error.response.data.description=='Product_Variant with such id does not exist'){
                    await deleteVariation(store_id, header, idproduct, idVariant, idProductSaurus, 'PRODUTO DESCONHECIDO', 0) 
                }else
                if(error.response.data.values[0]=='The values has the wrong number of elements.'){
                    await updateProduct(store_id, header, {"attributes":[{"pt": 'Variação'}]}, idproduct, idProductSaurus)
                    .then(async () => {
                        console.log('Atualizado produto para poder definir elementos das variacoes')
                        await updateVariation(store_id, header, body, idproduct, idVariant, idProductSaurus)
                    })
                }else{
                    await errorHandlingRequest('variation', 'PUT', idProductSaurus, idVariant, error.response.data, body)
                }
               
            }
            else{
                setTimeout(async () => {
                    await updateVariation(store_id, header, body, idproduct, idVariant, idProductSaurus)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Update Variation Loading...')

                        await errorHandlingRequest('variation', 'PUT', idProductSaurus, idVariant, 'CONNECTION ERROR', body)
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



async function deleteVariation(store_id, header, idproduct, idVariant, idProductSaurus, nameVariant, stockProduct){
    return new Promise(async (resolve, reject) => {
        await axios.delete(`https://api.nuvemshop.com.br/v1/${store_id}/products/${idproduct}/variants/${idVariant}`, header)
        .then(async () => {
            await successHandlingRequests('variation', 'delete', idProductSaurus, idVariant, [nameVariant])
        })
        .catch(async (error) => {
            if(error.response){

                if(error.response.data.description=='Product_Variant with such id does not exist'){
                    await successHandlingRequests('variation', 'delete', idProductSaurus, idVariant, [nameVariant])
                }else
                if(error.response.data.description=="The last variant of a product cannot be deleted."){
                    let newUniqueId;

                    await updateProduct(store_id, header, {"attributes": [""]}, idproduct, idProductSaurus)
                    .then(async () => {
                        await getVariants(store_id, header, idproduct, idProductSaurus)
                        .then(async (response) => {
                            response[0].values = []
                            let bodyPutVariants = response
                            await putVariantsInProduct(store_id, header, bodyPutVariants, idproduct, idProductSaurus)
                            .then(async (response) => {
                                await saveNewUniqueIdInProduct(idProductSaurus, response)
                                newUniqueId = response;
                            })
                        })
                        .then(async () => {
                            await updateProduct(store_id, header, {"attributes":[{"pt": 'Variação'}]}, idproduct, idProductSaurus)
                        })
                        .then(async () => {
                            await updateVariation(store_id, header, {"stock": stockProduct}, idproduct, newUniqueId, idProductSaurus)
                        })
                    })
                    .then(async () => {
                        await successHandlingRequests('variation', 'delete', idProductSaurus, idVariant, [nameVariant])
                    })
                    .catch(async () => {
                        await errorHandlingRequest('variation', 'DELETE', idProductSaurus, idVariant, error.response.data, null)
                        resolve()
                    })
                }else{
                    await errorHandlingRequest('variation', 'DELETE', idProductSaurus, idVariant, error.response.data, null)
                }
            }else{
                setTimeout(async () => {
                    await deleteVariation(store_id, header, idproduct, idVariant, idProductSaurus, nameVariant, stockProduct)
                    .then(async() => {
                        resolve()
                    })
                    .catch(async () => {
                        console.log('Delete Variation Loading...')


                        await errorHandlingRequest('variation', 'DELETE', idProductSaurus, idVariant, 'CONNECTION ERROR', null)
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
            'User-Agent': `SaurusSync (${body.client_id})`, 
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
    generateToken
}