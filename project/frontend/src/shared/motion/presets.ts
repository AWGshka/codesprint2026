// Shared timing - one curve/duration so motion across the app feels coherent.
export const transition = { duration: 0.3, easing: [0.22, 1, 0.36, 1] as [number, number, number, number] };
export const fadeInUp = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 6 } };
