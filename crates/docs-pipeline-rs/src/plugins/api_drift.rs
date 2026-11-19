use crate::host::html_dom::PageDom;
use crate::host::md_source::MdDoc;
use jwalk::WalkDir;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tree_sitter::{Parser, Query, QueryCursor, StreamingIterator};

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiDriftCfg {
    #[serde(default)]
    pub strict: bool,
    #[serde(default = "default_write_report")]
    pub write_report: bool,
}

fn default_write_report() -> bool {
    true
}

#[derive(Debug, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ApiDriftLabels {
    #[serde(default)]
    pub phantom_warning: String,
    #[serde(default)]
    pub report_title: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PhantomRef {
    pub route: String,
    pub symbol: String,
}

#[derive(Debug, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiDriftReport {
    pub title: String,
    pub source_symbols: usize,
    pub matched_symbols: usize,
    pub coverage_pct: usize,
    pub phantoms: Vec<PhantomRef>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

const SKIP_DIRS: &[&str] = &[
    "target", "node_modules", "examples", "benches", "fuzz", "tests",
    "test", "stubs", "website", "bench", ".git", "dist", ".astro",
];

const SKIP_PAGES: &[&str] = &[
    "language", "syntax", "grammar", "changelog", "release-notes",
    "benchmarks", "compile-error-catalogue", "error-messages",
    "tui-keys", "wire-protocol", "lint-codes", "skill-format",
    "presets-and-themes",
];

