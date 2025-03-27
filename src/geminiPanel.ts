// File: src/geminiPanel.ts
import * as vscode from 'vscode';
import * as marked from 'marked';
import { GeminiService } from './geminiService';

export class GeminiPanel {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  public currentQuestion: string | undefined;
  public currentAnswer: string | undefined;
  private static readonly viewType = 'geminiAssistant';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly geminiService: GeminiService,
    private readonly context: vscode.ExtensionContext
  ) {
    this.currentQuestion = this.context.globalState.get<string>('geminiQuestion');
    this.currentAnswer = this.context.globalState.get<string>('geminiAnswer');
    this.revivePanel();
  }

  private revivePanel() {
    if (this.currentQuestion && this.currentAnswer) {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

      this.panel = vscode.window.createWebviewPanel(
        GeminiPanel.viewType,
        'Gemini Assistant',
        { viewColumn: columnToShowIn || vscode.ViewColumn.One, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
        }
      );

      this.updateContent(this.currentQuestion, this.currentAnswer);
      this.setupPanelListeners();
    }
  }

  public showPanel(question: string, answer: string): void {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this.panel) {
      this.panel.reveal(columnToShowIn);
      this.updateContent(question, answer);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        GeminiPanel.viewType,
        'Gemini Assistant',
        columnToShowIn || vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
        }
      );

      this.updateContent(question, answer);
      this.setupPanelListeners();
    }
  }

  private setupPanelListeners() {
    if (!this.panel) return;

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.disposables.forEach((d) => d.dispose());
      this.disposables = [];
    }, null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'insertCode':
            const editor = vscode.window.activeTextEditor;
            if (editor) {
              editor.edit((editBuilder) => {
                editBuilder.insert(editor.selection.active, message.code);
              });
            }
            break;
          case 'saveContent':
            this.saveWebviewContent();
            break;
          case 'cutContent':
            this.cutContent();
            break;
        }
      },
      null,
      this.disposables
    );

    this.injectContextMenuScript();
  }

 private injectContextMenuScript() {
    if (!this.panel) return;

    // Add some basic CSS for hover effects
    const css = `
      <style>
        #custom-context-menu > div:hover {
          background-color: var(--vscode-menu-selectionBackground);
          color: var(--vscode-menu-selectionForeground);
        }
      </style>
    `;

    const script = `
      <script>
        const vscode = acquireVsCodeApi();
        let currentSelection = null; // Store selection info

        // --- Helper Function to Remove Menu ---
        function removeContextMenu() {
          const existingContextMenu = document.getElementById('custom-context-menu');
          if (existingContextMenu) {
            existingContextMenu.remove();
          }
          // Clean up the outside click listener
          document.removeEventListener('click', handleClickOutside);
          currentSelection = null; // Clear stored selection
        }

        // --- Helper Function for Outside Click ---
        function handleClickOutside(event) {
          const contextMenu = document.getElementById('custom-context-menu');
          // Check if the click is outside the menu
          if (contextMenu && !contextMenu.contains(event.target)) {
            removeContextMenu();
          }
        }

        // --- Context Menu Listener ---
        document.addEventListener('contextmenu', event => {
          event.preventDefault();
          removeContextMenu(); // Remove any existing menu first

          // Store the selection *when the menu is opened*
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
              currentSelection = {
                  text: selection.toString(),
                  range: selection.getRangeAt(0).cloneRange() // Clone range for potential later use
              };
          } else {
              currentSelection = null; // No active selection
          }

          const contextMenu = document.createElement('div');
          contextMenu.id = 'custom-context-menu';
          contextMenu.style.position = 'absolute';
          contextMenu.style.left = event.pageX + 'px';
          contextMenu.style.top = event.pageY + 'px';
          contextMenu.style.backgroundColor = 'var(--vscode-menu-background)';
          contextMenu.style.color = 'var(--vscode-menu-foreground)';
          contextMenu.style.border = '1px solid var(--vscode-menu-border)';
          contextMenu.style.padding = '5px 0'; // Adjust padding
          contextMenu.style.zIndex = '1000';
          contextMenu.style.borderRadius = '5px';
          contextMenu.style.display = 'flex';
          contextMenu.style.flexDirection = 'column';
          contextMenu.style.minWidth = '100px'; // Give it some width

          // --- Save Option ---
          const saveOption = document.createElement('div');
          saveOption.textContent = 'Save to File';
          saveOption.style.cursor = 'pointer';
          saveOption.style.padding = '5px 10px';
          saveOption.addEventListener('click', () => {
            vscode.postMessage({ command: 'saveContent' });
            removeContextMenu();
          });
          contextMenu.appendChild(saveOption);

          // --- Cut Option ---
          const cutOption = document.createElement('div');
          cutOption.textContent = 'Cut';
          cutOption.style.padding = '5px 10px';

          // Only enable 'Cut' if there was a selection when the menu opened
          if (currentSelection && currentSelection.text) {
            cutOption.style.cursor = 'pointer';
            cutOption.addEventListener('click', () => {
              if (currentSelection && currentSelection.text) {
                // 1. Copy to clipboard
                navigator.clipboard.writeText(currentSelection.text)
                  .then(() => {
                    // 2. Delete the selection from the DOM using the stored range
                    // Make sure the selection is still visually selected (optional but good practice)
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(currentSelection.range);

                    // Use the more robust Range.deleteContents()
                    currentSelection.range.deleteContents();

                    // 3. Notify the extension (optional)
                    vscode.postMessage({
                      command: 'contentWasCut', // Use a different command name
                      text: currentSelection.text
                    });

                    console.log('Cut successful:', currentSelection.text);
                  })
                  .catch(err => {
                    console.error('Failed to cut to clipboard:', err);
                    // Optionally notify the user or extension of the failure
                    vscode.postMessage({ command: 'cutFailed', error: err.message });
                  })
                  .finally(() => {
                     // 4. Remove the context menu regardless of success/failure
                     removeContextMenu();
                  });
              } else {
                // Fallback if selection somehow got lost (shouldn't happen with this logic)
                removeContextMenu();
              }
            });
          } else {
            // Disable the option if no text was selected
            cutOption.style.cursor = 'default';
            cutOption.style.color = 'var(--vscode-disabledForeground)'; // Use VS Code's disabled color
          }
          contextMenu.appendChild(cutOption);

          // --- Append Menu and Add Listener ---
          document.body.appendChild(contextMenu);
          // Add the listener *after* the menu is added to avoid immediate removal
          // Use setTimeout to defer adding the listener slightly, preventing the
          // contextmenu event's propagation from immediately triggering it.
          setTimeout(() => {
             document.addEventListener('click', handleClickOutside);
          }, 0);
        });

        // No longer need the 'cutText' listener from the extension side
        // window.addEventListener('message', event => { ... });

      </script>
    `;

    // Inject CSS and Script
    if (this.panel.webview.html.includes('</head>')) {
      this.panel.webview.html = this.panel.webview.html.replace('</head>', css + '</head>');
    }
    if (this.panel.webview.html.includes('</body>')) {
      this.panel.webview.html = this.panel.webview.html.replace('</body>', script + '</body>');
    }
  }


  public updateContent(question: string, answer: string): void {
    if (!this.panel) {
      return;
    }

    const htmlAnswer = new marked.Parser().parse(marked.Lexer.lex(answer));
    let existingContent = this.panel.webview.html;

    if (!existingContent.includes('<html')) {
      existingContent = '<!DOCTYPE html>\n' +
        '<html lang="en">\n' +
        '<head>\n' +
        '  <meta charset="UTF-8">\n' +
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '  <title>Gemini Assistant</title>\n' +
        '  <style>\n' +
        '    body {\n' +
        '      font-family: var(--vscode-font-family);\n' +
        '      padding: 20px;\n' +
        '      color: var(--vscode-editor-foreground);\n' +
        '      background-color: var(--vscode-editor-background);\n' +
        '    }\n' +
        '    .message {\n' +
        '      margin-bottom: 20px;\n' +
        '      padding: 10px;\n' +
        '      border-radius: 5px;\n' +
        '    }\n' +
        '    .user-message {\n' +
        '      background-color: var(--vscode-editor-inactiveSelectionBackground);\n' +
        '    }\n' +
        '    .assistant-message {\n' +
        '      background-color: var(--vscode-editor-selectionBackground);\n' +
        '    }\n' +
        '    .message-header {\n' +
        '      font-weight: bold;\n' +
        '      margin-bottom: 10px;\n' +
        '    }\n' +
        '    pre {\n' +
        '      background-color: var(--vscode-editor-background);\n' +
        '      padding: 10px;\n' +
        '      border-radius: 3px;\n' +
        '      overflow: auto;\n' +
        '      position: relative;\n' +
        '    }\n' +
        '    code {\n' +
        '      font-family: var(--vscode-editor-font-family);\n' +
        '    }\n' +
        '    .copy-button {\n' +
        '      position: absolute;\n' +
        '      top: 5px;\n' +
        '      right: 5px;\n' +
        '      background-color: var(--vscode-button-background);\n' +
        '      color: var(--vscode-button-foreground);\n' +
        '      border: none;\n' +
        '      border-radius: 3px;\n' +
        '      padding: 5px 10px;\n' +
        '      cursor: pointer;\n' +
        '      font-size: 12px;\n' +
        '    }\n' +
        '    .insert-button {\n' +
        '      background-color: var(--vscode-button-background);\n' +
        '      color: var(--vscode-button-foreground);\n' +
        '      border: none;\n' +
        '      border-radius: 3px;\n' +
        '      padding: 5px 10px;\n' +
        '      margin-top: 5px;\n' +
        '      cursor: pointer;\n' +
        '    }\n' +
        '  </style>\n' +
        '</head>\n' +
        '<body>' + existingContent + '</body>\n' +
        '</html>';
    }

    this.panel.webview.html = existingContent + this.getWebviewContent(question, htmlAnswer);
    this.saveState(question, answer);
    this.currentQuestion = question;
    this.currentAnswer = answer;
    this.injectContextMenuScript();
  }

  public saveState(question: string, answer: string): void {
    this.context.globalState.update('geminiQuestion', question);
    this.context.globalState.update('geminiAnswer', answer);
  }

  private getWebviewContent(question: string, answer: string): string {
    return `
      <div class="message user-message">
        <div class="message-header">You:</div>
        <div>${question.replace(/\n/g, '<br>')}</div>
      </div>
      <div class="message assistant-message">
        <div class="message-header">Gemini:</div>
        <div class="response-content">${this.processCodeBlocks(answer)}</div>
      </div>
    `;
  }

  private processCodeBlocks(html: string): string {
    return html.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
      (_match, language, code) => {
        return `<pre><code class="language-${language}">${code}</code></pre>`;
      }
    );
  }

  private async saveWebviewContent() {
    if (!this.panel) {
      return;
    }

    const webviewContent = this.panel.webview.html;
    const start = webviewContent.indexOf('<div class="message user-message">');
    const end = webviewContent.lastIndexOf('<div class="message assistant-message">');

    if (start === -1 || end === -1) {
      vscode.window.showErrorMessage(`No content to save`);
      return;
    }

    const content = webviewContent.substring(start, webviewContent.length);
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini Chat</title>
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
    </style>
</head>
<body>
    ${content}
</body>
</html>`;

    const options: vscode.SaveDialogOptions = {
      defaultUri: vscode.Uri.parse('gemini_content.html'),
      filters: {
        'HTML files': ['html']
      }
    };

    const uri = await vscode.window.showSaveDialog(options);
    if (uri) {
      try {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(fullHtml, 'utf8'));
        vscode.window.showInformationMessage(`Gemini content saved to ${uri.fsPath}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to save Gemini content: ${error}`);
      }
    }
  }

  private cutContent() {
    if (!this.panel) {
      return;
    }
    this.panel.webview.postMessage({ command: 'cutText' });
  }
}
