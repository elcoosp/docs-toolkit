use crate::host::md_source::MdDoc;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;

#[derive(Debug, Deserialize, Clone)]
pub struct LlmsOutputs {
    #[serde(default = "default_true")]
    pub index: bool,
    #[serde(default = "default_true")]
    pub full: bool,
    #[serde(default = "default_true")]
    pub small: bool,
    #[serde(default = "default_true")]
    pub json: bool,
    #[serde(default = "default_true")]
    pub pages: bool,
    #[serde(default = "default_true")]
    pub robots: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Deserialize, Clone)]
pub struct LlmsConfig {
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub exclude: Vec<String>,
    #[serde(default)]
    pub optional: Vec<String>,
    pub outputs: LlmsOutputs,
}

#[derive(Clone)]
struct CleanPage<'a> {
    doc: &'a MdDoc,
    title: String,
    section: String,
    clean_body: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct JsonPage<'a> {
    slug: &'a str,
    locale: &'a str,
    route: &'a str,
    markdown_route: &'a str,
    title: &'a str,
    description: &'a str,
    #[serde(skip_serializing_if = "str::is_empty")]
    r#type: &'a str,
    order: i32,
    section: &'a str,
}

#[derive(Serialize)]
struct JsonManifest<'a> {
    #[serde(rename = "$schema")]
    schema: &'static str,
    title: String,
    description: &'a str,
    locale: &'a str,
    url: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    source: Option<&'a str>,
    pages: Vec<JsonPage<'a>>,
}

fn glob_matches(pattern: &str, text: &str) -> bool {
    if let Some(prefix) = pattern.strip_suffix("/**") {
        return text == prefix || text.starts_with(&format!("{prefix}/"));
    }
    if let Some(prefix) = pattern.strip_suffix("/*") {
        return text.starts_with(&format!("{prefix}/")) && !text[prefix.len() + 1..].contains('/');
    }
    if let Some(suffix) = pattern.strip_prefix("**/") {
        return text == suffix || text.ends_with(&format!("/{suffix}"));
    }
    pattern.trim_start_matches('/') == text.trim_start_matches('/')
}

fn section_label(section_key: &str, locale: &str) -> String {
    let is_fr = locale == "fr";
    match section_key {
        "index" => if is_fr { "Vue d'ensemble" } else { "Overview" }.to_string(),
        "tutorials" => if is_fr { "Tutoriels" } else { "Tutorials" }.to_string(),
        "guides" => if is_fr { "Guides pratiques" } else { "How-to Guides" }.to_string(),
        "reference" => if is_fr { "Référence" } else { "Reference" }.to_string(),
        "explanation" => if is_fr { "Explications" } else { "Explanation" }.to_string(),
        "blog" => "Blog".to_string(),
        "changelog" => if is_fr { "Journal des modifications" } else { "Changelog" }.to_string(),
        other => other
            .split(['-', '_'])
            .filter(|w| !w.is_empty())
            .map(|w| {
                let mut chars = w.chars();
                match chars.next() {
                    Some(c) => format!("{}{}", c.to_uppercase(), chars.as_str()),
                    None => String::new(),
                }
            })
            .collect::<Vec<_>>()
            .join(" "),
    }
}

fn extract_attr(attrs: &str, name: &str) -> Option< String > {
    for q in ['"', '\x27'] {
        let needle = format!("{name}={q}");
        if let Some(start) = attrs.find(&needle) {
            let rest = &attrs[start + needle.len()..];
            if let Some(end) = rest.find(q) {
                return Some(rest[..end].to_string());
            }
        }
    }
    None
}

fn render_diataxis_grid(tag_inner: &str, base_url: &str) -> String {
    let Some(items_pos) = tag_inner.find("items=") else { return String::new() };
    let rest = &tag_inner[items_pos + 6..];
    let Some(arr_start) = rest.find('[') else { return String::new() };
    let Some(arr_end) = rest.rfind(']') else { return String::new() };
    if arr_end <= arr_start {
        return String::new();
    }
    let arr_str = &rest[arr_start + 1..arr_end];
    let mut lines = Vec::new();
    let mut scan = arr_str;
    while let Some(obj_s) = scan.find('{') {
        let Some(obj_e) = scan[obj_s..].find('}') else { break };
        let obj = &scan[obj_s + 1..obj_s + obj_e];
        scan = &scan[obj_s + obj_e + 1..];
        let title = extract_js_prop(obj, "title");
        let desc = extract_js_prop(obj, "description");
        let raw_href = extract_js_prop(obj, "href");
        if title.is_empty() {
            continue;
        }
        let href = if raw_href.starts_with('/') && !base_url.is_empty() {
            format!("{base_url}{raw_href}")
        } else {
            raw_href
        };
        let line = if !href.is_empty() {
            if desc.is_empty() {
                format!("- [{title}]({href})")
            } else {
                format!("- [{title}]({href}): {desc}")
            }
        } else if desc.is_empty() {
            format!("- **{title}**")
        } else {
            format!("- **{title}**: {desc}")
        };
        lines.push(line);
    }
    if lines.is_empty() {
        String::new()
    } else {
        format!("\n{}\n", lines.join("\n"))
    }
}

