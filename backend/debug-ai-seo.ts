import express from 'express';
import { createAiSeoRoutes } from './routes/aiSeo';

const router = createAiSeoRoutes();
console.log('Router stack length:', router.stack.length);
router.stack.forEach((r, i) => {
  if (r.route) {
    console.log(`  ${i}: ${Object.keys(r.route.methods).join(',')} ${r.route.path}`);
  } else if (r.name) {
    console.log(`  ${i}: middleware (${r.name})`);
  } else {
    console.log(`  ${i}: unknown middleware`);
  }
});
