function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

export function renderMarkdown(text: string): string {
  const lines = text.split('\n')
  const html: string[] = []
  let inList = false
  let prevText = false

  for (const raw of lines) {
    const trimmed = raw.trim()

    if (trimmed === '') {
      if (inList) { html.push('</ul>'); inList = false }
      html.push('<br>')
      prevText = false
      continue
    }

    if (trimmed.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h4>${renderInline(escapeHtml(trimmed.slice(4)))}</h4>`)
      prevText = false
    } else if (trimmed.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h3>${renderInline(escapeHtml(trimmed.slice(3)))}</h3>`)
      prevText = false
    } else if (trimmed.startsWith('# ')) {
      if (inList) { html.push('</ul>'); inList = false }
      html.push(`<h2>${renderInline(escapeHtml(trimmed.slice(2)))}</h2>`)
      prevText = false
    } else if (trimmed.startsWith('- ')) {
      prevText = false
      if (!inList) { html.push('<ul>'); inList = true }
      html.push(`<li>${renderInline(escapeHtml(trimmed.slice(2)))}</li>`)
    } else {
      if (inList) { html.push('</ul>'); inList = false }
      if (prevText) html.push('<br>')
      html.push(renderInline(escapeHtml(trimmed)))
      prevText = true
    }
  }

  if (inList) html.push('</ul>')
  return html.join('\n')
}
