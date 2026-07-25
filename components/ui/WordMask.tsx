import { Fragment } from "react";

/**
 * Pre-split headline words for masked reveals. Rendering the spans in JSX
 * (instead of rewriting innerHTML at runtime, SplitText-style) keeps the DOM
 * React-owned — runtime rewrites leave React holding references to removed
 * text nodes, which crashes reconciliation with removeChild errors on
 * re-render/navigation. splitWordReveal() in lib/motion.ts animates the
 * [data-word] spans; without JS (or with reduced motion) they simply render
 * as static text.
 */
export default function WordMask({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span aria-label={text}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span aria-hidden="true" className="inline-block overflow-hidden align-top">
            <span data-word className="inline-block">
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}
