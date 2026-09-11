# Postman collection

Import both files into Postman (or Insomnia, which reads Postman v2.1
collections):

- `tahfidzul-quran-backend.postman_collection.json`
- `local.postman_environment.json` (select it as the active environment)

## Usage

1. Seed an admin user locally: `npm run seed:admin -- admin@example.com "StrongPassw0rd!"`
   (matches the environment's default `adminIdentifier`/`adminPassword`).
2. Run **Auth > Login** — this stores `accessToken`/`refreshToken` as
   collection variables that every other request reuses via Bearer auth.
3. Run **Locations > Create location** — stores `locationId`.
4. Run **Students > Create student** (uses `{{locationId}}`) — stores
   `studentId`.
5. Run **Assessments > Create assessment** (uses `{{studentId}}`) — stores
   `assessmentId`.
6. Run **Activities > Create activity** (uses `{{locationId}}`) — stores
   `activityId`.

Every "create" request has a test script that captures the returned id, so
running the folders top-to-bottom (or the whole collection via the
Collection Runner) exercises a full create → read → update → archive flow
without manual copy-pasting of IDs.

Auth requests use `{{adminIdentifier}}`/`{{adminPassword}}` from the
environment — override them (or add a second environment) to test as a
`LOCATION_OPERATOR` and confirm the 403 boundaries documented in
[software-requirment.md](../../software-requirment.md) (student/location/
activity/user writes rejected; assessment CRUD restricted to assigned
locations).
