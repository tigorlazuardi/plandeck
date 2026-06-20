import { ActionIcon, AppShell, Group, Text, Title, useMantineColorScheme } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  return (
    <ActionIcon
      variant="default"
      onClick={() => toggleColorScheme()}
      size="lg"
      aria-label="Toggle color scheme"
    >
      {colorScheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </ActionIcon>
  );
}

export function App() {
  const { data } = useQuery({
    queryKey: ["tree"],
    queryFn: async () => {
      const res = await fetch("/api/tree");
      if (!res.ok) throw new Error("Failed to fetch tree");
      return res.json();
    },
  });

  const title = (data as { title?: string } | undefined)?.title ?? "Visual Planner";

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: true } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>{title}</Title>
          <ThemeToggle />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Text c="dimmed" size="sm">
          No documents yet
        </Text>
      </AppShell.Navbar>

      <AppShell.Main>
        <Text c="dimmed" ta="center" mt="xl">
          No document selected
        </Text>
      </AppShell.Main>
    </AppShell>
  );
}
