use crate::host::html_dom::PageDom;
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkPreviewEntry {
    pub title: String,
    pub description: String,
    pub section: String,
    pub reading_time: String,
    pub headings: BTreeMap<String, String>,
}

fn tr<'a>(i18n: &'a HashMap<String, HashMap<String, String>>, loc: &str, def: &str, key: &str, fb: &'a str) -> &'a str {
    i18n.get(loc).and_then(|d| d.get(key)).or_else(|| i18n.get(def).and_then(|d| d.get(key))).or_else(|| i18n.get("en").and_then(|d| d.get(key))).map(String::as_str).unwrap_or(fb)
}
fn detect_section_label<'a>(route: &str, loc: &str, def: &str, i18n: &'a HashMap<String, HashMap<String, String>>) -> &'a str {
    let pfx = format!("/{loc}");
    let p = if loc != def && (route == format!("{pfx}/") || route.starts_with(&format!("{pfx}/"))) { let r = route.strip_prefix(&pfx).unwrap_or("/"); if r.is_empty() { "/" } else { r } } else { route };
    if p.starts_with("/tutorials/") { tr(i18n, loc, def, "linkPreview.tutorial", "Tutorial") }
    else if p.starts_with("/guides/") { tr(i18n, loc, def, "linkPreview.guide", "How-to Guide") }
    else if p.starts_with("/reference/") { tr(i18n, loc, def, "linkPreview.reference", "Reference") }
    else if p.starts_with("/explanation/") { tr(i18n, loc, def, "linkPreview.explanation", "Explanation") }
    else if p.starts_with("/blog/") { tr(i18n, loc, def, "linkPreview.blog", "Blog") }
    else if p.starts_with("/changelog/") { tr(i18n, loc, def, "linkPreview.changelog", "Changelog") }
    else { tr(i18n, loc, def, "linkPreview.overview", "Overview") }
}
fn truncate_description(desc: &str) -> String {
    if desc.chars().count() <= 180 {
        return desc.to_string();
    }
    let slice: String = desc.chars().take(177).collect();
    if let Some(last_space) = slice.rfind(char::is_whitespace) {
        format!("{}…", &slice[..last_space])
    } else {
        format!("{slice}…")
    }
}

pub fn run_link_preview(dist_dir: &Path, pages: &[PageDom], default_locale: &str, i18n: &HashMap<String, HashMap<String, String>>) -> usize {
    let mut index: HashMap<String, LinkPreviewEntry> = HashMap::new();
    for p in pages {
        if p.route.contains("/404/") || p.route.contains("/zen-mode/") || p.route.contains("/presentation-mode/") {
            continue;
        }
        if p.title.is_empty() {
            continue;
        }
        let mins = ((p.main_word_count as f64) / 210.0).round().max(1.0) as usize;
        let mut headings = BTreeMap::new();
        for (id, text) in &p.headings {
            headings.insert(id.clone(), text.clone());
        }
        index.insert(
            p.route.clone(),
            LinkPreviewEntry {
                title: p.title.clone(),
                description: truncate_description(&p.description),
                section: detect_section_label(&p.route, &p.locale, default_locale, i18n).to_string(),
                reading_time: format!("{mins} min"),
                headings,
            },
        );
    }
    let count = index.len();
    if let Ok(json) = serde_json::to_string(&index) {
        let _ = fs::write(dist_dir.join("_link-previews.json"), json);
    }
    count
}
