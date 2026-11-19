use std::fs;
use std::process::Command;

#[test]
fn cli_full_pipeline_success_and_strict_failure() {
    let tmp = std::env::temp_dir().join(format!("dp-int-{}", std::process::id()));
    let _ = fs::remove_dir_all(&tmp);
    let docs = tmp.join("src/content/docs");
    let dist = tmp.join("dist");
    fs::create_dir_all(docs.join("guides")).unwrap();
    fs::create_dir_all(docs.join("fr/guides")).unwrap();
    fs::create_dir_all(docs.join("reference")).unwrap();
    fs::create_dir_all(dist.join("guides/start")).unwrap();
    fs::create_dir_all(dist.join("reference/api")).unwrap();

    fs::write(docs.join("index.mdx"), "---\ntitle: Home\ndescription: Complete overview of the documentation toolkit.\n---\nWelcome.").unwrap();
    fs::write(docs.join("guides/start.mdx"), "---\ntitle: Start Guide\ndescription: Learn how to configure and run the documentation toolkit.\n---\n## Step 1\n\nUse `TokenStream` in your macro.\n\n```rust\nfn main() {}\n```").unwrap();
    fs::write(docs.join("fr/guides/start.mdx"), "---\ntitle: Guide Démarrage\ndescription: Apprenez à configurer et exécuter la boîte à outils.\n---\n## Étape 1\n\nUtilisez `TokenStream` dans votre macro.\n\n```rust\nfn main() {}\n```").unwrap();
    fs::write(docs.join("reference/api.md"), "---\ntitle: TokenStream\ndescription: Reference API for TokenStream procedural macro input.\n---\n| Method | Desc |\n| --- | --- |\n| parse | Parse tokens |").unwrap();

    fs::write(dist.join("guides/start/index.html"), r#"<html><head><title>Start Guide</title></head><body><main><h1>Start Guide</h1><div class="sl-markdown-content"><p>Learn how TokenStream parses input tokens cleanly.</p><pre><code>let s = TokenStream::new();</code></pre><div class="expressive-code"><figure><pre><code>flowchart TD
  A-->B</code></pre></figure></div></div></main></body></html>"#).unwrap();
    fs::write(dist.join("reference/api/index.html"), r#"<html><head><title>TokenStream</title></head><body><main><h1>TokenStream</h1><div class="sl-markdown-content"><p>Reference documentation for TokenStream type.</p></div></main></body></html>"#).unwrap();

    let cfg_path = tmp.join("pipeline.json");
    let cfg = serde_json::json!({
        "siteRoot": tmp,
        "distDir": dist,
        "defaultLocale": "en",
        "locales": ["en", "fr"],
        "mermaid": true,
        "linkPreview": true,
        "codeSymbols": { "maxLinksPerBlock": 4 },
        "glossary": { "strict": false },
        "relatedPages": { "maxRelated": 2 },
        "i18nParity": { "strict": false },
        "diataxisLint": { "strict": false },
        "llms": { "title": "Test Docs", "description": "Docs desc", "url": "https://example.com", "outputs": {} }
    });
    fs::write(&cfg_path, cfg.to_string()).unwrap();

    let bin = env!("CARGO_BIN_EXE_docs-pipeline-rs");
    let out = Command::new(bin).arg(&cfg_path).output().unwrap();
    assert!(
        out.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(v["mermaidRendered"], 1);
    assert_eq!(v["linkPreviewsIndexed"], 2);
    assert_eq!(v["codeSymbolsIndexed"], 1);
    assert_eq!(v["codeSymbolLinks"], 1);
    assert!(dist.join("llms.txt").exists());
    assert!(dist.join("_link-previews.json").exists());
    assert!(dist.join("related-pages.json").exists());

    let strict_cfg = serde_json::json!({
        "siteRoot": tmp,
        "distDir": dist,
        "defaultLocale": "en",
        "locales": ["en", "fr"],
        "i18nParity": { "strict": true },
        "diataxisLint": { "strict": true }
    });
    fs::write(&cfg_path, strict_cfg.to_string()).unwrap();
    let fail_out = Command::new(bin).arg(&cfg_path).output().unwrap();
    assert!(!fail_out.status.success());
    let _ = fs::remove_dir_all(&tmp);
}

#[test]
fn concept_trail_injects_prerequisite_links() {
    let root = std::env::temp_dir().join(format!("dt-ct-test-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).unwrap();
    let dist = root.join("dist");
    fs::create_dir_all(root.join("src/content/docs/explanation")).unwrap();
    fs::create_dir_all(root.join("src/content/docs/reference")).unwrap();
    fs::create_dir_all(dist.join("explanation/rendering-model")).unwrap();
    fs::create_dir_all(dist.join("reference/style")).unwrap();

    fs::write(
        root.join("src/content/glossary.yml"),
        "- term: canonical order\n  definition: Deterministic ordering of ANSI SGR parameters emitted by styles.\n  href: /explanation/rendering-model/\n  locale: en\n",
    ).unwrap();
    fs::write(
        root.join("src/content/docs/explanation/rendering-model.mdx"),
        "---\ntitle: Rendering model\ndescription: How styles emit ANSI codes in canonical order.\n---\n\nStyles emit ANSI codes in canonical order.\n",
    ).unwrap();
    fs::write(
        root.join("src/content/docs/reference/style.mdx"),
        "---\ntitle: Style\ndescription: Reference for Style type and canonical order rendering.\n---\n\nAttributes are emitted in canonical order.\n",
    ).unwrap();
    fs::write(
        dist.join("explanation/rendering-model/index.html"),
        "<!doctype html><html><body><main><h1>Rendering model</h1><div class=\"sl-markdown-content\"><p>Styles emit ANSI codes in canonical order.</p></div></main></body></html>",
    ).unwrap();
    fs::write(
        dist.join("reference/style/index.html"),
        "<!doctype html><html><body><main><h1>Style</h1><div class=\"sl-markdown-content\"><p>Attributes are emitted in canonical order across runs.</p></div></main></body></html>",
    ).unwrap();

    let cfg = root.join("pipeline.json");
    fs::write(
        &cfg,
        serde_json::json!({
            "siteRoot": root,
            "distDir": dist,
            "defaultLocale": "en",
            "locales": ["en"],
            "conceptTrail": true,
            "glossary": { "strict": false }
        })
        .to_string(),
    )
    .unwrap();

    let out = std::process::Command::new(env!("CARGO_BIN_EXE_docs-pipeline-rs"))
        .arg(&cfg)
        .output()
        .unwrap();
    assert!(
        out.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let json: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(json["conceptTrailPages"], 1, "report: {json}");
    assert_eq!(json["conceptTrailLinks"], 1, "report: {json}");
    let ref_html = fs::read_to_string(dist.join("reference/style/index.html")).unwrap();
    assert!(
        ref_html.contains("dt-concept-trail"),
        "missing trail in {ref_html}"
    );
    let _ = fs::remove_dir_all(&root);
}
