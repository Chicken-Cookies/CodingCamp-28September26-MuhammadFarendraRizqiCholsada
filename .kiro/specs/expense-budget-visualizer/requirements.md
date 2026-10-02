# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, manage transaction records, and visualize spending distribution by category. The application runs entirely in the browser with no backend server, stores all data in the browser's Local Storage, and is designed as a standalone web page or browser extension. The interface is minimal, responsive, and accessible across Chrome, Firefox, Edge, and Safari.

---

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense record composed of an item name, a monetary amount, and a category.
- **Category**: A classification label assigned to a Transaction. Default categories are Food, Transport, and Fun. Users may add custom categories.
- **Transaction List**: The scrollable UI component that displays all stored Transactions.
- **Balance Display**: The UI element at the top of the page that shows the current total balance (sum of all transaction amounts).
- **Pie Chart**: The visual chart component that shows spending distribution across categories.
- **Local Storage**: The browser's `localStorage` API used as the sole persistence mechanism.
- **Form**: The input form used to create new Transactions.
- **Category Manager**: The UI component allowing users to define and persist custom categories.
- **Theme Toggle**: The UI control that switches the App between dark and light visual modes.
- **Sort Control**: The UI control that changes the ordering of Transactions in the Transaction List.

---

## Requirements

### Requirement 1: Transaction Input Form

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE Form SHALL provide a text input field for the item name accepting up to 100 characters, a numeric input field for the amount accepting values between 0.01 and 999,999,999.99, and a category selector populated with all available categories.
2. WHEN the user submits the Form with all fields populated with valid values, THE App SHALL create a new Transaction record containing the entered item name, amount, and selected category, and SHALL append it as the most recent entry in the Transaction List.
3. WHEN the user submits the Form with one or more fields empty, THE Form SHALL display an inline validation message adjacent to each empty field identifying which field is missing and SHALL NOT create a Transaction.
4. WHEN the user submits the Form with an amount field containing a value less than 0.01 or greater than 999,999,999.99, THE Form SHALL display an inline validation message indicating the amount must be between 0.01 and 999,999,999.99 and SHALL NOT create a Transaction.
5. WHEN the user submits the Form with an item name exceeding 100 characters, THE Form SHALL display an inline validation message indicating the item name must not exceed 100 characters and SHALL NOT create a Transaction.
6. WHEN a Transaction is successfully created, THE Form SHALL reset the item name field to empty, the amount field to empty, and the category selector to its default first option.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction List SHALL display all stored Transactions, each showing the item name (truncated to 50 characters if longer), formatted monetary amount with a currency symbol and 2 decimal places, and category.
2. WHILE the number of Transactions exceeds the visible height of the Transaction List container, THE Transaction List SHALL be scrollable without affecting the layout of other page components.
3. WHEN a user activates the delete control on a Transaction, THE App SHALL remove that Transaction from the Transaction List and from Local Storage within 1 second, preserving the order of all remaining Transactions.
4. WHEN no Transactions are stored, THE Transaction List SHALL display a placeholder message indicating no transactions have been recorded.
5. IF Local Storage read fails on App load, THEN THE Transaction List SHALL display a placeholder message indicating data could not be loaded.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total expenditure displayed prominently so that I can quickly understand my overall spending.

#### Acceptance Criteria

1. THE Balance Display SHALL show the sum of the amounts of all stored Transactions, formatted as a monetary value with a currency symbol prefix, a thousands separator, and exactly 2 decimal places.
2. WHEN a Transaction is added, THE Balance Display SHALL update to reflect the new total within 1 second without requiring a page reload.
3. WHEN a Transaction is deleted, THE Balance Display SHALL update to reflect the new total within 1 second without requiring a page reload.
4. WHEN no Transactions are stored, THE Balance Display SHALL show a formatted zero value using the same currency symbol, thousands separator, and 2 decimal places format as criterion 1.
5. IF the sum of all stored Transaction amounts is negative, THEN THE Balance Display SHALL display the negative total using the same monetary format as criterion 1, with a leading minus sign before the currency symbol.

---

### Requirement 4: Spending Distribution Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Pie Chart SHALL render a segment for each category that has at least one Transaction with a positive total amount, sized proportionally to that category's percentage share of the sum of all Transaction amounts, where each segment's arc length represents its percentage rounded to two decimal places.
2. WHEN a Transaction is added, THE Pie Chart SHALL update to reflect the new spending distribution within 1 second without requiring a page reload.
3. WHEN a Transaction is deleted, THE Pie Chart SHALL update to reflect the new spending distribution within 1 second without requiring a page reload.
4. WHEN all Transactions are deleted, THE Pie Chart SHALL display a placeholder state in place of the chart segments, containing a message indicating no spending data is available.
5. THE Pie Chart SHALL display a legend identifying each category by name and its associated color, with at most one legend entry per category.
6. WHEN two or more categories share the same computed percentage share, THE Pie Chart SHALL render each as a distinct segment with its own label and color, without merging or omitting any category.
7. IF the total amount of all Transactions is zero, THEN THE Pie Chart SHALL display the same placeholder state as when no Transactions exist, indicating no spending data is available.

---

### Requirement 5: Local Storage Persistence

**User Story:** As a user, I want my transaction data to persist between browser sessions so that I do not lose records when I close or refresh the page.

#### Acceptance Criteria

