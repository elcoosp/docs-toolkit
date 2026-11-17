use crate::host::html_dom::PageDom;
use crate::host::md_source::{unquote_yaml, MdDoc};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct GlossaryEntry {
    pub term: String,
    pub definition: String,
    pub href: String,
    pub locale: String,
}

#[derive(Debug, Default)]
pub struct GlossaryReport {
    pub indexed: usize,
    pub coverage_pct: usize,
    pub avg_per_page: String,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

const GENERIC_HEADINGS: &[&str] = &[
    "overview", "summary", "introduction", "conclusion", "see also", "next steps",
    "prerequisites", "consequences", "working today", "converging",
    "vue d’ensemble", "vue d'ensemble", "résumé", "voir aussi", "prochaines étapes",
];

const SENTENCE_PREFIXES: &[&str] = &[
    "why", "how", "what", "where", "when", "which", "who",
    "pourquoi", "comment", "quoi", "où", "quand",
];

fn strip_mdx_inline(raw: &str) -> String {
    let mut no_tags = String::with_capacity(raw.len());
    let mut in_tag = false;
    for ch in raw.chars() {
        match ch {
            '<' => { in_tag = true; no_tags.push(' '); }
            '>' => { in_tag = false; }
            _ if !in_tag => no_tags.push(ch),
            _ => {}
        }
    }
    no_tags
        .replace(['*', '_', '~', '#', '>', '`'], "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn slugify(text: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in text.to_lowercase().chars() {
        let mapped = match ch {
            'à' | 'á' | 'â' | 'ä' => Some('a'),
            'ç' => Some('c'),
            'è' | 'é' | 'ê' | 'ë' => Some('e'),
            'î' | 'ï' => Some('i'),
            'ô' | 'ö' => Some('o'),
            'ù' | 'ú' | 'û' | 'ü' => Some('u'),
            'a'..='z' | '0'..='9' => Some(ch),
            ' ' | '-' | '_' => Some('-'),
            _ => None,
        };
        if let Some(c) = mapped {
            if c == '-' {
                if !prev_dash && !out.is_empty() {
                    out.push('-');
                    prev_dash = true;
                }
            } else {
                out.push(c);
                prev_dash = false;
            }
        }
    }
    out.trim_end_matches('-').to_string()
}

fn is_valid_concept_term(term: &str) -> bool {
    let len = term.chars().count();
    if !(4..=36).contains(&len) || term.ends_with('?') || term.ends_with('.') {
        return false;
    }
    let lower = term.to_lowercase();
    if GENERIC_HEADINGS.contains(&lower.as_str()) {
        return false;
    }
    let first_word = lower.split_whitespace().next().unwrap_or("");
    if SENTENCE_PREFIXES.contains(&first_word) {
        return false;
    }
    term.split_whitespace().count() <= 4
}

fn derive_terms(raw_title: &str, extra_aliases: &[String]) -> Vec<String> {
    let mut terms: Vec<String> = Vec::new();
    let mut push_unique = |t: String| {
        if !t.is_empty() && !terms.contains(&t) {
            terms.push(t);
        }
    };

    let cleaned = if let Some(idx) = raw_title.rfind(" (") {
        let suffix = raw_title[idx + 2..].trim_end_matches(')');
        if suffix.len() >= 2 && suffix.len() <= 5 && suffix.chars().all(|c| c.is_ascii_uppercase()) {
            raw_title[..idx].trim()
        } else {
            raw_title.trim()
        }
    } else {
        raw_title.trim()
    };

    if is_valid_concept_term(cleaned) {
        push_unique(cleaned.to_string());
    }

    let mut no_suffix = cleaned;
    for suf in [", explained", ", Explained", ", overview", ", Overview"] {
        if let Some(s) = no_suffix.strip_suffix(suf) {
            no_suffix = s.trim();
        }
    }
    if is_valid_concept_term(no_suffix) {
        push_unique(no_suffix.to_string());
    }

    let lower = no_suffix.to_lowercase();
    let no_article_owned: String;
    let no_article = if lower.starts_with("the ") {
        no_suffix[4..].trim()
    } else if lower.starts_with("les ") {
        no_suffix[4..].trim()
    } else if lower.starts_with("le ") || lower.starts_with("la ") {
        no_suffix[3..].trim()
    } else if lower.starts_with("l'") || lower.starts_with("l’") {
        no_article_owned = no_suffix.chars().skip(2).collect::<String>().trim().to_string();
        &no_article_owned
} else {
no_suffix
};
if is_valid_concept_term(no_article) {
push_unique(no_article.to_string());
}
for sep in [" and ", " et ", " vs ", " vs. ", " — ", " – ", " : "] {
if let Some(idx) = no_article.find(sep) {
let head = no_article[..idx].trim();
if is_valid_concept_term(head) {
push_unique(head.to_string());
}
break;
}
}
for alias in extra_aliases {
let t = alias.trim();
if t.chars().count() >= 3 {
push_unique(t.to_string());
}
}
terms
}
fn first_paragraph(lines: &[&str]) -> String {
let mut buf: Vec<&str> = Vec::new();
let mut fence = false;
for line in lines {
let t = line.trim();
if t.starts_with("```") || t.starts_with(":::") {
fence = !fence;
continue;
}
if fence {
continue;
}
if t.is_empty() {
if !buf.is_empty() {
break;
}
continue;
}
if t.starts_with('#') || t.starts_with("import ") || t.starts_with("export ")
|| t.starts_with('<') || t.starts_with('|') || t.starts_with('-') || t.starts_with('*')
{
if !buf.is_empty() {
break;
}
continue;
}
buf.push(t);
}
let clean = strip_mdx_inline(&buf.join(" "));
if clean.chars().count() > 220 {
let cut: String = clean.chars().take(217).collect();
format!("{}…", cut.trim_end())
} else {
clean
}
}
fn load_yaml(site_root: &Path) -> Vec< GlossaryEntry > {
for name in ["glossary.yml", "glossary.yaml"] {
let file = site_root.join("src/content").join(name);
let Ok(raw) = fs::read_to_string(&file) else { continue };
let mut entries: Vec< GlossaryEntry > = Vec::new();
let mut cur: HashMap<String, String> = HashMap::new();
for line in raw.lines() {
let t = line.trim();
if t.is_empty() || t.starts_with('#') {
continue;
}
if let Some(rest) = t.strip_prefix('-') {
if let (Some(term), Some(def), Some(href)) = (cur.get("term"), cur.get("definition"), cur.get("href")) {
entries.push(GlossaryEntry {
term: term.clone(),
definition: def.clone(),
href: href.clone(),
locale: cur.get("locale").cloned().unwrap_or_else(|| "en".to_string()),
});
}
cur.clear();
if let Some((k, v)) = rest.trim().split_once(':') {
let key = k.trim();
let val = unquote_yaml(v);
cur.insert(key.to_string(), if key == "locale" { val.to_lowercase() } else { val });
}
} else if let Some((k, v)) = t.split_once(':') {
let key = k.trim();
let val = unquote_yaml(v);
cur.insert(key.to_string(), if key == "locale" { val.to_lowercase() } else { val });
}
}
if let (Some(term), Some(def), Some(href)) = (cur.get("term"), cur.get("definition"), cur.get("href")) {
entries.push(GlossaryEntry {
term: term.clone(),
definition: def.clone(),
href: href.clone(),
locale: cur.get("locale").cloned().unwrap_or_else(|| "en".to_string()),
});
}
return entries;
}
Vec::new()
}
fn is_word_char(ch: char) -> bool {
ch.is_ascii_digit() || ch.is_alphabetic()
}
fn contains_term_word_boundary(haystack: &str, needle: &str) -> bool {
let mut start = 0usize;
while let Some(pos) = haystack[start..].find(needle) {
let abs = start + pos;
let prev = haystack[..abs].chars().next_back().unwrap_or(' ');
let mut end = abs + needle.len();
if haystack[end..].starts_with('s') {
end += 1;
}
let next = haystack[end..].chars().next().unwrap_or(' ');
if !is_word_char(prev) && !is_word_char(next) {
return true;
}
start = abs + needle.chars().next().map(|c| c.len_utf8()).unwrap_or(1);
}
false
}
pub fn run_glossary(site_root: &Path, dist_dir: &Path, docs: &[MdDoc], pages: &[PageDom]) -> GlossaryReport {
let mut entries = load_yaml(site_root);
if entries.is_empty() {
for doc in docs {
if !doc.rel_path.contains("explanation/") {
continue;
}
let lines: Vec<&str> = doc.body.lines().collect();
let def = first_paragraph(&lines);
if doc.title.chars().count() < 3 || def.chars().count() < 24 {
continue;
}
for term in derive_terms(&doc.title, &doc.aliases) {
entries.push(GlossaryEntry {
term,
definition: def.clone(),
href: doc.route.clone(),
locale: doc.locale.clone(),
});
}
let mut cur_anchor = String::new();
for (i, line) in lines.iter().enumerate() {
let t = line.trim();
if let Some(h) = t.strip_prefix("## ") {
let heading = strip_mdx_inline(h);
cur_anchor = slugify(&heading);
let h_def = first_paragraph(&lines[i + 1..]);
if h_def.chars().count() >= 30 {
let href = if cur_anchor.is_empty() {
doc.route.clone()
} else {
format!("{}#{cur_anchor}", doc.route)
};
for term in derive_terms(&heading, &[]) {
entries.push(GlossaryEntry {
term,
definition: h_def.clone(),
href: href.clone(),
locale: doc.locale.clone(),
});
}
}
}
}
}
entries.sort_by(|a, b| b.term.chars().count().cmp(&a.term.chars().count()));
let mut seen: HashSet< String > = HashSet::new();
entries.retain(|e| seen.insert(format!("{}:{}", e.locale, e.term.to_lowercase())));
} else {
entries.sort_by(|a, b| b.term.chars().count().cmp(&a.term.chars().count()));
}
if let Ok(json) = serde_json::to_string(&entries) {
let _ = fs::write(dist_dir.join("glossary-index.json"), json);
}
let mut report = GlossaryReport {
indexed: entries.len(),
..Default::default()
};
if entries.is_empty() {
report.warnings.push("0 glossary entries indexed (add src/content/glossary.yml or explanation/ pages).".to_string());
return report;
}
let page_by_route: HashMap<&str, &PageDom> = pages.iter().map(|p| (p.route.as_str(), p)).collect();
let mut seen_keys: HashSet< String > = HashSet::new();
for e in &entries {
let dup_key = format!("{}:{}", e.locale, e.term.to_lowercase());
if !seen_keys.insert(dup_key) {
report.warnings.push(format!(r#"Duplicate glossary term "{}" [{}]."#, e.term, e.locale));
}
let dlen = e.definition.chars().count();
if dlen < 24 {
report.warnings.push(format!(r#"Short definition ({dlen} chars) for "{}" [{}]."#, e.term, e.locale));
} else if dlen > 260 {
report.warnings.push(format!(r#"Long definition ({dlen} chars, will clamp) for "{}" [{}]."#, e.term, e.locale));
}
let (base_href, anchor) = e.href.split_once('#').unwrap_or((e.href.as_str(), ""));
match page_by_route.get(base_href) {
None => report.errors.push(format!(r#"Broken glossary href "{}" for "{}" [{}]."#, e.href, e.term, e.locale)),
Some(target) if !anchor.is_empty() && !target.ids.contains(anchor) => {
report.warnings.push(format!(r##"Missing anchor "#{}" on target page for "{}" [{}]."##, anchor, e.term, e.locale));
}
_ => {}
}
}
let content_pages: Vec<&PageDom> = pages
.iter()
.filter(|p| p.rel_path.ends_with("index.html") && !p.route.contains("/zen-mode/") && !p.route.contains("/404"))
.collect();
let mut pages_with_matches = 0usize;
let mut total_matches = 0usize;
let mut term_counts: HashMap<String, usize> = HashMap::new();
for p in &content_pages {
let hay = p.prose_text.to_lowercase();
let mut page_hits = 0usize;
for e in &entries {
if e.locale != p.locale {
continue;
}
let base_href = e.href.split('#').next().unwrap_or("");
if base_href == p.route {
continue;
}
if contains_term_word_boundary(&hay, &e.term.to_lowercase()) {
page_hits += 1;
let key = format!("{}:{}", e.locale, e.term);
*term_counts.entry(key).or_insert(0) += 1;
}
}
if page_hits > 0 {
pages_with_matches += 1;
}
total_matches += page_hits;
}
let mut orphans: Vec< String > = Vec::new();
for e in &entries {
let key = format!("{}:{}", e.locale, e.term);
let count = term_counts.get(&key).copied().unwrap_or(0);
if count == 0 {
orphans.push(format!("{}[{}]", e.term, e.locale));
} else if content_pages.len() >= 8 && (count as f64) / (content_pages.len() as f64) > 0.65 {
report.warnings.push(format!(
r#"Over-broad glossary term "{}" [{}] matches {count}/{} pages; consider a more specific phrase."#,
e.term, e.locale, content_pages.len()
));
}
}
if !orphans.is_empty() {
report.warnings.push(format!("Unmatched glossary terms (0 prose hits): {}.", orphans.join(", ")));
}
let n = content_pages.len();
report.coverage_pct = if n > 0 { ((pages_with_matches as f64 / n as f64) * 100.0).round() as usize } else { 0 };
report.avg_per_page = if n > 0 { format!("{:.2}", total_matches as f64 / n as f64) } else { "0.00".to_string() };
report
}
