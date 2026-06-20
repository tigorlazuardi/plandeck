import { Alert, Anchor, Button, Text } from "@mantine/core";
import type React from "react";

interface ErrorCardAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface ErrorCardProps {
  icon?: React.ReactNode;
  title: string;
  detail?: string;
  action?: ErrorCardAction;
}

export function ErrorCard({ icon, title, detail, action }: ErrorCardProps) {
  return (
    <Alert
      icon={icon}
      title={title}
      color="red"
      variant="light"
      mt="md"
      data-testid="error-card"
    >
      {detail && (
        <Text size="sm" mt="xs">
          {detail}
        </Text>
      )}
      {action && (
        <div style={{ marginTop: "0.5rem" }}>
          {action.href ? (
            <Anchor href={action.href} target="_blank" rel="noopener noreferrer" size="sm">
              {action.label}
            </Anchor>
          ) : (
            <Button size="xs" variant="subtle" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </Alert>
  );
}
