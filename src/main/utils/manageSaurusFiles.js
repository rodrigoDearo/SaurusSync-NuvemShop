const zlib = require('zlib');
const fs = require('fs');
const stream = require('stream');
const moment = require('moment');

const { salvarDados } = require('./manipulacaoJSON');

var fileName;

// ---------------------- FUNÇÃO PARA CRIAR E ZIPAR DADOS  ---------------------- //
/**
 * Função para criar um arquivo XML e retorná-lo compactado
 * @returns {xmlString} - Arquivo XML compactado em GZIP
 */
function criarEziparArquivoXml(){
    let xmlIntegracao = builder.create('xmlIntegracao') // CRIAR XML INTEGRAÇÃO
    .ele('Dominio', Dominio) 
    .ele('TpArquivo', TpArquivo)
    .ele('ChaveCaixa', ChaveCaixa)
    .ele('TpSync', TpSync)
    .ele('DhReferencia', DhReferencia)
    .end({ pretty: true });
  
    let xmlString = xmlIntegracao.toString(); // TRANSFORMA XML EM STRING
    //let compressedXml = zlib.gzipSync(xmlString);  COMPACTA XML
    return xmlString;
  }
  
  
  
  // ---------------------- FUNÇÃO PARA CODIFICAR EM BASE 64 ---------------------- //
  /**
   * Função para codificar valor para base64
   * @param {valueString} - Valor a ser codificada
   * @returns {bytesXmlGzip} - String codificada em base64
   */
  function codificarInBase64(valueString){
    let bytesXmlGzip = Buffer.from(valueString).toString('base64');
    return bytesXmlGzip;
  }
  
  
  // ---------------------- FUNÇÃO PARA DEOCDIGICAR BASE 64 E EXTRAIR ZIP ---------------------- //
  
  
  async function decodificarEsalvar(data) {
    return new Promise((resolve, reject) => {
      let gzipData = Buffer.from(data, 'base64'); // Converte de base64 para Buffer
      zlib.gunzip(gzipData, async (err, result) => { // Descompacta os dados
        if (err) {
          reject(err);
        }
        let now = moment().utc().subtract(3, 'hours').format('YYYY-MM-DD HH-mm');
        fileName = `cadastros-${now}.xml`;
        await salvarDados(fileName, null, null, 'geral_file');
        const readStream = stream.Readable.from(result); // Cria um stream de leitura a partir dos dados descompactados

        if (!fs.existsSync('../GravacaoXML')) {
          fs.mkdirSync('../GravacaoXML');
        }

        readStream.pipe(fs.createWriteStream(`../GravacaoXML/${fileName}`)) // Grava os dados em um arquivo
          .on('error', function(err) {
            reject(err);
          })
          .on('finish', function() {
            console.log('Arquivo descompactado e gravado com sucesso!');
            resolve();
          });
      });
    });
  }


  async function decodificarEsalvarEstoque(data, id) {
    return new Promise((resolve, reject) => {
      let gzipData = Buffer.from(data, 'base64'); // Converte de base64 para Buffer
      zlib.gunzip(gzipData, async (err, result) => { // Descompacta os dados
        if (err) {
          reject(err);
        }

        fileName = `cadastros-${id}.xml`;
  
        const readStream = stream.Readable.from(result); // Cria um stream de leitura a partir dos dados descompactados

        if (!fs.existsSync('../GravacaoXMLprodutoEstoque')) {
          fs.mkdirSync('../GravacaoXMLprodutoEstoque');
        }

        readStream.pipe(fs.createWriteStream(`../GravacaoXMLprodutoEstoque/${fileName}`)) // Grava os dados em um arquivo
          .on('error', function(err) {
            reject(err);
          })
          .on('finish', function() {
            console.log('Arquivo descompactado e gravado com sucesso!');
            resolve();
          });
      });
    });
  }


  module.exports = {
    decodificarEsalvar,
    codificarInBase64,
    criarEziparArquivoXml, 
    decodificarEsalvarEstoque
  };
  
  
  