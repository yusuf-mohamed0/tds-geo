// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import * as fs from 'fs';
import * as path from 'path';

const PROMPTS_DIR = __dirname;

function loadPrompt(filename: string, vars: Record<string, any>): string {
  const filePath = path.join(PROMPTS_DIR, filename);
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    throw new Error(`Prompt file not found: ${filePath}`);
  }

  for (const [key, value] of Object.entries(vars)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
  }

  return content;
}

export interface WritingPromptVars {
  TOPIC: string;
  SITE_NAME: string;
  SITE_DESCRIPTION: string;
  CATEGORIES: string;
  DATE: string;
  YEAR: string;
  GRAPHIFY_CONTEXT?: string;
}

export function writingSystemPrompt(vars: WritingPromptVars): string {
  return loadPrompt('writing-system-prompt.md', vars as unknown as Record<string, string>);
}

export interface ResearchPromptVars {
  TOPIC: string;
  SITE_NAME: string;
}

export function researchPrompt(vars: ResearchPromptVars): string {
  return loadPrompt('research-prompt.md', vars as unknown as Record<string, string>);
}

export function aeoSystemPrompt(vars: Record<string, any>): string {
  return loadPrompt('aeo-answer-engine-prompt.md', vars);
}

export function geoSystemPrompt(vars: Record<string, any>): string {
  return loadPrompt('geo-generative-engine-prompt.md', vars);
}

export function llmoSystemPrompt(vars: Record<string, any>): string {
  return loadPrompt('llmo-large-language-model-prompt.md', vars);
}

export function aiSeoConsultingPrompt(vars: Record<string, any>): string {
  return loadPrompt('ai-seo-consulting-framework-prompt.md', vars);
}

export function writingOutlinePrompt(vars: WritingPromptVars): string {
  return loadPrompt('writing-outline-prompt.md', vars as unknown as Record<string, string>);
}

export function combinedAiSeoPrompt(vars: WritingPromptVars & { FOCUS?: string }): string {
  const master = writingSystemPrompt(vars);
  const aeo = aeoSystemPrompt({ TOPIC: vars.TOPIC });
  const geo = geoSystemPrompt({ TOPIC: vars.TOPIC });
  const llmo = llmoSystemPrompt({ TOPIC: vars.TOPIC });

  return [
    master,
    '',
    '---',
    '## AI SEARCH OPTIMIZATION — SUPPLEMENTAL DIRECTIVES',
    `Focus: ${vars.FOCUS || 'All AI search surfaces (AEO + GEO + LLMO)'}`,
    '',
    aeo,
    '',
    '---',
    geo,
    '',
    '---',
    llmo,
  ].join('\n');
}
