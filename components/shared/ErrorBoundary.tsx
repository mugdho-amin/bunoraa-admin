"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Flex, Result } from "antd";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Flex align="center" justify="center" style={{ minHeight: 320, padding: 24 }}>
          <Result
            status="error"
            title="Something went wrong"
            subTitle={this.state.error.message}
            extra={
              <Button type="primary" onClick={() => this.setState({ error: null })}>
                Try again
              </Button>
            }
          />
        </Flex>
      );
    }
    return this.props.children;
  }
}
