# Design Document — Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side web application that lets users record personal expenses, review their transaction history, and visualize spending distribution by category through an interactive pie chart. There is no backend; all data lives in the browser's `localStorage`.

### Key Constraints

| Constraint | Decision |
|---|---|
| File structure | Exactly one HTML file (`index.html`), one CSS file (`css/style.css`), one JS file (`js/app.js`) |
| Persistence | Browser `localStorage` only |
| Charting | [Chart.js](https://www.chartjs.org/) loaded from CDN |
| Browser targets | Chrome, Firefox, Edge, Safari (current stable) |
| JavaScript style | Vanilla ES6+, no frameworks, IIFE module pattern |
| Minimum default categories | Food, Transport, Fun |
| Maximum total categories | 50 |
| Transaction amount range | 0.01 – 999,999,999.99 |
| Item name max length | 100 characters |
| Category name max length | 50 characters, letters/numbers/spaces/hyphens only |

### Research Findings

**Chart.js CDN** — loaded via `<script src="https://cdn.jsdelivr.net/npm/chart.js">` before `app.js`. Pie charts use `type: 'pie'` with `data.labels` (category names) and `data.datasets[0].data` (numeric totals per category). `chart.destroy()` must be called before recreating a chart on the same `<canvas>` element to avoid memory leaks.

**localStorage** — synchronous API with a ~5 MB quota per origin. `setItem` throws `QuotaExceededError` (DOMException) when the quota is exceeded. In Safari private browsing the quota is 0, so even a tiny write throws. Every read and write must be wrapped in `try/catch`. Detecting availability requires a probe write at startup.

---

## Architecture

The application is structured as a single IIFE (`app.js`) that exposes no globals. Internally it is divided into four logical modules kept as plain object literals:

```
┌─────────────────────────────────────────────────┐
│                   index.html                    │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Form UI │  │ Transaction  │  │  Balance  │  │
│  │          │  │    List UI   │  │  Display  │  │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  │
│       │               │                │         │
│  ┌────▼───────────────▼────────────────▼──────┐  │
│  │               UI Controller               │  │
│  │  (event listeners, DOM reads/writes)      │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐  │
│  │               State Manager               │  │
│  │  (in-memory transactions[], categories[], │  │
│  │   sortOrder, theme, storageAvailable)     │  │
│  └──────┬─────────────────────────┬───────────┘  │
│         │                         │              │
│  ┌──────▼──────┐         ┌────────▼──────────┐   │
│  │ StorageService│       │  Chart Manager    │   │
│  │ (localStorage │       │  (Chart.js pie    │   │
│  │  read/write) │        │   lifecycle)      │   │
│  └──────────────┘        └───────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Module Responsibilities

| Module | Responsibility |
|---|---|
| **UI Controller** | Attaches DOM event listeners; reads form values; calls State Manager mutations; delegates rendering back to itself via `render*()` helpers |
| **State Manager** | Single source of truth for all app data; exposes pure mutation functions (`addTransaction`, `deleteTransaction`, `addCategory`, `setSort`, `setTheme`); never touches the DOM |
| **StorageService** | Encapsulates all `localStorage` access; exposes `load()`, `save()`, `probe()` — all return `{ok, data, error}` result objects; never throws |
| **Chart Manager** | Owns the `Chart.js` instance; exposes `update(categoryTotals)` and `clear()`; calls `chart.destroy()` before each rebuild |

### Data Flow

```
User Interaction
      │
      ▼
UI Controller (validate input)
      │ valid
      ▼
State Manager (mutate in-memory state)
      │
      ├──► StorageService.save()  ── failure ──► show error banner
      │
      └──► UI Controller.renderAll()
                  │
                  ├── renderTransactionList()
                  ├── renderBalanceDisplay()
                  └── ChartManager.update()
```

On page load the flow is:

```
DOMContentLoaded
      │
      ├── StorageService.probe()  ── unavailable ──► set storageAvailable=false, show warning banner
      │
      ├── StorageService.load()   ── malformed JSON ──► clear key, start empty
      │
      ├── State Manager.init(loadedData)
      │
      └── UI Controller.renderAll()
```

---

## Components and Interfaces

### HTML Structure (`index.html`)

```
<body data-theme="light">
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <button id="theme-toggle">🌙 Dark Mode</button>
  </header>

  <!-- Storage warning banner (hidden by default) -->
  <div id="storage-banner" class="banner hidden" role="alert" aria-live="assertive"></div>

  <main>
    <!-- Left column -->
    <section id="form-section">
      <h2>Add Transaction</h2>
      <form id="transaction-form">
        <div class="field-group">
          <label for="item-name">Item Name</label>
          <input id="item-name" type="text" maxlength="100" autocomplete="off" />
          <span class="error-msg" id="name-error" aria-live="polite"></span>
        </div>
        <div class="field-group">
          <label for="amount">Amount</label>
          <input id="amount" type="number" min="0.01" max="999999999.99" step="0.01" />
          <span class="error-msg" id="amount-error" aria-live="polite"></span>
        </div>
        <div class="field-group">
          <label for="category-select">Category</label>
          <select id="category-select"></select>
          <span class="error-msg" id="category-error" aria-live="polite"></span>
        </div>
        <button type="submit">Add Transaction</button>
      </form>

      <h2>Add Category</h2>
      <div id="category-manager">
        <input id="category-input" type="text" maxlength="50" placeholder="New category name" />
        <button id="add-category-btn">Add Category</button>
        <span class="error-msg" id="cat-error" aria-live="polite"></span>
        <span id="cat-limit-msg" class="hidden">Maximum categories reached.</span>
      </div>
    </section>

    <!-- Right column -->
    <section id="data-section">
      <div id="balance-display">
        <h2>Total Balance</h2>
        <p id="balance-amount">$0.00</p>
      </div>

      <div id="chart-section">
        <h2>Spending by Category</h2>
        <div id="chart-container">
          <canvas id="pie-chart"></canvas>
          <p id="chart-placeholder" class="hidden">No spending data available.</p>
        </div>
      </div>

      <div id="list-section">
        <div id="list-header">
          <h2>Transactions</h2>
          <select id="sort-control">
            <option value="newest">Newest First (default)</option>
            <option value="amount-asc">Amount: Low to High</option>
            <option value="amount-desc">Amount: High to Low</option>
            <option value="category-asc">Category A–Z</option>
          </select>
        </div>
        <ul id="transaction-list" role="list"></ul>
        <p id="list-placeholder">No transactions recorded.</p>
      </div>
    </section>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="js/app.js"></script>
</body>
```

### StorageService Interface

```javascript
StorageService = {
  KEYS: { TRANSACTIONS: 'ebv_transactions', CATEGORIES: 'ebv_categories', THEME: 'ebv_theme' },

  // Returns { ok: boolean }. Writes and immediately deletes a probe key.
  probe(): { ok: boolean },

  // Returns { ok: boolean, data: any|null, error: string|null }
  load(key): { ok, data, error },

  // Returns { ok: boolean, error: string|null }
  save(key, value): { ok, error },

  // Returns { ok: boolean }
  remove(key): { ok }
}
```

### State Manager Interface

```javascript
StateManager = {
  state: AppState,               // read-only from outside

  init(savedData): void,         // initialize from loaded storage data
  addTransaction(tx): void,      // add and persist
  deleteTransaction(id): void,   // delete and persist
  addCategory(name): void,       // add and persist
  setSort(sortOrder): void,      // update sort preference
  setTheme(theme): void,         // update and persist theme
  getSortedTransactions(): Transaction[],
  getCategoryTotals(): Record<string, number>,  // category → sum of positive amounts
  getFormattedBalance(): string  // "$1,234.56" or "-$1,234.56"
}
```

### ChartManager Interface

```javascript
ChartManager = {
  instance: Chart | null,

  // Creates or replaces the Chart.js pie chart
  update(categoryTotals: Record<string, number>): void,

  // Destroys chart instance and shows placeholder
  clear(): void
}
```

---

## Data Models

### Transaction

```javascript
/**
 * @typedef {Object} Transaction
 * @property {string}  id        - UUID v4 generated via crypto.randomUUID()
 * @property {string}  name      - Item name, 1–100 characters
 * @property {number}  amount    - Numeric value, 0.01–999,999,999.99, stored as float
 * @property {string}  category  - Category label (must exist in categories list)
 * @property {number}  createdAt - Unix timestamp ms (Date.now()) for default sort order
 */
```

### AppState

```javascript
/**
 * @typedef {Object} AppState
 * @property {Transaction[]} transactions      - All stored transactions (insertion order)
 * @property {string[]}      categories        - All category labels (defaults first, then custom)
 * @property {'newest'|'amount-asc'|'amount-desc'|'category-asc'} sortOrder
 * @property {'light'|'dark'} theme
 * @property {boolean}       storageAvailable  - False if localStorage probe failed
 */
```

### Local Storage Schema

| Key | Value | Description |
|---|---|---|
| `ebv_transactions` | `JSON.stringify(Transaction[])` | Full transaction array |
| `ebv_categories` | `JSON.stringify(string[])` | Custom categories only (defaults re-added on load) |
| `ebv_theme` | `"light"` or `"dark"` | Theme preference |

Default categories (`["Food", "Transport", "Fun"]`) are not written to storage. On load, they are prepended to any stored custom categories so the total available list is always `defaults.concat(customFromStorage)`.

### Serialization Contract

- `amount` is stored as a JavaScript `number` (IEEE 754 double). Values in the range 0.01–999,999,999.99 with at most 2 decimal places are representable without precision loss when round-tripped through `JSON.stringify` / `JSON.parse`.
- The `id` field is a string (UUID v4 from `crypto.randomUUID()`).
- The `createdAt` field is a JavaScript safe integer (milliseconds since epoch).

### Category Palette

A fixed color palette of 20 colors is defined in `app.js` and assigned to categories by index (category array position modulo 20). This ensures consistent color assignment within a session and is deterministic across reloads as long as category order is preserved.

```javascript
const CATEGORY_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
  '#FF9F40', '#C9CBCF', '#7BC8A4', '#E7515A', '#00AB55',
  '#1C1C1E', '#5E5CE6', '#FF375F', '#30D158', '#FFD60A',
  '#0A84FF', '#BF5AF2', '#FF6B35', '#A8D8EA', '#AA96DA'
];
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction Serialization Round-Trip

