import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true, // Enable GitHub Flavored Markdown
});

export async function renderMarkdown(text: string): Promise<string> {
  const rawHtml = await marked(text);
  return DOMPurify.sanitize(rawHtml);
}
