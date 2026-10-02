/**
 * logic.js — Pure business-logic functions for the Expense & Budget Visualizer.
 *
 * All functions here are side-effect-free (no DOM, no localStorage) so they
 * can be tested in Node.js with property-based and unit tests.
 *
 * @typedef {Object} Transaction
 * @property {string} id        - UUID v4
 * @property {string} name      - Item name, 1–100 characters
 * @property {number} amount    - Numeric value, 0.01–999,999,999.99
 * @property {string} category  - Category label
 * @property {number} createdAt - Unix timestamp ms
 */

'use strict';

// ---------------------------------------------------------------------------
// Task 2.1 — Serialization helpers
// Requirements: 10.1, 10.2, 10.3
// ---------------------------------------------------------------------------

/**
 * Serialize a Transaction array to a JSON string for localStorage.
 * @param {Transaction[]} transactions
 * @returns {string}
 */
function serializeTransactions(transactions) {
  return JSON.stringify(transactions);
}

/**
 * Deserialize a JSON string back into a Transaction array.
 * Throws a SyntaxError if the input is malformed JSON.
 * @param {string} json
 * @returns {Transaction[]}
 */
function deserializeTransactions(json) {
  const parsed = JSON.parse(json); // intentionally throws on malformed JSON
  if (!Array.isArray(parsed)) {
    throw new TypeError('Stored transaction data is not an array.');
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Task 2.3 — Transaction input validation
// Requirements: 1.1, 1.3, 1.4, 1.5
// ---------------------------------------------------------------------------

const AMOUNT_MIN = 0.01;
const AMOUNT_MAX = 999_999_999.99;
const NAME_MAX_LENGTH = 100;

/**
 * Validate a transaction form submission.
 * @param {{ name: string, amount: string|number, category: string, categories: string[] }} input
 * @returns {{ valid: boolean, errors: { name?: string, amount?: string, category?: string } }}
 */
function validateTransactionInput({ name, amount, category, categories }) {
  const errors = {};

  // --- Name ---
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (trimmedName === '') {
    errors.name = 'Item name is required.';
  } else if (trimmedName.length > NAME_MAX_LENGTH) {
    errors.name = 'Item name must not exceed 100 characters.';
  }

  // --- Amount ---
  const rawAmount = String(amount).trim();
  if (rawAmount === '') {
    errors.amount = 'Amount is required.';
  } else {
    const num = Number(rawAmount);
    if (isNaN(num)) {
      errors.amount = 'Please enter a valid amount.';
    } else if (num < AMOUNT_MIN) {
      errors.amount = 'Amount must be at least 0.01.';
    } else if (num > AMOUNT_MAX) {
      errors.amount = 'Amount must not exceed 999,999,999.99.';
    }
  }

  // --- Category ---
  const trimmedCategory = typeof category === 'string' ? category.trim() : '';
  if (trimmedCategory === '') {
    errors.category = 'Please select a category.';
  } else if (Array.isArray(categories) && !categories.includes(trimmedCategory)) {
    errors.category = 'Please select a category.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ---------------------------------------------------------------------------
// Task 2.5 — Category name validation
// Requirements: 6.1, 6.2, 6.3, 6.6
// ---------------------------------------------------------------------------

const CATEGORY_NAME_REGEX = /^[A-Za-z0-9 \-]{1,50}$/;
const MAX_CATEGORIES = 50;

/**
 * Validate a new category name.
 * @param {string} name               - Candidate name
 * @param {string[]} existingCategories - Current category list (defaults + custom)
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCategoryName(name, existingCategories) {
  const trimmed = typeof name === 'string' ? name.trim() : '';

  if (trimmed === '') {
    return { valid: false, error: 'Category name cannot be empty.' };
  }

  if (!CATEGORY_NAME_REGEX.test(trimmed)) {
    if (trimmed.length > 50) {
      return { valid: false, error: 'Category name must not exceed 50 characters.' };
    }
    return { valid: false, error: 'Category name may only contain letters, numbers, spaces, or hyphens.' };
  }

  const existing = Array.isArray(existingCategories) ? existingCategories : [];

  if (existing.length >= MAX_CATEGORIES) {
    return { valid: false, error: 'Maximum of 50 categories reached.' };
  }

  const isDuplicate = existing.some(
    (cat) => cat.toLowerCase() === trimmed.toLowerCase()
  );
  if (isDuplicate) {
    return { valid: false, error: 'This category already exists.' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Task 2.7 — Balance formatting
// Requirements: 3.1, 3.4, 3.5
// ---------------------------------------------------------------------------

/**
 * Sum all transaction amounts and return a formatted currency string.
 * Positive: "$1,234.56"  |  Zero: "$0.00"  |  Negative: "-$1,234.56"
 * @param {Transaction[]} transactions
 * @returns {string}
 */
function formatBalance(transactions) {
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const abs = Math.abs(total);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return total < 0 ? `-$${formatted}` : `$${formatted}`;
}

// ---------------------------------------------------------------------------
// Task 2.9 — Category totals for pie chart
// Requirements: 4.1, 4.5, 4.6, 4.7
// ---------------------------------------------------------------------------

/**
 * Compute the total positive amount per category across all transactions.
 *
 * Only categories whose aggregate amount is **strictly positive** are included
 * in the result. Categories with a zero or negative total are excluded so the
 * pie chart never renders an empty or nonsensical segment.
 *
 * @param {Transaction[]} transactions
 * @returns {Record<string, number>} Map of category → positive total
 */
function computeCategoryTotals(transactions) {
  // Accumulate raw sums (can be negative if amounts were somehow negative)
  const sums = {};
  for (const tx of transactions) {
    if (typeof tx.category === 'string' && tx.category !== '') {
      sums[tx.category] = (sums[tx.category] || 0) + tx.amount;
    }
  }

  // Keep only strictly positive totals (Requirement 4.1, 4.7)
  const result = {};
  for (const [category, total] of Object.entries(sums)) {
    if (total > 0) {
      result[category] = total;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Task 2.11 — Transaction sorting
// Requirements: 7.1, 7.2, 7.5
// ---------------------------------------------------------------------------

/**
 * Return a sorted copy of the transaction list.
 * Secondary sort is always newest-first (descending createdAt) on ties.
 *
 * @param {Transaction[]} transactions
 * @param {'newest'|'amount-asc'|'amount-desc'|'category-asc'} sortOrder
 * @returns {Transaction[]}
 */
function sortTransactions(transactions, sortOrder) {
  const copy = [...transactions];

  copy.sort((a, b) => {
    switch (sortOrder) {
      case 'amount-asc': {
        const diff = a.amount - b.amount;
        return diff !== 0 ? diff : b.createdAt - a.createdAt;
      }
      case 'amount-desc': {
        const diff = b.amount - a.amount;
        return diff !== 0 ? diff : b.createdAt - a.createdAt;
      }
      case 'category-asc': {
        const cmp = a.category.localeCompare(b.category);
        return cmp !== 0 ? cmp : b.createdAt - a.createdAt;
      }
      case 'newest':
      default:
        return b.createdAt - a.createdAt;
    }
  });

  return copy;
}

// ---------------------------------------------------------------------------
// Module exports (for Node.js / test runners)
// ---------------------------------------------------------------------------

// Conditionally export for Node.js (tests) without breaking browser usage.
// In the browser this block is skipped; the functions remain as globals on the
// window scope so js/app.js can call them directly after loading this script.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    serializeTransactions,
    deserializeTransactions,
    validateTransactionInput,
    validateCategoryName,
    formatBalance,
    computeCategoryTotals,
    sortTransactions,
  };
}
