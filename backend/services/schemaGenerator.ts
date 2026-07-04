// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { logger } from '../utils/logger';

export interface SchemaMetadata {
  siteName: string;
  siteUrl: string;
  articleTitle: string;
  articleDescription: string;
  articleBody: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  authorUrl?: string;
  imageUrl?: string;
  publisherLogo?: string;
  faqPairs?: Array<{ question: string; answer: string }>;
  productName?: string;
  productDescription?: string;
  productSku?: string;
  productPrice?: string;
  productCurrency?: string;
  productAvailability?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
  howToSteps?: Array<{ name: string; text: string; image?: string }>;
}

export function generateOrganizationSchema(meta: SchemaMetadata): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: meta.siteName,
    url: meta.siteUrl,
    ...(meta.publisherLogo ? { logo: meta.publisherLogo } : {}),
    ...(meta.authorUrl ? { sameAs: [meta.authorUrl] } : {}),
  };
}

export function generateArticleSchema(meta: SchemaMetadata): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.articleTitle,
    description: meta.articleDescription,
    articleBody: meta.articleBody?.substring(0, 5000),
    datePublished: meta.datePublished,
    dateModified: meta.dateModified,
    author: {
      '@type': 'Person',
      name: meta.authorName,
      ...(meta.authorUrl ? { url: meta.authorUrl } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: meta.siteName,
      ...(meta.publisherLogo ? { logo: { '@type': 'ImageObject', url: meta.publisherLogo } } : {}),
    },
    ...(meta.imageUrl ? { image: meta.imageUrl } : {}),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': meta.siteUrl,
    },
  };
}

export function generateFaqPageSchema(faqPairs: Array<{ question: string; answer: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqPairs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}

export function generateProductSchema(meta: SchemaMetadata): object {
  if (!meta.productName) return {};
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: meta.productName,
    description: meta.productDescription || meta.articleDescription,
    ...(meta.productSku ? { sku: meta.productSku } : {}),
    ...(meta.productPrice && meta.productCurrency ? {
      offers: {
        '@type': 'Offer',
        price: meta.productPrice,
        priceCurrency: meta.productCurrency,
        availability: meta.productAvailability || 'https://schema.org/InStock',
      },
    } : {}),
  };
}

export function generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

export function generateHowToSchema(howToSteps: Array<{ name: string; text: string; image?: string }>): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: howToSteps[0]?.name || 'How To',
    step: howToSteps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.name,
      text: step.text,
      ...(step.image ? { image: step.image } : {}),
    })),
  };
}

export function generateWebPageSchema(meta: SchemaMetadata): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: meta.articleTitle,
    description: meta.articleDescription,
    url: meta.siteUrl,
    datePublished: meta.datePublished,
    dateModified: meta.dateModified,
    ...(meta.imageUrl ? { primaryImageOfPage: { '@type': 'ImageObject', url: meta.imageUrl } } : {}),
  };
}

export function injectSchemaIntoHtml(html: string, schemas: object[]): string {
  const scriptTags = schemas
    .filter(s => Object.keys(s).length > 1)
    .map(s => `<script type="application/ld+json">${JSON.stringify(s, null, 0)}</script>`)
    .join('\n');

  if (!scriptTags) return html;

  const beforeBodyClose = html.lastIndexOf('</body>');
  if (beforeBodyClose !== -1) {
    return html.slice(0, beforeBodyClose) + scriptTags + '\n' + html.slice(beforeBodyClose);
  }

  return html + '\n' + scriptTags;
}

export function generateAllSchemas(meta: SchemaMetadata): object[] {
  const schemas: object[] = [];

  schemas.push(generateOrganizationSchema(meta));
  schemas.push(generateArticleSchema(meta));
  schemas.push(generateWebPageSchema(meta));

  if (meta.faqPairs && meta.faqPairs.length > 0) {
    schemas.push(generateFaqPageSchema(meta.faqPairs));
  }

  if (meta.productName) {
    schemas.push(generateProductSchema(meta));
  }

  if (meta.breadcrumbs && meta.breadcrumbs.length > 0) {
    schemas.push(generateBreadcrumbSchema(meta.breadcrumbs));
  }

  if (meta.howToSteps && meta.howToSteps.length > 0) {
    schemas.push(generateHowToSchema(meta.howToSteps));
  }

  return schemas;
}

export function extractFaqPairsFromContent(content: string): Array<{ question: string; answer: string }> {
  const pairs: Array<{ question: string; answer: string }> = [];
  const faqRegex = /###\s+(.+?)\?\s*\n([\s\S]*?)(?=\n###|\n##|$)/g;
  let match;
  while ((match = faqRegex.exec(content)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim().substring(0, 500);
    if (question && answer) {
      pairs.push({ question: question + '?', answer });
    }
  }
  return pairs;
}

const schemaGenerator = {
  generateOrganizationSchema,
  generateArticleSchema,
  generateFaqPageSchema,
  generateProductSchema,
  generateBreadcrumbSchema,
  generateHowToSchema,
  generateWebPageSchema,
  injectSchemaIntoHtml,
  generateAllSchemas,
  extractFaqPairsFromContent,
};

export default schemaGenerator;
