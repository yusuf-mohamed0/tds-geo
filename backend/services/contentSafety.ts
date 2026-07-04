// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

// ══════════════════════════════════════════════
// Content Safety System
// AI moderation layer for detecting dangerous DIY,
// legal liability, hallucinated facts, and unsafe content
// ══════════════════════════════════════════════

import { logger } from '../utils/logger';
import openaiService from './openai';

export interface SafetyFlag {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  text: string;
  suggestion?: string;
}

export interface SafetyResult {
  safe: boolean;
  flags: SafetyFlag[];
  summary: string;
  needsHumanReview: boolean;
}

class ContentSafetyService {
  /**
   * Run all safety checks on the given content.
   */
  async checkContent(content: string, keyword?: string): Promise<SafetyResult> {
    const flags: SafetyFlag[] = [];

    // 1. Pattern-based checks (fast, runs first)
    const patternFlags = this.patternCheck(content);
    flags.push(...patternFlags);

    // 2. AI moderation (deep check, only if API key is available)
    try {
      const aiResult = await openaiService.moderateContent(content);
      if (aiResult.flags) {
        for (const flag of aiResult.flags) {
          // Validate severity matches the union type
          const validSeverity = ['low', 'medium', 'high', 'critical'].includes(flag.severity)
            ? flag.severity as 'low' | 'medium' | 'high' | 'critical'
            : 'medium';
          const typedFlag: SafetyFlag = {
            category: flag.category || 'ai_moderation',
            severity: validSeverity,
            text: flag.text || 'Flagged by AI moderation',
            ...((flag as any).suggestion ? { suggestion: (flag as any).suggestion as string } : {})
          };
          // Avoid duplicates with pattern-based checks
          const isDuplicate = flags.some(f =>
            f.category === typedFlag.category && f.severity === typedFlag.severity
          );
          if (!isDuplicate) {
            flags.push(typedFlag);
          }
        }
      }
    } catch (err) {
      logger.warn('AI content moderation failed, using pattern checks only', {
        error: (err as Error).message
      });
    }

    // 3. Keyword-specific hallucination check
    if (keyword) {
      const hallucinationFlags = this.checkHallucinations(content, keyword);
      flags.push(...hallucinationFlags);
    }

    const criticalCount = flags.filter(f => f.severity === 'critical').length;
    const highCount = flags.filter(f => f.severity === 'high').length;

    this.logResults(flags, keyword);

    return {
      safe: criticalCount === 0 && highCount === 0,
      flags,
      summary: this.summarizeFlags(flags),
      needsHumanReview: flags.length > 0
    };
  }

  /**
   * Pattern-based safety check using regex patterns.
   */
  private patternCheck(content: string): SafetyFlag[] {
    const flags: SafetyFlag[] = [];
    const lower = content.toLowerCase();

    const patterns: Array<{
      pattern: RegExp;
      category: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      suggestion?: string;
    }> = [
      // ── Electrical Hazards ──
      {
        pattern: /(replace|install|fix|repair).{0,30}(electrical\s+panel|breaker\s+box|fuse\s+box)/i,
        category: 'electrical_hazard',
        severity: 'critical',
        suggestion: 'Always recommend a licensed electrician for electrical panel work'
      },
      {
        pattern: /(rewire|rewiring|wire\s+(a|an|the)\s+house|install\s+wiring)/i,
        category: 'electrical_hazard',
        severity: 'critical',
        suggestion: 'Electrical wiring should only be done by licensed electricians'
      },
      {
        pattern: /(fix\s+electrical|electrical\s+repair\s+(guide|yourself|diy|tips))/i,
        category: 'electrical_hazard',
        severity: 'high'
      },

      // ── Gas / HVAC Hazards ──
      {
        pattern: /(repair|fix|replace).{0,30}(gas\s+(line|pipe|valve|furnace|water\s+heater|boiler))/i,
        category: 'gas_hazard',
        severity: 'critical',
        suggestion: 'Gas line work requires a licensed gas fitter or plumber'
      },
      {
        pattern: /(cut|remove|disconnect).{0,20}(gas\s+(line|pipe|supply))/i,
        category: 'gas_hazard',
        severity: 'critical'
      },
      {
        pattern: /(fix\s+(furnace|boiler|water\s+heater|hvac)\s+(yourself|diy))/i,
        category: 'hvac_hazard',
        severity: 'high'
      },

      // ── Structural Hazards ──
      {
        pattern: /(remove|demolish|cut\s+into).{0,30}(load.?bearing\s+(wall|beam|support|column))/i,
        category: 'structural_hazard',
        severity: 'critical',
        suggestion: 'Never attempt structural modifications — always consult a structural engineer'
      },
      {
        pattern: /(foundation\s+repair|fix\s+foundation)\s+(yourself|diy|guide|how.?to)/i,
        category: 'structural_hazard',
        severity: 'high'
      },

      // ── Plumbing Hazards ──
      {
        pattern: /(repair|replace|fix).{0,30}(sewer\s+(line|pipe|main)|main\s+water\s+line)/i,
        category: 'plumbing_hazard',
        severity: 'high',
        suggestion: 'Major plumbing repairs require a licensed plumber'
      },

      // ── Medical / Health Claims ──
      {
        pattern: /(cure|treat|diagnose|prevent|heal).{0,20}(disease|illness|infection|allerg\w*|symptom|medical\s+condition)/i,
        category: 'medical_claim',
        severity: 'critical',
        suggestion: 'Remove medical claims — maintenance companies cannot diagnose or treat health conditions'
      },
      {
        pattern: /(mold\s+(removal|remediation|treatment))\s+(yourself|diy)/i,
        category: 'medical_claim',
        severity: 'high',
        suggestion: 'Mold remediation should reference professional services due to health risks'
      },

      // ── Legal Liability ──
      {
        pattern: /(guarantee[d]?\s+(100[%]|results|cure|fix|satisfaction))\b/i,
        category: 'overpromise',
        severity: 'medium',
        suggestion: 'Avoid absolute guarantees — use "backed by" or "stand behind our work" instead'
      },
      {
        pattern: /\b(always\s+(works|fixes|solves|cures))\b/i,
        category: 'overpromise',
        severity: 'medium'
      },

      // ── Roofing / Chimney Hazards ──
      {
        pattern: /replace\s+(roof|chimney)/i,
        category: 'roofing_hazard',
        severity: 'high',
        suggestion: 'Roofing and chimney work should be done by licensed professionals'
      },

      // ── Specific Dangerous Instructions ──
      {
        pattern: /\b(asbestos\s+(removal|abatement|testing))\s+(yourself|diy|guide|how.?to)/i,
        category: 'toxic_hazard',
        severity: 'critical',
        suggestion: 'Asbestos must be handled by licensed abatement professionals'
      },
      {
        pattern: /\b(lead\s+pain[t]\s+removal)\s+(yourself|diy|guide|how.?to)/i,
        category: 'toxic_hazard',
        severity: 'high'
      }
    ];

    for (const p of patterns) {
      const match = content.match(p.pattern);
      if (match) {
        flags.push({
          category: p.category,
          severity: p.severity,
          text: match[0].slice(0, 100),
          suggestion: p.suggestion || `Risky content detected: "${match[0].slice(0, 60)}"`
        });
      }
    }

    return flags;
  }

