"use client";
import React, { Component } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
class ErrorBoundary extends Component {
    constructor() {
        super(...arguments);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
        this.handleRetry = () => {
            this.setState({
                hasError: false,
                error: null,
                errorInfo: null,
            });
        };
        this.handleGoHome = () => {
            window.location.href = "/dashboard";
        };
    }
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }
    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });
        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }
    render() {
        if (this.state.hasError) {
            // Custom fallback UI if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }
            // Default error UI
            return (<div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="w-12 h-12 text-red-500"/>
              </div>
              <CardTitle className="text-xl text-red-600 dark:text-red-400">
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400 text-center">
                We encountered an unexpected error. This has been logged and our
                team will investigate.
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (<details className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <summary className="cursor-pointer font-medium text-sm mb-2">
                    Error Details (Development Only)
                  </summary>
                  <div className="text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap">
                    {this.state.error.toString()}
                    {this.state.errorInfo && (<>
                        <br />
                        <br />
                        Component Stack:
                        {this.state.errorInfo.componentStack}
                      </>)}
                  </div>
                </details>)}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={this.handleRetry} className="flex-1" variant="default">
                  <RefreshCw className="w-4 h-4 mr-2"/>
                  Try Again
                </Button>
                <Button onClick={this.handleGoHome} className="flex-1" variant="outline">
                  <Home className="w-4 h-4 mr-2"/>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>);
        }
        return this.props.children;
    }
}
export default ErrorBoundary;
// Functional wrapper for easier usage
export const withErrorBoundary = (Component, errorBoundaryProps) => {
    const WrappedComponent = (props) => (<ErrorBoundary {...errorBoundaryProps}>
      <Component {...props}/>
    </ErrorBoundary>);
    WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
    return WrappedComponent;
};
