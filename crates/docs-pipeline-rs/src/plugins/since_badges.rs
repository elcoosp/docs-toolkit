use crate::host::html_dom::PageDom;
use lol_html::html_content::ContentType;
use lol_html::{element, rewrite_str, RewriteStrSettings};
use rayon::prelude::*;
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BadgeKind {
    New,
    Breaking,
    Deprecated,
}

#[derive(Debug, Clone)]
pub struct SinceEntry {
    pub version: String,
    pub kind: BadgeKind,
    pub note: String,
}

#[derive(Debug, Default)]
pub struct SinceBadgesReport {
    pub symbols_indexed: usize,
    pub badges_injected: usize,
    pub pages_enriched: usize,
}

const NOISE_WORDS: &[&str] = &[
    "toml", "json", "yaml", "html", "css", "svg", "wasm", "rust", "cargo", "crate",
    "serde", "tokio", "gpui", "leptos", "dioxus", "astro", "starlight", "when", "watch",
    "error", "result", "option", "string", "config", "builder", "default", "version",
    "feature", "features", "module", "struct", "enum", "trait", "impl", "async", "await",
];

fn is_noise_line(line: &str) -> bool {
    let l = line.to_ascii_lowercase();
    l.contains("renovate")
        || l.contains("merge pull request")
        || l.contains("*(deps)*")
        || l.contains("**deps:**")
        || l.contains("**ci:**")
        || l.contains("*(ci)*")
        || l.contains("**chore:**")
}

fn is_valid_badge_symbol(sym: &str, self_names: &HashSet<String>) -> bool {
    let len = sym.len();
    if !(4..=48).contains(&len) {
        return false;
    }
    let lower = sym.to_ascii_lowercase();
    if self_names.contains(&lower) || NOISE_WORDS.contains(&lower.as_str()) {
        return false;
    }
    let core = sym.trim_start_matches('-').trim_end_matches('!');
    if core.len() < 4
        || !core
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b':' || b == b'-')
    {
        return false;
    }
    let has_upper = core.bytes().any(|b| b.is_ascii_uppercase());
    let has_lower = core.bytes().any(|b| b.is_ascii_lowercase());
    let has_sep = core.contains('_') || core.contains("::") || sym.starts_with("--") || sym.ends_with('!');
    has_sep || (has_upper && has_lower)
}

fn extract_backticked_symbols(line: &str, self_names: &HashSet<String>) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = line;
    while let Some(start) = rest.find('`') {
        let after = &rest[start + 1..];
        let Some(end) = after.find('`') else { break };
        let token = after[..end].trim();
        let ident = token.split(['(', '<', '{', ' ']).next().unwrap_or("").trim();
        if is_valid_badge_symbol(ident, self_names) && !out.iter().any(|x| x == ident) {
            out.push(ident.to_string());
        }
        if let Some((_, tail)) = ident.rsplit_once("::") {
            if tail.len() >= 5
                && is_valid_badge_symbol(tail, self_names)
                && !out.iter().any(|x| x == tail)
            {
                out.push(tail.to_string());
            }
        }
        rest = &after[end + 1..];
    }
    out
}

fn detect_badge_kind(section: &str, line: &str) -> BadgeKind {
    let l = line.to_ascii_lowercase();
    if l.contains("deprecat") || section.contains("deprecat") {
        return BadgeKind::Deprecated;
    }
    if l.contains("[**breaking**]")
        || l.contains("**breaking**")
        || l.contains("breaking:")
        || (section.contains("breaking")
            && (l.contains("removed")
                || l.contains("replaced")
                || l.contains("renamed")
                || l.contains("moved")
                || l.contains("gone from")))
    {
        return BadgeKind::Breaking;
    }
    BadgeKind::New
}

