import LetterGrid from "@/components/home/LetterGrid";

/**
 * Template: interactive letter-grid hero with "ATOREUM" spelled into a
 * crossword-style noise grid and hover/scramble letter effects (see
 * LetterGrid.tsx).
 */
export default function CrosswordHero() {
  return (
    <section className="relative flex h-[calc(100svh-6rem)] w-full items-center justify-center overflow-hidden bg-ink px-4 py-8 md:h-[calc(100svh-7rem)] md:px-12">
      {/* Height subtracts main's header offset (pt-24/pt-28) so this section
          fills exactly the first screen and the grid centers truly within it. */}
      <h1 className="sr-only">Atoreum MV — Lebelage launch in the Maldives</h1>
      <div className="mx-auto -mt-[50px] w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-6xl">
        <LetterGrid />
      </div>
    </section>
  );
}
