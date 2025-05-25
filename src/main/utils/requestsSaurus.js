function setDate() {
  return new Promise((resolve, reject) => {
    try {
      let data = new Date();
      data.setHours(data.getHours() - 4);
      data.setMinutes(data.getMinutes() - minutos);
      data.setSeconds(data.getSeconds() - segundos);
      console.log(`Data > ${data}`);
      let dataISO8601 = data.toISOString();
      data = dataISO8601.slice(0, -5);
      data += '-03:0';
      DateTime = data;
      console.log('Puxando mudancas desde: ' + DateTime);
      resolve(DateTime);
    } catch (error) {
      reject(error);
    }
  });
}


/**
 * Define a senha para ser enviada na requisição para consumir WebService Saurus
 * @returns {senha} no padrão consultado com desenvolvdedores do software
 */
function setSenha() {
  let dataAtual = new Date();
  let dia = dataAtual.getDate();
  let mes = dataAtual.getMonth();
  let ano = dataAtual.getFullYear() + 1;


  //da pra colocar parte da senha no arquivo .env
  let senha = `ophd02ophd02|@${dia + mes + ano - 2000}|${Dominio}|1`;
  senha = senha.toString();
  return senha;
}


/**
 * Fução assíncrona para atribuir valor da chaveCaixa com base no retorno da função retornarCampo
 */
async function getChaveCaixa() {
  try {
    let chaveRetorno = await retornaCampo('chave');
    ChaveCaixa = chaveRetorno;
  } catch (err) {
    gravarLogErro('Erro ao retornar dados:', err);
  }
}

/**
 * Atribui os valores de minuto e segundo referente ao timer definido na configuração geral
 */
function getTimerJSON() {
  return new Promise(async (resolve, reject) => {
    try {
      let timerRetorno = await retornaCampo('timer');
      let timerValor = timerRetorno.toString();
      minutos = parseInt(timerValor.substring(0, 2));
      segundos = parseInt(timerValor.substring(3, 5));
      resolve(); // Resolving the promise without any data
    } catch (error) {
      reject(error); // Rejecting the promise with the error
    }
  });
}

/**
 * Função para estrutura data e horário no padrão solicitado
 * @param {*} data data informada no input como base para requisição 
 * @returns {DateTime} a mesma data recebida como parametro porém estruturada no formado solicitado para consumo do WebService (adição do fuso hórario)
 */
function getData(data) {
  return new Promise((resolve, reject) => {
    DateTime = data + ':00-03:0';
    console.log(DateTime);
    resolve(DateTime);
  })
}





/**
 * Fução assíncrona para codificar a string do xml a ser enviado para requisição, em formato 64x bytes (padrão solicitado para ser enviado o xBytes)
 */
async function codificarXmlReqCadastro() {
  try {
    xBytesParametros = codificarInBase64(`<xmlIntegracao>
      <Dominio>${Dominio}</Dominio>
      <TpArquivo>50</TpArquivo>
      <ChaveCaixa>${ChaveCaixa}</ChaveCaixa>
      <TpSync>${TpSync}</TpSync>
      <DhReferencia>${DateTime}</DhReferencia>
</xmlIntegracao>`);
  } catch (err) {
    gravarLogErro('Erro ao codificar xmlReqCadastro:', err);
  }
}


async function codificarXmlRetProdutoEstoque(idParametro) {
  try {
    let idProdutoColsulta = idParametro;
    xBytesParametros = codificarInBase64(`<xmlIntegracao>
    <Dominio>${Dominio}</Dominio>
    <IdProduto>${idProdutoColsulta}</IdProduto>
    <CodProduto/>
  </xmlIntegracao>`);
  }
  catch (err) {
    gravarLogErro('Erro ao codificar xmlRetProdutoEstoque:', err)
  }
}


/**
 * Função para codificar a senha en base 64 para ser enviada no corpo da requisição e consumo do WebService
 */
async function codificarSenha() {
  try {
    Password = codificarInBase64(setSenha());
  }
  catch (err) {
    console.err('Erro ao codificar Senha:', err);
  }
}


/**
 * Função que realiza a requisção POST para o WebSevice reqCadastros através da biblioteca Axios
 * @param {*} Sync paramêtro informado para realização da requisição (explicação dos valores passados a Sync são explicados na documentação)
 */
