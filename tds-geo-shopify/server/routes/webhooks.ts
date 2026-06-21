import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../utils/config';
import { validateProxyRequest } from '../middleware/auth';

const router = Router();

interface ArticlePayload {
  title: string;
  content_html: string;
  content_md?: string;
  tags?: string[];
  meta_title?: string;
  meta_description?: string;
  blog_id?: number;
  status?: 'draft' | 'published';
  published_at?: string;
}

router.post('/articles/publish', validateProxyRequest, async (req: Request, res: Response) => {
  const { shop, token, blogId = 1 } = req.query;
  const article: ArticlePayload = req.body;

  if (!shop || !token) {
    res.status(400).json({ error: 'Missing shop or token parameters' });
    return;
  }

  try {
    const shopResponse = await axios.get(
      `https://${shop}/admin/api/${config.shopify.apiVersion}/articles.json`,
      {
        headers: { 'X-Shopify-Access-Token': token },
        params: { blog_id: blogId },
      }
    );

    const payload = {
      article: {
        title: article.title,
        body_html: article.content_html || article.content_md || '',
        tags: (article.tags || []).join(', '),
        published: article.status !== 'draft',
        published_at: article.status !== 'draft' ? new Date().toISOString() : null,
        metafields_global_title_tag: article.meta_title || article.title,
        metafields_global_description_tag: article.meta_description || '',
      },
    };

    const createResponse = await axios.post(
      `https://${shop}/admin/api/${config.shopify.apiVersion}/blogs/${blogId}/articles.json`,
      payload,
      { headers: { 'X-Shopify-Access-Token': token } }
    );

    res.json({
      success: true,
      data: {
        id: createResponse.data.article.id,
        url: `https://${shop}/blogs/${blogId}/articles/${createResponse.data.article.handle}`,
        title: createResponse.data.article.title,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.response?.data?.errors || err.message,
    });
  }
});

router.post('/articles/update', validateProxyRequest, async (req: Request, res: Response) => {
  const { shop, token, articleId } = req.query;
  const article: Partial<ArticlePayload> = req.body;

  if (!shop || !token || !articleId) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }

  try {
    const blogId = article.blog_id || 1;
    const payload: any = {};
    if (article.title) payload.title = article.title;
    if (article.content_html || article.content_md) payload.body_html = article.content_html || article.content_md;
    if (article.tags) payload.tags = article.tags.join(', ');

    const updateResponse = await axios.put(
      `https://${shop}/admin/api/${config.shopify.apiVersion}/blogs/${blogId}/articles/${articleId}.json`,
      { article: payload },
      { headers: { 'X-Shopify-Access-Token': token } }
    );

    res.json({ success: true, data: updateResponse.data.article });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.response?.data?.errors || err.message,
    });
  }
});

router.delete('/articles/:id', validateProxyRequest, async (req: Request, res: Response) => {
  const { shop, token } = req.query;
  const blogId = req.query.blogId || 1;
  const articleId = req.params.id;

  if (!shop || !token) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }

  try {
    await axios.delete(
      `https://${shop}/admin/api/${config.shopify.apiVersion}/blogs/${blogId}/articles/${articleId}.json`,
      { headers: { 'X-Shopify-Access-Token': token } }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.response?.data?.errors || err.message,
    });
  }
});

router.get('/blogs', validateProxyRequest, async (req: Request, res: Response) => {
  const { shop, token } = req.query;

  if (!shop || !token) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }

  try {
    const blogsResponse = await axios.get(
      `https://${shop}/admin/api/${config.shopify.apiVersion}/blogs.json`,
      { headers: { 'X-Shopify-Access-Token': token } }
    );
    res.json({ success: true, data: blogsResponse.data.blogs });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.response?.data?.errors || err.message,
    });
  }
});

router.post('/app/uninstalled', async (req: Request, res: Response) => {
  res.status(200).end();
});

router.post('/shop/update', async (req: Request, res: Response) => {
  res.status(200).end();
});

export default router;
