# Vehicle Management System

A complete desktop application for vehicle dealers to manage purchases, sales, inventory, and generate profit reports. Built with Electron + SQLite for easy deployment and minimal technical requirements.

## 🚀 Features

- **Purchase Management**: Add and track vehicle purchases with all costs
- **Sales Management**: Record vehicle sales with customer details and payment types
- **Inventory Tracking**: View available vehicles in stock
- **Profit Reports**: Comprehensive profit analysis with filtering options
- **Dashboard**: Real-time overview of business metrics
- **Search**: Quick search across all vehicles and customers
- **Offline Operation**: No internet required, uses local SQLite database

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js (embedded within Electron)
- **Database**: SQLite (file-based, no server required)
- **Framework**: Electron for cross-platform desktop app
- **Packaging**: Electron Builder for single executable

## 📁 Project Structure

```
vehicle-management-system/
├── src/
│   ├── main.js                 # Electron main process
│   ├── database/
│   │   └── dbManager.js        # Database operations
│   └── renderer/
│       └── index.html          # Main UI
├── assets/
│   ├── icon.ico               # App icon (Windows)
├── package.json               # Dependencies and build config
└── README.md                  # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation & Development

1. **Clone or create the project structure**

   ```bash
   mkdir vehicle-management-system
   cd frontend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm start
   ```

### Building for Distribution

#### Build for all platforms

```bash
npm run build
```

#### Build for specific platforms

```bash
# Windows
npm run build-win

# macOS
npm run build-mac

# Linux
npm run build-linux
```

### Single Executable Output

After building, you'll find the distributables in the `dist/` folder:

- **Windows**: `dist/Vehicle Management System Setup.exe` (installer) or portable executable
- **macOS**: `dist/Vehicle Management System.dmg`
- **Linux**: `dist/Vehicle Management System.AppImage`

## 📋 Database Schema

The application automatically creates the following database structure:

### Tables

1. **purchase_info**

   - purchase_date, model_name, chassis_no (unique)
   - color, purchase_price, transport_cost, accessories_cost

2. **sales_info**
   - chassis_no (FK), customer_name, sale_date, sales_price
   - insurance_cost, tax_registration_cost, registration_date, payment_type

### Views

1. **vehicle_profit_view** - Calculates profit and profit percentage per vehicle
2. **monthly_profit_summary** - Monthly aggregated profit data

### Features

- **Auto-deletion**: Vehicles marked as "return_vehicle" are automatically removed
- **Profit Calculation**: Automatic profit calculation including all costs
- **Data Integrity**: Foreign key constraints and validation

## 💼 Business Features

### Payment Types Supported

- Cash
- Disbursement
- Bank Transfer
- Return Vehicle (auto-deletes purchase record)

### Report Filters

- Payment type
- Month/Year
- Model name
- Custom date ranges

### Dashboard Metrics

- Total vehicles purchased
- Available vehicles in stock
- Sold vehicles count
- Total profit generated

## 🔧 Customization

### Adding New Fields

1. **Database**: Update schema in `src/database/dbManager.js`
2. **Frontend**: Add form fields in `src/renderer/index.html`
3. **Backend**: Update corresponding functions in `dbManager.js`

### Styling

All styles are contained in the HTML file for simplicity. Modify the `<style>` section to customize the appearance.

### Database Location

The SQLite database is automatically created in the user's data directory:

- **Windows**: `%APPDATA%/vehicle-management-system/`
- **macOS**: `~/Library/Application Support/vehicle-management-system/`
- **Linux**: `~/.config/vehicle-management-system/`

## 🚨 Important Notes

### For End Users (Non-Technical)

1. **Single File Installation**: Just download and run the installer/executable
2. **No Configuration**: Application works out of the box
3. **Automatic Backups**: Database is stored safely in user directory
4. **Offline Operation**: No internet connection required

### For Developers

1. **Icons**: Add appropriate icon files in `assets/` folder before building
2. **Code Signing**: For production, set up code signing certificates
3. **Auto-Updates**: Consider implementing auto-update functionality
4. **Error Logging**: Add comprehensive error logging for production

## 📱 User Guide

### Adding a Purchase

1. Go to "Add Purchase" tab
2. Fill in vehicle details and costs
3. Click "Add Purchase"

### Recording a Sale

1. Go to "Add Sale" tab
2. Select vehicle from dropdown (shows available vehicles only)
3. Enter customer and sale details
4. Choose payment type
5. Click "Add Sale"

### Viewing Reports

1. Go to "Reports" tab
2. Use filters to narrow down results
3. View profit margins and percentages
4. Export data (if implemented)

### Dashboard Overview

- Real-time business metrics
- Search functionality across all records
- Quick access to key information

## 🛡️ Data Security

- Local SQLite database (no cloud dependency)
- Automatic database creation and migration
- Data stored in user's protected directory
- No external network connections required

## 🤝 Support

For technical support or feature requests:

1. Check the database file location if data appears missing
2. Restart the application if experiencing issues
3. Ensure sufficient disk space for database operations

## 📄 License

MIT License - Feel free to modify and distribute as needed.

---

**Perfect for**: Small to medium vehicle dealerships, individual dealers, car rental businesses, and any business dealing with vehicle inventory management.
