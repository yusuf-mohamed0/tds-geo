// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { init, refreshIfExpired } from './auth';
import { fetchArticles, publishArticle, publishArticleWithTracking, uploadImage, fetchBlogs } from './content';
import { getRateLimitStatus } from './rate-limit';
import { fetchProducts, updateProduct, getProduct } from './products';

export type { ShopifyProductUpdate } from './products';

const shopifyService = {
  init,
  refreshIfExpired,
  fetchArticles,
  publishArticle,
  publishArticleWithTracking,
  uploadImage,
  fetchBlogs,
  getRateLimitStatus,
  fetchProducts,
  updateProduct,
  getProduct,
};

export default shopifyService;
