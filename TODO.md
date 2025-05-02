- auth retrieval isn't working
  - add a new "auth-from-curl" subcommand that will read all the args that follow it (after a -- ) as a curl command (either as a quoted curl command, i.e. a single argument or a series of arguments) and will read the token from the auth header or body and the cookie from a cookie flag.

- update docs about user ids on search tool
- ensure tool & readme are up to date
