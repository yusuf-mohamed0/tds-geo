import 'dotenv/config';
import axios from 'axios';
import { Pool } from 'pg';
import { assertArticleSafety } from '../services/articleSafety';
import { assertMinimumArticleLength } from '../services/contentLength';

const FLAUNT_CLIENT_ID = '1d0bbeee-1df0-4d82-9aae-51ec78eebcad';
const BEAUTY_TIPS_BLOG_ID = 116005503268;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const clientResult = await pool.query(
      'SELECT id, name, shopify_shop, shopify_token, shopify_api_version FROM clients WHERE id = $1',
      [FLAUNT_CLIENT_ID],
    );
    const client = clientResult.rows[0];
    if (!client?.shopify_shop || !client?.shopify_token) throw new Error('Flaunt Shopify credentials are unavailable.');

    const shopify = axios.create({
      baseURL: `https://${client.shopify_shop}/admin/api/${client.shopify_api_version || '2025-07'}`,
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': client.shopify_token },
      timeout: 30000,
    });
    const blogsResponse = await shopify.get('/blogs.json');
    const targetBlog = (blogsResponse.data.blogs || []).find((blog: any) => Number(blog.id) === BEAUTY_TIPS_BLOG_ID);
    if (!targetBlog || targetBlog.title !== 'Beauty Tips') throw new Error('Beauty Tips blog could not be verified.');

    const articlesResult = await pool.query(
      `SELECT a.id, p.shopify_article_id, p.shopify_blog_id
       FROM articles a
       JOIN publishing_history p ON p.article_id = a.id
       WHERE a.client_id = $1 AND a.status = 'generated'
       ORDER BY a.title`,
      [FLAUNT_CLIENT_ID],
    );
    if (articlesResult.rows.length !== 4) throw new Error(`Expected 4 Flaunt drafts, found ${articlesResult.rows.length}.`);

    for (const mapping of articlesResult.rows) {
      if (Number(mapping.shopify_blog_id) === BEAUTY_TIPS_BLOG_ID) continue;

      const sourceEndpoint = `/blogs/${mapping.shopify_blog_id}/articles/${mapping.shopify_article_id}.json`;
      const sourceResponse = await shopify.get(sourceEndpoint);
      const source = sourceResponse.data.article;
      assertArticleSafety(source.body_html, client, { allowHtml: true });
      assertMinimumArticleLength(source.body_html, 1200, source.title);

      const metafieldsResponse = await shopify.get(`/articles/${mapping.shopify_article_id}/metafields.json`);
      const metafields = metafieldsResponse.data.metafields || [];
      const titleTag = metafields.find((field: any) => field.namespace === 'global' && field.key === 'title_tag')?.value || source.title;
      const descriptionTag = metafields.find((field: any) => field.namespace === 'global' && field.key === 'description_tag')?.value || '';

      const createdResponse = await shopify.post(`/blogs/${BEAUTY_TIPS_BLOG_ID}/articles.json`, {
        article: {
          title: source.title,
          body_html: source.body_html,
          summary_html: source.summary_html || '',
          tags: source.tags || '',
          author: source.author || 'TDS Geo',
          published: false,
          published_at: null,
          metafields_global_title_tag: titleTag,
          metafields_global_description_tag: descriptionTag,
        },
      });
      const created = createdResponse.data.article;
      const verification = await shopify.get(`/blogs/${BEAUTY_TIPS_BLOG_ID}/articles/${created.id}.json`);
      const moved = verification.data.article;
      if (moved.title !== source.title || moved.published_at !== null || moved.body_html !== source.body_html) {
        throw new Error(`Beauty Tips verification failed for ${mapping.id}.`);
      }
      assertArticleSafety(moved.body_html, client, { allowHtml: true });

      await shopify.delete(sourceEndpoint);
      await pool.query(
        `UPDATE publishing_history
         SET shopify_article_id = $1, shopify_blog_id = $2,
             published_url = $3, status = 'pending', published_at = NULL
         WHERE article_id = $4 AND shopify_article_id = $5`,
        [
          String(created.id),
          BEAUTY_TIPS_BLOG_ID,
          `https://${client.shopify_shop}/blogs/${targetBlog.handle}/${created.handle}`,
          mapping.id,
          String(mapping.shopify_article_id),
        ],
      );
      console.log(`Moved hidden draft ${mapping.id} to Beauty Tips as ${created.id}.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
