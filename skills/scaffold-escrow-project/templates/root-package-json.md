# Root Project Template Index

The generated project boilerplate lives as real files under `templates/project/`.
Copy these files into the target project before applying requested package names or protocol-specific edits:

- `templates/project/package.json` - includes `postinstall` and `localnet`
- `templates/project/.gitignore`
- `templates/project/.gitmodules`
- `templates/project/scripts/token.ts`
- `templates/project/packages/contracts/package.json`
- `templates/project/packages/contracts/tsconfig.json`
- `templates/project/packages/contracts/Nargo.toml`
- `templates/project/packages/contracts/src/main.nr`
- `templates/project/packages/contracts/src/types/{mod.nr,config_note.nr,state_note.nr}`
- `templates/project/packages/contracts/scripts/add_artifacts.ts`
- `templates/project/packages/contracts/ts/test/setup.ts`

Keep generated TypeScript sources in `templates/project/packages/contracts/ts/src/`.
This index exists so older references to `root-package-json.md` still lead agents to the canonical template files.
