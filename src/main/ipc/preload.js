const { contextBridge, ipcRenderer } = require('electron/renderer')

const WINDOW_API = {
    closeApp: () => ipcRenderer.send('close'),
    minimizeApp: () => ipcRenderer.send('minimize'),

    saveSaurus: (dominio, chavecaixa, tabpreco) => ipcRenderer.invoke('saveInfoSaurus', [dominio, chavecaixa, tabpreco]),
    saveNuvemShop: (code) => ipcRenderer.invoke('saveInfoNuvemShop', code),
    getInfoUser: (field) => ipcRenderer.invoke('getInfoUser', field),
    start: () => ipcRenderer.invoke('startProgram')
}

contextBridge.exposeInMainWorld('api', WINDOW_API)