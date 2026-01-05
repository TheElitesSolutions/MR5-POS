"use client";
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
export function ThemeProvider({ children }) {
    return (<NextThemesProvider attribute="class" defaultTheme="system" enableSystem={true} enableColorScheme={true} disableTransitionOnChange={false} storageKey="pos-theme" themes={["light", "dark", "system"]}>
      {children}
    </NextThemesProvider>);
}
