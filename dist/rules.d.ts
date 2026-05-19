import type { Db } from "./db.js";
import type { Rule } from "./types.js";
export declare function findMatch(rule: Rule, output: string): string | null;
export declare function normalizeMatch(value: string): string;
export declare function dedupeKey(rule: Rule, matched: string): string;
export declare function evaluateRule(db: Db, rule: Rule, output: string): void;
export declare function claudeAutoResumeRule(delaySeconds: number, response: string, dedupeSeconds: number): {
    name: string;
    matchType: "regex";
    matchValue: string;
    response: string;
    delaySeconds: number;
    dedupeSeconds: number;
    requireStillVisible: boolean;
    expiryPattern: string;
};
export declare function codexAutoResumeRule(delaySeconds: number, response: string, dedupeSeconds: number): {
    name: string;
    matchType: "regex";
    matchValue: string;
    response: string;
    delaySeconds: number;
    dedupeSeconds: number;
    requireStillVisible: boolean;
    expiryPattern: string;
};
