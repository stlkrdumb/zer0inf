#!/usr/bin/env node
/**
 * Zer0Inf — CLI Utilities
 * 
 * Shared helpers for all CLI commands: normalization, file I/O, input/weight generation.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { InferInput, InferenceResult } from '../types/index.js';

export function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function loadJSON<T>(path: string): T {
  if (!existsSync(path)) {
    console.error(`Error: File not found: ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

/** Save JSON with BigInt → string serialization for safe round-trip. */
export function saveJSON<T>(path: string, data: T): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const jsonStr = JSON.stringify(data, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
    2
  );
  writeFileSync(path, jsonStr);
}

export function getDefaultInput(): InferInput {
  return {
    income: normalize(75000, 0, 200000),
    debtRatio: normalize(0.3, 0, 1),
    savings: normalize(25, 0, 500),
    employmentYears: normalize(8, 0, 30),
    creditHistoryMonths: normalize(60, 0, 240),
    loanAmount: normalize(50, 0, 500),
    interestRate: normalize(5.5, 0, 25),
    riskScore: normalize(0.3, 0, 1),
  };
}

export function generateRandomWeights(): { weights: number[]; outputWeights: number[] } {
  return {
    weights: Array.from({ length: 48 }, () => (Math.random() - 0.5) * 0.3),
    outputWeights: Array.from({ length: 6 }, () => (Math.random() - 0.5) * 0.3),
  };
}

export interface ProofData {
  modelId: number;
  weightsHash: string;
  proofBytesHex: string;
  publicInputs: bigint[];
  result?: InferenceResult;
}
