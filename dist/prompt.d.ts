type Choice<T extends string> = {
    name: string;
    value: T;
};
export declare function askInput(options: {
    message: string;
    default?: string;
    required?: boolean;
    validate?: (value: string) => true | string;
}): Promise<string>;
export declare function askConfirm(options: {
    message: string;
    default?: boolean;
}): Promise<boolean>;
export declare function askSelect<T extends string>(options: {
    message: string;
    choices: Choice<T>[];
}): Promise<T>;
export {};
