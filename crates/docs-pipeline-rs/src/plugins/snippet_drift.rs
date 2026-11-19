use crate::host::html_dom::PageDom;
use crate::host::md_source::MdDoc;
use crate::plugins::api_drift::PublicApiIndex;
use pulldown_cmark::{CodeBlockKind, Event, Parser as MdParser, Tag, TagEnd};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use tree_sitter::{Node, Parser, Query, QueryCursor, StreamingIterator};

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SnippetDriftCfg {
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
pub struct SnippetDriftLabels {
    #[serde(default)]
    pub syntax_error: String,
    #[serde(default)]
    pub import_phantom: String,
    #[serde(default)]
    pub version_drift: String,
    #[serde(default)]
    pub report_title: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SnippetIssue {
    pub route: String,
    pub lang: String,
    pub kind: String,
    pub detail: String,
}

#[derive(Debug, Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SnippetDriftReport {
    pub title: String,
    pub checked_snippets: usize,
    pub issues: Vec<SnippetIssue>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

const RUST_USE_QUERY: &str = r#"(use_declaration argument: (scoped_identifier path: (identifier) @pkg name: (identifier) @sym)) (use_declaration argument: (scoped_use_list path: (identifier) @pkg list: (use_list (identifier) @sym))) (use_declaration argument: (scoped_use_list path: (identifier) @pkg list: (use_list (use_as_clause path: (identifier) @sym))))"#;
const TS_IMPORT_QUERY: &str = r#"(import_statement (import_clause (named_imports (import_specifier name: (identifier) @sym))) source: (string (string_fragment) @pkg))"#;

fn detect_repo_packages(repo_root: &Path) -> HashMap<String, String> {
    let mut pkgs = HashMap::new();
    let mut manifests = vec![repo_root.join("Cargo.toml"), repo_root.join("package.json")];
    if let Ok(entries) = fs::read_dir(repo_root.join("crates")) {
        for e in entries.flatten() {
            manifests.push(e.path().join("Cargo.toml"));
        }
    }
    let mut ws_ver: Option<String> = None;
    for m in &manifests {
        let Ok(txt) = fs::read_to_string(m) else {
            continue;
        };
        if m.ends_with("Cargo.toml") {
            let mut in_ws_pkg = false;
            let mut name: Option<String> = None;
            let mut ver: Option<String> = None;
            for line in txt.lines() {
                let t = line.trim();
                if t.starts_with('[') {
                    in_ws_pkg = t == "[workspace.package]";
                } else if let Some(rest) = t.strip_prefix("name") {
                    if let Some(v) = rest.trim_start().strip_prefix('=') {
                        name = Some(v.trim().trim_matches('"').to_string());
                    }
                } else if let Some(rest) = t.strip_prefix("version")
                    && let Some(v) = rest.trim_start().strip_prefix('=')
                {
                    let val = v.trim().trim_matches('"').to_string();
                    if in_ws_pkg {
                        ws_ver = Some(val);
                    } else if val != "{ workspace = true }" && !val.contains("workspace") {
                        ver = Some(val);
                    }
                }
            }
            if let Some(n) = name
                && let Some(v) = ver.or_else(|| ws_ver.clone())
            {
                pkgs.insert(n.clone(), v.clone());
                pkgs.insert(n.replace('-', "_"), v);
            }
        } else if m.ends_with("package.json")
            && let Ok(v) = serde_json::from_str::<serde_json::Value>(&txt)
            && let (Some(n), Some(ver)) = (
                v.get("name").and_then(|x| x.as_str()),
                v.get("version").and_then(|x| x.as_str()),
            )
        {
            pkgs.insert(n.to_string(), ver.to_string());
        }
    }
    pkgs
}

fn jsx_attr_string(attr: Node, src: &[u8]) -> Option<String> {
    let mut cursor = attr.walk();
    for ch in attr.children(&mut cursor) {
        if ch.kind() == "string" {
            let raw = ch.utf8_text(src).ok()?;
            return serde_json::from_str::<String>(raw)
                .ok()
                .or_else(|| Some(raw.trim_matches(['"', '\'']).to_string()));
        }
        if ch.kind() == "jsx_expression" {
            let mut c2 = ch.walk();
            for inner in ch.children(&mut c2) {
                if inner.kind() == "string" {
                    let raw = inner.utf8_text(src).ok()?;
                    return serde_json::from_str::<String>(raw).ok();
                }
                if inner.kind() == "template_string" {
                    let raw = inner.utf8_text(src).ok()?;
                    return Some(raw.trim_matches('`').to_string());
                }
            }
        }
    }
    None
}

fn has_ignore_flag(tokens: impl Iterator<Item = impl AsRef<str>>) -> bool {
    tokens.into_iter().any(|t| {
        matches!(
            t.as_ref().trim().to_lowercase().as_str(),
            "ignore" | "compile_fail"
        )
    })
}

fn is_ignored_info(info: &str) -> bool {
    has_ignore_flag(info.split(|c: char| c.is_whitespace() || c == ',').skip(1))
}

fn extract_jsx_code_elements(body: &str, route: &str, out: &mut Vec<(String, String, String)>) {
    let mut parser = Parser::new();
    let tsx = tree_sitter_typescript::LANGUAGE_TSX.into();
    if parser.set_language(&tsx).is_err() {
        return;
    }
    let Some(tree) = parser.parse(body, None) else {
        return;
    };
    let src = body.as_bytes();
    let mut stack = vec![tree.root_node()];
    while let Some(node) = stack.pop() {
        if node.kind() == "jsx_self_closing_element" {
            let mut is_code = false;
            let mut lang_val = None;
            let mut code_val = None;
            let mut meta_val = None;
            let mut cursor = node.walk();
            for ch in node.children(&mut cursor) {
                if ch.kind() == "identifier" {
                    if ch.utf8_text(src).ok() == Some("Code") {
                        is_code = true;
                    }
                } else if ch.kind() == "jsx_attribute" {
                    let mut ac = ch.walk();
                    let attr_name = ch
                        .children(&mut ac)
                        .find(|n| n.kind() == "property_identifier")
                        .and_then(|n| n.utf8_text(src).ok());
                    match attr_name {
                        Some("lang") => lang_val = jsx_attr_string(ch, src),
                        Some("code") => code_val = jsx_attr_string(ch, src),
                        Some("meta") => meta_val = jsx_attr_string(ch, src),
                        _ => {}
                    }
                }
            }
            if is_code {
                let ignored = meta_val
                    .as_deref()
                    .map(|m| has_ignore_flag(m.split(|c: char| c.is_whitespace() || c == ',')))
                    .unwrap_or(false);
                if !ignored
                    && let (Some(l), Some(c)) = (lang_val, code_val)
                    && !l.is_empty()
                    && !c.trim().is_empty()
                {
                    out.push((route.to_string(), l.to_lowercase(), c));
                }
            }
        }
        let mut cursor = node.walk();
        for ch in node.children(&mut cursor) {
            stack.push(ch);
        }
    }
}

fn extract_source_snippets(docs: &[MdDoc]) -> Vec<(String, String, String)> {
    let mut out = Vec::new();
    for doc in docs {
        let mut in_fenced = false;
        let mut fenced_lang = String::new();
        let mut fenced_buf = String::new();
        for event in MdParser::new(&doc.body) {
            match event {
                Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(info))) => {
                    if is_ignored_info(&info) {
                        continue;
                    }
                    let lang = info.split_whitespace().next().unwrap_or("").to_lowercase();
                    if !lang.is_empty() {
                        in_fenced = true;
                        fenced_lang = lang;
                        fenced_buf.clear();
                    }
                }
                Event::Text(t) if in_fenced => {
                    fenced_buf.push_str(&t);
                }
                Event::End(TagEnd::CodeBlock) if in_fenced => {
                    if !fenced_buf.trim().is_empty() {
                        out.push((doc.route.clone(), fenced_lang.clone(), fenced_buf.clone()));
                    }
                    in_fenced = false;
                }
                _ => {}
            }
        }
        if doc.rel_path.ends_with(".mdx") {
            extract_jsx_code_elements(&doc.body, &doc.route, &mut out);
        }
    }
    out
}

