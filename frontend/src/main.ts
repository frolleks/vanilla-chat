import './style.css';

async function* streamAsyncIterator(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value);
    }
  } finally {
    reader.releaseLock();
  }
}

function processStreamChunk(text: string) {
  const contentMatches = text.match(/\d+:"([^]*?)(?<!\\)"/g);
  if (!contentMatches) return '';

  return contentMatches
    .map((match) => {
      const quoted = match.match(/\d+:"([^]*?)(?<!\\)"/);
      if (!quoted) return '';

      return quoted[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    })
    .join('');
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = /* html */ `
  <div class="chat-container">
    <div class="chat-messages"></div>
    <form class="chat-input-form">
      <div class="input">
        <textarea 
          placeholder="Send a message..." 
          class="textarea"
          autofocus
        ></textarea>
        <div class="input-buttons">
          <select class="model-select">
            <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash</option>
          </select>
          <div class="right-buttons">
            <button type="submit" class="btn send-btn">
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

async function handleSubmit(e: Event) {
  e.preventDefault();
  const message = textarea.value.trim();
  const model = modelSelect.value;

  if (!message) return;

  // Add user message to chat
  const userMessageHtml = `
    <div class="message user">
      <div class="message-content">${message}</div>
    </div>
  `;
  messagesContainer.insertAdjacentHTML('beforeend', userMessageHtml);

  // Create assistant message container
  const assistantMessageDiv = document.createElement('div');
  assistantMessageDiv.className = 'message assistant';
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  assistantMessageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(assistantMessageDiv);

  // Clear input
  textarea.value = '';

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
        model,
      }),
    });

    if (!response.ok) throw new Error('API request failed');
    if (!response.body) throw new Error('No response body');

    for await (const chunk of streamAsyncIterator(response.body)) {
      const content = processStreamChunk(chunk);
      if (content) {
        contentDiv.textContent = (contentDiv.textContent || '') + content;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
  } catch (error) {
    contentDiv.textContent = 'Error: Could not get response from API';
    console.error('Error:', error);
  }
}

form.addEventListener('submit', handleSubmit);

// Auto-resize textarea
textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});
