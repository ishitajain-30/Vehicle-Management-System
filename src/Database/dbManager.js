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
        tax_cost REAL,
        registration_cost REAL,
        other_expense_cost REAL,
        registration_date TEXT,
        payment_type TEXT CHECK (payment_type IN ('cash', 'disbursment', 'cheque','bank_transfer', 'return_vehicle')),
        FOREIGN KEY (chassis_no) REFERENCES purchase_info(chassis_no) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin','staff')),
        is_active INTEGER NOT NULL DEFAULT 1
      )`,
      `DROP TRIGGER IF EXISTS trg_return_vehicle_delete`,
      `DROP VIEW IF EXISTS vehicle_profit_view`,
      // MODIFIED: Updated view to set profit to 0 for returned vehicles.
      `CREATE VIEW vehicle_profit_view AS
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
        s.tax_cost,
        s.registration_cost,
        s.other_expense_cost,
        CASE
            WHEN s.payment_type = 'return_vehicle' THEN 0
            ELSE (s.sales_price - (p.purchase_price + COALESCE(p.transport_cost, 0) + 
            COALESCE(p.accessories_cost, 0) + COALESCE(s.insurance_cost, 0) + COALESCE(s.tax_cost, 0) + COALESCE(s.registration_cost, 0) + COALESCE(s.other_expense_cost, 0)))

        END AS profit,
        CASE
            WHEN s.payment_type = 'return_vehicle' THEN 0
            WHEN (p.purchase_price + COALESCE(p.transport_cost, 0) + COALESCE(p.accessories_cost, 0) + COALESCE(s.insurance_cost, 0) + COALESCE(s.tax_cost, 0) + COALESCE(s.registration_cost, 0) + COALESCE(s.other_expense_cost, 0)) = 0 THEN 0
            ELSE ROUND(
                ((s.sales_price - (p.purchase_price + COALESCE(p.transport_cost, 0) + COALESCE(p.accessories_cost, 0) + COALESCE(s.insurance_cost, 0) + COALESCE(s.tax_cost, 0) + COALESCE(s.registration_cost, 0) + COALESCE(s.other_expense_cost, 0))) * 100.0) /
                (p.purchase_price + COALESCE(p.transport_cost, 0) + COALESCE(p.accessories_cost, 0) + COALESCE(s.insurance_cost, 0) + COALESCE(s.tax_cost, 0) + COALESCE(s.registration_cost, 0) + COALESCE(s.other_expense_cost, 0)), 2
            )
        END AS profit_percentage
      FROM purchase_info p
      JOIN sales_info s ON p.chassis_no = s.chassis_no`,
    ];

    try {
      this.db.transaction(() => {
        createTables.forEach((sql) => this.db.exec(sql));
      })();
      this._migrateSalesSchema();
      this._migrateRbacSchema();
      console.log("Database tables and views created/updated successfully");
      this._initializeRbacDefaults();
    } catch (err) {
      console.error("Error creating tables/views:", err.message);
      throw err;
    }
  }

  // --- RBAC bootstrap: roles and default admin user ---
  _migrateSalesSchema() {
    const salesTable = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sales_info'"
      )
      .get();
    if (!salesTable) return;

    const columns = this.db.prepare("PRAGMA table_info(sales_info)").all();
    const colNames = new Set(columns.map((c) => c.name));

    this.db.transaction(() => {
      if (!colNames.has("insurance_cost")) {
        this.db.exec("ALTER TABLE sales_info ADD COLUMN insurance_cost REAL");
      }
      if (!colNames.has("tax_cost")) {
        this.db.exec("ALTER TABLE sales_info ADD COLUMN tax_cost REAL");
      }
      if (!colNames.has("registration_cost")) {
        this.db.exec("ALTER TABLE sales_info ADD COLUMN registration_cost REAL");
      }
      if (!colNames.has("other_expense_cost")) {
        this.db.exec(
          "ALTER TABLE sales_info ADD COLUMN other_expense_cost REAL"
        );
      }
      if (!colNames.has("registration_date")) {
        this.db.exec("ALTER TABLE sales_info ADD COLUMN registration_date TEXT");
      }
      this.db.exec(
        "UPDATE sales_info SET insurance_cost = 0 WHERE insurance_cost IS NULL"
      );
      this.db.exec("UPDATE sales_info SET tax_cost = 0 WHERE tax_cost IS NULL");
      this.db.exec(
        "UPDATE sales_info SET registration_cost = 0 WHERE registration_cost IS NULL"
      );
      this.db.exec(
        "UPDATE sales_info SET other_expense_cost = 0 WHERE other_expense_cost IS NULL"
      );
    })();
  }

  _migrateRbacSchema() {
    const usersTable = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'"
      )
      .get();
    if (!usersTable) return;

    const columns = this.db.prepare("PRAGMA table_info(users)").all();
    const colNames = new Set(columns.map((c) => c.name));
    const usersTableSql = this.db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get();
    const allowsEmployeeRole = !!usersTableSql?.sql?.includes("'employee'");
    const canonicalStaffRole = allowsEmployeeRole ? "employee" : "staff";

    this.db.transaction(() => {
      if (!colNames.has("password")) {
        this.db.exec("ALTER TABLE users ADD COLUMN password TEXT");
      }
      if (!colNames.has("role")) {
        this.db.exec("ALTER TABLE users ADD COLUMN role TEXT");
      }
      if (!colNames.has("is_active")) {
        this.db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
      }
      // Map role_id-based legacy records into role text.
      if (colNames.has("role_id")) {
        this.db.exec(
          `UPDATE users SET role = CASE WHEN role_id = 1 THEN 'admin' ELSE '${canonicalStaffRole}' END WHERE role IS NULL OR role = ''`
        );
      }
      if (allowsEmployeeRole) {
        this.db.exec("UPDATE users SET role = 'employee' WHERE LOWER(role) = 'staff'");
      } else {
        this.db.exec("UPDATE users SET role = 'staff' WHERE LOWER(role) = 'employee'");
      }
      this.db.exec(
        `UPDATE users SET role = '${canonicalStaffRole}' WHERE role IS NULL OR role = ''`
      );
      this.db.exec(
        "UPDATE users SET password = CASE WHEN LOWER(username) = 'admin' THEN 'admin123' ELSE 'staff123' END WHERE password IS NULL OR password = ''"
      );
      this.db.exec("UPDATE users SET is_active = 1 WHERE is_active IS NULL");
    })();
  }

  _initializeRbacDefaults() {
    try {
      const cols = this.db.prepare("PRAGMA table_info(users)").all();
      const colNames = new Set(cols.map((c) => c.name));
      const hasRoleId = colNames.has("role_id");
      const hasPasswordHash = colNames.has("password_hash");
      const usersTableSql = this.db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
        .get();
      const allowsEmployeeRole = !!usersTableSql?.sql?.includes("'employee'");
      const staffRoleValue = allowsEmployeeRole ? "employee" : "staff";

      // Keep only admin and staff users as requested.
      this.db
        .prepare("DELETE FROM users WHERE LOWER(username) NOT IN ('admin', 'staff')")
        .run();

      const upsertUser = (username, password, roleText) => {
        const existing = this.db
          .prepare("SELECT id FROM users WHERE LOWER(username) = ?")
          .get(username);
        if (existing) {
          const sets = ["username = ?", "password = ?", "role = ?", "is_active = 1"];
          const values = [username, password, roleText];
          if (hasRoleId) {
            sets.push("role_id = ?");
            values.push(roleText === "admin" ? 1 : 2);
          }
          if (hasPasswordHash) {
            sets.push("password_hash = NULL");
          }
          values.push(existing.id);
          this.db
            .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
            .run(...values);
        } else {
          const fields = ["username", "password", "role", "is_active"];
          const placeholders = ["?", "?", "?", "1"];
          const values = [username, password, roleText];
          if (hasRoleId) {
            fields.push("role_id");
            placeholders.push("?");
            values.push(roleText === "admin" ? 1 : 2);
          }
          if (hasPasswordHash) {
            fields.push("password_hash");
            placeholders.push("NULL");
          }
          this.db
            .prepare(
              `INSERT INTO users (${fields.join(", ")}) VALUES (${placeholders.join(
                ", "
              )})`
            )
            .run(...values);
        }
      };

      upsertUser("admin", "admin123", "admin");
      upsertUser("staff", "staff123", staffRoleValue);
    } catch (err) {
      console.error("Error initializing RBAC defaults:", err.message);
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

  // --- Auth / Users ---

  getUserByUsername(username) {
    const cols = this.db.prepare("PRAGMA table_info(users)").all();
    const colNames = new Set(cols.map((c) => c.name));
    if (colNames.has("role")) {
      return this.db
        .prepare(
          `SELECT id, username, password,
           CASE WHEN LOWER(role) = 'employee' THEN 'staff' ELSE role END AS role,
           is_active
           FROM users WHERE LOWER(username) = LOWER(?)`
        )
        .get(username);
    }
    return this.db
      .prepare(
        `SELECT u.id, u.username, u.password, u.is_active,
         CASE WHEN u.role_id = 1 THEN 'admin' ELSE 'staff' END as role
         FROM users u
         WHERE LOWER(u.username) = LOWER(?)`
      )
      .get(username);
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
      data.tax_cost = 0;
      data.registration_cost = 0;
      data.other_expense_cost = 0;
      data.registration_date = null;
    }

    const stmt = this.db.prepare(`INSERT INTO sales_info 
        (chassis_no, customer_name, sale_date, sales_price, insurance_cost, tax_cost, registration_cost, other_expense_cost, registration_date, payment_type)
        VALUES (@chassis_no, @customer_name, @sale_date, @sales_price, @insurance_cost, @tax_cost, @registration_cost, @other_expense_cost, @registration_date, @payment_type)`);

    return stmt.run({
      ...data,
      insurance_cost: data.insurance_cost || 0,
      tax_cost: data.tax_cost || 0,
      registration_cost: data.registration_cost || 0,
      other_expense_cost: data.other_expense_cost || 0,
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
        tax_cost = @tax_cost,
        registration_cost = @registration_cost,
        other_expense_cost = @other_expense_cost,
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
      tax_cost: 0,
      registration_cost: 0,
      other_expense_cost: 0,
      registration_date: null,
      payment_type: "return_vehicle",
    };

    const stmt = this.db.prepare(`INSERT INTO sales_info 
        (chassis_no, customer_name, sale_date, sales_price, insurance_cost, tax_cost,registration_cost, other_expense_cost,registration_date, payment_type)
        VALUES (@chassis_no, @customer_name, @sale_date, @sales_price, @insurance_cost, @tax_cost, @registration_cost, @other_expense_cost, @registration_date, @payment_type)`);

    return stmt.run(saleData);
  }

  // --- Read Operations ---
  getVehicleByChassis(chassisNo) {
    const stmt = this.db.prepare(`
          SELECT p.*, s.customer_name, s.sale_date, s.sales_price, s.insurance_cost, s.tax_cost,s.registration_cost, s.other_expense_cost, s.registration_date, s.payment_type
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
