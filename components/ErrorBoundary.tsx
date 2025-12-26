import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children?: ReactNode;
    viewName?: string;
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-red-900/20 h-full overflow-y-auto">
                    <div className="bg-red-900/50 border-2 border-red-500 rounded-xl p-6 max-w-lg w-full">
                        <h1 className="text-2xl font-black text-red-100 mb-2 flex items-center gap-2">
                            ⚠️ Error en {this.props.viewName || 'Vista'}
                        </h1>
                        <p className="text-red-200 mb-4 text-sm">
                            Se ha producido un error inesperado. Por favor, toma una captura de esta pantalla.
                        </p>

                        <div className="bg-black/40 rounded p-4 mb-6 overflow-x-auto">
                            <p className="font-mono text-red-300 font-bold mb-2 text-sm">{this.state.error?.message}</p>
                            <pre className="text-[10px] text-red-400/80 font-mono whitespace-pre-wrap">
                                {this.state.error?.stack}
                            </pre>
                        </div>

                        <div className="flex gap-3">
                            <button
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors"
                                onClick={() => {
                                    this.setState({ hasError: false, error: null });
                                    if (this.props.onReset) this.props.onReset();
                                }}
                            >
                                Intentar de nuevo
                            </button>
                            <button
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors"
                                onClick={() => window.location.reload()}
                            >
                                Reiniciar App
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
