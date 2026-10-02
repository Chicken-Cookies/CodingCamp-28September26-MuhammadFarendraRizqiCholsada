/**
 * app.js — Expense & Budget Visualizer
 *
 * Single IIFE encapsulating all application modules:
 *   StorageService  — localStorage read/write/probe (Tasks 4.1, 4.2)
 *   StateManager    — in-memory app state and mutations (Task 5)
 *   ChartManager    — Chart.js pie chart lifecycle (Task 6)
 *   UIController    — DOM event wiring and rendering (Tasks 7–10)
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  /**
   * Fixed 20-color palette for pie chart segments.
   * Categories are assigned a color by their index in AppState.categories modulo 20,
   * ensuring consistent, deterministic color assignment across renders.
   */
  const CATEGORY_COLORS = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#C9CBCF', '#7BC8A4', '#E7515A', '#00AB55',
    '#1C1C1E', '#5E5CE6', '#FF375F', '#30D158', '#FFD60A',
    '#0A84FF', '#BF5AF2', '#FF6B35', '#A8D8EA', '#AA96DA',
  ];

  // -------------------------------------------------------------------------
  // StorageService
  // Requirements: 5.1, 5.2, 5.4, 5.5, 10.4, 10.5
  // -------------------------------------------------------------------------

  const StorageService = {
    KEYS: {
      TRANSACTIONS: 'ebv_transactions',
      CATEGORIES:   'ebv_categories',
      THEME:        'ebv_theme',
    },

    /**
     * Probe localStorage availability by writing and immediately removing
     * a sentinel key. Never throws.
     *
     * @returns {{ ok: boolean }}
     */
    probe() {
      try {
        const PROBE_KEY = '__ebv_probe__';
        localStorage.setItem(PROBE_KEY, '1');
        localStorage.removeItem(PROBE_KEY);
        return { ok: true };
      } catch (_err) {
        return { ok: false };
      }
    },

    /**
     * Read and parse a JSON value from localStorage.
     *
     * @param {string} key
     * @returns {{ ok: boolean, data: any|null, error: string|null }}
     */
    load(key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) {
          return { ok: true, data: null, error: null };
        }
        try {
          const parsed = JSON.parse(raw);
          return { ok: true, data: parsed, error: null };
        } catch (parseErr) {
          return { ok: false, data: null, error: parseErr.message };
        }
      } catch (storageErr) {
        return { ok: false, data: null, error: storageErr.message };
      }
    },

    /**
     * Serialize a value to JSON and write it to localStorage.
     * Handles QuotaExceededError and any other DOMException transparently.
     *
     * @param {string} key
     * @param {any}    value
     * @returns {{ ok: boolean, error: string|null }}
     */
    save(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return { ok: true, error: null };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },

    /**
     * Remove a key from localStorage.
     *
     * @param {string} key
     * @returns {{ ok: boolean }}
     */
    remove(key) {
      try {
        localStorage.removeItem(key);
        return { ok: true };
      } catch (_err) {
        return { ok: false };
      }
    },
  };

  // -------------------------------------------------------------------------
  // StateManager
  // Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 6.5, 7.1, 8.2, 8.3, 8.4, 8.5
  // -------------------------------------------------------------------------

  /**
   * @typedef {Object} AppState
   * @property {import('./logic.js').Transaction[]} transactions
   * @property {string[]}  categories       - Default categories first, then custom
   * @property {'newest'|'amount-asc'|'amount-desc'|'category-asc'} sortOrder
   * @property {'light'|'dark'} theme
   * @property {boolean}  storageAvailable
   */

  /** @type {AppState} */
  const AppState = {
    transactions:     [],
    categories:       [],
    sortOrder:        'newest',
    theme:            'light',
    storageAvailable: true,
  };

  const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

  const StateManager = {
    /** Expose AppState as a read-only reference for other modules. */
    state: AppState,

    /**
     * Initialize application state from data loaded out of localStorage.
     *
     * @param {{
     *   transactions:      import('./logic.js').Transaction[],
     *   customCategories:  string[],
     *   theme:             'light'|'dark'|null,
     *   storageAvailable:  boolean
     * }} savedData
     */
    init(savedData) {
      AppState.storageAvailable = savedData.storageAvailable;
      AppState.transactions     = savedData.transactions     || [];
      AppState.categories       = DEFAULT_CATEGORIES.concat(savedData.customCategories || []);
      AppState.theme            = savedData.theme            || 'light';
      AppState.sortOrder        = 'newest';
    },

    /**
     * Prepend a transaction to the in-memory list and persist to localStorage.
     * Requirements: 5.1
     *
     * @param {import('./logic.js').Transaction} tx
     * @returns {{ ok: boolean, error: string|null }}
     */
    addTransaction(tx) {
      AppState.transactions.unshift(tx);
      if (!AppState.storageAvailable) {
        return { ok: true, error: null };
      }
      return StorageService.save(StorageService.KEYS.TRANSACTIONS, AppState.transactions);
    },

    /**
     * Remove the transaction with the given id and persist the updated list.
     * Requirements: 5.2
     *
     * @param {string} id
     * @returns {{ ok: boolean, error: string|null }}
     */
    deleteTransaction(id) {
      AppState.transactions = AppState.transactions.filter(tx => tx.id !== id);
      if (!AppState.storageAvailable) {
        return { ok: true, error: null };
      }
      return StorageService.save(StorageService.KEYS.TRANSACTIONS, AppState.transactions);
    },

    // Task 5.4 — addCategory(name), setSort(order), setTheme(theme)
    // Requirements: 5.6, 7.1, 8.2, 8.3

    /**
     * Add a new custom category to the in-memory list and persist the
     * custom-only slice (everything after the 3 defaults) to localStorage.
     *
     * @param {string} name - Already-validated category name
     * @returns {{ ok: boolean, error: string|null }}
     */
    addCategory(name) {
      AppState.categories.push(name);

      if (!AppState.storageAvailable) {
        return { ok: true, error: null };
      }

      // Persist only the custom categories (skip the 3 built-in defaults).
      const customCategories = AppState.categories.slice(DEFAULT_CATEGORIES.length);
      return StorageService.save(StorageService.KEYS.CATEGORIES, customCategories);
    },

    /**
     * Update the active sort order. Sort preference is not persisted between
     * sessions (resets to "newest" on each load per design).
     *
     * @param {'newest'|'amount-asc'|'amount-desc'|'category-asc'} order
     */
    setSort(order) {
      AppState.sortOrder = order;
    },

    /**
     * Apply a theme to the in-memory state and persist the preference to
     * localStorage so it survives page reloads.
     *
     * @param {'light'|'dark'} theme
     * @returns {{ ok: boolean, error: string|null }}
     */
    setTheme(theme) {
      AppState.theme = theme;

      if (!AppState.storageAvailable) {
        return { ok: true, error: null };
      }

      return StorageService.save(StorageService.KEYS.THEME, theme);
    },

    // Task 5.6 — delegate to pure functions extracted in js/logic.js
    // js/logic.js is loaded as a plain <script> before app.js, so its
    // functions (sortTransactions, computeCategoryTotals, formatBalance)
    // are available as browser globals here.
    // Requirements: 3.1, 4.1, 7.2

    /**
     * Return all transactions sorted according to the current sort order.
     * Delegates to the pure `sortTransactions` function in logic.js.
     *
     * @returns {import('./logic.js').Transaction[]}
     */
    getSortedTransactions() {
      return sortTransactions(AppState.transactions, AppState.sortOrder);
    },

    /**
     * Return the per-category positive-amount totals for the pie chart.
     * Delegates to the pure `computeCategoryTotals` function in logic.js.
     *
     * @returns {Record<string, number>}
     */
    getCategoryTotals() {
      return computeCategoryTotals(AppState.transactions);
    },

    /**
     * Return the total balance of all transactions formatted as a currency
     * string (e.g. "$1,234.56" or "-$50.00").
     * Delegates to the pure `formatBalance` function in logic.js.
     *
     * @returns {string}
     */
    getFormattedBalance() {
      return formatBalance(AppState.transactions);
    },
  };

  // -------------------------------------------------------------------------
  // ChartManager
  // Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
  // -------------------------------------------------------------------------

  const ChartManager = {
    /** @type {import('chart.js').Chart|null} */
    instance: null,

    /**
     * Destroy the current Chart.js instance (if any) and show the placeholder
     * state — hides the <canvas> and makes #chart-placeholder visible.
     */
    clear() {
      if (this.instance) {
        this.instance.destroy();
        this.instance = null;
      }
      const canvas      = document.getElementById('pie-chart');
      const placeholder = document.getElementById('chart-placeholder');
      if (canvas)      canvas.classList.add('hidden');
      if (placeholder) placeholder.classList.remove('hidden');
    },

    /**
     * Rebuild the pie chart from a category-totals map.
     *
     * When `categoryTotals` contains no categories with a positive total the
     * chart is cleared and the placeholder is shown instead (Requirements 4.4,
     * 4.7).  Otherwise the canvas is shown, a descriptive aria-label is set,
     * and a new Chart.js instance is created (Requirement 4.1, 4.5, 4.6).
     *
     * Colors are assigned by looking up each label in `AppState.categories`
     * and using that index modulo 20 from `CATEGORY_COLORS`, giving
     * deterministic, consistent colour assignment across renders.
     *
     * @param {Record<string, number>} categoryTotals
     */
    update(categoryTotals) {
      // Filter to only categories with a strictly positive total (Req 4.1, 4.5)
      const labels = Object.keys(categoryTotals).filter(
        (cat) => categoryTotals[cat] > 0
      );

      if (labels.length === 0) {
        this.clear();
        return;
      }

      // Destroy any existing instance before creating a new one (avoids Chart.js
      // memory-leak warning when the same <canvas> is reused — Req 4.2, 4.3)
      if (this.instance) {
        this.instance.destroy();
        this.instance = null;
      }

      const canvas      = document.getElementById('pie-chart');
      const placeholder = document.getElementById('chart-placeholder');

      // Show canvas, hide placeholder
      if (canvas)      canvas.classList.remove('hidden');
      if (placeholder) placeholder.classList.add('hidden');

      const data   = labels.map((cat) => categoryTotals[cat]);
      const colors = labels.map((cat) => {
        const idx = AppState.categories.indexOf(cat);
        // Fall back to 0 if somehow the category is not found in state
        return CATEGORY_COLORS[(idx === -1 ? 0 : idx) % CATEGORY_COLORS.length];
      });

      // Build a human-readable summary for screen readers (Req accessibility)
      const ariaDesc = labels
        .map((cat, i) => `${cat}: $${data[i].toFixed(2)}`)
        .join(', ');
      canvas.setAttribute('aria-label', `Pie chart showing spending by category: ${ariaDesc}`);

      // Create the new Chart.js instance
      // eslint-disable-next-line no-undef
      this.instance = new Chart(canvas, {
        type: 'pie',
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'bottom',  // one entry per category (Req 4.5)
            },
            tooltip: {
              callbacks: {
                label(context) {
                  const value = context.parsed;
                  const total = context.dataset.data.reduce((s, v) => s + v, 0);
                  const pct   = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';
                  return `${context.label}: $${value.toFixed(2)} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    },
  };

  // -------------------------------------------------------------------------
  // Utility helpers (private to the IIFE)
  // -------------------------------------------------------------------------

  /**
   * Escape special HTML characters to prevent XSS when setting innerHTML.
   *
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -------------------------------------------------------------------------
  // UIController
  // Requirements: 1.1–1.6, 2.1–2.4, 3.1–3.5, 4.1–4.7, 6.1–6.6, 7.1–7.5, 8.1–8.5
  // -------------------------------------------------------------------------

  const UIController = {

    // -----------------------------------------------------------------------
    // Rendering helpers (stubs — filled in by Tasks 8 & 9)
    // -----------------------------------------------------------------------

    /** Re-render every UI component that reflects current app state. */
    renderAll() {
      this.renderTransactionList();
      this.renderBalanceDisplay();
      this.renderChart();
    },

    // -----------------------------------------------------------------------
    // Task 7.1 — Transaction form submit handler
    // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
    // -----------------------------------------------------------------------

    /**
     * Handle the #transaction-form submit event.
     * Reads field values, validates them, creates a Transaction on success,
     * resets the form, and triggers a full UI refresh.
     *
     * @param {SubmitEvent} event
     */
    handleTransactionSubmit(event) {
      event.preventDefault();

      // 1. Read form values
      const nameInput     = document.getElementById('item-name');
      const amountInput   = document.getElementById('amount');
      const categoryInput = document.getElementById('category-select');

      const name     = nameInput     ? nameInput.value     : '';
      const amount   = amountInput   ? amountInput.value   : '';
      const category = categoryInput ? categoryInput.value : '';

      // 2. Clear previous inline errors
      const nameError     = document.getElementById('name-error');
      const amountError   = document.getElementById('amount-error');
      const categoryError = document.getElementById('category-error');

      if (nameError)     nameError.textContent     = '';
      if (amountError)   amountError.textContent   = '';
      if (categoryError) categoryError.textContent = '';

      // 3. Validate — validateTransactionInput is a global from js/logic.js
      const result = validateTransactionInput({
        name,
        amount,
        category,
        categories: AppState.categories,
      });

      if (!result.valid) {
        if (nameError)     nameError.textContent     = result.errors.name     || '';
        if (amountError)   amountError.textContent   = result.errors.amount   || '';
        if (categoryError) categoryError.textContent = result.errors.category || '';
        return;
      }

      // 4. Build the Transaction object
      const tx = {
        id:        crypto.randomUUID(),
        name:      name.trim(),
        amount:    parseFloat(amount),
        category,
        createdAt: Date.now(),
      };

      // 5. Persist via StateManager
      const saveResult = StateManager.addTransaction(tx);
      if (!saveResult.ok) {
        this.showErrorToast();
      }

      // 6. Reset form (Requirement 1.6)
      if (nameInput)     nameInput.value             = '';
      if (amountInput)   amountInput.value           = '';
      if (categoryInput) categoryInput.selectedIndex = 0;

      // 7. Refresh all UI components
      this.renderAll();
    },

    // -----------------------------------------------------------------------
    // Task 7.2 — Add-category button handler
    // Requirements: 6.1, 6.2, 6.3, 6.4, 6.6
    // -----------------------------------------------------------------------

    /**
     * Handle clicks on the "Add Category" button.
     * Validates the candidate name, adds it to state, and updates the UI.
     */
    handleAddCategory() {
      const input      = document.getElementById('category-input');
      const catError   = document.getElementById('cat-error');
      const catLimitMsg = document.getElementById('cat-limit-msg');
      const categorySelect = document.getElementById('category-select');
      const addCategoryBtn = document.getElementById('add-category-btn');

      const name = input ? input.value : '';

      // Clear previous error
      if (catError) catError.textContent = '';

      // Validate the candidate name against current categories
      // validateCategoryName is a global from js/logic.js
      const result = validateCategoryName(name, AppState.categories);

      if (!result.valid) {
        if (catError) catError.textContent = result.error;
        return;
      }

      const trimmedName = name.trim();

      // Persist via StateManager; surface a toast on write failure
      const saveResult = StateManager.addCategory(trimmedName);
      if (!saveResult.ok) {
        UIController.showErrorToast();
      }

      // Append the new category to the selector (Requirement 6.4)
      if (categorySelect) {
        const option = document.createElement('option');
        option.value       = trimmedName;
        option.textContent = trimmedName;
        categorySelect.appendChild(option);
      }

      // Reset the input and clear any lingering error text
      if (input)    input.value = '';
      if (catError) catError.textContent = '';

      // If the 50-category limit has been reached, disable input + button
      // and show the limit message (Requirement 6.6)
      if (AppState.categories.length >= 50) {
        if (input)         input.disabled        = true;
        if (addCategoryBtn) addCategoryBtn.disabled = true;
        if (catLimitMsg)   catLimitMsg.classList.remove('hidden');
      }
    },

    // -----------------------------------------------------------------------
    // Task 8.2 — Delete button handler (event delegation on #transaction-list)
    // Requirements: 2.3
    // -----------------------------------------------------------------------

    /**
     * Handle clicks on #transaction-list via event delegation.
     * Only acts when the clicked element has the class `delete-btn`.
     *
     * @param {MouseEvent} event
     */
    handleDeleteTransaction(event) {
      if (!event.target.classList.contains('delete-btn')) return;

      const id = event.target.dataset.id;
      if (!id) return;

      const saveResult = StateManager.deleteTransaction(id);
      if (!saveResult.ok) {
        this.showErrorToast();
      }

      this.renderAll();
    },

    // -----------------------------------------------------------------------
    // Task 8.2 — Sort control change handler
    // Requirements: 7.2, 7.3, 7.4, 7.5
    // -----------------------------------------------------------------------

    /**
     * Handle changes on #sort-control.
     * Updates the active sort order in state and re-renders the list only
     * (balance and chart are unaffected by sort — Requirement 7.3).
     *
     * @param {Event} event
     */
    handleSortChange(event) {
      const order = event.target.value;
      StateManager.setSort(order);
      if (typeof this.renderTransactionList === 'function') {
        this.renderTransactionList();
      }
    },

    // -----------------------------------------------------------------------
    // Error toast helper (shared by form and category handlers)
    // Requirements: 5.5, 10.5
    // -----------------------------------------------------------------------

    /**
     * Display a dismissible error toast that auto-dismisses after 5 seconds.
     * The toast is appended to <body> so it overlays all content.
     */
    showErrorToast() {
      const TOAST_ID = 'save-error-toast';

      // Avoid stacking duplicate toasts
      const existing = document.getElementById(TOAST_ID);
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id            = TOAST_ID;
      toast.className     = 'toast';
      toast.role          = 'alert';
      toast.setAttribute('aria-live', 'polite');
      toast.textContent   =
        'Your changes could not be saved and may be lost on refresh.';

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.className   = 'toast-close';
      closeBtn.setAttribute('aria-label', 'Dismiss error notification');
      closeBtn.addEventListener('click', () => toast.remove());
      toast.appendChild(closeBtn);

      document.body.appendChild(toast);

      // Auto-dismiss after 5 000 ms (Requirement 5.5)
      setTimeout(() => {
        if (document.getElementById(TOAST_ID)) {
          toast.remove();
        }
      }, 5000);
    },

    // -----------------------------------------------------------------------
    // Task 9.1 — Balance display and chart rendering
    // Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4
    // -----------------------------------------------------------------------

    /**
     * Write the formatted total balance to #balance-amount.
     * Delegates computation to StateManager.getFormattedBalance() which in turn
     * calls the pure formatBalance() function from logic.js.
     *
     * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
     */
    renderBalanceDisplay() {
      const el = document.getElementById('balance-amount');
      if (el) el.textContent = StateManager.getFormattedBalance();
    },

    /**
     * Rebuild the pie chart from the current category totals.
     * Delegates to ChartManager.update() which handles the Chart.js lifecycle
     * (destroy + recreate) and shows/hides the placeholder as needed.
     *
     * Requirements: 4.1, 4.2, 4.3, 4.4
     */
    renderChart() {
      ChartManager.update(StateManager.getCategoryTotals());
    },

    // -----------------------------------------------------------------------
    // Task 9.2 — Theme toggle handler
    // Requirements: 8.1, 8.2, 8.3
    // -----------------------------------------------------------------------

    /**
     * Handle clicks on the #theme-toggle button.
     * Flips the theme between "light" and "dark", updates the data-theme
     * attribute on <body>, persists the choice via StateManager, and updates
     * the button label to reflect the new state.
     *
     * Requirements: 8.1, 8.2, 8.3
     */
    handleThemeToggle() {
      const currentTheme = AppState.theme;
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      StateManager.setTheme(newTheme);
      document.body.setAttribute('data-theme', newTheme);
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.textContent = newTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    },

    // -----------------------------------------------------------------------
    // Task 8.1 — Transaction list rendering
    // Requirements: 2.1, 2.2, 2.4
    // -----------------------------------------------------------------------

    /**
     * Render all transactions as <li> items inside #transaction-list.
     *
     * Each item shows:
     *  - item name truncated to 50 characters (Requirement 2.1)
     *  - formatted monetary amount with currency symbol and 2 decimal places
     *  - category label
     *  - a delete button with aria-label="Delete {name}" (Requirement 2.3 / accessibility)
     *
     * When no transactions exist the list is cleared and #list-placeholder is
     * shown (Requirement 2.4). While there are transactions the placeholder is
     * hidden and the list is scrollable via CSS overflow (Requirement 2.2).
     */
    renderTransactionList() {
      const list        = document.getElementById('transaction-list');
      const placeholder = document.getElementById('list-placeholder');
      const transactions = StateManager.getSortedTransactions();

      if (!list) return;

      // Clear existing items before re-rendering
      list.innerHTML = '';

      if (transactions.length === 0) {
        if (placeholder) placeholder.classList.remove('hidden');
        return;
      }

      if (placeholder) placeholder.classList.add('hidden');

      transactions.forEach(tx => {
        // Truncate display name to 50 characters (Requirement 2.1)
        const displayName = tx.name.length > 50 ? tx.name.slice(0, 50) : tx.name;

        // Format amount: "$1,234.56" or "-$1,234.56" (Requirement 2.1)
        const abs       = Math.abs(tx.amount);
        const formatted = abs.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const formattedAmount = tx.amount < 0 ? `-$${formatted}` : `$${formatted}`;

        const li = document.createElement('li');
        li.className  = 'transaction-item';
        li.dataset.id = tx.id;

        // Use escapeHtml for all user-supplied strings set via innerHTML
        li.innerHTML = `
          <span class="tx-name">${escapeHtml(displayName)}</span>
          <span class="tx-amount">${formattedAmount}</span>
          <span class="tx-category">${escapeHtml(tx.category)}</span>
          <button class="delete-btn" data-id="${escapeHtml(tx.id)}" aria-label="Delete ${escapeHtml(displayName)}">Delete</button>
        `;

        list.appendChild(li);
      });
    },

    // -----------------------------------------------------------------------
    // Initialization — wire all event listeners
    // -----------------------------------------------------------------------

    /**
     * Attach DOM event listeners.  Called once from DOMContentLoaded.
     */
    init() {
      // Task 7.1 — transaction form submit
      const form = document.getElementById('transaction-form');
      if (form) {
        form.addEventListener('submit', UIController.handleTransactionSubmit.bind(UIController));
      }

      // Task 7.2 — add-category button
      const addCategoryBtn = document.getElementById('add-category-btn');
      if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', UIController.handleAddCategory.bind(UIController));
      }

      // Task 8.2 — delete button (event delegation on the list container)
      const list = document.getElementById('transaction-list');
      if (list) {
        list.addEventListener('click', UIController.handleDeleteTransaction.bind(UIController));
      }

      // Task 8.2 — sort control change
      const sortControl = document.getElementById('sort-control');
      if (sortControl) {
        sortControl.addEventListener('change', UIController.handleSortChange.bind(UIController));
      }

      // Task 9.2 — theme toggle
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', UIController.handleThemeToggle.bind(UIController));
      }
    },
  };

  // -------------------------------------------------------------------------
  // Bootstrap — initialize once the DOM is ready
  // Requirements: 5.3, 5.4, 8.3, 8.4, 8.5, 10.2, 10.4
  // -------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Probe localStorage availability
    const probeResult = StorageService.probe();
    const storageAvailable = probeResult.ok;

    // 2. Show storage unavailability banner if probe failed (Requirement 5.4)
    if (!storageAvailable) {
      const banner = document.getElementById('storage-banner');
      if (banner) {
        banner.textContent = 'Storage is unavailable. Your data will not be saved between sessions.';
        banner.classList.remove('hidden');
      }
    }

    // 3. Load transactions (Requirement 10.2, 10.4)
    let transactions = [];
    if (storageAvailable) {
      const txResult = StorageService.load(StorageService.KEYS.TRANSACTIONS);
      if (txResult.ok && Array.isArray(txResult.data)) {
        transactions = txResult.data;
      } else if (!txResult.ok) {
        // Malformed JSON — clear the corrupted key and start with empty list (Req 10.4)
        StorageService.remove(StorageService.KEYS.TRANSACTIONS);
      }
    }

    // 4. Load custom categories (Requirement 5.3)
    let customCategories = [];
    if (storageAvailable) {
      const catResult = StorageService.load(StorageService.KEYS.CATEGORIES);
      if (catResult.ok && Array.isArray(catResult.data)) {
        customCategories = catResult.data;
      } else if (!catResult.ok) {
        StorageService.remove(StorageService.KEYS.CATEGORIES);
      }
    }

    // 5. Load theme preference (Requirement 8.3, 8.4, 8.5)
    let theme = null;
    if (storageAvailable) {
      const themeResult = StorageService.load(StorageService.KEYS.THEME);
      if (themeResult.ok && (themeResult.data === 'light' || themeResult.data === 'dark')) {
        theme = themeResult.data;
      }
    }

    // 6. Initialize in-memory state from loaded data
    StateManager.init({ transactions, customCategories, theme, storageAvailable });

    // 7. Apply the loaded (or default) theme to <body> and update toggle button label
    document.body.setAttribute('data-theme', AppState.theme);
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.textContent = AppState.theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    }

    // 8. Populate #category-select with all categories (defaults + custom) (Requirement 5.3, 6.5)
    const categorySelect = document.getElementById('category-select');
    if (categorySelect) {
      categorySelect.innerHTML = '';
      AppState.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value       = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
      });
    }

    // 9. If category limit already reached on load, disable the add-category input (Req 6.6)
    if (AppState.categories.length >= 50) {
      const catInput    = document.getElementById('category-input');
      const addCatBtn   = document.getElementById('add-category-btn');
      const catLimitMsg = document.getElementById('cat-limit-msg');
      if (catInput)    catInput.disabled    = true;
      if (addCatBtn)   addCatBtn.disabled   = true;
      if (catLimitMsg) catLimitMsg.classList.remove('hidden');
    }

    // 10. Wire all DOM event listeners
    UIController.init();

    // 11. Render the initial UI state (list, balance, chart)
    UIController.renderAll();
  });

})();
