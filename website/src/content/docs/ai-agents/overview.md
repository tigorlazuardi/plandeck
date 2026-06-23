---
title: Using with AI Agents
description: How to feed Plandeck's documentation to an LLM efficiently via llms.txt and scoped documentation sets.
---

Plandeck is agent-native: an AI agent typically *writes* the plan documents that
a human then browses. This site is also published in an LLM-friendly form so an
agent can learn Plandeck (or contribute to it) without you pasting docs by hand.

## llms.txt

The entry point is [`/plandeck/llms.txt`](/plandeck/llms.txt) — a compact,
Markdown index of the whole site following the [llms.txt
standard](https://llmstxt.org/). Point your model at that URL.

Two full-content variants also exist:

- [`/plandeck/llms-full.txt`](/plandeck/llms-full.txt) — every page, inlined.
- [`/plandeck/llms-small.txt`](/plandeck/llms-small.txt) — a minified subset.

## Scoped documentation sets

`llms-full.txt` is large. To avoid an LLM ingesting the entire site up front,
`llms.txt` links **scoped sets** — load only the slice relevant to the task:

| Set | Use it for |
|---|---|
| **Usage** | install Plandeck and serve a directory |
| **Configuration** | CLI flags and `.plandeck.json` |
| **MDX blocks** | authoring rich plan documents |
| **Releasing and Nix** | building binary releases + the Nix flake |
| **Project conventions** | contributing or driving an agent on the repo |

Each set is its own `.txt` file linked from `llms.txt`. An agent reads the
index, then fetches just the set it needs.

## In this section

- [Releasing & Nix](/plandeck/ai-agents/releasing/) — how releases and the flake are built.
- [Project conventions](/plandeck/ai-agents/conventions/) — the code conventions enforced in the repo.
- [Contributing](/plandeck/ai-agents/contributing/) — local dev workflow and repo layout.
