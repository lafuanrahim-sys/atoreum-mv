"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motionDefaults, prefersReducedMotion } from "@/lib/motion";
import {
  BLOB_HUVADHOO,
  BLOB_KAAFU_1,
  BLOB_KAAFU_2,
  BLOB_LHAVIYANI,
  CANVAS,
  FLOWER_PETALS,
  MAP_CONTEXT,
  MAP_HUVADHOO,
  MAP_KAAFU_1,
  MAP_KAAFU_2,
  MAP_LHAVIYANI,
  SEAL_CIRCLE,
  TYPESET_MARKUP,
  WAVE_PATHS,
} from "@/components/home/logoOrigin/paths";

gsap.registerPlugin(ScrollTrigger);

const DESKTOP_QUERY = "(min-width: 768px)";

const TITLE_LINE_1 = "How Atoreum was made.";
const TITLE_LINE_2 = "Three origins. One ocean. One flower.";
const FLOWER_TEXT = "The Mugunghwa — South Korea's national flower — represents where Atoreum's journey began.";
const WAVE_TEXT = "A wave connecting two oceans — Korea to the Maldives.";

type Bbox = { x: number; y: number; width: number; height: number };

function frameSquare(bbox: Bbox, pad: number) {
  const size = Math.max(bbox.width, bbox.height) + pad * 2;
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  return `${cx - size / 2} ${cy - size / 2} ${size} ${size}`;
}

function centerOf(bbox: Bbox) {
  return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
}

/** One `<span>` per character, all starting invisible, for the shared
 * hand-rolled typewriter reveal (no `SplitText` plugin installed). */
function TypedLine({
  text,
  className,
  lineRef,
}: {
  text: string;
  className?: string;
  lineRef: React.RefObject<HTMLParagraphElement | null>;
}) {
  return (
    <p ref={lineRef} className={className}>
      {text.split("").map((ch, i) => (
        <span key={i} className="inline-block opacity-0">
          {ch === " " ? " " : ch}
        </span>
      ))}
    </p>
  );
}

