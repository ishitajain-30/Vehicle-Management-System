const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");
const fs = require("fs");

class DatabaseManager {
  constructor() {
    // Create database in user data directory
    const userDataPath = app.getPath("userData");

    // Ensure the directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.dbPath = path.join(userDataPath, "vehicle_management.db");

    console.log("Database will be created at:", this.dbPath);

    try {
      this.db = new Database(this.dbPath);
      console.log("Connected to SQLite database at:", this.dbPath);
      this.initializeDatabase();
    } catch (err) {
      console.error("Error opening database:", err.message);
      throw err;
    }
  }

  initializeDatabase() {
    // Create tables and views
    const createTables = [
      `CREATE TABLE IF NOT EXISTS purchase_info (
        purchase_date TEXT,
        model_name TEXT,
        chassis_no TEXT UNIQUE,
        color TEXT,
        purchase_price REAL,
        transport_cost REAL,
        accessories_cost REAL,
        PRIMARY KEY (model_name, chassis_no)
      )`,

      `CREATE TABLE IF NOT EXISTS sales_info (
        chassis_no TEXT PRIMARY KEY,
        customer_name TEXT,
        sale_date TEXT,
        sales_price REAL,
        insurance_cost REAL,
        tax_registration_cost REAL,
        registration_date TEXT,
        payment_type TEXT CHECK (
          payment_type IN ('cash', 'disbursment', 'bank_transfer', 'return_vehicle')
        ),
        FOREIGN KEY (chassis_no) REFERENCES purchase_info(chassis_no) ON DELETE CASCADE
      )`,

      `CREATE TRIGGER IF NOT EXISTS trg_return_vehicle_delete
       AFTER INSERT ON sales_info
       FOR EACH ROW
       WHEN NEW.payment_type = 'return_vehicle'
       BEGIN
         DELETE FROM purchase_info WHERE chassis_no = NEW.chassis_no;
       END`,

      `CREATE VIEW IF NOT EXISTS vehicle_profit_view AS
       SELECT
         p.chassis_no,
         p.model_name,
         p.purchase_date,
         p.color,
         s.customer_name,
         s.sale_date,
         s.payment_type,
         s.insurance_cost,
         s.tax_registration_cost,
         s.sales_price,
         p.purchase_price,
         p.transport_cost,
         p.accessories_cost,
         (s.sales_price - (p.purchase_price + p.transport_cost + p.accessories_cost + s.insurance_cost + s.tax_registration_cost)) AS profit,
         ROUND(
           ((s.sales_price - (p.purchase_price + p.transport_cost + p.accessories_cost + s.insurance_cost + s.tax_registration_cost)) * 100.0) /
           (p.purchase_price + p.transport_cost + p.accessories_cost + s.insurance_cost + s.tax_registration_cost), 2
         ) AS profit_percentage
       FROM purchase_info p
       JOIN sales_info s ON p.chassis_no = s.chassis_no`,

      `CREATE VIEW IF NOT EXISTS monthly_profit_summary AS
       SELECT
         strftime('%Y-%m', purchase_date) AS month,
         COUNT(*) AS total_vehicles_sold,
         SUM(profit) AS total_profit,
         ROUND(AVG(profit_percentage), 2) AS avg_profit_percent
       FROM vehicle_profit_view
       GROUP BY strftime('%Y-%m', purchase_date)`,
    ];

    try {
      createTables.forEach((sql) => {
        this.db.exec(sql);
      });
      console.log("Database tables and views created successfully");
    } catch (err) {
      console.error("Error creating tables/views:", err.message);
      throw err;
    }
  }

  // Purchase operations
  addPurchase(purchaseData) {
    try {
      const stmt = this.db.prepare(`INSERT INTO purchase_info 
                   (purchase_date, model_name, chassis_no, color, purchase_price, transport_cost, accessories_cost)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`);

      const result = stmt.run(
        purchaseData.purchase_date,
        purchaseData.model_name,
        purchaseData.chassis_no,
        purchaseData.color,
        purchaseData.purchase_price,
        purchaseData.transport_cost || 0,
        purchaseData.accessories_cost || 0
      );

      return { id: result.lastInsertRowid, changes: result.changes };
    } catch (err) {
      throw err;
    }
  }

