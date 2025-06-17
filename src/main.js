const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const DatabaseManager = require("./Database/dbManager");

let mainWindow;
let dbManager;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: path.join(__dirname, "../assets/icon.png"),
    show: false, // Don't show until ready
  });

  // Load the app
  mainWindow.loadFile("src/renderer/index.html");

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes("--debug")) {
    mainWindow.webContents.openDevTools();
  }
}

// App event handlers
app.whenReady().then(() => {
  // Initialize database
  dbManager = new DatabaseManager();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC handlers for database operations
ipcMain.handle("db-add-purchase", async (event, purchaseData) => {
  try {
    const result = await dbManager.addPurchase(purchaseData);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-add-sale", async (event, saleData) => {
  try {
    const result = await dbManager.addSale(saleData);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-available-vehicles", async (event) => {
  try {
    const result = await dbManager.getAvailableVehicles();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-profit-report", async (event, filters) => {
  try {
    const result = await dbManager.getProfitReport(filters);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-monthly-summary", async (event, month) => {
  try {
    const result = await dbManager.getMonthlySummary(month);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-dashboard-data", async (event) => {
  try {
    const result = await dbManager.getDashboardData();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-search-vehicles", async (event, searchTerm) => {
  try {
    const result = await dbManager.searchVehicles(searchTerm);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
