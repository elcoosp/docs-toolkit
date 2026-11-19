use crate::host::md_source::MdDoc;
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

const STOPWORDS: &[&str] = &[
    "the", "and", "for", "with", "that", "this", "from", "into", "your", "when", "where", "what",
    "which", "how", "why", "are", "was", "were", "will", "can", "could", "should", "would", "have",
    "has", "had", "not", "but", "use", "using", "les", "des", "une", "dans", "pour", "avec",
    "sans", "sur", "par", "est", "sont", "cette", "ces", "qui", "que", "quoi", "comment",
    "pourquoi", "quand", "plus", "tout", "tous", "chaque", "entre", "vers", "aux", "vous", "nous",
];

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
    docs: &[MdDoc],
    max_related: usize,
) -> (usize, String, usize) {
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

    (pages_count, avg, isolated)
}
