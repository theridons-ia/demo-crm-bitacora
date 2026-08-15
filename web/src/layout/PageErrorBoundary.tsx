import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../components/Button";

type Props = {
  resetKey?: string;
  children: ReactNode;
};

type State = { error: Error | null };

/** Evita pantalla en blanco si una vista lanza al renderizar. */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Pantalla rota:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page-crash">
        <p className="form-error" role="alert">
          Esta pantalla falló. Vuelve a intentar o entra a otra pestaña.
        </p>
        <Button type="button" variant="secondary" onClick={() => this.setState({ error: null })}>
          Reintentar
        </Button>
      </div>
    );
  }
}