*For any* valid collection of Transaction objects, serializing the collection to a JSON string and then deserializing it SHALL produce a collection with the same count, the same field values for each transaction, the same field types, and identical `amount` values preserving at least 2 decimal places of precision.

**Validates: Requirements 10.1, 10.2, 10.3**

---

### Property 2: Valid Transaction Addition Grows the List

*For any* transaction list state and any valid transaction (name 1–100 chars, amount 0.01–999,999,999.99, category from the current list), adding it SHALL increase the transaction list length by exactly 1, and the new transaction SHALL appear as the first item in the default (newest-first) rendering order.

**Validates: Requirements 1.2, 2.1**

---

### Property 3: Invalid Input Rejection

*For any* form submission where at least one field is empty, the amount is outside [0.01, 999,999,999.99], or the item name exceeds 100 characters, the transaction list SHALL remain unchanged (same count, same items) and at least one inline validation message SHALL be visible adjacent to the offending field.

**Validates: Requirements 1.3, 1.4, 1.5**

---

### Property 4: Balance Reflects Current Transaction State

*For any* collection of transactions (including empty, single-item, and multi-item collections), the Balance Display value SHALL equal the sum of all transaction amounts formatted with a leading currency symbol (`$`), a thousands separator (`,`), and exactly 2 decimal places. When the sum is negative it SHALL be rendered as `-$X,XXX.XX`.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

