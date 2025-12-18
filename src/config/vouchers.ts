export type Voucher = {
  id: string;
  title: string;
  subtitle: string;
  fineprint: string;
  stamp: string; // small label, e.g. "VALID 2026"
};

export const VOUCHERS: Voucher[] = [
  {
    id: "conference-fees",
    title: "Conference Fee Waiver",
    subtitle: "1× registration fee magically disappears",
    fineprint: "Valid for one imaginary conference. Not redeemable in reality. Applies retroactively only in your dreams.",
    stamp: "APPROVED",
  },
  {
    id: "review-skip",
    title: "Skip-One-Review Token",
    subtitle: "Decline politely, guilt-free",
    fineprint: "Use once when the request arrives on Friday 22:48. Side effects: sudden joy, reclaimed weekend.",
    stamp: "EXEMPT",
  },
  {
    id: "high-impact",
    title: "High-Impact Blessing",
    subtitle: "Impact factor increases by ✨ vibes ✨",
    fineprint: "Works best when paired with sleep, snacks, and kind co-authors.",
    stamp: "TOP TIER",
  },
  {
    id: "grant-spark",
    title: "Research Grant Spark",
    subtitle: "A bright idea lands on your desk",
    fineprint: "Includes: momentum. Excludes: paperwork. Please contact reality for procurement forms.",
    stamp: "FUNDED*",
  },
];
