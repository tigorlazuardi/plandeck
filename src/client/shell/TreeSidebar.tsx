import { Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { TreeNode } from "../../shared/types.ts";
import { useTree } from "../api.ts";

function flattenFiles(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      result.push(node);
    } else if (node.children) {
      result.push(...flattenFiles(node.children));
    }
  }
  return result;
}

function matchesFilter(node: TreeNode, filter: string): boolean {
  if (!filter) return true;
  const lower = filter.toLowerCase();
  return node.name.toLowerCase().includes(lower) || node.path.toLowerCase().includes(lower);
}

interface FileNodeButtonProps {
  node: TreeNode;
}

function FileNodeButton({ node }: FileNodeButtonProps) {
  const navigate = useNavigate();
  return (
    <UnstyledButton
      onClick={() => navigate(`/doc/${node.path}`)}
      style={{
        display: "block",
        width: "100%",
        padding: "4px 8px",
        borderRadius: 4,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {node.name}
    </UnstyledButton>
  );
}

export function TreeSidebar() {
  const { data, isLoading } = useTree();
  const [filter, setFilter] = useState("");

  if (isLoading) {
    return (
      <Text c="dimmed" size="sm">
        Loading...
      </Text>
    );
  }

  const allFiles = flattenFiles(data?.tree ?? []);
  const filtered = allFiles.filter((node) => matchesFilter(node, filter));

  return (
    <Stack gap="xs">
      <TextInput
        placeholder="Filter files..."
        value={filter}
        onChange={(e) => setFilter(e.currentTarget.value)}
        size="xs"
      />
      {filtered.length === 0 ? (
        <Text c="dimmed" size="sm">
          No docs found
        </Text>
      ) : (
        filtered.map((node) => <FileNodeButton key={node.path} node={node} />)
      )}
    </Stack>
  );
}