### Property 5: Pie Chart Data Matches Category Totals

*For any* collection of transactions, the Pie Chart dataset labels and data values SHALL exactly correspond to the set of categories that have a strictly positive category total, with each value proportional to that category's share of the overall positive total. Categories with non-positive or zero totals SHALL be excluded from the chart.

**Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6, 4.7**

---

### Property 6: Transaction Deletion Preserves Order of Remaining Items

*For any* list of transactions and any transaction chosen for deletion, after deletion the remaining transactions SHALL appear in the same relative order as before, the deleted transaction SHALL not appear, and the list length SHALL decrease by exactly 1.

**Validates: Requirements 2.3**

---

### Property 7: Sort Correctness

*For any* collection of transactions and any sort option (amount ascending, amount descending, category ascending), the rendered order SHALL satisfy the comparator for that option. When two transactions share the same sort key (equal amount or equal category name), they SHALL be ordered newest-first as a secondary sort. Sorting SHALL not alter the Balance Display value or the Pie Chart data.

**Validates: Requirements 7.2, 7.3, 7.4, 7.5**

---

### Property 8: Category Validation

*For any* candidate category name, it SHALL be accepted if and only if it matches the pattern `^[A-Za-z0-9 \-]{1,50}$` (letters, digits, spaces, hyphens; 1–50 characters) and is not equal to an existing category name under case-insensitive comparison, and the total category count is below 50. Any name failing these conditions SHALL be rejected with an appropriate validation message and SHALL NOT be added to the list.

**Validates: Requirements 6.1, 6.2, 6.3**

---

### Property 9: Persistence Round-Trip on Add and Delete

*For any* sequence of add-transaction and delete-transaction operations, immediately after each operation the JSON stored under `ebv_transactions` in `localStorage` SHALL deserialize to the current in-memory transaction collection (same count and values). *For any* custom category added, the `ebv_categories` key SHALL contain it after the add operation completes.

