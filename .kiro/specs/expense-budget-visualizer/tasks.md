# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side expense tracking web app as a single HTML/CSS/JS bundle. The implementation follows the four-module IIFE pattern (`StorageService`, `State Manager`, `ChartManager`, `UI Controller`) defined in the design document. Pure business-logic functions are extracted into a separate testable module (`js/logic.js`) so property-based and unit tests can run outside the browser IIFE.

---

## Tasks

- [x] 1. Scaffold project structure and static HTML shell
  - Create `index.html` with the full semantic markup from the design (header, storage banner, form section, balance display, chart section, list section)
  - Add Chart.js CDN `<script>` tag before `js/app.js`
  - Create empty `css/style.css` and `js/app.js` placeholder files; create `js/logic.js` for extracted pure functions
  - _Requirements: 9.4_

- [x] 2. Implement pure business-logic module (`js/logic.js`)
  - [x] 2.1 Implement `serializeTransactions` and `deserializeTransactions`
    - Serialize `Transaction[]` to JSON string; deserialize back to `Transaction[]`; throw on malformed JSON
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 2.2 Write property test for Transaction serialization round-trip
    - **Property 1: Transaction Serialization Round-Trip**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - Use `fc.array(arbitraryTransaction())` to generate random transaction collections

  - [x] 2.3 Implement `validateTransactionInput({name, amount, category, categories})`
    - Return `{ valid: boolean, errors: { name?, amount?, category? } }` with all rule checks from the design error table
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [ ]* 2.4 Write property test for invalid input rejection
    - **Property 3: Invalid Input Rejection**
    - **Validates: Requirements 1.3, 1.4, 1.5**
    - Generate `arbitraryInvalidInput()` and assert `valid === false && errors` is non-empty

  - [x] 2.5 Implement `validateCategoryName(name, existingCategories)`
    - Return `{ valid: boolean, error?: string }` applying regex `^[A-Za-z0-9 \-]{1,50}$`, duplicate check (case-insensitive), and 50-category limit
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [ ]* 2.6 Write property test for category validation
    - **Property 8: Category Validation**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Generate `arbitraryCategoryName()` and `existingCategories()` and verify `valid` matches expected predicate

  - [x] 2.7 Implement `formatBalance(transactions)`
    - Sum all `amount` values; format as `$X,XXX.XX`; negative as `-$X,XXX.XX`; zero as `$0.00`
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ]* 2.8 Write property test for balance formatting
    - **Property 4: Balance Reflects Current Transaction State**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    - Parse formatted output and compare against raw sum; tolerance < 0.005

  - [x] 2.9 Implement `computeCategoryTotals(transactions)`
    - Return `Record<string, number>` mapping each category to its positive-amount sum; exclude zero/negative totals
    - _Requirements: 4.1, 4.5, 4.6, 4.7_

  - [ ]* 2.10 Write property test for pie chart data correctness
    - **Property 5: Pie Chart Data Matches Category Totals**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.5, 4.6, 4.7**
    - Assert chart labels equal exactly the set of categories with positive totals

  - [x] 2.11 Implement `sortTransactions(transactions, sortOrder)`
    - Return a sorted copy for `newest`, `amount-asc`, `amount-desc`, `category-asc`; apply newest-first as secondary sort on ties
    - _Requirements: 7.1, 7.2, 7.5_

  - [ ]* 2.12 Write property test for sort correctness
    - **Property 7: Sort Correctness**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
    - For each sort order, assert sorted output satisfies the comparator and balance/chart data are unaffected

  - [ ]* 2.13 Write property test for valid transaction addition
    - **Property 2: Valid Transaction Addition Grows the List**
    - **Validates: Requirements 1.2, 2.1**
    - Assert `addToList(existing, newTx).length === existing.length + 1` and new item appears first in newest sort

  - [ ]* 2.14 Write property test for deletion preserving order
    - **Property 6: Transaction Deletion Preserves Order of Remaining Items**
    - **Validates: Requirements 2.3**
    - Assert remaining items form a subsequence of the original list and length decreased by 1

  - [ ]* 2.15 Write property test for form reset after submission
    - **Property 11: Form Resets After Successful Submission**
    - **Validates: Requirements 1.6**
    - Assert name field empty, amount field empty, category selector at index 0 after valid submit

- [x] 3. Checkpoint — verify pure logic tests
  - Ensure all tests in `js/logic.js` pass. Ask the user if any questions arise before continuing.

