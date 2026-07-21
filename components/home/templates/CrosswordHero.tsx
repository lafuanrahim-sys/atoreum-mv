import LetterGrid from "@/components/home/LetterGrid";

/**
 * Template: interactive letter-grid hero with "ATOREUM" spelled into a
 * crossword-style noise grid and hover/scramble letter effects (see
 * LetterGrid.tsx).
 */
export default function CrosswordHero() {
  return (
    <section className="relative flex h-[100svh] w-full items-start justify-center overflow-hidden bg-ink px-4 pb-16 pt-8 md:px-12 md:pt-12">
      <h1 className="sr-only">Atoreum MV — Lebelage launch in the Maldives</h1>
      <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-6xl">
        <LetterGrid />
      </div>
    </section>
  );
}
