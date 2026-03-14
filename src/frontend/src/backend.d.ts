import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Message {
    id: bigint;
    content: string;
    role: string;
    timestamp: bigint;
}
export interface backendInterface {
    clearHistory(): Promise<void>;
    deleteApiKey(name: string): Promise<void>;
    getApiKey(name: string): Promise<string | null>;
    getHistory(): Promise<Array<Message>>;
    isAdminPasswordSet(): Promise<boolean>;
    listApiKeyNames(): Promise<Array<string>>;
    saveJarvisMessage(content: string): Promise<void>;
    sendMessage(userText: string): Promise<string>;
    setAdminPassword(password: string): Promise<void>;
    setApiKey(name: string, value: string): Promise<void>;
    verifyAdminPassword(password: string): Promise<boolean>;
}