fn extract_js_prop(obj: &str, prop: &str) -> String {
    for pat in [format!("{prop}:"), format!("\"{prop}\":"), format!("'{prop}':")] {
        if let Some(idx) = obj.find(&pat) {
            let val_part = obj[idx + pat.len()..].trim_start();
            let quote = val_part.chars().next().unwrap_or(' ');
            if quote == '"' || quote == '\'' {
                let inner = &val_part[1..];
                if let Some(end) = inner.find(quote) {
                    return inner[..end].trim().to_string();
                }
            }
        }
    }
    String::new()
}

fn clean_mdx_prose(segment: &str, base_url: &str) -> String {
    let mut lines = Vec::new();
    for line in segment.lines() {
        let t = line.trim_start();
        if t.starts_with("import ") || t.starts_with("export ") {
            continue;
        }
        lines.push(line);
    }
    let mut text = lines.join("\n");

    while let Some(s) = text.find("{/*") {
        let Some(e) = text[s + 3..].find("*/}") else { break };
        text.replace_range(s..s + 3 + e + 3, "");
    }

    while let Some(s) = text.find("<DiataxisGrid") {
        let Some(e) = text[s..].find("/>") else { break };
        let inner = text[s..s + e].to_string();
        let rep = render_diataxis_grid(&inner, base_url);
        text.replace_range(s..s + e + 2, &rep);
    }

    for tag in ["Card", "LinkCard"] {
        let open = format!("<{tag}");
        while let Some(s) = text.find(&open) {
            let Some(e) = text[s..].find("/>") else { break };
            let attrs = &text[s + open.len()..s + e];
            let title = extract_attr(attrs, "title").unwrap_or_default();
            let desc = extract_attr(attrs, "description").unwrap_or_default();
            let raw_href = extract_attr(attrs, "href").unwrap_or_default();
            let href = if raw_href.starts_with('/') && !base_url.is_empty() {
                format!("{base_url}{raw_href}")
            } else {
                raw_href
            };
            let replacement = if title.is_empty() {
                String::new()
            } else if !href.is_empty() {
                if desc.is_empty() {
                    format!("- [{title}]({href})")
                } else {
                    format!("- [{title}]({href}): {desc}")
                }
            } else if desc.is_empty() {
                format!("- **{title}**")
            } else {
                format!("- **{title}**: {desc}")
            };
            text.replace_range(s..s + e + 2, &replacement);
        }
    }

    while let Some(s) = text.find("<LinkButton") {
        let Some(gt) = text[s..].find('>') else { break };
        let Some(close) = text[s + gt + 1..].find("</LinkButton>") else { break };
        let attrs = &text[s + "<LinkButton".len()..s + gt];
        let label = text[s + gt + 1..s + gt + 1 + close].trim();
        let raw_href = extract_attr(attrs, "href").unwrap_or_default();
        let href = if raw_href.starts_with('/') && !base_url.is_empty() {
            format!("{base_url}{raw_href}")
        } else {
            raw_href
        };
        let rep = if !href.is_empty() && !label.is_empty() {
            format!("[{label}]({href})")
        } else {
            label.to_string()
        };
        text.replace_range(s..s + gt + 1 + close + "</LinkButton>".len(), &rep);
    }

    while let Some(s) = text.find("<Aside") {
        let Some(gt) = text[s..].find('>') else { break };
        let Some(close) = text[s + gt + 1..].find("</Aside>") else { break };
        let attrs = &text[s + "<Aside".len()..s + gt];
        let inner = text[s + gt + 1..s + gt + 1 + close].trim();
        let aside_type = extract_attr(attrs, "type").unwrap_or_else(|| "note".to_string());
        let heading = match extract_attr(attrs, "title") {
            Some(t) if !t.is_empty() => format!("{}: {t}", aside_type.to_uppercase()),
            _ => aside_type.to_uppercase(),
        };
        let quoted: Vec<String> = inner
            .lines()
            .map(|l| format!("> {l}").trim_end().to_string())
            .collect();
        let rep = format!("\n> **{heading}**\n{}\n", quoted.join("\n"));
        text.replace_range(s..s + gt + 1 + close + "</Aside>".len(), &rep);
    }

    while let Some(s) = text.find("<Card") {
        let Some(gt) = text[s..].find('>') else { break };
        let Some(close) = text[s + gt + 1..].find("</Card>") else { break };
        let attrs = &text[s + "<Card".len()..s + gt];
let inner = text[s + gt + 1..s + gt + 1 + close].trim();
let title = extract_attr(attrs, "title").unwrap_or_default();
let rep = if title.is_empty() {
format!("\n{inner}\n")
} else {
format!("\n### {title}\n\n{inner}\n")
};
text.replace_range(s..s + gt + 1 + close + "".len(), &rep);
}
while let Some(s) = text.find("<TabItem") {
let Some(gt) = text[s..].find('>') else { break };
let Some(close) = text[s + gt + 1..].find("") else { break };
let attrs = &text[s + "<TabItem".len()..s + gt];
let inner = text[s + gt + 1..s + gt + 1 + close].trim();
let label = extract_attr(attrs, "label").unwrap_or_default();
let rep = if label.is_empty() {
format!("\n{inner}\n")
} else {
format!("\n#### {label}\n\n{inner}\n")
};
text.replace_range(s..s + gt + 1 + close + "".len(), &rep);
}
while let Some(s) = text.find("<Badge") {
let Some(e) = text[s..].find("/>") else { break };
let attrs = &text[s + "<Badge".len()..s + e];
let badge_txt = extract_attr(attrs, "text").unwrap_or_default();
let rep = if badge_txt.is_empty() {
String::new()
} else {
format!("\x60{badge_txt}\x60")
};
text.replace_range(s..s + e + 2, &rep);
}
for wrapper in [
"CardGrid", "Tabs", "Steps", "FileTree", "ShowcaseProfile",
"ShowcaseText", "ShowcaseImage", "ShowcaseCTA", "Icon",
] {
for pat in [format!("</{wrapper}>"), format!("<{wrapper}>"), format!("<{wrapper}/>")] {
text = text.replace(&pat, "");
}
let open = format!("<{wrapper} ");
while let Some(s) = text.find(&open) {
let Some(e) = text[s..].find('>') else { break };
text.replace_range(s..s + e + 1, "");
}
}
while text.contains("\n\n\n") {
text = text.replace("\n\n\n", "\n\n");
}
text
}
fn clean_body(body: &str, base_url: &str) -> String {
let mut out = String::with_capacity(body.len());
let mut rest = body;
loop {
let bt = rest.find("\x60\x60\x60");
let td = rest.find("~~~");
let next_fence = match (bt, td) {
(Some(a), Some(b)) => {
if a <= b { Some((a, "\x60\x60\x60")) } else { Some((b, "~~~")) }
}
(Some(a), None) => Some((a, "\x60\x60\x60")),
(None, Some(b)) => Some((b, "~~~")),
(None, None) => None,
};
if let Some((fence_start, marker)) = next_fence {
out.push_str(&clean_mdx_prose(&rest[..fence_start], base_url));
let after_open = &rest[fence_start + 3..];
if let Some(fence_end) = after_open.find(marker) {
out.push_str(&rest[fence_start..fence_start + 3 + fence_end + 3]);
rest = &after_open[fence_end + 3..];
} else {
out.push_str(&rest[fence_start..]);
break;
}
} else {
out.push_str(&clean_mdx_prose(rest, base_url));
break;
}
}
while out.contains("\n\n\n") {
out = out.replace("\n\n\n", "\n\n");
}
out.trim().to_string()
}
fn section_rank(key: &str, include_index: bool) -> usize {
if include_index {
match key {
"index" => 0,
"tutorials" => 1,
"guides" => 2,
"reference" => 3,
"explanation" => 4,
"blog" => 5,
"changelog" => 6,
_ => 50,
}
} else {
match key {
"tutorials" => 0,
"guides" => 1,
"reference" => 2,
"explanation" => 3,
_ => 50,
}
}
}
fn render_full(pages: &[CleanPage<'_>], cfg: &LlmsConfig, locale: &str, subtitle: &str) -> String {
let mut scoped: Vec<&CleanPage<'_>> = pages.iter().filter(|p| p.doc.locale == locale).collect();
scoped.sort_by(|a, b| {
section_rank(&a.doc.section_key, true)
.cmp(&section_rank(&b.doc.section_key, true))
.then_with(|| a.doc.order.cmp(&b.doc.order))
.then_with(|| a.title.cmp(&b.title))
});
let title = if locale == "fr" {
format!("{} (Français) — {subtitle}", cfg.title)
} else {
format!("{} — {subtitle}", cfg.title)
};
let mut out = format!("# {title}\n\n");
if !cfg.description.is_empty() {
out.push_str(&format!("> {}\n\n", cfg.description));
}
if !cfg.source.is_empty() {
out.push_str(&format!("Source: {}\n\n", cfg.source));
}
for p in scoped {
out.push_str(&format!("---\n\n# {}\n\n", p.title));
if !p.doc.description.is_empty() {
out.push_str(&format!("> {}\n\n", p.doc.description));
}
if !p.clean_body.is_empty() {
out.push_str(&format!("{}\n\n", p.clean_body));
}
}
format!("{}\n", out.trim())
}
fn render_index(pages: &[CleanPage<'_>], cfg: &LlmsConfig, locale: &str) -> String {
let scoped: Vec<&CleanPage<'_>> = pages.iter().filter(|p| p.doc.locale == locale).collect();
let title = if locale == "fr" {
format!("{} (Français)", cfg.title)
} else {
cfg.title.clone()
};
let mut out = format!("# {title}\n\n");
if !cfg.description.is_empty() {
out.push_str(&format!("> {}\n\n", cfg.description));
}
if !cfg.source.is_empty() {
out.push_str(&format!("Source: {}\n", cfg.source));
}
let base_url = cfg.url.trim_end_matches('/');
let is_opt = |p: &CleanPage<'_>| -> bool {
if p.doc.section_key == "blog" || p.doc.section_key == "changelog" {
return true;
}
cfg.optional
.iter()
.any(|pat| glob_matches(pat, &p.doc.slug) || glob_matches(pat, &p.doc.unlocalized_slug))
};
let format_link = |p: &CleanPage<'_>| -> String {
let target = format!("{base_url}{}", p.doc.markdown_route);
if p.doc.description.is_empty() {
format!("- \x5b{}\x5d({target})\n", p.title)
} else {
format!("- \x5b{}\x5d({target}): {}\n", p.title, p.doc.description)
}
};
let optional_pages: Vec<&&CleanPage<'_>> = scoped.iter().filter(|p| is_opt(p)).collect();
let core_pages: Vec<&&CleanPage<'_>> = scoped
.iter()
.filter(|p| p.doc.section_key != "index" && !is_opt(p))
.collect();
let mut keys: Vec<&str> = Vec::new();
for p in &core_pages {
if !keys.contains(&p.doc.section_key.as_str()) {
keys.push(p.doc.section_key.as_str());
}
}
keys.sort_by_key(|k| section_rank(k, false));
for key in keys {
let group: Vec<&&CleanPage<'_>> = core_pages
.iter()
.copied()
.filter(|p| p.doc.section_key == key)
.collect();
if let Some(first) = group.first() {
out.push_str(&format!("\n## {}\n\n", first.section));
for p in group {
out.push_str(&format_link(p));
}
}
}
if !optional_pages.is_empty() {
let opt_heading = if locale == "fr" { "Optionnel" } else { "Optional" };
out.push_str(&format!("\n## {opt_heading}\n\n"));
for p in optional_pages {
out.push_str(&format_link(p));
}
}
format!("{}\n", out.trim())
}
fn render_small(pages: &[CleanPage<'_>], cfg: &LlmsConfig, locale: &str) -> String {
let scoped: Vec<&CleanPage<'_>> = pages.iter().filter(|p| p.doc.locale == locale).collect();
let mut selected: Vec<CleanPage<'_>> = Vec::new();
let mut seen: HashSet< String > = HashSet::new();
for p in &scoped {
if (p.doc.section_key == "index" || p.doc.doc_type == "overview" || p.doc.order <= 2)
&& seen.insert(p.doc.slug.clone())
{
selected.push((*p).clone());
}
}
for sec in ["tutorials", "guides", "reference", "explanation"] {
if let Some(first) = scoped.iter().find(|p| p.doc.section_key == sec) {
if seen.insert(first.doc.slug.clone()) {
selected.push((*first).clone());
}
}
}
let label = if locale == "fr" { "résumé essentiel" } else { "curated subset" };
render_full(&selected, cfg, locale, label)
}
fn render_json(pages: &[CleanPage<'_>], cfg: &LlmsConfig, locale: &str) -> String {
let scoped: Vec<JsonPage<'_>> = pages
.iter()
.filter(|p| p.doc.locale == locale)
.map(|p| JsonPage {
slug: &p.doc.slug,
locale: &p.doc.locale,
route: &p.doc.route,
markdown_route: &p.doc.markdown_route,
title: &p.title,
description: &p.doc.description,
r#type: &p.doc.doc_type,
order: p.doc.order,
section: &p.section,
})
.collect();
let manifest = JsonManifest {
schema: "llmstxt.org",
title: if locale == "fr" {
format!("{} (Français)", cfg.title)
} else {
cfg.title.clone()
},
description: &cfg.description,
locale,
url: &cfg.url,
source: if cfg.source.is_empty() { None } else { Some(&cfg.source) },
pages: scoped,
};
serde_json::to_string_pretty(&manifest).unwrap_or_else(|_| "{}".to_string())
}
pub fn run_llms(dist_dir: &Path, docs: &[MdDoc], cfg: &LlmsConfig) -> usize {
let base_url = cfg.url.trim_end_matches('/');
let mut pages: Vec<CleanPage<'_>> = docs
.iter()
.filter(|d| !cfg.exclude.iter().any(|pat| glob_matches(pat, &d.slug)))
.map(|d| {
let fallback_title = d
.rel_path
.rsplit('/')
.next()
.unwrap_or(&d.rel_path)
.strip_suffix(".mdx")
.or_else(|| d.rel_path.rsplit('/').next().unwrap_or(&d.rel_path).strip_suffix(".md"))
.unwrap_or(&d.slug)
.to_string();
CleanPage {
doc: d,
title: if d.title.is_empty() { fallback_title } else { d.title.clone() },
section: section_label(&d.section_key, &d.locale),
clean_body: clean_body(&d.body, base_url),
}
})
.collect();
pages.sort_by(|a, b| a.doc.order.cmp(&b.doc.order).then_with(|| a.title.cmp(&b.title)));
let write_file = |rel: &str, content: String| {
let p = dist_dir.join(rel);
if let Some(parent) = p.parent() {
let _ = fs::create_dir_all(parent);
}
let _ = fs::write(p, content);
};
let mut locales = vec!["en".to_string()];
for p in &pages {
if !locales.contains(&p.doc.locale) {
locales.push(p.doc.locale.clone());
}
}
for loc in &locales {
let prefix = if loc == "en" { String::new() } else { format!("{loc}/") };
if cfg.outputs.index {
write_file(&format!("{prefix}llms.txt"), render_index(&pages, cfg, loc));
}
if cfg.outputs.full {
write_file(&format!("{prefix}llms-full.txt"), render_full(&pages, cfg, loc, "full documentation"));
}
if cfg.outputs.small {
write_file(&format!("{prefix}llms-small.txt"), render_small(&pages, cfg, loc));
}
if cfg.outputs.json {
write_file(&format!("{prefix}llms.json"), render_json(&pages, cfg, loc));
}
}
if cfg.outputs.pages {
for p in &pages {
let target = if p.doc.slug == "index" {
"index.md".to_string()
} else {
format!("{}.md", p.doc.slug)
};
let mut md = format!("# {}\n\n", p.title);
if !p.doc.description.is_empty() {
md.push_str(&format!("> {}\n\n", p.doc.description));
}
md.push_str(&p.clean_body);
write_file(&target, format!("{}\n", md.trim()));
}
}
if cfg.outputs.robots {
let robots_path = dist_dir.join("robots.txt");
let llms_loc = if base_url.is_empty() {
"/llms.txt".to_string()
} else {
format!("{base_url}/llms.txt")
};
let directive = format!("\n# LLMs\nLLMs-Txt: {llms_loc}\n");
if let Ok(existing) = fs::read_to_string(&robots_path) {
if !existing.contains("LLMs-Txt:") && !existing.contains("LLM:") {
let _ = fs::write(&robots_path, format!("{existing}{directive}"));
}
} else {
let _ = fs::write(&robots_path, format!("User-agent: *\nAllow: /\n{directive}"));
}
}
pages.len()
}
