/* tslint:disable */
/* eslint-disable */

export class LiteParse {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Construct a new parser. `config` is a JS object (all fields optional).
     * If `config.ocrEngine` is present, it is wired up as the OCR backend.
     */
    constructor(config: any);
    /**
     * Parse PDF bytes. Returns `Promise<ParseResult>`.
     */
    parse(data: Uint8Array): Promise<any>;
    /**
     * Return the resolved config (camelCase JS object).
     */
    readonly config: any;
}

export function __wasm_start(): void;

/**
 * Search text items for phrase matches, returning merged items with combined bounding boxes.
 */
export function searchItems(items: any, options: any): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_liteparse_free: (a: number, b: number) => void;
    readonly liteparse_config: (a: number) => [number, number, number];
    readonly liteparse_new: (a: any) => [number, number, number];
    readonly liteparse_parse: (a: number, b: number, c: number) => any;
    readonly searchItems: (a: any, b: any) => [number, number, number];
    readonly __wasm_start: () => void;
    readonly __wasm_longjmp: (a: number, b: number) => void;
    readonly __wasm_setjmp: (a: number, b: number, c: number) => void;
    readonly __wasm_setjmp_test: (a: number, b: number) => number;
    readonly getpid: () => number;
    readonly pthread_mutex_destroy: (a: number) => number;
    readonly pthread_mutex_init: (a: number, b: number) => number;
    readonly pthread_mutex_lock: (a: number) => number;
    readonly pthread_mutex_unlock: (a: number) => number;
    readonly wasm_bindgen__convert__closures_____invoke__h95aff783bfef28ab: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h0b5ed50d966b6ae4: (a: number, b: number, c: any, d: any) => void;
    readonly __wbindgen_malloc_command_export: (a: number, b: number) => number;
    readonly __wbindgen_realloc_command_export: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store_command_export: (a: number) => void;
    readonly __externref_table_alloc_command_export: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free_command_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_destroy_closure_command_export: (a: number, b: number) => void;
    readonly __externref_table_dealloc_command_export: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
