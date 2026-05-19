import type { ProjectConfig } from "./types.js";
export declare function configExists(projectRoot: string): boolean;
export declare function readConfig(projectRoot: string): ProjectConfig;
export declare function writeConfig(config: ProjectConfig): void;
export declare function updateConfig(projectRoot: string, update: Partial<ProjectConfig>): ProjectConfig;
