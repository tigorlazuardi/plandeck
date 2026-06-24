import { Button, Group, Menu } from "@mantine/core";
import { Download, FileDown, Printer } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { exportDocAsHtml, printDoc } from "../export.ts";

interface ExportableDocProps {
  title: string;
  children: ReactNode;
}

// Wraps a rendered Markdown/MDX document with an export toolbar. The content sits
// in a ref'd container so "Download HTML" can serialize exactly what's rendered.
export function ExportableDoc({ title, children }: ExportableDocProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <Group justify="flex-end" mb="sm" className="vp-no-print">
        <Menu position="bottom-end" withinPortal shadow="md">
          <Menu.Target>
            <Button size="xs" variant="default" leftSection={<FileDown size={14} />}>
              Export
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<Download size={14} />}
              onClick={() => {
                if (contentRef.current) {
                  void exportDocAsHtml(contentRef.current, title);
                }
              }}
            >
              Download HTML
            </Menu.Item>
            <Menu.Item leftSection={<Printer size={14} />} onClick={() => printDoc()}>
              Print / Save as PDF
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      <div ref={contentRef} data-doc-export>
        {children}
      </div>
    </>
  );
}
