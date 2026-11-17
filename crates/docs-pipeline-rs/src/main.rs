mod host;
mod plugins;

use host::html_dom::parse_all_html;
use host::md_source::load_all_markdown;
use plugins::diataxis_lint::run_diataxis_lint;
use plugins::glossary::run_glossary;
use plugins::i18n_parity::run_i18n_parity;
use plugins::link_preview::run_link_preview;
use plugins::llms::{run_llms, LlmsConfig};
use plugins::mermaid::run_mermaid_mutator;
use plugins::related_pages::run_related_pages;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
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
    mermaid: bool,
    #[serde(default)]
    link_preview: bool,
    #[serde(default)]
    glossary: Option<GlossaryCfg>,
    #[serde(default)]
    related_pages: Option<RelatedCfg>,
    #[serde(default)]
    i18n_parity: Option<I18nCfg>,
    #[serde(default)]
    diataxis_lint: Option<DiataxisCfg>,
    #[serde(default)]
    llms: Option<LlmsConfig>,
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

fn default_true() -> bool { true }
fn default_max_related() -> usize { 3 }
fn default_ignore_paths() -> Vec<String> { vec!["blog/".to_string()] }
fn default_min_desc() -> usize { 24 }
fn default_max_desc() -> usize { 180 }
fn default_min_words() -> usize { 200 }

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PipelineResponse {
    elapsed_ms: u128,
    html_pages: usize,
    md_docs: usize,
    mermaid_rendered: usize,
    link_previews_indexed: usize,
    glossary_indexed: usize,
    glossary_coverage_pct: usize,
    glossary_avg_per_page: String,
    related_pages_count: usize,
    related_avg_links: String,
    llms_pages: usize,
    i18n_pairs: usize,
    diataxis_audited: usize,
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

    let mut all_locales: HashSet<String> = HashSet::from(["en".to_string(), "fr".to_string()]);
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
        || parse_all_html(&dist_dir, &all_locales),
        || load_all_markdown(&docs_dir, &all_locales),
    );

    let mut warnings = Vec::new();
    let mut errors = Vec::new();

    // Phase 3: Modular plugins attached to shared PageDom & MdDoc slices
    let link_previews_indexed = if req.link_preview {
        run_link_preview(&dist_dir, &pages)
    } else {
        0
    };

    let (glossary_indexed, glossary_coverage_pct, glossary_avg_per_page) =
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
            (rep.indexed, rep.coverage_pct, rep.avg_per_page)
        } else {
            (0, 0, "0.00".to_string())
        };

    let (related_pages_count, related_avg_links) = if let Some(r_cfg) = &req.related_pages {
        let (cnt, avg, isolated) = run_related_pages(&dist_dir, &docs, r_cfg.max_related);
        if isolated > 0 {
            warnings.push(format!(
                "[starlight-related-pages] {isolated} page(s) have 0 related recommendations."
            ));
        }
        (cnt, avg)
    } else {
        (0, "0.00".to_string())
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

    let llms_pages = if let Some(l_cfg) = &req.llms {
        run_llms(&dist_dir, &docs, l_cfg)
    } else {
        0
    };

    let resp = PipelineResponse {
        elapsed_ms: t0.elapsed().as_millis(),
        html_pages: pages.len(),
        md_docs: docs.len(),
        mermaid_rendered,
        link_previews_indexed,
        glossary_indexed,
        glossary_coverage_pct,
        glossary_avg_per_page,
        related_pages_count,
        related_avg_links,
        llms_pages,
        i18n_pairs,
        diataxis_audited,
        warnings,
        errors,
    };

    println!("{}", serde_json::to_string(&resp).unwrap());
    if !resp.errors.is_empty() {
        std::process::exit(1);
    }
}
