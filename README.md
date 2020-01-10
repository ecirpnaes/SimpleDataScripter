# ![Feature](https://raw.githubusercontent.com/ecirpnaes/SimpleDataScripter/master/images/logo.png)Azure Data Studio - Simple Data Scripter

This extension provides a quick and easy way to migrate data between tables by generating insert scripts based on the result sets of a query. It defaults to generating all data from a given table (based on the table selected via a context menu), but the default sql can be modifed to generate subsets of data.

## Installation

The current release is available to [download as a .vsix file](https://github.com/ecirpnaes/SimpleDataScripter/releases/download/0.1.3/simple-data-scripter-0.1.3.vsix) and can be installed by opening the File Menu and selecting `Install Extension from VSIX Package`

## Features

Right-click on a Table or View node to bring up a [`Script Table Data`] context menu. An input box will open showing the default SQL of selecting all data. You can simply press [Enter] to accept the default or the SQL using a WHERE clause, joins on other tables, etc... Any valid SQL is acceptable. Press [Enter] to run the query.
The data will be scripted to a new SQL Editor window.
![Feature](https://raw.githubusercontent.com/ecirpnaes/SimpleDataScripter/master/images/Scripting.gif)

## Known Issues

- This has only been tested with the MSSQL provider, i.e. Microsoft SQL Server. If there are any issues found with other flavors of SQL, (MySql, etc..) please report them at <https://github.com/ecirpnaes/SimpleDataScripter/issues>
- Scripting of binary data (binary, varbinary, image) is not currently supported.

## Unknown Issues

Can be raised here: <https://github.com/ecirpnaes/SimpleDataScripter/issues>

## Releases

### Current Version - 0.1.3

## Change Log

Can be found here: <https://raw.githubusercontent.com/ecirpnaes/SimpleDataScripter/master/CHANGELOG.md>


