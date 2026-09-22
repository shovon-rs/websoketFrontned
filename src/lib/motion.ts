import type { Transition, Variants } from "framer-motion";

/** Shared easing/duration constants — keep in sync with the CSS custom properties in globals.css
 * (--ease-out / --dur-base etc) so JS-driven and CSS-driven motion feel like one system. */
export const EASE_OUT: Transition["ease"] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: Transition["ease"] = [0.65, 0, 0.35, 1];
export const EASE_SPRING: Transition["ease"] = [0.34, 1.56, 0.64, 1];

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.28, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15, ease: EASE_IN_OUT } },
};

/** Wrap a list container in this + give each child `variants={staggerItem}` for a cascading
 * entrance (cards, rows, nav results, etc). */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
};

/** Per-route page transition — used by AppShell around {children}. */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease: EASE_IN_OUT } },
};

/** Modal/dialog backdrop + panel pair — consistent open/close feel for every share/confirm/etc
 * dialog across the app. */
export const dialogBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE_IN_OUT } },
};

export const dialogPanel: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.24, ease: EASE_SPRING } },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.15, ease: EASE_IN_OUT } },
};

/** Subtle press feedback for interactive cards/buttons that want a `whileTap` without repeating
 * this object everywhere. */
export const tapScale = { scale: 0.97 };
export const hoverLift = { y: -3 };
