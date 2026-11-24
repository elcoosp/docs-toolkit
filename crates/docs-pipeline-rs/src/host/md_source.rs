use rayon::prelude::*;
use std::collections::HashSet;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct MdDoc {
    pub rel_path: String,
    pub slug: String,
    pub locale: String,
    pub rel_no_locale: String,
    pub unlocalized_slug: String,
    pub route: String,
    pub markdown_route: String,
    pub section_key: String,
    pub title: String,
    pub description: String,
    pub doc_type: String,
    pub order: i32,
    pub aliases: Vec<String>,
    pub has_frontmatter: bool,
    pub body: String,
}

impl MdDoc {
    pub fn category(&self) -> &'static str {
        match self.section_key.as_str() {
            "tutorials" => "tutorials",
            "guides" => "guides",
            "explanation" => "explanation",
            "reference" => "reference",
            "index" => "home",
            _ => "docs",
        }
    }
}

pub fn unquote_yaml(val: &str) -> String {
    let t = val.trim();
    if (t.starts_with('"') && t.ends_with('"') && t.len() >= 2)
        || (t.starts_with('\'') && t.ends_with('\'') && t.len() >= 2)
    {
        return t[1..t.len() - 1]
            .replace("\\\"", "\"")
            .replace("''", "'")
            .trim()
            .to_string();
    }
    t.to_string()
}

pub fn strip_frontmatter(raw: &str) -> (bool, String, String) {
    let normalized = raw.replace("\r\n", "\n");
    if let Some(rest) = normalized.strip_prefix("---\n")
        && let Some(end_idx) = rest.find("\n---")
    {
        let fm = rest[..end_idx].to_string();
        let after = &rest[end_idx + 4..];
        let body = after.strip_prefix('\n').unwrap_or(after).to_string();
        return (true, fm, body);
    }
    (false, String::new(), normalized)
}

pub fn extract_yaml_field(fm: &str, key: &str) -> String {
    let lines: Vec<&str> = fm.lines().collect();
    let prefix = format!("{key}:");
    for (i, line) in lines.iter().enumerate() {
        if line.trim_start() != *line {
            continue;
        }
        if let Some(rest) = line.strip_prefix(&prefix) {
            let r = rest.trim();
            if matches!(r, ">" | "|" | ">-" | "|-") {
                let mut collected = Vec::new();
                for next_line in &lines[i + 1..] {
                    if next_line.starts_with(' ') || next_line.starts_with('\t') {
                        collected.push(next_line.trim());
                    } else if next_line.trim().is_empty() {
                        collected.push("");
                    } else {
                        break;
                    }
                }
                let sep = if r.starts_with('|') { "\n" } else { " " };
                return collected.join(sep).trim().to_string();
            }
            if !r.is_empty() {
                return unquote_yaml(r);
            }
        }
    }
    String::new()
}

fn extract_order(fm: &str) -> i32 {
    let mut in_sidebar = false;
    for line in fm.lines() {
        if let Some(rest) = line.strip_prefix("order:")
            && let Ok(n) = rest.trim().parse::<i32>()
        {
            return n;
        }
        if line.trim() == "sidebar:" {
            in_sidebar = true;
            continue;
        }
        if in_sidebar {
            if line.starts_with(' ') || line.starts_with('\t') {
                if let Some(rest) = line.trim().strip_prefix("order:")
                    && let Ok(n) = rest.trim().parse::<i32>()
                {
                    return n;
                }
            } else if !line.trim().is_empty() {
                in_sidebar = false;
            }
        }
    }
    99
}

fn extract_aliases(fm: &str) -> Vec<String> {
    for line in fm.lines() {
        let rest = line
            .strip_prefix("glossary:")
            .or_else(|| line.strip_prefix("aliases:"));
        if let Some(r) = rest {
            let t = r.trim();
            if t.starts_with('[') && t.ends_with(']') {
                return t[1..t.len() - 1]
                    .split(',')
                    .map(unquote_yaml)
                    .filter(|s| !s.is_empty())
                    .collect();
            }
        }
    }
    Vec::new()
}

pub fn load_all_markdown(
    docs_dir: &Path,
    locales: &HashSet<String>,
    default_locale: &str,
) -> Vec<MdDoc> {
    if !docs_dir.exists() {
        return Vec::new();
    }
    let mut files = Vec::new();
    let mut stack = vec![docs_dir.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            if name.to_string_lossy().starts_with('.') {
                continue;
            }
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.is_file() {
                let n = name.to_string_lossy();
                if n.ends_with(".md") || n.ends_with(".mdx") {
                    files.push(path);
                }
            }
        }
    }

    files
        .par_iter()
        .filter_map(|file_path| {
            let raw = fs::read_to_string(file_path).ok()?;
            let rel_path = file_path
                .strip_prefix(docs_dir)
                .ok()?
                .to_string_lossy()
                .replace('\\', "/");
            let no_ext = rel_path
                .strip_suffix(".mdx")
                .or_else(|| rel_path.strip_suffix(".md"))
                .unwrap_or(&rel_path);
            let slug = if no_ext != "index" && no_ext.ends_with("/index") {
                no_ext[..no_ext.len() - "/index".len()].to_string()
            } else {
                no_ext.to_string()
            };

            let first_seg = rel_path.split('/').next().unwrap_or("");
            let is_secondary =
                !first_seg.is_empty() && first_seg != default_locale && locales.contains(first_seg);
            let locale = if is_secondary {
                first_seg.to_string()
            } else {
                default_locale.to_string()
            };
            let rel_no_locale = if is_secondary {
                rel_path
                    .strip_prefix(&format!("{first_seg}/"))
                    .unwrap_or(&rel_path)
                    .to_string()
            } else {
                rel_path.clone()
            };
            let unlocalized_slug = if is_secondary {
                if slug == first_seg {
                    "index".to_string()
                } else {
                    slug.strip_prefix(&format!("{first_seg}/"))
                        .unwrap_or(&slug)
                        .to_string()
                }
            } else {
                slug.clone()
            };

            let route = if slug == "index" {
                "/".to_string()
            } else {
                format!("/{slug}/")
            };
            let markdown_route = if slug == "index" {
                "/index.md".to_string()
            } else {
                format!("/{slug}.md")
            };
            let section_key = if unlocalized_slug == "index" {
                "index".to_string()
            } else {
                unlocalized_slug
                    .split('/')
                    .next()
                    .unwrap_or("docs")
                    .to_string()
            };

            let (has_frontmatter, fm, body) = strip_frontmatter(&raw);
            let title = extract_yaml_field(&fm, "title");
            let description = extract_yaml_field(&fm, "description");
            let doc_type = extract_yaml_field(&fm, "type");
            let order = extract_order(&fm);
            let aliases = extract_aliases(&fm);

            Some(MdDoc {
                rel_path,
                slug,
                locale,
                rel_no_locale,
                unlocalized_slug,
                route,
                markdown_route,
                section_key,
                title,
                description,
                doc_type,
                order,
                aliases,
                has_frontmatter,
                body,
            })
        })
        .collect()
}
