/**
 * Normalizes phone numbers from both typed strings and spoken voice words
 * e.g., "four one five five five five oh one ninety" -> "(415) 555-0190"
 */

const WORD_TO_DIGIT: Record<string, string> = {
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',
  sixty: '60',
  seventy: '70',
  eighty: '80',
  ninety: '90',
};

export function parsePhoneNumber(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let cleaned = raw.toLowerCase().trim();

  // Replace spoken word numbers
  for (const [word, digit] of Object.entries(WORD_TO_DIGIT)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    cleaned = cleaned.replace(regex, digit);
  }

  // Extract only numeric digits
  const digits = cleaned.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // If already standard or partial, return stripped or raw cleaned
  return digits.length >= 7 ? digits : raw.trim();
}

export function isValidPhoneNumber(raw: string): boolean {
  const parsed = parsePhoneNumber(raw);
  const digits = parsed.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

