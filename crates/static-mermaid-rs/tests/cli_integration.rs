use std::io::Write;
use std::process::{Command, Stdio};

#[test]
fn cli_stdin_stdout_roundtrip() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_static-mermaid-rs"))
        .stdin(Stdio::piped()).stdout(Stdio::piped()).spawn().unwrap();
    child.stdin.take().unwrap().write_all(b"graph TD\nA-->B\n===MERMAID_SEP===\ngraph LR\nX-.->Y").unwrap();
    let out = child.wait_with_output().unwrap();
    assert!(out.status.success());
    let s = String::from_utf8(out.stdout).unwrap();
    assert!(s.contains("sl-static-diagram") && s.contains("stroke-dasharray"));
}
