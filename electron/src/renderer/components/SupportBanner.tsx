import React, { useState, useEffect, useCallback } from 'react';
import { Heart, X } from 'lucide-react';
import type { NudgeState } from '../lib/types';

const GUMROAD_URL = 'https://gumroad.com/l/emdy';

interface SupportBannerProps {
  nudgeState: NudgeState | null;
}

function shouldShowBanner(state: NudgeState): boolean {
  if (state.contributed) return false;
  if (state.dismissCount >= 3) return false;
  if (state.dismissedUntil) {
    const until = new Date(state.dismissedUntil);
    if (new Date() < until) return false;
  }
  if (state.filesOpened < 10) return false;
  if (state.appLaunches < 3) return false;
  if (!state.firstLaunchDate) return false;
  const daysSinceFirst = (Date.now() - new Date(state.firstLaunchDate).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceFirst < 5) return false;
  return true;
}

export function SupportBanner({ nudgeState }: SupportBannerProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (nudgeState && shouldShowBanner(nudgeState) && !dismissed) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [nudgeState, dismissed]);

  const handleContribute = useCallback(async () => {
    await window.electronAPI.openExternal(GUMROAD_URL);
    await window.electronAPI.setNudgeSetting('contributed', true);
    setVisible(false);
  }, []);

  const handleLater = useCallback(() => {
    setDismissed(true);
    setVisible(false);
  }, []);

  const handleDismiss = useCallback(async () => {
    const until = new Date();
    until.setDate(until.getDate() + 30);
    await window.electronAPI.setNudgeSetting('dismissedUntil', until.toISOString());
    const newCount = (nudgeState?.dismissCount ?? 0) + 1;
    await window.electronAPI.setNudgeSetting('dismissCount', newCount);
    setDismissed(true);
    setVisible(false);
  }, [nudgeState]);

  if (!visible) return null;

  return (
    <div className="support-banner">
      <div className="support-banner-content">
        <Heart size={16} strokeWidth={1.5} className="support-banner-icon" />
        <div className="support-banner-text">
          <span className="support-banner-title">Support Emdy</span>
          <span className="support-banner-subtitle">Pay what you want to keep it going.</span>
        </div>
      </div>
      <div className="support-banner-actions">
        <button className="support-banner-cta" onClick={handleContribute}>Contribute</button>
        <button className="support-banner-later" onClick={handleLater}>Later</button>
        <button className="support-banner-close" onClick={handleDismiss} aria-label="Dismiss for 30 days">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
