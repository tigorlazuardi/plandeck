import { describe, expect, it } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { act, render, screen } from "@testing-library/react";
import { ExportableDoc } from "../../src/client/render/ExportableDoc.tsx";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe("ExportableDoc", () => {
  it("renders its children and an Export trigger", async () => {
    await act(async () => {
      render(
        <Wrapper>
          <ExportableDoc title="Demo">
            <p>doc body</p>
          </ExportableDoc>
        </Wrapper>,
      );
    });
    expect(screen.getByText("doc body")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
  });
});
