# Workflow test scenarios

## Automated coverage

- Role permission matrix and Administrator compatibility
- Operator cannot assign; Technician cannot approve or close; Manager can assign and return
- Valid full transition path and every forbidden skip
- Assignment ownership enforcement
- Operator acceptance only after manager approval
- Work Order closure only after acceptance and without an active recheck
- Notification closure only after linked Work Orders close
- Completion revision increment and immutability contract
- Required return reasons and required correction actions
- Organization/department scope isolation
- Server command schemas reject arbitrary status input
- Responsibility and overdue calculation

Run:

```bash
npm run db:validate
npm run typecheck
npm run lint
npm test
TEST_DATABASE_URL="mysql://.../ma_next_test" npm run test:integration
npm run build
```

The integration database must be disposable and must never point to production.

## Manual role walkthrough

1. Sign in as Operator and create/submit a Notification.
2. Sign in as Manager, start review, request information, then approve after Operator response.
3. Create a Work Order and assign Technician A.
4. Technician A accepts, starts, records work, and submits revision 1.
5. Manager returns it with required actions; optionally assign Technician B.
6. Assigned technician starts recheck and submits revision 2; confirm revision 1 is unchanged.
7. Manager approves. Confirm Operator acceptance is now requested.
8. Operator rejects once; Manager returns it; technician resubmits; Manager approves.
9. Operator accepts. Confirm Technician still cannot close.
10. Manager closes Work Order; Operator closes Notification.
11. Confirm every action appears chronologically in entity timeline and audit log.

