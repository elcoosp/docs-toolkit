use std::fs;
use std::process::Command;

#[test]
fn covers_plugin_warnings_errors_mdx_and_fallbacks() {
    let tmp = std::env::temp_dir().join(format!("dp-edge-{}", std::process::id()));
    let _ = fs::remove_dir_all(&tmp);
    let docs = tmp.join("src/content/docs");
    let dist = tmp.join("dist");
    for d in ["tutorials", "guides", "guides/how", "reference", "reference/api", "explanation", "changelog/version", "fr/guides", "fr/orphan"] {
        fs::create_dir_all(docs.join(d)).unwrap();
        fs::create_dir_all(dist.join(d)).unwrap();
    }
    fs::write(tmp.join("src/content/glossary.yml"), "- term: \"TokenStream\"\n  definition: \"Stream of lexical tokens parsed by procedural macros.\"\n  href: \"/reference/api/#parse\"\n  locale: \"en\"\n- term: \"BrokenRef\"\n  definition: \"Short\"\n  href: \"/missing-page/\"\n").unwrap();
    fs::write(docs.join("index.mdx"), "---\ntitle: Home\ndescription: >\n  Multi-line YAML overview\n  of the docs site.\n---\n<Aside type=\"tip\" title=\"Note\">Tip body</Aside>\n<Card title=\"CardTitle\" href=\"/guides/how/\" description=\"Desc\" />\n<Badge text=\"NEW\" />").unwrap();
    fs::write(docs.join("tutorials/first.mdx"), "---\ntitle: Tutorial One\ndescription: Short\n---\nOnly one section TODO").unwrap();
    fs::write(docs.join("guides/how.md"), "---\ntitle: Tutorial One\ndescription: Valid description exceeding twenty-four chars.\n---\nPlain prose without code or table.").unwrap();
    fs::write(docs.join("fr/guides/how.md"), "---\ntitle: Guide Pratique\ndescription: Description française valide de plus de vingt-quatre caractères.\n---\n## Section ajoutée\n\nPlain prose without code or table.\n\n```sh\necho drift\n```").unwrap();
    fs::write(docs.join("fr/orphan/extra.md"), "---\ntitle: Orphelin\ndescription: Page orpheline en français pour tester i18n parity.\n---\nContenu.").unwrap();
    fs::write(docs.join("reference/api.md"), "---\ntitle: TokenStream\ndescription: Reference page without signature table or code block.\n---\nProse only.").unwrap();
    fs::write(docs.join("explanation/deep.md"), "---\ntitle: Deep Concept\ndescription: Explanation page under two hundred words threshold.\n---\nThin explanation.").unwrap();
    fs::write(docs.join("guides/no-fm.md"), "Missing frontmatter file").unwrap();

    fs::write(dist.join("guides/how/index.html"), "<html><head><title>How — Site</title></head><body><main><h1>How — Site</h1><div class=\"sl-markdown-content\"><p>TokenStream parses input tokens cleanly in macros.</p><pre><code>let x = TokenStream::from(y);</code></pre></div></main></body></html>").unwrap();
    fs::write(dist.join("reference/api/index.html"), "<html><head><title>TokenStream</title></head><body><main><h1>TokenStream</h1><div class=\"sl-markdown-content\"><p>API reference page.</p></div></main></body></html>").unwrap();
    fs::write(dist.join("changelog/version/index.html"), "<html><body data-pagefind-body><p>v1.0.0</p></body></html>").unwrap();
    fs::write(dist.join("robots.txt"), "User-agent: *\n").unwrap();

    let cfg_path = tmp.join("cfg.json");
    fs::write(&cfg_path, serde_json::json!({
        "siteRoot": tmp, "distDir": dist, "defaultLocale": "en", "locales": ["en", "fr"],
        "mermaid": true, "linkPreview": true, "codeSymbols": { "maxLinksPerBlock": 2 },
        "glossary": { "strict": false }, "relatedPages": { "maxRelated": 2 },
        "i18nParity": { "strict": false }, "diataxisLint": { "strict": false },
        "llms": { "title": "Docs", "description": "Desc", "url": "https://example.com", "source": "https://github.com", "optional": ["explanation/**"], "outputs": {} }
    }).to_string()).unwrap();

    let out = Command::new(env!("CARGO_BIN_EXE_docs-pipeline-rs")).arg(&cfg_path).output().unwrap();
    assert!(!out.status.success());
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert!(!v["errors"].as_array().unwrap().is_empty());
    assert!(!v["warnings"].as_array().unwrap().is_empty());
    assert!(fs::read_to_string(dist.join("changelog/version/index.html")).unwrap().contains("data-pagefind-ignore"));
    assert!(fs::read_to_string(dist.join("robots.txt")).unwrap().contains("LLMs-Txt:"));
    let _ = fs::remove_dir_all(&tmp);
}
