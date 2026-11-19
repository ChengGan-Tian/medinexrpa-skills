# MedinexRPA Skills

MedinexRPA Mobile 的 Agent Skills 仓库。

## 技能

| 技能 | 说明 |
|---|---|
| `medinexrpa-mobile` | MedinexRPA Mobile（独立 Android RPA 桌面应用）的产品介绍、脚本编写、元素定位、列表遍历、视觉兜底、多设备任务和排障指南 |

## 安装

通过 Skills CLI：

```bash
npx skills add ChengGan-Tian/medinexrpa-skills@medinexrpa-mobile -g -y
```

或手动复制到 Agent 的技能目录：

```text
OpenCode 全局   ~/.config/opencode/skills/medinexrpa-mobile
项目内          <项目>/.opencode/skills/medinexrpa-mobile
```

## 目录

```text
skills/
  medinexrpa-mobile/
    SKILL.md              主流程：产品、工作流、API、定位、列表、调试、部署
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
```

## 说明

- 本仓库只包含技能文档和模板，不包含 MedinexRPA Mobile 安装包。
- 技能面向脚本作者：写脚本、改脚本、定位元素、排查失败、部署脚本。
- 浏览器版 MedinexRPA 请使用 `medinex-rpa` 技能。
- 第三方组件的许可证和归属以产品仓库为准。
