import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

import Script from "next/script";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Premium CBT Portal",
  description: "Advanced Computer Based Testing Software for WAEC, JAMB, NECO, IGCSE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
        />
      </head>
      <body className={outfit.className} suppressHydrationWarning>
        {/* Dynamic Background */}
        <div className="bg-gradient-mesh"></div>
        
        <div className="layout-content">
          <Providers>{children}</Providers>
        </div>

        {/* KaTeX Scripts for fast rendering */}
        <Script 
          src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" 
          strategy="afterInteractive" 
        />
        <Script 
          src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" 
          strategy="afterInteractive" 
        />

        {/* MathJax Configuration & Fallback Script */}
        <Script id="mathjax-config" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `
            window.MathJax = {
              tex2jax: {
                inlineMath: [['\\\\(', '\\\\)'], ['$', '$']],
                displayMath: [['\\\\[', '\\\\]'], ['$$', '$$']],
                processEscapes: true
              },
              TeX: {
                extensions: ["mhchem.js", "AMSmath.js", "AMSsymbols.js"]
              },
              "HTML-CSS": { linebreaks: { automatic: true } },
              SVG: { linebreaks: { automatic: true } }
            };
        `}} />
        <Script 
          src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-AMS-MML_HTMLorMML" 
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

