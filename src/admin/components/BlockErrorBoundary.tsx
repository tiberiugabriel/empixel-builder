import React from "react";

interface Props {
  /** Block id — used as the boundary key so a swap to another block resets
   *  the error state automatically. */
  blockId: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Per-block error boundary used inside Canvas.tsx. A crash inside any one
 * preview component used to take down the entire builder tree. With this
 * wrapper, the failing block renders a small placeholder while the rest of
 * the canvas keeps working. Reset by remounting (key on block id).
 */
export class BlockErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface to the console — the host can pick it up via a global handler.
    // We deliberately don't dispatch to the reducer; one block crashing
    // shouldn't dirty the layout.
    console.error(`[empixel-builder] block ${this.props.blockId} crashed:`, error, info);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: "10px 12px",
            background: "rgba(248,81,73,0.08)",
            border: "1px dashed rgba(248,81,73,0.5)",
            borderRadius: 4,
            color: "#b91c1c",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          <strong>Block crashed</strong>
          <div style={{ marginTop: 4, fontFamily: "ui-monospace, monospace", fontSize: 11, opacity: 0.85 }}>
            {this.state.error.message || String(this.state.error)}
          </div>
          <div style={{ marginTop: 6, opacity: 0.7 }}>
            Reload the page to recover. Other blocks keep working.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
