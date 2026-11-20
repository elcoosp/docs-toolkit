import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../src/config/components');
const astroSrc = readFileSync(resolve(root, 'Search.astro'), 'utf8');
const cssSrc = readFileSync(resolve(root, 'search.css'), 'utf8');
const tsSrc = readFileSync(resolve(root, 'search-client.ts'), 'utf8');

describe('Command Palette Linkedom DOM & Contract Suite', () => {
  const templateHtml = astroSrc.replace(/^---[\s\S]*?---/, '');
  const { document } = parseHTML(templateHtml);

  it('renders native dialog, combobox, listbox, and preview landmarks', () => {
    const dialog = document.querySelector('#sl-cmdk-dialog');
    expect(dialog?.tagName).toBe('DIALOG');
    const input = document.querySelector('#sl-cmdk-input');
    expect(input?.tagName).toBe('INPUT');
    expect(input?.getAttribute('type')).toBe('search');
    expect(input?.getAttribute('aria-controls')).toBe('sl-cmdk-list');
    const list = document.querySelector('#sl-cmdk-list');
    expect(list?.getAttribute('role')).toBe('listbox');
    expect(document.querySelector('#sl-cmdk-preview')).not.toBeNull();
  });

  it('includes distinct, conflict-free footer kbd hints for Tab, Cmd+M, and Alt+P/N', () => {
    const hints = Array.from(document.querySelectorAll('.sl-cmdk-footer .sl-cmdk-kbd')).map((el) =>
      el.textContent?.trim(),
    );
    expect(hints).toContain('Tab');
    expect(hints).toContain('⌘M');
    expect(hints).toContain('⌥P / ⌥N');
    expect(hints).not.toContain('⇧Tab');
  });

  it('enforces CSS safeguards against scrollbar flash on expand-ai and Bento AI grid', () => {
    expect(cssSrc).toContain('.sl-cmdk-list');
    expect(cssSrc).toContain('overflow-x: hidden');
    expect(cssSrc).toContain('.sl-cmdk-row--expand-ai:hover');
    expect(cssSrc).toContain(".sl-cmdk-row__mark[data-marked='true']");
    expect(tsSrc).toContain("selected.classList.contains('sl-cmdk-row--expand-ai')");
  });

  it('wires multi-select bundling, history recall, and live theme preview in search-client.ts', () => {
    expect(tsSrc).toContain('markedItems');
    expect(tsSrc).toContain('historyCursor');
    expect(tsSrc).toContain('previewThemeOriginal');
    expect(tsSrc).toContain('\\n\\n---\\n\\n');
  });
});
