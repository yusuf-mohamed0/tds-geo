// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

export function createWordPressClient(baseUrl: string, apiKey: string): AxiosInstance {
  const normalizedUrl = baseUrl.replace(/\/+$/, '');

  const client = axios.create({
    baseURL: `${normalizedUrl}/wp-json/tds-geo/v1`,
    headers: {
      'Content-Type': 'application/json',
      'X-TDS-GEO-Key': apiKey,
    },
    timeout: 30000,
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        logger.error('WordPress API error', {
          status: error.response.status,
          data: error.response.data,
          url: error.config?.url,
        });
      } else if (error.request) {
        logger.error('WordPress API no response', { url: error.config?.url, message: error.message });
      }
      return Promise.reject(error);
    }
  );

  return client;
}
