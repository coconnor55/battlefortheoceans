// src/constants/Features.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Compile-time feature switches for Stripe purchases and Brevo invites
//         - PURCHASE_ENABLED / INVITE_ENABLED read REACT_APP_* env vars
//         - Unset or any value other than 'true' counts as off
//         - Single owner for monetization and invite gates

const version = 'v0.1.0';

export const PURCHASE_ENABLED = process.env.REACT_APP_PURCHASE_ENABLED === 'true';
export const INVITE_ENABLED = process.env.REACT_APP_INVITE_ENABLED === 'true';

console.log(
  `[Features ${version}] PURCHASE_ENABLED=${PURCHASE_ENABLED} INVITE_ENABLED=${INVITE_ENABLED}`
);
