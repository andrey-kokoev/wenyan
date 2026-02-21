# Examples E2E

Run examples rituals (strict default):

```bash
pnpm --filter @andrey-kokoev/wenyan-tests test -- e2e/examples/rituals-0.6.0-examples.e2e.test.ts e2e/examples/rituals-0.7.0.e2e.test.ts
```

Run bridge integration rituals (strict default):

```bash
pnpm --filter @andrey-kokoev/wenyan-bridge test -- src/nats.integration.test.ts src/kafka.integration.test.ts src/mqtt.integration.test.ts
```
