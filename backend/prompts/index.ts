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
