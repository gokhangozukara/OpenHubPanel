#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_password APP_DATABASE_PASSWORD
ALTER ROLE openhub_app LOGIN PASSWORD :'app_password';
REVOKE CONNECT ON DATABASE openhubpanel FROM PUBLIC;
GRANT CONNECT ON DATABASE openhubpanel TO openhub_app;
SQL
