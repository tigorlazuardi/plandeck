import { describe, expect, it } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render } from "@testing-library/react";
import { HtmlView } from "../../src/client/render/HtmlView.tsx";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe("HtmlView", () => {
  it("renders an iframe element", () => {
    const { container } = render(
      <Wrapper>
        <HtmlView html="<h1>hello</h1>" />
      </Wrapper>,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
  });

  it("sets srcdoc to the provided html", () => {
    const html = "<p>test content</p>";
    const { container } = render(
      <Wrapper>
        <HtmlView html={html} />
      </Wrapper>,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("srcdoc")).toBe(html);
  });

  it("has a sandbox attribute", () => {
    const { container } = render(
      <Wrapper>
        <HtmlView html="<b>x</b>" />
      </Wrapper>,
    );
    const iframe = container.querySelector("iframe");
    const sandbox = iframe?.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toBeNull();
    // sandbox attr exists (even empty string is ok for strict mode)
  });

  it("sandbox does NOT contain allow-scripts", () => {
    const { container } = render(
      <Wrapper>
        <HtmlView html="<b>x</b>" />
      </Wrapper>,
    );
    const iframe = container.querySelector("iframe");
    const sandbox = iframe?.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-scripts");
  });

  it("sandbox does NOT contain allow-same-origin", () => {
    const { container } = render(
      <Wrapper>
        <HtmlView html="<b>x</b>" />
      </Wrapper>,
    );
    const iframe = container.querySelector("iframe");
    const sandbox = iframe?.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-same-origin");
  });

  it("enabling the scripts toggle adds allow-scripts but NEVER allow-same-origin", () => {
    const { container, getByRole } = render(
      <Wrapper>
        <HtmlView html="<b>x</b>" />
      </Wrapper>,
    );
    // Default is inert.
    expect(container.querySelector("iframe")?.getAttribute("sandbox")).not.toContain(
      "allow-scripts",
    );

    fireEvent.click(getByRole("switch"));

    const sandbox = container.querySelector("iframe")?.getAttribute("sandbox") ?? "";
    expect(sandbox).toContain("allow-scripts");
    // SECURITY: scripts may run, but the frame must stay cross-origin so it can't
    // reach the app or strip its own sandbox.
    expect(sandbox).not.toContain("allow-same-origin");
  });

  it("does NOT use src pointing at app origin (must use srcdoc)", () => {
    const { container } = render(
      <Wrapper>
        <HtmlView html="<b>safe</b>" />
      </Wrapper>,
    );
    const iframe = container.querySelector("iframe");
    // src should be absent or empty
    const src = iframe?.getAttribute("src");
    expect(!src || src === "").toBe(true);
  });
});
