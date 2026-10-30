import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

export interface Cell {
  text: string;
  lines: string[];
  html: string;
  href: string[];
  img: string[];
  isHeader: boolean;
  red: boolean;
  origin: string;
}

export type Grid = Cell[][];

const NBSP = /[\u00a0\u3000]/g;

export function cleanText(s: string): string {
  return s.replace(NBSP, ' ').replace(/[ \t\r\n]+/g, ' ').trim();
}

function cellLines($: cheerio.CheerioAPI, el: Element): string[] {
  const clone = $(el).clone();
  clone.find('br').replaceWith('\n');
  clone.find('p,div,li').each((_, n) => {
    $(n).append('\n');
  });
  return clone
    .text()
    .replace(NBSP, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t\r]+/g, ' ').trim())
    .filter(Boolean);
}

export function isRedMarker($: cheerio.CheerioAPI, el: Element): boolean {
  const html = ($.html(el) ?? '').toLowerCase();
  return /color:\s*#c00\b|color:\s*#cc0000|color=["']?#?(c00|cc0000|red)\b/.test(html);
}

export function emptyCell(): Cell {
  return { text: '', lines: [], html: '', href: [], img: [], isHeader: false, red: false, origin: 'own' };
}

/** 將 <table> 的 rowspan / colspan 展開為二維矩陣，被合併的格子會複製來源儲存格內容。 */
export function expandTable($: cheerio.CheerioAPI, table: Element): Grid {
  const grid: Grid = [];
  const trs: Element[] = [];
  $(table)
    .children('tr, thead, tbody, tfoot')
    .each((_, r) => {
      const el = r as Element;
      if (el.name === 'tr') trs.push(el);
      else $(el).children('tr').each((_, t) => void trs.push(t as Element));
    });
  trs.forEach((tr, ri) => {
    grid[ri] ??= [];
    let ci = 0;
    $(tr)
      .children('td, th')
      .each((_, c) => {
        const el = c as Element;
        while (grid[ri][ci]) ci++;
        const rs = Math.max(1, parseInt($(el).attr('rowspan') ?? '1', 10) || 1);
        const cs = Math.max(1, parseInt($(el).attr('colspan') ?? '1', 10) || 1);
        const lines = cellLines($, el);
        const cell: Cell = {
          text: lines.join(' '),
          lines,
          html: $(el).html() ?? '',
          href: $(el)
            .find('a[href]')
            .toArray()
            .map((a) => $(a).attr('href') ?? ''),
          img: $(el)
            .find('img[src]')
            .toArray()
            .map((i) => $(i).attr('src') ?? ''),
          isHeader: el.name === 'th',
          red: isRedMarker($, el),
          origin: 'own',
        };
        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            const r = ri + dr;
            grid[r] ??= [];
            grid[r][ci + dc] = dr === 0 && dc === 0 ? cell : { ...cell, origin: 'copy' };
          }
        }
        ci += cs;
      });
  });
  return grid.map((r) => Array.from(r, (c) => c ?? emptyCell()));
}

/** 取出最內層、至少 3 列的「資料表」。 */
export function findDataTables($: cheerio.CheerioAPI): Element[] {
  const out: Element[] = [];
  $('table').each((_, t) => {
    const el = t as Element;
    if ($(el).find('table').length > 0) return;
    if ($(el).find('tr').length >= 3) out.push(el);
  });
  return out;
}

export function normalizeRef(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
