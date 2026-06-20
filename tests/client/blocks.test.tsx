import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { Callout } from "../../src/client/blocks/Callout.tsx";
import { CodeTabs } from "../../src/client/blocks/CodeTabs.tsx";
import { Decision } from "../../src/client/blocks/Decision.tsx";
import { HtmlBlock } from "../../src/client/blocks/HtmlBlock.tsx";

describe("Callout", () => {
  test("renders children", () => {
    render(<Callout>Hello world</Callout>);
    expect(screen.getByText("Hello world")).toBeTruthy();
  });

  test("renders title when provided", () => {
    render(<Callout title="Important">Content here</Callout>);
    expect(screen.getByText("Important")).toBeTruthy();
    expect(screen.getByText("Content here")).toBeTruthy();
  });

  test("default type is info", () => {
    const { container } = render(<Callout>Info callout</Callout>);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("data-type")).toBe("info");
  });

  test("warn type sets data-type=warn", () => {
    const { container } = render(<Callout type="warn">Warning</Callout>);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("data-type")).toBe("warn");
  });

  test("success type sets data-type=success", () => {
    const { container } = render(<Callout type="success">OK</Callout>);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("data-type")).toBe("success");
  });

  test("danger type sets data-type=danger", () => {
    const { container } = render(<Callout type="danger">Danger</Callout>);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("data-type")).toBe("danger");
  });
});

describe("Decision", () => {
  test("renders title", () => {
    render(<Decision title="Use Postgres">We chose Postgres.</Decision>);
    expect(screen.getByText("Use Postgres")).toBeTruthy();
  });

  test("renders children", () => {
    render(<Decision title="X">Reasoning here</Decision>);
    expect(screen.getByText("Reasoning here")).toBeTruthy();
  });

  test("default status is proposed", () => {
    render(<Decision title="Y">content</Decision>);
    expect(screen.getByText("proposed")).toBeTruthy();
  });

  test("accepted status badge shows", () => {
    render(
      <Decision title="Y" status="accepted">
        content
      </Decision>,
    );
    expect(screen.getByText("accepted")).toBeTruthy();
  });

  test("rejected status badge shows", () => {
    render(
      <Decision title="Y" status="rejected">
        content
      </Decision>,
    );
    expect(screen.getByText("rejected")).toBeTruthy();
  });
});

describe("HtmlBlock", () => {
  test("renders an iframe", () => {
    const { container } = render(
      <HtmlBlock>
        <pre>
          <code>{"<p>Hello</p>"}</code>
        </pre>
      </HtmlBlock>,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe).toBeTruthy();
  });

  test("sandbox attr present and does not contain allow-scripts", () => {
    const { container } = render(
      <HtmlBlock>
        <pre>
          <code>{"<p>Hello</p>"}</code>
        </pre>
      </HtmlBlock>,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    const sandbox = iframe.getAttribute("sandbox") ?? "";
    expect(sandbox.includes("allow-scripts")).toBe(false);
    expect(sandbox.includes("allow-same-origin")).toBe(false);
  });

  test("srcdoc contains html content", () => {
    const { container } = render(
      <HtmlBlock>
        <pre>
          <code>{"<p>Test content</p>"}</code>
        </pre>
      </HtmlBlock>,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.getAttribute("srcdoc")).toContain("<p>Test content</p>");
  });

  test("optional height prop sets style", () => {
    const { container } = render(
      <HtmlBlock height="300px">
        <pre>
          <code>{"<p>x</p>"}</code>
        </pre>
      </HtmlBlock>,
    );
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.style.height).toBe("300px");
  });
});

describe("CodeTabs", () => {
  function makeCodeChild(code: string, tab: string, lang = "ts") {
    return (
      <pre key={tab}>
        <code className={`language-${lang}`} data-tab={tab}>
          {code}
        </code>
      </pre>
    );
  }

  test("renders tab buttons for each child", () => {
    render(
      <CodeTabs>
        {makeCodeChild("const x = 1;", "server.ts")}
        {makeCodeChild("const y = 2;", "client.ts")}
      </CodeTabs>,
    );
    expect(screen.getByText("server.ts")).toBeTruthy();
    expect(screen.getByText("client.ts")).toBeTruthy();
  });

  test("clicking tab switches active content", () => {
    render(
      <CodeTabs>
        {makeCodeChild("const x = 1;", "server.ts")}
        {makeCodeChild("const y = 2;", "client.ts")}
      </CodeTabs>,
    );
    // Initially first tab active
    expect(screen.getByText("const x = 1;")).toBeTruthy();
    // Click second tab
    fireEvent.click(screen.getByText("client.ts"));
    expect(screen.getByText("const y = 2;")).toBeTruthy();
  });

  test("fallback to index when no tab prop", () => {
    render(
      <CodeTabs>
        <pre>
          <code className="language-js">{"console.log(1)"}</code>
        </pre>
        <pre>
          <code className="language-py">{"print(2)"}</code>
        </pre>
      </CodeTabs>,
    );
    // Should render tab labels based on lang or index
    const tabs = screen.getAllByRole("button");
    expect(tabs.length).toBe(2);
  });

  test("default meta selects initial tab", () => {
    render(
      <CodeTabs>
        <pre>
          <code className="language-ts" data-tab="first.ts">
            {"const a = 1;"}
          </code>
        </pre>
        <pre>
          <code className="language-ts" data-tab="second.ts" data-default="true">
            {"const b = 2;"}
          </code>
        </pre>
      </CodeTabs>,
    );
    // second tab should be active due to data-default
    expect(screen.getByText("const b = 2;")).toBeTruthy();
  });
});
