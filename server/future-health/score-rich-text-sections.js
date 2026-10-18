export function scoreRichTextSections({ html, headings }) {
  const pattern = new RegExp(
    `<h2\\b[^>]*>(?<heading>${headings.join('|')})<\\/h2>` +
      `(?!\\s*<blockquote\\b[^>]*>\\s*<p\\b[^>]*>\\s*<span style="color: #97a0af">)`,
    'g',
  );

  const completed = new Set(Array.from((html ?? '').matchAll(pattern), (match) => match.groups.heading));

  return {
    completed: headings.filter((heading) => completed.has(heading)),
    count: completed.size,
    missing: headings.filter((heading) => !completed.has(heading)),
    total: headings.length,
  };
}