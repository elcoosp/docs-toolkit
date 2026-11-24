use crate::host::html_dom::normalize_route;
use crate::host::md_source::MdDoc;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocGraphCfg {
    #[serde(default)]
    pub strict: bool,
    #[serde(default = "default_warn_orphans")]
    pub warn_orphans: bool,
}

fn default_warn_orphans() -> bool {
    true
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub route: String,
    pub locale: String,
    pub title: String,
    pub category: String,
    pub in_degree: usize,
    pub out_degree: usize,
    pub page_rank: f64,
    pub orphan: bool,
    pub dead_end: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocGraphArtifact {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub orphan_count: usize,
    pub dead_end_count: usize,
}

pub struct DocGraphReport {
    pub nodes_count: usize,
    pub edges_count: usize,
    pub orphan_count: usize,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

fn is_home_route(route: &str, locale: &str, default_locale: &str) -> bool {
    if route == "/" {
        return true;
    }
    locale != default_locale && route == format!("/{locale}/")
}

fn extract_internal_links(raw_text: &str, body: &str) -> BTreeSet<String> {
    let mut links = BTreeSet::new();

    // Extract frontmatter `link: /...` entries (e.g. hero actions)
    if let Some(rest) = raw_text.strip_prefix("---") {
        if let Some(end_fm) = rest.find("\n---") {
            for fm_line in rest[..end_fm].lines() {
                let trimmed = fm_line.trim();
                if let Some(val) = trimmed.strip_prefix("link:") {
                    let clean = val.trim().trim_matches('"').trim_matches('\'');
                    if clean.starts_with('/') && !clean.starts_with("//") {
                        links.insert(normalize_route(clean));
                    }
                }
            }
        }
    }

    let mut in_fence = false;
    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        let bytes = line.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            if bytes[i] == b']' && i + 1 < bytes.len() && bytes[i + 1] == b'(' {
                let start = i + 2;
                if let Some(end_rel) = line[start..].find(')') {
                    let raw_target = line[start..start + end_rel]
                        .split_whitespace()
                        .next()
                        .unwrap_or("");
                    if raw_target.starts_with('/') && !raw_target.starts_with("//") {
                        links.insert(normalize_route(raw_target));
                    }
                    i = start + end_rel + 1;
                    continue;
                }
            }
            if bytes[i..].starts_with(b"href=") && i + 6 < bytes.len() {
                let quote = bytes[i + 5];
                if quote == b'"' || quote == b'\'' {
                    let start = i + 6;
                    if let Some(end_rel) = line[start..].find(quote as char) {
                        let raw_target = &line[start..start + end_rel];
                        if raw_target.starts_with('/') && !raw_target.starts_with("//") {
                            links.insert(normalize_route(raw_target));
                        }
                        i = start + end_rel + 1;
                        continue;
                    }
                }
            }
            i += 1;
        }
    }
    links
}

fn compute_pagerank(
    routes: &[String],
    outgoing: &HashMap<String, Vec<String>>,
) -> HashMap<String, f64> {
    let n = routes.len();
    if n == 0 {
        return HashMap::new();
    }
    let idx_of: HashMap<&str, usize> = routes
        .iter()
        .enumerate()
        .map(|(i, r)| (r.as_str(), i))
        .collect();
    let mut adj: Vec<Vec<usize>> = vec![Vec::new(); n];
    for (i, r) in routes.iter().enumerate() {
        if let Some(targets) = outgoing.get(r) {
            for t in targets {
                if let Some(&j) = idx_of.get(t.as_str()) {
                    adj[i].push(j);
                }
            }
        }
    }

    let d = 0.85_f64;
    let base = (1.0 - d) / (n as f64);
    let mut rank = vec![1.0 / (n as f64); n];
    let mut next = vec![0.0_f64; n];

    for _ in 0..30 {
        next.fill(base);
        let mut dangling_sum = 0.0_f64;
        for i in 0..n {
            if adj[i].is_empty() {
                dangling_sum += rank[i];
            } else {
                let share = d * rank[i] / (adj[i].len() as f64);
                for &j in &adj[i] {
                    next[j] += share;
                }
            }
        }
        let dangling_share = d * dangling_sum / (n as f64);
        for v in &mut next {
            *v += dangling_share;
        }
        std::mem::swap(&mut rank, &mut next);
    }

    let min_r = rank.iter().copied().fold(f64::INFINITY, f64::min);
    let max_r = rank.iter().copied().fold(0.0_f64, f64::max);
    let span = (max_r - min_r).max(1e-12);
    routes
        .iter()
        .enumerate()
        .map(|(i, r)| {
            let norm = ((rank[i] - min_r) / span) * 100.0;
            (r.clone(), (norm * 10.0).round() / 10.0)
        })
        .collect()
}

