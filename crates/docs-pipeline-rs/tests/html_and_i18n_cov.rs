use std::fs;
use std::process::Command;

#[test]
fn covers_html_meta_headings_and_i18n_drift_branches() {
    let tmp = std::env::temp_dir().join(format!("dp-cov4-{}", std::process::id()));
    let _ = fs::remove_dir_all(&tmp);
    let docs = tmp.join("src/content/docs");
    let dist = tmp.join("dist");
    for d in ["guides", "guides/drift", "fr/guides", "reference"] {
        fs::create_dir_all(docs.join(d)).unwrap();
        fs::create_dir_all(dist.join(d)).unwrap();
    }
    let same_para = "This long English paragraph has more than sixty alphabetic letters so that untranslated prose detection triggers immediately during audit.";
    fs::write(docs.join("guides/drift.mdx"), format!("---\ntitle: Drift Guide\ndescription: Guide with admonitions, tabs, links and untranslated prose.\n---\n:::note\nNote block\n:::\n<Tabs><TabItem label=\"A\">A</TabItem></Tabs>\nSee [Ref](/reference/only-en/).\n\n{same_para}\n")).unwrap();
    fs::write(docs.join("fr/guides/drift.mdx"), format!("---\ntitle: Guide Dérive\ndescription: Guide français avec dérive d'admonition, onglets et liens.\n---\nSee [Setup](/guides/setup/).\n\n{same_para}\n")).unwrap();
    fs::write(docs.join("reference/only-en.md"), "---\ntitle: Only EN\ndescription: Page missing its French translation counterpart.\n---\n| Col | Val |\n| --- | --- |\n| a | b |").unwrap();

    fs::write(dist.join("guides/drift/index.html"), "<html><head><title>Fallback Title — Site</title><meta name=\"description\" content=\"Explicit meta description value.\"></head><body><main><h2 id=\"sec\">Section Heading #</h2><div class=\"sl-markdown-content\"><p>Body text.</p></div></main></body></html>").unwrap();
    fs::write(dist.join("fr/index.html"), "<html><head><title>Accueil — Site</title></head><body><main><h1>Accueil</h1></main></body></html>").unwrap();

    let cfg_path = tmp.join("cfg.json");
    fs::write(&cfg_path, serde_json::json!({
        "siteRoot": tmp, "distDir": dist, "defaultLocale": "en", "locales": ["en", "fr"],
        "linkPreview": true, "i18nParity": { "strict": false }
    }).to_string()).unwrap();

    let out = Command::new(env!("CARGO_BIN_EXE_docs-pipeline-rs")).arg(&cfg_path).output().unwrap();
    assert!(out.status.success());
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert!(v["warnings"].as_array().unwrap().len() >= 4);
    let _ = fs::remove_dir_all(&tmp);
}