**Validates: Requirements 5.1, 5.2, 5.6**

---

### Property 10: Theme Persistence Round-Trip

*For any* theme value selected by the user (`"light"` or `"dark"`), the value stored in `localStorage` under `ebv_theme` SHALL equal the selected theme, and reloading the app SHALL apply that theme to all visible UI components.

**Validates: Requirements 8.2, 8.3**

---

### Property 11: Form Resets After Successful Submission

*For any* valid form submission that results in a transaction being created, the item name field SHALL be empty, the amount field SHALL be empty, and the category selector SHALL show its first option after the submission completes.

**Validates: Requirements 1.6**

---

## Error Handling

### LocalStorage Unavailability

Detected at startup via a probe write. If the probe fails:

- `storageAvailable` is set to `false` in `AppState`.
- A non-dismissible warning banner (`#storage-banner`) is shown above the transaction list: _"Storage is unavailable. Your data will not be saved between sessions."_
- All `StorageService.save()` calls are skipped for the rest of the session (no-op when `storageAvailable === false`).
- The app continues to operate with in-memory state only.

### LocalStorage Write Failure (Post-Startup)

If `StorageService.save()` returns `{ ok: false }` after a transaction or category mutation:

- The in-memory state is **not** rolled back.
- A dismissible error toast is displayed: _"Your changes could not be saved and may be lost on refresh."_
- The toast auto-dismisses after 5 seconds.

### Malformed JSON on Load

If `JSON.parse` throws when reading `ebv_transactions`:

- `StorageService.remove('ebv_transactions')` is called to clear the corrupted key.
- The app initializes with an empty transaction list.
- No banner is shown (silent recovery).

### Form Validation Errors

Inline error messages appear in `<span class="error-msg">` elements adjacent to each field. They are cleared on the next submit attempt. Messages use `aria-live="polite"` for screen reader announcements.

| Condition | Message |
|---|---|
| Name empty | "Item name is required." |
| Name > 100 chars | "Item name must not exceed 100 characters." |
| Amount empty | "Amount is required." |
| Amount < 0.01 | "Amount must be at least 0.01." |
| Amount > 999,999,999.99 | "Amount must not exceed 999,999,999.99." |
| Amount not a number | "Please enter a valid amount." |
| Category empty | "Please select a category." |

### Category Validation Errors

| Condition | Message |
|---|---|
| Empty / whitespace-only | "Category name cannot be empty." |
| Invalid characters | "Category name may only contain letters, numbers, spaces, or hyphens." |
| Exceeds 50 characters | "Category name must not exceed 50 characters." |
| Duplicate (case-insensitive) | "This category already exists." |
| Limit reached (50 categories) | "Maximum of 50 categories reached." (input also disabled) |

---

## Testing Strategy

### Dual Testing Approach

Testing uses **example-based unit tests** for specific scenarios and edge cases, and **property-based tests** for universal behavioral invariants. Both are necessary: unit tests document concrete expected behavior; property tests find unexpected edge cases across the full input space.

### Property-Based Testing Library

