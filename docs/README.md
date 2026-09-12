# Docs

Deeper reference for running your own copy of musing. If you just want to **use the app**, open
[danibsheehan.com/musing](https://www.danibsheehan.com/musing/). If you want to **run it on your
machine**, start with the [root README](../README.md#quick-start).

## Start here by curiosity

| I'm wondering…                                     | Read this                                                                     |
| :------------------------------------------------- | :---------------------------------------------------------------------------- |
| Which env vars can I set, and what do they unlock? | [Configuration](configuration.md)                                             |
| How do I turn on cloud sync?                       | [Configuration → Supabase](configuration.md#supabase-optional-cloud-sync)     |
| How do I publish my own copy to GitHub Pages?      | [Deployment](deploy.md)                                                       |
| How do I turn on the optional AI layer?            | [Deployment → musing-ai-service](deploy.md#deploy-musing-ai-service-optional) |

## What's in this folder

| Path                                   | Role                                                                              |
| :------------------------------------- | :-------------------------------------------------------------------------------- |
| [`configuration.md`](configuration.md) | Environment variables, Supabase setup, keeping a free-tier Supabase project awake |
| [`deploy.md`](deploy.md)               | GitHub Pages ship path and the optional `musing-ai-service` Cloud Run deploy      |

The root [README](../README.md) is the front door: product tour, local setup, stack, and
contribution path.
