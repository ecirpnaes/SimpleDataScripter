'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { DataScripter } from './DataScripter';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.scriptTableData', async (oeContext: azdata.ObjectExplorerContext) => {
        if (!oeContext) {
            vscode.window.showErrorMessage("This exenstion cannot be run from the command menu.");
            return;
        }

        let backgroundOperationInfo: azdata.BackgroundOperationInfo = {
            connection: undefined,
            displayName: `Scripting Data for : [${oeContext.nodeInfo.metadata.schema}].[${oeContext.nodeInfo.metadata.name}]`,
            description: "A data scripting operation",
            isCancelable: true,
            operation: (operation: azdata.BackgroundOperation) => {
                return scriptData(operation, oeContext);
            }
        };
        azdata.tasks.startBackgroundOperation(backgroundOperationInfo);
    }));
}

async function scriptData(backgroundOperation: azdata.BackgroundOperation, oeContext: azdata.ObjectExplorerContext) {
    let connectionResult: azdata.ConnectionResult = await azdata.connection.connect(oeContext.connectionProfile, false, false);
    if (!connectionResult.connected) {
        vscode.window.showErrorMessage("Cannot create connection to database!");
        return;
    }
    let connectionUri: string = await azdata.connection.getUriForConnection(connectionResult.connectionId);
    let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
    let tableName: string = `[${oeContext.connectionProfile.databaseName}].[${oeContext.nodeInfo.metadata.schema}].[${oeContext.nodeInfo.metadata.name}]`;
    let sql = 'select  * from ' + tableName;

    backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, "Getting records...");
    let results: azdata.SimpleExecuteResult = await queryProvider.runQueryAndReturn(connectionUri, sql);

    if (!results || results.rowCount === 0) {
        backgroundOperation.updateStatus(azdata.TaskStatus.Succeeded, "No data..");
        vscode.window.showErrorMessage("There was no data!");
        return;
    }
    backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, "Parsing records...");

    try {
        let dataScripter: DataScripter = new DataScripter(results, oeContext.nodeInfo.metadata.name);
        let textDocument: vscode.TextDocument = await vscode.workspace.openTextDocument({ language: 'sql' });
        let textEditor: vscode.TextEditor = await vscode.window.showTextDocument(textDocument, 1, false);
        textEditor.edit(editBuilder => {
            editBuilder.insert(new vscode.Position(0, 0), dataScripter.Script());
        });
    }
    catch (error) {
        backgroundOperation.updateStatus(azdata.TaskStatus.Failed, "Error");
        vscode.window.showErrorMessage("There was no data!");
        return;
    }
    backgroundOperation.updateStatus(azdata.TaskStatus.Succeeded);
}

// this method is called when your extension is deactivated
export function deactivate() {
}