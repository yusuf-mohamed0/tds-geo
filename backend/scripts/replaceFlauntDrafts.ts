import 'dotenv/config';
import axios from 'axios';
import { Pool } from 'pg';
import { assertArticleSafety } from '../services/articleSafety';
import { assertMinimumArticleLength } from '../services/contentLength';
import { convert, extractPlainText } from '../utils/markdownToHtml';
import { presentArticleHtml } from '../services/articlePresentation';
import { init, refreshIfExpired } from '../services/shopify/auth';
import { flauntReplacementContent } from './flauntReplacementContent';

const FLAUNT_CLIENT_ID = '1d0bbeee-1df0-4d82-9aae-51ec78eebcad';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  init(pool);

  try {
    const clientResult = await pool.query(
      'SELECT id, slug, name, shopify_shop, shopify_token, shopify_api_version FROM clients WHERE id = $1',
      [FLAUNT_CLIENT_ID],
    );
    const client = clientResult.rows[0];
    if (!client?.shopify_shop || !client?.shopify_token) throw new Error('Flaunt Shopify credentials are unavailable.');

    const shopConfig = await refreshIfExpired({
      shop: client.shopify_shop,
      accessToken: client.shopify_token,
      apiVersion: client.shopify_api_version,
    });
    const shopify = axios.create({
      baseURL: `https://${shopConfig.shop}/admin/api/${shopConfig.apiVersion || '2025-07'}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopConfig.accessToken,
      },
      timeout: 30000,
    });

    for (const replacement of flauntReplacementContent) {
      assertArticleSafety(replacement.content, client);
      const wordCount = assertMinimumArticleLength(replacement.content, 1200, replacement.title);
      const contentHtml = presentArticleHtml(convert(replacement.content), client);
      const historyResult = await pool.query(
        `SELECT shopify_article_id, shopify_blog_id
         FROM publishing_history
         WHERE article_id = $1 AND client_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [replacement.articleId, FLAUNT_CLIENT_ID],
      );
      const history = historyResult.rows[0];
      if (!history?.shopify_article_id || !history?.shopify_blog_id) {
        throw new Error(`Missing Shopify mapping for ${replacement.articleId}.`);
      }

      await pool.query(
        `UPDATE articles
         SET title = $1, content_md = $2, content_html = $3, meta_title = $4,
             meta_description = $5, tags = $6, word_count = $7, status = 'generated',
             scheduled_at = NULL, published_at = NULL, updated_at = NOW()
         WHERE id = $8 AND client_id = $9`,
        [
          replacement.title,
          replacement.content,
          contentHtml,
          replacement.metaTitle,
          replacement.metaDescription,
          replacement.tags,
          wordCount,
          replacement.articleId,
          FLAUNT_CLIENT_ID,
        ],
      );

      const endpoint = `/blogs/${history.shopify_blog_id}/articles/${history.shopify_article_id}.json`;
      const payload = {
        article: {
          id: history.shopify_article_id,
          title: replacement.title,
          body_html: contentHtml,
          summary_html: `<p>${extractPlainText(replacement.content, 200)}</p>`,
          tags: replacement.tags.join(', '),
          author: 'Kivo Geo',
          published: false,
          published_at: null,
          metafields_global_title_tag: replacement.metaTitle,
          metafields_global_description_tag: replacement.metaDescription,
        },
      };
      await shopify.put(endpoint, payload);
      const verification = await shopify.get(endpoint);
      const updated = verification.data.article;

      if (updated.title !== replacement.title || updated.published_at !== null) {
        throw new Error(`Shopify did not preserve the expected hidden draft state for ${replacement.articleId}.`);
      }
      assertArticleSafety(updated.body_html, client, { allowHtml: true });
      assertMinimumArticleLength(updated.body_html, 1200, `Shopify draft ${updated.id}`);

      await pool.query(
        `UPDATE publishing_history SET status = 'pending', published_at = NULL
         WHERE article_id = $1 AND shopify_article_id = $2`,
        [replacement.articleId, String(history.shopify_article_id)],
      );
      console.log(`Replaced hidden Shopify draft ${updated.id}: ${updated.title}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
