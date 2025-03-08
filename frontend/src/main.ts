import './style.css';
import { renderMarkdown } from './utils/markdown';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = /* html */ `
  <div class="chat-container" role="main" aria-label="Chat Interface">
    <div class="chat-messages" role="log" aria-live="polite" aria-label="Chat messages"></div>
    <form class="chat-input-form" aria-label="Message input form">
      <div class="input">
        <textarea 
          placeholder="Send a message..." 
          class="textarea"
          aria-label="Message input"
          role="textbox"
          autofocus
        ></textarea>
        <div class="input-buttons">
          <select class="model-select" aria-label="Select AI model">
            <option value="cognitivecomputations/dolphin3.0-mistral-24b:free">Dolphin3.0 Mistral 24B</option>
          </select>
          <div class="right-buttons">
            <button type="submit" class="btn send-btn" aria-label="Send message">
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  </div>
`;

const form = document.querySelector<HTMLFormElement>('.chat-input-form')!;
const textarea = document.querySelector<HTMLTextAreaElement>('.textarea')!;
const messagesContainer =
  document.querySelector<HTMLDivElement>('.chat-messages')!;
const modelSelect = document.querySelector<HTMLSelectElement>('.model-select')!;

// Add message history array at the top level
const messageHistory: { role: 'user' | 'assistant'; content: string }[] = [];

// Single function that reads and parses the stream.
async function* parseChunkedStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value);

      // Remove metadata sections
      buffer = buffer.replace(/[fed]:\{[^}]+\}/g, '');

      // Match complete tokens only (those ending with a quote)
      const completeTokens = buffer.match(/0:"[^"]+"/g) || [];

      if (completeTokens.length > 0) {
        // Get the last complete token's end position
        const lastTokenEnd =
          buffer.lastIndexOf(completeTokens[completeTokens.length - 1]) +
          completeTokens[completeTokens.length - 1].length;

        // Extract content from complete tokens
        const content = completeTokens
          .map((token) => token.slice(3, -1)) // Remove 0:" and "
          .join('') // Changed from join() to join('') to remove commas
          .replace(/\\"/g, '"') // Handle escaped quotes
          .replace(/\\n/g, '\n'); // Handle newlines

        // Keep only the incomplete part in the buffer
        buffer = buffer.slice(lastTokenEnd);

        yield content;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function handleSubmit(e: Event) {
  e.preventDefault();
  const message = textarea.value.trim();
  const model = modelSelect.value;

  if (!message) return;

  // Add user message to history
  messageHistory.push({ role: 'user', content: message });

  // Add user message to chat with improved accessibility
  const userMessageHtml = /* html */ `
    <div class="message user" role="listitem" aria-label="User message">
      <div class="message-content">${message}</div>
    </div>
  `;
  messagesContainer.insertAdjacentHTML('beforeend', userMessageHtml);

  // Prepare an assistant message container with accessibility attributes
  const assistantMessageDiv = document.createElement('div');
  assistantMessageDiv.className = 'message assistant';
  assistantMessageDiv.setAttribute('role', 'listitem');
  assistantMessageDiv.setAttribute('aria-label', 'Assistant message');
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content markdown-body';
  assistantMessageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(assistantMessageDiv);

  textarea.value = '';

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messageHistory, // Send entire message history
        model,
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }
    if (!response.body) {
      throw new Error('No response body');
    }

    let fullText = ''; // Add accumulator for the complete text
    for await (const parsedText of parseChunkedStream(response.body)) {
      fullText += parsedText; // Accumulate text
      contentDiv.innerHTML = await renderMarkdown(fullText);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Add assistant's response to history
    messageHistory.push({ role: 'assistant', content: fullText });
  } catch (error) {
    contentDiv.textContent = 'Error: Could not get response from API';
    console.error('Error:', error);
  }
}

form.addEventListener('submit', handleSubmit);

// Auto-resize textarea
textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
});
