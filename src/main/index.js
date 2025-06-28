const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron')
const path = require('node:path')

const { saveInfos, returnValueFromJson } = require('./utils/manageInfoUser.js')
const { copyJsonFilesToUserData, gravarLog, deleteErrorsRecords } = require('./utils/auxFunctions.js')
const { requireAllProducts } = require('./utils/managerProducts.js')
const { preparingGenerateToken } = require('./utils/preparingRequests.js')

var win;

const createWindow = () => {
  win = new BrowserWindow({
    width: 650,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, 'ipc/preload.js')
    },
    movable: false,
    resizable: false,
    autoHideMenuBar: true,
    frame: false,
    icon: path.join(__dirname, 'img/icon.png')
  })

  win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

app.on('window-all-closed', () => {
  app.quit()
})

app.whenReady().then(() => {
  //copyJsonFilesToUserData()
  createWindow()

  const icon = path.join(__dirname, 'img/icon.png')
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Abrir', click: function(){
      win.show()
    }},
    { label: 'Minimizar', click: function(){
      win.hide();
    }},
    { label: 'Fechar', click: function(){
      app.quit() 
    }}
  ])
  
  tray.setContextMenu(contextMenu)
  tray.setToolTip('Saurussync - Nuvem')
})



// IPC

ipcMain.on('close', (events) => {
  events.preventDefault();
  app.quit()
})

ipcMain.on('minimize', (events) => {
  events.preventDefault();
  win.hide();
})

ipcMain.handle('saveInfoSaurus', async (events, args) => {
  events.preventDefault();
  await saveInfos('saurus', args)
  .then(() => {
    return
  })
})

ipcMain.handle('saveInfoNuvemShop', async (events, args) => {
  const success = await preparingGenerateToken(args)
  return success
})


ipcMain.handle('getInfoUser', async (events, args) => {
  const valueField = await returnValueFromJson(args)
  return valueField
})


ipcMain.handle('startProgram', async () => {
  gravarLog(' . . . Starting SaurusSync  . . .')

  await mainProcess()
  .then((response) => {
    return response
  })
})

async function mainProcess(){
  return new Promise(async (resolve, reject) => {

    await deleteErrorsRecords()
    .then(async () => {
      await requireAllProducts(true)
    })
    .then(async () => {
      setInterval(async () => {
        await requireAllProducts(false)
        .then(() => {
          gravarLog('---------------------------------------------------------------------')
          gravarLog('REALIZADO A LEITURA PERIODICA')
          gravarLog('---------------------------------------------------------------------')
        })
      
      }, 1800000);
    })

    
  })
}
