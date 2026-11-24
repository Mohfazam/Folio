"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string | null;
};

export class BillingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || "An unexpected billing view error occurred.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[billing/error-boundary] Caught checkout error:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <section
          role="alert"
          className="rounded-2xl border border-[#EF4444]/30 bg-[#FFF8F7] p-6 sm:p-8"
        >
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#A33A32]">
            CHECKOUT RECOVERY
          </p>
          <h2 className="mt-1.5 font-['Newsreader'] text-[26px] leading-tight text-[#1B1C18]">
            Unable to display the billing screen cleanly
          </h2>
          <p className="mt-2 max-w-xl font-['Space_Grotesk'] text-[13px] leading-5 text-[#565B5B]">
            No payment was charged. You can safely reload this billing panel and try again.
          </p>
          {this.state.errorMessage ? (
            <p className="mt-3 rounded-lg border border-[#F0D8D4] bg-white px-3 py-2 font-mono text-[11px] text-[#7A271A]">
              {this.state.errorMessage}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-lg bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition hover:bg-[#34352F]"
            >
              Reload billing view
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-[#DCDCD4] bg-white px-4 py-2.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition hover:bg-[#F5F4ED]"
            >
              Full page refresh
            </button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
