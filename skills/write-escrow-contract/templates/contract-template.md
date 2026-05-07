# Escrow Contract Template

Canonical source: `../scaffold-escrow-project/templates/project/packages/contracts/src/main.nr`.

The default scaffold is a compact OTC atomic onchain settlement contract with:

- `SinglePrivateImmutable<ConfigNote, Context>` for immutable terms;
- `SinglePrivateMutable<StateNote, Context>` for `OPEN`, `VOID`, and `FILLED`;
- constructor funding of the maker's offered asset into escrow-owned private notes;
- caller-sampled creator role secret and caller-bound pseudonym;
- `RoleAdded { secret }` delivered to the caller with `ONCHAIN_UNCONSTRAINED`;
- `OrderFilled { filled: true }` delivered to `self.address` with `ONCHAIN_CONSTRAINED`;
- no custom order-level funding/fill nullifiers.

For generalized escrows, adapt the real Noir files instead of copying Markdown snippets. Load:

- `../scaffold-escrow-project/references/lifecycle-phases.md` for phase selection and transition invariants;
- `references/role-restriction-patterns.md` for role-secret pseudonym checks;
- `references/token-primitive-adapters.md` before changing concrete token calls;
- `templates/order-filled-event-template.md` before adding any fill event payload.

Token method names in the default source are the selected token adapter surface. If the selected token standard differs, update both the Noir calls and TypeScript SDK helpers by capability: constructor funding, private refund, private payout, and private transfer-to-commitment.