  // Sale operations
  addSale(saleData) {
    try {
      const stmt = this.db.prepare(`INSERT INTO sales_info 
                   (chassis_no, customer_name, sale_date, sales_price, insurance_cost, tax_registration_cost, registration_date, payment_type)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

      const result = stmt.run(
        saleData.chassis_no,
        saleData.customer_name,
        saleData.sale_date,
        saleData.sales_price,
        saleData.insurance_cost || 0,
        saleData.tax_registration_cost || 0,
        saleData.registration_date,
        saleData.payment_type
      );

      return { id: result.lastInsertRowid, changes: result.changes };
    } catch (err) {
      throw err;
    }
  }

  // Get available vehicles (not sold)
  getAvailableVehicles() {
    try {
      const stmt = this.db.prepare(`SELECT * FROM purchase_info 
                   WHERE chassis_no NOT IN (SELECT chassis_no FROM sales_info)
                   ORDER BY purchase_date DESC`);

      return stmt.all();
    } catch (err) {
      throw err;
    }
  }

  // Get profit report with filters
  getProfitReport(filters = {}) {
    try {
      let sql = "SELECT * FROM vehicle_profit_view WHERE 1=1";
      const params = [];

      if (filters.payment_type) {
        sql += " AND payment_type = ?";
        params.push(filters.payment_type);
      }

      if (filters.month) {
        sql += ' AND strftime("%m", purchase_date) = ?';
        params.push(filters.month.padStart(2, "0"));
      }

      if (filters.year) {
        sql += ' AND strftime("%Y", purchase_date) = ?';
        params.push(filters.year);
      }

      if (filters.model_name) {
        sql += " AND model_name = ?";
        params.push(filters.model_name);
      }

      sql += " ORDER BY sale_date DESC";

      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (err) {
      throw err;
    }
  }

  // Get monthly summary
  getMonthlySummary(month) {
    try {
      const stmt = this.db.prepare(
        "SELECT * FROM monthly_profit_summary WHERE month = ?"
      );
      const result = stmt.get(month);

      return (
        result || {
          month,
          total_vehicles_sold: 0,
          total_profit: 0,
          avg_profit_percent: 0,
        }
      );
    } catch (err) {
      throw err;
    }
  }

  // Get dashboard data
  getDashboardData() {
    try {
      const queries = {
        totalVehicles: this.db.prepare(
          "SELECT COUNT(*) as count FROM purchase_info"
        ),
        availableVehicles: this.db.prepare(
          "SELECT COUNT(*) as count FROM purchase_info WHERE chassis_no NOT IN (SELECT chassis_no FROM sales_info)"
        ),
        soldVehicles: this.db.prepare(
          "SELECT COUNT(*) as count FROM sales_info"
        ),
        totalProfit: this.db.prepare(
          "SELECT SUM(profit) as total FROM vehicle_profit_view"
        ),
        monthlyData: this.db.prepare(
          "SELECT * FROM monthly_profit_summary ORDER BY month DESC LIMIT 6"
        ),
      };

      const results = {};
      results.totalVehicles = queries.totalVehicles.get();
      results.availableVehicles = queries.availableVehicles.get();
      results.soldVehicles = queries.soldVehicles.get();
      results.totalProfit = queries.totalProfit.get();
      results.monthlyData = queries.monthlyData.all();

      return results;
    } catch (err) {
      throw err;
    }
  }

  // Search vehicles
  searchVehicles(searchTerm) {
    try {
      const stmt = this.db
        .prepare(`SELECT p.*, s.customer_name, s.sale_date, s.payment_type
                   FROM purchase_info p
                   LEFT JOIN sales_info s ON p.chassis_no = s.chassis_no
                   WHERE p.chassis_no LIKE ? OR p.model_name LIKE ? OR p.color LIKE ? OR s.customer_name LIKE ?
                   ORDER BY p.purchase_date DESC`);

      const searchPattern = `%${searchTerm}%`;
      return stmt.all(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    } catch (err) {
      throw err;
    }
  }

  // Get database path for debugging
  getDatabasePath() {
    return this.dbPath;
  }

  // Close database connection
  close() {
    try {
      this.db.close();
      console.log("Database connection closed.");
    } catch (err) {
      console.error("Error closing database:", err.message);
    }
  }
}

module.exports = DatabaseManager;