  /**
   * Check for hallucinated facts about the keyword.
   */
  private checkHallucinations(content: string, _keyword: string): SafetyFlag[] {
    const flags: SafetyFlag[] = [];
    const lower = content.toLowerCase();

    // Check for unsubstantiated numerical claims
    const percentClaims = lower.match(/\b\d+[%]\s+(of\s+)?(homes|people|customers|houses|buildings)\b/gi);
    if (percentClaims && percentClaims.length > 2) {
      flags.push({
        category: 'hallucinated_stat',
        severity: 'low',
        text: percentClaims.slice(0, 3).join('; '),
        suggestion: 'Verify statistical claims — consider using "many" or "most" instead of percentages'
      });
    }

    // Check for fake citations
    const fakeCitations = lower.match(/according\s+to\s+(a\s+)?(study|research|survey)\s+(by|from)\s+/gi);
    if (fakeCitations && fakeCitations.length > 0) {
      flags.push({
        category: 'unsubstantiated_citation',
        severity: 'low',
        text: fakeCitations[0],
        suggestion: 'Remove or verify citations — AI may fabricate study references'
      });
    }

    return flags;
  }

  /**
   * Summarize the flagged issues.
   */
  private summarizeFlags(flags: SafetyFlag[]): string {
    if (flags.length === 0) return 'No issues found';

    const bySeverity: Record<string, SafetyFlag[]> = {};
    for (const flag of flags) {
      if (!bySeverity[flag.severity]) bySeverity[flag.severity] = [];
      bySeverity[flag.severity].push(flag);
    }

    const parts: string[] = [];
    if (bySeverity.critical) parts.push(`${bySeverity.critical.length} critical issues`);
    if (bySeverity.high) parts.push(`${bySeverity.high.length} high-severity issues`);
    if (bySeverity.medium) parts.push(`${bySeverity.medium.length} medium issues`);
    if (bySeverity.low) parts.push(`${bySeverity.low.length} low-severity flags`);

    return parts.length > 0
      ? parts.join(', ') + ' found'
      : 'No issues found';
  }

  /**
   * Log safety check results.
   */
  private logResults(flags: SafetyFlag[], keyword?: string): void {
    if (flags.length === 0) {
      logger.debug('Content safety check passed', { keyword });
      return;
    }

    const critical = flags.filter(f => f.severity === 'critical');
    if (critical.length > 0) {
      logger.warn('Content safety: critical issues found', {
        keyword,
        criticalCount: critical.length,
        categories: [...new Set(critical.map(f => f.category))]
      });
    } else {
      logger.info('Content safety: non-critical flags raised', {
        keyword,
        flagCount: flags.length
      });
    }
  }
}

export default new ContentSafetyService();