fn is_partial_snippet(code: &str) -> bool {
    if code.contains("...") || code.contains('…') || code.contains("<...>") {
        return true;
    }
    code.lines().any(|line| {
        let t = line.trim();
        t.ends_with("*/;") && t.contains("= /*")
    })
}

fn first_syntax_error_detail(root: Node, src: &str, line_offset: usize) -> String {
    let mut stack = vec![root];
    while let Some(node) = stack.pop() {
        if node.is_missing() {
            let pos = node.start_position();
            let line = pos.row.saturating_sub(line_offset) + 1;
            let col = pos.column + 1;
            let preview: String = src
                .lines()
                .nth(pos.row)
                .unwrap_or("")
                .trim()
                .chars()
                .take(48)
                .collect();
            return format!(
                "line {line}:{col} — missing `{}` near `{preview}`",
                node.kind()
            );
        }
        if node.is_error() {
            let pos = node.start_position();
            let line = pos.row.saturating_sub(line_offset) + 1;
            let col = pos.column + 1;
            let frag = node
                .utf8_text(src.as_bytes())
                .unwrap_or("")
                .lines()
                .next()
                .unwrap_or("")
                .trim();
            let preview: String = if frag.is_empty() {
                src.lines()
                    .nth(pos.row)
                    .unwrap_or("")
                    .trim()
                    .chars()
                    .take(48)
                    .collect()
            } else {
                frag.chars().take(48).collect()
            };
            return format!("line {line}:{col} — unexpected `{preview}`");
        }
        let mut cursor = node.walk();
        let children: Vec<Node> = node.children(&mut cursor).collect();
        for ch in children.into_iter().rev() {
            if ch.has_error() || ch.is_missing() {
                stack.push(ch);
            }
        }
    }
    "syntax error".to_string()
}

