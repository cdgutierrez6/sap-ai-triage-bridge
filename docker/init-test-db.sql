-- Creates the test database used by integration tests
-- Runs once on first docker-compose up
CREATE DATABASE sap_triage_test;
GRANT ALL PRIVILEGES ON DATABASE sap_triage_test TO sap_user;
