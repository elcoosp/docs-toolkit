use crate::host::html_dom::PageDom;
use crate::plugins::glossary::GlossaryEntry;
use lol_html::{RewriteStrSettings, element, html_content::ContentType, rewrite_str};
use rayon::prelude::*;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ConceptTrailLabels {
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub aria_label: String,
}

#[derive(Debug, Default)]
pub struct ConceptTrailReport {
    pub pages_enriched: usize,
    pub links_injected: usize,
}

const NOISE_TERMS: &[&str] = &[
    "overview",
    "summary",
    "introduction",
    "conclusion",
    "usage",
    "example",
    "examples",
    "install",
    "installation",
    "setup",
    "configuration",
    "config",
    "options",
    "types",
    "api",
    "reference",
    "guide",
    "guides",
    "tutorial",
    "tutorials",
    "explanation",
    "features",
    "performance",
    "design",
    "architecture",
    "safety",
    "errors",
    "testing",
    "vue d'ensemble",
    "vue d’ensemble",
    "résumé",
    "utilisation",
    "exemple",
    "exemples",
    "référence",
    "fonctionnalités",
];

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn count_term_occurrences(hay: &str, needle: &str) -> (usize, Option<usize>) {
    if needle.is_empty() {
        return (0, None);
    }
    let (mut count, mut first_pos, mut start) = (0usize, None, 0usize);
    while let Some(pos) = hay[start..].find(needle) {
        let abs = start + pos;
        let mut end = abs + needle.len();
        if hay[end..].starts_with('s') {
            end += 1;
        }
        let b_ok = hay[..abs]
            .chars()
            .next_back()
            .map(|c| !c.is_alphanumeric() && c != '_')
            .unwrap_or(true);
        let a_ok = hay[end..]
            .chars()
            .next()
            .map(|c| !c.is_alphanumeric() && c != '_')
            .unwrap_or(true);
        if b_ok && a_ok {
            count += 1;
            if first_pos.is_none() {
                first_pos = Some(abs);
            }
        }
        start = abs + needle.chars().next().map(char::len_utf8).unwrap_or(1);
    }
    (count, first_pos)
}

fn norm_loc<'a>(loc: &'a str, default_locale: &'a str) -> &'a str {
    if loc == "root" {
        if default_locale == "root" {
            "en"
        } else {
            default_locale
        }
    } else {
        loc
    }
}

fn strip_loc<'a>(route: &'a str, locale: &str, default_locale: &str) -> &'a str {
    let t = route.trim_matches('/');
    let def = if default_locale == "root" {
        "en"
    } else {
        default_locale
    };
    let l = norm_loc(locale, default_locale);
    if l != def {
        t.strip_prefix(l)
            .map(|s| s.trim_start_matches('/'))
            .unwrap_or("")
    } else {
        t
    }
}

fn is_eligible_doc_route(route: &str, locale: &str, default_locale: &str) -> bool {
    let rel = strip_loc(route, locale, default_locale);
    !rel.is_empty()
        && rel != "404"
        && !rel.starts_with("zen-mode/")
        && !rel.starts_with("blog")
        && !rel.starts_with("changelog")
}

fn is_foundational_target(href: &str, locale: &str, default_locale: &str) -> bool {
    let base = href.split('#').next().unwrap_or("");
    let rel = strip_loc(base, locale, default_locale);
    !rel.is_empty()
        && !rel.starts_with("reference/")
        && !rel.starts_with("blog")
        && !rel.starts_with("changelog")
}

fn is_high_signal_term(term: &str) -> bool {
    let t = term.trim();
    if NOISE_TERMS.contains(&t.to_lowercase().as_str()) {
        return false;
    }
    let chars = t.chars().count();
    let upper_cnt = t.chars().filter(|c| c.is_uppercase()).count();
    let code_shape = t.contains('_')
        || t.contains("::")
        || t.chars().any(|c| c.is_ascii_digit())
        || upper_cnt >= 2;
    chars >= 5 || (chars >= 3 && code_shape)
}

