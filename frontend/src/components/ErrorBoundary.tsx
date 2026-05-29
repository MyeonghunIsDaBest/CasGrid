import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-red-100 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base leading-tight">
                Something went wrong
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">CasGrid hit an unexpected error</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-3">
            Your data is safe — it's stored in the cloud. Reload to recover.
          </p>
          <pre className="bg-slate-50 rounded-lg p-3 text-[10px] text-slate-700 font-mono mb-4 max-h-32 overflow-auto whitespace-pre-wrap break-words border border-slate-100">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button
            onClick={this.handleReload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors"
          >
            <RotateCw size={14} />
            Reload CasGrid
          </button>
        </div>
      </div>
    );
  }
}