pub fn run_doc_graph(
    dist_dir: &Path,
    docs: &[MdDoc],
    default_locale: &str,
    extra_edges: &HashMap<String, Vec<String>>,
    cfg: &DocGraphCfg,
) -> DocGraphReport {
    let valid_docs: Vec<&MdDoc> = docs
        .iter()
        .filter(|d| {
            !d.rel_path.ends_with("404.md")
                && !d.rel_path.ends_with("404.mdx")
                && !d.rel_no_locale.starts_with("blog/")
                && !d.title.is_empty()
        })
        .collect();

    let known_routes: HashSet<String> = valid_docs.iter().map(|d| d.route.clone()).collect();

    let extracted: Vec<(&MdDoc, Vec<String>)> = valid_docs
        .par_iter()
        .map(|doc| {
            let mut merged = extract_internal_links("", &doc.body);
            if let Some(extra) = extra_edges.get(&doc.route) {
                for t in extra {
                    merged.insert(t.clone());
                }
            }
            let targets: Vec<String> = merged
                .into_iter()
                .filter(|t| t != &doc.route && known_routes.contains(t))
                .collect();
            (*doc, targets)
        })
        .collect();

    let mut by_locale: BTreeMap<&str, Vec<(&MdDoc, Vec<String>)>> = BTreeMap::new();
    for item in extracted {
        by_locale
            .entry(item.0.locale.as_str())
            .or_default()
            .push(item);
    }

    let mut nodes = Vec::with_capacity(valid_docs.len());
    let mut edges = Vec::new();
    let mut warnings = Vec::new();
    let mut errors = Vec::new();

    for (locale, group) in by_locale {
        let mut outgoing: HashMap<String, Vec<String>> = HashMap::new();
        let mut in_deg: HashMap<String, usize> = HashMap::new();
        let mut routes = Vec::with_capacity(group.len());

        for (doc, targets) in &group {
            routes.push(doc.route.clone());
            outgoing.insert(doc.route.clone(), targets.clone());
            for t in targets {
                *in_deg.entry(t.clone()).or_insert(0) += 1;
                edges.push(GraphEdge {
                    source: doc.route.clone(),
                    target: t.clone(),
                });
            }
        }

        let pr = compute_pagerank(&routes, &outgoing);
        for (doc, targets) in group {
            let in_d = in_deg.get(&doc.route).copied().unwrap_or(0);
            let out_d = targets.len();
            let home = is_home_route(&doc.route, locale, default_locale);
            let orphan = !home && in_d == 0;
            let dead_end = !home && out_d == 0;
            if orphan && cfg.warn_orphans {
                let msg = format!(
                    "[starlight-doc-graph] Orphan page `{}` has 0 incoming internal links.",
                    doc.route
                );
                if cfg.strict {
                    errors.push(msg);
                } else {
                    warnings.push(msg);
                }
            }
            nodes.push(GraphNode {
                route: doc.route.clone(),
                locale: locale.to_string(),
                title: doc.title.clone(),
                category: doc.category().to_string(),
                in_degree: in_d,
                out_degree: out_d,
                page_rank: pr.get(&doc.route).copied().unwrap_or(0.0),
                orphan,
                dead_end,
            });
        }
    }

    nodes.sort_by(|a, b| {
        b.page_rank
            .partial_cmp(&a.page_rank)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.route.cmp(&b.route))
    });
    edges.sort_by(|a, b| {
        a.source
            .cmp(&b.source)
            .then_with(|| a.target.cmp(&b.target))
    });

    let orphan_count = nodes.iter().filter(|n| n.orphan).count();
    let dead_end_count = nodes.iter().filter(|n| n.dead_end).count();
    let nodes_count = nodes.len();
    let edges_count = edges.len();

    let artifact = DocGraphArtifact {
        nodes,
        edges,
        orphan_count,
        dead_end_count,
    };
    if let Ok(json) = serde_json::to_string(&artifact) {
        let _ = fs::write(dist_dir.join("graph.json"), json);
    }
    DocGraphReport {
        nodes_count,
        edges_count,
        orphan_count,
        warnings,
        errors,
    }
}
