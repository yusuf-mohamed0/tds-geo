import { init, refreshIfExpired } from './auth';
import { fetchArticles, publishArticle, publishArticleWithTracking, uploadImage, fetchBlogs } from './content';
import { getRateLimitStatus } from './rate-limit';

const shopifyService = {
  init,
  refreshIfExpired,
  fetchArticles,
  publishArticle,
  publishArticleWithTracking,
  uploadImage,
  fetchBlogs,
  getRateLimitStatus,
};

export default shopifyService;
