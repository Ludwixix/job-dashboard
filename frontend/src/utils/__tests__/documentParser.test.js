import { describe, it, expect } from 'vitest';
import { extractTextFromPastedPdfString } from '../documentParser';

describe('Document Parser & PDF Decoder', () => {
  it('handles regular text without alteration', async () => {
    const raw = 'John Doe\nSenior Cloud Engineer\njohn@example.com';
    const text = await extractTextFromPastedPdfString(raw);
    expect(text).toBe(raw);
  });
});
