import { describe, expect, it } from 'vitest';
import { createSessionToken, hashPassword, readCookie, verifyPassword, verifySessionToken } from '../src/lib/auth';
import { legacyKey, isLegacyHtmlPath, legacyImageRedirect } from '../src/lib/redirects';
import { sanitizeHtml } from '../src/lib/sanitize';
import { normalizeRef } from '../src/lib/columns';
import { searchTokens, type ProductDetail } from '../src/lib/queries';
import { parseValues, RESOURCES, validateColumns } from '../src/lib/admin-resources';
import { csvToProducts, parseCsv, parseProductInput } from '../src/lib/admin-products';
import { expandProduct, productsToCsv } from '../src/lib/table';
import type { ColumnDef } from '../src/lib/columns';

describe('auth', () => {
  it('hashes and verifies passwords', async () => {
    const h = await hashPassword('s3cret!', 1000);
    expect(h.startsWith('pbkdf2_sha256$1000$')).toBe(true);
    expect(await verifyPassword('s3cret!', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
    expect(await verifyPassword('x', undefined)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });

  it('signs and verifies session tokens', async () => {
    const secret = 'x'.repeat(40);
    const t = await createSessionToken('admin', secret, 60, 1_000_000);
    expect(await verifySessionToken(t, secret, 1_000_000)).toBe('admin');
    expect(await verifySessionToken(t, secret, 1_000_000 + 61_000)).toBeNull();
    expect(await verifySessionToken(t, 'y'.repeat(40), 1_000_000)).toBeNull();
    expect(await verifySessionToken(t + 'a', secret, 1_000_000)).toBeNull();
    expect(await verifySessionToken(t, 'short', 1_000_000)).toBeNull();
  });

  it('reads cookies', () => {
    expect(readCookie('a=1; yac_admin=tok; b=2', 'yac_admin')).toBe('tok');
    expect(readCookie(null, 'a')).toBeUndefined();
  });
});

describe('legacy redirects', () => {
  it('normalizes legacy paths', () => {
    expect(legacyKey('/CVJ/Toyota.html')).toBe('/cvj/toyota.html');
    expect(legacyKey('/a/b.htm')).toBe('/a/b.html');
    expect(legacyKey('/%E4%B8%AD.html')).toBe('/中.html');
    expect(isLegacyHtmlPath('/x/y.HTML')).toBe(true);
    expect(isLegacyHtmlPath('/x/y.jpg')).toBe(false);
  });
  it('redirects old image URLs to /images', () => {
    expect(legacyImageRedirect('/cvj/new/AA-02.jpg')).toBe('/images/cvj/new/AA-02.jpg');
    expect(legacyImageRedirect('/pics/company-1s.JPG')).toBe('/images/pics/company-1s.JPG');
    expect(legacyImageRedirect('/images/cvj/a.jpg')).toBeNull();
    expect(legacyImageRedirect('/media/a.jpg')).toBeNull();
    expect(legacyImageRedirect('/cvj/toyota.html')).toBeNull();
  });
});

describe('sanitizeHtml', () => {
  it('keeps basic markup and strips dangerous content', () => {
    expect(sanitizeHtml('<p>Hi <strong>there</strong></p>')).toBe('<p>Hi <strong>there</strong></p>');
    expect(sanitizeHtml('<script>alert(1)</script><p>x</p>')).toBe('<p>x</p>');
    expect(sanitizeHtml('<a href="javascript:alert(1)" onclick="x()">a</a>')).toBe('<a>a</a>');
    expect(sanitizeHtml('<a href="https://e.com/?a=1&b=2">a</a>')).toContain('href="https://e.com/?a=1&amp;b=2"');
    expect(sanitizeHtml('<img src="/x.jpg" onerror="x()">')).toBe('<img src="/x.jpg">');
    expect(sanitizeHtml('<img src="data:text/html,x">')).toBe('<img>');
    expect(sanitizeHtml('1 < 2 & 3')).toBe('1 &lt; 2 &amp; 3');
    expect(sanitizeHtml('<p>open')).toBe('<p>open</p>');
  });
});

describe('search helpers', () => {
  it('normalizes reference numbers', () => {
    expect(normalizeRef('43-210/A')).toBe(normalizeRef('43210a'));
    expect(normalizeRef(' ab - 12 ')).toBe(normalizeRef('AB12'));
  });
  it('splits tokens and caps at 5', () => {
    expect(searchTokens('  a  b ')).toEqual(['a', 'b']);
    expect(searchTokens('1 2 3 4 5 6 7')).toHaveLength(5);
    expect(searchTokens('   ')).toEqual([]);
  });
});

describe('admin resource validation', () => {
  it('validates column definitions', () => {
    expect(validateColumns([{ key: 'yac', label: 'YAC', source: 'yac' }])).toBeNull();
    expect(validateColumns([])).not.toBeNull();
    expect(validateColumns([{ key: 'a', label: 'A', source: 'bogus' }])).not.toBeNull();
    expect(
      validateColumns([
        { key: 'a', label: 'A', source: 'yac' },
        { key: 'a', label: 'B', source: 'photo' },
      ]),
    ).toMatch(/重複/);
  });

  it('parses news input and rejects bad slugs', () => {
    const def = RESOURCES.news;
    const ok = parseValues(def, { slug: 'new-1', title_zh: '標題', is_published: true, published_at: '' }, 'create');
    expect('values' in ok && ok.values.slug).toBe('new-1');
    expect('values' in ok && ok.values.is_published).toBe(1);
    expect(parseValues(def, { slug: 'bad slug', title_zh: 'x' }, 'create')).toHaveProperty('error');
    expect(parseValues(def, { slug: 'ok', title_zh: '' }, 'create')).toHaveProperty('error');
  });

  it('skips createOnly fields on update', () => {
    const def = RESOURCES['site-pages'];
    const r = parseValues(def, { title: 'T', content_json: '{"a":1}' }, 'update');
    expect('values' in r && 'page_key' in r.values).toBe(false);
  });
});

const columns: ColumnDef[] = [
  { key: 'yac', label: 'YAC No.', source: 'yac' },
  { key: 'model', label: 'Car Model', source: 'app.car_model' },
  { key: 'year', label: 'Year', source: 'app.year_range' },
  { key: 'a', label: 'A', short: 'A', source: 'spec.a' },
  { key: 'oem', label: 'OEM', source: 'ref.OEM' },
  { key: 'photo', label: 'Photo', source: 'photo' },
];

function product(): ProductDetail {
  return {
    id: 1,
    page_id: 1,
    category_id: 1,
    brand_id: null,
    yac_no: 'AA-01',
    yac_no_normalized: 'aa01',
    yac_no_left: null,
    car_series: null,
    specs_json: '{"a":"25"}',
    notes: null,
    primary_image_url: '/x.jpg',
    is_published: 1,
    sort_order: 0,
    legacy_source_file: null,
    specs: { a: '25' },
    apps: [
      { id: 1, product_id: 1, car_brand_text: null, car_model: 'Corolla', engine: null, transmission: null, position: null, year_range: '90-95', sort_order: 0 },
      { id: 2, product_id: 1, car_brand_text: null, car_model: 'Camry', engine: null, transmission: null, position: null, year_range: '96-', sort_order: 1 },
    ],
    refs: [
      { id: 1, product_id: 1, ref_type: 'OEM', ref_no: '111', sort_order: 0 },
      { id: 2, product_id: 1, ref_type: 'OEM', ref_no: '222', sort_order: 1 },
    ],
  };
}

describe('catalog table + CSV', () => {
  it('expands one row per application', () => {
    const rows = expandProduct(product(), columns);
    expect(rows).toHaveLength(2);
  });

  it('round-trips export → import', () => {
    const csv = productsToCsv([product()], columns, columns.map((c) => c.label));
    const parsed = csvToProducts(parseCsv(csv), columns, 1);
    expect(parsed.error).toBeUndefined();
    expect(parsed.products).toHaveLength(1);
    const p = parsed.products[0];
    expect(p.yac_no).toBe('AA-01');
    expect(p.specs).toEqual({ a: '25' });
    expect(p.apps.map((a) => a.car_model)).toEqual(['Corolla', 'Camry']);
    expect(p.refs.map((r) => r.ref_no)).toEqual(['111', '222']);
    expect(p.primary_image_url).toBe('/x.jpg');
  });

  it('parses quoted CSV values and BOM', () => {
    expect(parseCsv('\uFEFFa,"b,1","c ""q"""\r\n1,2,3\n')).toEqual([
      ['a', 'b,1', 'c "q"'],
      ['1', '2', '3'],
    ]);
  });

  it('rejects mismatched column counts', () => {
    expect(csvToProducts([['a', 'b'], ['1', '2']], columns, 1).error).toMatch(/欄位數不符/);
  });

  it('validates product input', () => {
    expect(parseProductInput({ page_id: 1, yac_no: '' })).toHaveProperty('error');
    expect(parseProductInput({ page_id: 0, yac_no: 'A' })).toHaveProperty('error');
    expect(parseProductInput({ page_id: 1, yac_no: 'A', specs: { 'bad key': '1' } })).toHaveProperty('error');
    const ok = parseProductInput({ page_id: 1, yac_no: 'A', apps: [{ car_model: 'X' }, {}], refs: [{ ref_type: 'oem', ref_no: '1' }, { ref_type: 'oem', ref_no: '' }] });
    expect('value' in ok && ok.value.apps).toHaveLength(1);
    expect('value' in ok && ok.value.refs).toEqual([{ ref_type: 'OEM', ref_no: '1' }]);
  });
});
