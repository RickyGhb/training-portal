-- Rename Role enum values:
--   MANAGER -> LOCATION_MANAGER (keeps the old Manager's org-wide permissions)
--   LOCATION_MANAGER -> LOCATION_ADMIN (keeps the old Location Manager's location-scoped permissions)
-- Order matters: LOCATION_MANAGER must move out of the way first, otherwise
-- renaming MANAGER -> LOCATION_MANAGER would collide with the existing value.
ALTER TYPE "Role" RENAME VALUE 'LOCATION_MANAGER' TO 'LOCATION_ADMIN';
ALTER TYPE "Role" RENAME VALUE 'MANAGER' TO 'LOCATION_MANAGER';
