/**
 * Language adapter registry for the coding workspace.
 *
 * Code is never compiled or executed in the browser or in the API process.
 * Each adapter maps a NeuroClass language id to the identifiers used by the
 * supported sandbox providers (Judge0 and Piston). Adding a language is a
 * matter of adding one entry here once the sandbox has a runtime for it.
 */
export const LANGUAGE_IDS = ['c', 'cpp', 'java', 'python', 'javascript', 'typescript', 'csharp', 'go', 'rust', 'php', 'ruby', 'kotlin', 'swift'] as const;
export type LanguageId = (typeof LANGUAGE_IDS)[number];

export type LanguageAdapter = {
  id: LanguageId;
  label: string;
  monaco: string;
  fileName: string;
  compiled: boolean;
  judge0Id: number;      // Judge0 CE language id
  piston: { language: string; version: string };
  starter: string;
};

export const LANGUAGES: Record<LanguageId, LanguageAdapter> = {
  c: { id: 'c', label: 'C (GCC)', monaco: 'c', fileName: 'main.c', compiled: true, judge0Id: 50, piston: { language: 'c', version: '*' }, starter: '#include <stdio.h>\n\nint main(void) {\n    // Read input from stdin and print the answer\n    return 0;\n}\n' },
  cpp: { id: 'cpp', label: 'C++ (G++)', monaco: 'cpp', fileName: 'main.cpp', compiled: true, judge0Id: 54, piston: { language: 'c++', version: '*' }, starter: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    return 0;\n}\n' },
  java: { id: 'java', label: 'Java', monaco: 'java', fileName: 'Main.java', compiled: true, judge0Id: 62, piston: { language: 'java', version: '*' }, starter: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n    }\n}\n' },
  python: { id: 'python', label: 'Python 3', monaco: 'python', fileName: 'main.py', compiled: false, judge0Id: 71, piston: { language: 'python', version: '3.*' }, starter: 'import sys\n\n\ndef main():\n    data = sys.stdin.read().split()\n\n\nif __name__ == "__main__":\n    main()\n' },
  javascript: { id: 'javascript', label: 'JavaScript (Node.js)', monaco: 'javascript', fileName: 'main.js', compiled: false, judge0Id: 63, piston: { language: 'javascript', version: '*' }, starter: "const input = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/);\n\n" },
  typescript: { id: 'typescript', label: 'TypeScript', monaco: 'typescript', fileName: 'main.ts', compiled: true, judge0Id: 74, piston: { language: 'typescript', version: '*' }, starter: "declare const require: any;\nconst input: string[] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/);\n\n" },
  csharp: { id: 'csharp', label: 'C# (Mono)', monaco: 'csharp', fileName: 'Main.cs', compiled: true, judge0Id: 51, piston: { language: 'csharp', version: '*' }, starter: 'using System;\n\npublic class Program {\n    public static void Main() {\n        var line = Console.ReadLine();\n    }\n}\n' },
  go: { id: 'go', label: 'Go', monaco: 'go', fileName: 'main.go', compiled: true, judge0Id: 60, piston: { language: 'go', version: '*' }, starter: 'package main\n\nimport (\n\t"bufio"\n\t"fmt"\n\t"os"\n)\n\nfunc main() {\n\treader := bufio.NewReader(os.Stdin)\n\t_ = reader\n\tfmt.Print("")\n}\n' },
  rust: { id: 'rust', label: 'Rust', monaco: 'rust', fileName: 'main.rs', compiled: true, judge0Id: 73, piston: { language: 'rust', version: '*' }, starter: 'use std::io::{self, Read};\n\nfn main() {\n    let mut input = String::new();\n    io::stdin().read_to_string(&mut input).unwrap();\n}\n' },
  php: { id: 'php', label: 'PHP', monaco: 'php', fileName: 'main.php', compiled: false, judge0Id: 68, piston: { language: 'php', version: '*' }, starter: '<?php\n$input = trim(stream_get_contents(STDIN));\n' },
  ruby: { id: 'ruby', label: 'Ruby', monaco: 'ruby', fileName: 'main.rb', compiled: false, judge0Id: 72, piston: { language: 'ruby', version: '*' }, starter: 'input = STDIN.read.split\n' },
  kotlin: { id: 'kotlin', label: 'Kotlin', monaco: 'kotlin', fileName: 'Main.kt', compiled: true, judge0Id: 78, piston: { language: 'kotlin', version: '*' }, starter: 'fun main() {\n    val line = readLine()\n}\n' },
  swift: { id: 'swift', label: 'Swift', monaco: 'swift', fileName: 'main.swift', compiled: true, judge0Id: 83, piston: { language: 'swift', version: '*' }, starter: 'import Foundation\n\nlet line = readLine()\n' },
};

export function publicLanguageList(enabled: readonly LanguageId[] = LANGUAGE_IDS) {
  return enabled.map((id) => {
    const l = LANGUAGES[id];
    return { id: l.id, label: l.label, monaco: l.monaco, fileName: l.fileName, compiled: l.compiled, starter: l.starter };
  });
}
