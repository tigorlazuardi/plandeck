import { Text } from "@mantine/core";
import { createBrowserRouter, useParams } from "react-router-dom";
import { DocView } from "./render/DocView.tsx";
import { AppLayout } from "./shell/AppShell.tsx";
import { TreeSidebar } from "./shell/TreeSidebar.tsx";

function DocPage() {
  const params = useParams();
  const docPath = params["*"] ?? "";
  return <AppLayout sidebar={<TreeSidebar />} main={<DocView path={docPath} />} />;
}

function HomePage() {
  return (
    <AppLayout
      sidebar={<TreeSidebar />}
      main={
        <Text c="dimmed" ta="center" mt="xl">
          Select a document from the sidebar.
        </Text>
      }
    />
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/doc/*",
    element: <DocPage />,
  },
]);
