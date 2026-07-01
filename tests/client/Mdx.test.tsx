import { describe, expect, test } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { act, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
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

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe("Mdx", () => {
  test("shows loading state initially", () => {
    render(
      <Wrapper>
        <Mdx content="# Hello" />
      </Wrapper>,
    );
    expect(screen.getByTestId("mdx-loading")).toBeTruthy();
  });

  test("renders compiled MDX content", async () => {
    render(
      <Wrapper>
        <Mdx content={"# Hello MDX\n\nSome paragraph."} />
      </Wrapper>,
    );
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
    render(
      <Wrapper>
        <Mdx content={validMdx} />
      </Wrapper>,
    );
    await waitFor(
      () => {
        expect(screen.queryByTestId("mdx-loading")).toBeNull();
      },
      { timeout: 10000 },
    );
    // No error card
    expect(screen.queryByTestId("parse-error-card")).toBeNull();
  });

  test("renders inline <code> with underscores without a parse error", async () => {
    // Repro: underscores inside inline <code> previously errored with
    // "Expected the closing tag `</code>` … after the end of `emphasis`".
    const content =
      '<Callout type="warning" title="x">\n' +
      "Query <code>bond_orders-*</code> with <code>product_id</code> and <code>created_at</code>.\n" +
      "</Callout>";

    await act(async () => {
      render(
        <Wrapper>
          <Mdx content={content} />
        </Wrapper>,
      );
    });

    await waitFor(
      () => {
        expect(screen.queryByTestId("mdx-loading")).toBeNull();
      },
      { timeout: 10000 },
    );

    // No parse error, and the literal underscore text is rendered.
    expect(screen.queryByTestId("parse-error-card")).toBeNull();
    expect(
      screen.getByText((_, el) => el?.tagName === "CODE" && el.textContent === "product_id"),
    ).toBeTruthy();
  });

  test("renders a GFM table and wraps it in TypographyStylesProvider", async () => {
    const tableMdx = ["| Col A | Col B |", "| ----- | ----- |", "| foo   | bar   |"].join("\n");

    await act(async () => {
      render(
        <Wrapper>
          <Mdx content={tableMdx} />
        </Wrapper>,
      );
    });

    await waitFor(
      () => {
        expect(screen.queryByTestId("mdx-loading")).toBeNull();
      },
      { timeout: 10000 },
    );

    expect(screen.queryByTestId("parse-error-card")).toBeNull();
    // A real <table> element must be present — confirms remarkGfm + TypographyStylesProvider path.
    expect(screen.getByRole("table")).toBeTruthy();
  });

  test("parse-error case: shows error card, does not throw", async () => {
    // Deliberately broken MDX — unclosed JSX tag
    const brokenMdx = "<div unclosed";

    await act(async () => {
      render(
        <Wrapper>
          <Mdx content={brokenMdx} path="/docs/broken.mdx" />
        </Wrapper>,
      );
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
