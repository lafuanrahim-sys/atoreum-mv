"use client";

import { useEffect } from "react";
import gsap from "gsap";

export default function BarbaLoader() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let barba: typeof import("@barba/core");

    const initBarba = async () => {
      barba = await import("@barba/core");
      barba.default.init({
      transitions: [
        {
          name: "main-transition",
          once({ next }: { next: any }) {
            const content = next.container;
            gsap.fromTo(
              content,
              { opacity: 0, y: 30 },
              { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }
            );
          },
          leave({ current }: { current: any }) {
            return gsap.to(current.container, {
              opacity: 0,
              y: -20,
              duration: 0.55,
              ease: "power3.inOut",
            });
          },
          enter({ next }: { next: any }) {
            const content = next.container;
            return gsap.fromTo(
              content,
              { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }
            );
          },
        },
      ],
    });

    };

    initBarba();

    return () => {
      if (barba && "destroy" in barba.default) {
        barba.default.destroy();
      }
    };
  }, []);

  return null;
}
