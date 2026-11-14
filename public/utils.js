export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const percent = value => Number.isFinite(value) ? `${value.toFixed(1)}%` : '未评分';
export const date = value => value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium' }).format(new Date(value)) : '未记录';
export const usageLabels = { unassigned: '未分配', candidate: '种子候选', approved: '专家批准', holdout: '保留评测' };
export const patternLabels = { rule_application: '规则适用', multi_condition_application: '条件组合', exception_check: '例外判断', evidence_comparison: '证据比较', temporal_applicability: '时点适用', amount_classification: '金额归属', multi_issue_composition: '多争点联动', arithmetic_computation: '计算', information_extraction: '信息提取' };

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      if (/^https?:\/\//.test(url)) return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
      if (/^(references|assets)\/[a-zA-Z0-9._/-]+$/.test(url) && !url.includes('..')) return `<button class="inline-link" data-action="skill-file" data-file="${url}">${label}</button>`;
      return label;
    });
}

export function markdown(source) {
  const lines = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').split('\n');
  const result = []; let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (/^```/.test(line)) {
      const code = []; index++;
      while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]);
      result.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); index++; continue;
    }
    if (/^\|/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[index + 1] ?? '')) {
      const cells = value => value.split('|').slice(1, -1).map(v => v.trim());
      const header = cells(line); index += 2; const rows = [];
      while (index < lines.length && /^\|/.test(lines[index])) rows.push(cells(lines[index++]));
      result.push(`<div class="table-scroll"><table class="markdown-table"><thead><tr>${header.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { result.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); index++; continue; }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d/.test(line); const items = [];
      while (index < lines.length && (ordered ? /^\d+\.\s+/.test(lines[index]) : /^[-*]\s+/.test(lines[index]))) items.push(lines[index++].replace(/^(?:[-*]|\d+\.)\s+/, ''));
      result.push(`<${ordered ? 'ol' : 'ul'}>${items.map(item => `<li>${inline(item)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    if (line.trim()) result.push(`<p>${inline(line)}</p>`);
    index++;
  }
  return result.join('\n');
}

export function suggestedVersion(version) {
  const parts = version.split('.').map(Number); parts[2]++; return parts.join('.');
}
