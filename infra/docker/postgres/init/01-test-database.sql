-- A separate database for automated integration tests, so they never touch dev data.
CREATE DATABASE church_test OWNER church;
CREATE DATABASE church_shadow OWNER church;
