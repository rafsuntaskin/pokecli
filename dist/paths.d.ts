export declare function getProjectRoot(cwd?: string): string;
export declare function getPokeDir(projectRoot: string): string;
export declare function getConfigPath(projectRoot: string): string;
export declare function getDbPath(projectRoot: string): string;
export declare function getTmuxSocketPath(projectRoot: string): string;
export declare function ensurePokeDir(projectRoot: string): void;
export declare function createTmuxTarget(projectRoot: string): string;
