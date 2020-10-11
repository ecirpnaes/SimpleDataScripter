# Change Log

## 0.1.5

- Bug Fix: Fix export of data from a MFA-enabled connection not specifying the database name.
- Fix contributed by : [Greybird](https://github.com/Greybird)

## 0.1.4

- Bug fix: Database collation fix where certain collations (like Germany), store decimals with a comma instead of a period for the precision. (eg. 23.43 (EU) --> 34,45(GE). This causes issues when scripting as the comma is the separator between column inserts.

## 0.1.3

- Bug fix where identity insert was not always getting set properly.
- Added (partial) suport for spatial objects.

### 0.1.2

- Show context menu on View nodes to enable scripting of View data as well as Table data

### 0.1.1

- Ensure data retrieval query is run in proper database context

### 0.1.0

- Initial release.
