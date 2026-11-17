use crate::host::html_dom::collect_html_files;
use mermaid_rs_renderer::{render_with_options, RenderOptions, Theme};
use rayon::prelude::*;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};

const MERMAID_KEYWORDS: &[&str] = &[
    "flowchart", "graph", "sequenceDiagram", "classDiagram", "stateDiagram-v2",
    "stateDiagram", "erDiagram", "pie", "gantt", "journey", "timeline", "mindmap",
    "gitGraph", "xychart-beta", "quadrantChart", "sankey-beta", "kanban", "C4Context",
    "C4Container", "C4Component", "C4Dynamic", "C4Deployment", "block-beta",
    "architecture-beta", "requirementDiagram", "zenuml", "packet-beta", "radar-beta",
    "treemap",
];

fn starlight_light_theme() -> Theme {
    let mut t = Theme::modern();
    t.background = "transparent".to_string();
    t.primary_color = "#f8fafc".to_string();
    t.primary_border_color = "#0284c7".to_string();
    t.primary_text_color = "#0f172a".to_string();
    t.secondary_color = "#f1f5f9".to_string();
    t.tertiary_color = "#e2e8f0".to_string();
    t.line_color = "#64748b".to_string();
    t.edge_label_background = "#ffffff".to_string();
    t.cluster_background = "#f8fafc".to_string();
    t.cluster_border = "#cbd5e1".to_string();
    t.font_family = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif".to_string();
    t
}

fn starlight_dark_theme() -> Theme {
    let mut t = Theme::modern();
    t.background = "transparent".to_string();
    t.primary_color = "#1e293b".to_string();
    t.primary_border_color = "#38bdf8".to_string();
    t.primary_text_color = "#f8fafc".to_string();
    t.secondary_color = "#0f172a".to_string();
    t.tertiary_color = "#334155".to_string();
    t.line_color = "#94a3b8".to_string();
    t.edge_label_background = "#0f172a".to_string();
    t.cluster_background = "#0f172a".to_string();
    t.cluster_border = "#334155".to_string();
    t.font_family = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif".to_string();
    t
}

fn decode_entities(s: &str) -> String {
    s.replace("&quot;", "\"")
        .replace("&#34;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
}

fn strip_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out
}

fn extract_mermaid_source(figure_html: &str) -> Option<String> {
    let mut lines = Vec::new();
    let mut search = figure_html;
    let code_div = r#"<div class="code">"#;
    while let Some(start) = search.find(code_div) {
        let after = &search[start + code_div.len()..];
        if let Some(end) = after.find("</div></div>") {
            lines.push(decode_entities(&strip_tags(&after[..end])));
            search = &after[end + "</div></div>".len()..];
        } else {
            break;
        }
    }
    let raw = if !lines.is_empty() {
        lines.join("\n")
    } else {
        let code_start = figure_html.find("<code")?;
        let gt = figure_html[code_start..].find('>')? + code_start + 1;
        let code_end = figure_html[gt..].find("</code>")? + gt;
        decode_entities(&strip_tags(&figure_html[gt..code_end]))
    };

    let mut body = raw.trim();
    if let Some(after_fm) = body.strip_prefix("---") {
        if let Some(end_fm) = after_fm.find("---") {
            body = after_fm[end_fm + 3..].trim();
        }
    }
    if let Some(after_init) = body.strip_prefix("%%{") {
        if let Some(end_init) = after_init.find("}%%") {
            body = after_init[end_init + 3..].trim();
        }
    }

    let first_word = body.split(|c: char| c.is_whitespace() || c == '{' || c == ':').next().unwrap_or("");
    if MERMAID_KEYWORDS.contains(&first_word) {
        Some(raw.trim().to_string())
    } else {
        None
    }
}

fn render_dual_svg(source: &str) -> String {
    let light_opts = RenderOptions { theme: starlight_light_theme(), ..RenderOptions::default() };
    let dark_opts = RenderOptions { theme: starlight_dark_theme(), ..RenderOptions::default() };
    let light_svg = render_with_options(source, light_opts)
        .unwrap_or_else(|e| format!(r#"<pre class="mermaid-error">{e}</pre>"#));
    let dark_svg = render_with_options(source, dark_opts)
        .unwrap_or_else(|e| format!(r#"<pre class="mermaid-error">{e}</pre>"#));
    format!(
        r#"<figure class="sl-static-diagram"><span class="sl-mermaid-light">{light_svg}</span><span class="sl-mermaid-dark">{dark_svg}</span></figure>"#
    )
}

pub fn run_mermaid_mutator(dist_dir: &Path) -> usize {
    let files = collect_html_files(dist_dir);
    let rendered_count = AtomicUsize::new(0);
    let marker = r#"<div class="expressive-code">"#;
    let end_marker = "</figure></div>";

    files.par_iter().for_each(|file| {
        let Ok(html) = fs::read_to_string(file) else { return };
        if !html.contains("expressive-code") {
            return;
        }
        let mut out = String::with_capacity(html.len());
        let mut cursor = 0usize;
        let mut modified = false;

        while let Some(rel_start) = html[cursor..].find(marker) {
            let start = cursor + rel_start;
            let Some(rel_end) = html[start..].find(end_marker) else { break };
            let end = start + rel_end + end_marker.len();
            let block = &html[start..end];
            if let Some(src) = extract_mermaid_source(block) {
                out.push_str(&html[cursor..start]);
                out.push_str(&render_dual_svg(&src));
                rendered_count.fetch_add(1, Ordering::Relaxed);
                modified = true;
                cursor = end;
            } else {
                out.push_str(&html[cursor..end]);
                cursor = end;
            }
        }
        if modified {
            out.push_str(&html[cursor..]);
            let _ = fs::write(file, out);
        }
    });

    rendered_count.load(Ordering::Relaxed)
}
