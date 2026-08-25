import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatEUR,
  formatEURCompact,
  formatNumber,
  formatPercent,
  toCSV,
  toNum,
} from './format';

/**
 * These tests pin the behaviour that matters most for correctness on this app:
 * Databricks SQL hands back DECIMAL / large BIGINT / ROUND() / SUM() values as
 * JSON *strings*, so every formatter must accept a string and still do real
 * arithmetic rather than concatenating.
 */
describe('toNum', () => {
  it('converts the string-typed numerics Databricks SQL actually returns', () => {
    expect(toNum('9508375958')).toBe(9508375958);
    expect(toNum('64.3')).toBe(64.3);
    expect(toNum(42)).toBe(42);
  });

  it('treats null, undefined and empty string as zero', () => {
    expect(toNum(null)).toBe(0);
    expect(toNum(undefined)).toBe(0);
    expect(toNum('')).toBe(0);
  });
});

describe('formatEURCompact', () => {
  it('formats the real portfolio total (a string at runtime) as compact EUR', () => {
    expect(formatEURCompact('9508375958')).toBe('€9.5B');
  });

  it('scales across magnitudes', () => {
    expect(formatEURCompact(12_400_000)).toBe('€12.4M');
    expect(formatEURCompact(950_000)).toBe('€950K');
    expect(formatEURCompact(750)).toBe('€750');
  });

  it('keeps the sign outside the currency symbol for negatives', () => {
    expect(formatEURCompact(-2_500_000)).toBe('-€2.5M');
  });

  it('renders missing values as zero rather than NaN', () => {
    expect(formatEURCompact(null)).toBe('€0');
  });
});

describe('formatEUR / formatNumber / formatPercent', () => {
  it('formats full EUR with grouping and no decimals', () => {
    expect(formatEUR('1234567')).toBe('€1,234,567');
  });

  it('groups plain numbers', () => {
    expect(formatNumber('3663')).toBe('3,663');
  });

  it('formats a ROUND()-derived rate string to fixed digits', () => {
    // exception_rate arrives as e.g. "0.79" from ROUND(...) in SQL.
    expect(formatPercent('0.79', 2)).toBe('0.79%');
    expect(formatPercent('64.32')).toBe('64.3%');
  });
});

describe('formatDate', () => {
  it('formats an ISO date from the warehouse', () => {
    expect(formatDate('2026-12-18')).toBe('18 Dec 2026');
  });

  it('renders an em dash when the date is missing', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('passes through unparseable values instead of showing Invalid Date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('toCSV', () => {
  const columns = [
    { key: 'customer_name', label: 'Customer' },
    { key: 'sales_value_eur', label: 'Sales value (EUR)' },
  ];

  it('emits a header row followed by the data rows', () => {
    const csv = toCSV([{ customer_name: 'Amazon', sales_value_eur: '1250000' }], columns);
    expect(csv).toBe('Customer,Sales value (EUR)\nAmazon,1250000');
  });

  it('quotes and escapes values containing commas, quotes or newlines', () => {
    const csv = toCSV([{ customer_name: 'Ahold, Delhaize', sales_value_eur: 1 }], columns);
    expect(csv).toBe('Customer,Sales value (EUR)\n"Ahold, Delhaize",1');

    const quoted = toCSV([{ customer_name: 'He said "yes"', sales_value_eur: 1 }], columns);
    expect(quoted).toContain('"He said ""yes"""');
  });

  it('renders missing fields as empty cells', () => {
    const csv = toCSV([{ customer_name: 'Picnic' }], columns);
    expect(csv).toBe('Customer,Sales value (EUR)\nPicnic,');
  });

  it('accepts interface-typed query rows without a cast', () => {
    interface Row {
      customer_name: string;
      sales_value_eur: number;
    }
    const rows: Row[] = [{ customer_name: 'IKEA', sales_value_eur: 5 }];
    expect(toCSV(rows, columns)).toBe('Customer,Sales value (EUR)\nIKEA,5');
  });

  it('produces a header-only document for an empty result set', () => {
    expect(toCSV([], columns)).toBe('Customer,Sales value (EUR)\n');
  });
});
