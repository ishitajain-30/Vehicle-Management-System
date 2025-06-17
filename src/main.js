const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const DatabaseManager = require("./database/dbManager"); // Note: Capital D to match your folder

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

    // Log database path for debugging
    if (dbManager) {
      console.log("Database file should be at:", dbManager.getDatabasePath());
    }
  });

  // Open DevTools in development
  if (process.argv.includes("--debug")) {
    mainWindow.webContents.openDevTools();
  }
}

// App event handlers
app.whenReady().then(() => {
  try {
    // Initialize database
    console.log("Initializing database...");
    dbManager = new DatabaseManager();
    console.log("Database initialized successfully");

    createWindow();
  } catch (error) {
    console.error("Failed to initialize database:", error);
    // You might want to show an error dialog here
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Close database connection before quitting
  if (dbManager) {
    dbManager.close();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // Ensure database is closed before app quits
  if (dbManager) {
    dbManager.close();
  }
});

// IPC handlers for database operations
ipcMain.handle("db-add-purchase", async (event, purchaseData) => {
  try {
    const result = await dbManager.addPurchase(purchaseData);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error adding purchase:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-add-sale", async (event, saleData) => {
  try {
    const result = await dbManager.addSale(saleData);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error adding sale:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-available-vehicles", async (event) => {
  try {
    const result = await dbManager.getAvailableVehicles();
    return { success: true, data: result };
  } catch (error) {
    console.error("Error getting available vehicles:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-profit-report", async (event, filters) => {
  try {
    const result = await dbManager.getProfitReport(filters);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error getting profit report:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-monthly-summary", async (event, month) => {
  try {
    const result = await dbManager.getMonthlySummary(month);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error getting monthly summary:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-dashboard-data", async (event) => {
  try {
    const result = await dbManager.getDashboardData();
    return { success: true, data: result };
  } catch (error) {
    console.error("Error getting dashboard data:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-search-vehicles", async (event, searchTerm) => {
  try {
    const result = await dbManager.searchVehicles(searchTerm);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error searching vehicles:", error);
    return { success: false, error: error.message };
  }
});

// Add a handler to get the database path for debugging
ipcMain.handle("db-get-path", async (event) => {
  try {
    const dbPath = dbManager ? dbManager.getDatabasePath() : null;
    return { success: true, data: dbPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
