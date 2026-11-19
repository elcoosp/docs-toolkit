use crate::host::html_dom::PageDom;
use crate::host::md_source::MdDoc;
use aho_corasick::{AhoCorasick, AhoCorasickBuilder, MatchKind};
use lol_html::html_content::ContentType;
use lol_html::{RewriteStrSettings, element, rewrite_str, text};
use rayon::prelude::*;
use serde::Deserialize;
use std::cell::{Cell, RefCell};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeSymbolsCfg {
    #[serde(default = "default_max_links_per_block")]
    pub max_links_per_block: usize,
}
fn default_max_links_per_block() -> usize {
    8
}
#[derive(Debug, Clone)]
struct SymbolCandidate {
    symbol: String,
    href: String,
    base_route: String,
    priority: u8,
}
#[derive(Debug, Default)]
pub struct CodeSymbolsReport {
    pub symbols_indexed: usize,
    pub links_injected: usize,
    pub pages_enriched: usize,
}
const STOP: &[&str] = &[
    "fn",
    "let",
    "mut",
    "pub",
    "use",
    "mod",
    "crate",
    "self",
    "super",
    "struct",
    "enum",
    "trait",
    "impl",
    "type",
    "const",
    "static",
    "async",
    "await",
    "match",
    "return",
    "where",
    "for",
    "loop",
    "while",
    "if",
    "else",
    "break",
    "continue",
    "move",
    "ref",
    "dyn",
    "box",
    "unsafe",
    "extern",
    "true",
    "false",
    "null",
    "undefined",
    "void",
    "any",
    "never",
    "unknown",
    "number",
    "string",
    "boolean",
    "symbol",
    "bigint",
    "object",
    "function",
    "class",
    "interface",
    "extends",
    "implements",
    "import",
    "export",
    "from",
    "default",
    "new",
    "this",
    "var",
    "try",
    "catch",
    "finally",
    "throw",
    "typeof",
    "instanceof",
    "in",
    "of",
    "as",
    "is",
    "keyof",
    "readonly",
    "Option",
    "Result",
    "Some",
    "None",
    "Ok",
    "Err",
    "String",
    "Vec",
    "Box",
    "Arc",
    "Rc",
    "Cell",
    "RefCell",
    "Mutex",
    "RwLock",
    "HashMap",
    "HashSet",
    "BTreeMap",
    "BTreeSet",
    "Path",
    "PathBuf",
    "Error",
    "Default",
    "Clone",
    "Copy",
    "Debug",
    "Display",
    "Serialize",
    "Deserialize",
    "From",
    "Into",
    "TryFrom",
    "TryInto",
    "AsRef",
    "AsMut",
    "Deref",
    "DerefMut",
    "Drop",
    "Iterator",
    "Send",
    "Sync",
    "Sized",
    "Unpin",
    "Future",
    "Stream",
    "Pin",
    "PhantomData",
    "Promise",
    "Array",
    "Object",
    "Record",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "Partial",
    "Required",
    "Pick",
    "Omit",
    "Readonly",
    "Date",
    "RegExp",
    "JSON",
    "Math",
    "console",
    "window",
    "document",
    "process",
    "Buffer",
    "URL",
    "fetch",
    "Response",
    "Request",
    "Headers",
    "Event",
    "Element",
    "HTMLElement",
    "Node",
    "overview",
    "summary",
    "introduction",
    "example",
    "examples",
    "usage",
    "installation",
    "configuration",
    "options",
    "methods",
    "fields",
    "variants",
    "parameters",
    "returns",
    "errors",
    "notes",
    "reference",
    "guide",
    "tutorial",
    "explanation",
    "changelog",
];
fn is_ident_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b'-' || b == b'!' || b == b'$'
}
fn is_valid_code_symbol(sym: &str) -> bool {
    let len = sym.len();
    if !(3..=48).contains(&len) || STOP.iter().any(|s| s.eq_ignore_ascii_case(sym)) {
        return false;
    }
    let bytes = sym.as_bytes();
    if let Some(rest) = sym.strip_prefix("--") {
        return rest.len() >= 2
            && rest.as_bytes()[0].is_ascii_alphabetic()
            && rest
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    }
    let first = bytes[0];
    if !(first.is_ascii_alphabetic() || first == b'_' || first == b'$') {
        return false;
    }
    let core = sym.strip_suffix('!').unwrap_or(sym);
    if core.len() < 3
        || !core
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'$')
    {
        return false;
    }
    let hu = core.bytes().any(|b| b.is_ascii_uppercase());
    let hl = core.bytes().any(|b| b.is_ascii_lowercase());
    sym.ends_with('!') || core.contains('_') || (hu && hl) || (hu && core.len() >= 4)
}
fn extract_symbols(raw: &str) -> Vec<String> {
    let mut out = Vec::new();
    let cleaned = raw
        .replace('`', " ")
        .replace("#[derive(", " ")
        .replace("#[", " ")
        .replace(
            [
                '(', ')', '[', ']', '{', '}', ',', ';', ':', '\"', '\'', '<', '>',
            ],
            " ",
        );
    for tok in cleaned.split_whitespace() {
        let t = tok.trim_matches(|c: char| c == '.' || c == '*');
        if is_valid_code_symbol(t) && !out.iter().any(|x| x == t) {
            out.push(t.to_string());
        }
    }
    out
}
fn collect_symbol_table(
    pages: &[PageDom],
    docs: &[MdDoc],
) -> HashMap<String, Vec<SymbolCandidate>> {
    let mut raw: Vec<(String, SymbolCandidate)> = Vec::new();
    for p in pages {
        if p.route.contains("/404/")
            || p.route.contains("/changelog/")
            || p.route.contains("/blog/")
            || !p.route.contains("/reference/")
        {
            continue;
        }
        for sym in extract_symbols(&p.title) {
            raw.push((
                p.locale.clone(),
                SymbolCandidate {
                    symbol: sym,
                    href: p.route.clone(),
                    base_route: p.route.clone(),
                    priority: 3,
                },
            ));
        }
        for (anchor, htxt) in &p.headings {
            if anchor.is_empty() {
                continue;
            }
            let href = format!("{}#{}", p.route, anchor);
            for sym in extract_symbols(htxt) {
                raw.push((
                    p.locale.clone(),
                    SymbolCandidate {
                        symbol: sym,
                        href: href.clone(),
                        base_route: p.route.clone(),
                        priority: 1,
                    },
                ));
            }
        }
    }
    for d in docs {
        if !d.has_frontmatter {
            continue;
        }
        for alias in &d.aliases {
            let t = alias.trim();
            if is_valid_code_symbol(t) {
                raw.push((
                    d.locale.clone(),
                    SymbolCandidate {
                        symbol: t.to_string(),
                        href: d.route.clone(),
                        base_route: d.route.clone(),
                        priority: 2,
                    },
                ));
            }
        }
    }
    let mut grouped: HashMap<(String, String), Vec<SymbolCandidate>> = HashMap::new();
    for (loc, cand) in raw {
        grouped
            .entry((loc, cand.symbol.clone()))
            .or_default()
            .push(cand);
    }
    let mut per_loc: HashMap<String, Vec<SymbolCandidate>> = HashMap::new();
    for ((loc, _), mut list) in grouped {
        list.sort_by(|a, b| {
            b.priority
                .cmp(&a.priority)
                .then_with(|| a.href.cmp(&b.href))
        });
        let top = list[0].priority;
        let mut uniq: Vec<&SymbolCandidate> = Vec::new();
        for item in list.iter().filter(|x| x.priority == top) {
            if !uniq.iter().any(|u| u.href == item.href) {
                uniq.push(item);
            }
        }
        if uniq.len() == 1 {
            per_loc.entry(loc).or_default().push(uniq[0].clone());
        }
    }
    for list in per_loc.values_mut() {
        list.sort_by(|a, b| {
            b.symbol
                .len()
                .cmp(&a.symbol.len())
                .then_with(|| a.symbol.cmp(&b.symbol))
        });
    }
    per_loc
}
fn esc_attr(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('\"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}
fn is_skip_tok(t: &str) -> bool {
    t.starts_with("//")
        || t.starts_with("/*")
        || t.starts_with("* ")
        || t.starts_with("# ")
        || (t.starts_with('\"') && t.ends_with('\"'))
        || (t.starts_with('\'') && t.ends_with('\''))
        || (t.starts_with('`') && t.ends_with('`'))
}
fn rewrite_chunk(
    raw: &str,
    ac: &AhoCorasick,
    cands: &[SymbolCandidate],
    route: &str,
    seen: &mut HashSet<usize>,
    max_b: usize,
    added: &mut usize,
) -> Option<String> {
    if seen.len() >= max_b || raw.trim().len() < 3 || is_skip_tok(raw.trim()) {
        return None;
    }
    let bytes = raw.as_bytes();
    let mut out = String::with_capacity(raw.len() + 64);
    let mut last = 0usize;
    let mut chg = false;
    for m in ac.find_iter(raw) {
        if seen.len() >= max_b {
            break;
        }
        let idx = m.pattern().as_usize();
        if seen.contains(&idx) {
            continue;
        }
        let cand = &cands[idx];
        if cand.base_route == route && !cand.href.contains('#') {
            continue;
        }
        let (s, e) = (m.start(), m.end());
        if (s > 0 && is_ident_byte(bytes[s - 1])) || (e < bytes.len() && is_ident_byte(bytes[e])) {
            continue;
        }
        let pfx = &raw[..s];
        if pfx.bytes().filter(|&b| b == b'\"').count() % 2 == 1
            || pfx.bytes().filter(|&b| b == b'\'').count() % 2 == 1
        {
            continue;
        }
        out.push_str(&raw[last..s]);
        out.push_str("<a href=\"");
        out.push_str(&esc_attr(&cand.href));
        out.push_str("\" class=\"dt-code-symbol\">");
        out.push_str(&raw[s..e]);
        out.push_str("</a>");
        last = e;
        seen.insert(idx);
        *added += 1;
        chg = true;
    }
    if !chg {
        return None;
    }
    out.push_str(&raw[last..]);
    Some(out)
}
pub fn run_code_symbols(
    dist_dir: &Path,
    pages: &[PageDom],
    docs: &[MdDoc],
    cfg: &CodeSymbolsCfg,
) -> CodeSymbolsReport {
    let per_loc = collect_symbol_table(pages, docs);
    let symbols_indexed: usize = per_loc.values().map(|v| v.len()).sum();
    if symbols_indexed == 0 {
        return CodeSymbolsReport::default();
    }
    let mut autos: HashMap<String, (AhoCorasick, Vec<SymbolCandidate>)> = HashMap::new();
    for (loc, cands) in per_loc {
        let pats: Vec<&str> = cands.iter().map(|c| c.symbol.as_str()).collect();
        if let Ok(ac) = AhoCorasickBuilder::new()
            .match_kind(MatchKind::LeftmostLongest)
            .build(&pats)
        {
            autos.insert(loc, (ac, cands));
        }
    }
    let total_links = AtomicUsize::new(0);
    let total_pages = AtomicUsize::new(0);
    let max_b = cfg.max_links_per_block.max(1);
    pages.par_iter().for_each(|p| {
        if p.route.contains("/404/") {
            return;
        }
        let Some((ac, cands)) = autos.get(&p.locale) else {
            return;
        };
        let fp = dist_dir.join(&p.rel_path);
        let Ok(html) = fs::read_to_string(&fp) else {
            return;
        };
        if !html.contains("<code") {
            return;
        }
        let plinks = Rc::new(Cell::new(0usize));
        let in_skip = Rc::new(Cell::new(false));
        let seen = Rc::new(RefCell::new(HashSet::new()));
        let seen1 = seen.clone();
        let skip2 = in_skip.clone();
        let (skip3, seen3, plinks3) = (in_skip.clone(), seen.clone(), plinks.clone());
        let rw = rewrite_str(
            &html,
            RewriteStrSettings::new()
                .append_element_content_handler(element!(
                    ".sl-markdown-content pre code",
                    move |_| {
                        seen1.borrow_mut().clear();
                        Ok(())
                    }
                ))
                .append_element_content_handler(element!(
                    ".sl-markdown-content pre code *",
                    move |el| {
                        let is_s = el.tag_name() == "a"
                            || el.get_attribute("class").is_some_and(|c| {
                                c.split_whitespace().any(|w| w == "gutter" || w == "ln")
                            });
                        skip2.set(is_s);
                        Ok(())
                    }
                ))
                .append_element_content_handler(text!(".sl-markdown-content pre code", move |t| {
                    if skip3.get() {
                        return Ok(());
                    }
                    let mut added = 0usize;
                    if let Some(rep) = rewrite_chunk(
                        t.as_str(),
                        ac,
                        cands,
                        &p.route,
                        &mut seen3.borrow_mut(),
                        max_b,
                        &mut added,
                    ) {
                        plinks3.set(plinks3.get() + added);
                        t.replace(&rep, ContentType::Html);
                    }
                    Ok(())
                })),
        );
        let final_links = plinks.get();
        if final_links > 0
            && let Ok(nh) = rw
            && fs::write(&fp, nh).is_ok()
        {
            total_links.fetch_add(final_links, Ordering::Relaxed);
            total_pages.fetch_add(1, Ordering::Relaxed);
        }
    });
    CodeSymbolsReport {
        symbols_indexed,
        links_injected: total_links.load(Ordering::Relaxed),
        pages_enriched: total_pages.load(Ordering::Relaxed),
    }
}
