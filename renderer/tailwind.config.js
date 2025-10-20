/** @type {import('tailwindcss').Config} */
module.exports = {
    important: true,  // Force Tailwind to use !important - fixes Electron styling issues
    darkMode: ["class"],
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./lib/**/*.{js,ts,jsx,tsx,mdx}",
        "./hooks/**/*.{js,ts,jsx,tsx}",
        "./stores/**/*.{js,ts,jsx,tsx}",
        "./utils/**/*.{js,ts,jsx,tsx}",
        // Include any files that might contain Tailwind class names
        "./**/*.{js,ts,jsx,tsx,mdx}",
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
            // DESIGN SYSTEM: 8-Point Grid Spacing
            spacing: {
                // Standard 8-point grid values (8, 16, 24, 32, 40, 48, 64, 80, 96, 128)
                // These override default Tailwind spacing for consistency
                '2': '8px',    // 8pt base
                '3': '16px',   // was 12px, now aligned to 8pt grid
                '4': '16px',   // keep at 16px (2 * 8pt)
                '5': '24px',   // was 20px, now 3 * 8pt
                '6': '24px',   // keep at 24px (3 * 8pt)
                '8': '32px',   // keep at 32px (4 * 8pt)
                '10': '40px',  // keep at 40px (5 * 8pt)
                '12': '48px',  // keep at 48px (6 * 8pt)
                '16': '64px',  // keep at 64px (8 * 8pt)
                '20': '80px',  // keep at 80px (10 * 8pt)
                '24': '96px',  // keep at 96px (12 * 8pt)
                '32': '128px', // keep at 128px (16 * 8pt)
            },
            // DESIGN SYSTEM: Typography Scale (Major Third - 1.250 ratio)
            fontSize: {
                'xs': ['12px', { lineHeight: '16px' }],     // Caption, metadata
                'sm': ['14px', { lineHeight: '20px' }],     // Labels, small text
                'base': ['16px', { lineHeight: '24px' }],   // Body default
                'lg': ['18px', { lineHeight: '28px' }],     // Subheadings
                'xl': ['20px', { lineHeight: '28px' }],     // H4
                '2xl': ['24px', { lineHeight: '32px' }],    // H3
                '3xl': ['30px', { lineHeight: '36px' }],    // H2
                '4xl': ['36px', { lineHeight: '40px' }],    // H1
            },
            // DESIGN SYSTEM: Max-Width Tokens
            maxWidth: {
                'form': '600px',      // Form containers (was max-w-md 448px)
                'prose': '768px',     // Text content
                'page': '1280px',     // Page containers
                'dialog-sm': '400px', // Small dialogs
                'dialog-md': '600px', // Medium dialogs
                'dialog-lg': '800px', // Large dialogs
            },
            // DESIGN SYSTEM: Component Heights (8pt aligned)
            height: {
                'input': '40px',      // Form inputs (5 * 8pt)
                'button-sm': '32px',  // Small buttons (4 * 8pt)
                'button': '40px',     // Default buttons (5 * 8pt)
                'button-lg': '48px',  // Large buttons (6 * 8pt)
            },
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
