- auth retrieval isn't working
  - ✅ add a new "auth-from-curl" subcommand that will read all the args that follow it (after a -- ) as a curl command (either as a quoted curl command, i.e. a single argument or a series of arguments) and will read the token from the auth header or body and the cookie from a cookie flag.
- remove need for workspace on most commands. only needed when fetching from leveldb
- pull out the auth stuff so that you manually run "get auth from curl" or "get auth from slack app" commands that will load the auth, optionally store it (flag) and print it out in the format needed to use env vars
- add a flag to allow reading auth from keychain -- default to on
- allow the MCP to run even if there's no auth and/or workspace or the auth validation fails. have it output an error to stderr in this case and respond with an error to all tool calls.

- update docs about user ids on search tool
- ensure tool & readme are up to date