- [x] 4. Implement `StorageService` module inside `js/app.js`
  - [x] 4.1 Implement `StorageService.probe()`
    - Write and immediately delete a sentinel key; return `{ ok: boolean }`; never throw
    - _Requirements: 5.4_

  - [x] 4.2 Implement `StorageService.load(key)` and `StorageService.save(key, value)`
    - Wrap all `localStorage` calls in `try/catch`; return `{ ok, data, error }` / `{ ok, error }` result objects
    - Handle `QuotaExceededError` and malformed JSON transparently
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 10.4, 10.5_

  - [ ]* 4.3 Write unit tests for StorageService
    - Test probe returns `{ ok: false }` when `localStorage.setItem` throws
    - Test `load` returns `{ ok: false, data: null }` on malformed JSON and clears the key
    - Test `save` returns `{ ok: false }` on quota exceeded without throwing

- [x] 5. Implement `StateManager` module inside `js/app.js`
  - [x] 5.1 Define `AppState` and `StateManager.init(savedData)`
    - Prepend default categories `["Food", "Transport", "Fun"]` to loaded custom categories
    - Set `storageAvailable` from probe result; initialize `sortOrder` to `"newest"` and `theme` to `"light"` by default
    - _Requirements: 5.3, 6.5, 8.4, 8.5_

  - [x] 5.2 Implement `StateManager.addTransaction(tx)` and `deleteTransaction(id)`
    - Mutate in-memory state; call `StorageService.save(KEYS.TRANSACTIONS, ...)`; expose result for UI error handling
    - _Requirements: 5.1, 5.2_

  - [ ]* 5.3 Write property test for persistence round-trip on add/delete
    - **Property 9: Persistence Round-Trip on Add and Delete**
    - **Validates: Requirements 5.1, 5.2, 5.6**
    - After each mutation, deserialize `ebv_transactions` from storage and assert equality with in-memory state

  - [x] 5.4 Implement `StateManager.addCategory(name)`, `setSort(order)`, `setTheme(theme)`
    - Persist category additions to `ebv_categories`; persist theme to `ebv_theme`
    - _Requirements: 5.6, 7.1, 8.2, 8.3_

  - [ ]* 5.5 Write property test for theme persistence round-trip
    - **Property 10: Theme Persistence Round-Trip**
    - **Validates: Requirements 8.2, 8.3**
    - Assert stored theme value equals selected theme after `setTheme`

  - [x] 5.6 Implement `StateManager.getSortedTransactions()`, `getCategoryTotals()`, `getFormattedBalance()`
    - Delegate to extracted pure functions in `js/logic.js`
    - _Requirements: 3.1, 4.1, 7.2_

- [x] 6. Implement `ChartManager` module inside `js/app.js`
  - [x] 6.1 Implement `ChartManager.update(categoryTotals)` and `ChartManager.clear()`
    - Call `chart.destroy()` before rebuilding; use `CATEGORY_COLORS` palette (index mod 20)
    - Show `#chart-placeholder` and hide `<canvas>` when totals are empty; set descriptive `aria-label` on canvas
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 6.2 Write unit tests for ChartManager
    - Test `clear()` shows placeholder and hides canvas
    - Test `update({})` (empty totals) calls `clear()` path
    - Test chart is rebuilt (destroy + new instance) on successive `update()` calls

- [x] 7. Implement `UI Controller` — form and category interactions
  - [x] 7.1 Wire transaction form submit handler
    - Read `#item-name`, `#amount`, `#category-select`; call `validateTransactionInput`; show inline errors or call `StateManager.addTransaction`; reset form on success
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 7.2 Wire add-category button handler
    - Call `validateCategoryName`; show `#cat-error` on failure; on success call `StateManager.addCategory`, append `<option>` to `#category-select`, disable input when limit reached
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [ ]* 7.3 Write unit tests for form and category UI wiring
    - Submitting valid fields creates a transaction and resets the form
    - Submitting with empty name shows `#name-error`
    - Adding duplicate category (case-insensitive) shows `#cat-error`

- [x] 8. Implement `UI Controller` — list rendering and sort
  - [x] 8.1 Implement `renderTransactionList()`
    - Render `<li>` items with item name (truncated to 50 chars), formatted amount, category, and a delete button with `aria-label="Delete {name}"`; show `#list-placeholder` when empty
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 8.2 Wire delete button and sort control handlers
    - Delete: call `StateManager.deleteTransaction(id)`, then `renderAll()`
    - Sort: call `StateManager.setSort(order)`, then `renderTransactionList()`
    - _Requirements: 2.3, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 8.3 Write unit tests for list rendering
    - Zero transactions renders placeholder text
    - Delete removes only the targeted transaction and preserves remaining order
    - Sort re-renders list without changing balance or chart data

