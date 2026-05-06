# Ready-to-Use Prompts

Use these prompts when you want only the contract and TypeScript SDK layer.

## Scaffold Contract + SDK

```text
Scaffold an Aztec private escrow project with Noir contracts and a TypeScript SDK.
Do not create an API, CLI, orderflow service, frontend, or runnable app yet.
```

## Secret Escrow

```text
Create an Aztec private escrow contract package using a secret contract deployment,
contract-owned shared private state, and an offchain manifest for participant handoff.
Include the TypeScript SDK helpers for deploy, register, authwit creation, and contract calls.
```

## Custom Escrow Contract

```text
Write a new Aztec escrow contract in Noir where a maker can lock one private token
and a taker can fill by providing another token. Keep state private, use explicit
role checks, and include the TypeScript integration code.
```

## Phase-Based Escrow

```text
Write a phase-based Aztec private escrow contract with CREATED, OPEN, VOID,
optional ACCEPTED, optional SETTLEMENT_IN_PROGRESS, and FILLED states. Keep
lifecycle state contract-owned and private, and keep token APIs adapter-specific.
```

## Role-Secret Auth

```text
Add private role-secret authentication to the Aztec escrow contract. Store
caller-owned RoleSecretNote values in Owned<PrivateImmutable>, store maker/taker
pseudonyms as Field values in config, and check the caller's pseudonym in each
role-gated private entrypoint.
```

## Config + State Split

```text
Refactor the Aztec escrow contract around immutable ConfigNote terms and optional
mutable StateNote lifecycle state. Store sensitive offchain terms as salted
commitments, deliver plaintexts offchain, and use anchor block timestamps for
phase deadlines.
```

## Design Intake First

```text
Before writing files, ask me to confirm the escrow phases, timing windows, and
ConfigNote vs StateNote fields. Recommend defaults from my spec, then wait for
confirmation or corrections.
```

## Build

```text
Build the Aztec escrow contract and generate the TypeScript bindings.
```
