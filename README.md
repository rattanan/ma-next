# MA Next

MA Next is the MariaDB-backed Next.js App Router modernization target for the maintenance-management system. The foundation uses strict TypeScript, Prisma, Tailwind CSS, shadcn/ui conventions, opaque server sessions, normalized roles and permissions, auditable mutations, structured logging, attachments, notifications, and scoped organization data.

## Local setup

1. Copy `.env.example` to `.env` and change the local-only credentials.
2. Create an empty MariaDB database named by `DATABASE_URL`. Never use a production URL for development or tests.
3. Install and generate the client with `npm install`.
4. Apply the migration with `npm run db:deploy` or use `npm run db:migrate` for a disposable development database.
5. Load deterministic development data with `npm run db:seed`.
6. Start the application with `npm run dev`.

The seed requires `SEED_ADMIN_PASSWORD` in production and never contains a production credential.

## Quality commands

```bash
npm run db:validate
npm run lint
npm run typecheck
npm test
npm run build
```

Integration tests run only when `TEST_DATABASE_URL` explicitly identifies an isolated, disposable MariaDB database:

```bash
TEST_DATABASE_URL="mysql://.../ma_next_test" npm run test:integration
```

## Security model

- Route handlers and server-rendered pages enforce permissions on the server.
- Client-side navigation visibility is not an authorization boundary.
- Mutating forms and handlers parse data with shared Zod schemas.
- Organization, configuration, attachment, and notification mutations commit their audit record in the same Prisma transaction.
- Log serialization recursively redacts password, token, secret, authorization, and cookie fields.
- Attachment storage is represented by a driver and storage key; database rows do not contain file bytes or provider credentials.
