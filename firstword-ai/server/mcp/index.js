#!/usr/bin/env node
// Read-only Model Context Protocol (MCP) server for parents' AI assistants.
// Runs via stdio transport. Exposes strictly read-only tools with PIN authentication.
// Stdout must carry ONLY MCP protocol messages; all diagnostic logging goes to stderr.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import * as db from '../db.js';
import { buildDashboard } from '../dashboard.js';
import { retrieve } from '../curriculum/retriever.js';

const MEDICAL_NOTICE = 'These numbers describe what happened inside the app. They are not a medical assessment or diagnosis. Speech recognition makes mistakes.';

// Lockout settings: after 5 failed attempts within 10 minutes, lock for 10 minutes
const FAILED_ATTEMPTS_LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;
const lockoutMap = new Map();

/**
 * Check if a childId is currently locked out from PIN attempts.
 */
export function checkLockout(childId) {
  const now = Date.now();
  const entry = lockoutMap.get(childId);
  if (!entry) return { locked: false };
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const remainingMinutes = Math.max(1, Math.ceil((entry.lockedUntil - now) / 60000));
    return { locked: true, remainingMinutes };
  }
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    entry.lockedUntil = null;
    entry.attempts = [];
  }
  entry.attempts = (entry.attempts || []).filter((t) => now - t < WINDOW_MS);
  if (entry.attempts.length >= FAILED_ATTEMPTS_LIMIT) {
    entry.lockedUntil = now + WINDOW_MS;
    return { locked: true, remainingMinutes: 10 };
  }
  return { locked: false };
}

/**
 * Record a failed PIN attempt.
 */
export function recordFailedAttempt(childId) {
  const now = Date.now();
  let entry = lockoutMap.get(childId);
  if (!entry) {
    entry = { attempts: [], lockedUntil: null };
    lockoutMap.set(childId, entry);
  }
  entry.attempts = (entry.attempts || []).filter((t) => now - t < WINDOW_MS);
  entry.attempts.push(now);
  if (entry.attempts.length >= FAILED_ATTEMPTS_LIMIT) {
    entry.lockedUntil = now + WINDOW_MS;
  }
}

/**
 * Reset failed attempts upon successful authentication.
 */
export function recordSuccess(childId) {
  lockoutMap.delete(childId);
}

/**
 * Reset lockout state for test isolation.
 */
export function _resetLockoutForTest() {
  lockoutMap.clear();
}

/**
 * Authenticate child access:
 * - Freshly re-reads data from disk on every call (Change 4).
 * - PIN is required (Change 1).
 * - Child without a PIN is refused with: "Set a parent PIN in the FirstWord parent view first."
 * - Wrong PIN and unknown child use the exact same generic error (Change 2).
 * - Enforces 10-minute lockout after 5 failed attempts (Change 2).
 */
export function authenticateChild(childId, pin) {
  // Always reload from disk to ensure fresh data
  db.load();

  // Check lockout
  const lockout = checkLockout(childId);
  if (lockout.locked) {
    return {
      error: `Too many failed attempts. Please try again in ${lockout.remainingMinutes} minute(s).`,
      child: null,
    };
  }

  const child = db.getChild(childId);
  if (!child) {
    recordFailedAttempt(childId);
    return {
      error: 'Authentication failed. Please check the child ID and PIN.',
      child: null,
    };
  }

  if (!child.pinHash) {
    return {
      error: 'Set a parent PIN in the FirstWord parent view first.',
      child: null,
    };
  }

  const verified = db.verifyPin(child, pin);
  if (!verified) {
    recordFailedAttempt(childId);
    return {
      error: 'Authentication failed. Please check the child ID and PIN.',
      child: null,
    };
  }

  recordSuccess(childId);
  return { error: null, child };
}

// Initialize MCP Server
export const server = new McpServer({
  name: 'firstword-ai-parent-mcp',
  version: '1.0.0',
});

