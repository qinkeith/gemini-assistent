// File: src/extension.ts
import * as vscode from 'vscode';
import { GeminiService } from './geminiService';
import { GeminiPanel } from './geminiPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('Gemini Assistant is now active');

  // Initialize the Gemini service
  const geminiService = new GeminiService();
  
  // Create and register the webview panel provider
  const geminiPanel = new GeminiPanel(context.extensionUri, geminiService);
  
  // Register TreeView
  const treeDataProvider = new GeminiChatProvider(geminiService);
  vscode.window.createTreeView('geminiAssistantView', { 
    treeDataProvider, 
    showCollapseAll: true 
  });

  // Register command to ask Gemini a question
  let askGeminiCommand = vscode.commands.registerCommand('geminiAssistant.askGemini', async () => {
    const editor = vscode.window.activeTextEditor;
    
    // Get the selected text or entire file content
    let codeContext = '';
    if (editor) {
      const selection = editor.selection;
      if (!selection.isEmpty) {
        codeContext = editor.document.getText(selection);
      } else {
        codeContext = editor.document.getText();
      }
    }
    
    // Get user input
    const userInput = await vscode.window.showInputBox({
      placeHolder: 'Ask Gemini about your code...',
      prompt: 'Enter your question or request for the AI assistant'
    });
    
    if (userInput) {
      // Show progress while waiting for the API response
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Asking Gemini...",
        cancellable: false
      }, async (_progress) => {
        try {
          // Send the request to Gemini
          const response = await geminiService.queryGemini(userInput, codeContext);
          
          // Show the response in the panel
          geminiPanel.showPanel(userInput, response);
          
          // Update the tree view
          treeDataProvider.refresh();
          
          return Promise.resolve();
        } catch (error) {
          vscode.window.showErrorMessage(`Error communicating with Gemini: ${error}`);
          return Promise.reject(error);
        }
      });
    }
  });

  // Register command to clear chat history
  let clearChatCommand = vscode.commands.registerCommand('geminiAssistant.clearChat', () => {
    geminiService.clearChatHistory();
    treeDataProvider.refresh();
    vscode.window.showInformationMessage('Chat history cleared');
  });

  context.subscriptions.push(askGeminiCommand, clearChatCommand);
}

export function deactivate() {}

// TreeView data provider for showing chat history
class GeminiChatProvider implements vscode.TreeDataProvider<ChatItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ChatItem | undefined | null | void> = new vscode.EventEmitter<ChatItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ChatItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private geminiService: GeminiService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ChatItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ChatItem): Thenable<ChatItem[]> {
    if (element) {
      return Promise.resolve([]);
    } else {
      const chatHistory = this.geminiService.getChatHistory();
      return Promise.resolve(
        chatHistory.map(item => {
          const chatItem = new ChatItem(
            item.isUser ? `You: ${item.text.substring(0, 30)}...` : `Gemini: ${item.text.substring(0, 30)}...`,
            item.isUser ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.None
          );
          chatItem.tooltip = item.text;
          chatItem.iconPath = item.isUser 
            ? new vscode.ThemeIcon('account') 
            : new vscode.ThemeIcon('hubot');
          return chatItem;
        })
      );
    }
  }
}

class ChatItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}