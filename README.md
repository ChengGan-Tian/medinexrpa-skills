# MedinexRPA Skills

MedinexRPA 系列的 Agent Skills 仓库，包含浏览器版和手机/Android 版。

[English](README.en.md)

## 技能

| 技能 | 平台 | 说明 |
|---|---|---|
| [`medinexrpa-mobile`](skills/medinexrpa-mobile) | 手机 / Android | 产品介绍、脚本编写、元素定位、列表遍历、视觉兜底、多设备任务和排障 |
| [`medinex-rpa`](skills/medinex-rpa) | 浏览器 / Playwright | 浏览器版脚本开发、审查、调试、回归和部署规范 |

## 安装

通过 Skills CLI：

```bash
# 手机版
npx skills add ChengGan-Tian/medinexrpa-skills@medinexrpa-mobile -g -y

# 浏览器版
npx skills add ChengGan-Tian/medinexrpa-skills@medinex-rpa -g -y
```

或手动复制到 Agent 的技能目录：

```text
OpenCode 全局   ~/.config/opencode/skills/<skill-name>
项目内          <项目>/.opencode/skills/<skill-name>
```

## 目录

```text
skills/
  medinexrpa-mobile/
    SKILL.md              产品、工作流、API、定位、列表、视觉、调试、部署
    references/
      product.md          产品能力、架构、数据目录、任务模型
      script-api.md       device / kit / 选择器 / 视觉 API
      patterns.md         列表、分页、等待、重试、页面守卫
      vision.md           模板匹配、OCR、视觉回执
      troubleshooting.md  排查顺序、日志、已知陷阱
    assets/
      script-template.js  可直接复制的脚本骨架
    evals/
      evals.json          通用能力评测用例
      trigger-evals.json  触发词评测集

  medinex-rpa/
    SKILL.md              浏览器版工作规范
    references/
      safety.md           安全与副作用边界
      debugging.md        日志与失败现场排查
      script-guide.md     浏览器版脚本结构
      kit-reference.md    kit API
      kit-web.md          Web kit API
```

## 说明

- 本仓库只包含技能文档和模板，不包含 MedinexRPA 安装包。
- 浏览器版 skill 的 `references/` 已包含三份 API 文档，可独立使用。
- 手机版 skill 不包含 `u2.jar`、adb、scrcpy 等第三方组件。
- 第三方组件的许可证和归属以对应产品仓库为准。
