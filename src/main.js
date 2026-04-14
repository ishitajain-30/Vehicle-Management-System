const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const DatabaseManager = require("./database/dbManager");

let mainWindow;
let dbManager;
let currentUser = null;

// --- Simple RBAC helpers ---
const ROLE_PERMISSIONS = {
  admin: [
    "dashboard:view",
    "inventory:view",
    "purchase:create",
    "purchase:edit",
    "sale:create",
    "sale:edit",
    "vehicle:view",
    "vehicle:return",
    "reports:view_full",
    "users:manage",
  ],
  staff: [
    "dashboard:view",
    "inventory:view",
    "sale:create",
    "sale:edit",
    "vehicle:view",
    "vehicle:return",
    "reports:view_limited",
  ],
};

function hasPermission(permission) {
  if (!currentUser || !currentUser.role) return false;
  const perms = ROLE_PERMISSIONS[currentUser.role] || [];
  return perms.includes(permission);
}

function isAuthenticated() {
  return !!currentUser;
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, "../assets/icon.png"),
    show: false,
  });

  // Load the app
  mainWindow.loadFile("src/renderer/index.html");

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
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
    console.log("Initializing database...");
    dbManager = new DatabaseManager();
    console.log("Database initialized successfully");
    createWindow();
  } catch (error) {
    console.error("Failed to initialize database:", error);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (dbManager) {
    dbManager.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (dbManager) {
    dbManager.close();
  }
});

// --- IPC Handlers for Database Operations ---

// --- Auth & Session ---

ipcMain.handle("auth-login", async (event, { username, password }) => {
  try {
    const normalizedUsername = (username || "").trim().toLowerCase();
    const user = dbManager.getUserByUsername(normalizedUsername);
    if (!user || user.is_active !== 1) {
      return { success: false, error: "Invalid credentials" };
    }
    if ((password || "") !== (user.password || "")) {
      return { success: false, error: "Invalid credentials" };
    }
    currentUser = { id: user.id, username: user.username, role: user.role };
    return { success: true, data: currentUser };
  } catch (error) {
    console.error("Error during login:", error);
    return { success: false, error: "Login failed" };
  }
});

ipcMain.handle("auth-get-current-user", async () => {
  if (!currentUser) {
    return { success: false, error: "Not authenticated" };
  }
  return { success: true, data: currentUser };
});

ipcMain.handle("auth-logout", async () => {
  currentUser = null;
  return { success: true };
});

// CREATE
ipcMain.handle("db-add-purchase", async (event, purchaseData) => {
  try {
    if (!isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }
    const result = await dbManager.addPurchase(purchaseData);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error adding purchase:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-add-sale", async (event, saleData) => {
  try {
    if (!isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }
    const result = await dbManager.addSale(saleData);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error adding sale:", error);
    return { success: false, error: error.message };
  }
});

// READ
ipcMain.handle("db-get-vehicle", async (event, chassisNo) => {
  try {
    if (!isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }
    const result = await dbManager.getVehicleByChassis(chassisNo);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error getting vehicle:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-available-vehicles", async (event) => {
  try {
    if (!isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }
    const result = await dbManager.getAvailableVehicles();
    return { success: true, data: result };
  } catch (error) {
    console.error("Error getting available vehicles:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-profit-report", async (event, filters) => {
  try {
    if (hasPermission("reports:view_full")) {
      const result = await dbManager.getProfitReport(filters);
      return { success: true, data: result, scope: "full" };
    }
    if (hasPermission("reports:view_limited")) {
      const result = await dbManager.getProfitReport(filters);
      // Strip sensitive financial fields for staff
      const sanitized = result.map((r) => ({
        chassis_no: r.chassis_no,
        model_name: r.model_name,
        customer_name: r.customer_name,
        sale_date: r.sale_date,
        payment_type: r.payment_type,
      }));
      return { success: true, data: sanitized, scope: "limited" };
    }
    return { success: false, error: "Not authorized to view reports" };
  } catch (error) {
    console.error("Error getting profit report:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-get-dashboard-data", async (event) => {
  try {
    if (!isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }
    const result = await dbManager.getDashboardData();
    return { success: true, data: result };
  } catch (error) {
    console.error("Error getting dashboard data:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-search-vehicles", async (event, searchTerm) => {
  try {
    if (!isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }
    const result = await dbManager.searchVehicles(searchTerm);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error searching vehicles:", error);
    return { success: false, error: error.message };
  }
});

// UPDATE
ipcMain.handle("db-update-purchase", async (event, data) => {
  try {
    if (!isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }
    const result = await dbManager.updatePurchase(data);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error updating purchase:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-update-sale", async (event, data) => {
  try {
    if (!isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }
    const result = await dbManager.updateSale(data);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error updating sale:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("db-upsert-sale", async (event, data) => {
  try {
    if (!isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }
    // Try update first; if no row updated, insert
    let result = await dbManager.updateSale(data);
    if (result.changes === 0) {
      result = await dbManager.addSale(data);
    }
    return { success: true, data: result };
  } catch (error) {
    console.error("Error upserting sale:", error);
    return { success: false, error: error.message };
  }
});

// SPECIAL ACTIONS
ipcMain.handle("db-return-vehicle", async (event, data) => {
  try {
    if (!isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }
    const result = await dbManager.returnVehicle(data);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error returning vehicle:", error);
    return { success: false, error: error.message };
  }
});
