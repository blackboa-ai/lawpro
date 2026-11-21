/** Render-only normalization for plain text extracted from legal judgments.
 *
 * PDF/plain-text line wraps should not dictate where the browser wraps words.
 * Preserve actual headings, numbered sections and lists, and be deliberately
 * conservative about joining text across blank lines. The API/source text is
 * never modified.
 */

export type LegalTextBlock = {
  kind: 'heading' | 'numbered' | 'signature' | 'paragraph';
  text: string;
};

const numberedStart = /^(?:\d+(?:\.\d+)*[.)]|\([a-zA-Z0-9ivxIVX]{1,5}\)|[a-zA-Z][.)]|[•–-])\s+\S/;
const signatureStart = /^(?:Signed\.|Sd\/-|By Order\b|Place\s*:|Date\s*:|Dated\s*:)/i;

function kindOf(line: string): LegalTextBlock['kind'] {
  const heading = line.replace(/^(?:\d+(?:\.\d+)*[.)]|[IVXLCDM]+[.)])\s+/, '');
  if (
    heading.length <= 100 &&
    /[A-Z]/.test(heading) &&
    heading === heading.toUpperCase() &&
    !/[.!?]$/.test(heading)
  ) return 'heading';
  if (signatureStart.test(line)) return 'signature';
  if (numberedStart.test(line)) return 'numbered';
  return 'paragraph';
}

function isContinuation(line: string, previous: LegalTextBlock): boolean {
  // A lowercase start following an unfinished sentence is often an OCR/PDF
  // fragment, not a separate legal paragraph. Never join numbered sections.
  return /^[a-z]/.test(line)
    && previous.kind !== 'heading'
    && previous.kind !== 'signature'
    && !/[.!?][”"')\]]?$/.test(previous.text);
}

export function formatLegalText(source: string): LegalTextBlock[] {
  const blocks: LegalTextBlock[] = [];
  let blankBefore = false;

  for (const raw of source.replace(/\r\n?|\u2028|\u2029/g, '\n').split('\n')) {
    const line = raw.replace(/[\t ]+/g, ' ').trim();
    if (!line) {
      blankBefore = true;
      continue;
    }

    const kind = kindOf(line);
    const previous = blocks[blocks.length - 1];

    if (!previous) {
      blocks.push({ kind, text: line });
    } else if (kind === 'paragraph' && (
      (!blankBefore && previous.kind !== 'heading' && previous.kind !== 'signature')
      || (blankBefore && isContinuation(line, previous))
    )) {
      // A soft line break, or a clearly unfinished paragraph after an
      // artificial blank line. Let CSS wrap it to the user's device width.
      previous.text += ' ' + line;
    } else {
      blocks.push({ kind, text: line });
    }

    blankBefore = false;
  }

  return blocks;
}
