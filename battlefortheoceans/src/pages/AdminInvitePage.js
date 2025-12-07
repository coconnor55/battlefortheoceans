// src/pages/AdminInvitePage.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.1.0: Initial AdminInvitePage - allows admins to invite new players with custom messages and vouchers

import React, { useState } from 'react';
import { coreEngine } from '../context/GameContext';
import VoucherService from '../services/VoucherService';
import { Mail, ChevronUp, ChevronDown, Send } from 'lucide-react';

const version = 'v0.1.0';
const tag = "ADMIN_INVITE";
const module = "AdminInvitePage";
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

function AdminInvitePage({ onClose }) {
  method = 'AdminInvitePage';
  
  const playerId = coreEngine.playerId;
  const playerEmail = coreEngine.playerEmail;
  const playerGameName = coreEngine.playerGameName;
  
  const [friendEmail, setFriendEmail] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [passCount, setPassCount] = useState(2);
  const [piratesVoucherCount, setPiratesVoucherCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const handleIncrementPasses = () => {
    setPassCount(prev => prev + 1);
  };
  
  const handleDecrementPasses = () => {
    setPassCount(prev => Math.max(1, prev - 1));
  };
  
  const handleIncrementPirates = () => {
    setPiratesVoucherCount(prev => prev + 1);
  };
  
  const handleDecrementPirates = () => {
    setPiratesVoucherCount(prev => Math.max(1, prev - 1));
  };
  
  const handleSendInvite = async () => {
    method = 'handleSendInvite';
    
    // Validate email
    if (!friendEmail || !friendEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (friendEmail.toLowerCase() === playerEmail?.toLowerCase()) {
      setError('You cannot send an invite to yourself');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      log(`Sending admin invite to ${friendEmail} with ${passCount} passes and ${piratesVoucherCount} Pirates vouchers`);
      
      // Validate at least one voucher type is selected
      if (passCount <= 0 && piratesVoucherCount <= 0) {
        throw new Error('At least one voucher (Passes or Pirates) must be included');
      }
      
      // Generate pass voucher if count > 0
      let passVoucherCode = null;
      if (passCount > 0) {
        passVoucherCode = await VoucherService.generateVoucher(
          'pass',
          passCount,
          'admin_invite',
          playerId,
          friendEmail.trim(),
          0, // rewardPasses
          0  // referralSignup
        );
        log(`Generated pass voucher: ${passVoucherCode}`);
      }
      
      // Generate Pirates voucher if count > 0
      let piratesVoucherCode = null;
      if (piratesVoucherCount > 0) {
        piratesVoucherCode = await VoucherService.generateVoucher(
          'pirates',
          piratesVoucherCount,
          'admin_invite',
          playerId,
          friendEmail.trim(),
          0, // rewardPasses
          0  // referralSignup
        );
        log(`Generated Pirates voucher: ${piratesVoucherCode}`);
      }
      
      // Build voucher codes string for email
      const voucherCodes = [];
      if (passVoucherCode) voucherCodes.push(passVoucherCode);
      if (piratesVoucherCode) voucherCodes.push(piratesVoucherCode);
      
      // Send email via Netlify function (admin invite endpoint)
      const response = await fetch('/.netlify/functions/send-admin-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          friendEmail: friendEmail.trim(),
          senderName: playerGameName || 'Admin',
          senderEmail: playerEmail,
          voucherCode: voucherCodes.join(', '), // Multiple vouchers separated by comma
          eraName: 'Battle for the Oceans',
          customMessage: customMessage.trim() || null
        })
      });
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          throw new Error(`Failed to send invite email (${response.status} ${response.statusText})`);
        }
        const errorMessage = errorData.error || errorData.details || 'Failed to send invite email';
        throw new Error(errorMessage);
      }
      
      setSuccess(`Invite sent successfully to ${friendEmail}!`);
      log(`Admin invite sent successfully`);
      
      // Reset form
      setFriendEmail('');
      setCustomMessage('');
      setPassCount(2);
      setPiratesVoucherCount(2);
      
    } catch (err) {
      logerror('Failed to send admin invite:', err);
      setError(err.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="modal-content">
      <div className="modal-header">
        <h2>Invite New Player</h2>
        <button
          className="btn btn--icon"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      
      <div className="modal-body">
        <div className="form-group">
          <label htmlFor="friendEmail">Email Address</label>
          <input
            id="friendEmail"
            type="email"
            className="input"
            placeholder="friend@example.com"
            value={friendEmail}
            onChange={(e) => setFriendEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <div style={{ background: 'var(--bg-overlay)', padding: '1rem', borderRadius: 'var(--border-radius-sm)', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>
            {playerGameName || 'Admin'} has invited you to play Battle for the Oceans, modeled after the 1920s paper game of Battleship. Please try playing a game as a guest, and then sign up to create a game account where you will be able to use the following passes and vouchers to play more games.
          </div>
          
          <label htmlFor="customMessage">Optional custom message:</label>
          <textarea
            id="customMessage"
            className="input"
            rows="4"
            placeholder="Add a personal message..."
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            disabled={loading}
            style={{ resize: 'vertical', minHeight: '100px' }}
          />
        </div>
        
        <div className="form-group">
          <label>Passes</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn--secondary btn--icon"
              onClick={handleDecrementPasses}
              disabled={loading || passCount <= 1}
              aria-label="Decrease passes"
            >
              <ChevronDown size={16} />
            </button>
            <input
              type="number"
              className="input"
              min="1"
              value={passCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 2;
                setPassCount(Math.max(1, val));
              }}
              disabled={loading}
              style={{ width: '80px', textAlign: 'center' }}
            />
            <button
              type="button"
              className="btn btn--secondary btn--icon"
              onClick={handleIncrementPasses}
              disabled={loading}
              aria-label="Increase passes"
            >
              <ChevronUp size={16} />
            </button>
            <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
              {passCount === 1 ? 'Pass' : 'Passes'}
            </span>
          </div>
        </div>
        
        <div className="form-group">
          <label>Pirates Vouchers</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn--secondary btn--icon"
              onClick={handleDecrementPirates}
              disabled={loading || piratesVoucherCount <= 1}
              aria-label="Decrease Pirates vouchers"
            >
              <ChevronDown size={16} />
            </button>
            <input
              type="number"
              className="input"
              min="1"
              value={piratesVoucherCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 2;
                setPiratesVoucherCount(Math.max(1, val));
              }}
              disabled={loading}
              style={{ width: '80px', textAlign: 'center' }}
            />
            <button
              type="button"
              className="btn btn--secondary btn--icon"
              onClick={handleIncrementPirates}
              disabled={loading}
              aria-label="Increase Pirates vouchers"
            >
              <ChevronUp size={16} />
            </button>
            <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)' }}>
              {piratesVoucherCount === 1 ? 'Voucher' : 'Vouchers'}
            </span>
          </div>
        </div>
        
        {error && (
          <div className="message message--error" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}
        
        {success && (
          <div className="message message--success" style={{ marginTop: '1rem' }}>
            {success}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button
            className="btn btn--primary"
            onClick={handleSendInvite}
            disabled={loading || !friendEmail || (passCount <= 0 && piratesVoucherCount <= 0)}
          >
            {loading ? (
              'Sending...'
            ) : (
              <>
                <Send size={16} style={{ marginRight: '0.5rem' }} />
                SEND INVITE
              </>
            )}
          </button>
          <button
            className="btn btn--secondary"
            onClick={onClose}
            disabled={loading}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminInvitePage;

// EOF

