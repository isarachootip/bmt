import Decimal from 'decimal.js';

export function toDecimal(value: number | string | Decimal): Decimal {
  return new Decimal(value);
}

export function roundMoney(value: number | string | Decimal): number {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function subtractMoney(
  minuend: number | string | Decimal,
  subtrahend: number | string | Decimal,
): number {
  return new Decimal(minuend)
    .minus(new Decimal(subtrahend))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function addMoney(
  a: number | string | Decimal,
  b: number | string | Decimal,
): number {
  return new Decimal(a)
    .plus(new Decimal(b))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}