fn check_rust_snippet(
    route: &str,
    code: &str,
    pkgs: &HashMap<String, String>,
    api: &PublicApiIndex,
    use_q: &Query,
) -> Vec<SnippetIssue> {
    let mut issues = Vec::new();
    if is_partial_snippet(code) {
        return issues;
    }
    let mut parser = Parser::new();
    let lang = tree_sitter_rust::LANGUAGE.into();
    if parser.set_language(&lang).is_err() {
        return issues;
    }
    let Some(raw_tree) = parser.parse(code, None) else {
        return issues;
    };
    let mut src = code.to_string();
    let mut tree = raw_tree;
    let mut line_offset = 0usize;

    if tree.root_node().has_error() {
        let trimmed = code.trim();
        let mut candidates = vec![
            (format!("fn __doc_snippet__() {{\n{code}\n}}"), 1usize),
            (format!("{};", trimmed.trim_end_matches(';')), 0usize),
            (
                format!("fn __doc_snippet__() {{\nlet _ = (\n{trimmed}\n);\n}}"),
                2usize,
            ),
        ];
        if trimmed.starts_with('.') {
            candidates.push((
                format!("fn __doc_snippet__() {{\nlet _ = __receiver__{trimmed};\n}}"),
                2usize,
            ));
        }
        let mut recovered = false;
        for (cand, off) in candidates {
            if let Some(t2) = parser.parse(&cand, None)
                && !t2.root_node().has_error()
            {
                src = cand;
                tree = t2;
                line_offset = off;
                recovered = true;
                break;
            }
        }
        if !recovered {
            let detail = first_syntax_error_detail(tree.root_node(), &src, line_offset);
            issues.push(SnippetIssue {
                route: route.to_string(),
                lang: "rust".to_string(),
                kind: "syntax".to_string(),
                detail,
            });
            return issues;
        }
    }

    if api.syms.is_empty() {
        return issues;
    }
    let idx_pkg = use_q.capture_index_for_name("pkg");
    let idx_sym = use_q.capture_index_for_name("sym");
    let mut cursor = QueryCursor::new();
    let mut matches = cursor.matches(use_q, tree.root_node(), src.as_bytes());
    while let Some(m) = matches.next() {
        let mut pkg_name = None;
        let mut sym_name = None;
        for cap in m.captures() {
            let Ok(txt) = cap.node.utf8_text(src.as_bytes()) else {
                continue;
            };
            if Some(cap.index) == idx_pkg {
                pkg_name = Some(txt);
            } else if Some(cap.index) == idx_sym {
                sym_name = Some(txt);
            }
        }
        if let (Some(p), Some(s)) = (pkg_name, sym_name)
            && pkgs.contains_key(p)
            && s != "self"
            && !api.syms.contains(s)
        {
            issues.push(SnippetIssue {
                route: route.to_string(),
                lang: "rust".to_string(),
                kind: "import".to_string(),
                detail: format!("{p}::{s}"),
            });
        }
    }
    issues
}