export default function LogoOriginSequence() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const fallbackRef = useRef<HTMLDivElement | null>(null);
  const motionRootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const titleContainerRef = useRef<HTMLDivElement | null>(null);
  const titleLine1Ref = useRef<HTMLParagraphElement | null>(null);
  const titleLine2Ref = useRef<HTMLParagraphElement | null>(null);
  const flowerTextContainerRef = useRef<HTMLDivElement | null>(null);
  const flowerTextLineRef = useRef<HTMLParagraphElement | null>(null);
  const waveTextContainerRef = useRef<HTMLDivElement | null>(null);
  const waveTextLineRef = useRef<HTMLParagraphElement | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const artGroupRef = useRef<SVGGElement | null>(null);
  const contextGroupRef = useRef<SVGGElement | null>(null);
  const lhavMapRef = useRef<SVGPathElement | null>(null);
  const kaafuMapRef = useRef<SVGGElement | null>(null);
  const kaafu1MapRef = useRef<SVGPathElement | null>(null);
  const kaafu2MapRef = useRef<SVGPathElement | null>(null);
  const huvMapRef = useRef<SVGPathElement | null>(null);

  const lhavCalloutRef = useRef<SVGGElement | null>(null);
  const kaafuCalloutRef = useRef<SVGGElement | null>(null);
  const huvCalloutRef = useRef<SVGGElement | null>(null);
  const lhavLeaderRef = useRef<SVGLineElement | null>(null);
  const kaafuLeaderRef = useRef<SVGLineElement | null>(null);
  const huvLeaderRef = useRef<SVGLineElement | null>(null);
  const lhavDotRef = useRef<SVGCircleElement | null>(null);
  const kaafuDotRef = useRef<SVGCircleElement | null>(null);
  const huvDotRef = useRef<SVGCircleElement | null>(null);
  const lhavLabelRef = useRef<SVGTextElement | null>(null);
  const kaafuLabelRef = useRef<SVGTextElement | null>(null);
  const huvLabelRef = useRef<SVGTextElement | null>(null);

  const blobLhavRef = useRef<SVGPathElement | null>(null);
  const blobKaafu1Ref = useRef<SVGPathElement | null>(null);
  const blobKaafu2Ref = useRef<SVGPathElement | null>(null);
  const blobHuvadhooRef = useRef<SVGPathElement | null>(null);
  const sealRef = useRef<SVGCircleElement | null>(null);
  const sealGlowRef = useRef<SVGCircleElement | null>(null);
  const flowerGroupRef = useRef<SVGGElement | null>(null);
  const petalRefs = useRef<(SVGPathElement | null)[]>([]);
  const waveGroupRef = useRef<SVGGElement | null>(null);
  const waveClipRectRef = useRef<SVGRectElement | null>(null);
  const typesetRef = useRef<SVGGElement | null>(null);
  const resolvedRef = useRef<HTMLImageElement | null>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const fallback = fallbackRef.current;
    const motionRoot = motionRootRef.current;
    if (!section || !fallback || !motionRoot) return;

    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(DESKTOP_QUERY, () => {
        const svg = svgRef.current;
        const art = artGroupRef.current;
        const contextGroup = contextGroupRef.current;
        const lhavMap = lhavMapRef.current;
        const kaafuMap = kaafuMapRef.current;
        const kaafu1Map = kaafu1MapRef.current;
        const kaafu2Map = kaafu2MapRef.current;
        const huvMap = huvMapRef.current;
        const lhavCallout = lhavCalloutRef.current;
        const kaafuCallout = kaafuCalloutRef.current;
        const huvCallout = huvCalloutRef.current;
        const lhavLeader = lhavLeaderRef.current;
        const kaafuLeader = kaafuLeaderRef.current;
        const huvLeader = huvLeaderRef.current;
        const lhavDot = lhavDotRef.current;
        const kaafuDot = kaafuDotRef.current;
        const huvDot = huvDotRef.current;
        const lhavLabel = lhavLabelRef.current;
        const kaafuLabel = kaafuLabelRef.current;
        const huvLabel = huvLabelRef.current;
        const blobLhav = blobLhavRef.current;
        const blobKaafu1 = blobKaafu1Ref.current;
        const blobKaafu2 = blobKaafu2Ref.current;
        const blobHuvadhoo = blobHuvadhooRef.current;
        const seal = sealRef.current;
        const sealGlow = sealGlowRef.current;
        const petals = petalRefs.current.filter((p): p is SVGPathElement => !!p);
        const waveGroup = waveGroupRef.current;
        const waveClipRect = waveClipRectRef.current;
        const typeset = typesetRef.current;
        const resolved = resolvedRef.current;

        const titleContainer = titleContainerRef.current;
        const titleLine1 = titleLine1Ref.current;
        const titleLine2 = titleLine2Ref.current;
        const flowerTextContainer = flowerTextContainerRef.current;
        const flowerTextLine = flowerTextLineRef.current;
        const waveTextContainer = waveTextContainerRef.current;
        const waveTextLine = waveTextLineRef.current;

        if (
          !svg || !art || !contextGroup || !lhavMap || !kaafuMap || !kaafu1Map || !kaafu2Map || !huvMap ||
          !lhavCallout || !kaafuCallout || !huvCallout ||
          !lhavLeader || !kaafuLeader || !huvLeader ||
          !lhavDot || !kaafuDot || !huvDot ||
          !lhavLabel || !kaafuLabel || !huvLabel ||
          !blobLhav || !blobKaafu1 || !blobKaafu2 || !blobHuvadhoo || !seal || !sealGlow || !waveGroup ||
          !waveClipRect || !typeset || !resolved || petals.length !== 5 ||
          !titleContainer || !titleLine1 || !titleLine2 ||
          !flowerTextContainer || !flowerTextLine ||
          !waveTextContainer || !waveTextLine
        ) {
          return;
        }

        gsap.set(fallback, { display: "none" });
        gsap.set(motionRoot, { display: "flex" });

        // All geometry lives in the SVG's own 763.49-unit user space, which
        // is resolution-independent -- these bbox reads never need to be
        // redone on resize, unlike CoverflowArc's CSS-pixel measurements.
        const FULL_VB = `0 0 ${CANVAS} ${CANVAS}`;
        const sealVB = frameSquare(seal.getBBox(), 40);

        // Also pins transformOrigin to that same bbox center, explicitly, in
        // SVG user-space units. The rotate/scale constants baked into Scene
        // 4 below were computed offline against a pivot of "each shape's own
        // getBBox() center" -- without setting transformOrigin to match,
        // GSAP's default SVG origin handling doesn't reliably land on that
        // same point, so the fitted rotation/scale would pivot around a
        // different spot than the one they were fitted for, throwing the
        // whole registration off by an amount that grows with distance from
        // the true center (worse for larger scale/rotation, exactly the
        // symptom seen here).
        const flyTo = (fromEl: SVGGraphicsElement, toEl: SVGGraphicsElement) => {
          const a = centerOf(fromEl.getBBox());
          const b = centerOf(toEl.getBBox());
          gsap.set(fromEl, { transformOrigin: `${a.x} ${a.y}` });
          return { x: b.x - a.x, y: b.y - a.y };
        };
        // Translation is read live from each element's own getBBox(), so it's
        // always exact -- never a guessed offset. Kaafu flies as two
        // independent pieces (not one rigid group) so each lands precisely
        // on its own blob's center; that's what makes the gap between them
        // land on the logo's real measured gap instead of a scaled
        // approximation of the map's own (different) internal spacing.
        const lhavFly = flyTo(lhavMap, blobLhav);
        const kaafu1Fly = flyTo(kaafu1Map, blobKaafu1);
        const kaafu2Fly = flyTo(kaafu2Map, blobKaafu2);
        const huvFly = flyTo(huvMap, blobHuvadhoo);

        // Leader lines run rightward out of the map's narrow central column
        // into open canvas -- the map only occupies the horizontal center
        // ~15% of the 763-wide canvas, so there's ample clear space and the
        // three atolls sit at well-separated y-levels already, so same-side
        // leader lines never cross or collide.
        const placeCallout = (
          mapEl: SVGGraphicsElement,
          leader: SVGLineElement,
          dot: SVGCircleElement,
          label: SVGTextElement
        ) => {
          const b = mapEl.getBBox();
          const start = { x: b.x + b.width, y: b.y + b.height / 2 };
          const end = { x: start.x + 100, y: start.y };
          gsap.set(leader, { attr: { x1: start.x, y1: start.y, x2: end.x, y2: end.y } });
          gsap.set(dot, { attr: { cx: end.x, cy: end.y } });
          gsap.set(label, { attr: { x: end.x + 10, y: end.y }, x: 10 });
          const length = leader.getTotalLength();
          gsap.set(leader, { strokeDasharray: length, strokeDashoffset: length });
          gsap.set([dot, label], { opacity: 0 });
        };
        placeCallout(lhavMap, lhavLeader, lhavDot, lhavLabel);
        placeCallout(kaafuMap, kaafuLeader, kaafuDot, kaafuLabel);
        placeCallout(huvMap, huvLeader, huvDot, huvLabel);

        const waveBBox = waveGroup.getBBox();
        gsap.set(waveClipRect, {
          attr: { x: waveBBox.x - 4, y: waveBBox.y - 4, width: 0, height: waveBBox.height + 8 },
        });

        const flowerCenters = petals.map((p) => centerOf(p.getBBox()));
        const flowerCenter = {
          x: flowerCenters.reduce((s, c) => s + c.x, 0) / flowerCenters.length,
          y: flowerCenters.reduce((s, c) => s + c.y, 0) / flowerCenters.length,
        };
        // Angle from the flower's own center out to each petal's resting
        // spot -- used both for the initial off-screen placement below and
        // for the Scene 5 swirl-in tween, which spirals each petal in along
        // this same spoke rather than a straight line.
        const petalAngles = flowerCenters.map((c) => Math.atan2(c.y - flowerCenter.y, c.x - flowerCenter.x));
        petals.forEach((p, i) => {
          const c = flowerCenters[i];
          const angle = petalAngles[i];
          gsap.set(p, {
            transformOrigin: `${c.x} ${c.y}`,
            x: Math.cos(angle) * 240,
            y: Math.sin(angle) * 240,
            rotate: -110,
            scale: 0,
          });
        });

        gsap.set(svg, { attr: { viewBox: FULL_VB } });
        gsap.set(contextGroup, { opacity: 0 });
        gsap.set([lhavMap, kaafuMap, huvMap], { opacity: 0 });
        gsap.set([blobLhav, blobKaafu1, blobKaafu2, blobHuvadhoo], { opacity: 0 });
        const sealLength = seal.getTotalLength();
        gsap.set(seal, { strokeDasharray: sealLength, strokeDashoffset: sealLength });
        gsap.set(sealGlow, { opacity: 0 });
        gsap.set(waveGroup, { opacity: 0 });
        gsap.set(typeset, { opacity: 0 });
        gsap.set(resolved, { opacity: 0 });
        gsap.set(art, { opacity: 1 });

        gsap.set(titleContainer, { opacity: 1 });
        gsap.set(flowerTextContainer, { opacity: 0 });
        gsap.set(waveTextContainer, { opacity: 0 });

        const tl = gsap.timeline({
          defaults: { ease: motionDefaults.ease },
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${Math.max(window.innerHeight * 9, 6200)}`,
            scrub: 1,
            pin: true,
            invalidateOnRefresh: true,
          },
        });

        const typeIn = (
          line: HTMLParagraphElement,
          options: { position?: string | number; charStagger?: number } = {}
        ) =>
          tl.to(line.querySelectorAll("span"), {
            opacity: 1,
            duration: 0.02,
            stagger: options.charStagger ?? 0.03,
          }, options.position);

        // Scene 1: title card -- two lines type on in sequence, hold, fade.
        // Held a beat longer than a snappy explainer would -- the opening
        // line is the one moment with nothing else competing for attention.
        typeIn(titleLine1);
        typeIn(titleLine2, { position: "+=0.4" });
        tl.to(titleContainer, { opacity: 0, duration: 0.8 }, "+=0.9");

        // Scene 2: the map rolls in -- the three story atolls read as more
        // present than the rest of the chain even before they're labeled.
        tl.to(contextGroup, { opacity: 0.3, duration: 1.3 })
          .to([lhavMap, kaafuMap, huvMap], { opacity: 0.75, duration: 1.3 }, "<");

        // Scene 3: label each atoll in turn -- highlight, leader line draws
        // on, terminal dot + name fade/slide in. No camera zoom this time;
        // all three are named at the one wide framing.
        const labelBeat = (
          mapEl: SVGGraphicsElement,
          leader: SVGLineElement,
          dot: SVGCircleElement,
          label: SVGTextElement
        ) => {
          tl.to(mapEl, { opacity: 1, strokeWidth: 3, duration: 0.7 })
            .to(leader, { strokeDashoffset: 0, duration: 0.6 }, "<0.1")
            .to(dot, { opacity: 1, duration: 0.35 }, "<0.35")
            .to(label, { opacity: 1, x: 0, duration: 0.6 }, "<");
        };
        labelBeat(lhavMap, lhavLeader, lhavDot, lhavLabel);
        labelBeat(kaafuMap, kaafuLeader, kaafuDot, kaafuLabel);
        labelBeat(huvMap, huvLeader, huvDot, huvLabel);
        tl.to({}, { duration: 0.9 }); // hold, all three labeled
        tl.to([lhavCallout, kaafuCallout, huvCallout], { opacity: 0, duration: 0.6 });

        // Scene 4: the three labeled atolls detach from the map and settle
        // into their real seal-blob geometry; the rest of the chain fades
        // away entirely; the seal draws itself in around them.
        //
        // Each atoll's end transform is computed, not eyeballed: translation
        // is read live from getBBox() (exact, always), scale is the ratio
        // that matches the source and target shapes' areas exactly
        // (sqrt(targetArea/sourceArea)), and rotation is each shape's PCA
        // principal-axis angle relative to its target's, with the 180°
        // ambiguity resolved by picking whichever orientation actually
        // nests inside the target silhouette. Kaafu flies as two
        // independent pieces -- kaafu1Map/kaafu2Map, each targeting its own
        // blob -- so the gap between them lands on the logo's real
        // measured gap by construction, not a scaled copy of the map's own
        // (different) internal spacing. See logoOrigin/paths.ts for the
        // measured reference gap.
        //
        // A real map contour and a hand-stylized logo blob are never
        // literally the same curve, so the fit above is a best-fit, not a
        // pixel-identical one -- there's always a thin residual gap
        // somewhere along the outline. Thickening the map stroke to match
        // the blob's own 8px as it flies (rather than leaving it at the
        // Scene-3 highlight width) absorbs that residual into the line
        // weight instead of showing it as a hairline ghost during the
        // opacity crossfade.
        //
        // Also fading fillOpacity to 0 here, not just bumping strokeWidth:
        // the map shapes carry a 0.16 fill for legibility at their small
        // on-map size, but that fill's *area* scales with scale² -- at the
        // ~1.6-1.7x this fly-in applies, the once-subtle tint becomes an
        // obviously mismatched dark silhouette poking out from behind the
        // thin blob outline. Dropping to fill:none (matching the blob's own
        // fill:none) makes the crossfade outline-to-outline instead of
        // filled-shape-to-outline.
        tl.to(svg, { attr: { viewBox: sealVB }, duration: 1.7 })
          .to(contextGroup, { opacity: 0, duration: 1.1 }, "<")
          .to(lhavMap, { x: lhavFly.x, y: lhavFly.y, scale: 1.707, rotate: 174.9, strokeWidth: 8, fillOpacity: 0, duration: 1.4 }, "<0.2")
          .to(kaafu1Map, { x: kaafu1Fly.x, y: kaafu1Fly.y, scale: 1.633, rotate: -76.5, strokeWidth: 8, fillOpacity: 0, duration: 1.4 }, "<0.1")
          .to(kaafu2Map, { x: kaafu2Fly.x, y: kaafu2Fly.y, scale: 1.634, rotate: -88.6, strokeWidth: 8, fillOpacity: 0, duration: 1.4 }, "<0")
          .to(huvMap, { x: huvFly.x, y: huvFly.y, scale: 1.654, rotate: -84.6, strokeWidth: 8, fillOpacity: 0, duration: 1.4 }, "<0.1")
          .to([blobLhav, blobKaafu1, blobKaafu2, blobHuvadhoo], { opacity: 1, duration: 0.9 }, "<0.5")
          .to([lhavMap, kaafuMap, huvMap], { opacity: 0, duration: 0.7 }, "<");

        tl.to(seal, { strokeDashoffset: 0, duration: 1.4, ease: "power2.inOut" });

        // Scene 5: the flower -- narrative line, then the petals swirl into
        // place. Each one spirals inward along its own spoke (radius
        // shrinking, angle unwinding a turn and a bit) instead of gliding
        // straight in, and its own spin settles from several extra
        // rotations down to rest -- reads as the flower assembling itself
        // with a gentle swirl, not just growing. Unhurried power3.inOut,
        // not overshoot -- a bouncy spring reads as playful/explainer-grade,
        // not as a flower easing open, so this departs from an earlier
        // draft that used back.out(1.25) here.
        typeIn(flowerTextLine, { charStagger: 0.022 });
        tl.to(flowerTextContainer, { opacity: 1, duration: 0.01 }, "<");
        const SWIRL_TURNS = 1.15;
        petals.forEach((p, i) => {
          const baseAngle = petalAngles[i];
          const rotateStart = -110 - 360 * SWIRL_TURNS;
          const swirl = { t: 0 };
          tl.to(swirl, {
            t: 1,
            duration: 1.5,
            ease: "power3.inOut",
            onUpdate: () => {
              const radius = 240 * (1 - swirl.t);
              const angle = baseAngle + SWIRL_TURNS * Math.PI * 2 * (1 - swirl.t);
              gsap.set(p, {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                rotate: rotateStart * (1 - swirl.t),
                scale: swirl.t,
              });
            },
          }, i === 0 ? "<0.3" : "<0.16");
        });
        tl.to(flowerTextContainer, { opacity: 0, duration: 0.7 }, "+=0.6");

        // Scene 6: the wave -- narrative line, then the wave-form (a filled
        // organic shape, not a stroked line, so a clip-path wipe stands in
        // for stroke-dashoffset here) wipes in. The wave text fully clears
        // *before* the camera pulls back to the full lockup and the
        // wordmark/tick-mark typeset fades in -- both occupy the same
        // bottom-of-frame region, so they must never be on screen together.
        typeIn(waveTextLine, { charStagger: 0.022 });
        tl.to(waveTextContainer, { opacity: 1, duration: 0.01 }, "<")
          .set(waveGroup, { opacity: 1 })
          .to(waveClipRect, { attr: { width: waveBBox.width + 8 }, duration: 1.4, ease: "power2.inOut" }, "<0.2");
        tl.to(waveTextContainer, { opacity: 0, duration: 0.6 }, "+=0.5");
        tl.to(svg, { attr: { viewBox: FULL_VB }, duration: 1.5 })
          .to(typeset, { opacity: 1, duration: 0.9 }, "<0.5");

        // Scene 7: resolve into the real shipped asset -- the payoff, held
        // longer than the other beats -- then Scene 8 (unpin) is automatic.
        // A soft, low-opacity glow breathes in behind the seal on arrival --
        // a quiet sell of the "arrival" moment, not a bloom/glow effect.
        tl.to(art, { opacity: 0, duration: 1.4, ease: "power1.inOut" }, "+=0.3")
          .to(resolved, { opacity: 1, duration: 1.4, ease: "power1.inOut" }, "<")
          .to(sealGlow, { opacity: 0.5, duration: 1.8, ease: "power2.out" }, "<0.2")
          .to({}, { duration: 1.6 });

        return () => {
          gsap.set(fallback, { display: "flex" });
          gsap.set(motionRoot, { display: "none" });
        };
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className="logo-origin-section relative flex h-[100svh] w-full items-center justify-center overflow-hidden bg-ink"
    >
      {/* Default / reduced-motion / mobile fallback: the narrative told as a
          static readable block above the real shipped logo, no animation. */}
      <div ref={fallbackRef} className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="max-w-xl space-y-3">
          <p className="font-display text-xl italic tracking-wide text-ivory md:text-3xl">{TITLE_LINE_1}</p>
          <div className="mx-auto h-px w-10 bg-gold/60" />
          <p className="font-montserrat text-base font-light tracking-wide text-ivory-dim md:text-lg">{TITLE_LINE_2}</p>
        </div>
        <img src="/atoreum-logo.svg" alt="Atoreum" className="w-[52vw] max-w-[420px]" />
        <div className="max-w-md space-y-3 font-montserrat text-sm font-light leading-relaxed text-ivory-dim">
          <p>{FLOWER_TEXT}</p>
          <p>{WAVE_TEXT}</p>
        </div>
      </div>

      {/* Desktop, motion-safe: the art stage is the visually centered
          element on the page -- a mirror-image spacer on the left balances
          the real caption column on the right, so the stage's center always
          lands on the page's center regardless of whether any caption text
          is currently visible (an unbalanced single side column would look
          "centered as a group" but visually off-center, since an empty text
          slot doesn't read the same as a matching blank spacer). Caption
          and stage are still separate flex children, never absolutely
          overlaid, so narrative text structurally cannot intersect the
          circular seal at any breakpoint. */}
      <div
        ref={motionRootRef}
        className="relative hidden w-full max-w-6xl flex-1 flex-row items-center justify-center gap-10 px-6 md:gap-16 lg:gap-20"
      >
        <div aria-hidden className="h-72 w-72 shrink-0 md:h-80 md:w-80" />

        <div ref={stageRef} className="logo-origin-stage relative aspect-square w-[min(40vw,62vh)] shrink-0">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS} ${CANVAS}`}
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <clipPath id="logo-origin-wave-clip">
                <rect ref={waveClipRectRef} x={0} y={0} width={0} height={0} />
              </clipPath>
              <filter id="logo-origin-seal-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="16" />
              </filter>
              <style>{`
                .logo-origin-st0, .logo-origin-st2, .logo-origin-st3 { fill: none; }
                .logo-origin-st4, .logo-origin-st5 { fill: #6c7770; }
                .logo-origin-st6 { fill: #e9baa6; }
                .logo-origin-st7 { fill: #545c57; }
                .logo-origin-st2, .logo-origin-st5, .logo-origin-st3 { stroke: #6c7770; stroke-miterlimit: 10; }
                .logo-origin-st2, .logo-origin-st5 { stroke-width: .75px; }
                .logo-origin-st8 { fill: #8eaba5; }
                .logo-origin-st3 { stroke-width: 4px; }
              `}</style>
            </defs>

            {/* Soft glow behind the seal, faded in only on the Scene 7
                arrival -- kept low-opacity and heavily blurred so it reads
                as ambient light, not a bloom/highlight effect. Deliberately
                a sibling of artGroup, not nested inside it: artGroup itself
                fades to opacity 0 in Scene 7, which would cancel out the
                glow's own fade-in if it lived inside that group. */}
            <circle
              ref={sealGlowRef}
              cx={SEAL_CIRCLE.cx}
              cy={SEAL_CIRCLE.cy}
              r={SEAL_CIRCLE.r * 0.92}
              fill="var(--gold)"
              fillOpacity={0.4}
              filter="url(#logo-origin-seal-glow)"
            />

            <g ref={artGroupRef}>
              {/* Faint full-chain context, for atmosphere only -- never focused on. */}
              <g ref={contextGroupRef} fill="none" stroke="var(--gold-soft)" strokeWidth={1.1}>
                {MAP_CONTEXT.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>

              {/* Map-traced realistic silhouettes of the three story atolls.
                  Kaafu's two pieces keep individual path refs (kaafu1MapRef/
                  kaafu2MapRef) alongside the shared group ref -- the group
                  still carries the one shared callout/highlight, but Scene 4
                  flies each piece to its own blob independently.
                  vector-effect="non-scaling-stroke" is load-bearing here:
                  Scene 4 scales these paths up to ~1.6-1.7x via a CSS
                  transform while ALSO animating strokeWidth 3->8 -- without
                  this, the rendered stroke is strokeWidth *times* the
                  transform scale (SVG stroke-width lives in the same local
                  space the transform scales), so by the end of the fly an
                  "8px" stroke was actually rendering near 13px and nearly
                  filling the smaller atoll pieces solid. This attribute
                  keeps the stroke a true, constant width regardless of the
                  scale transform applied to the element. */}
              <path ref={lhavMapRef} d={MAP_LHAVIYANI} fill="var(--gold-soft)" fillOpacity={0.16} stroke="var(--gold)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <g ref={kaafuMapRef} fill="var(--gold-soft)" fillOpacity={0.16} stroke="var(--gold)" strokeWidth={2}>
                <path ref={kaafu1MapRef} d={MAP_KAAFU_1} vectorEffect="non-scaling-stroke" />
                <path ref={kaafu2MapRef} d={MAP_KAAFU_2} vectorEffect="non-scaling-stroke" />
              </g>
              <path ref={huvMapRef} d={MAP_HUVADHOO} fill="var(--gold-soft)" fillOpacity={0.16} stroke="var(--gold)" strokeWidth={2} vectorEffect="non-scaling-stroke" />

              {/* Leader-line callouts: hairline stroke with a small hollow
                  ring terminal (cartographic annotation, not an infographic
                  arrowhead) -- draw on, name the atoll, retract once all
                  three have been read. */}
              <g ref={lhavCalloutRef}>
                <line ref={lhavLeaderRef} stroke="var(--gold)" strokeWidth={0.75} />
                <circle ref={lhavDotRef} r={3.5} fill="none" stroke="var(--gold)" strokeWidth={1} />
                <text ref={lhavLabelRef} dominantBaseline="middle" fontSize={9.5} letterSpacing={3.5} fill="var(--gold)" style={{ fontFamily: "var(--font-sans), sans-serif" }}>
                  LHAVIYANI ATOLL
                </text>
              </g>
              <g ref={kaafuCalloutRef}>
                <line ref={kaafuLeaderRef} stroke="var(--gold)" strokeWidth={0.75} />
                <circle ref={kaafuDotRef} r={3.5} fill="none" stroke="var(--gold)" strokeWidth={1} />
                <text ref={kaafuLabelRef} dominantBaseline="middle" fontSize={9.5} letterSpacing={3.5} fill="var(--gold)" style={{ fontFamily: "var(--font-sans), sans-serif" }}>
                  KAAFU ATOLL
                </text>
              </g>
              <g ref={huvCalloutRef}>
                <line ref={huvLeaderRef} stroke="var(--gold)" strokeWidth={0.75} />
                <circle ref={huvDotRef} r={3.5} fill="none" stroke="var(--gold)" strokeWidth={1} />
                <text ref={huvLabelRef} dominantBaseline="middle" fontSize={9.5} letterSpacing={3.5} fill="var(--gold)" style={{ fontFamily: "var(--font-sans), sans-serif" }}>
                  HUVADHOO
                </text>
              </g>

              {/* Their real seal-blob targets -- brand geometry and color, exact. */}
              <path ref={blobLhavRef} d={BLOB_LHAVIYANI} fill="none" stroke="#8eaba5" strokeWidth={8} />
              <path ref={blobHuvadhooRef} d={BLOB_HUVADHOO} fill="none" stroke="#8eaba5" strokeWidth={8} />
              <path ref={blobKaafu1Ref} d={BLOB_KAAFU_1} fill="none" stroke="#8eaba5" strokeWidth={8} />
              <path ref={blobKaafu2Ref} d={BLOB_KAAFU_2} fill="none" stroke="#8eaba5" strokeWidth={8} />

              <circle ref={sealRef} cx={SEAL_CIRCLE.cx} cy={SEAL_CIRCLE.cy} r={SEAL_CIRCLE.r} fill="none" stroke="#6c7770" strokeWidth={4} />

              <g ref={flowerGroupRef} fill="#e9baa6">
                {FLOWER_PETALS.map((d, i) => (
                  <path
                    key={i}
                    ref={(el) => {
                      petalRefs.current[i] = el;
                    }}
                    d={d}
                  />
                ))}
              </g>

              <g ref={waveGroupRef} fill="#6c7770" clipPath="url(#logo-origin-wave-clip)">
                {WAVE_PATHS.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>

              {/* Wordmark, tick marks, accent dot -- copied verbatim from
                  public/atoreum-logo.svg so the pre-crossfade frame already
                  matches it exactly. Injected as raw markup (all static,
                  developer-authored -- see logoOrigin/paths.ts) to keep this
                  component readable. */}
              <g ref={typesetRef} dangerouslySetInnerHTML={{ __html: TYPESET_MARKUP }} />
            </g>
          </svg>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={resolvedRef}
            src="/atoreum-logo.svg"
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          />
        </div>

        <div className="relative z-10 flex h-72 w-72 shrink-0 items-center justify-start text-left md:h-80 md:w-80">
          <div ref={titleContainerRef} className="pointer-events-none absolute inset-0 flex flex-col items-start justify-center gap-4">
            <TypedLine text={TITLE_LINE_1} lineRef={titleLine1Ref} className="font-display text-2xl italic tracking-wide text-ivory md:text-4xl" />
            <div className="h-px w-12 bg-gold/60" />
            <TypedLine text={TITLE_LINE_2} lineRef={titleLine2Ref} className="font-montserrat text-lg font-light tracking-wide text-ivory-dim md:text-2xl" />
          </div>

          <div ref={flowerTextContainerRef} className="pointer-events-none absolute inset-0 flex items-center justify-start">
            <TypedLine text={FLOWER_TEXT} lineRef={flowerTextLineRef} className="max-w-xs font-montserrat text-base font-light leading-relaxed tracking-wide text-ivory md:text-xl" />
          </div>

          <div ref={waveTextContainerRef} className="pointer-events-none absolute inset-0 flex items-center justify-start">
            <TypedLine text={WAVE_TEXT} lineRef={waveTextLineRef} className="max-w-xs font-montserrat text-base font-light leading-relaxed tracking-wide text-ivory md:text-xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
