// Standalone markdown → Shopify Custom Liquid converter
// No dependencies required
const fs = require('fs');
const path = require('path');

function mdToHtml(md) {
  let html = '';
  const lines = md.split('\n');
  let inList = false;
  let listType = null;

  function closeListTag() {
    let out = '';
    if (inList && listType === 'ul') out += '      </ul>\n';
    if (inList && listType === 'ol') out += '      </ol>\n';
    inList = false;
    listType = null;
    return out;
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Skip frontmatter
    if (line.startsWith('---') && i === 0) {
      while (i < lines.length && !lines[i].startsWith('---')) i++;
      continue;
    }

    // Skip empty lines
    if (line.trim() === '') {
      html += closeListTag();
      continue;
    }

    const h1Match = line.match(/^# (.+)/);
    const h2Match = line.match(/^## (.+)/);
    const h3Match = line.match(/^### (.+)/);

    if (h1Match) { html += closeListTag(); html += `      <h1 class="article-title">${inlineFormat(h1Match[1])}</h1>\n`; continue; }
    if (h2Match) { html += closeListTag(); html += `      <h2>${inlineFormat(h2Match[1])}</h2>\n`; continue; }
    if (h3Match) { html += closeListTag(); html += `      <h3>${inlineFormat(h3Match[1])}</h3>\n`; continue; }

    const ulMatch = line.match(/^- (.+)/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') { html += closeListTag(); html += '      <ul>\n'; inList = true; listType = 'ul'; }
      html += `        <li>${inlineFormat(ulMatch[1])}</li>\n`;
      continue;
    }

    const olMatch = line.match(/^\d+\. (.+)/);
    if (olMatch) {
      if (!inList || listType !== 'ol') { html += closeListTag(); html += '      <ol>\n'; inList = true; listType = 'ol'; }
      html += `        <li>${inlineFormat(olMatch[1])}</li>\n`;
      continue;
    }

    html += closeListTag();
    html += `      <p>${inlineFormat(line)}</p>\n`;
  }

  html += closeListTag();
  return html;
}

function inlineFormat(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return text;
}

function wrapInLiquid(title, metaTitle, metaDescription, keyword, bodyHtml) {
  return `{%- assign article_title = "${escapeQuotes(title)}" -%}
{%- assign article_meta_title = "${escapeQuotes(metaTitle)}" -%}
{%- assign article_meta_description = "${escapeQuotes(metaDescription)}" -%}
{%- assign article_keyword = "${escapeQuotes(keyword)}" -%}

<article class="article-content" itemscope itemtype="https://schema.org/Article">
  <meta itemprop="headline" content="${escapeQuotes(title)}">
  <meta itemprop="description" content="${escapeQuotes(metaDescription)}">
  <meta itemprop="keywords" content="${escapeQuotes(keyword)}">

  <div class="article-body rte" itemprop="articleBody">
${bodyHtml}
  </div>

  <div class="article-footer">
    <p class="article-tags">
      <span class="tag">Handcrafted</span>
      <span class="tag">Egyptian Design</span>
      <span class="tag">Caravanserai</span>
    </p>
  </div>
</article>

<style>
.article-content {
  max-width: 800px;
  margin: 0 auto;
  font-family: Fahkwang, sans-serif;
  color: #414042;
  line-height: 1.8;
  font-size: 16px;
}

.article-title {
  font-family: Fahkwang, sans-serif;
  font-weight: 400;
  font-size: 36px;
  line-height: 1.2;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #414042;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e9e8e0;
}

.article-body h2 {
  font-family: Fahkwang, sans-serif;
  font-weight: 400;
  font-size: 24px;
  line-height: 1.3;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #414042;
  margin-top: 40px;
  margin-bottom: 16px;
}

.article-body h3 {
  font-family: Fahkwang, sans-serif;
  font-weight: 500;
  font-size: 20px;
  line-height: 1.3;
  color: #414042;
  margin-top: 32px;
  margin-bottom: 12px;
}

.article-body p {
  margin-bottom: 16px;
  line-height: 1.8;
}

.article-body strong {
  font-weight: 600;
  color: #8d2729;
}

.article-body ul,
.article-body ol {
  margin: 16px 0;
  padding-left: 24px;
}

.article-body li {
  margin-bottom: 8px;
  line-height: 1.6;
}

.article-footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #e9e8e0;
}

.article-tags .tag {
  display: inline-block;
  padding: 4px 12px;
  margin: 0 4px 4px 0;
  background: #f4f1eb;
  color: #414042;
  font-size: 12px;
  font-family: Fahkwang, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@media screen and (max-width: 749px) {
  .article-title {
    font-size: 28px;
  }
  .article-body h2 {
    font-size: 20px;
  }
  .article-body h3 {
    font-size: 18px;
  }
  .article-content {
    font-size: 14px;
  }
}
</style>`;
}

function escapeQuotes(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Process all articles
const articlesDir = path.join(__dirname, '..', 'doc', 'clients', 'caravanserai', 'articles');
const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md') && !f.includes('.liquid.'));

for (const file of files) {
  const content = fs.readFileSync(path.join(articlesDir, file), 'utf-8');

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    console.log(`Skipping ${file}: no frontmatter`);
    continue;
  }

  const fmLines = fmMatch[1].split('\n');
  const meta = {};
  for (const line of fmLines) {
    const sep = line.indexOf(': ');
    if (sep > 0) {
      meta[line.slice(0, sep).trim()] = line.slice(sep + 2).trim().replace(/^"|"$/g, '');
    }
  }

  const body = fmMatch[2].trim();
  const bodyHtml = mdToHtml(body);
  const liquid = wrapInLiquid(
    meta.title || meta.meta_title || file,
    meta.meta_title || meta.title || '',
    meta.meta_description || '',
    meta.keyword || '',
    bodyHtml
  );

  const baseName = file.replace(/\.md$/, '');
  const liquidPath = path.join(articlesDir, `${baseName}.liquid`);
  fs.writeFileSync(liquidPath, liquid);
  console.log(`Created: ${baseName}.liquid`);
}

console.log('\nDone. 6 articles converted to Liquid format.');
