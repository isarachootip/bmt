export function extractDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function maskBankAccount(bankName: string, rawAccountNumber: string): string {
  const digits = extractDigits(rawAccountNumber);
  const last4 = digits.slice(-4).padStart(4, '•');
  return `${bankName.trim()} ••• ${last4}`;
}

export function maskTaxId(rawTaxId: string): string {
  const digits = extractDigits(rawTaxId);
  const last4 = digits.slice(-4).padStart(4, '•');
  return `••• •••• ••${last4}`;
}
