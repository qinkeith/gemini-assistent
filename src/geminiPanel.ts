// File: src/geminiPanel.ts
import * as vscode from 'vscode';
import * as marked from 'marked';
import { GeminiService } from './geminiService';

export class GeminiPanel {
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];
  public currentQuestion: string | undefined;
  public currentAnswer: string | undefined;
  private static readonly viewType = 'geminiAssistant'; // Define a static view type

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly geminiService: GeminiService,
    private readonly context: vscode.ExtensionContext
  ) {
    // Restore state from global state
    this.currentQuestion = this.context.globalState.get<string>('geminiQuestion');
    this.currentAnswer = this.context.globalState.get<string>('geminiAnswer');

    // Try to revive the panel if it was previously open
    this.revivePanel();
  }

  private revivePanel() {
    // Check if there's a panel to revive
    if (this.currentQuestion && this.currentAnswer) {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

      this.panel = vscode.window.createWebviewPanel(
        GeminiPanel.viewType,
        'Gemini Assistant',
        { viewColumn: columnToShowIn || vscode.ViewColumn.One, preserveFocus: true }, // Use an object for options
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, 'media')
          ]
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
      // If we already have a panel, show it in the current column
      this.panel.reveal(columnToShowIn);
      this.updateContent(question, answer);
    } else {
      // Otherwise, create a new panel
      this.panel = vscode.window.createWebviewPanel(
        GeminiPanel.viewType, // Use the static view type
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
      this.setupPanelListeners();
    }
  }

  private setupPanelListeners() {
    if (!this.panel) return;

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
          case 'saveContent':
            this.saveWebviewContent();
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

    const script = `
      <script>
        const vscode = acquireVsCodeApi();
        document.addEventListener('contextmenu', event => {
          event.preventDefault();
          let saveOption = document.createElement('div');
          saveOption.textContent = 'Save to File';
          saveOption.style.position = 'absolute';
          saveOption.style.left = event.clientX + 'px';
          saveOption.style.top = event.clientY + 'px';
          saveOption.style.backgroundColor = 'var(--vscode-menu-background)';
          saveOption.style.color = 'var(--vscode-menu-foreground)';
          saveOption.style.border = '1px solid var(--vscode-menu-border)';
          saveOption.style.padding = '5px';
          saveOption.style.zIndex = '1000';
          saveOption.style.cursor = 'pointer';

          document.body.appendChild(saveOption);

          saveOption.addEventListener('click', () => {
            vscode.postMessage({ command: 'saveContent' });
            document.body.removeChild(saveOption);
          });

          document.addEventListener('click', function onClickOutside(event) {
            if (event.target !== saveOption) {
              document.body.removeChild(saveOption);
              document.removeEventListener('click', onClickOutside);
            }
          });
        });
      </script>
    `;

    // Inject the script only if it's not already there
    if (!this.panel.webview.html.includes("vscode.postMessage({ command: 'saveContent' })")) {
        this.panel.webview.html = this.panel.webview.html.replace('</body>', script + '</body>');
    }
  }

  public updateContent(question: string, answer: string): void {
    if (!this.panel) {
      return;
    }

    // Convert markdown to HTML for the response
    // Ensure we're getting a string by using marked.parse synchronously
    const htmlAnswer = new marked.Parser().parse(marked.Lexer.lex(answer));

    // Get the existing content
    let existingContent = this.panel.webview.html;

    // Wrap the existing content in HTML, head, and body tags if it's not already wrapped
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

    // Append the new question and answer to the existing content
    this.panel.webview.html = existingContent + this.getWebviewContent(question, htmlAnswer);
    this.saveState(question, answer);
    this.currentQuestion = question;
    this.currentAnswer = answer;
    this.injectContextMenuScript();
  }

  public saveState(question: string, answer: string): void {
    // Save state to global state
    this.context.globalState.update('geminiQuestion', question);
    this.context.globalState.update('geminiAnswer', answer);
  }

  private getWebviewContent(question: string, answer: string): string {
    // Create HTML content for the webview
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
    // Add functionality to code blocks
    // This is a simple approach - in a real extension, you might use a more robust HTML parsing
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

    // Get the webview content
    const webviewContent = this.panel.webview.html;

    // Extract the content of the chat
    const start = webviewContent.indexOf('<div class="message user-message">');
    const end = webviewContent.lastIndexOf('<div class="message assistant-message">');
    
    // If there is no messages, return
    if (start === -1 || end === -1) {
      vscode.window.showErrorMessage(`No content to save`);
      return;
    }

    // Extract the content of the chat
    const content = webviewContent.substring(start, webviewContent.length);

    // Wrap the content in a basic HTML structure
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

 


}
