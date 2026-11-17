use std::collections::{HashMap, VecDeque};
use std::io::{self, Read};

#[derive(Clone, Debug)]
struct Node {
    title: String,
    subtitle: Option<String>,
    cylindrical: bool,
    layer: usize,
    order: usize,
    w: f64,
    h: f64,
    x: f64,
    y: f64,
}

#[derive(Clone, Debug)]
struct Edge {
    from: usize,
    to: usize,
    label: Option<String>,
    dashed: bool,
}

fn decode_entities(s: &str) -> String {
    s.replace("&rarr;", "→")
        .replace("&larr;", "←")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
}

fn escape_xml(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 8);
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(c),
        }
    }
    out
}

fn strip_tags(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        if c == '<' { in_tag = true; continue; }
        if c == '>' { in_tag = false; continue; }
        if !in_tag { out.push(c); }
    }
    decode_entities(out.trim())
}

fn split_label(raw: &str) -> (String, Option<String>) {
    let clean = raw.trim().trim_matches('"').trim();
    let normalized = clean
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("<br>", "\n");
    let lines: Vec<String> = normalized
        .split('\n')
        .map(strip_tags)
        .filter(|l| !l.is_empty())
        .collect();
    if lines.is_empty() {
        return (String::new(), None);
    }
    if lines.len() == 1 {
        return (lines[0].clone(), None);
    }
    let title = lines[0].clone();
    let sub = lines[1..].join(" · ");
    (title, Some(sub))
}

fn parse_node_token(tok: &str) -> (String, Option<(String, Option<String>, bool)>) {
    let t = tok.trim();
    if let Some(idx) = t.find("[(") {
        if t.ends_with(")]") && idx + 2 <= t.len() - 2 {
            let id = t[..idx].trim().to_string();
            let (title, sub) = split_label(&t[idx + 2..t.len() - 2]);
            return (id, Some((title, sub, true)));
        }
    }
    if let Some(idx) = t.find('[') {
        if t.ends_with(']') && idx + 1 <= t.len() - 1 {
            let id = t[..idx].trim().to_string();
            let (title, sub) = split_label(&t[idx + 1..t.len() - 1]);
            return (id, Some((title, sub, false)));
        }
    }
    if let Some(idx) = t.find('(') {
        if t.ends_with(')') && idx + 1 <= t.len() - 1 {
            let id = t[..idx].trim().to_string();
            let (title, sub) = split_label(&t[idx + 1..t.len() - 1]);
            return (id, Some((title, sub, false)));
        }
    }
    (t.to_string(), None)
}

fn get_or_insert_node(nodes: &mut Vec<Node>, map: &mut HashMap<String, usize>, raw: &str) -> usize {
    let (id, label_opt) = parse_node_token(raw);
    if let Some(&idx) = map.get(&id) {
        if let Some((title, sub, cyl)) = label_opt {
            nodes[idx].title = title;
            nodes[idx].subtitle = sub;
            nodes[idx].cylindrical = cyl;
        }
        return idx;
    }
    let idx = nodes.len();
    let (title, subtitle, cylindrical) = label_opt.unwrap_or_else(|| (id.clone(), None, false));
    nodes.push(Node {
        title,
        subtitle,
        cylindrical,
        layer: 0,
        order: idx,
        w: 160.0,
        h: 52.0,
        x: 0.0,
        y: 0.0,
    });
    map.insert(id, idx);
    idx
}

