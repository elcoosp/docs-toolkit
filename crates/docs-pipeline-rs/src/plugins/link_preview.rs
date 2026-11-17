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

fn detect_section_label(route: &str) -> &'static str {
    let is_fr = route == "/fr/" || route.starts_with("/fr/");
    let p = if is_fr {
        let rest = route.strip_prefix("/fr").unwrap_or("/");
        if rest.is_empty() { "/" } else { rest }
    } else {
        route
    };
    if p.starts_with("/tutorials/") {
        if is_fr { "Tutoriel" } else { "Tutorial" }
    } else if p.starts_with("/guides/") {
        if is_fr { "Guide pratique" } else { "How-to Guide" }
    } else if p.starts_with("/reference/") {
        if is_fr { "Référence" } else { "Reference" }
    } else if p.starts_with("/explanation/") {
        if is_fr { "Explication" } else { "Explanation" }
    } else if p.starts_with("/blog/") {
        "Blog"
    } else if p.starts_with("/changelog/") {
        "Changelog"
    } else if is_fr {
        "Documentation"
    } else {
        "Overview"
    }
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

pub fn run_link_preview(dist_dir: &Path, pages: &[PageDom]) -> usize {
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
                section: detect_section_label(&p.route).to_string(),
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
