import { ActionIcon, AppShell, Group, Title, useMantineColorScheme } from "@mantine/core";
import { Moon, Sun } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { useTree } from "../api.ts";
import { SearchBox } from "./SearchBox.tsx";

const COLOR_SCHEME_KEY = "vp-color-scheme";

function ThemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    const stored = localStorage.getItem(COLOR_SCHEME_KEY);
    if (stored === "dark" || stored === "light") {
      setColorScheme(stored);
    }
  }, [setColorScheme]);

  function handleToggle() {
    const next = colorScheme === "dark" ? "light" : "dark";
    setColorScheme(next);
    localStorage.setItem(COLOR_SCHEME_KEY, next);
  }

  return (
    <ActionIcon variant="default" onClick={handleToggle} size="lg" aria-label="Toggle color scheme">
      {colorScheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </ActionIcon>
  );
}

interface AppLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
}

export function AppLayout({ sidebar, main }: AppLayoutProps) {
  const { data } = useTree();
  const title = data?.title ?? "Visual Planner";

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: true } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>{title}</Title>
          <SearchBox />
          <ThemeToggle />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">{sidebar}</AppShell.Navbar>

      <AppShell.Main>{main}</AppShell.Main>
    </AppShell>
  );
}
