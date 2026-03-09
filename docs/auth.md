# Auth

## Current auth flow

MyChat is moving from a training-only auth flow to a more realistic one.

- `POST /auth/register` is the new registration entry point.
- `POST /auth/login` still uses the old transitional flow and is not fully aligned with password-based authentication yet.
- Successful auth responses return:
  - `user_id`
  - `username`
  - `access_token`
  - `token_type`

## POST /auth/register

Creates a new user account and immediately returns a JWT access token.

Request body:

```json
{
  "username": "alice",
  "password": "secret123"
}
```

Behavior:

- trims spaces around `username`
- rejects empty `username`
- rejects empty `password`
- rejects duplicate `username`
- stores a hashed password in `password_hash`
- returns a JWT for the newly created user

Success response example:

```json
{
  "user_id": 1,
  "username": "alice",
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

## Transitional note about login

`POST /auth/login` is still in a transition state.

- it has not yet been migrated to password verification
- it still follows the previous project flow
- it should be updated in the next auth step after registration is stabilized
