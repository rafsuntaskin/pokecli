export declare function runProjectMenu(projectRoot: string): Promise<void>;
export declare function startConfiguredSession(projectRoot: string): Promise<void>;
export declare function printRules(projectRoot: string): void;
export declare function printActions(projectRoot: string, pendingOnly: boolean): void;
export declare function cancelPendingAction(projectRoot: string, id: string): void;
export declare function setAutomation(projectRoot: string, paused: boolean): void;
export declare function setRuleState(projectRoot: string, ruleId: string, enabled: boolean): void;
