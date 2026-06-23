// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

// GitHub Pages project page: served from https://tigorlazuardi.github.io/plandeck
const SITE = "https://tigorlazuardi.github.io";
const BASE = "/plandeck";

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: [
    starlight({
      title: "Plandeck",
      description:
        "Local, read-only viewer for a directory of Markdown, MDX, HTML, PDF, image, and text docs — searchable, with live reload. Agent writes the docs, human reads them.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/tigorlazuardi/plandeck",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/tigorlazuardi/plandeck/edit/main/website/",
      },
      plugins: [
        starlightLlmsTxt({
          projectName: "Plandeck",
          description:
            "Plandeck is a single-binary local web app that renders a directory of plan/documentation files (Markdown, MDX, HTML, PDF, images, text) as a searchable, live-reloading site. It is read-only: an AI agent writes the docs, a human browses them. No account, no network egress, no database.",
          details:
            "Use the documentation sets below to load only what you need:\n\n- **Usage** — install a binary and serve a directory.\n- **Configuration** — CLI flags and `.plandeck.json`.\n- **MDX blocks** — the custom components available inside `.mdx` plan docs.\n- **Releasing & Nix** — how releases and the Nix flake are built (for maintainers/agents).\n- **Project conventions** — code conventions for contributing or driving an agent on this repo.",
          // Scoped subsets so an LLM ingests only the relevant slice instead of llms-full.txt.
          customSets: [
            {
              label: "Usage",
              description:
                "install Plandeck and serve a directory of docs in the browser",
              paths: [
                "guide/getting-started",
                "guide/installation",
                "guide/serving",
              ],
            },
            {
              label: "Configuration",
              description: "CLI flags and the .plandeck.json config file",
              paths: ["guide/configuration"],
            },
            {
              label: "MDX blocks",
              description:
                "custom MDX components for authoring rich plan documents",
              paths: ["guide/mdx-blocks"],
            },
            {
              label: "Releasing and Nix",
              description:
                "build binary releases and the Nix flake (maintainer/agent procedure)",
              paths: ["ai-agents/releasing"],
            },
            {
              label: "Project conventions",
              description:
                "code conventions and contributor/agent guidance for the Plandeck repo",
              paths: ["ai-agents/conventions", "ai-agents/contributing"],
            },
          ],
          promote: ["index*", "guide/getting-started*"],
        }),
      ],
      sidebar: [
        {
          label: "Guide",
          items: [
            "guide/getting-started",
            "guide/installation",
            "guide/serving",
            "guide/configuration",
            "guide/mdx-blocks",
          ],
        },
        {
          label: "Using with AI Agents",
          items: [
            "ai-agents/overview",
            "ai-agents/releasing",
            "ai-agents/conventions",
            "ai-agents/contributing",
          ],
        },
      ],
    }),
  ],
});