fn render_trail_html(items: &[&GlossaryEntry], label: &str, aria: &str) -> String {
    let links: Vec<String> = items
        .iter()
        .map(|it| {
            let tip = if it.definition.is_empty() {
                &it.term
            } else {
                &it.definition
            };
            format!(
                r#"<a class="dt-ct-link" href="{}" title="{}">{}</a>"#,
                escape_html(&it.href),
                escape_html(tip),
                escape_html(&it.term)
            )
        })
        .collect();
    format!(
        r#"<nav class="dt-concept-trail" aria-label="{}" data-pagefind-ignore="all"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg><span class="dt-ct-label">{}</span><span class="dt-ct-items">{}</span></nav>"#,
        escape_html(aria),
        escape_html(label),
        links.join(r#"<span class="dt-ct-sep" aria-hidden="true">·</span>"#)
    )
}

pub fn run_concept_trail(
    dist_dir: &Path,
    pages: &[PageDom],
    entries: &[GlossaryEntry],
    default_locale: &str,
    i18n: &HashMap<String, ConceptTrailLabels>,
) -> ConceptTrailReport {
    if entries.is_empty() {
        return ConceptTrailReport::default();
    }
    let eligible: Vec<&PageDom> = pages
        .iter()
        .filter(|p| {
            p.rel_path.ends_with("index.html")
                && is_eligible_doc_route(&p.route, &p.locale, default_locale)
        })
        .collect();
    let mut loc_counts: HashMap<&str, usize> = HashMap::new();
    let mut by_loc: HashMap<&str, Vec<&GlossaryEntry>> = HashMap::new();
    for p in &eligible {
        *loc_counts
            .entry(norm_loc(&p.locale, default_locale))
            .or_insert(0) += 1;
    }
    for e in entries {
        if is_foundational_target(&e.href, &e.locale, default_locale)
            && is_high_signal_term(&e.term)
            && e.definition.chars().count() >= 24
        {
            by_loc
                .entry(norm_loc(&e.locale, default_locale))
                .or_default()
                .push(e);
        }
    }
    let mut doc_freq: HashMap<String, usize> = HashMap::new();
    for p in &eligible {
        let p_loc = norm_loc(&p.locale, default_locale);
        if let Some(cands) = by_loc.get(p_loc) {
            let hay = p.concept_text.to_lowercase();
            for e in cands {
                if count_term_occurrences(&hay, &e.term.to_lowercase()).0 > 0 {
                    *doc_freq
                        .entry(format!("{}:{}", p_loc, e.term.to_lowercase()))
                        .or_insert(0) += 1;
                }
            }
        }
    }
    let (pages_enriched, links_injected) = (AtomicUsize::new(0), AtomicUsize::new(0));
    eligible.par_iter().for_each(|page| {
        let p_loc = norm_loc(&page.locale, default_locale);
        let Some(cands) = by_loc.get(p_loc) else {
            return;
        };
        let total = loc_counts.get(p_loc).copied().unwrap_or(0);
        let hay = page.concept_text.to_lowercase();
        let (mut hits, mut seen) = (Vec::new(), HashSet::new());
        for e in cands {
            let base = e.href.split('#').next().unwrap_or("");
            if base.is_empty() || base == page.route || !seen.insert(base) {
                continue;
            }
            let freq = doc_freq
                .get(&format!("{}:{}", p_loc, e.term.to_lowercase()))
                .copied()
                .unwrap_or(0);
            if total >= 6 && (freq as f64) / (total as f64) > 0.65 {
                continue;
            }
            if let (cnt, Some(pos)) = count_term_occurrences(&hay, &e.term.to_lowercase())
                && cnt >= 1
            {
                hits.push((cnt * 10 + usize::from(pos <= 800) * 5, pos, *e));
            }
        }
        if hits.is_empty() {
            return;
        }
        hits.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
        hits.truncate(3);
        let sel: Vec<&GlossaryEntry> = hits.into_iter().map(|(_, _, e)| e).collect();
        let html_path = dist_dir.join(&page.rel_path);
        let Ok(html) = fs::read_to_string(&html_path) else {
            return;
        };
        if html.contains("dt-concept-trail") {
            return;
        }
        let ent = i18n
            .get(p_loc)
            .or_else(|| i18n.get(&page.locale))
            .or_else(|| i18n.get(default_locale))
            .or_else(|| i18n.get("en"));
        let lbl = ent
            .map(|x| x.label.as_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("Builds on");
        let aria = ent
            .map(|x| x.aria_label.as_str())
            .filter(|s| !s.is_empty())
            .unwrap_or("Prerequisite concepts");
        let snip = render_trail_html(&sel, lbl, aria);
        let mut done = false;
        let rw = rewrite_str(
            &html,
            RewriteStrSettings::new().append_element_content_handler(element!(
                ".sl-markdown-content",
                |el| {
                    if !done {
                        el.prepend(&snip, ContentType::Html);
                        done = true;
                    }
                    Ok(())
                }
            )),
        );
        if let Err(ref err) = rw {
            eprintln!("RW_ERR: {err:?}");
        }
        if let Ok(next) = rw
            && done
            && fs::write(&html_path, next).is_ok()
        {
            pages_enriched.fetch_add(1, Ordering::Relaxed);
            links_injected.fetch_add(sel.len(), Ordering::Relaxed);
        }
    });
    ConceptTrailReport {
        pages_enriched: pages_enriched.load(Ordering::Relaxed),
        links_injected: links_injected.load(Ordering::Relaxed),
    }
}
