const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");
const fs = require("fs");

class DatabaseManager {
  constructor() {
    const userDataPath = app.getPath("userData");
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
    const createTables = [
      `CREATE TABLE IF NOT EXISTS purchase_info (
        purchase_date TEXT NOT NULL,
        model_name TEXT NOT NULL,
        chassis_no TEXT PRIMARY KEY,
        color TEXT,
        purchase_price REAL NOT NULL,
        transport_cost REAL,
        accessories_cost REAL
      )`,
      `CREATE TABLE IF NOT EXISTS sales_info (
        chassis_no TEXT PRIMARY KEY,
        customer_name TEXT,
        sale_date TEXT NOT NULL,
        sales_price REAL,
        insurance_cost REAL,
        tax_registration_cost REAL,
        registration_date TEXT,
        payment_type TEXT CHECK (payment_type IN ('cash', 'disbursment', 'bank_transfer', 'return_vehicle')),
        FOREIGN KEY (chassis_no) REFERENCES purchase_info(chassis_no) ON DELETE CASCADE
      )`,
      `DROP TRIGGER IF EXISTS trg_return_vehicle_delete`,
      // MODIFIED: Updated view to set profit to 0 for returned vehicles.
      `CREATE VIEW IF NOT EXISTS vehicle_profit_view AS
      SELECT
        p.chassis_no,
        p.model_name,
        p.purchase_date,
        s.customer_name,
        s.sale_date,
        s.payment_type,
        s.sales_price,
        p.purchase_price,
        p.transport_cost,
        p.accessories_cost,
        s.insurance_cost,
        s.tax_registration_cost,
        CASE
            WHEN s.payment_type = 'return_vehicle' THEN 0
            ELSE (s.sales_price - (p.purchase_price + COALESCE(p.transport_cost, 0) + 
            COALESCE(p.accessories_cost, 0) + COALESCE(s.insurance_cost, 0) + COALESCE(s.tax_registration_cost, 0)))

        END AS profit,
        CASE
            WHEN s.payment_type = 'return_vehicle' THEN 0
            WHEN (p.purchase_price + COALESCE(p.transport_cost, 0) + COALESCE(p.accessories_cost, 0) + COALESCE(s.insurance_cost, 0) + COALESCE(s.tax_registration_cost, 0)) = 0 THEN 0
            ELSE ROUND(
                ((s.sales_price - (p.purchase_price + COALESCE(p.transport_cost, 0) + COALESCE(p.accessories_cost, 0) + COALESCE(s.insurance_cost, 0) + COALESCE(s.tax_registration_cost, 0))) * 100.0) /
                (p.purchase_price + COALESCE(p.transport_cost, 0) + COALESCE(p.accessories_cost, 0) + COALESCE(s.insurance_cost, 0) + COALESCE(s.tax_registration_cost, 0)), 2
            )
        END AS profit_percentage
      FROM purchase_info p
      JOIN sales_info s ON p.chassis_no = s.chassis_no`,
    ];

    try {
      this.db.transaction(() => {
        createTables.forEach((sql) => this.db.exec(sql));
      })();
      console.log("Database tables and views created/updated successfully");
    } catch (err) {
      console.error("Error creating tables/views:", err.message);
      throw err;
    }
  }

  // --- Validation ---
  _validateSaleDate(chassis_no, sale_date) {
    const purchase = this.db
      .prepare(
        "SELECT purchase_date, purchase_price FROM purchase_info WHERE chassis_no = ?"
      )
      .get(chassis_no);
    if (!purchase) {
      throw new Error(`Vehicle with chassis no ${chassis_no} not found.`);
    }
    if (new Date(sale_date) < new Date(purchase.purchase_date)) {
      throw new Error("Sale date cannot be earlier than the purchase date.");
    }
    return purchase;
  }

  // --- Purchase Operations ---
  addPurchase(data) {
    const stmt = this.db.prepare(`INSERT INTO purchase_info 
        (purchase_date, model_name, chassis_no, color, purchase_price, transport_cost, accessories_cost)
        VALUES (@purchase_date, @model_name, @chassis_no, @color, @purchase_price, @transport_cost, @accessories_cost)`);
    return stmt.run({
      ...data,
      transport_cost: data.transport_cost || 0,
      accessories_cost: data.accessories_cost || 0,
    });
  }

  updatePurchase(data) {
    const stmt = this.db.prepare(`UPDATE purchase_info SET
        purchase_date = @purchase_date,
        model_name = @model_name,
        color = @color,
        purchase_price = @purchase_price,
        transport_cost = @transport_cost,
        accessories_cost = @accessories_cost
        WHERE chassis_no = @chassis_no`);
    return stmt.run(data);
  }

