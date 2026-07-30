type PresentationClient = { slug?: string | null; name?: string | null };

type ArticlePresentation = {
  id: string;
  accent: string;
  accentSoft: string;
  text: string;
  border: string;
  headingFont: string;
  bodyFont: string;
  headingTransform?: string;
  radius: string;
  headingRule: string;
};

const DEFAULT_PRESENTATION: ArticlePresentation = {
  id: 'default',
  accent: '#1f4a61',
  accentSoft: '#eef5f7',
  text: '#242424',
  border: '#d8e1e5',
  headingFont: 'Arial, sans-serif',
  bodyFont: 'Arial, sans-serif',
  radius: '0',
  headingRule: '4px solid #1f4a61',
};

const PRESENTATIONS: Record<string, ArticlePresentation> = {
  'flaunt-cosmetics-global': {
    id: 'flaunt', accent: '#976750', accentSoft: '#f3e3d6', text: '#444444', border: '#e6e6e6',
    headingFont: "'Tenor Sans', serif", bodyFont: 'Jost, Arial, sans-serif',
    headingTransform: 'uppercase', radius: '2px', headingRule: '1px solid #976750',
  },
  caravanserai: {
    id: 'caravanserai', accent: '#8d2729', accentSoft: '#f4f1eb', text: '#414042', border: '#d8d5cf',
    headingFont: 'Fahkwang, Arial, sans-serif', bodyFont: 'Fahkwang, Arial, sans-serif',
    headingTransform: 'uppercase', radius: '0', headingRule: '3px solid #8d2729',
  },
  'boston-pharma': {
    id: 'boston-pharma', accent: '#0035a0', accentSoft: '#edf3ff', text: '#303030', border: '#c9d7f1',
    headingFont: "'Josefin Sans', Arial, sans-serif", bodyFont: "'Open Sans', Arial, sans-serif",
    radius: '10px', headingRule: '4px solid #0035a0',
  },
  'boston-vet': {
    id: 'boston-vet', accent: '#2f7a58', accentSoft: '#edf7f1', text: '#303030', border: '#c9dfd2',
    headingFont: "'Josefin Sans', Arial, sans-serif", bodyFont: "'Open Sans', Arial, sans-serif",
    radius: '10px', headingRule: '4px solid #2f7a58',
  },
  'alamein-2022': {
    id: 'alamein', accent: '#bf9975', accentSoft: '#f3f3f3', text: '#222222', border: '#e4d5c8',
    headingFont: 'Montserrat, Arial, sans-serif', bodyFont: 'Montserrat, Arial, sans-serif',
    radius: '30px', headingRule: '2px solid #bf9975',
  },
  'joes-venture': {
    id: 'joes-venture', accent: '#5a3825', accentSoft: '#f4ede6', text: '#2b211b', border: '#dfcfbf',
    headingFont: 'Georgia, serif', bodyFont: 'Arial, sans-serif',
    radius: '0', headingRule: '3px solid #5a3825',
  },
  'acme-maintenance': {
    id: 'acme-maintenance', accent: '#185daa', accentSoft: '#eaf0fa', text: '#444444', border: '#cfe0f0',
    headingFont: "'Century Gothic', CenturyGothic, AppleGothic, sans-serif", bodyFont: "'Century Gothic', CenturyGothic, AppleGothic, sans-serif",
    radius: '4px', headingRule: '4px solid #185daa',
  },
};

const SLUG_ALIASES: Record<string, string> = {
  'flaunt-egypt': 'flaunt-cosmetics-global',
  'alamein-egypt': 'alamein-2022',
};

function presentationFor(client?: PresentationClient): ArticlePresentation {
  const slug = client?.slug || '';
  return PRESENTATIONS[slug] || PRESENTATIONS[SLUG_ALIASES[slug]] || DEFAULT_PRESENTATION;
}

export function getArticlePresentationDetails(client?: PresentationClient): ArticlePresentation {
  return { ...presentationFor(client) };
}

function withStyle(attributes: string, style: string): string {
  const styleMatch = attributes.match(/\sstyle=(['"])(.*?)\1/i);
  if (!styleMatch) return `${attributes} style="${style}"`;
  return attributes.replace(styleMatch[0], ` style="${styleMatch[2]};${style}"`);
}

function styleTag(html: string, tag: string, style: string, firstOnly = false): string {
  const pattern = new RegExp(`<${tag}([^>]*)>`, firstOnly ? 'i' : 'gi');
  return html.replace(pattern, (_match, attributes: string) => `<${tag}${withStyle(attributes, style)}>`);
}

/**
 * Adds client-specific inline presentation styles without depending on a theme asset.
 * The marker makes this safe to run during both draft creation and final publishing.
 */
export function presentArticleHtml(html: string | null | undefined, client?: PresentationClient): string {
  if (!html || /data-tds-article-style=/i.test(html)) return html || '';

  const profile = presentationFor(client);
  const bodyStyle = `color:${profile.text};font-family:${profile.bodyFont};font-size:clamp(16px,1.2vw,18px);line-height:1.75`;
  const headingBase = `color:${profile.text};font-family:${profile.headingFont};font-weight:400;line-height:1.18;letter-spacing:${profile.headingTransform ? '0.08em' : '0'};text-transform:${profile.headingTransform || 'none'}`;
  let styled = html;

  styled = styleTag(styled, 'h2', `${headingBase};font-size:clamp(25px,3vw,38px);margin:2.8em 0 0.75em;padding:${profile.headingRule.startsWith('1px') ? '0 0 0.45em' : '0 0 0 0.7em'};border-${profile.headingRule.startsWith('1px') ? 'bottom' : 'left'}:${profile.headingRule}`);
  styled = styleTag(styled, 'h3', `${headingBase};font-size:clamp(20px,2.2vw,27px);margin:2em 0 0.55em`);
  styled = styleTag(styled, 'p', `font-size:1.08em`, true);
  styled = styleTag(styled, 'p', `margin:0 0 1.25em`);
  styled = styleTag(styled, 'ul', `margin:0 0 1.5em;padding-left:1.35em`);
  styled = styleTag(styled, 'ol', `margin:0 0 1.5em;padding-left:1.35em`);
  styled = styleTag(styled, 'li', `margin:0.45em 0;padding-left:0.2em`);
  styled = styleTag(styled, 'blockquote', `margin:2em 0;padding:1.15em 1.35em;border-left:4px solid ${profile.accent};background:${profile.accentSoft};border-radius:${profile.radius};font-family:${profile.headingFont};font-size:1.08em`);
  styled = styleTag(styled, 'table', `width:100%;margin:1.75em 0;border-collapse:collapse;font-size:0.95em`);
  styled = styleTag(styled, 'th', `padding:0.75em;text-align:left;background:${profile.accentSoft};border:1px solid ${profile.border};font-family:${profile.headingFont};font-weight:400`);
  styled = styleTag(styled, 'td', `padding:0.75em;border:1px solid ${profile.border};vertical-align:top`);
  styled = styled.replace(/<a([^>]*)>/gi, (_match, attributes: string) => `<a${withStyle(attributes, `color:${profile.accent};font-weight:600;text-decoration-thickness:1px;text-underline-offset:3px`)}>`);

  return `<article data-tds-article-style="${profile.id}" style="${bodyStyle};max-width:760px;margin:0 auto;padding:clamp(8px,2vw,24px) 0">${styled}</article>`;
}
