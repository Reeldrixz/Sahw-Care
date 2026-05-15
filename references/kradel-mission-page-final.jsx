import { useState, useEffect } from "react";

/**
 * Kradel /missions/my — pixel-accurate match to the mockup.
 *
 * This is the reference component. Drop it into your Next.js route or
 * extract the sections into your existing page. The layout, colours,
 * proportions, and details are all calibrated to match the mockup.
 */

const C = {
  // Mission purple system
  purple: "#6d5acd",
  purpleDark: "#5a47b8",
  purpleLight: "#8b73e0",
  purplePale: "#ede9ff",
  purplePaler: "#f5f3ff",
  purpleSoft: "#d4cdf0",
  purpleTinted: "#c4b8e8",

  // Block system
  blockEmpty: "#e8e4de",
  blockClick: "#d4cfc8",
  blockListing: "#a8d4bf",
  blockDonation: "#1a7a5e",

  // Brand
  green: "#1a7a5e",
  greenLight: "#e8f5f0",

  // Neutrals
  cream: "#faf8f3",
  white: "#ffffff",
  text: "#2a2a2a",
  textLight: "#5a5a5a",
  muted: "#8a8a8a",
  border: "#ede8df",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Nunito:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .mission-page {
    font-family: 'Nunito', sans-serif;
    background: ${C.cream};
    min-height: 100vh;
    color: ${C.text};
    padding: 20px 16px 60px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ===== HEADER ===== */
  .page-header {
    margin-bottom: 24px;
  }

  .h-title {
    font-family: 'Lora', serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 1px;
    color: ${C.text};
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .h-title svg {
    width: 22px;
    height: 22px;
    stroke: ${C.purple};
    stroke-width: 2;
    fill: none;
  }

  .h-sub {
    font-size: 14px;
    color: ${C.textLight};
    margin-top: 6px;
  }

  .h-sub b {
    font-weight: 700;
    color: ${C.text};
  }

  /* ===== GRID LAYOUT (3 columns on desktop, stacked on mobile) ===== */
  .main-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }

  @media (min-width: 900px) {
    .main-grid {
      grid-template-columns: 1.1fr 0.85fr 0.95fr;
      align-items: start;
    }
  }

  /* ===== MISSION CARD (purple, left column) ===== */
  .mission-card {
    background: ${C.purple};
    border-radius: 24px;
    padding: 24px 22px;
    color: white;
    position: relative;
    overflow: hidden;
  }

  .mc-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 18px;
  }

  .mc-top-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mc-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: white;
    color: ${C.purple};
    font-weight: 700;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid rgba(255,255,255,0.3);
  }

  .mc-progress-label {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
  }

  .mc-progress-date {
    font-size: 13px;
    opacity: 0.85;
    margin-top: 3px;
  }

  .mc-badge-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .mc-gift {
    font-size: 22px;
    line-height: 1;
  }

  .mc-badge {
    background: rgba(255,255,255,0.18);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-align: center;
    line-height: 1.3;
  }

  /* Monthly goal section */
  .mc-goal-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin: 20px 0 6px;
  }

  .mc-goal-text {
    flex: 1;
  }

  .mc-goal-label {
    font-size: 13px;
    opacity: 0.9;
    margin-bottom: 4px;
  }

  .mc-goal-bignum {
    font-family: 'Lora', serif;
    font-size: 56px;
    font-weight: 600;
    line-height: 1;
    display: inline-block;
  }

  .mc-goal-suffix {
    font-size: 14px;
    margin-left: 6px;
    display: inline-block;
    line-height: 1.3;
    max-width: 90px;
    vertical-align: bottom;
  }

  .mc-gift-illo {
    font-size: 64px;
    line-height: 1;
    margin-right: -8px;
    margin-bottom: 4px;
    transform: rotate(-6deg);
  }

  .mc-help-text {
    font-size: 13px;
    opacity: 0.92;
    margin-bottom: 14px;
  }

  /* Mosaic block grid for monthly goal — 14 cols × 3 rows = 42 (we use 40) */
  .mc-mosaic {
    display: grid;
    grid-template-columns: repeat(14, 1fr);
    gap: 4px;
    margin-bottom: 22px;
  }

  .mc-mosaic .block {
    height: 14px;
    border-radius: 3px;
  }

  /* Stats row (3 columns) */
  .mc-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    margin-bottom: 18px;
    border-top: 1px solid rgba(255,255,255,0.15);
    padding-top: 18px;
  }

  .mc-stat {
    text-align: center;
    position: relative;
  }

  .mc-stat + .mc-stat::before {
    content: "";
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 1px;
    background: rgba(255,255,255,0.15);
  }

  .mc-stat-num {
    font-family: 'Lora', serif;
    font-size: 32px;
    font-weight: 600;
    line-height: 1;
  }

  .mc-stat-label {
    font-size: 11px;
    opacity: 0.85;
    margin-top: 4px;
    margin-bottom: 8px;
  }

  .mc-stat-icon {
    width: 16px;
    height: 16px;
    stroke: white;
    stroke-width: 2;
    fill: none;
    opacity: 0.7;
    margin: 0 auto;
  }

  /* Affirmation pill */
  .mc-aff {
    background: rgba(255,255,255,0.14);
    border-radius: 14px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    font-size: 13px;
    line-height: 1.4;
  }

  .mc-aff-heart {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 14px;
  }

  /* Share link section */
  .mc-share {
    font-size: 12px;
    opacity: 0.9;
    margin-bottom: 8px;
  }

  .mc-share-row {
    display: flex;
    gap: 8px;
    background: rgba(255,255,255,0.14);
    border-radius: 12px;
    padding: 4px 4px 4px 14px;
    align-items: center;
  }

  .mc-share-input {
    flex: 1;
    background: transparent;
    border: none;
    color: white;
    font-family: inherit;
    font-size: 12px;
    outline: none;
    min-width: 0;
  }

  .mc-share-input::placeholder { color: rgba(255,255,255,0.6); }

  .mc-share-btn {
    background: white;
    color: ${C.purple};
    border: none;
    padding: 8px 14px;
    border-radius: 9px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  /* ===== HOW BAR FILLS (middle column, white card) ===== */
  .info-card {
    background: white;
    border-radius: 20px;
    padding: 22px 20px;
    border: 1px solid ${C.border};
  }

  .ic-title {
    font-family: 'Lora', serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.2px;
    color: ${C.purple};
    text-transform: uppercase;
    margin-bottom: 18px;
  }

  .hbf-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 0;
    border-bottom: 1px solid ${C.border};
  }

  .hbf-row:last-of-type { border-bottom: none; }

  .hbf-swatch {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .hbf-content { flex: 1; }

  .hbf-title {
    font-size: 14px;
    font-weight: 700;
    color: ${C.text};
    line-height: 1.3;
    margin-bottom: 3px;
  }

  .hbf-desc {
    font-size: 12px;
    color: ${C.textLight};
    line-height: 1.4;
    margin-bottom: 4px;
  }

  .hbf-blocks {
    font-size: 12px;
    color: ${C.green};
    font-weight: 700;
  }

  /* Total impact */
  .total-impact {
    margin-top: 20px;
    padding-top: 22px;
    border-top: 1px solid ${C.border};
    text-align: center;
  }

  .ti-icon {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: ${C.purplePaler};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
    font-size: 18px;
  }

  .ti-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1px;
    color: ${C.text};
    text-transform: uppercase;
    margin-bottom: 14px;
  }

  .ti-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin: 10px 0 14px;
  }

  .ti-stat { text-align: center; }

  .ti-stat-num {
    font-family: 'Lora', serif;
    font-size: 26px;
    font-weight: 600;
    color: ${C.purple};
    line-height: 1;
  }

  .ti-stat-label {
    font-size: 10px;
    color: ${C.textLight};
    margin-top: 4px;
    line-height: 1.3;
  }

  .ti-tagline {
    font-family: 'Lora', serif;
    font-style: italic;
    font-size: 14px;
    color: ${C.text};
    margin-top: 6px;
  }

  .ti-tagline-heart {
    color: ${C.purple};
  }

  /* ===== MISSION PARTNERS (right column) ===== */
  .partners-card .ic-subtitle {
    font-size: 12px;
    color: ${C.textLight};
    margin-top: -12px;
    margin-bottom: 18px;
    line-height: 1.4;
  }

  .partner {
    padding: 14px 0;
    border-bottom: 1px solid ${C.border};
  }

  .partner:last-of-type { border-bottom: none; }

  .partner-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .partner-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: ${C.purplePale};
    color: ${C.purple};
    font-weight: 700;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .partner-info { flex: 1; }

  .partner-name {
    font-size: 13px;
    font-weight: 700;
    color: ${C.text};
    line-height: 1.2;
  }

  .partner-goal {
    font-size: 11px;
    color: ${C.muted};
    margin-top: 2px;
  }

  .partner-count {
    font-size: 12px;
    font-weight: 700;
    color: ${C.text};
  }

  /* Partner mini-grid: 13 cols × 2 rows */
  .partner-grid {
    display: grid;
    grid-template-columns: repeat(13, 1fr);
    gap: 3px;
    margin-bottom: 10px;
  }

  .partner-grid .pblock {
    height: 8px;
    border-radius: 2px;
  }

  /* Partner stats with icons */
  .partner-stats {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: ${C.textLight};
    align-items: center;
  }

  .pstat {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pstat svg {
    width: 11px;
    height: 11px;
    stroke: ${C.muted};
    stroke-width: 2;
    fill: none;
  }

  .pstat + .pstat::before {
    content: "|";
    color: ${C.border};
    margin-right: 8px;
  }

  /* Friends summary */
  .friends-line {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    padding: 12px 14px;
    background: ${C.purplePaler};
    border-radius: 12px;
    font-size: 12px;
    color: ${C.text};
    line-height: 1.4;
  }

  .friends-icon {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: ${C.purple};
  }

  /* ===== HOW IT WORKS (full-width, below) ===== */
  .how-it-works {
    margin-top: 32px;
  }

  .hiw-title {
    font-family: 'Lora', serif;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 2.5px;
    color: ${C.text};
    text-transform: uppercase;
    text-align: center;
    margin-bottom: 24px;
  }

  .hiw-steps {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    align-items: stretch;
  }

  @media (min-width: 768px) {
    .hiw-steps {
      grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
    }
  }

  .hiw-step {
    background: white;
    border: 1px solid ${C.border};
    border-radius: 18px;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
  }

  .hiw-step-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 14px;
  }

  .hiw-num {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: ${C.purple};
    color: white;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .hiw-num-green { background: ${C.green}; }

  .hiw-step-name {
    font-size: 14px;
    font-weight: 700;
    color: ${C.text};
    line-height: 1.3;
    flex: 1;
  }

  .hiw-icon-wrap {
    width: 100%;
    height: 80px;
    border-radius: 14px;
    background: ${C.purplePaler};
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    font-size: 32px;
  }

  .hiw-icon-green { background: ${C.greenLight}; }

  .hiw-desc {
    font-size: 12px;
    color: ${C.textLight};
    line-height: 1.45;
    margin-bottom: 14px;
    flex: 1;
  }

  .hiw-mini-grid {
    display: grid;
    grid-template-columns: repeat(13, 1fr);
    gap: 2px;
    margin-bottom: 10px;
  }

  .hiw-mini-grid .miniblock {
    height: 10px;
    border-radius: 2px;
  }

  .hiw-blocks-label {
    font-size: 12px;
    font-weight: 700;
    color: ${C.purple};
    text-align: left;
  }

  .hiw-blocks-label-green { color: ${C.green}; }

  .hiw-arrow {
    display: none;
    align-items: center;
    justify-content: center;
    color: ${C.muted};
    font-size: 18px;
  }

  @media (min-width: 768px) {
    .hiw-arrow { display: flex; }
  }

  /* ===== BOTTOM TAGLINE ===== */
  .bottom-tag {
    margin-top: 28px;
    background: white;
    border: 1px solid ${C.border};
    border-radius: 16px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .bt-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 280px;
  }

  .bt-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: ${C.purplePale};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 18px;
  }

  .bt-text {
    font-size: 13px;
    color: ${C.textLight};
    line-height: 1.5;
  }

  .bt-text b {
    color: ${C.text};
    font-weight: 700;
  }

  .bt-pill {
    background: ${C.purplePale};
    color: ${C.purple};
    padding: 10px 18px;
    border-radius: 24px;
    font-size: 13px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
`;

// === Helper: Generate mosaic blocks ===
function MissionMosaic({ donations = 12, listings = 8, clicks = 4, total = 40 }) {
  // Total 40 blocks rendered in a 14-column grid (last 2 in row 3 are empty by design)
  // Layout in mockup: rows of mixed colours simulating a soft mosaic.
  // We'll fill: first N donation blocks (dark green), then listings (soft green),
  // then clicks (grey), then empty blocks tinted with purple.
  const blocks = [];
  for (let i = 0; i < total; i++) {
    let bg;
    if (i < donations) bg = C.blockDonation;
    else if (i < donations + listings) bg = C.blockListing;
    else if (i < donations + listings + clicks) bg = C.blockClick;
    else bg = C.purpleTinted;
    blocks.push(<div key={i} className="block" style={{ background: bg }} />);
  }
  return <div className="mc-mosaic">{blocks}</div>;
}

// Partner mini grid: 2 rows × 13 cols = 26 blocks (visual representation of /40)
function PartnerGrid({ filled = 0, donations = 0, listings = 0, clicks = 0 }) {
  const total = 26;
  const blocks = [];
  // Proportional to /40 → scale
  const ratio = 26 / 40;
  const d = Math.round(donations * ratio);
  const l = Math.round(listings * ratio);
  const c = Math.round(clicks * ratio);
  for (let i = 0; i < total; i++) {
    let bg;
    if (i < d) bg = C.blockDonation;
    else if (i < d + l) bg = C.blockListing;
    else if (i < d + l + c) bg = C.blockClick;
    else bg = C.blockEmpty;
    blocks.push(<div key={i} className="pblock" style={{ background: bg }} />);
  }
  return <div className="partner-grid">{blocks}</div>;
}

// How-it-works step mini grid
function StepMiniGrid({ donations = 0, listings = 0, clicks = 0 }) {
  const total = 26;
  const blocks = [];
  const d = donations;
  const l = listings;
  const c = clicks;
  for (let i = 0; i < total; i++) {
    let bg;
    if (i < d) bg = C.blockDonation;
    else if (i < d + l) bg = C.blockListing;
    else if (i < d + l + c) bg = C.blockClick;
    else bg = C.blockEmpty;
    blocks.push(<div key={i} className="miniblock" style={{ background: bg }} />);
  }
  return <div className="hiw-mini-grid">{blocks}</div>;
}

export default function MissionPage() {
  // Demo data — replace with API data from /api/missions/my
  const me = { initial: "R", name: "You" };
  const partners = [
    { initial: "A", name: "Aisha",  goal: 40, blocks: 26, clicks: 20, listings: 8,  donations: 10 },
    { initial: "O", name: "Omar",   goal: 40, blocks: 31, clicks: 32, listings: 15, donations: 12 },
    { initial: "F", name: "Fatima", goal: 40, blocks: 18, clicks: 15, listings: 6,  donations: 6  },
    { initial: "Y", name: "Yusuf",  goal: 40, blocks: 37, clicks: 45, listings: 18, donations: 14 },
  ];
  const myStats = { clicks: 24, listings: 11, donations: 13 };
  const impact = { moms: 18, items: 36, cities: 12 };
  const goalNumber = 40;
  const dateRange = "May 1 – May 31";

  return (
    <>
      <style>{styles}</style>
      <div className="mission-page">
        <div className="container">

          {/* ===== HEADER ===== */}
          <div className="page-header">
            <h1 className="h-title">
              YOUR MONTHLY MISSION
              <svg viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </h1>
            <div className="h-sub">You chose to support: <b>Bundle Support</b></div>
          </div>

          {/* ===== MAIN 3-COLUMN GRID ===== */}
          <div className="main-grid">

            {/* === Column 1: Mission Card === */}
            <div className="mission-card">
              {/* Top row */}
              <div className="mc-top">
                <div className="mc-top-left">
                  <div className="mc-avatar">{me.initial}</div>
                  <div>
                    <div className="mc-progress-label">Your Mission Progress</div>
                    <div className="mc-progress-date">{dateRange}</div>
                  </div>
                </div>
                <div className="mc-badge-stack">
                  <div className="mc-gift">🎁</div>
                  <div className="mc-badge">BUNDLE<br/>SUPPORT</div>
                </div>
              </div>

              {/* Monthly Goal */}
              <div className="mc-goal-label">Monthly Goal</div>
              <div className="mc-goal-row">
                <div className="mc-goal-text">
                  <span className="mc-goal-bignum">{goalNumber}</span>
                  <span className="mc-goal-suffix">maternity<br/>essentials</span>
                </div>
                <div className="mc-gift-illo">🎁</div>
              </div>

              <div className="mc-help-text">Help us reach more moms this month.</div>

              <MissionMosaic
                donations={myStats.donations}
                listings={myStats.listings}
                clicks={myStats.clicks}
                total={40}
              />

              {/* Stats row */}
              <div className="mc-stats">
                <div className="mc-stat">
                  <div className="mc-stat-num">{myStats.clicks}</div>
                  <div className="mc-stat-label">Social Clicks</div>
                  <svg className="mc-stat-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                </div>
                <div className="mc-stat">
                  <div className="mc-stat-num">{myStats.listings}</div>
                  <div className="mc-stat-label">Listings Created</div>
                  <svg className="mc-stat-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="4" width="8" height="4" rx="1"/>
                    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                  </svg>
                </div>
                <div className="mc-stat">
                  <div className="mc-stat-num">{myStats.donations}</div>
                  <div className="mc-stat-label">Requests Fulfilled</div>
                  <svg className="mc-stat-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M8 12l3 3 5-6"/>
                  </svg>
                </div>
              </div>

              {/* Affirmation pill */}
              <div className="mc-aff">
                <div className="mc-aff-heart">💜</div>
                <div>Every action brings us closer to supporting more moms.</div>
              </div>

              {/* Share link */}
              <div className="mc-share">Share your link. Invite others to join your mission!</div>
              <div className="mc-share-row">
                <span style={{ color: "rgba(255,255,255,0.7)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                </span>
                <input
                  className="mc-share-input"
                  readOnly
                  value="kradel.com/u/yourlink"
                />
                <button className="mc-share-btn">
                  Share <span style={{ fontSize: 14 }}>↑</span>
                </button>
              </div>
            </div>

            {/* === Column 2: How Bar Fills + Total Impact === */}
            <div className="info-card">
              <div className="ic-title">HOW YOUR BAR FILLS</div>

              <div className="hbf-row">
                <div className="hbf-swatch" style={{ background: C.blockClick }} />
                <div className="hbf-content">
                  <div className="hbf-title">Social Clicks</div>
                  <div className="hbf-desc">When someone clicks your link.</div>
                  <div className="hbf-blocks">+1 block</div>
                </div>
              </div>

              <div className="hbf-row">
                <div className="hbf-swatch" style={{ background: C.blockListing }} />
                <div className="hbf-content">
                  <div className="hbf-title">Listing Created</div>
                  <div className="hbf-desc">When someone creates a listing (register or discover).</div>
                  <div className="hbf-blocks">+2 blocks</div>
                </div>
              </div>

              <div className="hbf-row">
                <div className="hbf-swatch" style={{ background: C.blockDonation }} />
                <div className="hbf-content">
                  <div className="hbf-title">Request Fulfilled / Donation Completed</div>
                  <div className="hbf-desc">When someone fulfills a request or completes a donation.</div>
                  <div className="hbf-blocks">+4 blocks</div>
                </div>
              </div>

              <div className="total-impact">
                <div className="ti-icon">👥</div>
                <div className="ti-label">TOTAL IMPACT THIS MONTH</div>
                <div className="ti-stats">
                  <div className="ti-stat">
                    <div className="ti-stat-num">{impact.moms}</div>
                    <div className="ti-stat-label">Moms<br/>Supported</div>
                  </div>
                  <div className="ti-stat">
                    <div className="ti-stat-num">{impact.items}</div>
                    <div className="ti-stat-label">Essentials<br/>Delivered</div>
                  </div>
                  <div className="ti-stat">
                    <div className="ti-stat-num">{impact.cities}</div>
                    <div className="ti-stat-label">Cities<br/>Reached</div>
                  </div>
                </div>
                <div className="ti-tagline">Together, we care. <span className="ti-tagline-heart">💜</span></div>
              </div>
            </div>

            {/* === Column 3: Mission Partners === */}
            <div className="info-card partners-card">
              <div className="ic-title">OTHER MISSION PARTNERS</div>
              <div className="ic-subtitle">People supporting the same mission this month.</div>

              {partners.map((p, i) => (
                <div key={i} className="partner">
                  <div className="partner-top">
                    <div className="partner-avatar">{p.initial}</div>
                    <div className="partner-info">
                      <div className="partner-name">{p.name}</div>
                      <div className="partner-goal">Goal: {p.goal} essentials</div>
                    </div>
                    <div className="partner-count">{p.blocks} / {p.goal}</div>
                  </div>
                  <PartnerGrid donations={p.donations} listings={p.listings} clicks={p.clicks} />
                  <div className="partner-stats">
                    <div className="pstat">
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                      </svg>
                      {p.clicks}
                    </div>
                    <div className="pstat">
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="8" y="4" width="8" height="4" rx="1"/>
                        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                      </svg>
                      {p.listings}
                    </div>
                    <div className="pstat">
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M8 12l3 3 5-6"/>
                      </svg>
                      {p.donations}
                    </div>
                  </div>
                </div>
              ))}

              <div className="friends-line">
                <div className="friends-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                    <path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <div>{partners.length} friends. 1 mission.<br/>More love. More impact.</div>
              </div>
            </div>

          </div>

          {/* ===== HOW IT WORKS ===== */}
          <div className="how-it-works">
            <h2 className="hiw-title">HOW IT WORKS</h2>
            <div className="hiw-steps">
              {/* Step 1 */}
              <div className="hiw-step">
                <div className="hiw-step-head">
                  <div className="hiw-num">1</div>
                  <div className="hiw-step-name">Someone clicks your link</div>
                </div>
                <div className="hiw-icon-wrap">✈️</div>
                <div className="hiw-desc">You share on social media. They click.</div>
                <StepMiniGrid donations={0} listings={0} clicks={1} />
                <div className="hiw-blocks-label">+1 block</div>
              </div>

              <div className="hiw-arrow">→</div>

              {/* Step 2 */}
              <div className="hiw-step">
                <div className="hiw-step-head">
                  <div className="hiw-num">2</div>
                  <div className="hiw-step-name">They create a listing</div>
                </div>
                <div className="hiw-icon-wrap hiw-icon-green">📋</div>
                <div className="hiw-desc">They sign up and create a listing (register or discover).</div>
                <StepMiniGrid donations={0} listings={2} clicks={1} />
                <div className="hiw-blocks-label hiw-blocks-label-green">+2 blocks</div>
              </div>

              <div className="hiw-arrow">→</div>

              {/* Step 3 */}
              <div className="hiw-step">
                <div className="hiw-step-head">
                  <div className="hiw-num hiw-num-green">3</div>
                  <div className="hiw-step-name">They fulfill a request or donate</div>
                </div>
                <div className="hiw-icon-wrap hiw-icon-green">💚</div>
                <div className="hiw-desc">They fulfill a request or complete a donation on Kradel.</div>
                <StepMiniGrid donations={4} listings={2} clicks={1} />
                <div className="hiw-blocks-label hiw-blocks-label-green">+4 blocks</div>
              </div>

              <div className="hiw-arrow">→</div>

              {/* Step 4 */}
              <div className="hiw-step">
                <div className="hiw-step-head">
                  <div className="hiw-num">4</div>
                  <div className="hiw-step-name">Mission complete!</div>
                </div>
                <div className="hiw-icon-wrap">🎉</div>
                <div className="hiw-desc">Together, you reached your monthly goal.</div>
                <StepMiniGrid donations={13} listings={8} clicks={5} />
                <div className="hiw-blocks-label">Goal Achieved 💜</div>
              </div>
            </div>
          </div>

          {/* ===== BOTTOM TAGLINE ===== */}
          <div className="bottom-tag">
            <div className="bt-left">
              <div className="bt-avatar">🤱🏽</div>
              <div className="bt-text">
                Every click. Every listing. Every act of care. <b>It all adds up to change a mom's life.</b>
              </div>
            </div>
            <div className="bt-pill">Thank you for being part of the change 💜</div>
          </div>

        </div>
      </div>
    </>
  );
}
