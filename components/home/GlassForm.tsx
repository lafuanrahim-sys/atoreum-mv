"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Logo from "@/components/ui/Logo";

gsap.registerPlugin(ScrollTrigger);

/**
 * Abstract sea-glass form — the hero's 3D moment. Three nested "panes"
 * staggered on the Z-axis inside a perspective container, orbiting slowly
 * and tilting with scroll + pointer. No 3D asset or renderer: transform-only
 * CSS driven by GSAP, kept to the same blur/layer budget Hero already used.
 */
export default function GlassForm() {
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setReduceMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const panes = "[data-glass-pane]";

    if (reduceMotion) {
      gsap.set(scene, { rotateX: 6, rotateY: -8, clearProps: "transform" });
      gsap.set(panes, { clearProps: "all" });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.set(scene, { rotateX: 8, rotateY: -12 });

      const loop = gsap.to(scene, {
        rotateY: "+=360",
        duration: 90,
        ease: "none",
        repeat: -1,
      });

      const scrollTween = ScrollTrigger.create({
        trigger: scene,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.8,
        onUpdate: (self) => {
          gsap.to(panes, {
            z: (i) => (i - 1) * (40 + self.progress * 30),
            duration: 0.6,
            ease: "power3.out",
            overwrite: true,
          });
        },
      });

      const handlePointer = (event: PointerEvent) => {
        const rect = scene.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) / rect.width;
        const y = (event.clientY - rect.top - rect.height / 2) / rect.height;
        gsap.to(scene, {
          rotateX: 8 - y * 14,
          rotateY: -12 + x * 18,
          duration: 1.1,
          ease: "power3.out",
        });
      };

      const parent = scene.parentElement;
      parent?.addEventListener("pointermove", handlePointer);

      return () => {
        parent?.removeEventListener("pointermove", handlePointer);
        loop.kill();
        scrollTween.kill();
      };
    }, scene);

    return () => ctx.revert();
  }, [reduceMotion]);

  return (
    <div
      className="relative flex h-[24rem] w-[24rem] items-center justify-center"
      style={{ perspective: "1200px" }}
    >
      <div
        ref={sceneRef}
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          data-glass-pane
          className="absolute inset-0 rounded-full border border-gold/20 bg-gradient-to-br from-gold/10 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          data-glass-pane
          className="absolute inset-6 rounded-full border border-ivory/10 bg-ink/70 backdrop-blur-sm"
          aria-hidden="true"
        />
        <div
          data-glass-pane
          className="absolute inset-12 flex items-center justify-center rounded-full border border-gold/15 bg-ink/90 shadow-[0_0_120px_rgba(233,186,166,0.08)]"
        >
          <span className="block h-24 w-24">
            <Logo className="h-full w-full" />
          </span>
        </div>
      </div>
    </div>
  );
}
