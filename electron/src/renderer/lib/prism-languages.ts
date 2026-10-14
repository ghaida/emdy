// The grammars Emdy highlights. Importing the full Prism build pulls in ~300
// of them (over half a megabyte) into every window. PrismLight is imported from
// its own module: the package's index also loads the full builds, which only a
// production build drops, so tests would highlight languages Emdy doesn't.
import PrismLight from 'react-syntax-highlighter/dist/esm/prism-light';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import swift from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import kotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml';
import docker from 'react-syntax-highlighter/dist/esm/languages/prism/docker';
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql';
import scss from 'react-syntax-highlighter/dist/esm/languages/prism/scss';
import less from 'react-syntax-highlighter/dist/esm/languages/prism/less';
import gdscript from 'react-syntax-highlighter/dist/esm/languages/prism/gdscript';
import ini from 'react-syntax-highlighter/dist/esm/languages/prism/ini';
import powershell from 'react-syntax-highlighter/dist/esm/languages/prism/powershell';

// A grammar is registered under its own name and the aliases it brings (html,
// js, ts, sh, py, yml, …), whatever name it's given here.
const languages: Record<string, unknown> = {
  markup, html: markup, xml: markup, svg: markup, css, javascript, js: javascript, typescript, ts: typescript,
  jsx, tsx, json, bash, sh: bash, shell: bash, python, py: python, yaml, yml: yaml, markdown, md: markdown,
  go, rust, java, c, cpp, csharp, cs: csharp, sql, diff, ruby, rb: ruby, php, swift, kotlin,
  kt: kotlin, toml, docker, dockerfile: docker, graphql, scss, less, gdscript, ini, powershell,
};

for (const [name, grammar] of Object.entries(languages)) {
  PrismLight.registerLanguage(name, grammar as never);
}

// Names those grammars don't bring. ('c++' is never asked for: the view reads
// a fence's language up to the first non-word character, so c++ is c.)
PrismLight.alias({
  bash: ['zsh', 'console'],
  rust: 'rs',
  javascript: ['mjs', 'cjs'],
  json: 'jsonc',
  powershell: ['ps1', 'pwsh'],
});

export { PrismLight as SyntaxHighlighter };
