import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('virtual:starlight-link-preview', () => ({
  LINK_PREVIEWS: {
    '/guides/macro/': {
      title: 'Macro Guide',
      description: 'Complete guide to writing procedural macros.',
      section: 'How-to Guide',
      readingTime: '3 min',
      headings: { syntax: 'Macro Syntax' },
    },
  },
}));

import { initPageActions } from '../src/config/components/page-actions-client';
import { initZenMode } from '../src/config/components/zen-mode-client';
import { initLinkPreview } from '../src/plugins/link-preview/client';
import { initRelatedPages } from '../src/plugins/related-pages/client';
import { initSmartTocProgress } from '../src/plugins/smart-toc-progress/client';
import { initTermGlossary } from '../src/plugins/term-glossary/client';

describe('Browser UI Clients & HoverCards (100% coverage)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    delete document.documentElement.dataset.zenMode;
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    vi.spyOn(window, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.endsWith('.md')) return new Response('', { status: 404 });
      if (u.endsWith('/related-pages.json')) {
        return new Response(
          JSON.stringify({
            '/': [
              {
                href: '/guides/macro/',
                title: 'Macro Guide',
                description: 'Learn macros',
                category: 'guides',
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (u.endsWith('/glossary-index.json')) {
        return new Response(
          JSON.stringify([
            {
              term: 'TokenStream',
              definition: 'Sequence of lexical tokens.',
              href: '/explanation/tokens/',
              locale: 'en',
            },
          ]),
          { status: 200 },
        );
      }
      return new Response('', { status: 404 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('covers PageActions (copy fallback markdown, share, AI dropdown) and ZenMode', async () => {
    document.body.innerHTML = [
      '<button type="button" data-zen-toggle aria-pressed="false"><span class="sl-zen-icon--expand"></span><span class="sl-zen-icon--compress"></span><span class="sl-zen-dot"></span></button>',
      '<div class="page-actions-container" data-copy-label="Copy" data-copied-label="Copied" data-copy-error="Error" data-share-label="Share" data-link-copied="Link Copied">',
      '  <button id="copy-markdown" type="button"><span class="morph-icon__base"></span><span class="morph-icon__check"><svg><path d="M0 0 L10 10"/></svg></span><span class="morph-label__default">Copy</span><span class="morph-label__success"></span></button>',
      '  <div class="action-dropdown" data-open="false"><button id="open-ai-trigger" type="button"><svg class="ai-chevron"></svg></button><div class="dropdown-menu"></div></div>',
      '  <button id="share-page" type="button"><span class="morph-label__default">Share</span><span class="morph-label__success"></span></button>',
      '</div>',
      '<main><h1>Doc Title</h1><div class="sl-markdown-content"><h2>Sub</h2><p>Hello <strong>bold</strong> and <em>em</em> and <code>code</code> and <a href="/a">link</a>.</p><ul><li>Bullet item</li></ul><pre>const x = 1;</pre></div></main>',
    ].join('\n');

    localStorage.removeItem('sl-zen-mode');
    document.documentElement.removeAttribute('data-zen-mode');
    if (!document.documentElement.dataset.zenBound) initZenMode();
    const zenBtn = document.querySelector<HTMLButtonElement>('[data-zen-toggle]')!;
    zenBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.documentElement.getAttribute('data-zen-mode')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', altKey: true, bubbles: true }));
    expect(document.documentElement.hasAttribute('data-zen-mode')).toBe(false);

    initPageActions();
    document.querySelector<HTMLButtonElement>('#copy-markdown')!.click();
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    document.querySelector<HTMLButtonElement>('#share-page')!.click();
    const trigger = document.querySelector<HTMLButtonElement>('#open-ai-trigger')!;
    trigger.click();
    expect(document.querySelector('.action-dropdown')?.getAttribute('data-open')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.action-dropdown')?.getAttribute('data-open')).toBe('false');
  });

  it('covers SmartTocProgress, RelatedPages, TermGlossary, and LinkPreview hover cards', async () => {
    window.history.replaceState({}, '', '/?highlight=TokenStream');
    document.body.innerHTML = [
      '<div class="sl-reading-context" data-reading-minutes="4"></div>',
      '<starlight-toc><nav><h2>On this page</h2><ul>',
      '  <li><a href="#_top">Overview</a></li>',
      '  <li><a href="#sec-1">Section 1</a></li>',
      '  <li><a href="#sec-2">Section 2</a></li>',
      '</ul></nav></starlight-toc>',
      '<main style="min-height: 2400px"><h1>Main</h1><div class="sl-markdown-content">',
      '  <p>The TokenStream holds parsed syntax tokens and <a id="prev-link" href="/guides/macro/#syntax">Macro Guide</a>.</p>',
      '  <h2 id="sec-1">Section 1</h2><p>Detailed explanation paragraph.</p><pre>fn main() {}</pre>',
      '  <h2 id="sec-2">Section 2</h2><p>Closing paragraph.</p>',
      '</div><footer></footer></main>',
    ].join('\n');

    initSmartTocProgress({ minHeadings: 3 });
    window.dispatchEvent(new Event('scroll'));

    initRelatedPages();
    await vi.waitFor(() => expect(document.querySelector('.sl-related-wrap')).not.toBeNull());

    initTermGlossary({ hoverDelay: 10 });
    await vi.waitFor(() => expect(document.querySelector('.sl-glossary-term')).not.toBeNull());
    const termBtn = document.querySelector<HTMLButtonElement>('.sl-glossary-term')!;
    termBtn.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(document.querySelector('.sl-hover-card')).not.toBeNull());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    initLinkPreview({ hoverDelay: 10 });
    const link = document.querySelector<HTMLAnchorElement>('#prev-link')!;
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await vi.waitFor(() =>
      expect(
        Array.from(document.querySelectorAll('.sl-hover-card'))
          .map((e) => e.textContent)
          .join(' '),
      ).toContain('Macro Guide'),
    );
  });

  it('covers PageActions share/error/dropdown-hover/escape and HoverCard hide/scroll/escape', async () => {
    document.body.innerHTML = [
      '<div class="page-actions-container" data-copy-label="Copy" data-copied-label="Copied" data-copy-error="Copy failed" data-share-label="Share" data-link-copied="Copied">',
      '  <button id="copy-markdown" type="button"><span class="morph-label__default">Copy</span></button>',
      '  <div class="action-dropdown" data-open="false"><button id="open-ai-trigger" type="button"></button><div class="dropdown-menu"></div></div>',
      '  <button id="share-page" type="button"><span class="morph-label__default">Share</span></button>',
      '</div>',
      '<div class="sl-markdown-content"><p><a id="lp-edge" href="/guides/macro/#syntax">Macro</a></p></div>',
    ].join('\n');

    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });
    initPageActions();
    document.querySelector<HTMLButtonElement>('#share-page')!.click();
    await vi.waitFor(() => expect(shareMock).toHaveBeenCalled());
    delete (navigator as any).share;

    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
    document.querySelector<HTMLButtonElement>('#copy-markdown')!.click();
    await vi.waitFor(() =>
      expect(document.querySelector('#copy-markdown .morph-label__default')?.textContent).toBe('Copy failed'),
    );

    const dropdown = document.querySelector<HTMLElement>('.action-dropdown')!;
    dropdown.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(dropdown.dataset.open).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dropdown.dataset.open).toBe('false');
    dropdown.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    dropdown.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const a = document.querySelector<HTMLAnchorElement>('#lp-edge')!;
    a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 230));
    a.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    window.dispatchEvent(new Event('scroll'));
  });

  it('covers TermGlossary ?highlight= arrival pulse, focus/blur keyboard access, and skipping <code> tags', async () => {
    window.history.replaceState({}, '', '/?highlight=TokenStream');
    document.body.innerHTML =
      '<main><div class="sl-markdown-content"><p>TokenStream outside code and <code>TokenStream</code> inside code.</p></div></main>';
    initTermGlossary({ hoverDelay: 10 });
    await vi.waitFor(() => expect(document.querySelectorAll('.sl-glossary-term').length).toBe(1));
    const trigger = document.querySelector<HTMLButtonElement>('.sl-glossary-term')!;
    trigger.dispatchEvent(new FocusEvent('focus'));
    trigger.dispatchEvent(new FocusEvent('blur'));
    window.history.replaceState({}, '', '/');
  });
});
