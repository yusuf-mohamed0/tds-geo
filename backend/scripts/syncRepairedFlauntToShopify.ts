import 'dotenv/config';
import axios from 'axios';
import { Pool } from 'pg';
import { assertMinimumArticleLength } from '../services/contentLength';

const FLAUNT_CLIENT_ID = '1d0bbeee-1df0-4d82-9aae-51ec78eebcad';
const REPAIRED_ARTICLE_IDS = [
  '556edcf6-d5b8-4b51-b07a-0433c1a20416',
  '5e551f07-d028-4ac6-9d2e-f2228ea6c4b5',
  '3e5b1d08-6b77-4641-ab8f-5f2b7c9a8954',
  '2019f948-f402-4c95-892c-02fa39b81497',
];

function getExcerpt(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return text.length <= 200 ? text : `${text.slice(0, 197).trimEnd()}...`;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(
      `SELECT a.id, a.title, a.content_html, a.meta_title, a.meta_description, a.tags,
              p.shopify_article_id, p.shopify_blog_id, c.shopify_shop, c.shopify_token,
              c.shopify_api_version
       FROM articles a
       JOIN publishing_history p ON p.article_id = a.id
       JOIN clients c ON c.id = a.client_id
       WHERE a.client_id = $1
         AND a.id = ANY($2::uuid[])
       ORDER BY array_position($2::uuid[], a.id)`,
      [FLAUNT_CLIENT_ID, REPAIRED_ARTICLE_IDS],
    );

    if (result.rows.length !== REPAIRED_ARTICLE_IDS.length) {
      throw new Error(`Expected ${REPAIRED_ARTICLE_IDS.length} repaired Flaunt articles, found ${result.rows.length}.`);
    }

    for (const article of result.rows) {
      if (!article.shopify_article_id || !article.shopify_blog_id || !article.shopify_shop || !article.shopify_token) {
        throw new Error(`Missing Shopify mapping or credentials for ${article.id}.`);
      }

      assertMinimumArticleLength(article.content_html, 1200, `Flaunt article "${article.title}"`);

      const client = axios.create({
        baseURL: `https://${article.shopify_shop}/admin/api/${article.shopify_api_version || '2025-07'}`,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': article.shopify_token,
        },
        timeout: 30000,
      });

      const response = await client.put(
        `/blogs/${article.shopify_blog_id}/articles/${article.shopify_article_id}.json`,
        {
          article: {
            id: article.shopify_article_id,
            title: article.title,
            body_html: article.content_html,
            summary_html: `<p>${getExcerpt(article.content_html)}</p>`,
            tags: Array.isArray(article.tags) ? article.tags.join(', ') : article.tags || '',
            author: 'TDS Geo',
            published: false,
            published_at: null,
            metafields_global_title_tag: (article.meta_title || article.title).slice(0, 70),
            metafields_global_description_tag: (article.meta_description || '').slice(0, 160),
          },
        },
      );

      const updated = response.data.article;
      if (updated.title !== article.title || updated.published_at !== null) {
        throw new Error(`Shopify did not preserve the expected hidden draft state for ${article.id}.`);
      }
      assertMinimumArticleLength(updated.body_html, 1200, `Synced Shopify draft "${updated.title}"`);

      await pool.query(
        `UPDATE publishing_history
         SET status = 'pending', published_at = NULL
         WHERE article_id = $1 AND shopify_article_id = $2`,
        [article.id, String(article.shopify_article_id)],
      );

      console.log(`Synced hidden Shopify draft ${updated.id}: ${updated.title}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
