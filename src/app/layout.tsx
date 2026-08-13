import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Training, nutrition and money in one place.",
};

/* eslint-disable react/no-danger */
const DIRECTION_CONTRACT = `
THESIS: One instrument that reads body and money together. It refuses the four-app
shuffle, and — by the owner's explicit choice over four alternative worlds — it also
refuses novelty: the category standard, executed at full craft, no smuggled quirk.
OWN-WORLD: Near-monochrome dark ground (#08090A) with panels separated by 1px
hairline seams, never shadow or floating cards. Geist Sans throughout, Geist Mono
tabular for every figure. Four lawful domain accents (teal/amber/indigo/violet) mark
identity only; green and red mean good and bad and nothing else does.
STORY: The owner opens this in the evening, reads whether the week held together
across training, food and money, and asks the coach the question the numbers raise.
FIRST VIEWPORT: Fixed 240px sidebar; content opens on a period header, then four
monumental tabular readings on one hairline-ruled row, then the training-volume
trend at full width as the main event, charts leading over tables.
FORM: Category standard (the standing exit), chosen over the assigned direction
"Reference Range"; craft bar Linear + Vercel + Stripe + Whoop. Seed key 87376984.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <div dangerouslySetInnerHTML={{ __html: `<!--${DIRECTION_CONTRACT}-->` }} />
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Nav />
          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1180px] px-5 py-7 lg:px-10 lg:py-10">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