  // --- Sale Operations ---
  addSale(data) {
    const purchase = this._validateSaleDate(data.chassis_no, data.sale_date);

    // If the vehicle is being returned, override sale data with return logic
    if (data.payment_type === "return_vehicle") {
      data.customer_name = "RETURNED";
      data.sales_price = purchase.purchase_price;
      data.insurance_cost = 0;
      data.tax_registration_cost = 0;
      data.registration_date = null;
    }

    const stmt = this.db.prepare(`INSERT INTO sales_info 
        (chassis_no, customer_name, sale_date, sales_price, insurance_cost, tax_registration_cost, registration_date, payment_type)
        VALUES (@chassis_no, @customer_name, @sale_date, @sales_price, @insurance_cost, @tax_registration_cost, @registration_date, @payment_type)`);

    return stmt.run({
      ...data,
      insurance_cost: data.insurance_cost || 0,
      tax_registration_cost: data.tax_registration_cost || 0,
      registration_date: data.registration_date || null,
    });
  }

  updateSale(data) {
    this._validateSaleDate(data.chassis_no, data.sale_date);
    const stmt = this.db.prepare(`UPDATE sales_info SET
        customer_name = @customer_name,
        sale_date = @sale_date,
        sales_price = @sales_price,
        insurance_cost = @insurance_cost,
        tax_registration_cost = @tax_registration_cost,
        registration_date = @registration_date,
        payment_type = @payment_type
        WHERE chassis_no = @chassis_no`);
    return stmt.run(data);
  }

  returnVehicle({ chassis_no, sale_date }) {
    const purchase = this._validateSaleDate(chassis_no, sale_date);

    if (!purchase) {
      throw new Error(
        `Vehicle with chassis no ${chassis_no} not found for return.`
      );
    }

    const saleData = {
      chassis_no: chassis_no,
      customer_name: "RETURNED",
      sale_date: sale_date,
      sales_price: purchase.purchase_price,
      insurance_cost: 0,
      tax_registration_cost: 0,
      registration_date: null,
      payment_type: "return_vehicle",
    };

    const stmt = this.db.prepare(`INSERT INTO sales_info 
        (chassis_no, customer_name, sale_date, sales_price, insurance_cost, tax_registration_cost, registration_date, payment_type)
        VALUES (@chassis_no, @customer_name, @sale_date, @sales_price, @insurance_cost, @tax_registration_cost, @registration_date, @payment_type)`);

    return stmt.run(saleData);
  }

  // --- Read Operations ---
  getVehicleByChassis(chassisNo) {
    const stmt = this.db.prepare(`
          SELECT p.*, s.customer_name, s.sale_date, s.sales_price, s.insurance_cost, s.tax_registration_cost, s.registration_date, s.payment_type
          FROM purchase_info p
          LEFT JOIN sales_info s ON p.chassis_no = s.chassis_no
          WHERE p.chassis_no = ?
      `);
    return stmt.get(chassisNo);
  }

  getAvailableVehicles() {
    const stmt = this.db.prepare(`SELECT * FROM purchase_info 
        WHERE chassis_no NOT IN (SELECT chassis_no FROM sales_info)
        ORDER BY purchase_date DESC`);
    return stmt.all();
  }

  getProfitReport(filters = {}) {
    let sql = "SELECT * FROM vehicle_profit_view WHERE 1=1";
    const params = [];

    if (filters.payment_type) {
      sql += " AND payment_type = ?";
      params.push(filters.payment_type);
    }
    if (filters.month) {
      sql += ' AND strftime("%m", sale_date) = ?';
      params.push(filters.month.padStart(2, "0"));
    }
    if (filters.year) {
      sql += ' AND strftime("%Y", sale_date) = ?';
      params.push(filters.year);
    }
    if (filters.model_name) {
      sql += " AND model_name LIKE ?";
      params.push(`%${filters.model_name}%`);
    }

    sql += " ORDER BY sale_date DESC";
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  getDashboardData() {
    const queries = {
      totalVehicles: "SELECT COUNT(*) as count FROM purchase_info",
      availableVehicles:
        "SELECT COUNT(*) as count FROM purchase_info WHERE chassis_no NOT IN (SELECT chassis_no FROM sales_info)",
      soldVehicles:
        "SELECT COUNT(*) as count FROM sales_info WHERE payment_type != 'return_vehicle'",
      totalProfit:
        "SELECT SUM(profit) as total FROM vehicle_profit_view WHERE payment_type != 'return_vehicle'",
    };

    const results = {};
    for (const key in queries) {
      results[key] = this.db.prepare(queries[key]).get();
    }
    return results;
  }

  searchVehicles(searchTerm) {
    const stmt = this.db.prepare(`
        SELECT p.*, s.customer_name, s.sale_date, s.payment_type
        FROM purchase_info p
        LEFT JOIN sales_info s ON p.chassis_no = s.chassis_no
        WHERE p.chassis_no LIKE ? OR p.model_name LIKE ? OR s.customer_name LIKE ?
        ORDER BY p.purchase_date DESC`);
    const searchPattern = `%${searchTerm}%`;
    return stmt.all(searchPattern, searchPattern, searchPattern);
  }

  getDatabasePath() {
    return this.dbPath;
  }

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
