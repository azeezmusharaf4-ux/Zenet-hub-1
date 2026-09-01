export interface TrustScoreInfo {
  score: number; // 0 to 100
  salesCount: number;
  rating: number;
  tierLabel: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  iconColor: string;
  progressColor: string;
  formattedScore: string;
  summaryText: string;
}

/**
 * Calculates a Seller Trust Score (0 - 100%) based on:
 * 1. Completed sales volume (up to 40 points)
 * 2. Average rating / feedback score (up to 60 points)
 */
export function calculateSellerTrustScore(
  salesCount: number = 0,
  rating: number = 5.0
): TrustScoreInfo {
  const safeSales = Math.max(0, Number(salesCount) || 0);
  const safeRating = Math.min(5.0, Math.max(0, Number(rating) || 5.0));

  // 1. Rating contribution (up to 60 points)
  const ratingPoints = (safeRating / 5.0) * 60;

  // 2. Sales volume contribution (up to 40 points)
  let salesPoints = 15; // New seller starting boost
  if (safeSales >= 25) {
    salesPoints = 40;
  } else if (safeSales >= 10) {
    salesPoints = 35;
  } else if (safeSales >= 5) {
    salesPoints = 28;
  } else if (safeSales >= 1) {
    salesPoints = 22;
  }

  const score = Math.min(100, Math.max(0, Math.round(ratingPoints + salesPoints)));

  let tierLabel = 'Trusted Seller';
  let badgeBg = 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20';
  let badgeBorder = 'border-amber-400/50';
  let badgeText = 'text-amber-300';
  let iconColor = 'text-amber-400';
  let progressColor = 'bg-gradient-to-r from-amber-400 to-yellow-400';

  if (score >= 92) {
    tierLabel = 'Top Rated Vendor';
    badgeBg = 'bg-gradient-to-r from-emerald-950/90 via-teal-950/80 to-emerald-900/90';
    badgeBorder = 'border-emerald-400/60';
    badgeText = 'text-emerald-300';
    iconColor = 'text-emerald-400';
    progressColor = 'bg-gradient-to-r from-emerald-400 to-teal-300';
  } else if (score >= 82) {
    tierLabel = 'Verified Pro';
    badgeBg = 'bg-gradient-to-r from-amber-950/90 via-yellow-950/80 to-amber-900/90';
    badgeBorder = 'border-amber-400/60';
    badgeText = 'text-amber-300';
    iconColor = 'text-amber-400';
    progressColor = 'bg-gradient-to-r from-amber-400 to-yellow-300';
  } else if (score >= 70) {
    tierLabel = 'Active Seller';
    badgeBg = 'bg-gradient-to-r from-indigo-950/90 via-purple-950/80 to-indigo-900/90';
    badgeBorder = 'border-indigo-400/50';
    badgeText = 'text-indigo-300';
    iconColor = 'text-indigo-400';
    progressColor = 'bg-gradient-to-r from-indigo-400 to-purple-400';
  } else {
    tierLabel = 'Rising Vendor';
    badgeBg = 'bg-gradient-to-r from-purple-950/90 to-slate-900/90';
    badgeBorder = 'border-purple-400/40';
    badgeText = 'text-purple-300';
    iconColor = 'text-purple-400';
    progressColor = 'bg-gradient-to-r from-purple-400 to-indigo-400';
  }

  return {
    score,
    salesCount: safeSales,
    rating: safeRating,
    tierLabel,
    badgeBg,
    badgeBorder,
    badgeText,
    iconColor,
    progressColor,
    formattedScore: `${score}%`,
    summaryText: `${score}% Trust Score • ${safeSales} Completed Sales • ${safeRating.toFixed(1)}★ Rating`
  };
}
