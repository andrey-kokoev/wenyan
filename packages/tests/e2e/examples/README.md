# Examples E2E

Run core lane:

```bash
RUN_EXAMPLES_E2E=1 pnpm --filter @wenyan/tests test -- e2e/examples/rituals-0.6.0-examples.e2e.test.ts
```

Run heavy lane:

```bash
RUN_EXAMPLES_E2E=1 RUN_EXAMPLES_HEAVY=1 pnpm --filter @wenyan/tests test -- e2e/examples/rituals-0.6.0-examples.e2e.test.ts
```
