// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { init, refreshIfExpired } from './auth';
import { fetchArticles, publishArticle, publishArticleLive, publishArticleWithTracking, uploadImage, fetchBlogs } from './content';
import { getArticle, updateArticle, deleteArticle, getArticleImage } from './articles';
import { getRateLimitStatus } from './rate-limit';
import { fetchProducts, updateProduct, getProduct, fetchCollections, fetchProductTags } from './products';

export type { ShopifyProductUpdate, ProductTag } from './products';
export type { ArticleUpdate } from './articles';

const shopifyService = {
  init,
  refreshIfExpired,
  fetchArticles,
  publishArticle,
  publishArticleLive,
  publishArticleWithTracking,
  uploadImage,
  fetchBlogs,
  getRateLimitStatus,
  fetchProducts,
  updateProduct,
  getProduct,
  getArticle,
  updateArticle,
  deleteArticle,
  getArticleImage,
  fetchCollections,
  fetchProductTags,
};

export default shopifyService;
