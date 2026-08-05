import { Pool } from 'pg';
import { logger } from '../utils/logger';
import shopifyService from './shopify';
import { getClientDefaultBlogId } from './shopify/content';
import schemaGenerator from './schemaGenerator';
import indexNowService from './indexNowService';
import openaiService from './openai';
import { countArticleWords, getMinimumArticleWords } from './contentLength';

export class AutoPublishService {
  private pool: Pool | null = null;
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  initialize(pool: Pool): void {
    this.pool = pool;
  }

  start(intervalMs: number = 30000): void {
    if (this.interval) return;
    logger.info('Auto-publish scheduler started', { checkInterval: `${intervalMs / 1000}s` });
    this.interval = setInterval(() => this.tick(), intervalMs);
    this.tick();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.isRunning || !this.pool) return;
    this.isRunning = true;

    try {
      // Find articles that are approved and due for publishing
      const due = await this.pool.query(
        `SELECT a.*, c.name as client_name, c.shopify_shop, c.shopify_token,
                c.shopify_api_version, c.approval_mode, c.keyword_categories, c.settings
         FROM articles a
         JOIN clients c ON c.id = a.client_id
         WHERE a.status = 'approved'
           AND a.scheduled_at IS NOT NULL
           AND a.scheduled_at <= NOW()
           AND a.published_at IS NULL
         ORDER BY a.scheduled_at ASC
         LIMIT 5`
      );

      for (const article of due.rows) {
        await this.publishArticle(article);
      }
    } catch (err: any) {
      logger.error('Auto-publish tick failed', { error: err.message });
    } finally {
      this.isRunning = false;
    }
  }

  private async publishArticle(article: any): Promise<void> {
    const startedAt = Date.now();
    try {
      // Honor scheduled_at: never publish before the scheduled time.
      // The SQL query filters on scheduled_at <= NOW(), but we double-check
      // here so a stale/incorrect row can never go live early.
      if (article.scheduled_at && new Date(article.scheduled_at).getTime() > Date.now()) {
        logger.warn('Scheduled article not yet due — skipping', {
          articleId: article.id,
          title: article.title,
          scheduledAt: article.scheduled_at,
        });
        return;
      }

      logger.info('Auto-publishing scheduled article', { articleId: article.id, title: article.title });

      const client = this.buildClientRecord(article);
      const minimumArticleWords = getMinimumArticleWords(client);
      const actualWordCount = countArticleWords(article.content_md || article.content_html);
      if (actualWordCount < minimumArticleWords) {
        await this.pool!.query(
          `UPDATE articles
           SET status = 'rejected', scheduled_at = NULL, updated_at = NOW()
           WHERE id = $1`,
          [article.id]
        );
        logger.error('Scheduled article rejected for insufficient length', {
          articleId: article.id,
          title: article.title,
          actualWordCount,
          minimumArticleWords,
        });
        return;
      }

      const shopConfig = {
        shop: article.shopify_shop,
        accessToken: article.shopify_token,
        apiVersion: article.shopify_api_version,
      };

      // Find the existing hidden draft in Shopify (created when the article was
      // pushed to Shopify). Auto-publish ONLY flips an existing draft to live —
      // it never creates a live article.
      const draftResult = await this.pool!.query(
        `SELECT shopify_article_id, shopify_blog_id, published_url
         FROM publishing_history
         WHERE article_id = $1 AND shopify_article_id IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [article.id]
      );
      const existing = draftResult.rows[0];

      let targetBlogId = existing?.shopify_blog_id || null;
      let shopifyArticleId = existing?.shopify_article_id || null;
      let publishResult: any = null;

      if (shopifyArticleId) {
        // Draft already exists → flip it to live (PUT published:true).
        if (!targetBlogId) {
          targetBlogId = await this.resolveBlogId(shopConfig, article);
        }
        publishResult = await shopifyService.publishArticleLive(shopConfig, targetBlogId, shopifyArticleId);
      } else {
        // No draft exists yet → create the draft first (still a hidden draft),
        // then flip it live. Creation never publishes live.
        targetBlogId = targetBlogId || (await this.resolveBlogId(shopConfig, article));

        let contentHtml = article.content_html || '';
        try {
          const faqPairs = schemaGenerator.extractFaqPairsFromContent(article.content_md || '');
          const schemas = schemaGenerator.generateAllSchemas({
            siteName: client.name || '',
            siteUrl: client.shopify_shop ? `https://${client.shopify_shop}` : '',
            articleTitle: article.title,
            articleDescription: article.meta_description || '',
            articleBody: article.content_md || '',
            datePublished: article.scheduled_at?.toISOString?.() || new Date().toISOString(),
            dateModified: new Date().toISOString(),
            authorName: process.env.AUTHOR_NAME || 'AI SEO Agent',
            faqPairs: faqPairs.length > 0 ? faqPairs : undefined,
          });
          contentHtml = schemaGenerator.injectSchemaIntoHtml(contentHtml, schemas);
        } catch (schemaErr) {
          logger.warn('Schema injection failed for scheduled publish', {
            articleId: article.id,
            error: (schemaErr as Error).message,
          });
        }

        const created = await shopifyService.publishArticle(shopConfig, targetBlogId, {
          title: article.title,
          contentHtml,
          metaTitle: article.meta_title,
          metaDescription: article.meta_description,
          tags: article.tags || [],
        });
        shopifyArticleId = created.id;
        publishResult = await shopifyService.publishArticleLive(shopConfig, targetBlogId, shopifyArticleId);
      }

      // Tracking: mark the existing history row published, or insert one when
      // the draft was created as part of this run.
      if (existing) {
        await this.pool!.query(
          `UPDATE publishing_history
           SET status = 'published', published_at = NOW(), published_url = $2
           WHERE article_id = $1 AND shopify_article_id = $3`,
          [article.id, publishResult.url, shopifyArticleId]
        );
      } else {
        await this.pool!.query(
          `INSERT INTO publishing_history (article_id, client_id, shopify_article_id, shopify_blog_id, published_url, status, published_at)
           VALUES ($1, $2, $3, $4, $5, 'published', NOW())`,
          [article.id, article.client_id, shopifyArticleId, targetBlogId, publishResult.url]
        );
      }

      await this.pool!.query(
        `UPDATE articles SET status = 'published', published_at = NOW(), scheduled_at = NULL, updated_at = NOW() WHERE id = $1`,
        [article.id]
      );

      // IndexNow notification
      if (publishResult?.url) {
        indexNowService.pingArticlePublished(publishResult.url).catch(err => {
          logger.warn('IndexNow ping failed after scheduled publish', {
            articleId: article.id,
            error: (err as Error).message,
          });
        });
      }

      // Generate and upload image
      try {
        const imageData = await openaiService.generateArticleImage(article.title, article.tags?.[0] || '');
        const shopifyImage = await shopifyService.uploadImage(
          { shop: article.shopify_shop, accessToken: article.shopify_token },
          targetBlogId,
          shopifyArticleId,
          imageData.imageUrl,
          imageData.altText
        );
        await this.pool!.query(
          `INSERT INTO article_images (article_id, client_id, prompt, image_url, shopify_image_id, alt_text)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [article.id, article.client_id, imageData.prompt, imageData.imageUrl, shopifyImage.id, imageData.altText]
        );
      } catch (imgErr) {
        logger.warn('Image generation/upload failed for scheduled publish', {
          articleId: article.id,
          error: (imgErr as Error).message,
        });
      }

      const elapsed = Date.now() - startedAt;
      logger.info('Scheduled article published successfully', {
        articleId: article.id,
        title: article.title,
        url: publishResult?.url,
        elapsedMs: elapsed,
      });
    } catch (err: any) {
      logger.error('Scheduled article publish failed', {
        articleId: article.id,
        title: article.title,
        error: err.message,
      });
    }
  }

  private async resolveBlogId(shopConfig: any, article: any): Promise<number | string> {
    const configured = getClientDefaultBlogId({ settings: article.settings });
    if (configured) return configured;
    const blogs = await shopifyService.fetchBlogs(shopConfig);
    if (!blogs[0]?.id) {
      throw new Error('No Shopify blogs found for this store');
    }
    return blogs[0].id;
  }

  private buildClientRecord(article: any): any {
    return {
      id: article.client_id,
      name: article.client_name,
      shopify_shop: article.shopify_shop,
      shopify_token: article.shopify_token,
      approval_mode: article.approval_mode,
      keyword_categories: article.keyword_categories,
      settings: article.settings,
    };
  }
}

export const autoPublishService = new AutoPublishService();
export default autoPublishService;
