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

        for (let i: number = 0; i !== this._resultSet.rowCount; i++) {
            scripted.push(this.getDataRow(this._resultSet.rows[i], i === this._resultSet.rowCount - 1));
            if (i % 100 === 0) { console.log("count = " + i.toString()); }
        }
        // do we need to set identity off?
        scripted.push(this.hasIdentityColumn() ? `\nset identity_insert [#temp${this._tableName}] off;` : "");
        return this.getTempTableSql() + "\n\n" + this.getInsertTableDefinitionSql() + " \n\n" + scripted.join('\n');
    }

    private getInsertTableDefinitionSql(): string {
        let insert: string[] = [];
        let identityOn: string = "";

        this._resultSet.columnInfo.forEach(column => {
            insert.push(`[${column.columnName}]`);
        });

        if (this.hasIdentityColumn()) {
            identityOn = `\nset identity_insert [#temp${this._tableName}] on;\n\n`;
        }

        return `${identityOn}insert [#temp${this._tableName}] (${insert.join(",")})`;
    }

    private hasIdentityColumn(): boolean {
        return this._resultSet.columnInfo.some(function (column, index, array) {
            return column.isIdentity;
        });
    }

    private getTempTableSql(): string {
        let columnInfo: azdata.IDbColumn[] = this._resultSet.columnInfo;
        let create: string[] = [];
        create.push(`--create table [#temp${this._tableName}] (`);

        for (let i: number = 0; i !== columnInfo.length; i++) {
            let dataType: string = this.getDataType(columnInfo[i]);
            let isNull: string = columnInfo[i].allowDBNull ? " NULL" : "";
            let column: string = `--[${columnInfo[i].columnName}] ${dataType}${isNull}`;
            column += (i === columnInfo.length - 1) ? ");" : ",";
            create.push(column);
        }
        return create.join("\n");
    }

    private getDataType(columnInfo: azdata.IDbColumn): string {
        if (columnInfo.dataTypeName.indexOf("char") >= 0) {
            return `[${columnInfo.dataTypeName}] (${columnInfo.columnSize === 2147483647 ? "max" : columnInfo.columnSize})`;
        }
        return `[${columnInfo.dataTypeName}]` + `${columnInfo.isIdentity ? " identity" : ""}`;
    }

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
                        rowData.push(`'${row[i].displayValue.replace(/'+/g, "''")}'`);
                        break;
                    case "datetime":
                    case "datetime2":
                    case "smalldatetime":
                        rowData.push(`'${row[i].displayValue}'`);
                        break;
                    case "binary":
                    case "image":
                    case "timestamp":
                    case "varbinary":
                        rowData.push("NULL");
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
        return "select " + rowData.join(",") + ((isLastRow) ? ";" : " UNION ALL");
    }
}