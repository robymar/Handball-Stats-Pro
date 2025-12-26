const { app, BrowserWindow } = require('electron');
const path = require('path');

// Manejo básico para instaladores en Windows
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    // icon: path.join(__dirname, '../icon.png'), // Descomenta si añades un icono
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // webSecurity false puede ser necesario si tienes problemas cargando
      // recursos mixtos locales/remotos en esta configuración simple sin bundler.
      webSecurity: false 
    },
    autoHideMenuBar: true,
    backgroundColor: '#0f172a', // Coincide con bg-slate-900 para evitar flash blanco
    show: false // Esperar a que esté listo para mostrar
  });

  // Cargar el index.html local
  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});