use std::fs;
use std::process::Command;

#[test]
fn covers_auto_glossary_mdx_components_and_all_sections() {
    let tmp = std::env::temp_dir().join(format!("dp-cov3-{}", std::process::id()));
    let _ = fs::remove_dir_all(&tmp);
    let docs = tmp.join("src/content/docs");
    let dist = tmp.join("dist");
    for d in ["tutorials/intro", "guides/setup", "reference/cli", "explanation/arch", "blog/post", "changelog/v1", "fr/tutorials/intro", "fr/explanation/arch"] {
        fs::create_dir_all(docs.join(d)).unwrap();
        fs::create_dir_all(dist.join(d)).unwrap();
    }
    fs::write(docs.join("index.mdx"), "---\ntitle: Home\ndescription: Overview page.\n---\n<DiataxisGrid items={[{ title: \"Start\", description: \"Begin\", href: \"/tutorials/intro/\" }, { title: \"OnlyTitle\" }]} />\n<LinkCard title=\"Ref\" href=\"/reference/cli/\" description=\"CLI ref\" />\n<LinkButton href=\"/guides/setup/\">Setup</LinkButton>\n<Card title=\"Box\">Card inner</Card>\n<Tabs><TabItem label=\"Mac\">brew install</TabItem></Tabs>").unwrap();
    fs::write(docs.join("explanation/arch/index.md"), "---\ntitle: The Token Stream (AST), explained\ndescription: Architecture of the token stream and AST compiler pipeline in detail.\naliases: [ASTPipeline]\n---\nA **Token Stream** is the fundamental sequence of lexical tokens passed into procedural macros during compilation.\n\n## Semantic Resolution\n\nSemantic resolution binds identifiers across scopes and validates trait bounds before code generation.\n\n- **Hygienic Macro** — A macro expansion rule that prevents accidental variable capture across call sites.\n").unwrap();
    fs::write(docs.join("fr/explanation/arch/index.md"), "---\ntitle: L'arbre syntaxique\ndescription: Architecture complète du pipeline de compilation et des macros.\n---\nUn arbre syntaxique représente la structure hiérarchique du programme compilé.\n").unwrap();
    fs::write(docs.join("tutorials/intro/index.md"), "---\ntitle: First Tutorial\ndescription: Step by step tutorial for Token Stream and Hygienic Macro usage.\n---\n## Step 1\n\nUse Token Stream and Hygienic Macro in your code.\n\n## Step 2\n\n~~~rust\nfn demo() {}\n~~~").unwrap();
    fs::write(docs.join("fr/tutorials/intro/index.md"), "---\ntitle: Premier Tutoriel\ndescription: Tutoriel étape par étape.\n---\n## Étape 1\n\nContenu.\n\n## Étape 2\n\n~~~rust\nfn demo() {}\n~~~").unwrap();
    fs::write(docs.join("guides/setup/index.md"), "---\ntitle: Setup Guide\ndescription: Configure the project.\n---\n| Key | Val |\n| --- | --- |\n| a | b |").unwrap();
    fs::write(docs.join("reference/cli/index.md"), "---\ntitle: CLI Reference\ndescription: Command line flags.\n---\n| Flag | Desc |\n| --- | --- |\n| --help | Help |").unwrap();
    fs::write(docs.join("blog/post/index.md"), "---\ntitle: Release Post\ndescription: Blog post.\n---\nNews.").unwrap();
    fs::write(docs.join("changelog/v1/index.md"), "---\ntitle: v1.0\ndescription: Changelog.\n---\nChanges.").unwrap();

    let long_p = "This paragraph has more than one hundred and eighty characters so that link preview description truncation and fallback paragraph extraction in html_dom are both exercised completely during parsing.";
    for (p, t) in [
        ("explanation/arch/index.html", "The Token Stream (AST) — Docs"),
        ("tutorials/intro/index.html", "First Tutorial — Docs"),
        ("guides/setup/index.html", "Setup Guide — Docs"),
        ("reference/cli/index.html", "CLI Reference — Docs"),
        ("blog/post/index.html", "Release Post — Docs"),
        ("changelog/v1/index.html", "v1.0 — Docs"),
        ("fr/tutorials/intro/index.html", "Premier Tutoriel — Docs"),
    ] {
        fs::write(dist.join(p), format!("<html><head><title>{t}</title></head><body><main><h1>{t}</h1><div class=\"sl-markdown-content\"><p>{long_p}</p><p>Token Stream and Hygienic Macro work together.</p></div></main></body></html>")).unwrap();
    }

    let cfg_path = tmp.join("cfg.json");
    fs::write(&cfg_path, serde_json::json!({
        "siteRoot": tmp, "distDir": dist, "defaultLocale": "en", "locales": ["en", "fr"],
        "linkPreview": true, "glossary": { "strict": false },
        "llms": { "title": "Docs", "description": "Desc", "url": "https://example.com", "exclude": ["**/excluded"], "outputs": {} }
    }).to_string()).unwrap();

    let out = Command::new(env!("CARGO_BIN_EXE_docs-pipeline-rs")).arg(&cfg_path).output().unwrap();
    assert!(out.status.success(), "stderr: {}", String::from_utf8_lossy(&out.stderr));
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert!(v["glossaryIndexed"].as_u64().unwrap() >= 3);
    assert_eq!(v["linkPreviewsIndexed"], 7);
    let _ = fs::remove_dir_all(&tmp);
}
