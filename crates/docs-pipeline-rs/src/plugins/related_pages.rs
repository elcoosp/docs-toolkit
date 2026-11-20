use crate::host::html_dom::PageDom;
use crate::host::md_source::MdDoc;
use lol_html::{RewriteStrSettings, element, html_content::ContentType, rewrite_str};
use rayon::prelude::*;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct RelatedItem {
    pub href: String,
    pub title: String,
    pub description: String,
    pub category: String,
}

const RELATED_CSS: &str = r#"<style id="sl-related-pages-style">.sl-related-wrap{margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--sl-color-hairline)}.sl-related-title{font-size:var(--sl-text-sm);font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--sl-color-gray-2);margin:0 0 .85rem 0}.sl-related-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem}.sl-related-card{display:flex;flex-direction:column;gap:.35rem;padding:.85rem 1rem;border-radius:.5rem;border:1px solid var(--sl-color-hairline);background:var(--sl-color-bg-nav);text-decoration:none;color:inherit;transition:border-color .15s ease,transform .15s ease}.sl-related-card:hover{border-color:var(--sl-color-accent);transform:translateY(-1px)}.sl-related-badge{align-self:flex-start;font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:.12rem .45rem;border-radius:999px;background:var(--sl-color-accent-low);color:var(--sl-color-text-accent)}.sl-related-card-title{font-weight:600;font-size:var(--sl-text-base);color:var(--sl-color-white);line-height:1.3}.sl-related-card-desc{font-size:var(--sl-text-xs);color:var(--sl-color-gray-3);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}</style>"#;

const STOPWORDS: &[&str] = &[
    "the", "and", "for", "with", "that", "this", "from", "into", "your", "when", "where", "what",
    "which", "how", "why", "are", "was", "were", "will", "can", "could", "should", "would", "have",
    "has", "had", "not", "but", "use", "using", "les", "des", "une", "dans", "pour", "avec",
    "sans", "sur", "par", "est", "sont", "cette", "ces", "qui", "que", "quoi", "comment",
    "pourquoi", "quand", "plus", "tout", "tous", "chaque", "entre", "vers", "aux", "vous", "nous",
];

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn category_label(cat: &str, is_fr: bool) -> &'static str {
    match (cat, is_fr) {
        ("tutorials", true) => "Tutoriel",
        ("tutorials", false) => "Tutorial",
        ("guides", true) => "Guide",
        ("guides", false) => "Guide",
        ("explanation", true) => "Explication",
        ("explanation", false) => "Explanation",
        ("reference", true) => "Référence",
        ("reference", false) => "Reference",
        (_, true) => "Doc",
        (_, false) => "Docs",
    }
}

fn render_related_ssr(items: &[RelatedItem], is_fr: bool) -> String {
    let heading = if is_fr {
        "Pour aller plus loin"
    } else {
        "Related reading"
    };
    let mut cards = String::new();
    for it in items {
        let badge = category_label(&it.category, is_fr);
        cards.push_str(&format!(
            r#"<a class="sl-related-card" href="{}"><span class="sl-related-badge">{}</span><span class="sl-related-card-title">{}</span>"#,
            escape_html(&it.href),
            escape_html(badge),
            escape_html(&it.title),
        ));
        if !it.description.is_empty() {
            cards.push_str(&format!(
                r#"<span class="sl-related-card-desc">{}</span>"#,
                escape_html(&it.description)
            ));
        }
        cards.push_str("</a>");
    }
    format!(
        r#"<section class="sl-related-wrap not-content" data-ssr="true" aria-label="{}"><h2 class="sl-related-title">{}</h2><div class="sl-related-grid">{}</div></section>"#,
        escape_html(heading),
        escape_html(heading),
        cards
    )
}

fn normalize_ascii_lower(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| match c {
            'à' | 'á' | 'â' | 'ä' => 'a',
            'ç' => 'c',
            'è' | 'é' | 'ê' | 'ë' => 'e',
            'î' | 'ï' => 'i',
            'ô' | 'ö' => 'o',
            'ù' | 'ú' | 'û' | 'ü' => 'u',
            _ => c,
        })
        .collect()
}

fn tokenize(text: &str) -> Vec<String> {
    let norm = normalize_ascii_lower(text);
    let mut tokens: Vec<String> = Vec::new();
    let mut cur = String::new();
    for ch in norm.chars() {
        let valid = if cur.is_empty() {
            ch.is_ascii_lowercase()
        } else {
            ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_' || ch == '-'
        };
        if valid {
            cur.push(ch);
        } else if !cur.is_empty() {
            if cur.len() >= 3 && !STOPWORDS.contains(&cur.as_str()) {
                tokens.push(std::mem::take(&mut cur));
            } else {
                cur.clear();
            }
        }
    }
    if cur.len() >= 3 && !STOPWORDS.contains(&cur.as_str()) {
        tokens.push(cur);
    }
    tokens
}

