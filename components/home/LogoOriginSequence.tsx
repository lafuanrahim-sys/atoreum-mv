"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
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

// The mobile address bar showing/hiding mid-scroll changes window.innerHeight
// on its own, which otherwise makes ScrollTrigger think a real resize
// happened and re-run its (expensive, and for a pinned scene, disruptive)
// refresh — a well-documented cause of pinned scroll animations desyncing
// or freezing specifically on real phones despite working fine against any
// desktop-simulated mobile width. This is GSAP's own documented fix.
ScrollTrigger.config({ ignoreMobileResize: true });

const TITLE_LINE_1 = "How Atoreum was made.";
const TITLE_LINE_2 = "Three origins, one name. Korea's beauty, carried home to the Maldives.";
const FLOWER_TEXT = "The Mugunghwa — South Korea's national flower — represents where Atoreum's journey began.";
const WAVE_TEXT = "A wave connecting two oceans — Korea to the Maldives.";

// Below md the caption column stacks full-width under the stage (see the
// layout below) so the text gets a generous phone-appropriate max-width;
// from md up every value here is untouched from the original desktop
// design and matches the caption column's own width tiers there
// (md:h-36→lg:h-48→xl:h-64→2xl:h-80) so the text never has more max-width
// than the column it sits in has room for before hitting the section's
// overflow-hidden edge.
const CAPTION_TEXT_CLASS =
  "max-w-xs text-base font-montserrat font-light leading-relaxed tracking-wide text-ivory md:max-w-[9rem] md:text-sm lg:max-w-[12rem] xl:max-w-[16rem] xl:text-base 2xl:max-w-xs 2xl:text-xl";

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

/** One `<span class="char">` per character, all starting invisible, for the
 * shared hand-rolled typewriter reveal (no `SplitText` plugin installed).
 * Characters are grouped word-by-word, each word wrapped in its own atomic
 * `inline-block` -- giving each character its own box for the stagger
 * reveal, while keeping the browser's line-wrapping decision at the *word*
 * level, never mid-word. The space between words is rendered as a plain
 * text node *outside* any inline-block, a sibling in the flow between word
 * spans, not as its own `.char` span: a space that is the sole content of
 * an inline-block collapses to zero width (it's trimmed as leading/trailing
 * whitespace of that box), which is what previously rendered as words
 * running together with no gap at all, even though the *wrap* still
 * (correctly) happened at that point. An earlier draft also once used a
 * non-breaking space here by mistake, which independently breaks wrapping
 * (a line can never break at a non-breaking space) -- both failure modes
 * are avoided by using a real, breakable space that isn't wrapped in
 * anything. */
