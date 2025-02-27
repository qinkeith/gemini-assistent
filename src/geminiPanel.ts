// File: src/geminiPanel.ts
import * as vscode from 'vscode';
import * as marked from 'marked';
import { GeminiService } from './geminiService';

export class GeminiPanel {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly geminiService: GeminiService
  ) {}

  public showPanel(question: string, answer: string): void {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this.panel) {
      // If we already have a panel, show it in the current column
      this.panel.reveal(columnToShowIn);
      this.updateContent(question, answer);
    } else {
      // Otherwise, create a new panel
      this.panel = vscode.window.createWebviewPanel(
        'geminiAssistant',
        'Gemini Assistant',
        columnToShowIn || vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, 'media')
          ]
        }
      );

      // Set initial content
      this.updateContent(question, answer);

      // Handle panel disposal
      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
          this.disposables.forEach(d => d.dispose());
          this.disposables = [];
        },
        null,
        this.disposables
      );

      // Handle messages from the webview
      this.panel.webview.onDidReceiveMessage(
        message => {
          switch (message.command) {
            case 'insertCode':
              const editor = vscode.window.activeTextEditor;
              if (editor) {
                editor.edit(editBuilder => {
                  editBuilder.insert(editor.selection.active, message.code);
                });
              }
              break;
          }
        },
        null,
        this.disposables
      );
    }
  }

  private updateContent(question: string, answer: string): void {
    if (!this.panel) {
      return;
    }

    // Convert markdown to HTML for the response
    // Ensure we're getting a string by using marked.parse synchronously
    const htmlAnswer = marked.marked(answer) as string; // Use marked() directly    

    this.panel.webview.html = this.getWebviewContent(question, htmlAnswer);
  }

  private getWebviewContent(question: string, answer: string): string {
    // Create HTML content for the webview
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gemini Assistant</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-editor-foreground);
          background-color: var(--vscode-editor-background);
        }
        .message {
          margin-bottom: 20px;
          padding: 10px;
          border-radius: 5px;
        }
        .user-message {
          background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .assistant-message {
          background-color: var(--vscode-editor-selectionBackground);
        }
        .message-header {
          font-weight: bold;
          margin-bottom: 10px;
        }
        pre {
          background-color: var(--vscode-editor-background);
          padding: 10px;
          border-radius: 3px;
          overflow: auto;
          position: relative;
        }
        code {
          font-family: var(--vscode-editor-font-family);
        }
        .copy-button {
          position: absolute;
          top: 5px;
          right: 5px;
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 3px;
          padding: 5px 10px;
          cursor: pointer;
          font-size: 12px;
        }
        .insert-button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 3px;
          padding: 5px 10px;
          margin-top: 5px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="message user-message">
        <div class="message-header">You:</div>
        <div>${question.replace(/\n/g, '<br>')}</div>
      </div>
      <div class="message assistant-message">
        <div class="message-header">Gemini:</div>
        <div class="response-content">${this.processCodeBlocks(answer)}</div>
      </div>
      <script>
        (function() {
          // Handle code block interactions
          document.querySelectorAll('pre').forEach((block, index) => {
            // Extract code content
            const code = block.querySelector('code').innerText;
            
            // Add copy button
            const copyButton = document.createElement('button');
            copyButton.textContent = 'Copy';
            copyButton.className = 'copy-button';
            copyButton.onclick = () => {
              navigator.clipboard.writeText(code);
              copyButton.textContent = 'Copied!';
              setTimeout(() => {
                copyButton.textContent = 'Copy';
              }, 2000);
            };
            block.appendChild(copyButton);
            
            // Add insert button for code blocks
            const insertButton = document.createElement('button');
            insertButton.textContent = 'Insert into Editor';
            insertButton.className = 'insert-button';
            insertButton.onclick = () => {
              // Send message to extension
              vscode.postMessage({
                command: 'insertCode',
                code: code
              });
            };
            
            // Create container for the insert button
            const buttonContainer = document.createElement('div');
            buttonContainer.appendChild(insertButton);
            
            // Add after the code block
            block.parentNode.insertBefore(buttonContainer, block.nextSibling);
          });
          
          // Define vscode API for message posting
          const vscode = acquireVsCodeApi();
        })();
      </script>
    </body>
    </html>`;
  }

  private processCodeBlocks(html: string): string {
    // Add functionality to code blocks
    // This is a simple approach - in a real extension, you might use a more robust HTML parsing
    return html.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, 
      (_match, language, code) => {
        return `<pre><code class="language-${language}">${code}</code></pre>`;
      }
    );
  }
}