fn strip_code_and_tags(body: &str) -> String {
    let mut out: Vec<String> = Vec::new();
    let mut in_fence = false;
    for line in body.lines() {
        let t = line.trim();
        if t.starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence || t.starts_with("import ") || t.starts_with("export ") {
            continue;
        }
        let mut clean = String::with_capacity(t.len());
        let mut in_tag = false;
        let mut in_code = false;
        for ch in t.chars() {
            match ch {
                '<' => {
                    in_tag = true;
                    clean.push(' ');
                }
                '>' => {
                    in_tag = false;
                }
                '`' => {
                    in_code = !in_code;
                    clean.push(' ');
                }
                _ if !in_tag && !in_code => clean.push(ch),
                _ => {}
            }
        }
        out.push(clean);
    }
    out.join(" ")
}

fn detect_category(rel_no_locale: &str) -> &'static str {
    match rel_no_locale.split('/').next().unwrap_or("") {
        "tutorials" => "tutorials",
        "guides" => "guides",
        "explanation" => "explanation",
        "reference" => "reference",
        _ => "docs",
    }
}

struct DocRecord<'a> {
    doc: &'a MdDoc,
    category: &'static str,
    tf: HashMap<String, f64>,
    doc_len: f64,
}

pub fn run_related_pages(
    dist_dir: &Path,
    pages: &[PageDom],
    docs: &[MdDoc],
    max_related: usize,
) -> (usize, String, usize, HashMap<String, Vec<String>>) {
    let mut by_locale: HashMap<&str, Vec<DocRecord<'_>>> = HashMap::new();
    for doc in docs {
        if doc.rel_path.ends_with("404.md") || doc.rel_path.ends_with("404.mdx") {
            continue;
        }
        if doc.rel_no_locale == "index.md"
            || doc.rel_no_locale == "index.mdx"
            || doc.rel_no_locale.starts_with("blog/")
        {
            continue;
        }
        if doc.title.is_empty() {
            continue;
        }
        let mut tf: HashMap<String, f64> = HashMap::new();
        for t in tokenize(&doc.title) {
            *tf.entry(t).or_insert(0.0) += 4.0;
        }
        for t in tokenize(&doc.description) {
            *tf.entry(t).or_insert(0.0) += 2.0;
        }
        for t in tokenize(&strip_code_and_tags(&doc.body)) {
            *tf.entry(t).or_insert(0.0) += 1.0;
        }
        let doc_len: f64 = tf.values().copied().sum::<f64>().max(1.0);
        by_locale
            .entry(doc.locale.as_str())
            .or_default()
            .push(DocRecord {
                doc,
                category: detect_category(&doc.rel_no_locale),
                tf,
                doc_len,
            });
    }

    let mut graph: HashMap<String, Vec<RelatedItem>> = HashMap::new();
    let k1 = 1.4_f64;
    let b = 0.65_f64;

    for group in by_locale.values() {
        let n_docs: f64 = group.len() as f64;
        if group.len() <= 1 {
            continue;
        }
        let mut df: HashMap<&str, f64> = HashMap::new();
        let mut total_len: f64 = 0.0;
        for d in group {
            total_len += d.doc_len;
            for term in d.tf.keys() {
                *df.entry(term.as_str()).or_insert(0.0) += 1.0;
            }
        }
        let avgdl: f64 = (total_len / n_docs).max(1.0);

        for src in group {
            let mut scored: Vec<(&DocRecord<'_>, f64)> = Vec::new();
            for cand in group {
                if cand.doc.route == src.doc.route {
                    continue;
                }
                let mut score: f64 = 0.0;
                for (term, src_w) in &src.tf {
                    let Some(&cand_tf) = cand.tf.get(term) else {
                        continue;
                    };
                    let term_df: f64 = df.get(term.as_str()).copied().unwrap_or(1.0);
                    let idf: f64 = (1.0_f64 + (n_docs - term_df + 0.5) / (term_df + 0.5)).ln();
                    let norm_tf: f64 = (cand_tf * (k1 + 1.0))
                        / (cand_tf + k1 * (1.0 - b + b * (cand.doc_len / avgdl)));
                    score += idf * norm_tf * src_w.min(4.0);
                }
                if cand.category != src.category {
                    score *= 1.18;
                }
                if score > 0.2 {
                    scored.push((cand, score));
                }
            }
            scored.sort_by(|a, b_item| {
                b_item
                    .1
                    .partial_cmp(&a.1)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            let mut picked: Vec<&DocRecord<'_>> = Vec::new();
            let mut used_cats = HashSet::from([src.category]);
            for (cand, _) in &scored {
                if picked.len() >= max_related {
                    break;
                }
                if used_cats.insert(cand.category) {
                    picked.push(cand);
                }
            }
            for (cand, _) in &scored {
                if picked.len() >= max_related {
                    break;
                }
                if !picked.iter().any(|p| p.doc.route == cand.doc.route) {
                    picked.push(cand);
                }
            }
            graph.insert(
                src.doc.route.clone(),
                picked
                    .into_iter()
                    .map(|p| RelatedItem {
                        href: p.doc.route.clone(),
                        title: p.doc.title.clone(),
                        description: p.doc.description.clone(),
                        category: p.category.to_string(),
                    })
                    .collect(),
            );
        }
    }
    // Ensure every non-root page in each locale has at least one inbound related link (zero orphans)
    let mut inbound: std::collections::HashSet<String> = graph
        .values()
        .flat_map(|items| items.iter().map(|it| it.href.clone()))
        .collect();
    for group in by_locale.values() {
        for cand in group {
            if cand.doc.route == "/"
                || cand.doc.route == "/fr/"
                || inbound.contains(&cand.doc.route)
            {
                continue;
            }
            let best_src = group
                .iter()
                .filter(|s| {
                    s.doc.route != cand.doc.route
                        && !s.doc.rel_no_locale.starts_with("blog/")
                        && graph.contains_key(&s.doc.route)
                })
                .min_by_key(|s| graph.get(&s.doc.route).map(|v| v.len()).unwrap_or(0));
            if let Some(src) = best_src {
                graph
                    .entry(src.doc.route.clone())
                    .or_default()
                    .push(RelatedItem {
                        href: cand.doc.route.clone(),
                        title: cand.doc.title.clone(),
                        description: cand.doc.description.clone(),
                        category: cand.category.to_string(),
                    });
                inbound.insert(cand.doc.route.clone());
            }
        }
    }

    // Inject static SSR related cards into built HTML pages so search crawlers & doc-graph see real internal links
    pages.par_iter().for_each(|page| {
        if !page.rel_path.ends_with("index.html")
            || page.route.starts_with("/zen-mode/")
            || page.route.contains("/404/")
        {
            return;
        }
        let Some(items) = graph.get(&page.route) else {
            return;
        };
        if items.is_empty() {
            return;
        }
        let html_path = dist_dir.join(&page.rel_path);
        let Ok(html) = fs::read_to_string(&html_path) else {
            return;
        };
        let is_fr = page.locale == "fr" || page.route.starts_with("/fr/");
        let mut injected = false;
        let rw = if html.contains("sl-related-wrap") {
            let missing_cards: String = items
                .iter()
                .filter(|it| !html.contains(&format!("href=\"{}\"", it.href)))
                .map(|it| {
                    format!(
                        "<a class=\"sl-related-card\" href=\"{}\"><span class=\"sl-related-card__cat\">{}</span><span class=\"sl-related-card__title\">{}</span></a>",
                        escape_html(&it.href),
                        escape_html(&it.category),
                        escape_html(&it.title),
                    )
                })
                .collect();
            if missing_cards.is_empty() {
                return;
            }
            rewrite_str(
                &html,
                RewriteStrSettings::new().append_element_content_handler(element!(
                    ".sl-related-grid",

                    |el| {
                        if !injected {
                            el.append(&missing_cards, ContentType::Html);
                            injected = true;
                        }
                        Ok(())
                    }
                )),
            )
        } else {
            let section_html = render_related_ssr(items, is_fr);
            rewrite_str(
                &html,
                RewriteStrSettings::new()
                    .append_element_content_handler(element!("head", |el| {
                        el.append(RELATED_CSS, ContentType::Html);
                        Ok(())
                    }))
                    .append_element_content_handler(element!(".sl-markdown-content", |el| {
                        if !injected {
                            el.append(&section_html, ContentType::Html);
                            injected = true;
                        }
                        Ok(())
                    })),
            )
        };
        if let Ok(next) = rw
            && injected
        {
            let _ = fs::write(&html_path, next);
        }
    });
    let pages_count = graph.len();
    let total_links: usize = graph.values().map(|v| v.len()).sum();
    let isolated = graph.values().filter(|v| v.is_empty()).count();
    let avg = if pages_count > 0 {
        format!("{:.2}", total_links as f64 / pages_count as f64)
    } else {
        "0.00".to_string()
    };
    if let Ok(json) = serde_json::to_string(&graph) {
        let _ = fs::write(dist_dir.join("related-pages.json"), json);
    }
    let edge_map: HashMap<String, Vec<String>> = graph
        .into_iter()
        .map(|(k, v)| (k, v.into_iter().map(|it| it.href).collect()))
        .collect();
    (pages_count, avg, isolated, edge_map)
}