fn check_ts_snippet(
    route: &str,
    lang_tag: &str,
    code: &str,
    pkgs: &HashMap<String, String>,
    api: &PublicApiIndex,
    imp_q: &Query,
) -> Vec<SnippetIssue> {
    let mut issues = Vec::new();
    if is_partial_snippet(code) {
        return issues;
    }
    let mut parser = Parser::new();
    let lang = if lang_tag == "tsx" {
        tree_sitter_typescript::LANGUAGE_TSX.into()
    } else {
        tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()
    };
    if parser.set_language(&lang).is_err() {
        return issues;
    }
    let Some(raw_tree) = parser.parse(code, None) else {
        return issues;
    };
    let mut src = code.to_string();
    let mut tree = raw_tree;
    let mut line_offset = 0usize;

    if tree.root_node().has_error() {
        let mut candidates = vec![(format!("const __doc_snippet__ = (\n{code}\n);"), 1usize)];
        if lang_tag == "tsx" {
            candidates.push((
                format!("const __doc_snippet__ = (<>\n{code}\n</>);"),
                1usize,
            ));
        }
        let mut recovered = false;
        for (cand, off) in candidates {
            if let Some(t2) = parser.parse(&cand, None)
                && !t2.root_node().has_error()
            {
                src = cand;
                tree = t2;
                line_offset = off;
                recovered = true;
                break;
            }
        }
        if !recovered {
            let detail = first_syntax_error_detail(tree.root_node(), &src, line_offset);
            issues.push(SnippetIssue {
                route: route.to_string(),
                lang: lang_tag.to_string(),
                kind: "syntax".to_string(),
                detail,
            });
            return issues;
        }
    }
    if api.syms.is_empty() {
        return issues;
    }
    let idx_pkg = imp_q.capture_index_for_name("pkg");
    let idx_sym = imp_q.capture_index_for_name("sym");
    let mut cursor = QueryCursor::new();
    let mut matches = cursor.matches(imp_q, tree.root_node(), src.as_bytes());
    while let Some(m) = matches.next() {
        let mut pkg_name = None;
        let mut sym_name = None;
        for cap in m.captures() {
            let Ok(txt) = cap.node.utf8_text(src.as_bytes()) else {
                continue;
            };
            if Some(cap.index) == idx_pkg {
                pkg_name = Some(txt);
            } else if Some(cap.index) == idx_sym {
                sym_name = Some(txt);
            }
        }
        if let (Some(p), Some(s)) = (pkg_name, sym_name)
            && pkgs.contains_key(p)
            && !api.syms.contains(s)
        {
            issues.push(SnippetIssue {
                route: route.to_string(),
                lang: lang_tag.to_string(),
                kind: "import".to_string(),
                detail: format!("{p} -> {s}"),
            });
        }
    }
    issues
}
fn check_toml_versions(
    route: &str,
    code: &str,
    pkgs: &HashMap<String, String>,
) -> Vec<SnippetIssue> {
    let mut issues = Vec::new();
    for line in code.lines() {
        let t = line.trim();
        let Some((lhs, rhs)) = t.split_once('=') else {
            continue;
        };
        let dep = lhs.trim().trim_matches('"');
        let Some(actual) = pkgs.get(dep) else {
            continue;
        };
        let val = rhs.trim();
        let doc_ver = if let Some(s) = val.strip_prefix('"') {
            s.split('"').next().unwrap_or("")
        } else if let Some(idx) = val.find("version") {
            val[idx + 7..].split('"').nth(1).unwrap_or("")
        } else {
            ""
        };
        let clean = doc_ver.trim_start_matches(['^', '~', '=']);
        if !clean.is_empty()
            && clean
                .chars()
                .next()
                .map(|c| c.is_ascii_digit())
                .unwrap_or(false)
            && !actual.starts_with(clean)
        {
            issues.push(SnippetIssue {
                route: route.to_string(),
                lang: "toml".to_string(),
                kind: "version".to_string(),
                detail: format!("{dep} = \"{doc_ver}\" (repo: {actual})"),
            });
        }
    }
    issues
}
pub fn run_snippet_drift(
    dist_dir: &Path,
    _pages: &[PageDom],
    docs: &[MdDoc],
    api: &PublicApiIndex,
    cfg: &SnippetDriftCfg,
    default_locale: &str,
    i18n: &HashMap<String, SnippetDriftLabels>,
) -> SnippetDriftReport {
    let Some(repo_root) = &api.repo_root else {
        return SnippetDriftReport::default();
    };
    let pkgs = detect_repo_packages(repo_root);
    let rs_lang = tree_sitter_rust::LANGUAGE.into();
    let ts_lang = tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into();
    let (Ok(use_q), Ok(imp_q)) = (
        Query::new(&rs_lang, RUST_USE_QUERY),
        Query::new(&ts_lang, TS_IMPORT_QUERY),
    ) else {
        return SnippetDriftReport::default();
    };
    let extracted = extract_source_snippets(docs);
    let checked_snippets = extracted.len();
    let raw_issues: Vec<SnippetIssue> = extracted
        .par_iter()
        .flat_map(|(route, lang, code)| match lang.as_str() {
            "rust" | "rs" => check_rust_snippet(route, code, &pkgs, api, &use_q),
            "ts" | "tsx" | "typescript" => check_ts_snippet(route, lang, code, &pkgs, api, &imp_q),
            "toml" => check_toml_versions(route, code, &pkgs),
            _ => Vec::new(),
        })
        .collect();
    let mut seen = HashSet::new();
    let mut issues = Vec::new();
    for it in raw_issues {
        if seen.insert((it.route.clone(), it.kind.clone(), it.detail.clone())) {
            issues.push(it);
        }
    }
    let fb = i18n
        .get(default_locale)
        .or_else(|| i18n.get("en"))
        .cloned()
        .unwrap_or_default();
    let labels = i18n.get(default_locale).unwrap_or(&fb);
    let mut warnings = Vec::new();
    let mut errors = Vec::new();
    for it in &issues {
        let tpl = match it.kind.as_str() {
            "syntax" => {
                if labels.syntax_error.is_empty() {
                    &fb.syntax_error
                } else {
                    &labels.syntax_error
                }
            }
            "import" => {
                if labels.import_phantom.is_empty() {
                    &fb.import_phantom
                } else {
                    &labels.import_phantom
                }
            }
            _ => {
                if labels.version_drift.is_empty() {
                    &fb.version_drift
                } else {
                    &labels.version_drift
                }
            }
        };
        let msg = format!(
            "[docs-toolkit:snippet-drift] {}",
            tpl.replace("{detail}", &it.detail)
                .replace("{route}", &it.route)
                .replace("{lang}", &it.lang)
        );
        if cfg.strict {
            errors.push(msg);
        } else {
            warnings.push(msg);
        }
    }
    let title = if labels.report_title.is_empty() {
        fb.report_title.clone()
    } else {
        labels.report_title.clone()
    };
    let report = SnippetDriftReport {
        title,
        checked_snippets,
        issues,
        warnings,
        errors,
    };
    if cfg.write_report
        && let Ok(json) = serde_json::to_string_pretty(&report)
    {
        let _ = fs::write(dist_dir.join("snippet-drift.json"), json);
    }
    report
}