fn clean_note(version: &str, line: &str) -> String {
    let trimmed = line
        .trim()
        .trim_start_matches(['-', '*'])
        .trim()
        .replace('`', "")
        .replace("**", "");
    let compact: String = trimmed.split_whitespace().collect::<Vec<_>>().join(" ");
    let clipped = if compact.chars().count() > 110 {
        let sub: String = compact.chars().take(110).collect();
        match sub.rfind(' ') {
            Some(idx) if idx > 40 => format!("{}…", &sub[..idx]),
            _ => format!("{sub}…"),
        }
    } else {
        compact
    };
    format!("v{version} — {clipped}")
}

fn parse_changelog(site_root: &Path) -> HashMap<String, SinceEntry> {
    let candidates = [
        site_root.join("CHANGELOG.md"),
        site_root.parent().map(|p| p.join("CHANGELOG.md")).unwrap_or_default(),
    ];
    let Some(cl_path) = candidates.into_iter().find(|p| p.is_file()) else {
        return HashMap::new();
    };
    let Ok(raw) = fs::read_to_string(&cl_path) else {
        return HashMap::new();
    };

    let mut self_names = HashSet::new();
    for p in [Some(site_root), site_root.parent()] {
        if let Some(name) = p.and_then(|x| x.file_name()).and_then(|n| n.to_str()) {
            let clean = name.strip_suffix("-docs").unwrap_or(name).to_ascii_lowercase();
            self_names.insert(clean.clone());
            self_names.insert(clean.replace('-', "_"));
        }
    }

    let mut releases: Vec<(String, Vec<(String, SinceEntry)>)> = Vec::new();
    let mut cur_ver: Option<String> = None;
    let mut cur_sec = String::new();
    let mut cur_items: Vec<(String, SinceEntry)> = Vec::new();

    for line in raw.lines() {
        if let Some(rest) = line.strip_prefix("## [") {
            if let Some(ver) = cur_ver.take() {
                releases.push((ver, std::mem::take(&mut cur_items)));
            }
            cur_sec.clear();
            if let Some(end) = rest.find(']') {
                let ver = rest[..end].trim();
                let is_semver = ver.split('.').count() == 3
                    && ver.split('.').all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()));
                if is_semver && ver != "0.1.0" {
                    cur_ver = Some(ver.to_string());
                }
            }
            continue;
        }
        if let Some(sec) = line.strip_prefix("### ") {
            cur_sec = sec.trim().to_ascii_lowercase();
            continue;
        }
        let Some(ref ver) = cur_ver else { continue };
        let sec_ok = ["added", "features", "breaking", "deprecated", "changed"]
            .iter()
            .any(|k| cur_sec.contains(k));
        if !sec_ok || is_noise_line(line) {
            continue;
        }
        let syms = extract_backticked_symbols(line, &self_names);
        if syms.is_empty() {
            continue;
        }
        let kind = detect_badge_kind(&cur_sec, line);
        let note = clean_note(ver, line);
        for sym in syms {
            cur_items.push((
                sym,
                SinceEntry {
                    version: ver.clone(),
                    kind,
                    note: note.clone(),
                },
            ));
        }
    }
    if let Some(ver) = cur_ver {
        releases.push((ver, cur_items));
    }

    // Iterate oldest -> newest so each symbol keeps its earliest introduction version,
    // while upgrading kind to Breaking/Deprecated if a later release broke or deprecated it.
    let mut map: HashMap<String, SinceEntry> = HashMap::new();
    for (_ver, items) in releases.into_iter().rev() {
        for (sym, entry) in items {
            match map.get_mut(&sym) {
                None => {
                    map.insert(sym, entry);
                }
                Some(existing) if entry.kind != BadgeKind::New => {
                    existing.kind = entry.kind;
                    existing.version = entry.version;
                    existing.note = entry.note;
                }
                _ => {}
            }
        }
    }
    map
}

