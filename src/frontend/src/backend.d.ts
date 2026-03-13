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
    getHistory(): Promise<Array<Message>>;
    getMessageCount(): Promise<bigint>;
    sendMessage(userText: string): Promise<string>;
}
