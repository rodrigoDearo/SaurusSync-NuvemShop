const axios = require('axios');

const { gravarLog } = require('./auxFunctions');

async function getProducts(body, header){
    return new Promise(async (resolve, reject) => {
        axios.post('https://wscadastros.saurus.net.br/v001/serviceCadastros.asmx', body, { headers: header })
        .then(async (answer) => {
            console.log(answer.data);  
        })
        .catch(async (error) => {
            console.log(error.response)
        })
    })
}


module.exports = {
  getProducts
}