- [x] 9. Implement `UI Controller` — balance display, chart update, and theme toggle
  - [x] 9.1 Implement `renderBalanceDisplay()` and `renderChart()`
    - Call `StateManager.getFormattedBalance()` → write to `#balance-amount`
    - Call `StateManager.getCategoryTotals()` → pass to `ChartManager.update()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_

  - [x] 9.2 Implement theme toggle handler
    - Toggle `data-theme` attribute on `<body>` between `"light"` and `"dark"`; update button label; call `StateManager.setTheme()`
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 9.3 Write unit tests for balance, chart, and theme
    - Zero transactions → `$0.00` in balance display
    - No transactions → chart placeholder visible, canvas hidden
    - Theme toggle sets `data-theme` on `<body>` and persists value

- [ ] 10. Implement app initialization and error banners
  - [-] 10.1 Implement `DOMContentLoaded` bootstrap sequence
    - Run `StorageService.probe()` → set `storageAvailable`; show `#storage-banner` if unavailable
    - Load and parse `ebv_transactions`, `ebv_categories`, `ebv_theme`; handle malformed JSON (clear key, empty list)
    - Call `StateManager.init(loadedData)` then `UI Controller.renderAll()`
    - _Requirements: 5.3, 5.4, 8.3, 8.4, 8.5, 10.2, 10.4_

  - [-] 10.2 Implement post-save error toast
    - When `StorageService.save()` returns `{ ok: false }`, display dismissible toast "_Your changes could not be saved and may be lost on refresh._" auto-dismissing after 5 seconds
    - _Requirements: 5.5, 10.5_

  - [ ]* 10.3 Write unit tests for initialization and error handling
    - Malformed JSON: key cleared, app starts empty, no banner shown
    - Storage unavailable: non-dismissible `#storage-banner` visible, app operates in memory-only mode
    - Failed save: error toast shown; in-memory list unchanged

- [ ] 11. Apply CSS styling for light/dark themes and layout
  - [ ] 11.1 Write base layout styles in `css/style.css`
    - Two-column responsive layout (form left, data right); scrollable `#transaction-list`; hide/show utility classes (`.hidden`)
    - _Requirements: 2.2, 9.1_

  - [~] 11.2 Write light and dark theme variable sets
    - Define CSS custom properties under `[data-theme="light"]` and `[data-theme="dark"]` selectors; apply to all UI components (header, form, list, balance, chart, banner, toast)
    - _Requirements: 8.1, 8.2_

- [ ] 12. Accessibility pass
  - [~] 12.1 Audit and fix accessibility attributes
    - Ensure every `<input>` has an associated `<label>`; error `<span>` elements have `aria-live="polite"`; `#storage-banner` has `role="alert"` and `aria-live="assertive"`; `#pie-chart` canvas has a descriptive `aria-label` updated on each render; delete buttons include `aria-label="Delete {name}"`
    - _Requirements: 1.3, 5.4, 2.3_

- [~] 13. Final checkpoint — full integration verification
  - Ensure all unit and property tests pass. Open `index.html` in Chrome, Firefox, Edge, and Safari and verify no console errors. Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP build.
- `js/logic.js` contains only pure functions with no DOM or `localStorage` dependencies — this is what makes property-based and unit tests feasible without a browser.
- Each property test references a numbered property from the design document for full traceability.
- Checkpoints in tasks 3 and 13 act as quality gates between major implementation phases.
- All correctness properties (1–11 from the design) are covered by test sub-tasks 2.2–2.15.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.3", "2.5", "2.7", "2.9", "2.11"] },
    { "id": 1, "tasks": ["2.2", "2.4", "2.6", "2.8", "2.10", "2.12", "2.13", "2.14", "2.15", "4.1"] },
    { "id": 2, "tasks": ["4.2", "5.1"] },
    { "id": 3, "tasks": ["4.3", "5.2", "5.4", "6.1"] },
    { "id": 4, "tasks": ["5.3", "5.5", "5.6", "6.2", "7.1", "7.2"] },
    { "id": 5, "tasks": ["7.3", "8.1", "8.2"] },
    { "id": 6, "tasks": ["8.3", "9.1", "9.2"] },
    { "id": 7, "tasks": ["9.3", "10.1", "10.2", "11.1"] },
    { "id": 8, "tasks": ["10.3", "11.2"] },
    { "id": 9, "tasks": ["12.1"] }
  ]
}
```
