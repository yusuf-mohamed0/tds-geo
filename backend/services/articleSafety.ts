import { getBrandSafetyConfig, checkBrandProductSafety } from './clientBrandConfig';

export type ArticleSafetyClient = { name?: string | null; slug?: string | null };

export function getArticleSafetyIssues(
  content: string | null | undefined,
  client?: ArticleSafetyClient,
  options: { allowHtml?: boolean } = {},
): string[] {
  const value = content || '';
  const issues: string[] = [];

  if (/<!--|<!doctype\b|<\/?(?:html|head|body|script|style|iframe)\b/i.test(value)) {
    issues.push('Article contains unsafe or document-level HTML.');
  } else if (!options.allowHtml && /<\/?[a-z][^>]*>/i.test(value)) {
    issues.push('Article source must be Markdown, not raw HTML or HTML comments.');
  }

  const fabricatedExperience = [
    /\bi(?:'ve| have|’ve)\s+(?:spent|seen|tested|consulted|worked|reviewed|used|tried|measured)\b/i,
    /\b(?:we|our team)\s+(?:tested|consulted|reviewed|worked|ran|have seen|have spent)\b/i,
    /\b(?:after|based on)\s+(?:consulting|testing|working with)\b/i,
    /\bour\s+(?:studio|lab|clinic|research team)\b/i,
    /\b\d{1,4}\+?\s+(?:customers|professionals|clients|users|people|product combinations)\b/i,
  ];
  if (fabricatedExperience.some((pattern) => pattern.test(value))) {
    issues.push('Article contains an unverifiable first-party experience, test, or statistic.');
  }

  if (/\b(?:a|an|the)?\s?\d{4}\s+(?:study|survey|report)\b|\b\d+(?:\.\d+)?%\b/i.test(value)) {
    issues.push('Article contains an unsupported research or percentage claim.');
  }

  const brandConfig = getBrandSafetyConfig(client?.slug);
  if (brandConfig.forbiddenPhrases) {
    for (const phrase of brandConfig.forbiddenPhrases) {
      if (new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(value)) {
        issues.push(`Contains discouraged phrasing: "${phrase}"`);
      }
    }
  }

  if (brandConfig.disallowedClaims) {
    for (const claim of brandConfig.disallowedClaims) {
      if (new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(value)) {
        issues.push(`Contains disallowed claim pattern: "${claim}"`);
      }
    }
  }

  if (brandConfig.requiredDisclaimers) {
    for (const disclaimer of brandConfig.requiredDisclaimers) {
      const normal = disclaimer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(normal, 'i').test(value)) {
        issues.push(`Missing required disclaimer: "${disclaimer.substring(0, 60)}..."`);
      }
    }
  }

  const productIssues = checkBrandProductSafety(value, client?.slug);
  issues.push(...productIssues);

  return issues;
}

export function assertArticleSafety(
  content: string | null | undefined,
  client?: ArticleSafetyClient,
  options: { allowHtml?: boolean } = {},
): void {
  const issues = getArticleSafetyIssues(content, client, options);
  if (issues.length > 0) {
    throw new Error(`Article safety check failed: ${issues.join(' ')}`);
  }
}
