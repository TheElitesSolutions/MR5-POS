/** @type {import('tailwindcss').Config} */
module.exports = {
    important: true,  // Force Tailwind to use !important - fixes Electron styling issues
    darkMode: ["class"],
    content: [
        "./renderer/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./renderer/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./renderer/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./renderer/lib/**/*.{js,ts,jsx,tsx,mdx}",
        "./renderer/hooks/**/*.{js,ts,jsx,tsx}",
        "./renderer/stores/**/*.{js,ts,jsx,tsx}",
        "./renderer/utils/**/*.{js,ts,jsx,tsx}",
        // Include any files that might contain Tailwind class names
        "./renderer/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    safelist: [
        // Ensure common utility classes are never purged
        'bg-white', 'bg-black', 'text-white', 'text-black',
        'p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-8',
        'm-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6', 'm-8',
        'w-full', 'h-full', 'flex', 'block', 'hidden',
        'text-sm', 'text-base', 'text-lg', 'text-xl',
        'font-normal', 'font-semibold', 'font-bold',
        'rounded', 'rounded-md', 'rounded-lg',
        'border', 'border-gray-300', 'border-gray-200',
        // Add any frequently used classes in your app
        'btn', 'btn-primary', 'btn-secondary'
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                success: {
                    DEFAULT: "hsl(var(--success))",
                    foreground: "hsl(var(--success-foreground))",
                },
                warning: {
                    DEFAULT: "hsl(var(--warning))",
                    foreground: "hsl(var(--warning-foreground))",
                },
                info: {
                    DEFAULT: "hsl(var(--info))",
                    foreground: "hsl(var(--info-foreground))",
                },
                chart: {
                    "1": "hsl(var(--chart-1))",
                    "2": "hsl(var(--chart-2))",
                    "3": "hsl(var(--chart-3))",
                    "4": "hsl(var(--chart-4))",
                    "5": "hsl(var(--chart-5))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "fade-in": {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                "fade-out": {
                    from: { opacity: "1" },
                    to: { opacity: "0" },
                },
                "slide-in-from-top": {
                    from: { transform: "translateY(-100%)" },
                    to: { transform: "translateY(0)" },
                },
                "slide-in-from-bottom": {
                    from: { transform: "translateY(100%)" },
                    to: { transform: "translateY(0)" },
                },
                "slide-in-from-left": {
                    from: { transform: "translateX(-100%)" },
                    to: { transform: "translateX(0)" },
                },
                "slide-in-from-right": {
                    from: { transform: "translateX(100%)" },
                    to: { transform: "translateX(0)" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.2s ease-out",
                "fade-out": "fade-out 0.2s ease-out",
                "slide-in-from-top": "slide-in-from-top 0.2s ease-out",
                "slide-in-from-bottom": "slide-in-from-bottom 0.2s ease-out",
                "slide-in-from-left": "slide-in-from-left 0.2s ease-out",
                "slide-in-from-right": "slide-in-from-right 0.2s ease-out",
            },
            screens: {
                xs: "475px",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}
