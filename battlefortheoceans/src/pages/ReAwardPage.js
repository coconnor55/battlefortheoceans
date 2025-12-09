// src/pages/ReAwardPage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Admin utility to scan users and grant missing achievement rewards

import React, { useState, useEffect } from 'react';
import { coreEngine } from '../context/GameContext';
import { supabase } from '../utils/supabaseClient';
import RightsService from '../services/RightsService';
import VoucherService from '../services/VoucherService';
import { Award, CheckSquare, Square, X, Loader } from 'lucide-react';

const version = 'v0.1.0';
const tag = "REAWARD";
const module = "ReAwardPage";
let method = "";

const log = (message) => {
  console.log(`[${tag}] ${version} ${module}.${method} : ${message}`);
};

const logerror = (message, error = null) => {
  if (error) {
    console.error(`[${tag}] ${version} ${module}.${method}: ${message}`, error);
  } else {
    console.error(`[${tag}] ${version} ${module}.${method}: ${message}`);
  }
};

function ReAwardPage({ onClose }) {
  method = 'ReAwardPage';
  
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [missingRewards, setMissingRewards] = useState([]);
  const [selectedRewards, setSelectedRewards] = useState(new Set());
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Scan users for missing rewards
  const handleScan = async () => {
    method = 'handleScan';
    setScanning(true);
    setError(null);
    setSuccess(null);
    setMissingRewards([]);
    setSelectedRewards(new Set());

    try {
      log('Starting scan for missing achievement rewards...');

      // 1. Fetch all users (excluding guests and AI)
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, game_name')
        .order('game_name');

      if (usersError) throw usersError;

      // Filter out guests and AI
      const realUsers = (users || []).filter(user => {
        const idStr = String(user.id);
        return !idStr.startsWith('guest-') && !idStr.startsWith('ai-');
      });

      log(`Found ${realUsers.length} real users to scan`);

      // Note: Email is stored in Supabase auth.users, not user_profiles
      // We can't easily fetch emails for all users from client-side without admin access
      // Email will be null for most users - display will handle this gracefully
      const usersWithEmails = realUsers.map(user => ({ ...user, email: null }));

      // 2. Fetch all achievements with rewards
      const { data: achievements, error: achievementsError } = await supabase
        .from('achievements')
        .select('id, name, reward_type, reward_count')
        .not('reward_type', 'is', null)
        .gt('reward_count', 0);

      if (achievementsError) throw achievementsError;

      log(`Found ${achievements.length} achievements with rewards`);

      // 3. For each user, check their unlocked achievements and missing rewards
      const missing = [];

      for (const user of usersWithEmails) {
        // Get user's unlocked achievements
        const { data: userAchievements, error: uaError } = await supabase
          .from('user_achievements')
          .select('achievement_id, unlocked_at')
          .eq('player_id', user.id)
          .eq('unlocked', true);

        if (uaError) {
          logerror(`Error fetching achievements for user ${user.id}:`, uaError);
          continue;
        }

        if (!userAchievements || userAchievements.length === 0) {
          continue;
        }

        // Check each unlocked achievement for missing rewards
        for (const userAchievement of userAchievements) {
          const achievement = achievements.find(a => a.id === userAchievement.achievement_id);
          if (!achievement) continue;

          const rewardType = achievement.reward_type;
          const rewardCount = achievement.reward_count || 0;

          if (!rewardType || rewardCount <= 0) continue;

          // Check if reward was already granted
          // Note: Since metadata isn't stored in user_rights, we can't reliably check
          // which specific achievement a reward is for. We'll use a conservative approach:
          // - For passes: Check if user has ANY achievement passes. If yes, we'll assume
          //   they might have this one (but this could miss some cases).
          // - For vouchers: Check if user has redeemed any achievement vouchers for this era.
          //   Since we can't track which achievement, we'll be conservative.
          let hasReward = false;

          if (rewardType === 'passes') {
            // Check if user has any achievement passes
            // Since we can't track which specific achievement, we'll check if they have
            // any achievement passes at all. This is conservative - it might miss some cases
            // where a user has passes from one achievement but not another.
            const { data: rights, error: rightsError } = await supabase
              .from('user_rights')
              .select('id, created_at')
              .eq('player_id', user.id)
              .eq('rights_type', 'pass')
              .eq('rights_value', 'achievement')
              .gte('uses_remaining', 0) // Not exhausted
              .order('created_at', { ascending: false });

            if (!rightsError && rights && rights.length > 0) {
              // User has achievement passes. Check if any were created after the achievement was unlocked.
              // If the achievement was unlocked before any achievement passes exist, it's likely missing.
              const achievementUnlockedAt = new Date(userAchievement.unlocked_at);
              const hasRecentPasses = rights.some(right => {
                const passCreatedAt = new Date(right.created_at);
                // If passes were created after achievement unlock, assume they might be for this achievement
                // We'll be conservative and assume they might have it
                return passCreatedAt >= achievementUnlockedAt;
              });

              // If user has achievement passes created after unlock, assume they might have this reward
              // This is conservative - we'll show it as potentially missing if we're not sure
              hasReward = hasRecentPasses;
            }
          } else {
            // Check for era voucher (rewardType is era name like 'pirates')
            // Check if a voucher was already created for this user for this achievement
            // Check if a voucher was already created for this user for this achievement
            const { data: vouchers, error: vouchersError } = await supabase
              .from('vouchers')
              .select('voucher_code, created_at, purpose')
              .eq('created_for', user.id)
              .eq('purpose', 'achievement')
              .order('created_at', { ascending: false });

            if (!vouchersError && vouchers && vouchers.length > 0) {
              // Check if any of these vouchers were created after achievement unlock
              // If a voucher with created_for exists, it means the reward was already granted
              const achievementUnlockedAt = new Date(userAchievement.unlocked_at);
              const hasVoucherForThisUser = vouchers.some(voucher => {
                const voucherCreatedAt = new Date(voucher.created_at);
                // Voucher created after achievement unlock means reward was granted
                return voucherCreatedAt >= achievementUnlockedAt;
              });

              // If voucher exists for this user created after unlock, reward was already granted
              hasReward = hasVoucherForThisUser;
            }
          }

          // Always show as potentially missing if we can't verify
          // Admin can review and decide
          if (!hasReward) {
            missing.push({
              userId: user.id,
              userName: user.game_name || user.email || user.id,
              userEmail: user.email,
              achievementId: achievement.id,
              achievementName: achievement.name,
              rewardType: rewardType,
              rewardCount: rewardCount,
              unlockedAt: userAchievement.unlocked_at
            });
          }
        }
      }

      log(`Found ${missing.length} missing rewards`);
      setMissingRewards(missing);

    } catch (err) {
      logerror('Error scanning for missing rewards:', err);
      setError(err.message || 'Failed to scan users');
    } finally {
      setScanning(false);
    }
  };

  // Toggle selection of a reward
  const toggleReward = (index) => {
    const newSelected = new Set(selectedRewards);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRewards(newSelected);
  };

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (selectedRewards.size === missingRewards.length) {
      setSelectedRewards(new Set());
    } else {
      setSelectedRewards(new Set(missingRewards.map((_, index) => index)));
    }
  };

  // Grant selected missing awards
  const handleGrantAwards = async () => {
    method = 'handleGrantAwards';
    setLoading(true);
    setError(null);
    setSuccess(null);

    const selected = Array.from(selectedRewards).map(index => missingRewards[index]);
    
    if (selected.length === 0) {
      setError('Please select at least one reward to grant');
      setLoading(false);
      return;
    }

    try {
      log(`Granting ${selected.length} missing rewards...`);

      let granted = 0;
      let failed = 0;

      for (const reward of selected) {
        try {
          if (reward.rewardType === 'passes') {
            // Grant passes
            await RightsService.creditPasses(
              reward.userId,
              reward.rewardCount,
              'achievement',
              {
                achievement_id: reward.achievementId,
                achievement_name: reward.achievementName
              }
            );
            log(`Granted ${reward.rewardCount} passes to ${reward.userName} for ${reward.achievementName}`);
            granted++;
          } else {
            // Grant era voucher
            const voucherCode = await VoucherService.generateVoucher(
              reward.rewardType, // era name (e.g., 'pirates')
              reward.rewardCount,
              'achievement',
              null, // created_by = null for system rewards
              null, // emailSentTo = null
              0, // rewardPasses not applicable
              0, // signupBonus not applicable
              reward.userId // created_for = user who should receive the reward
            );
            await VoucherService.redeemVoucher(reward.userId, voucherCode);
            log(`Granted ${reward.rewardCount} ${reward.rewardType} voucher(s) to ${reward.userName} for ${reward.achievementName}`);
            granted++;
          }
        } catch (err) {
          logerror(`Failed to grant reward to ${reward.userName} for ${reward.achievementName}:`, err);
          failed++;
        }
      }

      setSuccess(`Successfully granted ${granted} reward(s). ${failed > 0 ? `${failed} failed.` : ''}`);
      
      // Remove granted rewards from the list
      const remaining = missingRewards.filter((_, index) => !selectedRewards.has(index));
      setMissingRewards(remaining);
      setSelectedRewards(new Set());

      // Re-scan to verify
      setTimeout(() => {
        handleScan();
      }, 2000);

    } catch (err) {
      logerror('Error granting awards:', err);
      setError(err.message || 'Failed to grant awards');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container flex flex-column flex-center">
      <div className="content-pane content-pane--wide">
        <div className="card-header card-header--with-close">
          <div>
            <h2 className="card-title">Grant Missing Achievement Rewards</h2>
          </div>
          {onClose && (
            <button className="btn btn--secondary btn--sm" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        <div className="card-body card-body--scrollable">
        <div className="form-group">
          <p>This utility scans all users to find missing achievement rewards (passes and vouchers) that should have been granted but weren't.</p>
          <button
            className="btn btn--primary"
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? (
              <>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Award size={16} />
                <span>Scan Users</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="message message--error">
            {error}
          </div>
        )}

        {success && (
          <div className="message message--success">
            {success}
          </div>
        )}

        {missingRewards.length > 0 && (
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Missing Rewards ({missingRewards.length})</h3>
              <button
                className="btn btn--secondary btn--small"
                onClick={toggleSelectAll}
              >
                {selectedRewards.size === missingRewards.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="scrollable-list" style={{ maxHeight: '50vh' }}>
              {missingRewards.map((reward, index) => (
                <div
                  key={`${reward.userId}-${reward.achievementId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    background: 'var(--bg-overlay)',
                    borderRadius: 'var(--border-radius-sm)',
                    border: selectedRewards.has(index) ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleReward(index)}
                >
                  {selectedRewards.has(index) ? (
                    <CheckSquare size={20} style={{ marginRight: '0.75rem', color: 'var(--primary)' }} />
                  ) : (
                    <Square size={20} style={{ marginRight: '0.75rem', color: 'var(--text-secondary)' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      {reward.userName}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      {reward.userEmail || `ID: ${reward.userId.substring(0, 8)}...`}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <strong>{reward.achievementName}</strong> → {reward.rewardCount} {reward.rewardType === 'passes' ? 'Pass(es)' : `${reward.rewardType} Voucher(s)`}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                className="btn btn--primary"
                onClick={handleGrantAwards}
                disabled={loading || selectedRewards.size === 0}
              >
                {loading ? (
                  <>
                    <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Granting...</span>
                  </>
                ) : (
                  <>
                    <Award size={16} />
                    <span>Grant Missing Awards ({selectedRewards.size} selected)</span>
                  </>
                )}
              </button>
              {onClose && (
                <button className="btn btn--secondary" onClick={onClose}>
                  Close
                </button>
              )}
            </div>
          </div>
        )}

        {!scanning && missingRewards.length === 0 && !error && (
          <div className="message">
            Click "Scan Users" to find missing achievement rewards.
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default ReAwardPage;

