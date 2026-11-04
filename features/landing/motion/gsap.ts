"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// GSAP and the plugins the landing page uses, registered once. (All of GSAP is free under
// GreenSock's standard no-charge license, the formerly paid plugins included.)
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, ScrambleTextPlugin, DrawSVGPlugin);

export { gsap, ScrollTrigger, SplitText, useGSAP };