const RUST_QUERY: &str = r#"
(function_item (visibility_modifier) name: (identifier) @sym)
(struct_item (visibility_modifier) name: (type_identifier) @sym)
(enum_item (visibility_modifier) name: (type_identifier) @sym)
(trait_item (visibility_modifier) name: (type_identifier) @sym)
(type_item (visibility_modifier) name: (type_identifier) @sym)
(const_item (visibility_modifier) name: (identifier) @sym)
(static_item (visibility_modifier) name: (identifier) @sym)
(mod_item (visibility_modifier) name: (identifier) @sym)
(enum_variant name: (identifier) @sym)
(trait_item body: (declaration_list (function_signature_item name: (identifier) @sym)))
(trait_item body: (declaration_list (function_item name: (identifier) @sym)))
(macro_definition name: (identifier) @macro_sym)
(attribute_item (attribute (identifier) @_attr (#eq? @_attr "proc_macro_derive") arguments: (token_tree (identifier) @sym)))
(use_declaration (visibility_modifier) argument: (scoped_identifier name: (identifier) @sym))
(use_declaration (visibility_modifier) argument: (use_as_clause alias: (identifier) @sym))
(use_declaration (visibility_modifier) argument: (scoped_use_list list: (use_list (identifier) @sym)))
(field_declaration name: (field_identifier) @field_sym)
(string_literal (string_content) @lit_sym)
"#;

const TS_QUERY: &str = r#"
(export_statement declaration: (function_declaration name: (identifier) @sym))
(export_statement declaration: (class_declaration name: (type_identifier) @sym))
(export_statement declaration: (interface_declaration name: (type_identifier) @sym))
(export_statement declaration: (type_alias_declaration name: (type_identifier) @sym))
(export_statement declaration: (enum_declaration name: (identifier) @sym))
(export_statement declaration: (lexical_declaration (variable_declarator name: (identifier) @sym)))
(export_specifier name: (identifier) @sym)
(export_specifier alias: (identifier) @sym)
(property_signature name: (property_identifier) @field_sym)
(pair key: (property_identifier) @field_sym)
(string (string_fragment) @lit_sym)
"#;

struct ExtractedFile {
    syms: HashSet<String>,
    fields: HashSet<String>,
    literals: HashSet<String>,
}

fn find_repo_root(site_root: &Path) -> Option<PathBuf> {
    let parent = site_root.parent()?;
    if parent.join("Cargo.toml").exists() || parent.join("package.json").exists() {
        Some(parent.to_path_buf())
    } else if site_root.join("Cargo.toml").exists() || site_root.join("package.json").exists() {
        Some(site_root.to_path_buf())
    } else {
        None
    }
}

fn collect_source_files(repo_root: &Path) -> Vec<PathBuf> {
    WalkDir::new(repo_root)
        .skip_hidden(true)
        .process_read_dir(|_, _, _, children| {
            children.retain(|entry| {
                if let Ok(e) = entry {
                    let name = e.file_name().to_string_lossy();
                    if SKIP_DIRS.contains(&name.as_ref()) || name.ends_with("-docs") {
                        return false;
                    }
                }
                true
            });
        })
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .map(|e| e.path())
        .filter(|p| {
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.ends_with(".test.ts") || name.ends_with(".spec.ts") || name.ends_with(".d.ts") {
                return false;
            }
            matches!(p.extension().and_then(|e| e.to_str()), Some("rs" | "ts" | "tsx"))
        })
        .collect()
}

fn parse_file_ast(path: &Path, rs_q: &Query, ts_q: &Query, tsx_q: &Query) -> Option<ExtractedFile> {
    let bytes = fs::read(path).ok()?;
    let ext = path.extension()?.to_str()?;
    let mut parser = Parser::new();
    let (lang, query) = match ext {
        "rs" => (tree_sitter_rust::LANGUAGE.into(), rs_q),
        "ts" => (tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(), ts_q),
        "tsx" => (tree_sitter_typescript::LANGUAGE_TSX.into(), tsx_q),
        _ => return None,
    };
    parser.set_language(&lang).ok()?;
    let tree = parser.parse(&bytes, None)?;

    let mut out = ExtractedFile {
        syms: HashSet::new(),
        fields: HashSet::new(),
        literals: HashSet::new(),
    };
    let idx_sym = query.capture_index_for_name("sym");
    let idx_macro = query.capture_index_for_name("macro_sym");
    let idx_field = query.capture_index_for_name("field_sym");
    let idx_lit = query.capture_index_for_name("lit_sym");

    let mut cursor = QueryCursor::new();
    let mut matches = cursor.matches(query, tree.root_node(), bytes.as_slice());
    while let Some(m) = matches.next() {
        for cap in m.captures() {
            let Ok(text) = cap.node.utf8_text(&bytes) else { continue };
            if Some(cap.index) == idx_sym {
                out.syms.insert(text.to_string());
            } else if Some(cap.index) == idx_macro {
                out.syms.insert(text.to_string());
                out.syms.insert(format!("{text}!"));
            } else if Some(cap.index) == idx_field {
                if text.len() >= 3 {
                    out.fields.insert(text.to_string());
                }
            } else if Some(cap.index) == idx_lit {
                if (3..=36).contains(&text.len())
                    && text.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'-')
                {
                    out.literals.insert(text.to_string());
                }
            }
        }
    }
    Some(out)
}

fn is_camel_case(s: &str) -> bool {
    let mut chars = s.chars();
    let Some(first) = chars.next() else { return false };
    first.is_ascii_uppercase()
        && s.chars().any(|c| c.is_ascii_lowercase())
        && s.chars().skip(1).any(|c| c.is_ascii_uppercase())
        && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

fn is_snake_case(s: &str) -> bool {
    s.contains('_')
        && s.len() >= 3
        && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
}

fn extract_heading_symbols(heading: &str, page_slug: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = heading;
    let had_backtick = heading.contains('`');

    while let Some(start) = rest.find('`') {
        let after = &rest[start + 1..];
        let Some(end) = after.find('`') else { break };
        let code = after[..end].trim();
        rest = &after[end + 1..];

        if code.is_empty()
            || code.contains(' ')
            || code.contains('/')
            || code.starts_with("--")
            || [".toml", ".json", ".rs", ".ts", ".md"].iter().any(|ext| code.contains(ext))
        {
            continue;
        }
        let seg = code.rsplit(&[':', '.'][..]).next().unwrap_or(code);
        let ident: String = seg
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '!')
            .collect();
        if ident.len() >= 3 && !out.contains(&ident) {
            out.push(ident);
        }
    }

    if out.is_empty() && !had_backtick && !matches!(page_slug, "cli" | "configuration" | "config" | "feature-flags") {
        let trimmed = heading.trim();
        if is_camel_case(trimmed)
            || is_snake_case(trimmed)
            || (trimmed.ends_with('!') && trimmed.len() >= 4 && trimmed[..trimmed.len() - 1].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_'))
        {
            out.push(trimmed.to_string());
        }
    }
    out
}

pub fn run_api_drift(
    site_root: &Path,
    dist_dir: &Path,
    pages: &[PageDom],
    docs: &[MdDoc],
    cfg: &ApiDriftCfg,
    default_locale: &str,
    i18n: &HashMap<String, ApiDriftLabels>,
) -> ApiDriftReport {
    let Some(repo_root) = find_repo_root(site_root) else {
        return ApiDriftReport::default();
    };

    let rs_lang = tree_sitter_rust::LANGUAGE.into();
    let ts_lang = tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into();
    let tsx_lang = tree_sitter_typescript::LANGUAGE_TSX.into();

    let (Ok(rs_q), Ok(ts_q), Ok(tsx_q)) = (
        Query::new(&rs_lang, RUST_QUERY),
        Query::new(&ts_lang, TS_QUERY),
Query::new(&tsx_lang, TS_QUERY),
) else {
return ApiDriftReport::default();
};
let files = collect_source_files(&repo_root);
let extracted: Vec<_> = files
.par_iter()
.filter_map(|p| parse_file_ast(p, &rs_q, &ts_q, &tsx_q))
.collect();
let mut all_syms = HashSet::new();
let mut all_fields = HashSet::new();
let mut all_literals = HashSet::new();
for item in extracted {
all_syms.extend(item.syms);
all_fields.extend(item.fields);
all_literals.extend(item.literals);
}
if all_syms.is_empty() {
return ApiDriftReport::default();
}
let fb = i18n.get(default_locale).or_else(|| i18n.get("en")).cloned().unwrap_or_default();
let mut matched_set = HashSet::new();
let mut phantoms = Vec::new();
let mut seen_phantoms = HashSet::new();
for page in pages {
if !page.route.contains("/reference/") {
continue;
}
let slug = page.route.trim_end_matches('/').rsplit('/').next().unwrap_or("");
if SKIP_PAGES.contains(&slug) {
continue;
}
for (_, htxt) in &page.headings {
for sym in extract_heading_symbols(htxt, slug) {
let bare = sym.trim_end_matches('!');
let found = all_syms.contains(&sym)
|| all_syms.contains(bare)
|| all_fields.contains(bare)
|| (matches!(slug, "cli" | "tools") && all_literals.contains(bare));
if found {
matched_set.insert(bare.to_string());
} else if seen_phantoms.insert((page.route.clone(), sym.clone())) {
phantoms.push(PhantomRef {
route: page.route.clone(),
symbol: sym,
});
}
}
}
}
let all_syms_vec: Vec<&String> = all_syms.iter().collect();
for doc in docs {
if !doc.route.contains("/reference/") {
continue;
}
for s in &all_syms_vec {
if s.len() >= 4 && doc.body.contains(s.as_str()) {
matched_set.insert((*s).clone());
}
}
}
let source_symbols = all_syms.len();
let matched_symbols = matched_set.len();
let coverage_pct = if source_symbols > 0 {
(matched_symbols * 100) / source_symbols
} else {
0
};
let labels = i18n.get(default_locale).unwrap_or(&fb);
let tpl = if labels.phantom_warning.is_empty() {
&fb.phantom_warning
} else {
&labels.phantom_warning
};
let mut warnings = Vec::new();
let mut errors = Vec::new();
for ph in &phantoms {
let msg = format!(
"[docs-toolkit:api-drift] {}",
tpl.replace("{symbol}", &ph.symbol).replace("{route}", &ph.route)
);
if cfg.strict {
errors.push(msg);
} else {
warnings.push(msg);
}
}
let report = ApiDriftReport {
        title: if labels.report_title.is_empty() { fb.report_title.clone() } else { labels.report_title.clone() },
source_symbols,
matched_symbols,
coverage_pct,
phantoms,
warnings,
errors,
};
if cfg.write_report {
if let Ok(json) = serde_json::to_string_pretty(&report) {
let _ = fs::write(dist_dir.join("api-drift.json"), json);
}
}
report
}
