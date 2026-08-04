// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.

import { describe, it, expect } from 'vitest';
import { truncateWithEllipsis, stripHtmlTags, generateExcerptFromHtml } from '../../utils/stringUtils';

/**
 * True when the string contains an isolated (unpaired) surrogate code unit —
 * the corruption introduced by slicing UTF-16 code units in the middle of a
 * surrogate pair. A valid "😀" contains paired surrogates, so it is NOT flagged.
 */
function hasLoneSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      // High surrogate: valid only when followed by a low surrogate.
      const next = value.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      i += 1; // skip the paired low surrogate
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      // Low surrogate with no preceding high surrogate.
      return true;
    }
  }
  return false;
}

describe('stringUtils — code-point-aware truncation', () => {
  it('never splits a surrogate pair at the truncation boundary (a😀b, 3)', () => {
    const result = truncateWithEllipsis('a😀b', 3);
    // "a😀b" is exactly 3 code points, so no truncation occurs (ellipsis is
    // only appended when truncated). The result is the original valid string.
    expect(result).toBe('a😀b');
    expect(hasLoneSurrogate(result)).toBe(false);
    expect(Array.from(result).length).toBe(3);
  });

  it('keeps an emoji intact when it lands exactly at the truncation boundary', () => {
    const result = truncateWithEllipsis('a😀bc', 3);
    expect(result).toBe('a😀\u2026');
    expect(hasLoneSurrogate(result)).toBe(false);
    expect(Array.from(result).length).toBe(3);
  });

  it('truncates CJK text on code-point boundaries', () => {
    const result = truncateWithEllipsis('中文测试', 3);
    expect(result).toBe('中文\u2026');
    expect(hasLoneSurrogate(result)).toBe(false);
    expect(Array.from(result).length).toBe(3);
  });

  it('does not split an emoji (surrogate pair) followed by CJK at the boundary', () => {
    const result = truncateWithEllipsis('🀄中文字', 3);
    expect(result).toBe('🀄中\u2026');
    expect(hasLoneSurrogate(result)).toBe(false);
    expect(Array.from(result).length).toBe(3);
  });

  it('keeps the contract: empty/null input → empty string', () => {
    expect(truncateWithEllipsis('', 5)).toBe('');
    expect(truncateWithEllipsis(null as any, 5)).toBe('');
  });

  it('keeps the contract: maxLength ≤ 1 edge', () => {
    expect(truncateWithEllipsis('abcdef', 1)).toBe('\u2026');
    expect(truncateWithEllipsis('abcdef', 0)).toBe('');
    expect(truncateWithEllipsis('a😀b', 1)).toBe('\u2026');
    expect(truncateWithEllipsis('a😀b', 0)).toBe('');
  });

  it('never exceeds maxLength code points and never emits lone surrogates', () => {
    const samples = ['a😀bcd😀e', '日本語のテキストです', '😀🀄a', 'plain ascii', 'x'.repeat(80)];
    for (const text of samples) {
      for (let maxLength = 0; maxLength <= 12; maxLength += 1) {
        const result = truncateWithEllipsis(text, maxLength);
        expect(hasLoneSurrogate(result)).toBe(false);
        expect(Array.from(result).length).toBeLessThanOrEqual(maxLength);
      }
    }
  });

  it('stripHtmlTags and generateExcerptFromHtml stay surrogate-safe end to end', () => {
    const stripped = stripHtmlTags('<p>😀 test</p>');
    expect(stripped).toBe('😀 test');
    expect(hasLoneSurrogate(stripped)).toBe(false);

    const excerpt = generateExcerptFromHtml('<p>a😀b more content here</p>', 5);
    expect(hasLoneSurrogate(excerpt)).toBe(false);
    expect(Array.from(excerpt).length).toBeLessThanOrEqual(5);
  });
});
