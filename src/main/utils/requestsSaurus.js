const axios = require('axios');

const { gravarLog } = require('./auxFunctions');

async function getProducts(body, header){
    return new Promise(async (resolve, reject) => {
        axios.post('https://wscadastros.saurus.net.br/v001/serviceCadastros.asmx', body, { header })
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


module.exports = {
  getProducts
}