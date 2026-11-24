mod host;
mod plugins;

use host::html_dom::parse_all_html;
use host::md_source::load_all_markdown;
use plugins::api_drift::{
    ApiDriftCfg, ApiDriftLabels, build_public_api_index, run_api_drift_with_index,
};
use plugins::code_symbols::{CodeSymbolsCfg, run_code_symbols};
use plugins::concept_trail::{ConceptTrailLabels, run_concept_trail};
use plugins::diataxis_lint::run_diataxis_lint;
use plugins::doc_graph::{DocGraphCfg, run_doc_graph};
use plugins::glossary::run_glossary;
use plugins::i18n_parity::run_i18n_parity;
use plugins::link_preview::run_link_preview;
use plugins::llms::{LlmsConfig, run_llms};
use plugins::mermaid::run_mermaid_mutator;
use plugins::related_pages::run_related_pages;
use plugins::since_badges::{BadgeLabels, run_since_badges};
use plugins::snippet_drift::{SnippetDriftCfg, SnippetDriftLabels, run_snippet_drift};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PipelineRequest {
    site_root: String,
    dist_dir: String,
    #[serde(default = "default_locale")]
    default_locale: String,
    #[serde(default)]
    locales: Vec<String>,
    #[serde(default)]
    i18n: HashMap<String, HashMap<String, String>>,
    #[serde(default)]
    mermaid: bool,
    #[serde(default)]
    link_preview: bool,
    #[serde(default)]
    since_badges: bool,
    #[serde(default)]
    concept_trail: bool,
    #[serde(default)]
    concept_trail_i18n: HashMap<String, ConceptTrailLabels>,
    #[serde(default)]
    since_badges_i18n: HashMap<String, BadgeLabels>,
    #[serde(default)]
    code_symbols: Option<CodeSymbolsCfg>,
    #[serde(default)]
    glossary: Option<GlossaryCfg>,
    #[serde(default)]
    related_pages: Option<RelatedCfg>,
    #[serde(default)]
    i18n_parity: Option<I18nCfg>,
    #[serde(default)]
    diataxis_lint: Option<DiataxisCfg>,
    #[serde(default)]
    doc_graph: Option<DocGraphCfg>,
    #[serde(default)]
    llms: Option<LlmsConfig>,
    #[serde(default)]
    api_drift: Option<ApiDriftCfg>,
    #[serde(default)]
    api_drift_i18n: HashMap<String, ApiDriftLabels>,
    #[serde(default)]
    snippet_drift: Option<SnippetDriftCfg>,
    #[serde(default)]
    snippet_drift_i18n: HashMap<String, SnippetDriftLabels>,
}

