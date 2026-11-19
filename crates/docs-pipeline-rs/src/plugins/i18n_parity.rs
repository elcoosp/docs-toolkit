use crate::host::md_source::MdDoc;
use std::collections::{BTreeSet, HashMap, HashSet};

#[derive(Debug, Default)]
pub struct I18nReport {
    pub audited_pairs: usize,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

struct DocStructure {
    h2_count: usize,
    code_blocks: usize,
    admonitions: usize,
    tabs: usize,
    links: Vec<String>,
    paragraphs: HashSet<String>,
}

fn analyze_markdown(body: &str, all_locales: &HashSet<String>) -> DocStructure {
    let mut in_fence = false;
    let mut h2_count = 0;
    let mut code_blocks = 0;
    let mut admonitions = 0;
    let mut tabs = 0;
    let mut prose_lines = Vec::new();
    let mut paragraphs = HashSet::new();
    let mut para_buf: Vec<&str> = Vec::new();

    let flush_para = |buf: &mut Vec<&str>, out: &mut HashSet<String>| {
        if buf.is_empty() {
            return;
        }
        let joined = buf
            .join(" ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        buf.clear();
        let mut prose_letters = 0usize;
        let mut in_code = false;
        let mut in_tag = false;
        for ch in joined.chars() {
            match ch {
                '`' => in_code = !in_code,
                '<' => in_tag = true,
                '>' => in_tag = false,
                _ if !in_code && !in_tag && ch.is_alphabetic() => prose_letters += 1,
                _ => {}
            }
        }
        if prose_letters >= 60 {
            out.insert(joined);
        }
    };

    for raw_line in body.lines() {
        let t = raw_line.trim();
        if t.starts_with("```") {
            flush_para(&mut para_buf, &mut paragraphs);
            if !in_fence {
                code_blocks += 1;
            }
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        if t.contains("<Code ") || t.contains("<Code>") {
            flush_para(&mut para_buf, &mut paragraphs);
            code_blocks += 1;
            continue;
        }
        if t.starts_with("## ") {
            flush_para(&mut para_buf, &mut paragraphs);
            h2_count += 1;
            continue;
        }
        if t.starts_with(":::") {
            flush_para(&mut para_buf, &mut paragraphs);
            if t.len() > 3 {
                admonitions += 1;
            }
            continue;
        }
        if t.contains("<Tabs") {
            tabs += 1;
        }
        prose_lines.push(t);
        if t.is_empty()
            || t.starts_with('#')
            || t.starts_with("import ")
            || t.starts_with("export ")
            || t.starts_with('<')
            || t.starts_with('|')
            || t.starts_with('-')
            || t.starts_with('*')
        {
            flush_para(&mut para_buf, &mut paragraphs);
            continue;
        }
        para_buf.push(t);
    }
    flush_para(&mut para_buf, &mut paragraphs);

    let joined_prose = prose_lines.join("\n");
    let mut links = BTreeSet::new();
    let mut search = joined_prose.as_str();
    while let Some(idx) = search.find("](/") {
        let after = &search[idx + 2..];
        let end = after.find([')', '#', ' ', '\n']).unwrap_or(after.len());
        let raw_href = &after[..end];
        if raw_href.len() > 1 {
            let seg = raw_href.split('/').nth(1).unwrap_or("");
            let mut href = if !seg.is_empty() && all_locales.contains(seg) {
                let stripped = &raw_href[seg.len() + 1..];
                if stripped.is_empty() {
                    "/".to_string()
                } else {
                    stripped.to_string()
                }
            } else {
                raw_href.to_string()
            };
            if !href.ends_with('/') {
                href.push('/');
            }
            links.insert(href);
        }
        search = &after[end..];
    }

    DocStructure {
        h2_count,
        code_blocks,
        admonitions,
        tabs,
        links: links.into_iter().collect(),
        paragraphs,
    }
}

pub fn run_i18n_parity(
    docs: &[MdDoc],
    default_locale: &str,
    secondary_locales: &[String],
    all_locales: &HashSet<String>,
    ignore_paths: &[String],
) -> I18nReport {
    let mut report = I18nReport::default();
    if secondary_locales.is_empty() {
        return report;
    }

    let is_ignored = |rel: &str| -> bool {
        if rel == "404.md"
            || rel == "404.mdx"
            || rel.ends_with("/404.md")
            || rel.ends_with("/404.mdx")
        {
            return true;
        }
        ignore_paths.iter().any(|p| rel.starts_with(p.as_str()))
    };

    let mut default_docs: HashMap<&str, &MdDoc> = HashMap::new();
    let mut localized_docs: HashMap<&str, HashMap<&str, &MdDoc>> = HashMap::new();
    for loc in secondary_locales {
        localized_docs.insert(loc.as_str(), HashMap::new());
    }

    for doc in docs {
        if doc.locale == default_locale {
            if !is_ignored(&doc.rel_no_locale) {
                default_docs.insert(doc.rel_no_locale.as_str(), doc);
            }
        } else if let Some(map) = localized_docs.get_mut(doc.locale.as_str())
            && !is_ignored(&doc.rel_no_locale)
        {
            map.insert(doc.rel_no_locale.as_str(), doc);
        }
    }

    for loc in secondary_locales {
        let Some(loc_map) = localized_docs.get(loc.as_str()) else {
            continue;
        };
        for (&rel, &en_doc) in &default_docs {
            let Some(&loc_doc) = loc_map.get(rel) else {
                report.errors.push(format!(
                    "Missing \"{loc}\" translation for \"{rel}\" (expected src/content/docs/{loc}/{rel})."
                ));
                continue;
            };
            report.audited_pairs += 1;
            let en_s = analyze_markdown(&en_doc.body, all_locales);
            let loc_s = analyze_markdown(&loc_doc.body, all_locales);

            let is_changelog = rel == "changelog.md"
                || rel == "changelog.mdx"
                || rel == "release-notes.md"
                || rel == "release-notes.mdx"
                || rel.ends_with("/changelog.md")
                || rel.ends_with("changelog.mdx")
                || rel.ends_with("release-notes.md")
                || rel.ends_with("release-notes.mdx");
            if !is_changelog && en_s.h2_count != loc_s.h2_count {
                report.warnings.push(format!(
                    "Section count drift on \"{rel}\": default has {} H2, \"{loc}\" has {}.",
                    en_s.h2_count, loc_s.h2_count
                ));
            }
            if en_s.code_blocks != loc_s.code_blocks {
                report.warnings.push(format!(
                    "Code block drift on \"{rel}\": default has {} blocks, \"{loc}\" has {}.",
                    en_s.code_blocks, loc_s.code_blocks
                ));
            }
            if en_s.admonitions != loc_s.admonitions {
                report.warnings.push(format!(
                    "Admonition drift on \"{rel}\": default has {} ::: blocks, \"{loc}\" has {}.",
                    en_s.admonitions, loc_s.admonitions
                ));
            }
            if en_s.tabs != loc_s.tabs {
                report.warnings.push(format!(
                    "Tabs drift on \"{rel}\": default has {} <Tabs>, \"{loc}\" has {}.",
                    en_s.tabs, loc_s.tabs
                ));
            }
            if en_s.links != loc_s.links {
                report.warnings.push(format!(
                    "Internal link drift on \"{rel}\" between default and \"{loc}\"."
                ));
            }
            let untranslated = loc_s
                .paragraphs
                .iter()
                .filter(|p| en_s.paragraphs.contains(*p))
                .count();
            if untranslated > 0 {
                report.warnings.push(format!(
                    "Possible untranslated English prose in \"{loc}/{rel}\" ({untranslated} identical paragraph(s))."
                ));
            }
        }
        for &rel in loc_map.keys() {
            if !default_docs.contains_key(rel) {
                report.warnings.push(format!(
                    "Orphan translated page \"{loc}/{rel}\" has no counterpart in default locale."
                ));
            }
        }
    }
    report
}
