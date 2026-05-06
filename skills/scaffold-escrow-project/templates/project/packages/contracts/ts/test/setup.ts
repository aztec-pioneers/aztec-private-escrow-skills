import { expect } from "bun:test";

type EqualityTester = (a: unknown, b: unknown) => boolean | undefined;
type ExpectWithJestHook = typeof expect & {
    addEqualityTesters?: (testers: EqualityTester[]) => void;
};

const globalWithTesters = globalThis as typeof globalThis & {
    expect?: ExpectWithJestHook;
    __extraEqualityTesters?: EqualityTester[];
};

globalWithTesters.__extraEqualityTesters ??= [];

const bunExpect = expect as ExpectWithJestHook;
bunExpect.addEqualityTesters ??= (testers: EqualityTester[]) => {
    globalWithTesters.__extraEqualityTesters?.push(...testers);
};

globalWithTesters.expect = bunExpect;