// Tool 1: get_progress_summary
server.tool(
  'get_progress_summary',
  {
    childId: z.string().min(1, 'childId is required'),
    pin: z.string().min(1, 'pin is required'),
  },
  async ({ childId, pin }) => {
    try {
      const auth = authenticateChild(childId, pin);
      if (auth.error) {
        return {
          isError: true,
          content: [{ type: 'text', text: auth.error }],
        };
      }

      const { child } = auth;
      const dash = buildDashboard(child, { pinVerified: true, range: 'today' });
      const storeTranscripts = child.settings?.storeTranscripts !== false;

      const summary = {
        notice: MEDICAL_NOTICE,
        child: {
          id: child.id,
          name: child.name,
          age: child.age,
          lang: child.lang,
          petType: child.petType,
          petName: child.petName,
          level: child.level,
        },
        today: dash.todayCard ? {
          hasData: dash.todayCard.hasData,
          sentencesCount: dash.todayCard.sentencesCount,
          minutesPlayed: dash.todayCard.minutesPlayed,
          avgWords: dash.todayCard.avgWords,
          avgChangeVsYesterday: dash.todayCard.avgChangeVsYesterday,
          longestSentence: {
            wordCount: dash.todayCard.longestSentence?.wordCount || 0,
            text: storeTranscripts ? (dash.todayCard.longestSentence?.text || null) : null,
          },
          newWords: dash.todayCard.newWords || [],
          situations: dash.todayCard.situations || [],
        } : null,
        speakingScore: dash.speakingScore ? {
          number: dash.speakingScore.number,
          label: dash.speakingScore.label,
          changeVsBaseline: dash.speakingScore.changeVsBaseline,
          diffNumber: dash.speakingScore.diffNumber,
          components: dash.speakingScore.components,
          disclaimer: dash.speakingScore.disclaimer,
        } : null,
        baseline: dash.baseline ? {
          ready: dash.baseline.ready,
          message: dash.baseline.message || null,
          sessionsCount: dash.baseline.sessionsCount || dash.baseline.sessionsCompleted || 0,
        } : null,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    } catch (err) {
      console.error('get_progress_summary error:', err);
      return {
        isError: true,
        content: [{ type: 'text', text: 'An unexpected error occurred processing progress summary.' }],
      };
    }
  }
);

// Tool 2: get_weekly_report
server.tool(
  'get_weekly_report',
  {
    childId: z.string().min(1, 'childId is required'),
    pin: z.string().min(1, 'pin is required'),
  },
  async ({ childId, pin }) => {
    try {
      const auth = authenticateChild(childId, pin);
      if (auth.error) {
        return {
          isError: true,
          content: [{ type: 'text', text: auth.error }],
        };
      }

      const { child } = auth;
      const dash = buildDashboard(child, { pinVerified: true, range: 'week' });
      const storeTranscripts = child.settings?.storeTranscripts !== false;

      // Ensure longest sentence text respects transcript privacy
      const sanitizedTodayCard = dash.todayCard ? {
        ...dash.todayCard,
        longestSentence: {
          wordCount: dash.todayCard.longestSentence?.wordCount || 0,
          text: storeTranscripts ? (dash.todayCard.longestSentence?.text || null) : null,
        },
      } : null;

      const report = {
        notice: MEDICAL_NOTICE,
        child: {
          id: child.id,
          name: child.name,
          age: child.age,
          lang: child.lang,
          petType: child.petType,
          petName: child.petName,
          level: child.level,
        },
        range: dash.range,
        totals: dash.totals,
        level: dash.level,
        speakingScore: dash.speakingScore || null,
        baseline: dash.baseline || null,
        todayCard: sanitizedTodayCard,
        timeline: dash.timeline || [],
        trend: dash.trend || null,
        newWordsThisWeek: dash.newWordsThisWeek || [],
        topWords: dash.topWords || [],
        totalUniqueWords: dash.totalUniqueWords || 0,
        skills: dash.skills || [],
        scenes: dash.scenes || [],
        practiceWords: dash.practiceWords || [],
        suggestions: dash.suggestions || [],
        earlyFlag: dash.earlyFlag || null,
        disclaimer: dash.disclaimer,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      };
    } catch (err) {
      console.error('get_weekly_report error:', err);
      return {
        isError: true,
        content: [{ type: 'text', text: 'An unexpected error occurred processing weekly report.' }],
      };
    }
  }
);

// Tool 3: search_curriculum (pure educational lookup, zero child data)
server.tool(
  'search_curriculum',
  {
    query: z.string().max(200, 'query capped at 200 characters').optional(),
    scene: z.enum(['restaurant', 'shop', 'hospital', 'stage', 'home']).optional(),
    level: z.number().int().min(1).max(4).optional(),
    lang: z.enum(['en', 'bn']).optional().default('en'),
  },
  async ({ query = '', scene = 'home', level = 2, lang = 'en' }) => {
    try {
      const items = retrieve({ lang, scene, level, query });
      // Strictly limit to 5 results
      const results = items.slice(0, 5).map((item) => ({
        id: item.id,
        scene: item.scene,
        level: item.level,
        lang: item.lang,
        targetWords: item.targetWords || [],
        exampleSentences: item.exampleSentences || [],
        followUpQuestions: item.followUpQuestions || [],
        note: item.note || 'draft, to be reviewed by a language professional',
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      };
    } catch (err) {
      console.error('search_curriculum error:', err);
      return {
        isError: true,
        content: [{ type: 'text', text: 'An unexpected error occurred searching curriculum.' }],
      };
    }
  }
);

// Start server on stdio transport if executed as main module
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server/mcp/index.js')) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FirstWord AI Parent MCP server running on stdio');
}