function TypedLine({
  text,
  className,
  lineRef,
}: {
  text: string;
  className?: string;
  lineRef: React.RefObject<HTMLParagraphElement | null>;
}) {
  const words = text.split(" ");
  let charIndex = 0;
  const nodes = words.flatMap((word, wi) => {
    const wordSpan = (
      <span key={`w${wi}`} className="inline-block">
        {word.split("").map((ch) => {
          const key = charIndex++;
          return (
            <span key={key} className="char inline-block opacity-0">
              {ch}
            </span>
          );
        })}
      </span>
    );
    return wi < words.length - 1 ? [wordSpan, " "] : [wordSpan];
  });
  return (
    <p ref={lineRef} className={className} lang="en">
      {nodes}
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
  const ctaRef = useRef<HTMLAnchorElement | null>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const fallback = fallbackRef.current;
    const motionRoot = motionRootRef.current;
    if (!section || !fallback || !motionRoot) return;

    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
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
        const cta = ctaRef.current;

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
          !waveClipRect || !typeset || !resolved || !cta || petals.length !== 5 ||
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

        // Returns each shape's own bbox center (the pivot the rotate/scale
        // constants below were fitted against) plus the plain translation
        // needed to land on the target blob's center, and the shape's own
        // half-width/half-height (see flyWithPivot for why).
        //
        // Neither transformOrigin nor svgOrigin actually pivots these SVG
        // paths around the point handed to them -- verified with an isolated
        // GSAP+SVG test page outside this component: gsap.set(el, {x:0, y:0,
        // rotate:90, scale:2}) on a plain path, with NO origin set at all,
        // produced a nonzero translate in the resulting matrix that exactly
        // matches pivoting around the shape's bbox **top-left corner**
        // (bbox.x, bbox.y) -- not (0,0), not the bbox center, and not
        // whatever transformOrigin/svgOrigin was asked for. That default
        // silently overrides any origin this component tries to set. For a
        // shape whose true center sits ~13 units from its own top-left but
        // whose position in the 763-unit canvas is ~400 units from literal
        // (0,0), rotating ~175 degrees around the WRONG one of those swings
        // the rendered shape by a large, canvas-scale amount instead of a
        // small, shape-scale amount -- exactly the "flies out of view" bug.
        // flyWithPivot() below works around it by computing, by hand, the
        // translate that reproduces true-center pivoting given that GSAP's
        // real baseline is the bbox corner.
        // The atoll doesn't stop precisely on its blob's outline -- it flies
        // to a point a small fixed distance *above* it (STOP_OFFSET_PX,
        // converted from real screen pixels to this SVG's own user-space
        // units via the stage's actual rendered size) and comes to rest
        // there; reaching that point is what triggers the blob to start
        // fading in ("mapExit" below), so the arrival itself reads as
        // cueing the logo to life rather than the atoll settling exactly
        // into the logo's own geometry.
        const STOP_OFFSET_PX = 10;
        const unitsPerPx = CANVAS / svg.getBoundingClientRect().width;
        const stopOffsetUnits = STOP_OFFSET_PX * unitsPerPx;
        const flyTo = (fromEl: SVGGraphicsElement, toEl: SVGGraphicsElement) => {
          const bbox = fromEl.getBBox();
          const a = centerOf(bbox);
          const b = centerOf(toEl.getBBox());
          return {
            delta: { x: b.x - a.x, y: b.y - stopOffsetUnits - a.y },
            halfExtent: { x: bbox.width / 2, y: bbox.height / 2 },
          };
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

        // Animates x/y/rotate/scale via a proxy tween instead of a plain
        // .to(). GSAP's real (undocumented, unoverridable here) pivot is the
        // shape's own bbox top-left corner D, so rendering a point Q is
        // D + linearPart*(Q-D) + (x,y) -- NOT the usual "rotate around the
        // point you ask for" behavior. To make the shape's true center C
        // land exactly on the target (C + delta), solve that equation for
        // (x,y) with Q=C: (x,y) = halfExtent - linearPart*halfExtent + delta,
        // where halfExtent = C-D (half the bbox width/height) and
        // linearPart = rotate+scale's 2x2 matrix. An earlier version of this
        // had that middle term's sign flipped (linearPart*halfExtent -
        // halfExtent instead of halfExtent - linearPart*halfExtent), which
        // fixed the mid-flight excursion but left every shape landing
        // consistently off-target by roughly twice the (small) correction
        // term -- confirmed against an isolated GSAP+SVG test page outside
        // this component, and against a `getCTM()`-based check of where this
        // component's own atoll shapes actually rendered relative to their
        // target blobs.
        //
        // ease matches a plain .to()'s default (power1.out) -- the shape is
        // meant to visibly come to rest at the stop point 10px above its
        // blob, so a decelerating arrival is the right read here. It's not
        // the "stops, then just fades" stall from earlier in this scene's
        // history because the fade (below) is timed to already be
        // essentially transparent by the time this deceleration becomes
        // noticeable, not lingering fully opaque on a now-still shape.
        const flyWithPivot = (
          el: SVGGraphicsElement,
          fly: { delta: { x: number; y: number }; halfExtent: { x: number; y: number } },
          targetScale: number,
          targetRotateDeg: number,
          duration: number,
          position: string
        ) => {
          const { delta, halfExtent } = fly;
          const targetRad = (targetRotateDeg * Math.PI) / 180;
          const proxy = { t: 0 };
          tl.to(proxy, {
            t: 1,
            duration,
            ease: "power1.out",
            onUpdate: () => {
              const t = proxy.t;
              const theta = targetRad * t;
              const s = 1 + (targetScale - 1) * t;
              const cos = Math.cos(theta) * s;
              const sin = Math.sin(theta) * s;
              const x = halfExtent.x - (cos * halfExtent.x - sin * halfExtent.y) + delta.x * t;
              const y = halfExtent.y - (sin * halfExtent.x + cos * halfExtent.y) + delta.y * t;
              gsap.set(el, { x, y, rotate: theta * (180 / Math.PI), scale: s });
            },
          }, position);
        };

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

        // Mobile-only camera zoom for the map-trace scene (2-3): the map's
        // own real content -- the three atoll silhouettes plus their
        // leader-line/label callouts, read live via getBBox() now that
        // placeCallout has positioned everything -- only fills a fraction
        // of the full square canvas (MAP_CONTEXT's faint full-chain
        // atmosphere spans much taller, which is why the plain container
        // upsize alone barely moved the needle on a small phone stage).
        // Framing tightly around just that real content and excluding the
        // atmosphere layer (explicitly "for atmosphere only -- never
        // focused on", so minor clipping of its faint extremities is an
        // acceptable trade) makes the map and its labels meaningfully
        // bigger and more legible on mobile without touching desktop,
        // which stays on FULL_VB throughout.
        const isMobile = window.innerWidth < 768;
        const mapBBoxes = [lhavMap, kaafuMap, huvMap, lhavCallout, kaafuCallout, huvCallout].map((el) =>
          el.getBBox()
        );
        const mapBBoxUnion = mapBBoxes.slice(1).reduce<Bbox>((acc, b) => {
          const minX = Math.min(acc.x, b.x);
          const minY = Math.min(acc.y, b.y);
          const maxX = Math.max(acc.x + acc.width, b.x + b.width);
          const maxY = Math.max(acc.y + acc.height, b.y + b.height);
          return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }, mapBBoxes[0]);
        const mapVB = frameSquare(mapBBoxUnion, 45);

        const waveBBox = waveGroup.getBBox();
        gsap.set(waveClipRect, {
          attr: { x: waveBBox.x - 4, y: waveBBox.y - 4, width: 0, height: waveBBox.height + 8 },
        });

        const petalBBoxes = petals.map((p) => p.getBBox());
        const flowerCenters = petalBBoxes.map((b) => centerOf(b));
        // Each petal's own half-width/half-height -- see flyWithPivot's
        // comment above for why the swirl-in tween needs this (same
        // GSAP-doesn't-honor-transformOrigin-for-SVG-paths issue, here
        // affecting a spiral with an even larger rotation range than the
        // atoll fly).
        const petalHalfExtents = petalBBoxes.map((b) => ({ x: b.width / 2, y: b.height / 2 }));
        const flowerCenter = {
          x: flowerCenters.reduce((s, c) => s + c.x, 0) / flowerCenters.length,
          y: flowerCenters.reduce((s, c) => s + c.y, 0) / flowerCenters.length,
        };
        // Angle from the flower's own center out to each petal's resting
        // spot -- used both for the initial off-screen placement below and
        // for the Scene 5 swirl-in tween, which spirals each petal in along
        // this same spoke rather than a straight line.
        const petalAngles = flowerCenters.map((c) => Math.atan2(c.y - flowerCenter.y, c.x - flowerCenter.x));
        // Placed at scale 0 (so pivot/position is moot at rest -- a
        // zero-area shape is invisible anywhere), but at the same angle the
        // swirl-in below starts from (baseAngle + a full SWIRL_TURNS extra
        // winds), not the plain resting angle -- otherwise the very first
        // swirl frames jump from this rest angle to the swirl's own start
        // angle while scale is already just barely nonzero, popping briefly
        // into view off to one side before snapping onto the spiral.
        const SWIRL_TURNS = 1.15;
        // By Scene 5 the camera has already zoomed to the tight seal crop
        // (sealVB, ~512 units wide, half-width ~256) rather than the full
        // 763-unit canvas -- a swirl-in starting radius has to fit inside
        // that tighter frame, not the full canvas, or the outermost part of
        // the spiral (still near its max radius in the first few frames)
        // pokes past the crop's edge.
        const SWIRL_RADIUS = 125;
        petals.forEach((p, i) => {
          const angle = petalAngles[i] + SWIRL_TURNS * Math.PI * 2;
          gsap.set(p, {
            x: Math.cos(angle) * SWIRL_RADIUS,
            y: Math.sin(angle) * SWIRL_RADIUS,
            rotate: -110,
            scale: 0,
          });
        });

        gsap.set(svg, { attr: { viewBox: isMobile ? mapVB : FULL_VB } });
        gsap.set(contextGroup, { opacity: 0 });
        gsap.set([lhavMap, kaafuMap, huvMap], { opacity: 0 });
        gsap.set([blobLhav, blobKaafu1, blobKaafu2, blobHuvadhoo], { opacity: 0 });
        const sealLength = seal.getTotalLength();
        gsap.set(seal, { strokeDasharray: sealLength, strokeDashoffset: sealLength });
        gsap.set(sealGlow, { opacity: 0 });
        gsap.set(waveGroup, { opacity: 0 });
        gsap.set(typeset, { opacity: 0 });
        gsap.set(resolved, { opacity: 0 });
        gsap.set(cta, { opacity: 0, pointerEvents: "none" });
        gsap.set(art, { opacity: 1 });

        // Overlay title: shown only in this desktop motion mode (the static
        // fallback carries its own title). Line 1 is a plain, always-visible
        // paragraph, so the very first painted frame — before any scroll —
        // already reads "How Atoreum was made." at full size.
        gsap.set(titleContainer, { display: "flex", opacity: 1 });
        gsap.set(flowerTextContainer, { opacity: 0 });
        gsap.set(waveTextContainer, { opacity: 0 });

        const tl = gsap.timeline({
          defaults: { ease: motionDefaults.ease },
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${Math.max(window.innerHeight * 4.5, 3600)}`,
            scrub: 1,
            pin: true,
            invalidateOnRefresh: true,
          },
        });

        const typeIn = (
          line: HTMLParagraphElement,
          options: { position?: string | number; charStagger?: number } = {}
        ) =>
          tl.to(line.querySelectorAll("span.char"), {
            opacity: 1,
            duration: 0.02,
            stagger: options.charStagger ?? 0.03,
          }, options.position);

        // Scene 1: title card. Line 1 is already on screen at progress 0
        // (pre-revealed above); a short lead-in beat keeps it alone for the
        // first nudge of scroll, then line 2 pops on — typing in with a
        // small rise — holds, and the whole card fades into the map.
        tl.to({}, { duration: 0.35 });
        typeIn(titleLine2);
        tl.fromTo(titleLine2, { y: 16 }, { y: 0, duration: 0.5, ease: "power2.out" }, "<");
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
          tl.to(mapEl, { opacity: 1, strokeWidth: 3, fillOpacity: 0.5, duration: 0.7 })
            .to(leader, { strokeDashoffset: 0, opacity: 1, duration: 0.6 }, "<0.1")
            .to(dot, { opacity: 1, duration: 0.35 }, "<0.35")
            .to(label, { opacity: 1, x: 0, duration: 0.6 }, "<");
        };
        labelBeat(lhavMap, lhavLeader, lhavDot, lhavLabel);
        labelBeat(kaafuMap, kaafuLeader, kaafuDot, kaafuLabel);
        labelBeat(huvMap, huvLeader, huvDot, huvLabel);
        tl.to({}, { duration: 0.9 }); // hold, all three labeled
        tl.to([lhavCallout, kaafuCallout, huvCallout], { opacity: 0, duration: 0.6 });
        // Mobile only: camera was zoomed in tight on the map for scenes 2-3
        // (mapVB, computed above) so it reads legibly on a small square
        // stage -- pull back out to the full canvas here, concurrent with
        // the callout fade-out just above, so the camera is already back
        // on FULL_VB before Scene 4's atoll flight starts (which needs the
        // full canvas -- see that scene's own comment below -- to
        // guarantee nothing clips mid-flight).
        if (isMobile) tl.to(svg, { attr: { viewBox: FULL_VB }, duration: 1.3 }, "<");

        // Scene 4: the three labeled atolls detach from the map and fly to a
        // point just above their real seal-blob geometry (see STOP_OFFSET_PX
        // above), coming to rest there rather than landing exactly on the
        // blob's own outline; the rest of the chain fades away entirely; the
        // seal draws itself in around the blobs once the atolls have
        // arrived and faded.
        //
        // Each atoll's direction/rotation/scale is computed, not eyeballed,
        // from its real target blob: direction is read live from getBBox()
        // (exact, always, offset by the fixed stop distance), scale is the
        // ratio that matches the source and target shapes' areas exactly
        // (sqrt(targetArea / sourceArea)), and rotation is each shape's PCA
        // principal-axis angle relative to its target's, with the 180°
        // ambiguity resolved by picking whichever orientation actually nests
        // inside the target silhouette. Kaafu flies as two independent
        // pieces -- kaafu1Map/kaafu2Map, each aimed at its own blob -- so the
        // gap between them lands on the logo's real measured gap by
        // construction, not a scaled copy of the map's own (different)
        // internal spacing. See logoOrigin/paths.ts for the measured
        // reference geometry.
        //
        // Thickening the map stroke to the blob's own 8px as it flies
        // (rather than leaving it at the Scene-3 highlight width), and
        // fading fillOpacity to 0 (not just bumping strokeWidth) so the
        // once-subtle 0.16 map fill doesn't blow up into an obviously
        // mismatched dark silhouette as it scales up mid-flight, keeps the
        // shape reading as a clean outline (matching the blob's own
        // fill:none) all the way to its stop point.
        //
        // The flight happens while the camera is still on the *full* canvas
        // (FULL_VB), not the tight seal crop -- the full canvas is
        // guaranteed to contain every atoll's entire start-to-stop path, so
        // nothing clips past the frame edge mid-flight. The camera only
        // zooms into the tight seal crop afterward, once every atoll has
        // arrived and faded -- zooming in *during* the flight was tried
        // earlier and caused a different failure mode (the tightening
        // crop's bounds could clip a still-rotating shape's far edges before
        // it had faded, a visible blank-frame flash); zooming in only once
        // everything is safely settled avoids that entirely.
        // Each atoll gets two parallel tweens started at the same instant:
        // a plain .to() for the transform-independent style props
        // (strokeWidth/fillOpacity), and flyWithPivot's proxy tween for the
        // pivot-compensated x/y/rotate/scale. The "<0" position on each
        // pivot tween just means "start together with the style tween
        // that precedes it" -- the real stagger between atolls still comes
        // from the same 0.2/0.1/0/0.1 offsets as before, just applied once
        // per atoll instead of once per tween.
        tl.to(contextGroup, { opacity: 0, duration: 1.1 });
        tl.to(lhavMap, { strokeWidth: 8, fillOpacity: 0, duration: 1.4 }, "<0.2");
        flyWithPivot(lhavMap, lhavFly, 1.707, 174.9, 1.4, "<0");
        tl.to(kaafu1Map, { strokeWidth: 8, fillOpacity: 0, duration: 1.4 }, "<0.1");
        flyWithPivot(kaafu1Map, kaafu1Fly, 1.633, -76.5, 1.4, "<0");
        tl.to(kaafu2Map, { strokeWidth: 8, fillOpacity: 0, duration: 1.4 }, "<0");
        flyWithPivot(kaafu2Map, kaafu2Fly, 1.634, -88.6, 1.4, "<0");
        tl.to(huvMap, { strokeWidth: 8, fillOpacity: 0, duration: 1.4 }, "<0.1");
        flyWithPivot(huvMap, huvFly, 1.654, -84.6, 1.4, "<0");
        // The blob doesn't start appearing until the map has completely
        // faded away (opacity all the way to 0) -- so there's never a
        // moment where the map trace and the real logo geometry are both
        // partially visible together.
        //
        // The map's OWN fade-out is a single continuous tween that starts
        // very early in the flight (1.3s before huvMap's fly -- the last and
        // latest-finishing of the four -- ends, out of that fly's own 1.4s
        // duration, so it's essentially fading for the entire flight, not
        // just its tail) and runs uninterrupted from full strength down to 0
        // -- and its duration is deliberately set to end at that *exact same
        // instant* the fly reaches its stop point ("atollStop"), not any
        // later, so there's never a window where the shape is holding still
        // while only its opacity keeps changing: it arrives and finishes
        // fading in the same beat, which is what reads as "the atoll comes
        // to rest, having faded away" and cues the blob to start.
        //
        // "atollStop" marks the true end of the fly (the furthest point
        // reached by any of the four tweens above, i.e. huvMap's) as a fixed
        // reference, independent of the fade's own overlap -- so the blob
        // always waits for the map's fade to fully finish no matter how
        // early that fade itself starts. The blob tween has no extra
        // position offset -- it starts the instant the atoll's fade-out
        // tween ends, so reaching the stop point (10px above the blob) reads
        // as directly cueing the logo to life, not as a separate beat after
        // a pause.
        tl.addLabel("atollStop");
        tl.to([lhavMap, kaafuMap, huvMap], { opacity: 0, duration: 1.3, ease: "power1.out" }, "atollStop-=1.3");
        tl.to([blobLhav, blobKaafu1, blobKaafu2, blobHuvadhoo], { opacity: 1, duration: 0.35 });

        // Only now, with the atolls safely arrived and faded, does the
        // camera pull in tight around the seal -- nothing is still moving
        // that could clip past the tightening crop.
        tl.to(svg, { attr: { viewBox: sealVB }, duration: 1.3 }, "<0.3");

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
        petals.forEach((p, i) => {
          const baseAngle = petalAngles[i];
          const rotateStart = -110 - 360 * SWIRL_TURNS;
          const halfExtent = petalHalfExtents[i];
          const swirl = { t: 0 };
          tl.to(swirl, {
            t: 1,
            duration: 1.5,
            ease: "power3.inOut",
            onUpdate: () => {
              const radius = SWIRL_RADIUS * (1 - swirl.t);
              const angle = baseAngle + SWIRL_TURNS * Math.PI * 2 * (1 - swirl.t);
              const rotateDeg = rotateStart * (1 - swirl.t);
              const s = swirl.t;
              // Same bbox-corner-vs-center pivot correction as flyWithPivot:
              // without it, this spiral (up to ~524 degrees of rotation, more
              // than the atoll fly) swings each petal through the same kind
              // of wide, off-canvas arc.
              const theta = (rotateDeg * Math.PI) / 180;
              const cos = Math.cos(theta) * s;
              const sin = Math.sin(theta) * s;
              const pivotX = Math.cos(angle) * radius;
              const pivotY = Math.sin(angle) * radius;
              const x = halfExtent.x - (cos * halfExtent.x - sin * halfExtent.y) + pivotX;
              const y = halfExtent.y - (sin * halfExtent.x + cos * halfExtent.y) + pivotY;
              gsap.set(p, { x, y, rotate: rotateDeg, scale: s });
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
          .to({}, { duration: 0.5 })
          // The CTA only appears once the real logo has fully arrived -- not
          // during the story, so it never competes with the scroll-scrubbed
          // scenes for attention.
          .set(cta, { pointerEvents: "auto" })
          .to(cta, { opacity: 1, duration: 0.8, ease: "power1.out" }, "<");
    }, section);

    return () => ctx.revert();
  }, []);

  // Reduced-motion fallback: no attempt at any animation, ever — this is
  // the *only* branch reduced-motion visitors reach (the motion-safe effect
  // above returns immediately for them), so it just needs to look right
  // sitting fully static — no effect needed here at all.

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className="logo-origin-section relative flex h-[100svh] w-full items-center justify-center overflow-hidden bg-ink"
    >
      {/* Reduced-motion fallback only now — every motion-safe visitor, any
          width, gets the real scene below instead. */}
      <div ref={fallbackRef} className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="max-w-xl space-y-3">
          <p className="font-script text-3xl text-ivory md:text-5xl">{TITLE_LINE_1}</p>
          <div className="mx-auto h-px w-10 bg-gold/60" />
          <p className="font-montserrat text-base font-light tracking-wide text-ivory-dim md:text-lg">{TITLE_LINE_2}</p>
        </div>
        <img src="/atoreum-logo.svg" alt="Atoreum" className="w-[52vw] max-w-[420px]" />
        <Link
          href="/products"
          className="rounded-full bg-gold-deep px-6 py-2.5 text-xs tracking-[0.2em] uppercase text-ink transition-all duration-300 hover:bg-gold-deep/90"
        >
          Go to Collections
        </Link>
        <div className="max-w-md space-y-3 font-montserrat text-sm font-light leading-relaxed text-ivory-dim">
          <p>{FLOWER_TEXT}</p>
          <p>{WAVE_TEXT}</p>
        </div>
      </div>

      {/* Desktop, motion-safe: the art stage is the visually centered
          element on the page -- at md+, a mirror-image spacer on the left
          balances the real caption column on the right, so the stage's
          center always lands on the page's center regardless of whether any
          caption text is currently visible (an unbalanced single side
          column would look "centered as a group" but visually off-center,
          since an empty text slot doesn't read the same as a matching blank
          spacer). Below md there's no side-by-side row to balance — the
          spacer is dropped and the caption stacks under the stage instead.
          Caption and stage are still separate flex children, never
          absolutely overlaid, so narrative text structurally cannot
          intersect the circular seal at any breakpoint. */}
      <div
        ref={motionRootRef}
        className="relative hidden w-full max-w-6xl flex-1 flex-col items-center justify-center gap-10 px-6 py-20 md:flex-row md:gap-8 md:py-0 lg:gap-12 xl:gap-16 2xl:gap-20"
      >
        {/* Mirror-balance spacer only exists for the md+ side-by-side row —
            a stacked mobile layout has nothing to balance. Side columns
            start much narrower than the original 320px design — at that
            fixed width the three-column row (spacer + stage + caption)
            doesn't actually fit any viewport under ~1450px, which silently
            clipped the caption text against the section's own
            overflow-hidden edge on every tablet and most laptops. Each tier
            below is sized so the row fits with margin to spare; by 2xl it
            converges back to the exact original h-80/w-80 + gap-20, so wide
            desktop is pixel-identical to before. */}
        <div aria-hidden className="hidden shrink-0 md:block md:h-36 md:w-36 lg:h-48 lg:w-48 xl:h-64 xl:w-64 2xl:h-80 2xl:w-80" />

        {/* -mx-4 bleeds this group past motionRoot's own px-6, so the stage
            (below) reads as a bigger, more full-bleed hero visual — only
            the caption text still wants a comfortable side margin for
            readability, and it's a separate flex sibling (see below),
            unaffected by this. Net ~8px margin either side of a 390px
            phone, not full edge-to-edge — kept deliberately short of that
            so the circular stage doesn't read as touching the screen
            frame. md:mx-0 fully reverts at the desktop side-column
            breakpoint. */}
        <div className="-mx-4 flex w-[calc(100%+2rem)] shrink-0 flex-col items-center gap-6 md:mx-0 md:w-auto">
        {/* Below md, sized off this group's own bled width (see -mx-4
            above) rather than a separate vw guess — w-full fills exactly
            what that width allows at any phone size, no magic percentage
            to keep in sync with it. The max-h cap is a safety net for
            unusually short viewports (a landscape phone, a small old
            handset): aspect-square would otherwise size purely off width
            and could grow taller than the screen has room for; the cap
            makes width give way to height instead once that's the
            tighter constraint. From md up this is back to the original
            vw/vh-based side-column sizing. */}
        <div ref={stageRef} className="logo-origin-stage relative aspect-square w-full max-h-[52vh] shrink-0 md:w-[min(40vw,62vh)] md:max-h-none">
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
              <g ref={contextGroupRef} fill="none" stroke="#6c7770" strokeWidth={1.1}>
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
              <path ref={lhavMapRef} d={MAP_LHAVIYANI} fill="#6c7770" fillOpacity={0.16} stroke="#8eaba5" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <g ref={kaafuMapRef} fill="#6c7770" fillOpacity={0.16} stroke="#8eaba5" strokeWidth={2}>
                <path ref={kaafu1MapRef} d={MAP_KAAFU_1} vectorEffect="non-scaling-stroke" />
                <path ref={kaafu2MapRef} d={MAP_KAAFU_2} vectorEffect="non-scaling-stroke" />
              </g>
              <path ref={huvMapRef} d={MAP_HUVADHOO} fill="#6c7770" fillOpacity={0.16} stroke="#8eaba5" strokeWidth={2} vectorEffect="non-scaling-stroke" />

              {/* Leader-line callouts: hairline stroke with a small solid-dot
                  terminal (cartographic annotation, not an infographic
                  arrowhead) -- draw on, name the atoll, retract once all
                  three have been read. Solid fill (not a hollow ring) so the
                  dot reads as "this is the filled/highlighted atoll", matching
                  the labelBeat's own mapEl opacity bump to 1 at the same beat. */}
              <g ref={lhavCalloutRef}>
                <line ref={lhavLeaderRef} stroke="var(--ivory)" strokeWidth={0.75} opacity={0} />
                <circle ref={lhavDotRef} r={3} fill="var(--ivory)" opacity={0} />
                <text ref={lhavLabelRef} opacity={0} dominantBaseline="middle" fontSize={9.5} letterSpacing={3.5} fill="var(--ivory)" style={{ fontFamily: "var(--font-sans), sans-serif" }}>
                  LHAVIYANI ATOLL
                </text>
              </g>
              <g ref={kaafuCalloutRef}>
                <line ref={kaafuLeaderRef} stroke="var(--ivory)" strokeWidth={0.75} opacity={0} />
                <circle ref={kaafuDotRef} r={3} fill="var(--ivory)" opacity={0} />
                <text ref={kaafuLabelRef} opacity={0} dominantBaseline="middle" fontSize={9.5} letterSpacing={3.5} fill="var(--ivory)" style={{ fontFamily: "var(--font-sans), sans-serif" }}>
                  KAAFU ATOLL
                </text>
              </g>
              <g ref={huvCalloutRef}>
                <line ref={huvLeaderRef} stroke="var(--ivory)" strokeWidth={0.75} opacity={0} />
                <circle ref={huvDotRef} r={3} fill="var(--ivory)" opacity={0} />
                <text ref={huvLabelRef} opacity={0} dominantBaseline="middle" fontSize={9.5} letterSpacing={3.5} fill="var(--ivory)" style={{ fontFamily: "var(--font-sans), sans-serif" }}>
                  GAAFU DHAALU ATOLL
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

        <Link
          ref={ctaRef}
          href="/products"
          className="pointer-events-none rounded-full bg-gold-deep px-6 py-2.5 text-xs tracking-[0.2em] uppercase text-ink opacity-0 transition-colors duration-300 hover:bg-gold-deep/90"
        >
          Go to Collections
        </Link>
        </div>

        {/* Below md this is a fixed-height box (not auto) because its two
            children are position:absolute overlays (flower/wave text
            crossfade in place) — an auto-height parent can't size itself
            from out-of-flow absolute children, it would collapse to 0. h-40
            comfortably fits the longer of the two lines at the mobile font
            size. From md up this reverts to the exact original narrow
            side-column treatment.

            Below md this box is ALSO pulled out of motionRoot's centering
            flex flow via `absolute` — it used to sit in-flow as a sibling of
            the stage+CTA group, which meant motionRoot's `justify-center`
            was centering the *combined* height of both, so this box's
            reserved h-40 (present even when both caption lines are opacity-0
            between scenes) pushed the actually-visible stage up above true
            screen center. Anchored to the bottom of motionRoot instead,
            comfortably clear of the centered stage above it at every scroll
            position (the stage's own max height is well under half the
            section height). From md up this returns to a normal in-flow
            flex sibling, unchanged from the original side-column design. */}
        <div className="absolute inset-x-0 bottom-6 z-10 flex h-40 w-full shrink-0 items-center justify-center px-4 text-center md:relative md:inset-auto md:bottom-auto md:h-36 md:w-36 md:items-center md:justify-start md:px-0 md:text-left lg:h-48 lg:w-48 xl:h-64 xl:w-64 2xl:h-80 2xl:w-80">
          <div ref={flowerTextContainerRef} className="pointer-events-none absolute inset-0 flex items-center justify-center md:justify-start">
            <TypedLine text={FLOWER_TEXT} lineRef={flowerTextLineRef} className={CAPTION_TEXT_CLASS} />
          </div>

          <div ref={waveTextContainerRef} className="pointer-events-none absolute inset-0 flex items-center justify-center md:justify-start">
            <TypedLine text={WAVE_TEXT} lineRef={waveTextLineRef} className={CAPTION_TEXT_CLASS} />
          </div>
        </div>
      </div>

      {/* Opening title card: a full-screen overlay on top of the (still
          empty) stage, so the sequence opens on a statement instead of
          blank canvas. Line 1 is pre-revealed at progress 0 — it must be
          readable before any scrolling happens; line 2 types on with the
          first scroll, then the whole card fades and hands off to the map.
          Hidden by default; the motion boot switches it on alongside
          motionRoot for any motion-safe visitor, any width (the
          reduced-motion fallback has its own static title, so this overlay
          must never show there). */}
      {/* pb-24/28 mirrors main's own header offset: at load the pinned
          section starts that far below the true viewport top, so centering
          within the section alone reads visibly low — this pulls the title
          back up to the optical middle of the screen. Line 1 is a plain
          paragraph (not TypedLine): it's fully pre-revealed anyway, and a
          connected script rendered as per-character inline-blocks would
          break its letter joins. */}
      <div
        ref={titleContainerRef}
        className="pointer-events-none absolute inset-0 z-20 hidden flex-col items-center justify-center gap-6 px-6 pb-24 text-center md:pb-28"
      >
        <p
          ref={titleLine1Ref}
          className="max-w-5xl font-script text-4xl leading-[1.15] text-ivory md:text-8xl"
        >
          {TITLE_LINE_1}
        </p>
        <div className="h-px w-16 bg-gold/60" />
        <TypedLine
          text={TITLE_LINE_2}
          lineRef={titleLine2Ref}
          className="font-montserrat text-base font-light tracking-[0.08em] text-ivory-dim md:text-3xl"
        />
      </div>
    </section>
  );
}