function reqCadastros(Sync) {
  return new Promise((resolve, reject) => {
    getChaveCaixa()
      .then(() => {
        TpSync = Sync;
      })
      .then(() => getDominio())
      .then(() => codificarSenha())
      .then(() => codificarXmlReqCadastro())
      .then(() => {
        const headers = {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://saurus.net.br/retCadastros'
        }

        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <retCadastros xmlns="http://saurus.net.br/">
              <xBytesParametros>${xBytesParametros}</xBytesParametros>
              <xSenha>${Password}</xSenha>
            </retCadastros>
          </soap:Body>
        </soap:Envelope>`
        axios.post('https://wscadastros.saurus.net.br/v001/serviceCadastros.asmx', body, { headers })
          .then((response) => {
            xml2js.parseString(response.data, async (err, result) => {
              if (err) {
                gravarLogErro(err);
              } else {
  
                if ((result['soap:Envelope']['soap:Body'][0].retCadastrosResponse[0].xRetNumero[0]) == '1') {
                  reject('Verifique as informações cadastradas, se estão preenchidas corretamente. Caso esteja tudo de acordo entre em contato com desenvolvimento para averiguar');
                } else {
                  if (result['soap:Envelope']['soap:Body'][0].retCadastrosResponse[0].retCadastrosResult == undefined) {
                    console.log('Não foi encontrado mudanças para serem carregadas');
                    gravarLog('Não foi encontrado mudanças para serem carregadas');
                    mensagemRetorno = 'Não foi encontrado mudanças para serem carregadas';
                    resolve();
                  }
                  else {
                    let retCadastrosResult = result['soap:Envelope']['soap:Body'][0].retCadastrosResponse[0].retCadastrosResult[0];
                    await autorizarAcesso(retCadastrosResult)
                      .then(async () => {
                        await wsCadastro()
                        .then(async () => {
                          await uploadImages()
                          .then(async () => {
                            await uploadPreco()
                          .then(async () => {
                              await uploadCodigos()
                              .then(() => {
                                resolve();
                              })
                          })
                        })
                        })
                      })
                      .catch((_) => { gravarLogErro('Erro ao gerar chaves de acesso') })
                  }
                }
              }
            });
          })
          .catch((error) => {
            gravarLogErro('TIMEOUT na requisição. Tempo limite para comunicação com WebService Saurus Excedido. Entrar em contato com suporte técnico!', error);
            reject('TIMEOUT na requisição. Tempo limite para comunicação com WebService Saurus Excedido. Entrar em contato com suporte técnico!');
          });
      })
      .catch((error) => {
        gravarLogErro('Erro ao obter dados:', error);
      });
  });
}



function retProdutoEstoque(id) {
  return new Promise((resolve, reject) => {
    getDominio()
      .then(() => codificarSenha())
      .then(() => codificarXmlRetProdutoEstoque(id))
      .then(() => {
        const headers = {
          'Host': 'wsretaguarda.saurus.net.br',
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://saurus.net.br/retProdutoEstoque'
        };

        const body = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <retProdutoEstoque xmlns="http://saurus.net.br/">
              <xBytesParametros>${xBytesParametros}</xBytesParametros>
              <xSenha>${Password}</xSenha>
            </retProdutoEstoque>
          </soap:Body>
        </soap:Envelope>`;

        axios.post('http://wsretaguarda.saurus.net.br/v001/serviceRetaguarda.asmx', body, { headers })
          .then((response) => {
            xml2js.parseString(response.data, async (err, result) => {
              if (err) {
                gravarLogErro(err);
                reject(err);
              } else {
                if (result['soap:Envelope']['soap:Body'][0].retProdutoEstoqueResponse[0].xRetNumero == 1) {
                  gravarLogErro('Erro na requisição 6')
                  resolve(0);
                } else if (result['soap:Envelope']['soap:Body'][0].retProdutoEstoqueResponse[0].xRetNumero == 0) {
                  let retProdutoEstoqueResult = result['soap:Envelope']['soap:Body'][0].retProdutoEstoqueResponse[0].retProdutoEstoqueResult[0];
                  await VerificaAutorizarAcesso()
                  .then(async () => {
                    await decodificarEsalvarEstoque(retProdutoEstoqueResult, id)
                    .then(() => {
                      resolve(1);
                    })
                  })
                }
              }
            });
          })
          .catch((error) => {
            gravarLogErro('Erro na requisição 5');
            resolve(0);
          });
      })
      .catch((error) => {
        gravarLogErro('Erro na requisição 6');
        reject(error);
      });
  });
}


async function getEstoqueXml(id) {
  try {
    const parser = new DOMParser();
    let xmlString = fs.readFileSync(`../GravacaoXMLprodutoEstoque/cadastros-${id}.xml`, { encoding: 'utf8' });
    let xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    let estoqueLojas = xmlDoc.getElementsByTagName('EstoqueLoja');

    let saldoTotal = 0;
    for (let i = 0; i < estoqueLojas.length; i++) {
      let qSaldo = parseFloat(estoqueLojas[i].getAttribute('qSaldo'));
      saldoTotal += qSaldo;
    }

    if (isNaN(saldoTotal)) {
      gravarLogErro(`O estoque do produto de id Saurus: ${id} foi zerado devido a um erro ao pegar estoque no XML`);
      saldoTotal = 0;
    }

    return saldoTotal;
  } catch (error) {
    gravarLogErro(error);
    throw error;
  }
}