1. WHEN a Transaction is created, THE App SHALL write the updated Transaction collection to Local Storage before the creation operation is considered complete.
2. WHEN a Transaction is deleted, THE App SHALL write the updated Transaction collection to Local Storage before the deletion operation is considered complete.
3. WHEN the App is loaded, THE App SHALL read all Transactions from Local Storage and render them in the Transaction List, the Balance Display, and the Pie Chart within 2 seconds of the page load event.
4. IF Local Storage is unavailable or a read operation fails, THEN THE App SHALL display a non-dismissible warning banner visible above the Transaction List and operate in session-only mode where no write operations to Local Storage are attempted for the remainder of the session.
5. IF a Local Storage write operation fails after a Transaction is created or deleted, THEN THE App SHALL display an error message indicating that the data could not be saved and that the change may be lost on refresh, without rolling back the in-memory Transaction collection.
6. WHERE a custom category has been created by the user, THE App SHALL persist that category in Local Storage so it is available in future sessions, up to a maximum of 50 custom categories.

---

### Requirement 6: Custom Category Management

**User Story:** As a user, I want to add custom categories beyond the defaults so that I can classify transactions in ways that match my personal spending habits.

#### Acceptance Criteria

1. WHEN the user submits a new category name containing only letters, numbers, spaces, or hyphens and not exceeding 50 characters, THE Category Manager SHALL add the new category to the list of available categories.
2. WHEN the user submits a new category name that is empty, contains only whitespace, contains characters other than letters, numbers, spaces, or hyphens, or exceeds 50 characters, THE Category Manager SHALL display an inline validation message specifying the reason and SHALL NOT add the category.
3. WHEN the user submits a category name that already exists (case-insensitive comparison), THE Category Manager SHALL display an inline validation message indicating the category already exists, preserve the originally stored casing of the existing category, and SHALL NOT add a duplicate.
4. WHEN a valid custom category is added, THE Form's category selector SHALL include the new category immediately without requiring a page reload.
5. THE App SHALL ship with the following default categories pre-loaded: Food, Transport, Fun.
6. THE App SHALL enforce a maximum of 50 total categories (default plus custom combined); WHEN this limit is reached, THE Category Manager SHALL display a message indicating no more categories can be added and SHALL disable the add-category input.

---

### Requirement 7: Transaction Sorting

**User Story:** As a user, I want to sort my transaction list by amount or category so that I can find and review transactions more easily.

#### Acceptance Criteria

1. THE Sort Control SHALL provide options to sort Transactions by amount in ascending order, by amount in descending order, and by category name in ascending alphabetical order, and SHALL default to displaying Transactions in order of entry from most recent to oldest when no sort option has been selected.
2. WHEN the user selects a sort option, THE Transaction List SHALL re-render with Transactions ordered according to the selected sort criteria without requiring a page reload, applying entry order from most recent to oldest as the secondary sort when Transactions share the same amount or the same category name.
3. WHEN Transactions are sorted, THE Balance Display and Pie Chart SHALL remain unchanged.
4. WHEN a new Transaction is added while a sort option is active, THE Transaction List SHALL display the new Transaction in the position corresponding to the active sort order.
5. WHEN a Transaction is deleted while a sort option is active, THE Transaction List SHALL re-render the remaining Transactions ordered according to the active sort criteria.

---

### Requirement 8: Dark / Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light visual modes so that I can use the application comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Theme Toggle SHALL allow a user to switch the App between a dark theme and a light theme, and SHALL visually indicate the currently active theme state at all times.
2. WHEN the user activates the Theme Toggle, THE App SHALL apply the selected theme to all visible UI components — including navigation, forms, transaction list, balance display, chart, and any modals or overlays — without requiring a page reload.
3. WHEN the App is loaded, THE App SHALL apply the theme last selected by the user as stored in Local Storage.
4. IF no theme preference is stored, THEN THE App SHALL apply the light theme as the default.
5. IF Local Storage is unavailable when the App loads, THEN THE App SHALL apply the light theme as the default without displaying an error to the user.

---

### Requirement 9: Browser Compatibility and Performance

**User Story:** As a user, I want the application to work reliably in major browsers and respond without noticeable delay so that my experience is smooth.

#### Acceptance Criteria

1. THE App SHALL be functional in the current stable versions of Chrome, Firefox, Edge, and Safari, where "functional" means all interactive elements respond correctly, no layout elements are missing or broken, and no JavaScript errors appear in the browser console.
2. WHEN the App page is first loaded in a browser with no cached resources on a connection of at least 10 Mbps download speed, THE App SHALL become fully interactive — meaning all buttons, inputs, and interactive elements respond to user input — within 3 seconds.
3. WHEN any user interaction modifies data (add transaction, delete transaction, change sort, toggle theme), THE App SHALL update all affected UI components within 100 milliseconds of the triggering user input event firing.
4. THE App SHALL consist of exactly one HTML file, one CSS file located in a `css/` directory, and one JavaScript file located in a `js/` directory.

---

### Requirement 10: Data Integrity and Round-Trip Persistence

**User Story:** As a developer, I want transaction data serialized to and deserialized from Local Storage correctly so that no data is corrupted or lost between sessions.

#### Acceptance Criteria

1. THE App SHALL serialize the Transaction collection to a JSON string before writing to Local Storage.
2. WHEN the App initializes, THE App SHALL deserialize the JSON string from Local Storage into the in-memory Transaction collection before any Transaction data is rendered in the UI.
3. FOR ALL valid Transaction collections, serializing then deserializing the collection SHALL produce a collection where the Transaction count, field values, field types, and the numeric precision of each `amount` value are identical to the original.
4. IF the JSON string in Local Storage is malformed or cannot be parsed, THEN THE App SHALL discard the corrupted data, clear the Local Storage entry, and initialize with an empty Transaction collection.
5. IF writing to Local Storage fails (e.g., storage quota exceeded or access denied), THEN THE App SHALL retain the Transaction collection in memory for the current session and display an error message indicating that changes could not be saved persistently.
