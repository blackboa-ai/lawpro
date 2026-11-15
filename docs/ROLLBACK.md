# Restoring LawPro v2.2

## Release references

| Component | Known-good reference |
| --- | --- |
| Source | [v2.2 commit `9fa442c8fb3aa1e6daea969abe26446f3e6329e6`](https://github.com/blackboa-ai/lawpro/commit/9fa442c8fb3aa1e6daea969abe26446f3e6329e6) |
| Frontend | [v2.2 Vercel deployment](https://vercel.com/blackboa/lawpro/6HqdBuXJ4Wauwwxwtvs2JSjAsBQW) · [Production web app](https://lawpro-five.vercel.app) |
| Backend | [Render deployment used by v2.2](https://dashboard.render.com/web/srv-dbsesnrl550s73896tog/deploys/dep-dbstan95efls73f59vfg), from [`1f1a8bbd76882f0df0e179a2c43ab5663b8bc61e`](https://github.com/blackboa-ai/lawpro/commit/1f1a8bbd76882f0df0e179a2c43ab5663b8bc61e) |
| Database | Neon PostgreSQL. Last documented production migration is `20261115_hearing_history`. v2.2 added no migration. |

## Before releasing Google sign-in

- Keep email/password sign-in available. Make Google sign-in independently switchable and test the disabled state in preview.
- If Google sign-in adds database fields or tables, test that the v2.2 backend still works with the upgraded schema. Keep the migration additive so an application rollback can leave the schema in place.
- Before enabling public sign-ups through Google, make sure those users have a supported way to access their accounts during a rollback.

## If the update fails

1. **Disable Google sign-in** if its release switch is available and the existing login still works. Check that email/password sign-in and case access work.
2. **Restore the frontend if needed.** In the Vercel deployment history, use Instant Rollback on the recorded v2.2 deployment if it is eligible. The Hobby plan limits Instant Rollback to the immediately previous production deployment. If v2.2 is no longer eligible, open a GitHub PR that reverts the faulty release and review the resulting diff against the recorded baseline. After approval for the production change, deploy the reviewed revert through the existing Vercel project. [Vercel rollback documentation](https://vercel.com/docs/instant-rollback)
3. **Restore the backend only if the problem requires it.** Use the recorded Render deployment if its artifact is available and the deployed database schema is compatible. A dashboard rollback disables Render auto-deploy. Check that setting after the fix is ready. If the artifact is unavailable, deploy the reviewed backend revert from GitHub after approval for the production change. [Render rollback documentation](https://render.com/docs/rollbacks)
4. **Keep Neon and its current data in place.** This app rollback does not include a database restore or downgrade. If the previous backend cannot run against the current schema, pause and review a separate database recovery plan. Get explicit approval before any production database migration or restore.
5. **Verify recovery on the production URL.** Sign in with an existing test account using email and password, open a sample case and its hearing history, and check the calendar and CSV exports. Use sample data for the checks.
