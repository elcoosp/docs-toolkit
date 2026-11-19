use rayon::prelude::*;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tl::{Node, ParserOptions, VDom};

#[derive(Debug, Clone)]
pub struct PageDom {
    pub rel_path: String,
    pub route: String,
    pub locale: String,
    pub title: String,
    pub description: String,
    pub headings: Vec<(String, String)>,
    pub ids: HashSet<String>,
    pub prose_text: String,
    pub concept_text: String,
    pub main_word_count: usize,
}

pub fn normalize_route(route: &str) -> String {
    let mut clean = route.split(['#', '?']).next().unwrap_or("").to_string();
    if !clean.starts_with('/') {
        clean.insert(0, '/');
    }
    if let Some(s) = clean.strip_suffix("/index.html") {
        clean = if s.is_empty() {
            "/".to_string()
        } else {
            format!("{s}/")
        };
    } else if let Some(s) = clean.strip_suffix(".html") {
        clean = format!("{s}/");
    }
    if clean.len() > 1 && !clean.ends_with('/') {
        clean.push('/');
    }
    clean
}

pub fn collect_html_files(dist_dir: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut stack = vec![dist_dir.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.is_file() && entry.file_name().to_string_lossy().ends_with(".html") {
                out.push(path);
            }
        }
    }
    out
}

pub fn parse_all_html(
    dist_dir: &Path,
    locales: &HashSet<String>,
    default_locale: &str,
) -> Vec<PageDom> {
    collect_html_files(dist_dir)
        .par_iter()
        .filter_map(|file_path| {
            let html = fs::read_to_string(file_path).ok()?;
            let rel = file_path
                .strip_prefix(dist_dir)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/");
            let route = normalize_route(&format!("/{rel}"));
            let seg = route.split('/').nth(1).unwrap_or("");
            let locale = if !seg.is_empty() && seg != default_locale && locales.contains(seg) {
                seg.to_string()
            } else {
                default_locale.to_string()
            };
            Some(parse_single_html(rel, route, locale, &html))
        })
        .collect()
}

fn collapse_ws(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn strip_site_suffix(title: &str) -> String {
    for sep in [" — ", " – ", " - "] {
        if let Some(idx) = title.rfind(sep) {
            return title[..idx].trim().to_string();
        }
    }
    title.trim().to_string()
}

fn parse_single_html(rel_path: String, route: String, locale: String, html: &str) -> PageDom {
    let mut title = String::new();
    let mut description = String::new();
    let mut headings = Vec::new();
    let mut ids = HashSet::new();
    let mut prose_parts = Vec::new();
    let mut concept_parts = Vec::new();
    let mut first_para = String::new();
    let mut main_words = 0usize;

    if let Ok(dom) = tl::parse(html, ParserOptions::new().track_classes()) {
        let parser = dom.parser();
        for node in dom.nodes() {
            if let Node::Tag(tag) = node
                && let Some(Some(id_b)) = tag.attributes().get("id")
            {
                let id_s = id_b.as_utf8_str();
                if !id_s.is_empty() {
                    ids.insert(id_s.into_owned());
                }
            }
        }
        if let Some(mut it) = dom.query_selector("meta[name=\"description\"]")
            && let Some(h) = it.next()
            && let Some(tag) = h.get(parser).and_then(|n| n.as_tag())
            && let Some(Some(c)) = tag.attributes().get("content")
        {
            description = c.as_utf8_str().trim().to_string();
        }
        if let Some(mut it) = dom.query_selector("main h1")
            && let Some(h) = it.next()
            && let Some(n) = h.get(parser)
        {
            title = strip_site_suffix(&collapse_ws(&n.inner_text(parser)));
        }
        if title.is_empty()
            && let Some(mut it) = dom.query_selector("title")
            && let Some(h) = it.next()
            && let Some(n) = h.get(parser)
        {
            title = strip_site_suffix(&collapse_ws(&n.inner_text(parser)));
        }
        for sel in ["h2", "h3", "h4"] {
            if let Some(it) = dom.query_selector(sel) {
                for h in it {
                    if let Some(n) = h.get(parser)
                        && let Some(tag) = n.as_tag()
                        && let Some(Some(id_v)) = tag.attributes().get("id")
                    {
                        let id_s = id_v.as_utf8_str().into_owned();
                        let raw_t = collapse_ws(&n.inner_text(parser));
                        let clean_t = raw_t.strip_suffix('#').unwrap_or(&raw_t).trim().to_string();
                        if !id_s.is_empty() && !clean_t.is_empty() {
                            headings.push((id_s, clean_t));
                        }
                    }
                }
            }
        }
        if description.is_empty()
            && let Some(it) = dom.query_selector(".sl-markdown-content p")
        {
            for h in it {
                if let Some(n) = h.get(parser) {
                    let txt = collapse_ws(&n.inner_text(parser));
                    if txt.chars().count() >= 24 {
                        first_para = txt;
                        break;
                    }
                }
            }
        }
        if let Some(mut it) = dom.query_selector(".sl-markdown-content")
            && let Some(h) = it.next()
            && let Some(n) = h.get(parser)
        {
            main_words = n.inner_text(parser).split_whitespace().count();
            collect_prose(&dom, n, false, &mut prose_parts);
            collect_concept_text(&dom, n, false, &mut concept_parts);
        }
    }
    if description.is_empty() {
        description = first_para;
    }
    PageDom {
        rel_path,
        route,
        locale,
        title,
        description,
        headings,
        ids,
        prose_text: prose_parts.join(" "),
        concept_text: collapse_ws(&concept_parts.join(" ")),
        main_word_count: main_words,
    }
}

fn collect_prose<'a>(dom: &VDom<'a>, node: &Node<'a>, skip: bool, out: &mut Vec<String>) {
    match node {
        Node::Raw(b) => {
            if !skip {
                let s = b.as_utf8_str();
                if !s.trim().is_empty() {
                    out.push(s.into_owned());
                }
            }
        }
        Node::Tag(tag) => {
            let name = tag.name().as_utf8_str();
            let next_skip = skip
                || matches!(
                    name.as_ref(),
                    "pre" | "code" | "a" | "script" | "style" | "svg"
                );
            for ch in tag.children().top().iter() {
                if let Some(c) = ch.get(dom.parser()) {
                    collect_prose(dom, c, next_skip, out);
                }
            }
        }
        Node::Comment(_) => {}
    }
}

fn collect_concept_text<'a>(dom: &VDom<'a>, node: &Node<'a>, skip: bool, out: &mut Vec<String>) {
    match node {
        Node::Raw(b) => {
            if !skip {
                let s = b.as_utf8_str();
                if !s.trim().is_empty() {
                    out.push(s.into_owned());
                }
            }
        }
        Node::Tag(tag) => {
            let name = tag.name().as_utf8_str();
            let next_skip =
                skip || matches!(name.as_ref(), "pre" | "script" | "style" | "svg" | "nav");
            for ch in tag.children().top().iter() {
                if let Some(c) = ch.get(dom.parser()) {
                    collect_concept_text(dom, c, next_skip, out);
                }
            }
        }
        Node::Comment(_) => {}
    }
}
