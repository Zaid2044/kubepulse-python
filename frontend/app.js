/**
 * app.js — Inventory Management System Frontend
 *
 * Handles all API communication, UI rendering, sorting, pagination,
 * filtering, modals, toasts, and form validation.
 *
 * Uses vanilla JavaScript only — no frameworks required.
 */

// ─── Configuration ────────────────────────────────────────────────────────────
// API_BASE is empty because Nginx proxies /api/* to the Flask backend.
// In development (without Docker), change this to: "http://localhost:5000"
const API_BASE = "";

// ─── Application State ────────────────────────────────────────────────────────
const state = {
  products: [],         // Full list of products from the API
  filtered: [],         // Products after search/category filter
  sortField: "created_at",
  sortDir: "desc",      // "asc" or "desc"
  page: 1,
  pageSize: 10,
  editingId: null,      // Product ID being edited (null = creating new)
  deleteId: null,       // Product ID pending deletion
};

// ─── DOM References ───────────────────────────────────────────────────────────
const tableBody       = document.getElementById("productTableBody");
const globalSearch    = document.getElementById("globalSearch");
const categoryFilter  = document.getElementById("categoryFilter");
const headerCount     = document.getElementById("headerProductCount");
const tableCount      = document.getElementById("tableCount");
const paginationInfo  = document.getElementById("paginationInfo");
const paginationCtrls = document.getElementById("paginationControls");

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();

  // Wire up live search
  globalSearch.addEventListener("input", () => {
    state.page = 1;
    applyFilters();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// API CALLS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetches all products from the API and re-renders the table.
 */
async function loadProducts() {
  showSkeletonRows();

  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    state.products = json.data || [];
    state.page = 1;

    updateCategoryFilter();
    applyFilters();
    updateStats();
    updateHeaderCount();

  } catch (err) {
    console.error("Failed to load products:", err);
    showError("Could not connect to the server. Is the backend running?");
    tableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-icon">🔌</div>
            <div class="empty-title">Connection failed</div>
            <div class="empty-description">
              Could not reach the API. Make sure the backend container is running.
            </div>
            <button class="btn btn-primary" onclick="loadProducts()">
              <i class="fa-solid fa-arrows-rotate"></i> Retry
            </button>
          </div>
        </td>
      </tr>`;
  }
}

/**
 * Saves a product (POST for new, PUT for edit).
 */
async function saveProduct() {
  if (!validateForm()) return;

  const payload = {
    name:        document.getElementById("inputName").value.trim(),
    description: document.getElementById("inputDescription").value.trim(),
    category:    document.getElementById("inputCategory").value.trim(),
    quantity:    parseInt(document.getElementById("inputQuantity").value, 10),
    price:       parseFloat(document.getElementById("inputPrice").value),
  };

  const isEdit = state.editingId !== null;
  const url    = isEdit ? `${API_BASE}/api/products/${state.editingId}` : `${API_BASE}/api/products`;
  const method = isEdit ? "PUT" : "POST";

  // Show loading state on the save button
  const saveBtn  = document.getElementById("saveBtn");
  const saveTxt  = document.getElementById("saveBtnText");
  saveBtn.disabled = true;
  saveTxt.innerHTML = `<span class="loading-spinner"></span> Saving…`;

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to save product.");
    }

    closeModal("productModal");
    await loadProducts();
    showSuccess(isEdit ? `"${payload.name}" updated successfully.` : `"${payload.name}" added to inventory.`);

  } catch (err) {
    showError(err.message || "Something went wrong. Please try again.");
  } finally {
    saveBtn.disabled = false;
    saveTxt.textContent = isEdit ? "Save Changes" : "Save Product";
  }
}

/**
 * Sends a DELETE request for the product pending deletion.
 */
async function confirmDelete() {
  if (!state.deleteId) return;

  const btn = document.getElementById("confirmDeleteBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="loading-spinner"></span> Deleting…`;

  try {
    const res  = await fetch(`${API_BASE}/api/products/${state.deleteId}`, { method: "DELETE" });
    const json = await res.json();

    if (!res.ok || !json.success) throw new Error(json.message || "Delete failed.");

    closeModal("deleteModal");
    await loadProducts();
    showSuccess(json.data?.message || "Product deleted.");

  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-trash"></i> Delete`;
    state.deleteId = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILTERING, SORTING, PAGINATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Applies search term and category filter to state.products,
 * then re-renders the table.
 */
function applyFilters() {
  const search   = globalSearch.value.toLowerCase().trim();
  const category = categoryFilter.value.toLowerCase();

  state.filtered = state.products.filter(p => {
    const matchSearch = !search
      || p.name.toLowerCase().includes(search)
      || (p.description || "").toLowerCase().includes(search)
      || (p.category    || "").toLowerCase().includes(search);

    const matchCat = !category
      || (p.category || "").toLowerCase() === category;

    return matchSearch && matchCat;
  });

  // Apply current sort
  sortData();

  renderTable();
  renderPagination();
  updateTableCount();
}

/** Sorts state.filtered in-place by state.sortField and state.sortDir */
function sortData() {
  const { sortField, sortDir } = state;
  const dir = sortDir === "asc" ? 1 : -1;

  state.filtered.sort((a, b) => {
    let va, vb;

    if (sortField === "value") {
      va = a.quantity * a.price;
      vb = b.quantity * b.price;
    } else {
      va = a[sortField];
      vb = b[sortField];
    }

    // Handle nulls — push them to end
    if (va == null) return 1;
    if (vb == null) return -1;

    if (typeof va === "string") {
      return va.localeCompare(vb) * dir;
    }
    return (va - vb) * dir;
  });
}

/** Handles clicking a column header to sort */
function sortTable(field) {
  if (state.sortField === field) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sortField = field;
    state.sortDir   = "asc";
  }

  // Update sort icon classes
  document.querySelectorAll("th").forEach(th => {
    th.classList.remove("sort-asc", "sort-desc");
  });
  const icons = document.querySelectorAll(".sort-icon");
  icons.forEach(i => {
    i.className = "sort-icon fa-solid fa-sort";
  });

  const icon = document.getElementById(`sort-${field}`);
  if (icon) {
    icon.className = `sort-icon fa-solid fa-sort-${state.sortDir === "asc" ? "up" : "down"}`;
    icon.closest("th").classList.add(`sort-${state.sortDir}`);
  }

  state.page = 1;
  applyFilters();
}

function toggleSort() {
  // Toggle between newest and oldest as a quick shortcut
  state.sortField = "created_at";
  state.sortDir   = state.sortDir === "desc" ? "asc" : "desc";
  sortTable("created_at");
}

function filterByCategory() {
  state.page = 1;
  applyFilters();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Renders the current page of filtered/sorted products into the table.
 */
function renderTable() {
  if (state.filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <div class="empty-title">No products found</div>
            <div class="empty-description">
              ${globalSearch.value
                ? "No products match your search. Try a different term."
                : "Your inventory is empty. Add your first product to get started."}
            </div>
            <button class="btn btn-primary" onclick="openAddModal()">
              <i class="fa-solid fa-plus"></i> Add Product
            </button>
          </div>
        </td>
      </tr>`;
    return;
  }

  const start    = (state.page - 1) * state.pageSize;
  const paginated = state.filtered.slice(start, start + state.pageSize);

  tableBody.innerHTML = paginated.map(p => buildRow(p)).join("");
}

/** Builds one table row HTML string for a product */
function buildRow(p) {
  const value       = p.quantity * p.price;
  const updatedDate = formatDate(p.updated_at);

  // Quantity color coding
  let qtyClass = "quantity-ok";
  if      (p.quantity === 0)  qtyClass = "quantity-low";
  else if (p.quantity <= 5)   qtyClass = "quantity-low";
  else if (p.quantity <= 15)  qtyClass = "quantity-med";

  const categoryHTML = p.category
    ? `<span class="category-badge">${escapeHtml(p.category)}</span>`
    : `<span style="color:var(--color-text-muted); font-size:0.8rem;">—</span>`;

  const descHTML = p.description
    ? `<div class="product-desc" title="${escapeHtml(p.description)}">${escapeHtml(p.description)}</div>`
    : "";

  return `
    <tr>
      <td>
        <div class="product-name">${escapeHtml(p.name)}</div>
        ${descHTML}
      </td>
      <td>${categoryHTML}</td>
      <td class="hide-mobile">
        <span class="quantity-cell ${qtyClass}">${p.quantity.toLocaleString()}</span>
      </td>
      <td>
        <span class="price-cell">$${p.price.toFixed(2)}</span>
      </td>
      <td class="hide-mobile">
        <span class="value-cell">$${value.toFixed(2)}</span>
      </td>
      <td class="date-cell hide-mobile">${updatedDate}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-ghost btn-icon"
                  title="Edit product"
                  onclick="openEditModal(${p.id})">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-icon"
                  title="Delete product"
                  style="color:var(--color-danger); background:var(--color-danger-light);"
                  onclick="openDeleteModal(${p.id}, '${escapeHtml(p.name).replace(/'/g, "\\'")}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

/** Shows skeleton loading rows while data is being fetched */
function showSkeletonRows() {
  const skeletonRow = (widths) => `
    <tr class="skeleton-row">
      ${widths.map(w => `
        <td><div class="skeleton-line" style="width:${w}; height:14px;"></div></td>
      `).join("")}
    </tr>`;

  tableBody.innerHTML = Array.from({ length: 6 }, () =>
    skeletonRow(["70%", "50%", "30%", "40%", "45%", "55%", "60px"])
  ).join("");
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS & BADGES
// ═══════════════════════════════════════════════════════════════════════════════

function updateStats() {
  const products = state.products;
  const total    = products.length;
  const value    = products.reduce((s, p) => s + p.quantity * p.price, 0);
  const lowStock = products.filter(p => p.quantity <= 5).length;
  const cats     = new Set(products.map(p => p.category).filter(Boolean)).size;

  animateNumber("statTotal",      total);
  animateValue ("statValue",      value);
  animateNumber("statLowStock",   lowStock);
  animateNumber("statCategories", cats);
}

function updateHeaderCount() {
  headerCount.textContent = state.products.length;
}

function updateTableCount() {
  const n = state.filtered.length;
  tableCount.textContent = `${n} item${n !== 1 ? "s" : ""}`;
}

/** Populates the category filter dropdown from unique categories */
function updateCategoryFilter() {
  const categories = [...new Set(
    state.products.map(p => p.category).filter(Boolean)
  )].sort();

  const current = categoryFilter.value;

  // Rebuild options
  categoryFilter.innerHTML = `<option value="">All Categories</option>`;
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    if (cat === current) opt.selected = true;
    categoryFilter.appendChild(opt);
  });

  // Also update datalist for the form input
  const dl = document.getElementById("categoryList");
  dl.innerHTML = categories.map(c => `<option value="${escapeHtml(c)}">`).join("");
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════════════════════════════

function renderPagination() {
  const total    = state.filtered.length;
  const pages    = Math.ceil(total / state.pageSize);
  const start    = (state.page - 1) * state.pageSize + 1;
  const end      = Math.min(state.page * state.pageSize, total);

  paginationInfo.textContent = total === 0
    ? "No results"
    : `Showing ${start}–${end} of ${total}`;

  if (pages <= 1) {
    paginationCtrls.innerHTML = "";
    return;
  }

  let html = `
    <button class="page-btn"
            onclick="goToPage(${state.page - 1})"
            ${state.page === 1 ? "disabled" : ""}>
      <i class="fa-solid fa-chevron-left"></i>
    </button>`;

  // Show at most 5 page buttons
  const range = pageRange(state.page, pages, 5);
  range.forEach(p => {
    if (p === "…") {
      html += `<span style="padding:0 var(--space-2);color:var(--color-text-muted)">…</span>`;
    } else {
      html += `<button class="page-btn ${p === state.page ? "active" : ""}"
                       onclick="goToPage(${p})">${p}</button>`;
    }
  });

  html += `
    <button class="page-btn"
            onclick="goToPage(${state.page + 1})"
            ${state.page === pages ? "disabled" : ""}>
      <i class="fa-solid fa-chevron-right"></i>
    </button>`;

  paginationCtrls.innerHTML = html;
}

function goToPage(page) {
  const pages = Math.ceil(state.filtered.length / state.pageSize);
  if (page < 1 || page > pages) return;
  state.page = page;
  renderTable();
  renderPagination();
  // Scroll table into view smoothly
  document.querySelector(".table-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Generates an array of page numbers with ellipsis for large page counts */
function pageRange(current, total, delta = 5) {
  const range  = [];
  const left   = Math.max(1, current - Math.floor(delta / 2));
  const right  = Math.min(total, left + delta - 1);

  for (let i = left; i <= right; i++) range.push(i);

  if (left > 1) {
    if (left > 2) range.unshift("…");
    range.unshift(1);
  }
  if (right < total) {
    if (right < total - 1) range.push("…");
    range.push(total);
  }

  return range;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════

function openModal(id) {
  document.getElementById(id).classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  document.body.style.overflow = "";
}

/** Opens the Add Product modal with a blank form */
function openAddModal() {
  state.editingId = null;
  resetForm();
  document.getElementById("modalTitle").textContent = "Add Product";
  document.getElementById("saveBtnText").textContent = "Save Product";
  openModal("productModal");
  setTimeout(() => document.getElementById("inputName").focus(), 100);
}

/** Opens the Edit Product modal pre-filled with product data */
function openEditModal(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;

  state.editingId = id;
  resetForm();

  document.getElementById("modalTitle").textContent     = "Edit Product";
  document.getElementById("saveBtnText").textContent    = "Save Changes";
  document.getElementById("inputName").value        = product.name        || "";
  document.getElementById("inputDescription").value = product.description || "";
  document.getElementById("inputCategory").value    = product.category    || "";
  document.getElementById("inputQuantity").value    = product.quantity;
  document.getElementById("inputPrice").value       = product.price.toFixed(2);

  openModal("productModal");
  setTimeout(() => document.getElementById("inputName").focus(), 100);
}

/** Opens the Delete confirmation modal */
function openDeleteModal(id, name) {
  state.deleteId = id;
  document.getElementById("deleteProductName").textContent = `"${name}"`;
  openModal("deleteModal");
}

/** Resets form fields and clears validation errors */
function resetForm() {
  ["inputName", "inputDescription", "inputCategory", "inputQuantity", "inputPrice"]
    .forEach(id => {
      const el = document.getElementById(id);
      el.value = "";
      el.classList.remove("error");
    });
  ["errorName", "errorQuantity", "errorPrice"].forEach(id => {
    document.getElementById(id).textContent = "";
  });
}

// Close modal when clicking outside
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Close modal with Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    ["productModal", "deleteModal"].forEach(id => {
      const el = document.getElementById(id);
      if (el.classList.contains("open")) closeModal(id);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FORM VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Client-side form validation before submitting.
 * Returns true if valid, false otherwise.
 */
function validateForm() {
  let valid = true;

  // Name
  const name = document.getElementById("inputName");
  if (!name.value.trim()) {
    setFieldError("inputName", "errorName", "Product name is required.");
    valid = false;
  } else {
    clearFieldError("inputName", "errorName");
  }

  // Quantity
  const qty = document.getElementById("inputQuantity");
  if (qty.value === "") {
    setFieldError("inputQuantity", "errorQuantity", "Quantity is required.");
    valid = false;
  } else if (parseInt(qty.value, 10) < 0) {
    setFieldError("inputQuantity", "errorQuantity", "Quantity cannot be negative.");
    valid = false;
  } else {
    clearFieldError("inputQuantity", "errorQuantity");
  }

  // Price
  const price = document.getElementById("inputPrice");
  if (price.value === "") {
    setFieldError("inputPrice", "errorPrice", "Price is required.");
    valid = false;
  } else if (parseFloat(price.value) < 0) {
    setFieldError("inputPrice", "errorPrice", "Price cannot be negative.");
    valid = false;
  } else {
    clearFieldError("inputPrice", "errorPrice");
  }

  return valid;
}

function setFieldError(inputId, errorId, message) {
  document.getElementById(inputId).classList.add("error");
  document.getElementById(errorId).textContent = message;
}

function clearFieldError(inputId, errorId) {
  document.getElementById(inputId).classList.remove("error");
  document.getElementById(errorId).textContent = "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOASTS
// ═══════════════════════════════════════════════════════════════════════════════

function showSuccess(msg) { showToast(msg, "success"); }
function showError(msg)   { showToast(msg, "error"); }

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const icons = { success: "✅", error: "❌", info: "ℹ️" };

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Escapes HTML to prevent XSS in rendered content */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/** Formats an ISO timestamp string to a human-readable relative or short date */
function formatDate(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  const now   = new Date();
  const diffMs = now - date;
  const diffM  = Math.floor(diffMs / 60000);
  const diffH  = Math.floor(diffM  / 60);
  const diffD  = Math.floor(diffH  / 24);

  if (diffM < 1)  return "just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7)  return `${diffD}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Animates a stat counter from 0 to the target number.
 * Creates a satisfying counting effect on first load.
 */
function animateNumber(elementId, target) {
  const el      = document.getElementById(elementId);
  const start   = 0;
  const duration = 600;
  const step    = 16;
  const steps   = duration / step;
  const inc     = (target - start) / steps;
  let current   = start;

  const timer = setInterval(() => {
    current += inc;
    if (current >= target) {
      clearInterval(timer);
      el.textContent = Math.round(target).toLocaleString();
    } else {
      el.textContent = Math.round(current).toLocaleString();
    }
  }, step);
}

/** Same as animateNumber but formats as currency ($1,234.56) */
function animateValue(elementId, target) {
  const el      = document.getElementById(elementId);
  const duration = 600;
  const step    = 16;
  const steps   = duration / step;
  const inc     = target / steps;
  let current   = 0;

  // If value is large, shorten it (e.g. $12.4K)
  const fmt = (n) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000)    return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  const timer = setInterval(() => {
    current += inc;
    if (current >= target) {
      clearInterval(timer);
      el.textContent = fmt(target);
    } else {
      el.textContent = fmt(current);
    }
  }, step);
}
