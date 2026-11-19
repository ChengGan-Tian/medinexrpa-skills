# MedinexRPA Skills

Agent Skills for the MedinexRPA family: the browser edition and the mobile/Android edition.

[中文](README.md)

## Skills

| Skill | Platform | Description |
|---|---|---|
| [`medinexrpa-mobile`](skills/medinexrpa-mobile) | Mobile / Android | Product overview, script authoring, selectors, list traversal, vision fallback, multi-device tasks, troubleshooting |
| [`medinex-rpa`](skills/medinex-rpa) | Browser / Playwright | Browser-edition script development, review, debugging, regression, and deployment |

## Install

With the Skills CLI:

```bash
# Mobile
npx skills add ChengGan-Tian/medinexrpa-skills@medinexrpa-mobile -g -y

# Browser
npx skills add ChengGan-Tian/medinexrpa-skills@medinex-rpa -g -y
```

Or copy a skill into your agent's skill directory:

```text
OpenCode global   ~/.config/opencode/skills/<skill-name>
Project-local     <project>/.opencode/skills/<skill-name>
```

## Layout

```text
skills/
  medinexrpa-mobile/
    SKILL.md              Product, workflow, API, selectors, lists, vision, debugging, deployment
    references/
      product.md          Capabilities, architecture, data dirs, task model
      script-api.md       device / kit / selector / vision API
      patterns.md         Lists, pagination, waits, retries, page guards
      vision.md           Template matching, OCR, visual confirmation
      troubleshooting.md  Triage order, logs, known pitfalls
    assets/
      script-template.js  Copyable script skeleton
    evals/
      evals.json          General capability evals
      trigger-evals.json  Trigger-word eval set

  medinex-rpa/
    SKILL.md              Browser-edition working rules
    references/
      safety.md           Safety and side-effect boundaries
      debugging.md        Logs and failure artifacts
      script-guide.md     Browser script structure
      kit-reference.md    kit API
      kit-web.md          Web kit API
```

## Notes

- This repository contains skill documentation and templates only; it does not ship the MedinexRPA installers.
- The browser skill bundles its three API documents under `references/`, so it works standalone.
- The mobile skill does not bundle `u2.jar`, adb, scrcpy, or other third-party binaries.
- Third-party licenses and attribution follow their respective product repositories.
