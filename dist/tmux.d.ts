import type { ProjectConfig } from "./types.js";
export declare function assertTmuxAvailable(): void;
export declare function sessionExists(config: ProjectConfig): boolean;
export declare function startSession(config: ProjectConfig): void;
export declare function startWatcherWindow(config: ProjectConfig): void;
export declare function attachSession(config: ProjectConfig): void;
export declare function sendKeys(config: ProjectConfig, text: string): void;
export declare function capturePane(config: ProjectConfig, lines?: number): string;
export declare function displayMessage(config: ProjectConfig, message: string, durationMs?: number): void;