fn parse_edge_line(line: &str) -> Vec<(String, Option<String>, bool)> {
    let mut hops: Vec<(String, Option<String>, bool)> = Vec::new();
    let mut rest = line.trim();
    let mut pending_label: Option<String> = None;
    let mut pending_dashed = false;

    loop {
        let mut best: Option<(usize, usize, Option<String>, bool)> = None;
        let mut scan = 0usize;
        let mut in_quotes = false;
        let mut bracket_depth = 0i32;
        let bytes = rest.as_bytes();
        while scan < bytes.len() {
            let b = bytes[scan];
            if b == b'"' { in_quotes = !in_quotes; scan += 1; continue; }
            if in_quotes { scan += 1; continue; }
            if b == b'[' || b == b'(' { bracket_depth += 1; scan += 1; continue; }
            if b == b']' || b == b')' { bracket_depth -= 1; scan += 1; continue; }
            if bracket_depth == 0 {
                let sub = &rest[scan..];
                if sub.starts_with("-.->") {
                    let after = &sub[4..];
                    if let Some(after_pipe) = after.strip_prefix('|') {
                        if let Some(end_pipe) = after_pipe.find('|') {
                            let lbl = decode_entities(after_pipe[..end_pipe].trim().trim_matches('"'));
                            best = Some((scan, 4 + 1 + end_pipe + 1, Some(lbl), true));
                            break;
                        }
                    }
                    best = Some((scan, 4, None, true));
                    break;
                }
                if sub.starts_with("-->") {
                    let after = &sub[3..];
                    if let Some(after_pipe) = after.strip_prefix('|') {
                        if let Some(end_pipe) = after_pipe.find('|') {
                            let lbl = decode_entities(after_pipe[..end_pipe].trim().trim_matches('"'));
                            best = Some((scan, 3 + 1 + end_pipe + 1, Some(lbl), false));
                            break;
                        }
                    }
                    best = Some((scan, 3, None, false));
                    break;
                }
                if sub.starts_with("-- ") {
                    if let Some(arrow_pos) = sub[3..].find("-->") {
                        let lbl = decode_entities(sub[3..3 + arrow_pos].trim().trim_matches('"'));
                        best = Some((scan, 3 + arrow_pos + 3, Some(lbl), false));
                        break;
                    }
                }
            }
            scan += 1;
        }

        if let Some((pos, len, lbl, dashed)) = best {
            let left = rest[..pos].trim().to_string();
            hops.push((left, pending_label.take(), pending_dashed));
            pending_label = lbl;
            pending_dashed = dashed;
            rest = rest[pos + len..].trim();
        } else {
            if !rest.is_empty() {
                hops.push((rest.to_string(), pending_label.take(), pending_dashed));
            }
            break;
        }
    }
    hops
}

