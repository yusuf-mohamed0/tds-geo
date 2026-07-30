import 'dotenv/config';
import { Pool } from 'pg';
import openaiService from '../services/openai';
import { convert } from '../utils/markdownToHtml';
import { assertMinimumArticleLength, countArticleWords } from '../services/contentLength';
import { presentArticleHtml } from '../services/articlePresentation';

const FLAUNT_CLIENT_ID = '1d0bbeee-1df0-4d82-9aae-51ec78eebcad';
const REPAIR_MINIMUM_WORDS = 1400;
const REPAIR_MAXIMUM_WORDS = 1800;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [FLAUNT_CLIENT_ID]);
    if (clientResult.rows.length === 0) throw new Error('Flaunt Cosmetics Global client was not found');
    const client = clientResult.rows[0];

    const articlesResult = await pool.query(
      `SELECT a.*, k.keyword
       FROM articles a
       LEFT JOIN keywords k ON k.id = a.keyword_id
       WHERE a.client_id = $1
         AND a.status = 'rejected'
         AND a.word_count < $2
       ORDER BY a.created_at ASC`,
      [FLAUNT_CLIENT_ID, REPAIR_MINIMUM_WORDS]
    );

    if (articlesResult.rows.length === 0) {
      console.log('No short Flaunt articles require repair.');
      return;
    }

    for (const existing of articlesResult.rows) {
      const generated = await openaiService.generateBlogPost({
        keyword: existing.keyword || existing.title,
        tone: client.brand_voice || 'warm, practical, confidence-building',
        minWords: REPAIR_MINIMUM_WORDS,
        maxWords: REPAIR_MAXIMUM_WORDS,
        clientSettings: {
          ...(client.settings || {}),
          siteName: 'Flaunt Cosmetics Global',
          siteDescription: 'Flaunt Cosmetics creates the No Hassle Eyeliner Stamp Set for confidence-building makeup routines in the UAE and Egypt.',
          brandVoiceGuidance: 'Write for Flaunt Cosmetics Global. Be warm, specific, practical, and confidence-building. Focus on inclusive, step-by-step eyeliner education. Do not make medical, dermatological, or unsupported performance claims. Use UAE and Egypt context only where it genuinely helps the reader.',
        },
      });

      const wordCount = assertMinimumArticleLength(
        generated.content,
        REPAIR_MINIMUM_WORDS,
        `Replacement for "${existing.title}"`
      );

      await pool.query(
        `UPDATE articles
         SET title = $1,
             content_md = $2,
             content_html = $3,
             meta_title = $4,
             meta_description = $5,
             tags = $6,
             word_count = $7,
             status = 'generated',
             scheduled_at = NULL,
             published_at = NULL,
             seo_score = NULL,
             quality_score = NULL,
             ai_evaluation_score = NULL,
             updated_at = NOW()
         WHERE id = $8`,
        [
          generated.title,
          generated.content,
          presentArticleHtml(convert(generated.content), client),
          generated.metaTitle,
          generated.metaDescription,
          generated.tags,
          wordCount,
          existing.id,
        ]
      );

      console.log(`Repaired ${existing.id}: ${wordCount} words — ${generated.title}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
