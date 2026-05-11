import {
  createConnection,
  ProposedFeatures,
  TextDocumentSyncKind,
  type InitializeResult,
} from 'vscode-languageserver/node.js';
import { onDefinition } from './lsp/definition.js';
import { onHover } from './lsp/hover.js';
import { onReferences } from './lsp/references.js';

export function startLsp(): void {
  const connection = createConnection(ProposedFeatures.all);

  connection.onInitialize((): InitializeResult => ({
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.None,
      definitionProvider: true,
      hoverProvider: true,
      referencesProvider: true,
    },
  }));

  connection.onDefinition(params => onDefinition(params));
  connection.onHover(params => onHover(params));
  connection.onReferences(params => onReferences(params));

  connection.listen();
}
