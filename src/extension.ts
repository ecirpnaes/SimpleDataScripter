'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { DataScripter } from './DataScripter';

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(vscode.commands.registerCommand('extension.scriptTableData', async (oeContext: azdata.ObjectExplorerContext) => {
        if (!oeContext) {
            vscode.window.showErrorMessage("This extension cannot be run from the command menu.");
            return;
        }

        const tableName = `[${oeContext.connectionProfile.databaseName}].[${oeContext.nodeInfo.metadata.schema}].[${oeContext.nodeInfo.metadata.name}]`;
        const options: vscode.InputBoxOptions = {
            prompt: `Press [Enter] to accept the default of all data or edit the SQL to select subsets of data. You can use any valid sql syntax. Note that scripting all data in the table can have serious performance issues for extremely large tables. `,
            value: `select * from ${tableName};`
        };

        const sql = await vscode.window.showInputBox(options);
        if (!sql || sql.trim() === "") {
            vscode.window.showInformationMessage("Query was cancelled");
            return;
        }

        const args: ScriptingArgs = {
            context: oeContext,
            tableName: tableName,
            sqlString: sql
        };

        // run this as a background operation with status displaying in Tasks pane
        const backgroundOperationInfo: azdata.BackgroundOperationInfo = {
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
    const connectionResult: azdata.ConnectionResult = await azdata.connection.connect(args.context.connectionProfile, false, false);
    if (!connectionResult.connected) {
        backgroundOperation.updateStatus(azdata.TaskStatus.Failed, "Could not connect to database server");
        vscode.window.showErrorMessage(connectionResult.errorMessage);
        return;
    }

    const connectionUri: string = await azdata.connection.getUriForConnection(connectionResult.connectionId);
    const providerId: string = args.context.connectionProfile.providerName;
    const databaseName = args.context.connectionProfile.databaseName;
    
    const connectionProvider = azdata.dataprotocol.getProvider<azdata.ConnectionProvider>(providerId, azdata.DataProviderType.ConnectionProvider);
    const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(providerId, azdata.DataProviderType.QueryProvider);
    
    backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, "Getting records...");

    const changeDatabaseResults = await connectionProvider.changeDatabase(connectionUri, databaseName);
    if (!changeDatabaseResults) {
        backgroundOperation.updateStatus(azdata.TaskStatus.Failed, `Could not switch to [${databaseName}] database`);
        vscode.window.showErrorMessage(connectionResult.errorMessage);
        return;
    }

    queryProvider.runQueryAndReturn(connectionUri, args.sqlString).then(
        function (results) {
            if (!results || results.rowCount === 0) {
                backgroundOperation.updateStatus(azdata.TaskStatus.Succeeded, "No data retrieved");
                vscode.window.showErrorMessage("Nothing to script! The query produced no results!");
                return;
            }
            const dataScripter: DataScripter = new DataScripter(results, args.context.nodeInfo.metadata.name);
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
            const message = (error instanceof Error) ? error.message : "There was an unknown error retrieving data";
            backgroundOperation.updateStatus(azdata.TaskStatus.Failed, message);
            vscode.window.showErrorMessage(message);
        });
}

// this method is called when your extension is deactivated
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate(): void {
}

interface ScriptingArgs {
    context: azdata.ObjectExplorerContext;
    tableName: string;
    sqlString: string;
}