Use **[fast-check](https://fast-check.dev/)** for JavaScript property-based testing. Each property test runs a minimum of **100 iterations** with randomly generated inputs.

Tag format for each property test:

```
// Feature: expense-budget-visualizer, Property N: <property text>
```

### Pure Functions to Extract and Test

Because the business logic is inside a browser IIFE, the testable pure functions should be extracted to a separate module (or exposed on a test-only global during test runs). The following functions are pure and independently testable:

| Function | Description |
|---|---|
| `serializeTransactions(txs)` | Returns JSON string |
| `deserializeTransactions(json)` | Returns `Transaction[]` or throws |
| `formatBalance(transactions)` | Returns formatted string like `"$1,234.56"` |
| `computeCategoryTotals(transactions)` | Returns `Record<string, number>` |
| `sortTransactions(transactions, sortOrder)` | Returns sorted copy |
| `validateTransactionInput({name, amount, category, categories})` | Returns `{valid, errors}` |
| `validateCategoryName(name, existingCategories)` | Returns `{valid, error}` |

### Property-Based Tests

```javascript
// Feature: expense-budget-visualizer, Property 1: Transaction Serialization Round-Trip
fc.property(fc.array(arbitraryTransaction()), txs => {
  const json = serializeTransactions(txs);
  const restored = deserializeTransactions(json);
  return deepEqual(txs, restored);
});

// Feature: expense-budget-visualizer, Property 2: Valid Transaction Addition Grows the List
fc.property(fc.array(arbitraryTransaction()), arbitraryTransaction(), (existing, newTx) => {
  const result = addToList(existing, newTx);
  return result.length === existing.length + 1 && result[0].id === newTx.id;
});

// Feature: expense-budget-visualizer, Property 3: Invalid Input Rejection
fc.property(arbitraryInvalidInput(), input => {
  const { valid, errors } = validateTransactionInput(input);
  return valid === false && Object.keys(errors).length > 0;
});

// Feature: expense-budget-visualizer, Property 4: Balance Reflects Current Transaction State
fc.property(fc.array(arbitraryTransaction()), txs => {
  const expected = txs.reduce((sum, t) => sum + t.amount, 0);
  const displayed = parseFormattedBalance(formatBalance(txs));
  return Math.abs(displayed - expected) < 0.005;
});

// Feature: expense-budget-visualizer, Property 5: Pie Chart Data Matches Category Totals
fc.property(fc.array(arbitraryTransaction()), txs => {
  const totals = computeCategoryTotals(txs);
  const positiveCategories = Object.keys(totals).filter(k => totals[k] > 0);
  // chart labels === positiveCategories (same set)
  return setEquals(positiveCategories, chartLabelsFrom(totals));
});

// Feature: expense-budget-visualizer, Property 6: Deletion Preserves Order
fc.property(fc.array(arbitraryTransaction(), { minLength: 1 }), txs => {
  const idx = Math.floor(Math.random() * txs.length);
  const deletedId = txs[idx].id;
  const result = txs.filter(t => t.id !== deletedId);
  return result.length === txs.length - 1 &&
    result.every(t => t.id !== deletedId) &&
    isSubsequence(result, txs);
});

// Feature: expense-budget-visualizer, Property 7: Sort Correctness
fc.property(fc.array(arbitraryTransaction()), fc.constantFrom('amount-asc','amount-desc','category-asc'), (txs, order) => {
  const sorted = sortTransactions(txs, order);
  return isSortedBy(sorted, order);
});

// Feature: expense-budget-visualizer, Property 8: Category Validation
fc.property(arbitraryCategoryName(), existingCategories(), (name, existing) => {
  const { valid } = validateCategoryName(name, existing);
  const expectedValid = isValidCategoryName(name) && !isDuplicate(name, existing) && existing.length < 50;
  return valid === expectedValid;
});

// Feature: expense-budget-visualizer, Property 11: Form Resets After Submission
fc.property(arbitraryValidInput(), input => {
  const formState = submitForm(input);
  return formState.name === '' && formState.amount === '' && formState.categoryIndex === 0;
});
```

### Unit Tests (Example-Based)

**Transaction Form:**
- Submitting all valid fields creates a transaction and appends it to the list.
- Submitting with empty name shows name error message.
- Submitting with empty amount shows amount error message.
- Submitting with amount = 0 shows amount range error.
- Submitting with name of exactly 100 characters succeeds.
- Submitting with name of 101 characters shows name length error.

**Balance Display:**
- Zero transactions shows `$0.00`.
- Single transaction of `1234.56` shows `$1,234.56`.
- Negative sum shows `-$50.00` (minus before currency symbol).

**Pie Chart:**
- No transactions → placeholder visible, canvas hidden.
- Two categories with equal amounts → two distinct segments.
- Category with zero total → excluded from chart.

**Transaction List:**
- No transactions → placeholder text visible.
- Delete removes only the targeted transaction.

**Categories:**
- Default categories (Food, Transport, Fun) present on load.
- Adding 50th category succeeds; adding 51st is rejected.
- Duplicate detection is case-insensitive: "food" rejected when "Food" exists.

**Theme:**
- Toggling sets `data-theme` attribute on `<body>`.
- No stored preference defaults to light theme.
- `localStorage` unavailable defaults to light theme without error banner.

**Storage:**
- Malformed JSON cleared; app initializes with empty list.
- `setItem` failure shows error toast; in-memory list unchanged.
- Storage unavailable at startup shows non-dismissible warning banner.

### Integration Tests

- App loads in Chrome, Firefox, Edge, Safari without console errors.
- After a page reload, all previously added transactions are present.
- After a page reload, custom categories are present in the selector.
- After a page reload, the previously active theme is applied.
- Performance: app becomes interactive within 3 seconds on a 10+ Mbps connection (Lighthouse CI).

### Accessibility Checks

- All form inputs have associated `<label>` elements.
- Error messages use `aria-live="polite"`.
- Storage warning banner uses `role="alert"` with `aria-live="assertive"`.
- Pie chart canvas has a descriptive `aria-label` updated on each render.
- Theme toggle button label reflects current mode.
- Delete buttons include `aria-label` with the transaction name (e.g., `"Delete Coffee"`).
