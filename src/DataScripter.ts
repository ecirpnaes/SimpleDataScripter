import * as azdata from 'azdata';

export class DataScripter {
    private _resultSet: azdata.SimpleExecuteResult;
    private _tableName: string;

    constructor(resultSet: azdata.SimpleExecuteResult, tableName: string) {
        this._tableName = tableName;
        this._resultSet = resultSet;
    }

    public Script(): string {
        let scripted: string[] = [];

        // store each row of scripted data in an array
        for (let i: number = 0; i !== this._resultSet.rowCount; i++) {
            scripted.push(this.getDataRow(this._resultSet.rows[i], i === this._resultSet.rowCount - 1));
        }

        // do we need to set identity off?
        if (this.hasIdentityColumn()) {
            scripted.push(`\nset identity_insert [#temp${this._tableName}] off;`);
        }

        // return the temp table, and insert script, separated by line breaks
        return this.getTempTableSql() + "\n\n" + this.getInsertTableDefinitionSql() + " \n\n" + scripted.join('\n');
    }

    // construct the "Insert <tableName> (column1, column2...)" string.
    // technically we only need to explicitly use the full column list if we
    // have an identity column, but as we are doing inserts using
    // the "insert <table> select ...union all" method, we only need the column list once.
    // If we were doing "insert into <table> (columns..) values (....)" method on each
    // line, the file size would increase tremendously
    private getInsertTableDefinitionSql(): string {
        let insert: string[] = [];
        let identityOn: string = "";

        // grab each column from our resultset metadata
        this._resultSet.columnInfo.forEach(column => {
            insert.push(`[${column.columnName}]`);
        });

        // script our identity_insert line if needed
        if (this.hasIdentityColumn()) {
            identityOn = `\nset identity_insert [#temp${this._tableName}] on;\n\n`;
        }

        // return the list in "(column1, column2, column2)" format
        return `${identityOn}insert [#temp${this._tableName}] (${insert.join(",")})`;
    }

    // do we have an identity column in our resultset?
    private hasIdentityColumn(): boolean {
        return this._resultSet.columnInfo.some(function (column, index, array) {
            return column.isIdentity;
        });
    }

    // construct a temp table based on the metadata from the resultset
    // we comment this out by default
    private getTempTableSql(): string {
        let columnInfo: azdata.IDbColumn[] = this._resultSet.columnInfo;
        let create: string[] = [];
        create.push(`--create table [#temp${this._tableName}] (`);

        for (let i: number = 0; i !== columnInfo.length; i++) {
            let dataType: string = this.getDataType(columnInfo[i]);
            let isNull: string = columnInfo[i].allowDBNull ? " NULL" : "";
            let isIdentity: string = columnInfo[i].isIdentity ? " identity" : "";
            let tail: string = (i === columnInfo.length - 1) ? ");" : ",";
            create.push(`--[${columnInfo[i].columnName}] ${dataType}${isNull}${isIdentity}${tail}`);
        }
        return create.join("\n");
    }

    // Gets the datatype of the column, formatted for the create table statement
    private getDataType(columnInfo: azdata.IDbColumn): string {
        // does anyone still use (n)text datatypes? // (n)varchar(200)
        if (columnInfo.dataTypeName.indexOf("char") >= 0 || columnInfo.dataTypeName.indexOf("text") >= 0) {
            return `[${columnInfo.dataTypeName}] (${columnInfo.columnSize === 2147483647 ? "max" : columnInfo.columnSize})`;
        }

        // decimal (18,4), numeric(3,4)
        if (columnInfo.dataTypeName === "decimal" || columnInfo.dataTypeName === "numeric") {
            return `[${columnInfo.dataTypeName}] (${columnInfo.numericPrecision},${columnInfo.numericScale})`;
        }

        // everything else. 
        return `[${columnInfo.dataTypeName}]`;
    }

    // scripts the data for each row
    // NOTE: skipping image and binary data. Using NULL as conversion to text makes filesize HUGE
    private getDataRow(row: azdata.DbCellValue[], isLastRow: boolean): string {
        let rowData: string[] = [];
        try {
            for (let i: number = 0; i !== this._resultSet.columnInfo.length; i++) {
                if (row[i].isNull) {
                    rowData.push("NULL");
                    continue;
                }
                switch (this._resultSet.columnInfo[i].dataTypeName) {
                    case "varchar":
                    case "nvarchar":
                    case "char":
                    case "nchar":
                    case "text":
                    case "ntext":
                    case "xml":
                        rowData.push(`'${row[i].displayValue.replace(/'+/g, "''")}'`);
                        break;
                    case "date":
                    case "datetime":
                    case "datetime2":
                    case "smalldatetime":
                    case "time":
                        rowData.push(`'${row[i].displayValue}'`);
                        break;
                    case "bit":
                    case "decimal":
                    case "money":
                    case "smallmoney":
                    case "int":
                    case "bigint":
                    case "smallint":
                    case "tinyint":
                    case "numeric":
                    case "real":
                    case "float":
                        rowData.push(row[i].displayValue);
                        break;
                    case "uniqueidentifier":
                        rowData.push(`'{${row[i].displayValue}}'`);
                        break;
                    case "binary":
                    case "image":
                    case "timestamp":
                    case "varbinary":
                        rowData.push("NULL");
                        break;
                    default:
                        rowData.push(`'${row[i].displayValue}'`);
                        break;
                }
            }
        } catch (e) {
            if (e instanceof Error) {
                console.log(e);
                rowData.push("");
            }
            else {
                throw e;
            }
        }
        // return select value1, value2, value...;
        return "select " + rowData.join(",") + ((isLastRow) ? ";" : " UNION ALL");
    }
}