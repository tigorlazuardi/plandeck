import { describe, expect, test } from "bun:test";
import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { Mdx } from "../../src/client/render/Mdx.tsx";

const validMdx = `
# Hello MDX

<Callout type="info" title="Note">This is a callout</Callout>

<Decision title="Use MDX" status="accepted">We chose MDX for rich content.</Decision>

<CodeTabs>
<pre><code className="language-ts" data-tab="server.ts">const x = 1;</code></pre>
<pre><code className="language-ts" data-tab="client.ts">const y = 2;</code></pre>
</CodeTabs>

<HtmlBlock>
<pre><code>{"<p>Hello from iframe</p>"}</code>
</pre>
</HtmlBlock>
`;

describe("Mdx", () => {
  test("shows loading state initially", () => {
    render(<Mdx content="# Hello" />);
    expect(screen.getByTestId("mdx-loading")).toBeTruthy();
  });

  test("renders compiled MDX content", async () => {
    render(<Mdx content={"# Hello MDX\n\nSome paragraph."} />);
    await waitFor(() => {
      expect(screen.queryByTestId("mdx-loading")).toBeNull();
    });
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "H1" && (el.textContent ?? "").includes("Hello MDX"),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "P" && (el.textContent ?? "").includes("Some paragraph."),
      ),
    ).toBeTruthy();
  });

  test("renders all 4 custom blocks without throwing", async () => {
    render(<Mdx content={validMdx} />);
    await waitFor(
      () => {
        expect(screen.queryByTestId("mdx-loading")).toBeNull();
      },
      { timeout: 10000 },
    );
    // No error card
    expect(screen.queryByTestId("parse-error-card")).toBeNull();
  });

  test("parse-error case: shows error card, does not throw", async () => {
    // Deliberately broken MDX — unclosed JSX tag
    const brokenMdx = "<div unclosed";

    await act(async () => {
      render(<Mdx content={brokenMdx} path="/docs/broken.mdx" />);
    });

    await waitFor(
      () => {
        const card = screen.queryByTestId("parse-error-card");
        const loading = screen.queryByTestId("mdx-loading");
        return card !== null || loading === null;
      },
      { timeout: 10000 },
    );

    // Should show error card
    expect(screen.queryByTestId("parse-error-card")).toBeTruthy();
    // Path shown
    expect(screen.getByText("/docs/broken.mdx")).toBeTruthy();
  });
});