fn match_heading_entry<'a>(heading: &str, table: &'a HashMap<String, SinceEntry>) -> Option<&'a SinceEntry> {
    let mut best: Option<(&str, &SinceEntry)> = None;
    for (sym, entry) in table {
        let mut pos = 0;
        while let Some(idx) = heading[pos..].find(sym.as_str()) {
            let abs = pos + idx;
            let end = abs + sym.len();
            let left_ok = abs == 0
                || !heading.as_bytes()[abs - 1].is_ascii_alphanumeric()
                    && heading.as_bytes()[abs - 1] != b'_';
            let right_ok = end == heading.len()
                || !heading.as_bytes()[end].is_ascii_alphanumeric()
                    && heading.as_bytes()[end] != b'_';
            if left_ok && right_ok {
                if best.map_or(true, |(b_sym, _)| sym.len() > b_sym.len()) {
                    best = Some((sym.as_str(), entry));
                }
                break;
            }
            pos = abs + 1;
        }
    }
    best.map(|(_, e)| e)
}

fn esc_attr(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn render_badge_html(entry: &SinceEntry, is_fr: bool) -> String {
    let (cls, label) = match entry.kind {
        BadgeKind::New => (
            "dt-since-new",
            if is_fr {
                format!("Nouveau v{}", entry.version)
            } else {
                format!("New in v{}", entry.version)
            },
        ),
        BadgeKind::Breaking => (
            "dt-since-breaking",
            if is_fr {
                format!("Rupture v{}", entry.version)
            } else {
                format!("Breaking v{}", entry.version)
            },
        ),
        BadgeKind::Deprecated => (
            "dt-since-deprecated",
            if is_fr {
                format!("Obsolète v{}", entry.version)
            } else {
                format!("Deprecated v{}", entry.version)
            },
        ),
    };
    format!(
        " <span class=\"dt-since-badge {cls}\" title=\"{}\">{label}</span>",
        esc_attr(&entry.note)
    )
}

pub fn run_since_badges(site_root: &Path, dist_dir: &Path, pages: &[PageDom]) -> SinceBadgesReport {
    let table = parse_changelog(site_root);
    if table.is_empty() {
        return SinceBadgesReport::default();
    }
    let symbols_indexed = table.len();
    let badges_injected = AtomicUsize::new(0);
    let pages_enriched = AtomicUsize::new(0);

    pages.par_iter().for_each(|page| {
if page.route.contains("/404/")
|| page.route.contains("/changelog/")
|| page.route.contains("/blog/")
{
return;
}
let mut by_id: HashMap<String, &SinceEntry> = HashMap::new();
for (id, htxt) in &page.headings {
if !id.is_empty() {
if let Some(entry) = match_heading_entry(htxt, &table) {
by_id.insert(id.clone(), entry);
}
}
}
if by_id.is_empty() {
return;
}
let html_path = dist_dir.join(&page.rel_path);
let Ok(html) = fs::read_to_string(&html_path) else {
return;
};
if html.contains("dt-since-badge") {
return;
}
let is_fr = page.locale == "fr";
let injected = Rc::new(RefCell::new(0usize));
let inj_clone = Rc::clone(&injected);
        let rewritten = rewrite_str(
            &html,
            RewriteStrSettings::new().append_element_content_handler(element!(
                ".sl-markdown-content h2[id], .sl-markdown-content h3[id]",
                move |el| {
                    if let Some(id) = el.get_attribute("id") {
                        if let Some(entry) = by_id.get(&id) {
                            el.append(&render_badge_html(entry, is_fr), ContentType::Html);
                            *inj_clone.borrow_mut() += 1;
                        }
                    }
                    Ok(())
                }
            )),
        );
let count = *injected.borrow();
if count > 0 {
if let Ok(next_html) = rewritten {
if fs::write(&html_path, next_html).is_ok() {
badges_injected.fetch_add(count, Ordering::Relaxed);
pages_enriched.fetch_add(1, Ordering::Relaxed);
}
}
}
});
SinceBadgesReport {
symbols_indexed,
badges_injected: badges_injected.load(Ordering::Relaxed),
pages_enriched: pages_enriched.load(Ordering::Relaxed),
}
}
