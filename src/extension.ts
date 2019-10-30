'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { DataScripter } from './DataScripter';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.scriptTableData', async (oeContext: azdata.ObjectExplorerContext) => {
        if (!oeContext) {
            vscode.window.showErrorMessage("This extension cannot be run from the command menu.");
            return;
        }

        let tableName: string = `[${oeContext.connectionProfile.databaseName}].[${oeContext.nodeInfo.metadata.schema}].[${oeContext.nodeInfo.metadata.name}]`;
        let options: vscode.InputBoxOptions = {
            prompt: `Press [Enter] to accept the default of all data or edit the SQL to select subsets of data. You can use any valid sql syntax. Note that scripting all data in the table can have serious performance issues for extremely large tables. `,
            value: `select * from ${tableName};`
        };

        let sql = await vscode.window.showInputBox(options);
        if (!sql || sql.trim() === "") {
            vscode.window.showInformationMessage("Query was cancelled");
            return;
        }

        // Ensure that we run this query in the proper context by prepending a "use {database};"
        sql = `Use [${oeContext.connectionProfile.databaseName}]; ` + sql;

        let args: ScriptingArgs = {
            context: oeContext,
            tableName: tableName,
            sqlString: sql
        };

        // run this as a background operation with status displaying in Tasks pane
        let backgroundOperationInfo: azdata.BackgroundOperationInfo = {
            connection: undefined,
            displayName: `Scripting Data for : ${tableName} `,
            description: "A data scripting operation",
            isCancelable: true,
            operation: (operation: azdata.BackgroundOperation) => {
                return scriptData(operation, args);
            }
        };
        azdata.tasks.startBackgroundOperation(backgroundOperationInfo);
    }));
}

async function scriptData(backgroundOperation: azdata.BackgroundOperation, args: ScriptingArgs) {
    let connectionResult: azdata.ConnectionResult = await azdata.connection.connect(args.context.connectionProfile, false, false);
    if (!connectionResult.connected) {
        backgroundOperation.updateStatus(azdata.TaskStatus.Failed, "Could not connect to database");
        vscode.window.showErrorMessage(connectionResult.errorMessage);
        return;
    }

    let connectionUri: string = await azdata.connection.getUriForConnection(connectionResult.connectionId);
    let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);

    backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, "Getting records...");

    queryProvider.runQueryAndReturn(connectionUri, args.sqlString).then(
        function (results) {
            if (!results || results.rowCount === 0) {
                backgroundOperation.updateStatus(azdata.TaskStatus.Succeeded, "No data retrieved");
                vscode.window.showErrorMessage("Nothing to script! The query produced no results!");
                return;
            }
            let dataScripter: DataScripter = new DataScripter(results, args.context.nodeInfo.metadata.name);
            backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, "Parsing records...");
            vscode.workspace.openTextDocument({ language: 'sql' }).then(textDocument => {
                vscode.window.showTextDocument(textDocument, 1, false).then(textEditor => {
                    textEditor.edit(editBuilder => {
                        editBuilder.insert(new vscode.Position(0, 0), dataScripter.Script());
                        backgroundOperation.updateStatus(azdata.TaskStatus.Succeeded);
                    });
                });
            });
        },
        function (error) {
            let message = (error instanceof Error) ? error.message : "There was an error retrieving data!";
            backgroundOperation.updateStatus(azdata.TaskStatus.Failed, message);
            vscode.window.showErrorMessage(message);
        });
}

// this method is called when your extension is deactivated
export function deactivate() {
}

interface ScriptingArgs {
    context: azdata.ObjectExplorerContext;
    tableName: string;
    sqlString: string;
}