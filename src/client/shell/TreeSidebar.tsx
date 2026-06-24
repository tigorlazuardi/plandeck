import {
  type RenderTreeNodePayload,
  Stack,
  Text,
  TextInput,
  Tree,
  type TreeNodeData,
  useTree as useMantineTree,
} from "@mantine/core";
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { TreeNode } from "../../shared/types.ts";
import { useTree } from "../api.ts";
import { TreeSkeleton } from "./LoadingSkeleton.tsx";

// Prune the source tree to files matching the filter, keeping the directories
// that lead to them. Empty filter returns the tree unchanged.
function pruneTree(nodes: TreeNode[], needle: string): TreeNode[] {
  if (!needle) return nodes;
  const out: TreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      if (node.name.toLowerCase().includes(needle) || node.path.toLowerCase().includes(needle)) {
        out.push(node);
      }
    } else if (node.children) {
      const kids = pruneTree(node.children, needle);
      if (kids.length > 0) out.push({ ...node, children: kids });
    }
  }
  return out;
}

// Map our nested TreeNode[] onto Mantine's TreeNodeData[]. `value` is the
// '/'-normalized relpath, which is also the doc route param.
function toTreeData(nodes: TreeNode[]): TreeNodeData[] {
  return nodes.map((node) => {
    const childProp = node.children ? { children: toTreeData(node.children) } : {};
    return {
      value: node.path,
      label: node.name,
      nodeProps: { type: node.type, kind: node.kind },
      ...childProp,
    };
  });
}

export function TreeSidebar() {
  const { data, isLoading } = useTree();
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();
  const params = useParams<{ "*": string }>();
  const activePath = params["*"] ?? "";

  const needle = filter.trim().toLowerCase();
  const sourceFiles = data?.tree ?? [];
  const treeData = useMemo(() => toTreeData(pruneTree(sourceFiles, needle)), [sourceFiles, needle]);

  // Directories are collapsed by default. When a filter is active, expand
  // everything so matching files (which may be nested) are actually visible.
  const mantineTree = useMantineTree();
  // `mantineTree` is a fresh object each render, so it's intentionally NOT a dep
  // (including it re-runs the effect every render → expandAllNodes loop).
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (needle) mantineTree.expandAllNodes();
  }, [needle, treeData]);

  function renderNode({ node, expanded, elementProps }: RenderTreeNodePayload) {
    const isDir = node.nodeProps?.type === "dir";
    const isActive = !isDir && node.value === activePath;
    return (
      <div
        {...elementProps}
        // Own the click fully — calling Mantine's elementProps.onClick here too
        // would double-toggle (expandOnClick) and the folder would never open.
        onClick={() => {
          if (isDir) {
            mantineTree.toggleExpanded(node.value);
          } else {
            navigate(`/doc/${node.value}`);
          }
        }}
        style={{
          ...elementProps.style,
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          padding: "3px 6px",
          borderRadius: 4,
          fontSize: 13,
          cursor: "pointer",
          fontWeight: isActive ? 600 : 400,
          background: isActive ? "var(--mantine-color-default-hover)" : undefined,
        }}
      >
        {isDir ? (
          <ChevronRight
            size={14}
            style={{
              flexShrink: 0,
              transition: "transform 120ms",
              transform: expanded ? "rotate(90deg)" : "none",
            }}
          />
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        {isDir ? (
          expanded ? (
            <FolderOpen size={14} style={{ flexShrink: 0 }} />
          ) : (
            <Folder size={14} style={{ flexShrink: 0 }} />
          )
        ) : (
          <FileText size={14} style={{ flexShrink: 0 }} />
        )}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={node.value}
        >
          {node.label}
        </span>
      </div>
    );
  }

  if (isLoading) {
    return <TreeSkeleton />;
  }

  const root = data?.root ?? "";

  return (
    <Stack gap="xs" style={{ minWidth: 0 }}>
      <TextInput
        placeholder="Filter files..."
        value={filter}
        onChange={(e) => setFilter(e.currentTarget.value)}
        size="xs"
      />
      {sourceFiles.length === 0 && !needle ? (
        <Text c="dimmed" size="xs" data-testid="no-docs-empty">
          No docs found under {root ? `"${root}"` : "the configured root"} — check{" "}
          <code>.plandeck.json</code> include/exclude, or that files aren&apos;t hidden/gitignored.
        </Text>
      ) : treeData.length === 0 ? (
        <Text c="dimmed" size="sm">
          No docs match &ldquo;{filter}&rdquo;
        </Text>
      ) : (
        <Tree
          data={treeData}
          tree={mantineTree}
          levelOffset={16}
          expandOnClick={false}
          renderNode={renderNode}
          style={{ fontSize: 13 }}
        />
      )}
    </Stack>
  );
}
