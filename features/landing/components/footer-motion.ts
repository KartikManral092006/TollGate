import { gsap, SplitText } from "@/features/landing/motion/gsap";

// The footer's closing moment, loaded only when the footer comes near (footer.tsx), so pages
// like /docs that reuse the footer don't download GSAP up front. Returns the cleanup.
export function animateFooter(root: HTMLElement): () => void {
  const context = gsap.context(() => {
    const mm = gsap.matchMedia();
    // Without motion, the gate is simply open.
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set("[data-arm]", { rotate: -62 });
      gsap.set("[data-lamp]", { backgroundColor: "#2ee59d" });
    });
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const split = SplitText.create("[data-wordmark]", { type: "chars", mask: "chars" });
      const finale = gsap.timeline({
        // Across the whole footer: the wordmark rises as it comes in, and the arm lifts
        // as the page reaches its very end.
        scrollTrigger: {
          trigger: root,
          start: "top bottom",
          end: "bottom bottom",
          scrub: 0.8,
        },
      });
      finale
        .from(split.chars, { yPercent: 105, ease: "power3.out", stagger: 0.06, duration: 1 })
        .fromTo(
          "[data-arm]",
          { rotate: 0 },
          { rotate: -62, ease: "power2.inOut", duration: 1.2 },
          ">-0.2",
        )
        .to(
          "[data-lamp]",
          {
            backgroundColor: "#2ee59d",
            boxShadow: "0 0 24px 4px rgb(46 229 157 / 0.7)",
            duration: 0.3,
          },
          ">-0.35",
        );

      gsap.from("[data-footer-col]", {
        y: 30,
        autoAlpha: 0,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.08,
        scrollTrigger: { trigger: root, start: "top 85%", once: true },
      });
    });
  }, root);
  return () => context.revert();
}
