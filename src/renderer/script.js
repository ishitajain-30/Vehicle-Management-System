const { ipcRenderer } = require("electron");
let dashboardData = {};

// --- Theme Switcher Logic ---
function setTheme(theme) {
  const lightBtn = document.getElementById("theme-toggle-light");
  const darkBtn = document.getElementById("theme-toggle-dark");
  if (theme === "dark") {
    document.documentElement.classList.add("dark-mode");
    darkBtn.classList.add("active");
    lightBtn.classList.remove("active");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark-mode");
    lightBtn.classList.add("active");
    darkBtn.classList.remove("active");
    localStorage.setItem("theme", "light");
  }
}

// --- Core App Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  // Theme initialization
  const lightBtn = document.getElementById("theme-toggle-light");
  const darkBtn = document.getElementById("theme-toggle-dark");
  const currentTheme = document.documentElement.classList.contains("dark-mode");
  setTheme(currentTheme ? "dark" : "light");

  lightBtn.addEventListener("click", () => setTheme("light"));
  darkBtn.addEventListener("click", () => setTheme("dark"));

  // App initialization
  loadDashboard();
  loadAvailableVehicles();
  populateYearFilter();
  renderForms();

  // Form submit listeners
  document
    .getElementById("purchaseForm")
    .addEventListener("submit", handlePurchaseSubmit);
  document
    .getElementById("saleForm")
    .addEventListener("submit", handleSaleSubmit);
  document
    .getElementById("editPurchaseForm")
    .addEventListener("submit", handleUpdatePurchase);
  document
    .getElementById("editSaleForm")
    .addEventListener("submit", handleUpdateSale);

  // Global search listener
  let searchTimeout;
  document.getElementById("globalSearch").addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(handleGlobalSearch, 300);
  });
});

