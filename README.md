# Gemini Assistant for VSCode

The Gemini Coding Assistant is a VS Code extension that integrates Google's Gemini AI models to provide intelligent coding assistance directly within the editor. It allows developers to ask questions about their code, get suggestions, and interact with Gemini's AI capabilities without leaving VS Code.

## Key Features

- AI-Powered Code Assistance: Leverages Google's Gemini models (gemini-pro, gemini-2.0-flash, gemini-pro-vision)
- Context-Aware Queries: Can analyze selected code or entire files to provide relevant responses
- Dedicated UI Panel: Shows AI responses in a formatted panel with markdown support
- Chat History: Maintains conversation history in a tree view for reference
- Code Selection Integration: Right-click on selected code to ask Gemini about it

## Configure the extension

The extension can be configured in the VS Code settings under Extensions > Gemini Assistant:

- Add your Gemini API key to the `Gemini Assistant: Api Key` field
- Select the Gemini model to use for the assistant from the `Gemini Assistant: Model` dropdown

## License

This extension is licensed under the [MIT License](LICENSE).
