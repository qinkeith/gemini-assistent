// File: src/geminiService.ts
import axios from 'axios';
import * as vscode from 'vscode';

interface ChatMessage {
  isUser: boolean;
  text: string;
  timestamp: Date;
}

export class GeminiService {
  private apiKey: string;
  private model: string;
  private chatHistory: ChatMessage[] = [];

  constructor() {
    // Get configuration
    const config = vscode.workspace.getConfiguration('geminiAssistant');
    this.apiKey = config.get('apiKey', '');
    this.model = config.get('model', 'gemini-pro');
    
    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('geminiAssistant')) {
        const newConfig = vscode.workspace.getConfiguration('geminiAssistant');
        this.apiKey = newConfig.get('apiKey', '');
        this.model = newConfig.get('model', 'gemini-pro');
      }
    });
  }

  async queryGemini(prompt: string, codeContext: string = ''): Promise<string> {
    // Check if API key is configured
    if (!this.apiKey) {
      const setApiKey = 'Set API Key';
      const response = await vscode.window.showErrorMessage(
        'Gemini API key is not configured.', 
        setApiKey
      );
      
      if (response === setApiKey) {
        // Open extension settings
        vscode.commands.executeCommand(
          'workbench.action.openSettings', 
          'geminiAssistant.apiKey'
        );
      }
      
      throw new Error('API key not configured');
    }

    try {
      // Create the content array for the API
      const content = [];
      
      // Add code context if available
      if (codeContext) {
        content.push({
          role: "user",
          parts: [{ text: `Here's the code I'm working with:\n\n${codeContext}` }]
        });
      }
      
      // Add the user's prompt
      content.push({
        role: "user",
        parts: [{ text: prompt }]
      });
      
      // Add current chat history to the API call for context
      const messages = this.formatChatHistoryForAPI();
      messages.push(...content);
      
      // Make the API request
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
        {
          contents: messages,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          }
        }
      );
      
      // Extract the response text
      const responseText = response.data.candidates[0].content.parts[0].text;
      
      // Add to chat history
      this.addToChatHistory(false, responseText);
      this.addToChatHistory(true, prompt);
      
      return responseText;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(`API Error: ${error.response.status} - ${error.response.data.error.message}`);
      }
      throw error;
    }
  }

  private formatChatHistoryForAPI() {
    // Convert chat history to the format expected by the Gemini API
    const result = [];
    
    // Only take the last 10 messages to avoid context limits
    const recentHistory = this.chatHistory.slice(-10);
    
    for (const msg of recentHistory) {
      result.push({
        role: msg.isUser ? "user" : "model",
        parts: [{ text: msg.text }]
      });
    }
    
    return result;
  }

  private addToChatHistory(isUser: boolean, text: string) {
    this.chatHistory.push({
      isUser,
      text,
      timestamp: new Date()
    });
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  clearChatHistory(): void {
    this.chatHistory = [];
  }
}