fn default_locale() -> String {
    "en".to_string()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GlossaryCfg {
    #[serde(default = "default_true")]
    strict: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RelatedCfg {
    #[serde(default = "default_max_related")]
    max_related: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct I18nCfg {
    #[serde(default = "default_true")]
    strict: bool,
    #[serde(default = "default_ignore_paths")]
    ignore_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiataxisCfg {
    #[serde(default)]
    strict: bool,
    #[serde(default = "default_min_desc")]
    min_description_length: usize,
    #[serde(default = "default_max_desc")]
    max_description_length: usize,
    #[serde(default = "default_min_words")]
    min_explanation_words: usize,
}

fn default_true() -> bool {
    true
}
fn default_max_related() -> usize {
    3
}
fn default_ignore_paths() -> Vec<String> {
    vec!["blog/".to_string()]
}
fn default_min_desc() -> usize {
    24
}
fn default_max_desc() -> usize {
    180
}
fn default_min_words() -> usize {
    200
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PipelineResponse {
    elapsed_ms: u128,
    html_pages: usize,
    md_docs: usize,
    mermaid_rendered: usize,
    link_previews_indexed: usize,
    code_symbols_indexed: usize,
    code_symbol_links: usize,
    code_symbol_pages: usize,
    since_badges_indexed: usize,
    since_badges_injected: usize,
    since_badges_pages: usize,
    concept_trail_pages: usize,
    concept_trail_links: usize,
    glossary_indexed: usize,
    glossary_coverage_pct: usize,
    glossary_avg_per_page: String,
    related_pages_count: usize,
    related_avg_links: String,
    llms_pages: usize,
    i18n_pairs: usize,
    diataxis_audited: usize,
    doc_graph_nodes: usize,
    doc_graph_edges: usize,
    doc_graph_orphans: usize,
    api_drift_source_syms: usize,
    api_drift_coverage_pct: usize,
    api_drift_phantoms: usize,
    snippet_drift_checked: usize,
    snippet_drift_issues: usize,
    warnings: Vec<String>,
    errors: Vec<String>,
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let cfg_path = args.get(1).expect("Usage: docs-pipeline-rs <config.json>");
    let raw = fs::read_to_string(cfg_path).expect("Failed to read pipeline config JSON");
    let req: PipelineRequest = serde_json::from_str(&raw).expect("Invalid pipeline config JSON");

    let t0 = Instant::now();
    let site_root = PathBuf::from(&req.site_root);
    let dist_dir = PathBuf::from(&req.dist_dir);
    let docs_dir = site_root.join("src/content/docs");

    let i18n: HashMap<String, HashMap<String, String>> = req.i18n;
    let mut all_locales: HashSet<String> = HashSet::from([req.default_locale.clone()]);
    for l in &req.locales {
        if !l.is_empty() && l != "root" {
            all_locales.insert(l.clone());
        }
    }
    let secondary_locales: Vec<String> = req
        .locales
        .iter()
        .filter(|l| l.as_str() != req.default_locale && l.as_str() != "root")
        .cloned()
        .collect();

    // Phase 1: HTML mutators (Mermaid SVG rendering before DOM indexing)
    let mermaid_rendered = if req.mermaid {
        run_mermaid_mutator(&dist_dir)
    } else {
        0
    };

    // Phase 2: Single parallel read & parse of HTML DOM + Markdown sources
    let (pages, docs) = rayon::join(
        || parse_all_html(&dist_dir, &all_locales, &req.default_locale),
        || load_all_markdown(&docs_dir, &all_locales, &req.default_locale),
    );

    let mut warnings = Vec::new();
    let mut errors = Vec::new();

    // Phase 3: Modular plugins attached to shared PageDom & MdDoc slices
    let link_previews_indexed = if req.link_preview {
        run_link_preview(&dist_dir, &pages, &req.default_locale, &i18n)
    } else {
        0
    };
    let (code_symbols_indexed, code_symbol_links, code_symbol_pages) =
        if let Some(cs_cfg) = &req.code_symbols {
            let rep = run_code_symbols(&dist_dir, &pages, &docs, cs_cfg);
            (rep.symbols_indexed, rep.links_injected, rep.pages_enriched)
        } else {
            (0, 0, 0)
        };
    let (since_badges_indexed, since_badges_injected, since_badges_pages) = if req.since_badges {
        let rep = run_since_badges(
            &site_root,
            &dist_dir,
            &pages,
            &req.default_locale,
            &req.since_badges_i18n,
        );
        (rep.symbols_indexed, rep.badges_injected, rep.pages_enriched)
    } else {
        (0, 0, 0)
    };

    let (glossary_indexed, glossary_coverage_pct, glossary_avg_per_page, glossary_entries) =
        if let Some(g_cfg) = &req.glossary {
            let rep = run_glossary(&site_root, &dist_dir, &docs, &pages);
            for w in rep.warnings {
                warnings.push(format!("[starlight-term-glossary] {w}"));
            }
            for e in rep.errors {
                if g_cfg.strict {
                    errors.push(format!("[starlight-term-glossary] {e}"));
                } else {
                    warnings.push(format!("[starlight-term-glossary] {e}"));
                }
            }
            (rep.indexed, rep.coverage_pct, rep.avg_per_page, rep.entries)
        } else {
            (0, 0, "0.00".to_string(), Vec::new())
        };
    let (concept_trail_pages, concept_trail_links) = if req.concept_trail {
        let rep = run_concept_trail(
            &dist_dir,
            &pages,
            &glossary_entries,
            &req.default_locale,
            &req.concept_trail_i18n,
        );
        (rep.pages_enriched, rep.links_injected)
    } else {
        (0, 0)
    };

    let (related_pages_count, related_avg_links, related_edges) =
        if let Some(r_cfg) = &req.related_pages {
            let (cnt, avg, isolated, edges) =
                run_related_pages(&dist_dir, &pages, &docs, r_cfg.max_related);
            if isolated > 0 {
                warnings.push(format!(
                    "[starlight-related-pages] {isolated} page(s) have 0 related recommendations."
                ));
            }
            (cnt, avg, edges)
        } else {
            (0, "0.00".to_string(), HashMap::new())
        };

    let i18n_pairs = if let Some(i_cfg) = &req.i18n_parity {
        let rep = run_i18n_parity(
            &docs,
            &req.default_locale,
            &secondary_locales,
            &all_locales,
            &i_cfg.ignore_paths,
        );
        for w in rep.warnings {
            warnings.push(format!("[starlight-i18n-parity] {w}"));
        }
        for e in rep.errors {
            if i_cfg.strict {
                errors.push(format!("[starlight-i18n-parity] {e}"));
            } else {
                warnings.push(format!("[starlight-i18n-parity] {e}"));
            }
        }
        rep.audited_pairs
    } else {
        0
    };

    let api_index = if req.api_drift.is_some() || req.snippet_drift.is_some() {
        build_public_api_index(&site_root)
    } else {
        Default::default()
    };
    let (api_drift_source_syms, api_drift_coverage_pct, api_drift_phantoms) =
        if let Some(ad_cfg) = &req.api_drift {
            let rep = run_api_drift_with_index(
                &api_index,
                &dist_dir,
                &pages,
                &docs,
                ad_cfg,
                &req.default_locale,
                &req.api_drift_i18n,
            );
            warnings.extend(rep.warnings);
            errors.extend(rep.errors);
            (rep.source_symbols, rep.coverage_pct, rep.phantoms.len())
        } else {
            (0, 0, 0)
        };
    let (snippet_drift_checked, snippet_drift_issues) = if let Some(sd_cfg) = &req.snippet_drift {
        let rep = run_snippet_drift(
            &dist_dir,
            &pages,
            &docs,
            &api_index,
            sd_cfg,
            &req.default_locale,
            &req.snippet_drift_i18n,
        );
        warnings.extend(rep.warnings);
        errors.extend(rep.errors);
        (rep.checked_snippets, rep.issues.len())
    } else {
        (0, 0)
    };

    let diataxis_audited = if let Some(d_cfg) = &req.diataxis_lint {
        let rep = run_diataxis_lint(
            &docs,
            d_cfg.min_description_length,
            d_cfg.max_description_length,
            d_cfg.min_explanation_words,
        );
        let mut d_warns = 0usize;
        let mut d_errs = 0usize;
        for w in rep.warnings {
            d_warns += 1;
            warnings.push(format!("[starlight-diataxis-lint] {w}"));
        }
        for e in rep.errors {
            d_errs += 1;
            errors.push(format!("[starlight-diataxis-lint] {e}"));
        }
        if d_cfg.strict && (d_errs > 0 || d_warns > 0) {
            errors.push(format!(
                "[starlight-diataxis-lint] Build failed with {d_errs} error(s) and {d_warns} warning(s)."
            ));
        }
        rep.audited
    } else {
        0
    };

    let (doc_graph_nodes, doc_graph_edges, doc_graph_orphans) = if let Some(dg_cfg) = &req.doc_graph
    {
        let rep = run_doc_graph(
            &dist_dir,
            &docs,
            &req.default_locale,
            &related_edges,
            dg_cfg,
        );
        warnings.extend(rep.warnings);
        errors.extend(rep.errors);
        (rep.nodes_count, rep.edges_count, rep.orphan_count)
    } else {
        (0, 0, 0)
    };

    let llms_pages = if let Some(l_cfg) = &req.llms {
        run_llms(&dist_dir, &docs, l_cfg, &req.default_locale, &i18n)
    } else {
        0
    };

    let resp = PipelineResponse {
        elapsed_ms: t0.elapsed().as_millis(),
        html_pages: pages.len(),
        md_docs: docs.len(),
        mermaid_rendered,
        link_previews_indexed,
        code_symbols_indexed,
        code_symbol_links,
        code_symbol_pages,
        since_badges_indexed,
        since_badges_injected,
        since_badges_pages,
        concept_trail_pages,
        concept_trail_links,
        glossary_indexed,
        glossary_coverage_pct,
        glossary_avg_per_page,
        related_pages_count,
        related_avg_links,
        llms_pages,
        i18n_pairs,
        diataxis_audited,
        doc_graph_nodes,
        doc_graph_edges,
        doc_graph_orphans,
        api_drift_source_syms,
        api_drift_coverage_pct,
        api_drift_phantoms,
        snippet_drift_checked,
        snippet_drift_issues,
        warnings,
        errors,
    };

    println!("{}", serde_json::to_string(&resp).unwrap());
    if !resp.errors.is_empty() {
        std::process::exit(1);
    }
}