fn render_flowchart(src: &str) -> String {
    let mut is_lr = false;
    let mut nodes: Vec<Node> = Vec::new();
    let mut map: HashMap<String, usize> = HashMap::new();
    let mut edges: Vec<Edge> = Vec::new();

    for raw_line in src.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with("%%") {
            continue;
        }
        if line.starts_with("flowchart") || line.starts_with("graph") {
            if line.contains("LR") || line.contains("RL") {
                is_lr = true;
            }
            continue;
        }
        if line.contains("-->") || line.contains("-.->") {
            let hops = parse_edge_line(line);
            for win in hops.windows(2) {
                let left_group: Vec<usize> = win[0].0.split('&')
                    .map(|p| get_or_insert_node(&mut nodes, &mut map, p))
                    .collect();
                let right_group: Vec<usize> = win[1].0.split('&')
                    .map(|p| get_or_insert_node(&mut nodes, &mut map, p))
                    .collect();
                let lbl = win[1].1.clone();
                let dashed = win[1].2;
                for &u in &left_group {
                    for &v in &right_group {
                        edges.push(Edge { from: u, to: v, label: lbl.clone(), dashed });
                    }
                }
            }
        } else {
            let _ = get_or_insert_node(&mut nodes, &mut map, line);
        }
    }

    if nodes.is_empty() {
        return String::new();
    }

    for n in &mut nodes {
        let t_chars = n.title.chars().count() as f64;
        let s_chars = n.subtitle.as_ref().map(|s| s.chars().count() as f64).unwrap_or(0.0);
        let max_c = t_chars.max(s_chars * 0.88);
        n.w = (max_c * 7.8 + 34.0).clamp(132.0, 290.0);
        n.h = if n.subtitle.is_some() { 46.0 } else { 36.0 };
    }

    let n_count = nodes.len();
    let mut indeg = vec![0usize; n_count];
    let mut adj = vec![Vec::new(); n_count];
    for e in &edges {
        if e.from != e.to {
            adj[e.from].push(e.to);
            indeg[e.to] += 1;
        }
    }
    let mut q = VecDeque::new();
    for (i, &d) in indeg.iter().enumerate() {
        if d == 0 { q.push_back(i); }
    }
    let mut visited = 0usize;
    while let Some(u) = q.pop_front() {
        visited += 1;
        let next_layer = nodes[u].layer + 1;
        for &v in &adj[u] {
            if next_layer > nodes[v].layer {
                nodes[v].layer = next_layer;
            }
            indeg[v] -= 1;
            if indeg[v] == 0 {
                q.push_back(v);
            }
        }
    }
    if visited < n_count {
        for (i, n) in nodes.iter_mut().enumerate() {
            if n.layer == 0 { n.layer = i / 2; }
        }
    }

    let max_layer = nodes.iter().map(|n| n.layer).max().unwrap_or(0);
    let mut layers: Vec<Vec<usize>> = vec![Vec::new(); max_layer + 1];
    for (i, n) in nodes.iter().enumerate() {
        layers[n.layer].push(i);
    }
    for l in 1..=max_layer {
        let prev = &layers[l - 1];
        let mut pos_map = HashMap::new();
        for (pos, &idx) in prev.iter().enumerate() {
            pos_map.insert(idx, pos as f64);
        }
        layers[l].sort_by(|&a, &b| {
            let bary = |node_idx: usize| -> f64 {
                let preds: Vec<f64> = edges.iter()
                    .filter(|e| e.to == node_idx)
                    .filter_map(|e| pos_map.get(&e.from).copied())
                    .collect();
                if preds.is_empty() { nodes[node_idx].order as f64 } else { preds.iter().sum::<f64>() / (preds.len() as f64) }
            };
            bary(a).partial_cmp(&bary(b)).unwrap_or(std::cmp::Ordering::Equal)
        });
    }

    let pad: f64 = 16.0;
    let gap_main = if is_lr { 64.0 } else { 36.0 };
    let gap_cross = if is_lr { 20.0 } else { 22.0 };
    let (total_w, total_h) = if is_lr {
        let mut cur_x = pad;
        let mut max_col_h = 0.0f64;
        for group in &layers {
            let col_w = group.iter().map(|&i| nodes[i].w).fold(0.0f64, f64::max);
            let col_h: f64 = group.iter().map(|&i| nodes[i].h).sum::<f64>() + gap_cross * ((group.len().saturating_sub(1)) as f64);
            if col_h > max_col_h { max_col_h = col_h; }
            cur_x += col_w + gap_main;
        }
        let w = (cur_x - gap_main + pad).max(320.0);
        let h = (max_col_h + pad * 2.0).max(140.0);
        let mut x = pad;
        for group in &layers {
            let col_w = group.iter().map(|&i| nodes[i].w).fold(0.0f64, f64::max);
            let col_h: f64 = group.iter().map(|&i| nodes[i].h).sum::<f64>() + gap_cross * ((group.len().saturating_sub(1)) as f64);
            let mut y = (h - col_h) * 0.5;
            for &i in group {
                nodes[i].x = x + (col_w - nodes[i].w) * 0.5;
                nodes[i].y = y;
                y += nodes[i].h + gap_cross;
            }
            x += col_w + gap_main;
        }
        (w, h)
    } else {
        let mut cur_y = pad;
        let mut max_row_w = 0.0f64;
        for group in &layers {
            let row_h = group.iter().map(|&i| nodes[i].h).fold(0.0f64, f64::max);
            let row_w: f64 = group.iter().map(|&i| nodes[i].w).sum::<f64>() + gap_cross * ((group.len().saturating_sub(1)) as f64);
            if row_w > max_row_w { max_row_w = row_w; }
            cur_y += row_h + gap_main;
        }
        let w = (max_row_w + pad * 2.0).max(320.0);
        let h = (cur_y - gap_main + pad).max(160.0);
        let mut y = pad;
        for group in &layers {
            let row_h = group.iter().map(|&i| nodes[i].h).fold(0.0f64, f64::max);
            let row_w: f64 = group.iter().map(|&i| nodes[i].w).sum::<f64>() + gap_cross * ((group.len().saturating_sub(1)) as f64);
            let mut x = (w - row_w) * 0.5;
            for &i in group {
                nodes[i].x = x;
                nodes[i].y = y + (row_h - nodes[i].h) * 0.5;
                x += nodes[i].w + gap_cross;
            }
            y += row_h + gap_main;
        }
        (w, h)
    };

    let mut out = String::with_capacity(4096);
    out.push_str(&format!(
        r#"<figure class="sl-static-diagram"><svg viewBox="0 0 {:.0} {:.0}" width="{:.0}" height="{:.0}" role="img" aria-label="Architecture diagram" xmlns="http://w3.org">"#,
        total_w, total_h, total_w, total_h
    ));
    out.push_str(r#"<defs><marker id="sl-arr" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M 1 1.5 L 9 5 L 1 8.5 z" fill="var(--sl-color-gray-3, #64748b)"/></marker></defs>"#);

    for e in &edges {
        let a = &nodes[e.from];
        let b = &nodes[e.to];
        let (x1, y1, x2, y2, path_d) = if is_lr {
            let sx = a.x + a.w;
            let sy = a.y + a.h * 0.5;
            let tx = b.x;
            let ty = b.y + b.h * 0.5;
            let mx = (sx + tx) * 0.5;
            (sx, sy, tx, ty, format!("M {:.1} {:.1} C {:.1} {:.1}, {:.1} {:.1}, {:.1} {:.1}", sx, sy, mx, sy, mx, ty, tx, ty))
        } else {
            let sx = a.x + a.w * 0.5;
            let sy = a.y + a.h;
            let tx = b.x + b.w * 0.5;
            let ty = b.y;
            let my = (sy + ty) * 0.5;
            (sx, sy, tx, ty, format!("M {:.1} {:.1} C {:.1} {:.1}, {:.1} {:.1}, {:.1} {:.1}", sx, sy, sx, my, tx, my, tx, ty))
        };
        let dash = if e.dashed { r#" stroke-dasharray="5 4""# } else { "" };
        out.push_str(&format!(
            r#"<path d="{}" fill="none" stroke="var(--sl-color-gray-3, #64748b)" stroke-width="1.5"{} marker-end="url(#sl-arr)"/>"#,
            path_d, dash
        ));
        if let Some(ref lbl) = e.label {
            let lx = (x1 + x2) * 0.5;
            let ly = (y1 + y2) * 0.5;
            let lw = (lbl.chars().count() as f64) * 6.4 + 12.0;
            out.push_str(&format!(
                r#"<rect x="{:.1}" y="{:.1}" width="{:.1}" height="18" rx="4" fill="var(--sl-color-bg, #0f172a)" stroke="var(--sl-color-hairline, #334155)" stroke-width="1"/>"#,
                lx - lw * 0.5, ly - 9.0, lw
            ));
            out.push_str(&format!(
                r#"<text x="{:.1}" y="{:.1}" text-anchor="middle" dominant-baseline="central" font-family="var(--sl-font, system-ui, sans-serif)" font-size="10.5" fill="var(--sl-color-gray-2, #cbd5e1)">{}</text>"#,
                lx, ly, escape_xml(lbl)
            ));
        }
    }

    for n in &nodes {
        let rx = if n.cylindrical { 16.0 } else { 8.0 };
        out.push_str(&format!(
            r#"<rect x="{:.1}" y="{:.1}" width="{:.1}" height="{:.1}" rx="{:.1}" fill="var(--sl-color-bg-nav, #1e293b)" stroke="var(--sl-color-accent, #38bdf8)" stroke-width="1.5"/>"#,
            n.x, n.y, n.w, n.h, rx
        ));
        let cx = n.x + n.w * 0.5;
        if let Some(ref sub) = n.subtitle {
            out.push_str(&format!(
                r#"<text x="{:.1}" y="{:.1}" text-anchor="middle" dominant-baseline="central" font-family="var(--sl-font, system-ui, sans-serif)" font-size="12.5" font-weight="600" fill="var(--sl-color-text, #f8fafc)">{}</text>"#,
                cx, n.y + n.h * 0.36, escape_xml(&n.title)
            ));
            out.push_str(&format!(
                r#"<text x="{:.1}" y="{:.1}" text-anchor="middle" dominant-baseline="central" font-family="var(--sl-font, system-ui, sans-serif)" font-size="10.5" font-style="italic" fill="var(--sl-color-gray-2, #94a3b8)">{}</text>"#,
                cx, n.y + n.h * 0.69, escape_xml(sub)
            ));
        } else {
            out.push_str(&format!(
                r#"<text x="{:.1}" y="{:.1}" text-anchor="middle" dominant-baseline="central" font-family="var(--sl-font, system-ui, sans-serif)" font-size="12.5" font-weight="600" fill="var(--sl-color-text, #f8fafc)">{}</text>"#,
                cx, n.y + n.h * 0.5, escape_xml(&n.title)
            ));
        }
    }

    out.push_str("</svg></figure>");
    out
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap_or(0);
    let blocks: Vec<&str> = input.split("\n===MERMAID_SEP===\n").collect();
    let svgs: Vec<String> = blocks.iter().map(|b| render_flowchart(b)).collect();
    print!("{}", svgs.join("\n===MERMAID_SEP===\n"));
}
