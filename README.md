# Gemini Assistant for VSCode

The Gemini Coding Assistant is a VS Code extension that integrates Google's Gemini/Gemma AI models to provide intelligent coding assistance directly within the editor. It allows developers to ask questions about their code, get suggestions, and interact with AI capabilities without leaving VS Code.

## Key Features

- AI-Powered Code Assistance: Leverages Google's Gemini/Gemma models:
  - gemini-2.5-pro-exp-03-25
  - gemma-3-27b-it
  - gemini-2.0-flash
  - gemini-2.0-flash-lite
  - gemini-pro
  - Custom
- Context-Aware Queries: Can analyze selected code or entire files to provide relevant responses
- Dedicated UI Panel: Shows AI responses in a formatted panel with markdown support
- Chat History: Conversation history can be `saved to a html file` and edited by `Cut` menu.
- Code Selection Integration: Right-click on selected code to ask Gemini about it

## Configure the extension

The extension can be configured in the VS Code settings under Extensions > Gemini Assistant:

- Add your Gemini API key to the `Gemini Assistant: Api Key` field
- Select the Gemini model to use for the assistant from the `Gemini Assistant: Model` dropdown
- If `Custom` model is selected, a custom model name must be specified in the `Gemini Assistant: Custom Model` field.

## License

This extension is licensed under the [MIT License](LICENSE).