// --- Section Management ---
function showSection(sectionName, navElement) {
  document
    .querySelectorAll(".content-section")
    .forEach((s) => s.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
  document.getElementById(sectionName).classList.add("active");
  navElement.classList.add("active");

  const loadActions = {
    dashboard: loadDashboard,
    sale: loadAvailableVehicles,
    inventory: loadInventory,
    reports: loadReports,
  };
  if (loadActions[sectionName]) loadActions[sectionName]();
}

// --- Form Rendering ---
function renderForms() {
  // Add Purchase Form
  document.getElementById("purchaseForm").innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label for="purchaseDate">Purchase Date</label>
                <input type="date" id="purchaseDate" name="purchase_date" required />
            </div>
            <div class="form-group">
                <label for="modelName">Model Name</label>
                <input type="text" id="modelName" name="model_name" placeholder="Pulsar 200" required />
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="chassisNo">Chassis Number</label>
                <input type="text" id="chassisNo" name="chassis_no" placeholder="Unique chassis number" required />
            </div>
            <div class="form-group">
                <label for="color">Color</label>
                <input type="text" id="color" name="color" placeholder="e.g., Red, Blue" />
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="purchasePrice">Purchase Price (₹)</label>
                <input type="number" id="purchasePrice" name="purchase_price" step="0.01" placeholder="0.00" required />
            </div>
            <div class="form-group">
                <label for="transportCost">Transport Cost (₹)</label>
                <input type="number" id="transportCost" name="transport_cost" step="0.01" placeholder="0.00" />
            </div>
        </div>
        <div class="form-group">
            <label for="accessoriesCost">Accessories Cost (₹)</label>
            <input type="number" id="accessoriesCost" name="accessories_cost" step="0.01" placeholder="0.00" />
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">Add Purchase</button>
        </div>`;
  document.getElementById("purchaseDate").valueAsDate = new Date();

  // Add Sale Form
  document.getElementById("saleForm").innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label for="saleChassisNo">Select Vehicle</label>
                <select id="saleChassisNo" name="chassis_no" required></select>
            </div>
            <div class="form-group">
                <label for="saleDate">Sale Date</label>
                <input type="date" id="saleDate" name="sale_date" required />
            </div>
            <div class="form-group">
                <label for="customerName">Customer Name</label>
                <input type="text" id="customerName" name="customer_name" placeholder="Customer full name"/>
            </div>
        </div>
        <div class="form-group">
            <label for="paymentType">Payment Type</label>
            <select id="paymentType" name="payment_type" onchange="toggleSaleFields(this.value)">
                <option value="cash">Cash</option>
                <option value="disbursment">Disbursement</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="bank_transfer">Cheque</option>
                <option value="return_vehicle">Return Vehicle</option>
            </select>
        </div>
        <div id="sale-fields-wrapper">
            <div class="form-row">
               
                <div class="form-group">
                    <label for="salesPrice">Sale Price (₹)</label>
                    <input type="number" id="salesPrice" name="sales_price" step="0.01" placeholder="0.00" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="insuranceCost">Insurance Cost (₹)</label>
                    <input type="number" id="insuranceCost" name="insurance_cost" step="0.01" placeholder="0.00" />
                </div>
                <div class="form-group">
                    <label for="taxCost">Tax Cost (₹)</label>
                    <input type="number" id="taxCost" name="tax_cost" step="0.01" placeholder="0.00" />
                </div>
                <div class="form-group">
                    <label for="registrationCost">Registration Cost (₹)</label>
                    <input type="number" id="registrationCost" name="registration_cost" step="0.01" placeholder="0.00" />
                </div>
                <div class="form-group">
                    <label for="otherExpenseCost">Other Expense Cost (₹)</label>
                    <input type="number" id="otherExpenseCost" name="other_expense_cost" step="0.01" placeholder="0.00" />
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="registrationDate">Registration Date</label>
                    <input type="date" id="registrationDate" name="registration_date" />
                </div>
                <div class="form-group"></div>
            </div>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">Add Sale</button>
        </div>`;
  document.getElementById("saleDate").valueAsDate = new Date();
}

function toggleSaleFields(paymentType) {
  const wrapper = document.getElementById("sale-fields-wrapper");
  wrapper.style.display = paymentType === "return_vehicle" ? "none" : "block";
}

// --- Data Loading & Rendering ---
async function loadDashboard() {
  try {
    const result = await ipcRenderer.invoke("db-get-dashboard-data");
    if (result.success) {
      dashboardData = result.data;
      renderDashboardCards();
      handleGlobalSearch(); // To populate the table initially
    } else {
      showMessage(
        "Error",
        `Failed to load dashboard data: ${result.error}`,
        "error"
      );
    }
  } catch (error) {
    showMessage("Error", `Failed to load dashboard: ${error.message}`, "error");
  }
}

function renderDashboardCards() {
  const container = document.getElementById("dashboardCards");
  container.innerHTML = `
        <div class="dashboard-card"><h3>${
          dashboardData.totalVehicles?.count || 0
        }</h3><p>Total Vehicles</p></div>
        <div class="dashboard-card"><h3>${
          dashboardData.availableVehicles?.count || 0
        }</h3><p>Available Vehicles</p></div>
        <div class="dashboard-card"><h3>${
          dashboardData.soldVehicles?.count || 0
        }</h3><p>Sold Vehicles</p></div>
        <div class="dashboard-card"><h3>₹${(
          dashboardData.totalProfit?.total || 0
        ).toLocaleString()}</h3><p>Total Profit</p></div>`;
}

async function handleGlobalSearch() {
  const searchTerm = document.getElementById("globalSearch").value.trim();
  try {
    const result = await ipcRenderer.invoke("db-search-vehicles", searchTerm);
    if (result.success) {
      renderDashboardVehicleTable(result.data);
    } else {
      showMessage("Error", `Search failed: ${result.error}`, "error");
    }
  } catch (error) {
    showMessage("Error", `Search failed: ${error.message}`, "error");
  }
}

function renderDashboardVehicleTable(vehicles) {
  const tbody = document.getElementById("dashboardVehicleBody");
  tbody.innerHTML = "";
  if (!vehicles || vehicles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">No vehicles found.</td></tr>';
    return;
  }
  vehicles.forEach((v) => {
    const row = tbody.insertRow();
    const isSold = !!v.sale_date;
    const status = isSold
      ? v.payment_type === "return_vehicle"
        ? "Returned"
        : "Sold"
      : "Available";
    const statusClass = isSold
      ? v.payment_type === "return_vehicle"
        ? "status-returned"
        : "status-sold"
      : "status-available";

    let actions = `<button class="btn-action btn-view" onclick="openViewModal('${v.chassis_no}')">View</button>
                   <button class="btn-action btn-edit" onclick="openEditVehicleModal('${v.chassis_no}')">Edit</button>`;

    if (!isSold) {
      actions += `<button class="btn-action btn-return" onclick="confirmReturnVehicle('${v.chassis_no}')">Return</button>`;
    }

    row.innerHTML = `<td>${v.chassis_no}</td><td>${
      v.model_name
    }</td><td>${formatDate(v.purchase_date)}</td>
                       <td>${
                         v.customer_name || "-"
                       }</td><td><span class="status ${statusClass}">${status}</span></td><td class="action-buttons">${actions}</td>`;
  });
}

// --- Form Submissions (Create & Update) ---
async function handlePurchaseSubmit(e) {
  e.preventDefault();
  await submitForm(e.target, "db-add-purchase", "Purchase added successfully!");
}
async function handleSaleSubmit(e) {
  e.preventDefault();
  await submitForm(e.target, "db-add-sale", "Sale recorded successfully!");
}
// async function handleUpdatePurchase(e) {
//   e.preventDefault();
//   await submitForm(
//     e.target,
//     "db-update-purchase",
//     "Purchase updated successfully!",
//     "editPurchaseModal"
//   );
// }
// async function handleUpdateSale(e) {
//   e.preventDefault();
//   await submitForm(
//     e.target,
//     "db-update-sale",
//     "Sale updated successfully!",
//     "editSaleModal"
//   );
// }

async function handleUpdateVehicle(e) {
  e.preventDefault();
  const form = e.target;
  const formData = Object.fromEntries(new FormData(form).entries());

  try {
    // Always update purchase info
    const purchaseResult = await ipcRenderer.invoke(
      "db-update-purchase",
      formData
    );
    if (!purchaseResult.success) {
      throw new Error(
        `Failed to update purchase info: ${purchaseResult.error}`
      );
    }

    // If a sale date exists, update/insert sale info
    if (formData.sale_date) {
      const saleResult = await ipcRenderer.invoke("db-upsert-sale", formData);
      if (!saleResult.success) {
        throw new Error(`Failed to update sale info: ${saleResult.error}`);
      }
    }

    showMessage("Success", "Vehicle details updated successfully!", "success");
    closeModal("editVehicleModal");
    loadDashboard();
  } catch (error) {
    showMessage("Error", `Operation failed: ${error.message}`, "error");
  }
}

async function submitForm(
  formElement,
  ipcChannel,
  successMessage,
  modalToClose = null
) {
  const formData = Object.fromEntries(new FormData(formElement).entries());
  try {
    const result = await ipcRenderer.invoke(ipcChannel, formData);
    if (result.success) {
      showMessage("Success", successMessage, "success");
      formElement.reset();
      if (formElement.id === "purchaseForm") {
        document.getElementById("purchaseDate").valueAsDate = new Date();
      }
      if (formElement.id === "saleForm") {
        toggleSaleFields("");
        document.getElementById("saleDate").valueAsDate = new Date();
      }
      if (modalToClose) closeModal(modalToClose);
      loadDashboard();
      loadAvailableVehicles();
    } else {
      showMessage("Error", `Operation failed: ${result.error}`, "error");
    }
  } catch (error) {
    showMessage("Error", `An error occurred: ${error.message}`, "error");
  }
}

// --- Edit & View Modals ---

async function openEditVehicleModal(chassisNo) {
  const result = await ipcRenderer.invoke("db-get-vehicle", chassisNo);
  if (!result.success) {
    return showMessage("Error", result.error, "error");
  }
  const v = result.data;
  const isSold = !!v.sale_date;

  const formHTML = `
        <input type="hidden" name="chassis_no" value="${v.chassis_no}" />
        
        <h4 style="margin-top:0;">Purchase Information</h4>
        <div class="form-row">
            <div class="form-group">
                <label>Purchase Date</label>
                <input type="date" name="purchase_date" value="${formatDate(
                  v.purchase_date
                )}" required>
            </div>
            <div class="form-group">
                <label>Model Name</label>
                <input type="text" name="model_name" value="${
                  v.model_name
                }" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Color</label>
                <input type="text" name="color" value="${v.color || ""}">
            </div>
            <div class="form-group">
                <label>Purchase Price</label>
                <input type="number" name="purchase_price" value="${
                  v.purchase_price
                }" step="0.01" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Transport Cost</label>
                <input type="number" name="transport_cost" value="${
                  v.transport_cost || 0
                }" step="0.01">
            </div>
            <div class="form-group">
                <label>Accessories Cost</label>
                <input type="number" name="accessories_cost" value="${
                  v.accessories_cost || 0
                }" step="0.01">
            </div>
        </div>
        
        <hr>
        <h4>Sale Information</h4>
        <div class="form-row">
            <div class="form-group">
                <label>Sale Date</label>
                <input type="date" name="sale_date" value="${formatDate(
                  v.sale_date
                )}" ${!isSold ? "disabled" : ""}>
            </div>
            <div class="form-group">
                <label>Customer Name</label>
                <input type="text" name="customer_name" value="${
                  v.customer_name || ""
                }" ${!isSold ? "disabled" : ""}>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Sale Price</label>
                <input type="number" name="sales_price" value="${
                  v.sales_price || 0
                }" step="0.01" ${!isSold ? "disabled" : ""}>
            </div>
            <div class="form-group">
                <label>Payment Type</label>
                <select name="payment_type" ${!isSold ? "disabled" : ""}>
                    <option value="cash" ${
                      v.payment_type === "cash" ? "selected" : ""
                    }>Cash</option>
                    <option value="disbursment" ${
                      v.payment_type === "disbursment" ? "selected" : ""
                    }>Disbursement</option>
                    <option value="bank_transfer" ${
                      v.payment_type === "bank_transfer" ? "selected" : ""
                    }>Bank Transfer</option>
                    <option value="return_vehicle" ${
                      v.payment_type === "return_vehicle" ? "selected" : ""
                    }>Return Vehicle</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Insurance Cost</label>
                <input type="number" name="insurance_cost" value="${
                  v.insurance_cost || 0
                }" step="0.01" ${!isSold ? "disabled" : ""}>
            </div>
            <div class="form-group">
                <label>Tax Cost</label>
                <input type="number" name="tax_cost" value="${
                  v.tax_cost || 0
                }" step="0.01" ${!isSold ? "disabled" : ""}>
            </div>
            <div class="form-group">
                <label>Registration Cost</label>
                <input type="number" name="registration_cost" value="${
                  v.registration_cost || 0
                }" step="0.01" ${!isSold ? "disabled" : ""}>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Other Expense Cost</label>
                <input type="number" name="other_expense_cost" value="${
                  v.other_expense_cost || 0
                }" step="1" ${!isSold ? "disabled" : ""}>
            </div>
            <div class="form-group">
                <label>Registration Date</label>
                <input type="date" name="registration_date" value="${formatDate(
                  v.registration_date
                )}" ${!isSold ? "disabled" : ""}>
            </div>
        </div>
        
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
    `;

  document.getElementById("editVehicleForm").innerHTML = formHTML;
  openModal("editVehicleModal");
}

async function openViewModal(chassisNo) {
  const result = await ipcRenderer.invoke("db-get-vehicle", chassisNo);
  if (!result.success) return showMessage("Error", result.error, "error");
  const v = result.data;
  let details = `<strong>Chassis No:</strong> ${
    v.chassis_no
  }<br><strong>Model:</strong> ${
    v.model_name
  }<br><strong>Purchase Price:</strong> ₹${v.purchase_price.toLocaleString()}`;
  if (v.sale_date) {
    details += `<hr><strong>Customer:</strong> ${
      v.customer_name
    }<br><strong>Sale Price:</strong> ₹${v.sales_price.toLocaleString()}`;
  }
  showMessage("Vehicle Details", details);
}

// --- Vehicle Return ---
function confirmReturnVehicle(chassisNo) {
  showConfirm(
    "Confirm Return",
    `Are you sure you want to mark vehicle ${chassisNo} as returned? This cannot be undone.`,
    async () => {
      try {
        const result = await ipcRenderer.invoke("db-return-vehicle", {
          chassis_no: chassisNo,
          sale_date: new Date().toISOString().split("T")[0],
        });
        if (result.success) {
          showMessage(
            "Success",
            `Vehicle ${chassisNo} has been marked as returned.`,
            "success"
          );
          loadDashboard();
        } else {
          showMessage(
            "Error",
            `Failed to return vehicle: ${result.error}`,
            "error"
          );
        }
      } catch (error) {
        showMessage("Error", `An error occurred: ${error.message}`, "error");
      }
    }
  );
}

// --- Inventory & Reports Sections ---
async function loadInventory() {
  try {
    const result = await ipcRenderer.invoke("db-get-available-vehicles");
    if (result.success) {
      renderInventoryTable(result.data);
    } else {
      showMessage(
        "Error",
        "Failed to load inventory: " + result.error,
        "error"
      );
    }
  } catch (error) {
    showMessage("Error", "Failed to load inventory: " + error.message, "error");
  }
}

function renderInventoryTable(vehicles) {
  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = "";
  vehicles.forEach((vehicle) => {
    const totalCost =
      vehicle.purchase_price +
      (vehicle.transport_cost || 0) +
      (vehicle.accessories_cost || 0);
    const row = document.createElement("tr");
    row.innerHTML = `
            <td>${vehicle.chassis_no}</td>
            <td>${vehicle.model_name}</td>
            <td>${vehicle.color}</td>
            <td>${formatDate(vehicle.purchase_date)}</td>
            <td>₹${vehicle.purchase_price.toLocaleString()}</td>
            <td>₹${totalCost.toLocaleString()}</td>
            <td><span class="status status-available">Available</span></td>
        `;
    tbody.appendChild(row);
  });
}

async function loadReports() {
  applyFilters();
}

async function applyFilters() {
  const filters = {
    payment_type: document.getElementById("filterPaymentType").value,
    month: document.getElementById("filterMonth").value,
    year: document.getElementById("filterYear").value,
    model_name: document.getElementById("filterModel").value.trim(),
  };
  Object.keys(filters).forEach((key) => {
    if (!filters[key]) delete filters[key];
  });
  const result = await ipcRenderer.invoke("db-get-profit-report", filters);
  if (result.success) {
    renderReportsTable(result.data);
  } else {
    showMessage("Error", `Failed to apply filters: ${result.error}`, "error");
  }
}

function renderReportsTable(reports) {
  const tbody = document.getElementById("reportsTableBody");
  tbody.innerHTML = "";
  reports.forEach((r) => {
    const profitClass = r.profit >= 0 ? "profit-positive" : "profit-negative";
    tbody.insertRow().innerHTML = `<td>${r.chassis_no}</td><td>${
      r.model_name
    }</td><td>${r.customer_name}</td>
            <td>${formatDate(r.sale_date)}</td>
            <td>₹${r.sales_price?.toLocaleString()}</td>
            <td>₹${r.insurance_cost?.toLocaleString()}</td>
            <td>₹${r.tax_cost?.toLocaleString()}</td>
            <td>₹${r.registration_cost?.toLocaleString()}</td>
            <td>₹${r.other_expense_cost?.toLocaleString()}</td>
            <td class="${profitClass}">₹${r.profit?.toLocaleString()}</td>
            <td class="${profitClass}">${r.profit_percentage}%</td>
            <td>${r.payment_type}</td>`;
  });
}

// --- Utilities ---
async function loadAvailableVehicles() {
  try {
    const result = await ipcRenderer.invoke("db-get-available-vehicles");
    if (result.success) {
      const dropdown = document.getElementById("saleChassisNo");
      dropdown.innerHTML = '<option value="">Select chassis number...</option>';
      result.data.forEach((v) => {
        dropdown.innerHTML += `<option value="${v.chassis_no}">${v.chassis_no} - ${v.model_name}</option>`;
      });
    }
  } catch (error) {
    showMessage(
      "Error",
      "Could not load available vehicles for sale form.",
      "error"
    );
  }
}

function populateYearFilter() {
  const yearSelect = document.getElementById("filterYear");
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 10; y--) {
    yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
  }
}

function formatDate(dateString) {
  return dateString ? new Date(dateString).toISOString().split("T")[0] : "-";
}

// --- Generic Modal Logic ---
function openModal(modalId) {
  document.getElementById(modalId).style.display = "flex";
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}

function showMessage(title, message, type = "") {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalMessage").innerHTML = message;
  const modalContent = document.querySelector("#messageModal .modal-content");
  modalContent.className = "modal-content"; // reset classes
  if (type) modalContent.classList.add(type);
  openModal("messageModal");
}

function showConfirm(title, message, onConfirm) {
  document.getElementById("confirmModalTitle").textContent = title;
  document.getElementById("confirmModalMessage").textContent = message;
  const okBtn = document.getElementById("confirmOkBtn");
  const cancelBtn = document.getElementById("confirmCancelBtn");

  // A trick to remove old event listeners by replacing the button
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);

  newOkBtn.onclick = () => {
    closeModal("confirmModal");
    onConfirm();
  };
  cancelBtn.onclick = () => closeModal("confirmModal");
  openModal("confirmModal");
}

// Close modal if user clicks outside of the modal content
window.onclick = (e) => {
  if (e.target.classList.contains("modal")) {
    closeModal(e.target.id);
  }
};
