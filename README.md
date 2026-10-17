# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Tests

`npm test` runs every `src/lib/*.test.ts` with Node's built-in test runner on the `.ts` files directly, so it needs Node 22.18+ or 24. That is the shared request-window vectors plus the pure logic of the Compensation page (`lib/compensation.ts`), the HOD Assignment page (`lib/hod.ts`), the holiday-work approvals (`lib/holiday-work.ts`), the attendance-calendar markers (`lib/attendance-flags.ts`) the contact block (`lib/contact-block.ts`) and the one-time-code screens (`lib/otp-channel.ts`: the words for a code sent by SMS, by WhatsApp or by an older server that names neither, and the error sentences).

A module under `src/lib` that a test loads must stay loadable by Node: relative imports with the `.ts` extension (never the `@/` alias), type-only imports from `../types/index.ts`, and no React, Vite or browser globals. `tsconfig.node.json` type-checks the tests and everything they import, so `npx tsc -b` catches a slip.
