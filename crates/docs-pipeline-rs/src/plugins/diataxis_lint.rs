use crate::host::md_source::MdDoc;
use std::collections::HashMap;

#[derive(Debug, Default)]
pub struct DiataxisReport {
    pub audited: usize,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

pub fn run_diataxis_lint(
    docs: &[MdDoc],
    min_desc_len: usize,
    max_desc_len: usize,
    min_explanation_words: usize,
) -> DiataxisReport {
    let mut report = DiataxisReport::default();
    let mut seen_titles: HashMap<String, &str> = HashMap::new();

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
        if !doc.has_frontmatter {
            report.errors.push(format!(
                r#"Missing YAML frontmatter in "{}"."#,
                doc.rel_path
            ));
            continue;
        }
        report.audited += 1;

        if doc.title.is_empty() {
            report.errors.push(format!(
                r#"Missing frontmatter title in "{}"."#,
                doc.rel_path
            ));
        } else {
            let key = format!("{}:{}", doc.locale, doc.title.to_lowercase());
            if let Some(&prev) = seen_titles.get(&key) {
                report.warnings.push(format!(
                    r#"Duplicate title "{}" [{}] in "{}" (already used in "{prev}")."#,
                    doc.title, doc.locale, doc.rel_path
                ));
            } else {
                seen_titles.insert(key, doc.rel_path.as_str());
            }
        }

        let dlen = doc.description.chars().count();
        if dlen < min_desc_len {
            report.warnings.push(format!(
                r#"Short/missing description ({dlen} chars) in "{}"."#,
                doc.rel_path
            ));
        } else if dlen > max_desc_len {
            report.warnings.push(format!(
                r#"Long description ({dlen} > {max_desc_len} chars) in "{}"."#,
                doc.rel_path
            ));
        }

        let mut in_fence = false;
        let mut h2_count = 0usize;
        let mut code_blocks = 0usize;
        let mut has_steps = false;
        let mut has_table = false;
        let mut has_todo = false;
        let mut word_count = 0usize;

        for line in doc.body.lines() {
            let t = line.trim();
            if t.starts_with("```") {
                if !in_fence {
                    code_blocks += 1;
                }
                in_fence = !in_fence;
                continue;
            }
            if in_fence {
                continue;
            }
            if t.contains("<Steps") {
                has_steps = true;
            }
            if t.contains("<Code ") || t.contains("<Code>") {
                code_blocks += 1;
                continue;
            }
            if t.starts_with("## ") {
                h2_count += 1;
            }
            if t.starts_with('|') && t.ends_with('|') {
                has_table = true;
            }
            if t.contains("LOREM IPSUM")
                || t.split(|c: char| !c.is_ascii_alphanumeric() && c != '_')
                    .any(|w| matches!(w, "TODO" | "FIXME" | "TBD"))
            {
                has_todo = true;
            }
            if !t.is_empty()
                && !t.starts_with("import ")
                && !t.starts_with("export ")
                && !t.starts_with('<')
            {
                word_count += t.split_whitespace().count();
            }
        }

        if has_todo {
            report.warnings.push(format!(
                r#"Unfinished placeholder (TODO/FIXME/TBD) found in "{}"."#,
                doc.rel_path
            ));
        }

        let quadrant = doc.rel_no_locale.split('/').next().unwrap_or("");
        match quadrant {
            "tutorials" => {
                if code_blocks == 0 {
                    report.warnings.push(format!(
                        r#"Tutorial "{}" has 0 runnable code blocks."#,
                        doc.rel_path
                    ));
                }
                if h2_count < 2 && !has_steps {
                    report.warnings.push(format!(
                        r#"Tutorial "{}" has fewer than 2 step sections (H2)."#,
                        doc.rel_path
                    ));
                }
            }
            "guides" => {
                if code_blocks == 0 && !has_table {
                    report.warnings.push(format!(
                        r#"How-to guide "{}" has no code block or configuration table."#,
                        doc.rel_path
                    ));
                }
            }
            "reference" => {
                let is_changelog = doc.rel_no_locale.ends_with("/changelog.md")
                    || doc.rel_no_locale.ends_with("/changelog.mdx")
                    || doc.rel_no_locale.ends_with("/release-notes.md")
                    || doc.rel_no_locale.ends_with("/release-notes.mdx");
                if !is_changelog && code_blocks == 0 && !has_table {
                    report.warnings.push(format!(
                        r#"Reference page "{}" has no signature block or reference table."#,
                        doc.rel_path
                    ));
                }
            }
            "explanation" if word_count < min_explanation_words => {
                report.warnings.push(format!(
                        r#"Explanation page "{}" is thin ({word_count} < {min_explanation_words} words)."#,
                        doc.rel_path
                    ));
            }
            _ => {}
        }
    }
    report
}
